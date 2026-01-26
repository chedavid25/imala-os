document.addEventListener('DOMContentLoaded', function () {
    
    // ==========================================
    // 1. Initialization & State
    // ==========================================
    
    let calendar;
    let dataTable;
    let tasks = []; 
    let categories = ['General', 'Ventas', 'Marketing']; 
    let currentFilter = 'TODAY'; 
    let currentSearch = '';
    let currentMonthFilter = '';
    let currentCategoryFilter = 'ALL'; 
    let teamMembers = []; // New State for Users
    let clientsList = []; // New State for Clients
    let drake = null; 

    const db = window.Imala.db;
    const auth = window.Imala.auth;

    // Check if elements exist before initializing Modals to prevent errors on other pages
    const modalEl = document.getElementById('event-modal');
    if (!modalEl) return; // Exit if we are not on the tasks page

    const taskModal = new bootstrap.Modal(modalEl);
    const catsModalEl = document.getElementById('categories-modal');
    const catsModal = catsModalEl ? new bootstrap.Modal(catsModalEl) : null;

    const form = document.getElementById('form-event');

    const containerTodo = document.getElementById('kanban-todo');
    const containerLate = document.getElementById('kanban-late');
    const containerCompleted = document.getElementById('kanban-completed');
    const filterButtons = document.querySelectorAll('.filter-bar button');
    
    const topSearchInput = document.getElementById('top-search-input');
    const monthFilterInput = document.getElementById('filter-month-history');

    // MOBILE OPTIMIZATION: Default to List View on small screens
    if (window.innerWidth < 768) {
        const kanbanTab = document.querySelector('a[href="#tab-kanban"]');
        const listTab = document.querySelector('a[href="#tab-list"]');
        const kanbanPane = document.getElementById('tab-kanban');
        const listPane = document.getElementById('tab-list');
        
        if (kanbanTab && listTab && kanbanPane && listPane) {
            kanbanTab.classList.remove('active');
            listTab.classList.add('active');
            kanbanPane.classList.remove('active');
            listPane.classList.add('active');
        }
    }

    // ==========================================
    // 2. Load Data & Filters
    // ==========================================
    
    auth.onAuthStateChanged(user => {
        if (user) {
            loadCategories();
            loadCategories();
            loadTeamMembers(); // Fetch Users
            loadClientsList(); // Fetch Clients
            loadTasks(user.uid);
        } else {
            console.log("No User - Redirecting");
            window.location.href = 'auth-login.html';
        }
    });

    function loadTasks(uid) {
        db.collection('tasks').onSnapshot(snapshot => {
            tasks = [];
            snapshot.forEach(doc => {
                if(doc.id === 'settings_categories') return; 
                tasks.push({ id: doc.id, ...doc.data() });
            });
            checkLateTasks();
            checkAutoCompletion(); 
            renderGenerationStats(); // Update stats
            renderAllViews();
        }, error => {
            console.error("Error loading tasks:", error);
            if(error.code === 'permission-denied') {
                alert("Error de Permisos: No tienes acceso a la colección de tareas. Verifica las Reglas de Firestore.");
            }
        });
    }

    function loadCategories() {
        const catRef = db.collection('tasks').doc('settings_categories');
        catRef.onSnapshot(doc => {
            if(doc.exists && doc.data().list) {
                categories = doc.data().list;
            } else {
                catRef.set({ list: categories });
            }
            updateCategorySelects();
            renderCategoriesList();
        });
    }

    // Load available users for assignment
    function loadTeamMembers() {
        // Fetch all users for now (Admin/Broker see all, Agent sees only self/colleagues ideally, but simple list for now)
        db.collection('users').get().then(snapshot => {
            teamMembers = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                teamMembers.push({ uid: doc.id, name: d.displayName || 'Usuario', email: d.email });
            });
            updateAssignmentSelect();
        }).catch(err => console.log("Error loading members", err));
    }
    
    function updateAssignmentSelect() {
        const sel = document.getElementById('event-assignedTo');
        if(!sel) return;
        
        // Preserve "Ambos" and legacy hardcoded if desired, or replace?
        // Let's Keep "David", "Lucre" legacy if they exist in DB, otherwise clean slate.
        // Actually, let's append real users after "Ambos".
        
        // Clear but keep Defaults?
        // For this OS, let's render standard options:
        sel.innerHTML = `
            <option value="David">David (Default)</option>
            <option value="Ambos">Ambos</option>
        `;
        
        teamMembers.forEach(m => {
            // Avoid duplicates if David is in DB with same name
            if(m.name !== 'David') {
                const opt = document.createElement('option');
                opt.value = m.name; // Storing Name for now to match legacy
                opt.textContent = m.name;
                sel.appendChild(opt);
            }
        });
    }

    // Load available Clients for assignment
    function loadClientsList() {
        db.collection('clients').where('type', '==', 'CLIENT').get().then(snap => {
            clientsList = [];
            snap.forEach(doc => {
                clientsList.push({ id: doc.id, ...doc.data() });
            });
            updateClientSelect();
        });
    }

    function updateClientSelect() {
        const sel = document.getElementById('event-client-id');
        if(!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">- Ninguno -</option>';
        clientsList.forEach(c => {
             const opt = document.createElement('option');
             opt.value = c.id;
             opt.textContent = c.name;
             sel.appendChild(opt);
        });
        sel.value = current;
    }

    // --- Search & Filters ---

    if(topSearchInput) {
        topSearchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase();
            renderAllViews();
        });
    }

    if(monthFilterInput) {
        monthFilterInput.addEventListener('change', (e) => {
            currentMonthFilter = e.target.value; // YYYY-MM
            if(currentMonthFilter) {
                filterButtons.forEach(b => b.classList.remove('active'));
                currentFilter = 'HISTORY'; 
            } else {
                currentFilter = 'ALL';
                document.querySelector('[data-filter="ALL"]').classList.add('active');
            }
            renderAllViews();
        });
    }

    function getFilteredTasks() {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        return tasks.filter(t => {
            // 1. Text Search
            if (currentSearch) {
                const textMatch = (t.title && t.title.toLowerCase().includes(currentSearch)) || 
                                  (t.description && t.description.toLowerCase().includes(currentSearch));
                if (!textMatch) return false;
            }

            // 2. Month Filter
            if (currentMonthFilter && currentFilter === 'HISTORY') {
                if (!t.dueDate) return false;
                return t.dueDate.startsWith(currentMonthFilter);
            }

            // 3. Button Filters
            if (currentFilter === 'ALL') return true;
            if (currentFilter === 'LATE') return t.status === 'LATE';
            if (currentFilter === 'COMPLETED') return t.status === 'COMPLETED';
            
            if (!t.dueDate) return false;
            const taskDate = new Date(t.dueDate + 'T00:00:00'); 
            
            if (currentFilter === 'TODAY') {
                return taskDate.getTime() === today.getTime();
            }
            if (currentFilter === 'WEEK') {
                const oneWeek = new Date(today);
                oneWeek.setDate(today.getDate() + 7);
                return taskDate >= today && taskDate <= oneWeek;
            }
            if (currentFilter === 'MONTH') {
                return taskDate.getMonth() === today.getMonth() && taskDate.getFullYear() === today.getFullYear();
            }
            return true;
        });
    }

    function renderAllViews() {
        const filtered = getFilteredTasks();
        renderKanban(filtered); 
        renderList(filtered);
        renderCalendar(filtered);
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            if(monthFilterInput) monthFilterInput.value = '';
            currentMonthFilter = '';
            
            renderAllViews();
        });
    });

    // ==========================================
    // 3. Kanban View
    // ==========================================

    function renderKanban(filteredTasks) {
        if(!containerTodo) return; // Guard clause

        if (drake) {
            drake.destroy();
        }

        containerTodo.innerHTML = '';
        containerLate.innerHTML = '';
        containerCompleted.innerHTML = '';

        filteredTasks.forEach(t => {
            const card = createKanbanCard(t);
            if (t.status === 'TODO') containerTodo.appendChild(card);
            else if (t.status === 'LATE') containerLate.appendChild(card);
            else if (t.status === 'COMPLETED') containerCompleted.appendChild(card);
            else containerTodo.appendChild(card);
        });

        // Robust Configuration
        drake = dragula([containerTodo, containerLate, containerCompleted], {
            moves: function (el, container, handle) {
                return true; // Always allow move
            },
            accepts: function (el, target, source, sibling) {
                return true; // Always allow drop
            }
        });

        drake.on('drop', function (el, target, source, sibling) {
            if(!target) return;
            const taskId = el.getAttribute('data-id');
            const newStatus = target.getAttribute('data-status');
            
            updateTaskStatus(taskId, newStatus);
             if (newStatus === 'COMPLETED') {
                 checkAndCreateRecurrence(taskId);
            }
        });
    }

    function createKanbanCard(task) {
        const div = document.createElement('div');
        div.className = `card task-card mb-3 priority-${task.priority || 'MEDIUM'}`;
        div.setAttribute('data-id', task.id);
        div.setAttribute('data-priority', task.priority || 'MEDIUM'); 
        
        // Google Calendar Styling
        let googleIcon = '';
        if (task.source === 'google') {
            div.className += ' bg-light border-secondary text-muted';
            googleIcon = '<i class="mdi mdi-google text-danger me-1"></i>';
            div.style.borderStyle = 'dashed'; // Visual distinction
        }
        
        // Ensure touch-action via JS as well just in case
        div.style.touchAction = 'none';

        let assignedAvatar = '';
        // ... (rest of avatar logic same as before, skipping for brevity in replacement if possible, but replace tool needs full logic)
        // Re-implementing Avatar Logic here to be safe
        if(task.assignedTo === 'Ambos') {
             assignedAvatar = `<div class="avatar-group-item"><span class="avatar-title rounded-circle bg-info text-white font-size-10">A</span></div>`;
        }
        const realUser = teamMembers.find(m => m.name === task.assignedTo);
        if (realUser) {
             const uLetter = realUser.name.charAt(0);
             const colors = ['bg-primary', 'bg-success', 'bg-warning', 'bg-info', 'bg-danger'];
             const uColor = colors[realUser.name.length % colors.length];
             assignedAvatar = `<div class="avatar-group-item" title="${realUser.name}">
                                <span class="avatar-title rounded-circle ${uColor} text-white font-size-10">${uLetter}</span>
                               </div>`;
        }
        
        let timeDisplay = '';
        if (task.dueTime) timeDisplay = `<span class="ms-2"><i class="mdi mdi-clock-outline"></i> ${task.dueTime}</span>`;

        let clientDisplay = '';
        if(task.clientName) {
            clientDisplay = `<small class="d-block text-primary mt-1 mb-1"><i class="mdi mdi-account-circle me-1"></i>${task.clientName}</small>`;
        }

        div.innerHTML = `
            <div class="card-body p-3">
                <div class="d-flex justify-content-between mb-2">
                    <span class="badge ${task.category === 'Ventas' ? 'bg-success' : 'bg-secondary'} font-size-10">${task.category || 'General'}</span>
                    <small class="text-muted fw-bold">${getPriorityLabel(task.priority)}</small>
                </div>
                <h5 class="font-size-15 mb-1 text-truncate">${googleIcon}${task.title}</h5>
                <p class="text-muted mb-1 font-size-12 text-truncate">${task.description || ''}</p>
                ${clientDisplay}
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <p class="text-muted mb-0 font-size-12"><i class="mdi mdi-calendar"></i> ${formatDate(task.dueDate)} ${timeDisplay}</p>
                    <div class="avatar-group">${assignedAvatar}</div>
                </div>
            </div>
        `;
        
        div.addEventListener('click', (e) => {
             // Optional: Disable edit for Google Tasks or allow viewing only
             openEditModal(task.id);
        });
        return div;
    }

    // ==========================================
    // 4. List View (Localized)
    // ==========================================

    function renderList(filteredTasks) {
        if (dataTable) dataTable.destroy();

        if(!document.getElementById('datatable-tasks')) return;

        const tbody = document.querySelector('#datatable-tasks tbody');
        tbody.innerHTML = '';

        filteredTasks.forEach(t => {
            const tr = document.createElement('tr');
            
            // Google Styling Row
            if (t.source === 'google') {
                tr.classList.add('table-light', 'text-muted');
            }

            let actionBtn = '';
            if (t.source === 'google') {
                 actionBtn = `<span class="badge badge-soft-secondary"><i class="mdi mdi-google"></i> GCal</span>`;
            } else if (t.status !== 'COMPLETED') {
                actionBtn = `<button class="btn btn-sm btn-success complete-btn me-1" data-id="${t.id}">Listo!</button>`;
            } else {
                actionBtn = `<span class="badge badge-soft-success me-2"><i class="mdi mdi-check"></i></span>`;
            }

            let clientBadge = '';
            if(t.clientName) {
                clientBadge = `<span class="badge badge-soft-info ms-2"><i class="mdi mdi-account me-1"></i>${t.clientName}</span>`;
            }
            
            // Add Google Icon to title if google
            let titlePrefix = t.source === 'google' ? '<i class="mdi mdi-google text-danger me-1"></i> ' : '';

            tr.innerHTML = `
                <td data-label="Tarea">
                    <div class="fw-bold">${titlePrefix}${t.title} ${clientBadge}</div>
                    <small class="text-muted">${t.description ? t.description.substring(0,30) + '...' : ''}</small>
                </td>
                <td data-label="Vencimiento">
                    ${formatDate(t.dueDate)} ${t.dueTime || ''}
                </td>
                <td data-label="Prioridad"><span class="badge ${getPriorityBadge(t.priority)}">${getPriorityLabel(t.priority)}</span></td>
                <td data-label="Estado"><span class="badge ${getStatusBadge(t.status)}">${getStatusLabel(t.status)}</span></td>
                <td data-label="Asignado a" class="fw-bold text-primary">${t.assignedTo || 'David'}</td>
                <td data-label="Acciones">
                    <div class="d-flex gap-2">
                        ${actionBtn}
                        ${t.source !== 'google' ? `<button class="btn btn-sm btn-soft-primary edit-btn" data-id="${t.id}"><i class="mdi mdi-pencil"></i></button>` : ''}
                        ${t.source !== 'google' ? `<button class="btn btn-sm btn-soft-danger delete-btn" data-id="${t.id}"><i class="mdi mdi-trash-can"></i></button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        dataTable = $('#datatable-tasks').DataTable({
             language: {
                "decimal": "",
                "emptyTable": "No hay información",
                "info": "Mostrando _START_ a _END_ de _TOTAL_ Entradas",
                "infoEmpty": "Mostrando 0 a 0 de 0 Entradas",
                "infoFiltered": "(Filtrado de _MAX_ total entradas)",
                "infoPostFix": "",
                "thousands": ",",
                "lengthMenu": "Mostrar _MENU_ Entradas",
                "loadingRecords": "Cargando...",
                "processing": "Procesando...",
                "search": "Buscar:",
                "zeroRecords": "Sin resultados encontrados",
                "paginate": {
                    "first": "Primero",
                    "last": "Ultimo",
                    "next": "Siguiente",
                    "previous": "Anterior"
                }
            },
             order: [[1, 'asc']] 
        });

        tbody.onclick = function(e) {
            const btn = e.target.closest('button');
            if(!btn) return;
            const id = btn.dataset.id;
            
            if(btn.classList.contains('edit-btn')) openEditModal(id);
            if(btn.classList.contains('delete-btn')) deleteTask(id);
            if(btn.classList.contains('complete-btn')) {
                updateTaskStatus(id, 'COMPLETED');
                checkAndCreateRecurrence(id);
            }
        };
    }

    // ==========================================
    // 5. Calendar View
    // ==========================================

    function renderCalendar(filteredTasks) {
        const calendarEl = document.getElementById('calendar');
        if(!calendarEl) return;

        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(mapTasksToEvents(filteredTasks));
            return;
        }
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es', 
            events: mapTasksToEvents(filteredTasks),
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            dayMaxEvents: true, // Allow "more" link when too many events
            eventDisplay: 'block', // Force block display
            eventContent: function(arg) {
                let timeText = arg.timeText;
                let title = arg.event.title;
                let color = '#fff'; // Default text color
                if(arg.event.backgroundColor === '#f1b44c') color = '#000'; // Dark text for yellow bg

                let html = `<div style="padding: 2px; color: ${color}; overflow: hidden;">`;
                if(timeText) {
                    html += `<div style="font-weight:bold; font-size:11px;">${timeText}</div>`;
                }
                html += `<div style="font-size:12px; line-height:1.2;">${title}</div></div>`;

                return { html: html };
            },
            editable: true,
            droppable: true,
            eventClick: (info) => openEditModal(info.event.id),
            eventDrop: (info) => updateTaskDate(info.event.id, info.event.start)
        });
        calendar.render();
        
        $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
            if(e.target.hash === '#tab-calendar') calendar.updateSize();
        });
    }

    function mapTasksToEvents(tasksData) {
        return tasksData.map(t => {
            let color = '#f1b44c'; // Default TODO (Yellow)
            let classNames = [];

            if (t.source === 'google') {
                color = '#74788d'; // Gray for Google
            } else if (t.status === 'LATE') {
                color = '#f46a6a'; // Red
            } else if (t.status === 'COMPLETED') {
                color = '#34c38f'; // Green
                classNames.push('text-decoration-line-through');
            } else {
                // TODO or others
                color = '#f1b44c'; // Yellow
            }
            
            return {
                id: t.id,
                title: t.title,
                start: t.dueDate + (t.dueTime ? 'T' + t.dueTime : ''), 
                backgroundColor: color,
                borderColor: color,
                classNames: classNames
            };
        });
    }

    // ==========================================
    // 6. Logic
    // ==========================================

    function checkLateTasks() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const nowTimeStr = now.toTimeString().split(' ')[0].substring(0,5); 

        tasks.forEach(t => {
            if (t.status === 'COMPLETED' || t.status === 'LATE') return;
            if (!t.dueDate) return;

            if (t.dueDate < todayStr) {
                 updateTaskStatus(t.id, 'LATE');
            } else if (t.dueDate === todayStr && t.dueTime && t.dueTime < nowTimeStr) {
                 updateTaskStatus(t.id, 'LATE');
            }
        });
    }

    // ... (rest of code)

    // Helpers
    function getTodayStr() { 
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function checkAndCreateRecurrence(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.recurrence || task.recurrence === 'NONE') return;

        let nextDate = new Date(task.dueDate || new Date());
        
        if (task.recurrence === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7);
        if (task.recurrence === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
        if (task.recurrence === 'YEARLY') nextDate.setFullYear(nextDate.getFullYear() + 1);

        const nextTask = { ...task };
        delete nextTask.id; 
        delete nextTask.createdAt;
        nextTask.status = 'TODO'; 
        nextTask.dueDate = nextDate.toISOString().split('T')[0]; 
        nextTask.title = task.title; 

        db.collection('tasks').add(nextTask);
    }

    // ==========================================
    // 7. Modals
    // ==========================================

    function openEditModal(taskId = null) {
        updateCategorySelects();
        updateClientSelect(); // Refresh Clients options

        if (taskId) {
            const task = tasks.find(t => t.id === taskId);
            document.getElementById('task-id').value = taskId;
            document.getElementById('event-title').value = task.title;
            document.getElementById('event-description').value = task.description || '';
            document.getElementById('event-category').value = task.category || 'General';
            document.getElementById('event-status').value = task.status || 'TODO';
            document.getElementById('event-priority').value = task.priority || 'MEDIUM';
            document.getElementById('event-assignedTo').value = task.assignedTo || 'David';
             document.getElementById('event-assignedTo').value = task.assignedTo || 'David';
             document.getElementById('event-recurrence').value = task.recurrence || 'NONE';
             document.getElementById('event-client-id').value = task.clientId || '';
             // ...
            document.getElementById('event-dueDate').value = task.dueDate || getTodayStr();
            document.getElementById('event-dueTime').value = task.dueTime || '';
            
            document.getElementById('btn-delete-event').style.display = 'block';
            document.getElementById('modal-title').textContent = 'Editar Tarea';
        } else {
            form.reset();
            document.getElementById('task-id').value = '';
            document.getElementById('event-dueDate').value = getTodayStr();
            document.getElementById('event-status').value = 'TODO';
            document.getElementById('event-priority').value = 'MEDIUM';
            document.getElementById('event-assignedTo').value = 'David';
            document.getElementById('event-client-id').value = '';
            
            document.getElementById('btn-delete-event').style.display = 'none';
            document.getElementById('modal-title').textContent = 'Nueva Tarea';
        }
        taskModal.show();
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('task-id').value;
        const taskData = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            category: document.getElementById('event-category').value,
            priority: document.getElementById('event-priority').value,
            status: document.getElementById('event-status').value,
            assignedTo: document.getElementById('event-assignedTo').value,
            recurrence: document.getElementById('event-recurrence').value,
            dueDate: document.getElementById('event-dueDate').value,
            dueTime: document.getElementById('event-dueTime').value,
            dueTime: document.getElementById('event-dueTime').value,
            clientId: document.getElementById('event-client-id').value || null,
            updatedAt: new Date()
        };

        // Add Client Name if ID selected
        if(taskData.clientId) {
            const c = clientsList.find(x => x.id === taskData.clientId);
            if(c) taskData.clientName = c.name;
        }

        if (id) {
            db.collection('tasks').doc(id).update(taskData).then(() => taskModal.hide());
            if (taskData.status === 'COMPLETED') checkAndCreateRecurrence(id);
        } else {
            taskData.createdAt = new Date();
            db.collection('tasks').add(taskData).then(() => taskModal.hide());
        }
    });

    document.getElementById('btn-delete-event').addEventListener('click', () => {
        if(confirm('¿Eliminar?')) {
            db.collection('tasks').doc(document.getElementById('task-id').value).delete().then(() => taskModal.hide());
        }
    });

    // Categories Logic
    if (document.getElementById('btn-edit-cats-modal')) {
        document.getElementById('btn-edit-cats-modal').addEventListener('click', () => catsModal ? catsModal.show() : null);
    }
    if(document.getElementById('btn-manage-categories')) {
        document.getElementById('btn-manage-categories').addEventListener('click', () => catsModal ? catsModal.show() : null);
    }

    if(document.getElementById('btn-add-cat')) {
        document.getElementById('btn-add-cat').addEventListener('click', () => {
            const val = document.getElementById('new-cat-name').value;
            if(val) {
                const newList = [...categories, val];
                db.collection('tasks').doc('settings_categories').set({ list: newList }).then(() => {
                    document.getElementById('new-cat-name').value = '';
                });
            }
        });
    }

    function renderCategoriesList() {
        const list = document.getElementById('categories-list');
        if(!list) return;
        list.innerHTML = '';
        categories.forEach(c => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                ${c} 
                <button class="btn btn-sm btn-soft-danger"><i class="mdi mdi-trash-can"></i></button>
            `;
            li.querySelector('button').addEventListener('click', () => {
                 const newList = categories.filter(cat => cat !== c);
                 db.collection('tasks').doc('settings_categories').set({ list: newList });
            });
            list.appendChild(li);
        });
    }

    function updateCategorySelects() {
        const s = document.getElementById('event-category');
        if(!s) return;
        const currentVal = s.value;
        s.innerHTML = '';
        categories.forEach(c => {
             const opt = document.createElement('option');
             opt.value = c;
             opt.textContent = c;
             s.appendChild(opt);
        });
        s.value = currentVal || 'General'; 
    }

    const btnNewTask = document.getElementById('btn-new-task-main');
    if(btnNewTask) btnNewTask.addEventListener('click', () => openEditModal());

    const btnNewTaskKanban = document.getElementById('btn-new-task-kanban');
    if(btnNewTaskKanban) btnNewTaskKanban.addEventListener('click', () => openEditModal());

    if (document.getElementById('btn-new-task-calendar')) {
        document.getElementById('btn-new-task-calendar').addEventListener('click', () => openEditModal());
    }

    function updateTaskStatus(id, status) {
        db.collection('tasks').doc(id).update({ status: status });
    }
    
    function updateTaskDate(id, dateObj) {
        const dateStr = dateObj.toISOString().split('T')[0];
        db.collection('tasks').doc(id).update({ dueDate: dateStr });
    }
    
    function deleteTask(id) {
        if(confirm('¿Seguro?')) db.collection('tasks').doc(id).delete();
    }

    // Helpers
    function getTodayStr() { 
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    function formatDate(str) { 
        if(!str) return '';
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    }

    function getPriorityLabel(p) {
        if (p === 'HIGH') return 'Alta';
        if (p === 'MEDIUM') return 'Media';
        if (p === 'LOW') return 'Baja';
        return p;
    }

    function getPriorityBadge(p) {
        if (p === 'HIGH') return 'badge-soft-danger';
        if (p === 'MEDIUM') return 'badge-soft-warning';
        if (p === 'LOW') return 'badge-soft-success';
        return 'badge-soft-primary';
    }

    function getStatusLabel(s) {
        if (s === 'TODO') return 'Pendiente'; 
        if (s === 'COMPLETED') return 'Completado'; 
        if (s === 'LATE') return 'Atrasado'; 
        return s;
    }

    function getStatusBadge(s) {
        if (s === 'TODO') return 'badge-soft-warning';
        if (s === 'COMPLETED') return 'badge-soft-success';
        if (s === 'LATE') return 'badge-soft-danger';
        return 'badge-soft-secondary';
    }

    // ==========================================
    // 8. Google Calendar Sync
    // ==========================================
    // PLACEHOLDERS - USER MUST REPLACE THESE
    // ==========================================
    // 8. Google Calendar Sync
    // ==========================================
    const gconf = window.ImalaConfig ? window.ImalaConfig.googleCalendar : {};
    
    const CLIENT_ID = gconf.clientId || 'MISSING_CLIENT_ID';
    const API_KEY = gconf.apiKey || 'MISSING_API_KEY';
    const DISCOVERY_DOC = gconf.discoveryDocs ? gconf.discoveryDocs[0] : 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
    const SCOPES = gconf.scopes || 'https://www.googleapis.com/auth/calendar';

    let tokenClient;
    let gapiInited = false;
    let gisInited = false;
    let isSilentMode = false;

    const syncBtn = document.getElementById('btn-sync-gcal');
    if(syncBtn) {
        syncBtn.addEventListener('click', handleSyncClick);
    }

    // Initialize on load if possible (or just wait for click)
    function maybeInitGapi() {
        if((typeof gapi !== 'undefined') && (typeof google !== 'undefined') && !gapiInited) {
            gapi.load('client', async () => {
                await gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
                
                // CHECK FOR STORED TOKEN
                const stored = localStorage.getItem('gcal_token');
                if(stored) {
                    const token = JSON.parse(stored);
                    const now = Date.now();
                    // Check validity (give 5 min buffer)
                    if(token.expires_at && now < (token.expires_at - 300000)) {
                        gapi.client.setToken(token);
                        updateSyncUI(true);
                    } else {
                        // Token expired? Try Silent Refresh
                        console.log("Token expired, attempting silent refresh...");
                        isSilentMode = true;
                        // We need tokenClient inited first, which happens below, so we wait a tick or call after init
                    }
                }
            });
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: handleTokenResponse, 
            });
            gisInited = true;
            
            // Trigger silent refresh if needed (after a slight delay to ensure init)
            setTimeout(() => {
                if(isSilentMode) {
                    tokenClient.requestAccessToken({prompt: 'none'});
                }
            }, 500);
        }
    }
    
    setTimeout(maybeInitGapi, 2000);
    
    async function handleTokenResponse(resp) {
        if (resp.error) {
            if(isSilentMode) {
                console.log("Silent refresh failed", resp);
                isSilentMode = false; // Reset
                return; // Just stay disconnected
            }
            throw (resp);
        }
        
        // SAVE TOKEN
        const now = Date.now();
        const tokenToStore = {
            ...resp,
            expires_at: now + (resp.expires_in * 1000)
        };
        localStorage.setItem('gcal_token', JSON.stringify(tokenToStore));
        
        // Update UI
        updateSyncUI(true);
        
        if(!isSilentMode) {
            // Only show alerts and sync if Manual Click
            Swal.fire({
                title: 'Sincronizando...',
                text: 'Por favor espera',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
            await syncCalendar();
            Swal.fire('¡Sincronizado!', 'Tus tareas y calendario están al día.', 'success');
        }
        
        isSilentMode = false; // Reset flag
    }
    
    function updateSyncUI(connected) {
        if(!syncBtn) return;
        if(connected) {
            syncBtn.classList.remove('btn-soft-danger');
            syncBtn.classList.add('btn-soft-success');
            syncBtn.innerHTML = '<i class="mdi mdi-check"></i> Conectado';
        } else {
            syncBtn.classList.remove('btn-soft-success');
            syncBtn.classList.add('btn-soft-danger');
            syncBtn.innerHTML = '<i class="mdi mdi-google"></i> Sync';
        }
    }

    function handleSyncClick() {
        isSilentMode = false; // Ensure manual mode
        
        if (!gapiInited || !gisInited) {
            maybeInitGapi();
            // Allow retry or fail if config missing
            if(CLIENT_ID === 'YOUR_MOCK_CLIENT_ID') {
                 Swal.fire('Configuración Requerida', 'Debes configurar tu CLIENT_ID y API_KEY en apps-tareas.js', 'warning');
                 return;
            }
        }

        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    }

    async function syncCalendar() {
        try {
            if(!tasks || tasks.length === 0) {
                 Swal.fire('Atención', 'No hay tareas cargadas para sincronizar aún. Espera unos segundos y prueba de nuevo.', 'warning');
                 return;
            }

            // 1. IMPORT: GCal -> System
            // ... (Import logic is fine, keeping concise for this replacement if possibly unchanged, but better to include full block to avoid breaking)
            // Re-implementing simplified Import block to ensure context
            const minDate = new Date();
            minDate.setDate(minDate.getDate() - 30);
            
            const response = await gapi.client.calendar.events.list({
                'calendarId': 'primary',
                'timeMin': minDate.toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'orderBy': 'startTime'
            });
            
            const events = response.result.items;
            let importedCount = 0;
            
            for (const event of events) {
                const existing = tasks.find(t => t.googleId === event.id);
                if (existing) {
                    if(existing.source === 'google') {
                         db.collection('tasks').doc(existing.id).update({
                             title: event.summary,
                             dueDate: event.start.dateTime ? event.start.dateTime.split('T')[0] : (event.start.date || ''),
                             dueTime: event.start.dateTime ? event.start.dateTime.split('T')[1].substring(0,5) : '',
                             description: event.description || ''
                         });
                    }
                } else {
                    const taskData = {
                        title: event.summary,
                        description: event.description || '',
                        status: 'TODO',
                        priority: 'MEDIUM',
                        source: 'google', 
                        category: 'General',
                        assignedTo: 'Google Calendar',
                        googleId: event.id,
                        createdAt: new Date(),
                        dueDate: event.start.dateTime ? event.start.dateTime.split('T')[0] : (event.start.date || ''),
                        dueTime: event.start.dateTime ? event.start.dateTime.split('T')[1].substring(0,5) : ''
                    };
                    await db.collection('tasks').add(taskData);
                    importedCount++;
                }
            }

            // 2. EXPORT: System -> GCal
            let exportedCount = 0;
            let errorCount = 0;
            let lastError = '';

            for (const t of tasks) {
                // Skip logic
                if (t.source === 'google') continue;
                if (!t.dueDate) continue;
                
                // Show Progress
                Swal.update({
                    title: 'Sincronizando...',
                    text: `Procesando: ${t.title}`
                });

                const summary = `${t.title} (${t.assignedTo || 'Unassigned'})`;
                
                let start = {};
                let end = {};

                if (t.dueTime) {
                    // Create Date object from local string (Browser handles local timezone)
                    const localStart = new Date(`${t.dueDate}T${t.dueTime}`);
                    const localEnd = new Date(localStart.getTime() + 60 * 60 * 1000); // Add 1 Hour

                    // Send as ISO UTC string
                    start = { 'dateTime': localStart.toISOString() };
                    end = { 'dateTime': localEnd.toISOString() }; 
                } else {
                    // All Day
                    start = { 'date': t.dueDate };
                    // End date must be +1 day for all-day events (exclusive)
                    const d = new Date(t.dueDate);
                    d.setDate(d.getDate() + 1);
                    const nextDay = d.toISOString().split('T')[0];
                    end = { 'date': nextDay };
                }
                
                // FIX: Ensure no timezone mismatch issues by explicitly setting timeZone if needed, 
                // but usually implied is fine. Ensuring fields are clean strings.

                const eventResource = {
                    'summary': summary,
                    'description': t.description || '',
                    'start': start,
                    'end': end
                };

                try {
                    if (t.googleId) {
                        await gapi.client.calendar.events.update({
                            'calendarId': 'primary',
                            'eventId': t.googleId,
                            'resource': eventResource
                        });
                        exportedCount++;
                    } else {
                        const res = await gapi.client.calendar.events.insert({
                            'calendarId': 'primary',
                            'resource': eventResource
                        });
                        if(res.result.id) {
                            await db.collection('tasks').doc(t.id).update({ googleId: res.result.id });
                            exportedCount++;
                        }
                    }
                } catch(e) {
                    console.error("GCal Sync Error for task:", t.title, e);
                    // Handle 404 specially
                    if(e.status === 404 || e.code === 404) {
                         // ID invalid, reset it and try insert next time? 
                         // Or try insert NOW? Let's just reset for next run to match logic
                         await db.collection('tasks').doc(t.id).update({ googleId: firebase.firestore.FieldValue.delete() });
                    } else {
                        errorCount++;
                        lastError = e.result ? e.result.error.message : e.message || JSON.stringify(e);
                    }
                }
            }
            
            let msg = `Importadas: ${importedCount}, Exportadas: ${exportedCount}`;
            if(errorCount > 0) msg += `. Errores: ${errorCount} (${lastError})`;
            
            Swal.fire('Sincronización Completada', msg, errorCount > 0 ? 'warning' : 'success');

        } catch (err) {
            console.error("Sync Error", err);
            Swal.fire('Error Crítico', 'Hubo un problema: ' + (err.message || JSON.stringify(err)), 'error');
        }
    }

    // ==========================================
    // 9. Auto-Complete Logic (Google Tasks)
    // ==========================================
    
    function checkAutoCompletion() {
        const now = new Date();
        let changed = false;

        tasks.forEach(t => {
            if (t.source === 'google' && t.status !== 'COMPLETED') {
                if (t.dueDate) {
                    const dueStr = t.dueDate + (t.dueTime ? 'T' + t.dueTime : 'T23:59:59');
                    const due = new Date(dueStr);
                    
                    if (due < now) {
                        updateTaskStatus(t.id, 'COMPLETED');
                        changed = true;
                    }
                }
            }
        });
        
        if(changed) {
             const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'info',
                title: 'Tareas de Google actualizadas automáticamente'
            });
        }
    }

    // ==========================================
    // 10. Generation Stats Logic
    // ==========================================
    
    function renderGenerationStats() {
        const weekEl = document.getElementById('stat-gen-week');
        const monthEl = document.getElementById('stat-gen-month');
        const trendEl = document.getElementById('stat-gen-trend');
        
        if (!weekEl || !monthEl || !trendEl) return;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)
        
        // Start of Week (Monday)
        const startOfWeek = new Date(now);
        const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1); // Adjust when day is Sunday
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0,0,0,0);

        // Start of Month
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        
        // Start of Previous Month
        const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1);
        const endOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        let countWeek = 0;
        let countMonth = 0;
        let countPrevMonth = 0;

        tasks.forEach(t => {
            if(!t.createdAt) return; // Ignore old tasks without timestamp
            
            let d;
            if(t.createdAt.seconds) d = new Date(t.createdAt.seconds * 1000);
            else d = new Date(t.createdAt); // Strings/Date obj

            // Week Check
            if (d >= startOfWeek) countWeek++;

            // Month Check
            if (d >= startOfMonth) countMonth++;

            // Prev Month Check
            if (d >= startOfPrevMonth && d <= endOfPrevMonth) countPrevMonth++;
        });

        // Debug
        // console.log(`Week: ${countWeek}, Month: ${countMonth}, Prev: ${countPrevMonth}`);

        // Update UI
        weekEl.textContent = countWeek;
        monthEl.textContent = countMonth;

        // Trend
        let trend = 0;
        if(countPrevMonth > 0) {
            trend = ((countMonth - countPrevMonth) / countPrevMonth) * 100;
        } else if (countMonth > 0) {
            trend = 100; // Infinite growth
        }
        
        const trendFormatted = Math.round(trend);
        if (trend > 0) {
            trendEl.innerHTML = `<span class="text-success"><i class="mdi mdi-arrow-up"></i> ${trendFormatted}%</span>`;
        } else if (trend < 0) {
            trendEl.innerHTML = `<span class="text-danger"><i class="mdi mdi-arrow-down"></i> ${trendFormatted}%</span>`;
        } else {
            trendEl.innerHTML = `<span class="text-muted"><i class="mdi mdi-minus"></i> 0%</span>`;
        }
    }

    // Check periodically (every 5 minutes)
    setInterval(checkAutoCompletion, 300000); // 5 mins in ms

});
