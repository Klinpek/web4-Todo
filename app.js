// Czekamy, aż cały dokument HTML zostanie załadowany
document.addEventListener('DOMContentLoaded', () => {

    // Inicjalizacja komponentów Materialize
    M.AutoInit();

    // Referencje do elementów DOM
    const taskForm = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');
    const filterButtons = document.getElementById('filter-buttons');
    const editModalElement = document.getElementById('edit-modal');
    const darkModeSwitch = document.getElementById('dark-mode-switch');
    const sortBySelect = document.getElementById('sort-by');
    const quickNoteArea = document.getElementById('quick-note-area');
    const noteCardTitle = document.getElementById('note-card-title');
    const calendarEl = document.getElementById('calendar');
    const calendarSummary = document.getElementById('calendar-summary');
    const editModalInstance = M.Modal.getInstance(editModalElement);

    // Stan aplikacji
    let tasks = [];
    let currentFilter = 'all';
    let currentSort = 'createdAt-desc';
    let selectedTaskId = null;
    let calendarInstance = null;

    // --- Zarządzanie LocalStorage ---

    // Funkcja do pobierania zadań z localStorage
    const getTasksFromStorage = () => {
        const storedTasks = localStorage.getItem('tasks');
        return storedTasks ? JSON.parse(storedTasks) : [];
    };

    // Funkcja do zapisywania zadań w localStorage
    const saveTasksToStorage = () => {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    };

    // --- Renderowanie zadań ---

    // Funkcja do renderowania listy zadań
    const renderTasks = () => {
        // Czyszczenie aktualnej listy
        taskList.innerHTML = '<li class="collection-header"><h4>Lista zadań</h4></li>';

        // 1. Filtrowanie zadań
        let processedTasks = tasks.filter(task => {
            if (currentFilter === 'active') return !task.completed;
            if (currentFilter === 'completed') return task.completed;
            return true; // 'all'
        });

        // 2. Sortowanie zadań
        const [sortBy, sortOrder] = currentSort.split('-');
        processedTasks.sort((a, b) => {
            let valA, valB;

            switch (sortBy) {
                case 'deadline':
                    // Zadania bez terminu na końcu
                    valA = a.deadline ? new Date(a.deadline) : new Date('2999-12-31');
                    valB = b.deadline ? new Date(b.deadline) : new Date('2999-12-31');
                    break;
                case 'priority':
                    const priorityMap = { high: 3, medium: 2, low: 1 };
                    valA = priorityMap[a.priority] || 0;
                    valB = priorityMap[b.priority] || 0;
                    break;
                case 'assignee':
                    valA = a.assignee.toLowerCase();
                    valB = b.assignee.toLowerCase();
                    break;
                default: // createdAt
                    valA = new Date(a.createdAt);
                    valB = new Date(b.createdAt);
                    break;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });


        const filteredTasks = processedTasks;

        if (filteredTasks.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'collection-item';
            emptyItem.textContent = 'Brak zadań do wyświetlenia.';
            taskList.appendChild(emptyItem);
            return;
        }

        filteredTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = `collection-item`;
            taskItem.dataset.id = task.id;

            if (task.completed) {
                taskItem.classList.add('completed');
            }

            const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !task.completed;
            if (isOverdue) {
                taskItem.classList.add('overdue');
            }

            // Zaznaczenie aktywnego zadania
            if (task.id === selectedTaskId) {
                taskItem.classList.add('active');
            }

            taskItem.innerHTML = `
                <div>
                    <div class="task-header">
                        <p style="margin-top: 10px; margin-bottom: 10px;">
                            <label>
                                <input type="checkbox" class="filled-in task-checkbox" ${task.completed ? 'checked' : ''} />
                                <span class="task-title">${task.title}</span>
                            </label>
                        </p>
                        <div class="secondary-content">
                            <a href="#!" class="edit-btn"><i class="material-icons">edit</i></a>
                            <a href="#!" class="delete-btn"><i class="material-icons red-text">delete</i></a>
                        </div>
                    </div>
                    ${task.description ? `<p class="task-description grey-text">${task.description}</p>` : ''}
                    <div class="task-details grey-text text-darken-1">
                        <span class="chip priority-${task.priority}">${getPriorityName(task.priority)}</span>
                        ${task.assignee ? `<span class="chip"><i class="material-icons left">person</i>${task.assignee}</span>` : ''}
                        ${task.category ? `<span class="chip"><i class="material-icons left">label</i>${task.category}</span>` : ''}
                        ${task.deadline ? `<span class="chip task-deadline"><i class="material-icons left">date_range</i>${new Date(task.deadline).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
            `;
            taskList.appendChild(taskItem);
        });
    };

    // --- Logika aplikacji ---

    // Funkcja do dodawania nowego zadania
    const addTask = (e) => {
        e.preventDefault();

        const title = document.getElementById('title').value.trim();
        if (!title) {
            M.toast({ html: 'Tytuł zadania jest wymagany!', classes: 'red' });
            return;
        }

        const newTask = {
            id: Date.now().toString(),
            title: title,
            description: document.getElementById('description').value.trim(),
            assignee: document.getElementById('assignee').value.trim(),
            priority: document.getElementById('priority').value,
            deadline: document.getElementById('deadline').value,
            category: document.getElementById('category').value.trim(),
            completed: false,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            note: '' // Dodanie pola na indywidualną notatkę
        };

        tasks.push(newTask);
        saveTasksToStorage();
        renderTasks();
        refreshCalendar();
        taskForm.reset();
        // Resetowanie selecta w Materialize
        M.FormSelect.init(document.getElementById('priority'));
        M.toast({ html: 'Zadanie dodane pomyślnie!', classes: 'green' });
    };

    // Funkcja do przełączania statusu zadania (ukończone/aktywne)
    const toggleTaskCompleted = (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.modifiedAt = new Date().toISOString();
            saveTasksToStorage();
            renderTasks();
            refreshCalendar();
            const message = task.completed ? 'Zadanie oznaczone jako zakończone.' : 'Przywrócono zadanie.';
            M.toast({ html: message, classes: 'blue' });
        }
    };

    // Funkcja do usuwania zadania
    const deleteTask = (taskId) => {
        // Jeśli usuwane zadanie jest aktualnie wybrane, odznacz je
        if (taskId === selectedTaskId) {
            selectedTaskId = null;
            renderNoteForSelectedTask();
        }
        tasks = tasks.filter(t => t.id !== taskId);
        saveTasksToStorage();
        renderTasks();
        refreshCalendar();
        
        M.toast({ html: 'Zadanie usunięte.', classes: 'orange' });
    };

    // Funkcja do otwierania modala edycji
    const openEditModal = (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const modalContent = editModalElement.querySelector('.modal-content');
        modalContent.innerHTML = `
            <h4>Edytuj zadanie</h4>
            <form id="edit-task-form" data-id="${task.id}">
                <div class="row">
                    <div class="input-field col s12">
                        <input id="edit-title" type="text" value="${task.title}" required>
                        <label for="edit-title" class="active">Tytuł zadania</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12">
                        <textarea id="edit-description" class="materialize-textarea">${task.description}</textarea>
                        <label for="edit-description" class="active">Opis</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12 m6">
                        <input id="edit-assignee" type="text" value="${task.assignee}">
                        <label for="edit-assignee" class="active">Wykonawca</label>
                    </div>
                     <div class="input-field col s12 m6">
                        <input id="edit-category" type="text" value="${task.category}">
                        <label for="edit-category" class="active">Kategoria</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12 m6">
                        <select id="edit-priority">
                            <option value="low" data-color="green" ${task.priority === 'low' ? 'selected' : ''}>Niski</option>
                            <option value="medium" data-color="orange" ${task.priority === 'medium' ? 'selected' : ''}>Średni</option>
                            <option value="high" data-color="red" ${task.priority === 'high' ? 'selected' : ''}>Wysoki</option>
                        </select>
                        <label>Priorytet</label>
                    </div>
                    <div class="input-field col s12 m6">
                        <input type="text" class="datepicker" id="edit-deadline" value="${task.deadline ? new Date(task.deadline).toLocaleDateString('pl-PL') : ''}">
                        <label for="edit-deadline" class="active">Termin wykonania</label>
                    </div>
                </div>
                <button type="submit" class="btn waves-effect waves-light teal">Zapisz zmiany</button>
            </form>
        `;

        // Inicjalizacja komponentów Materialize w modalu
        const editPrioritySelect = modalContent.querySelector('#edit-priority');
        M.FormSelect.init(editPrioritySelect);
        colorizeSelectOptions(editPrioritySelect);
        M.Datepicker.init(modalContent.querySelector('#edit-deadline'), {
            format: 'yyyy-mm-dd',
            autoClose: true,
            i18n: {
                months: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
                monthsShort: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
                weekdays: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
                weekdaysShort: ['Nie', 'Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob'],
                weekdaysAbbrev: ['N', 'P', 'W', 'Ś', 'C', 'P', 'S']
            }
        });
        M.updateTextFields(); // Aktualizuje labele dla inputów z wartościami

        // Obsługa zapisu formularza edycji
        const editForm = modalContent.querySelector('#edit-task-form');
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            updateTask(task.id);
        });

        editModalInstance.open();
    };

    // Funkcja do aktualizacji zadania
    const updateTask = (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const newTitle = document.getElementById('edit-title').value.trim();
        if (!newTitle) {
            M.toast({ html: 'Tytuł zadania jest wymagany!', classes: 'red' });
            return;
        }

        // Pobranie daty z datepickera i konwersja do formatu YYYY-MM-DD
        const deadlineInstance = M.Datepicker.getInstance(document.getElementById('edit-deadline'));
        const deadlineValue = deadlineInstance.date ? deadlineInstance.date.toISOString().split('T')[0] : '';

        task.title = newTitle;
        task.description = document.getElementById('edit-description').value.trim();
        task.assignee = document.getElementById('edit-assignee').value.trim();
        task.category = document.getElementById('edit-category').value.trim();
        task.priority = document.getElementById('edit-priority').value;
        task.deadline = deadlineValue;
        task.modifiedAt = new Date().toISOString();

        saveTasksToStorage();
        renderTasks();
        refreshCalendar();
        editModalInstance.close();
        M.toast({ html: 'Zadanie zaktualizowane.', classes: 'green' });
    };

    // Funkcja do zmiany filtra
    const changeFilter = (filter) => {
        currentFilter = filter;
        // Aktualizacja aktywnego przycisku
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === currentFilter) {
                btn.classList.add('active');
            }
        });
        selectedTaskId = null; // Resetowanie wyboru po zmianie filtra
        renderNoteForSelectedTask();
        refreshCalendar();
        renderTasks();
    };

    // Funkcja do wyboru zadania
    const selectTask = (taskId) => {
        selectedTaskId = taskId;
        renderTasks(); // Przerenderowanie listy, aby dodać klasę 'active'
        renderNoteForSelectedTask();
    };

    // Funkcja do renderowania notatki dla wybranego zadania
    const renderNoteForSelectedTask = () => {
        if (selectedTaskId) {
            const selectedTask = tasks.find(t => t.id === selectedTaskId);
            if (selectedTask) {
                noteCardTitle.innerHTML = `Notatka do: <span class="teal-text text-lighten-2">${selectedTask.title}</span>`;
                quickNoteArea.value = selectedTask.note || '';
                quickNoteArea.disabled = false;
                M.textareaAutoResize(quickNoteArea);
            }
        } else {
            noteCardTitle.textContent = 'Notatka';
            quickNoteArea.value = '';
            quickNoteArea.disabled = true;
            M.textareaAutoResize(quickNoteArea);
        }
    };

    // Funkcja do zapisywania notatki dla wybranego zadania
    const saveNoteForSelectedTask = () => {
        if (selectedTaskId) {
            const selectedTask = tasks.find(t => t.id === selectedTaskId);
            if (selectedTask) {
                selectedTask.note = quickNoteArea.value;
                selectedTask.modifiedAt = new Date().toISOString();
                saveTasksToStorage();
            }
        }
    };

    // Funkcja do zmiany sortowania
    const changeSort = (sortValue) => {
        currentSort = sortValue;
        renderTasks();
    };

    const toggleDarkMode = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        localStorage.setItem('darkMode', isDark);
    };

    // --- Logika Kalendarza ---

    const initializeCalendar = () => {
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pl',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: ''
            },
            events: getCalendarEvents(),
            eventClick: function(info) {
                selectTask(info.event.id);
            },
            datesSet: function(dateInfo) {
                updateCalendarSummary(dateInfo.view.currentStart, dateInfo.view.currentEnd);
            }
        });
        calendarInstance.render();
        updateCalendarSummary(calendarInstance.view.currentStart, calendarInstance.view.currentEnd);
    };

    const getCalendarEvents = () => {
        return tasks
            .filter(task => task.deadline) // Tylko zadania z terminem
            .map(task => ({
                id: task.id,
                title: task.title,
                start: task.deadline,
                allDay: true,
                color: getPriorityColor(task.priority),
                borderColor: getPriorityColor(task.priority)
            }));
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#f44336'; // red
            case 'medium': return '#ff9800'; // orange
            case 'low': return '#4caf50'; // green
            default: return '#26a69a'; // teal
        }
    };

    const refreshCalendar = () => {
        if (calendarInstance) {
            calendarInstance.removeAllEvents();
            calendarInstance.addEventSource(getCalendarEvents());
        }
    };

    const updateCalendarSummary = (start, end) => {
        const tasksInMonth = tasks.filter(task => {
            if (!task.deadline) return false;
            const taskDate = new Date(task.deadline);
            return taskDate >= start && taskDate < end;
        }).length;
        calendarSummary.textContent = `W tym miesiącu masz ${tasksInMonth} zadania.`;
    };
    // --- Pomocnicze funkcje ---

    // Funkcja zwracająca nazwę priorytetu
    const getPriorityName = (priority) => {
        switch (priority) {
            case 'high': return 'Wysoki';
            case 'medium': return 'Średni';
            case 'low': return 'Niski';
            default: return 'Brak';
        }
    };

    // Funkcja do kolorowania opcji w select
    const colorizeSelectOptions = (selectElement) => {
        const instance = M.FormSelect.getInstance(selectElement);
        if (!instance || !instance.dropdown) {
            // Poczekaj chwilę i spróbuj ponownie, jeśli dropdown nie jest jeszcze gotowy
            setTimeout(() => colorizeSelectOptions(selectElement), 100);
            return;
        }

        const options = selectElement.options;
        const dropdownOptions = instance.dropdown.el.querySelectorAll('li > span');

        dropdownOptions.forEach((span, index) => {
            if (options[index] && options[index].dataset.color) {
                const color = options[index].dataset.color;
                // Usuń istniejącą ikonę, jeśli jest
                const existingIcon = span.querySelector('.material-icons');
                if (existingIcon) existingIcon.remove();
                // Dodaj nową ikonę
                span.insertAdjacentHTML('afterbegin', `<i class="material-icons priority-icon-${options[index].value}">fiber_manual_record</i>`);
            }
        });
    };

    // --- Event Listeners ---

    // Dodawanie zadania
    taskForm.addEventListener('submit', addTask);

    // Obsługa kliknięć na liście zadań (delegacja zdarzeń)
    taskList.addEventListener('click', (e) => {
        const target = e.target;
        const taskItem = target.closest('.collection-item');
        if (!taskItem) return;

        const taskId = taskItem.dataset.id;

        // Kliknięcie na checkbox
        if (target.classList.contains('task-checkbox')) {
            toggleTaskCompleted(taskId);
        }

        // Kliknięcie na przycisk usuwania
        if (target.closest('.delete-btn')) {
            // Potwierdzenie usunięcia
            if (confirm('Czy na pewno chcesz usunąć to zadanie?')) {
                deleteTask(taskId);
            }
        }

        // Kliknięcie na przycisk edycji
        if (target.closest('.edit-btn')) {
            openEditModal(taskId);
        }

        // Kliknięcie na element listy (ale nie na przycisk lub checkbox)
        if (!target.closest('a') && !target.closest('label')) {
            selectTask(taskId);
        }
    });

    // Obsługa kliknięć na przyciski filtrów
    filterButtons.addEventListener('click', (e) => {
        const target = e.target.closest('.filter-btn');
        if (target) {
            changeFilter(target.dataset.filter);
        }
    });

    // Obsługa zmiany sortowania
    sortBySelect.addEventListener('change', (e) => {
        changeSort(e.target.value);
    });

    // Obsługa pola szybkiej notatki (zapis przy pisaniu)
    quickNoteArea.addEventListener('keyup', saveNoteForSelectedTask);

    // Obsługa przełącznika trybu ciemnego
    darkModeSwitch.addEventListener('change', (e) => {
        toggleDarkMode(e.target.checked);
    });

    // --- Inicjalizacja aplikacji ---

    // Załadowanie zadań z localStorage i pierwsze renderowanie
    tasks = getTasksFromStorage();
    renderTasks();

    // Inicjalizacja kalendarza
    initializeCalendar();

    // Sprawdzenie i ustawienie trybu ciemnego przy starcie
    const prefersDark = localStorage.getItem('darkMode') === 'true';
    darkModeSwitch.checked = prefersDark;
    toggleDarkMode(prefersDark);

    // Kolorowanie głównego selecta priorytetów
    const mainPrioritySelect = document.getElementById('priority');
    colorizeSelectOptions(mainPrioritySelect);


    // Inicjalizacja datepickera w głównym formularzu z polskimi tłumaczeniami
    M.Datepicker.init(document.querySelector('.datepicker'), {
        format: 'yyyy-mm-dd',
        autoClose: true,
        i18n: {
            months: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
            monthsShort: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
            weekdays: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
            weekdaysShort: ['Nie', 'Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob'],
            weekdaysAbbrev: ['N', 'P', 'W', 'Ś', 'C', 'P', 'S']
        }
    });
});