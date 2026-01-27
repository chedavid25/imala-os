// Dashboard Logic
document.addEventListener('DOMContentLoaded', function () {

    const auth = window.Imala.auth;
    const db = window.Imala.db;

    // UI Elements
    const userNameEl = document.getElementById('dashboard-user-name');
    const userRoleEl = document.getElementById('dashboard-user-role');
    const userAvatarEl = document.getElementById('dashboard-user-avatar');

    // 1. Auth Check & Data Load
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                const userData = doc.exists ? doc.data() : {};
                
                // Update header specific elements
                if(doc.exists) {
                     if(userNameEl) userNameEl.textContent = userData.displayName || 'Usuario';
                     if(userRoleEl) userRoleEl.textContent = userData.role || 'Rol';
                }

                // Load Tasks with context
                loadDashboardTasks(user.uid, userData);
                
                // Load Clients Count
                loadDashboardClients();

            }).catch(err => {
                console.error("Error loading user profile:", err);
            });
        }
    });

    function loadDashboardClients() {
        // Simple count of active clients
        db.collection('clients').where('type', '==', 'CLIENT').get().then(snap => {
            const count = snap.size;
            const el = document.getElementById('kpi-clients-count');
            if(el) el.textContent = count;
        }).catch(err => console.error("Error loading clients:", err));
    }

    let currentDashboardTasks = [];

    function loadDashboardTasks(uid, userData) {
        // Correct Collection: 'tasks' (as per apps-tareas.js)
        db.collection('tasks').onSnapshot(snap => {
            const myTasks = [];
            snap.forEach(doc => {
                // Ignore settings doc if present
                if(doc.id === 'settings_categories') return;

                const t = { id: doc.id, ...doc.data() };
                
                // Show ALL tasks to match apps-tareas.js behavior
                myTasks.push(t);
            });
            
            currentDashboardTasks = myTasks; // Update global for poller
            checkAutoCompletion(); // Check immediately on load/update

            renderDashboardStats(myTasks);
            renderDashboardList(myTasks);
            updateDashboardNotifications(myTasks);
        });
    }

    // ==========================================
    // Auto-Complete Logic (Google Tasks) - Dashboard
    // ==========================================
    
    function checkAutoCompletion() {
        const now = new Date();
        let changed = false;

        currentDashboardTasks.forEach(t => {
            if (t.source === 'google' && t.status !== 'COMPLETED') {
                if (t.dueDate) {
                    const dueStr = t.dueDate + (t.dueTime ? 'T' + t.dueTime : 'T23:59:59');
                    const due = new Date(dueStr);
                    
                    if (due < now) {
                        // DB Update function needs to be defined or accessed
                         db.collection('tasks').doc(t.id).update({ status: 'COMPLETED' });
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

    // Check periodically (every 5 minutes)
    setInterval(checkAutoCompletion, 300000); 



    function renderDashboardStats(tasks) {
        
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Helper to get task date string
        const getTaskDateStr = (t) => {
            if(t.dueDate && t.dueDate.seconds) {
                const td = new Date(t.dueDate.seconds * 1000);
                return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
            }
            if(t.dueDate && typeof t.dueDate === 'string') return t.dueDate.split('T')[0];
            return '9999-99-99';
        };

        // PENDING TODAY: Status not Completed AND Due Date is TODAY
        const pending = tasks.filter(t => {
            if (t.status === 'COMPLETED') return false;
            const tDate = getTaskDateStr(t);
            return tDate === todayStr;
        }).length;

        // HISTORICAL LATE: Status not Completed AND (Due Date < TODAY OR Status is 'LATE')
        const late = tasks.filter(t => {
             if (t.status === 'COMPLETED') return false;
             const tDate = getTaskDateStr(t);
             return tDate < todayStr || t.status === 'LATE';
        }).length;
        
        const completed = tasks.filter(t => t.status === 'COMPLETED').length;
        
        // Update New Cards
        const pendingEl = document.getElementById('kpi-tasks-pending');
        const lateBadgeEl = document.getElementById('kpi-tasks-late-badge');
        
        // Sidebar Stats (Legacy)
        if(document.getElementById('stat-pending')) document.getElementById('stat-pending').textContent = pending;
        if(document.getElementById('stat-late')) document.getElementById('stat-late').textContent = late;
        if(document.getElementById('stat-completed')) document.getElementById('stat-completed').textContent = completed;

        // New Card Elements
        if(pendingEl) pendingEl.textContent = pending;
        if(lateBadgeEl) {
             lateBadgeEl.textContent = `${late} Atrasadas`;
             lateBadgeEl.classList.remove('d-none'); // Always show
        }
    }

    function updateDashboardNotifications(tasks) {
        const widgetList = document.getElementById('dashboard-noti-list-widget');
        
        if(!widgetList) return;

        let items = [];
        
        // 1. Unread Messages
         tasks.forEach(t => {
            if(t.hasUserUnread || (t.userUnreadCount && t.userUnreadCount > 0)) {
                items.push({
                    type: 'message',
                    title: 'Mensaje Nuevo',
                    text: `En: ${t.title}`,
                    time: 'Reciente',
                    icon: 'bx-chat',
                    color: 'danger'
                });
            }
        });

        // 2. New Tasks (Last 24h)
        const ONE_DAY = 24 * 60 * 60 * 1000; 
        const now = Date.now();
        
        tasks.forEach(t => {
            if(t.status !== 'COMPLETED' && t.createdAt) {
                const created = t.createdAt.seconds ? t.createdAt.seconds * 1000 : null;
                if(created && (now - created) < ONE_DAY && !t.hasUserUnread) {
                    items.push({
                         type: 'task',
                         title: 'Nueva Tarea',
                         text: t.title,
                         time: 'Hoy',
                         icon: 'bx-task',
                         color: 'primary'
                    });
                }
            }
        });
        
        if(items.length === 0) {
             items.push({
                type: 'system',
                title: 'Sistema',
                text: 'Bienvenido a Imalá OS v2.0',
                time: 'Ahora',
                icon: 'bx-info-circle',
                color: 'info'
            });
        }

        let html = '';
        items.slice(0, 5).forEach(i => {
            html += `
                <li class="activity-list activity-border">
                    <div class="activity-icon avatar-md">
                        <span class="avatar-title bg-${i.color}-subtle text-${i.color} rounded-circle">
                            <i class="bx ${i.icon} font-size-20"></i>
                        </span>
                    </div>
                    <div class="timeline-list-item">
                        <div class="d-flex">
                            <div class="flex-grow-1 overflow-hidden me-4">
                                <h5 class="font-size-14 mb-1">${i.title}</h5>
                                <p class="text-truncate text-muted font-size-13">${i.text}</p>
                            </div>
                            <div class="flex-shrink-0 text-end">
                                <span class="font-size-11">${i.time}</span>
                            </div>
                        </div>
                    </div>
                </li>
            `;
        });
        widgetList.innerHTML = html;
    }

    function renderDashboardList(tasks) {
        const listEl = document.getElementById('dashboard-tasks-list');
        if(!listEl) return;
        listEl.innerHTML = '';

        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Helper
        const getTaskDateStr = (t) => {
            if(t.dueDate && t.dueDate.seconds) {
                const td = new Date(t.dueDate.seconds * 1000);
                return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
            }
             if(typeof t.dueDate === 'string') return t.dueDate.split('T')[0];
            return '9999-99-99';
        };

        const activeTasks = tasks.filter(t => {
            if (t.status === 'COMPLETED') return false;
            
            const tDate = getTaskDateStr(t);
            const isLate = t.status === 'LATE' || tDate < todayStr;
            const isToday = tDate === todayStr;

            // SHOW: All Late (Historical) OR Pending Today
            return isLate || isToday;
        });
        
        const sorter = (a, b) => { 
            // Helper to get ISO date string (YYYY-MM-DD) in LOCAL TIME
            const getDateStr = (t) => {
                if(t.dueDate && t.dueDate.seconds) {
                    const d = new Date(t.dueDate.seconds * 1000);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
                if(t.dueDate) return t.dueDate.split('T')[0];
                return '9999-99-99';
            };

            const dateA = getDateStr(a);
            const dateB = getDateStr(b);
            
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            
            // 1. Priority: LATE status
            // Note: Use simple comparison logic
            const isLateA = a.status === 'LATE' || dateA < todayStr;
            const isLateB = b.status === 'LATE' || dateB < todayStr;
            
            if (isLateA && !isLateB) return -1;
            if (!isLateA && isLateB) return 1;

            // 2. Priority: TODAY
            const isTodayA = dateA === todayStr;
            const isTodayB = dateB === todayStr;

            if (isTodayA && !isTodayB) return -1;
            if (!isTodayA && isTodayB) return 1;

            // 3. Sort by Date Ascending
            return dateA.localeCompare(dateB);
        };

        activeTasks.sort(sorter);

        if (activeTasks.length === 0) {
            listEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">¡Todo listo! No tienes tareas pendientes.</td></tr>';
        } else {
            // Show top 20 to ensure even if many late, today's show up
            activeTasks.slice(0, 20).forEach((t, index) => listEl.appendChild(createTaskRow(t, index + 1)));
        }
    }

    function createTaskRow(t, index) {
        // Date Logic
        let dueDisplay = '-';
        let isToday = false;
        
        // Re-calculate local today str matching sorter logic
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        let taskDateStr = '9999-99-99';
        
        if(t.dueDate) {
            if(t.dueDate.seconds) {
                 const td = new Date(t.dueDate.seconds * 1000);
                 dueDisplay = td.toLocaleDateString();
                 // Local YYYY-MM-DD manually
                 taskDateStr = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
            }
            else if (typeof t.dueDate === 'string') {
                const parts = t.dueDate.split('-');
                if(parts.length === 3) dueDisplay = `${parts[2]}/${parts[1]}`; // DD/MM
                else dueDisplay = t.dueDate;
                taskDateStr = t.dueDate.split('T')[0];
            }
        }
        
        if(taskDateStr === todayStr) isToday = true;

        // Status Logic
        let statusBadge = '<span class="badge bg-warning-subtle text-warning font-size-11">Pendiente</span>';
        if (t.status === 'LATE') statusBadge = '<span class="badge bg-danger-subtle text-danger font-size-11">Atrasada</span>';
        
        // Add HOY badge if applicable
        if(isToday && t.status !== 'LATE' && t.status !== 'COMPLETED') {
            statusBadge = '<span class="badge bg-info-subtle text-info font-size-11">HOY</span>';
        }

        // Assigned Avatar Logic
        let assignedHtml = '<span class="text-muted font-size-11">-</span>';
        if(t.assignedTo) {
             const name = t.assignedTo;
             const initial = name.charAt(0).toUpperCase();
             let colorClass = 'primary';
             if(name === 'Lucre') colorClass = 'pink';
             if(name === 'Ambos') colorClass = 'info';
             
             assignedHtml = `
                <div class="avatar-xs" title="${name}">
                    <span class="avatar-title rounded-circle bg-${colorClass} text-white font-size-12 d-flex align-items-center justify-content-center">
                        ${initial}
                    </span>
                </div>
             `;
        }

        // Action Button
        let actionBtn = '';
        if (t.status === 'LATE') {
             actionBtn = `<button class="btn btn-sm btn-outline-danger" onclick="completeTask('${t.id}')" title="Regularizar"><i class="bx bx-check"></i></button>`;
        } else {
             actionBtn = `<button class="btn btn-sm btn-outline-success" onclick="completeTask('${t.id}')" title="Completar"><i class="bx bx-check"></i></button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><h6 class="mb-0 font-size-13">${index}</h6></td>
            <td>
                <h6 class="text-truncate font-size-14 mb-1" style="max-width: 250px;">
                    <a href="apps-tareas.html" class="text-dark">${t.title}</a>
                </h6>
            </td>
            <td>${assignedHtml}</td>
            <td>
               <div class="font-size-13"><i class="bx bx-calendar me-1 text-muted"></i> ${dueDisplay}</div>
            </td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
        `;
        return tr;
    }

    // Global helper
    window.completeTask = function(id) {
        db.collection('tasks').doc(id).update({ status: 'COMPLETED' })
        .then(() => {
            Swal.fire({
                icon: 'success', 
                title: '¡Tarea Completada!',
                showConfirmButton: false,
                timer: 1500,
                toast: true,
                position: 'top-end'
            });
        });
    };

    // ==========================================
    // 4. New Task Modal Logic
    // ==========================================
    const newTaskModalEl = document.getElementById('event-modal');
    if (newTaskModalEl) {
        const newTaskModal = new bootstrap.Modal(newTaskModalEl);
        const taskForm = document.getElementById('form-event');
        let clientsList = [];
        let teamMembers = [];

        // Load Data for Selects
        function loadModalData() {
            // Load Clients
            db.collection('clients').where('type', '==', 'CLIENT').get().then(snap => {
                clientsList = [];
                snap.forEach(doc => {
                    clientsList.push({ id: doc.id, ...doc.data() });
                });
                updateClientSelect();
            });

            // Load Team (Users)
            db.collection('users').get().then(snapshot => {
                teamMembers = [];
                snapshot.forEach(doc => {
                    const d = doc.data();
                    teamMembers.push({ uid: doc.id, name: d.displayName || 'Usuario' });
                });
                updateAssignmentSelect();
            });
        }
        
        // Initial Link Logic: Bind "Nueva Tarea" buttons to open this modal
        // We find the button by href matching or class, but specifically the one in Quick Actions.
        // It currently links to apps-tareas.html. We should prevent default and open modal instead if on dashboard.
        const newButtons = document.querySelectorAll('a[href="apps-tareas.html"]');
        newButtons.forEach(btn => {
            // Only hijack the "Create New" buttons, usually distinguish by text or context
            // But user specifically asked for "Nueva Tarea" button in Quick Actions.
            if(btn.textContent.includes('Nueva Tarea')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openNewTaskModal();
                });
            }
        });

        window.openNewTaskModal = function() {
            loadModalData(); // Refresh data just in case
            taskForm.reset();
            document.getElementById('task-id').value = '';
            document.getElementById('event-dueDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('event-status').value = 'TODO';
            newTaskModal.show();
        };

        function updateClientSelect() {
            const sel = document.getElementById('event-client-id');
            if(!sel) return;
            sel.innerHTML = '<option value="">- Ninguno -</option>';
            clientsList.forEach(c => {
                 const opt = document.createElement('option');
                 opt.value = c.id;
                 opt.textContent = c.name;
                 sel.appendChild(opt);
            });
        }

        function updateAssignmentSelect() {
            const sel = document.getElementById('event-assignedTo');
            if(!sel) return;
            // Keep defaults
            sel.innerHTML = `
                <option value="David">David</option>
                <option value="Ambos">Ambos</option>
            `;
            teamMembers.forEach(m => {
                if(m.name !== 'David') {
                    const opt = document.createElement('option');
                    opt.value = m.name;
                    opt.textContent = m.name;
                    sel.appendChild(opt);
                }
            });
        }

        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const taskData = {
                title: document.getElementById('event-title').value,
                description: document.getElementById('event-description').value,
                category: document.getElementById('event-category').value,
                priority: document.getElementById('event-priority').value,
                status: 'TODO',
                assignedTo: document.getElementById('event-assignedTo').value,
                recurrence: document.getElementById('event-recurrence').value,
                dueDate: document.getElementById('event-dueDate').value,
                dueTime: document.getElementById('event-dueTime').value,
                clientId: document.getElementById('event-client-id').value || null,
                createdAt: new Date(),
                userAgent: 'Dashboard'
            };

            if(taskData.clientId) {
                const c = clientsList.find(x => x.id === taskData.clientId);
                if(c) taskData.clientName = c.name;
            }

            db.collection('tasks').add(taskData).then(() => {
                newTaskModal.hide();
                Swal.fire({
                    icon: 'success',
                    title: 'Tarea Creada',
                    showConfirmButton: false,
                    timer: 1500,
                    toast: true,
                    position: 'top-end'
                });
            }).catch(err => {
                console.error(err);
                Swal.fire('Error', 'No se pudo crear la tarea', 'error');
            });
        });
    }

});
