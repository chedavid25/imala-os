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
    let drake = null; 

    const db = window.Imala.db;
    const auth = window.Imala.auth;
    
    const taskModal = new bootstrap.Modal(document.getElementById('event-modal'));
    const catsModal = new bootstrap.Modal(document.getElementById('categories-modal'));
    const form = document.getElementById('form-event');

    const containerTodo = document.getElementById('kanban-todo');
    const containerLate = document.getElementById('kanban-late');
    const containerCompleted = document.getElementById('kanban-completed');
    const filterButtons = document.querySelectorAll('.filter-bar button');
    
    const topSearchInput = document.getElementById('top-search-input');
    const monthFilterInput = document.getElementById('filter-month-history');

    // ==========================================
    // 2. Load Data & Filters
    // ==========================================
    
    auth.onAuthStateChanged(user => {
        if (user) {
            loadCategories();
            loadTeamMembers(); // Fetch Users
            loadTasks(user.uid);
        } else {
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
            renderAllViews();
        }, error => {
            console.error("Error loading tasks:", error);
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
        });
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
        
        // Ensure touch-action via JS as well just in case
        div.style.touchAction = 'none';

        let assignedAvatar = '';
        if(task.assignedTo === 'Ambos') {
             assignedAvatar = '<div class="avatar-group-item"><span class="avatar-title rounded-circle bg-primary text-white font-size-10">D</span></div><div class="avatar-group-item"><span class="avatar-title rounded-circle bg-pink text-white font-size-10">L</span></div>';
             assignedAvatar = `<div class="avatar-group-item"><span class="avatar-title rounded-circle ${color} text-white font-size-10">${letter}</span></div>`;
        }

        // Try to find real user avatar if name matches
        const realUser = teamMembers.find(m => m.name === task.assignedTo);
        if (realUser) {
             const uLetter = realUser.name.charAt(0);
             // Random-ish color based on name length
             const colors = ['bg-primary', 'bg-success', 'bg-warning', 'bg-info', 'bg-danger'];
             const uColor = colors[realUser.name.length % colors.length];
             assignedAvatar = `<div class="avatar-group-item" title="${realUser.name}">
                                <span class="avatar-title rounded-circle ${uColor} text-white font-size-10">${uLetter}</span>
                               </div>`;
        }
        
        let timeDisplay = '';
        if (task.dueTime) timeDisplay = `<span class="ms-2"><i class="mdi mdi-clock-outline"></i> ${task.dueTime}</span>`;

        div.innerHTML = `
            <div class="card-body p-3">
                <div class="d-flex justify-content-between mb-2">
                    <span class="badge ${task.category === 'Ventas' ? 'bg-success' : 'bg-secondary'} font-size-10">${task.category || 'General'}</span>
                    <small class="text-muted fw-bold">${getPriorityLabel(task.priority)}</small>
                </div>
                <h5 class="font-size-15 mb-1 text-truncate">${task.title}</h5>
                <p class="text-muted mb-2 font-size-12 text-truncate">${task.description || ''}</p>
                <div class="d-flex justify-content-between align-items-center">
                    <p class="text-muted mb-0 font-size-12"><i class="mdi mdi-calendar"></i> ${formatDate(task.dueDate)} ${timeDisplay}</p>
                    <div class="avatar-group">${assignedAvatar}</div>
                </div>
            </div>
        `;
        
        div.addEventListener('click', (e) => {
             openEditModal(task.id);
        });
        return div;
    }

    // ==========================================
    // 4. List View (Localized)
    // ==========================================

    function renderList(filteredTasks) {
        if (dataTable) dataTable.destroy();

        const tbody = document.querySelector('#datatable-tasks tbody');
        tbody.innerHTML = '';

        filteredTasks.forEach(t => {
            const tr = document.createElement('tr');
            
            let actionBtn = '';
            if (t.status !== 'COMPLETED') {
                actionBtn = `<button class="btn btn-sm btn-success complete-btn me-1" data-id="${t.id}">Listo!</button>`;
            } else {
                actionBtn = `<span class="badge badge-soft-success me-2"><i class="mdi mdi-check"></i></span>`;
            }

            tr.innerHTML = `
                <td>
                    <div class="fw-bold">${t.title}</div>
                    <small class="text-muted">${t.description ? t.description.substring(0,30) + '...' : ''}</small>
                </td>
                <td>
                    ${formatDate(t.dueDate)} ${t.dueTime || ''}
                </td>
                <td><span class="badge ${getPriorityBadge(t.priority)}">${getPriorityLabel(t.priority)}</span></td>
                <td><span class="badge ${getStatusBadge(t.status)}">${getStatusLabel(t.status)}</span></td>
                <td>${t.assignedTo || 'David'}</td>
                <td>
                    ${actionBtn}
                    <button class="btn btn-sm btn-soft-primary edit-btn" data-id="${t.id}"><i class="mdi mdi-pencil"></i></button>
                    <button class="btn btn-sm btn-soft-danger delete-btn" data-id="${t.id}"><i class="mdi mdi-trash-can"></i></button>
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

            if (t.status === 'LATE') {
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
        const todayStr = now.toISOString().split('T')[0];
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

        if (taskId) {
            const task = tasks.find(t => t.id === taskId);
            document.getElementById('task-id').value = taskId;
            document.getElementById('event-title').value = task.title;
            document.getElementById('event-description').value = task.description || '';
            document.getElementById('event-category').value = task.category || 'General';
            document.getElementById('event-status').value = task.status || 'TODO';
            document.getElementById('event-priority').value = task.priority || 'MEDIUM';
            document.getElementById('event-assignedTo').value = task.assignedTo || 'David';
            document.getElementById('event-recurrence').value = task.recurrence || 'NONE';
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
            updatedAt: new Date()
        };

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
    document.getElementById('btn-edit-cats-modal').addEventListener('click', () => catsModal.show());
    document.getElementById('btn-manage-categories').addEventListener('click', () => catsModal.show());

    document.getElementById('btn-add-cat').addEventListener('click', () => {
        const val = document.getElementById('new-cat-name').value;
        if(val) {
            const newList = [...categories, val];
            db.collection('tasks').doc('settings_categories').set({ list: newList }).then(() => {
                document.getElementById('new-cat-name').value = '';
            });
        }
    });

    function renderCategoriesList() {
        const list = document.getElementById('categories-list');
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

    document.getElementById('btn-new-task-main').addEventListener('click', () => openEditModal());
    document.getElementById('btn-new-task-kanban').addEventListener('click', () => openEditModal());
    document.getElementById('btn-new-task-list').addEventListener('click', () => openEditModal());
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
    function getTodayStr() { return new Date().toISOString().split('T')[0]; }
    
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

});
