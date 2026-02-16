// Dashboard Logic

// Privacy Mode Toggle (Global function for onclick)
window.togglePrivacy = function() {
    const elements = document.querySelectorAll('.privacy-blur');
    const icon = document.getElementById('privacy-icon');
    
    // Check if currently blurred
    const isBlurred = elements[0]?.style.filter === 'blur(8px)' || !elements[0]?.style.filter;
    
    elements.forEach(el => {
        if (isBlurred) {
            el.style.filter = 'none';
        } else {
            el.style.filter = 'blur(8px)';
        }
    });
    
    // Toggle icon
    if (icon) {
        if (isBlurred) {
            icon.className = 'mdi mdi-eye-off';
        } else {
            icon.className = 'mdi mdi-eye';
        }
    }
    
    // Save preference
    localStorage.setItem('privacyMode', isBlurred ? 'off' : 'on');
};

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
                     const name = userData.displayName || 'Usuario';
                     if(userNameEl) userNameEl.textContent = name;
                     if(userRoleEl) userRoleEl.textContent = userData.role || 'Rol';
                     
                     // Mobile Name
                     const mobNameEl = document.querySelector('.mob-user-name');
                     if(mobNameEl) mobNameEl.textContent = name;
                }

                // Initial UI updates
                updateMobileDate();

                // Load Tasks with context
                loadDashboardTasks(user.uid, userData);
                
                // Load Clients Count
                loadDashboardClients();

                // Load Financial Data for Mobile
                loadDashboardFinancials();

            }).catch(err => {
                console.error("Error loading user profile:", err);
            });
        }
    });

    function updateMobileDate() {
        const now = new Date();
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const mobMonth = document.getElementById('mob-month-name');
        const mobDay = document.getElementById('mob-day-number');
        if(mobMonth) mobMonth.textContent = months[now.getMonth()];
        if(mobDay) mobDay.textContent = now.getDate();
    }

    // Modals
    const newTaskModal = new bootstrap.Modal(document.getElementById('new-task-modal'));

    window.openNewTaskModal = function() {
        const form = document.getElementById('task-form');
        if(form) form.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-modal-title').textContent = 'Nueva Tarea';
        document.getElementById('task-save-text').textContent = 'Crear Tarea';
        
        // Reset collapse
        const moreFields = document.getElementById('task-more-fields');
        if(moreFields) moreFields.classList.remove('show');
        const toggleBtn = document.getElementById('btn-toggle-task-fields');
        if(toggleBtn) toggleBtn.textContent = 'Ver más campos...';

        newTaskModal.show();
    };

    window.toggleTaskMoreFields = function() {
        const moreFields = document.getElementById('task-more-fields');
        const btn = document.getElementById('btn-toggle-task-fields');
        if(moreFields) {
            const isShown = moreFields.classList.contains('show');
            if(isShown) {
                moreFields.classList.remove('show');
                btn.textContent = 'Ver más campos...';
            } else {
                moreFields.classList.add('show');
                btn.textContent = 'Ver menos campos';
            }
        }
    };

    function loadDashboardClients() {
        // Simple count of active clients
        db.collection('clients').where('type', '==', 'CLIENT').get().then(snap => {
            const count = snap.size;
            const el = document.getElementById('kpi-clients-count');
            if(el) el.textContent = count;
            // Mobile KPI
            const mobEl = document.getElementById('mob-kpi-clients');
            if(mobEl) mobEl.textContent = count;
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

        // Mobile KPIs
        const mobTasksEl = document.getElementById('mob-kpi-tasks');
        const mobLateEl = document.getElementById('mob-kpi-late');
        if(mobTasksEl) mobTasksEl.textContent = pending;
        if(mobLateEl) {
            mobLateEl.textContent = `${late} Atrasadas`;
            mobLateEl.style.display = late > 0 ? 'inline-block' : 'none';
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

        // Render Mobile Activity
        renderMobileActivity(items);
    }

    function renderMobileActivity(items) {
        const mobList = document.getElementById('mob-recent-activity');
        if(!mobList) return;

        if(items.length === 0) {
            mobList.innerHTML = '<div class="text-center p-4 text-muted">No hay actividad reciente</div>';
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        items.slice(0, 5).forEach(i => {
            html += `
                <div class="list-group-item border-0 px-0 py-3">
                    <div class="d-flex align-items-center">
                        <div class="avatar-xs me-3">
                            <span class="avatar-title rounded-circle bg-${i.color} bg-opacity-10 text-${i.color}">
                                <i class="bx ${i.icon} font-size-16"></i>
                            </span>
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                            <h6 class="mb-1 font-size-14 text-truncate">${i.title}</h6>
                            <p class="mb-0 text-muted font-size-12 text-truncate">${i.text}</p>
                        </div>
                        <div class="text-end ms-2">
                            <span class="text-muted font-size-11">${i.time}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        mobList.innerHTML = html;
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

        const tForm = document.getElementById('task-form');
        if(tForm) {
            tForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const prio = document.querySelector('input[name="priority"]:checked')?.value || 'LOW';

                const taskData = {
                    title: document.getElementById('task-title').value,
                    dueDate: document.getElementById('task-due-date').value,
                    dueTime: document.getElementById('task-due-time').value,
                    priority: prio,
                    assignedTo: document.getElementById('task-assigned-to').value,
                    description: document.getElementById('task-desc').value,
                    status: 'PENDIENTE',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdBy: auth.currentUser ? auth.currentUser.uid : null,
                    source: 'manual'
                };

                db.collection('tasks').add(taskData).then(() => {
                    newTaskModal.hide();
                    Swal.fire({ icon: 'success', title: 'Tarea Creada', timer: 1500, toast: true, position: 'top-end' });
                }).catch(err => {
                    console.error(err);
                    Swal.fire('Error', 'No se pudo crear la tarea', 'error');
                });
            });
        }
    }

    function loadDashboardFinancials() {
        // Fetch accounts for Liquidez and USD Total
        db.collection('accounts').onSnapshot(snap => {
            let totalARS = 0;
            let totalUSD = 0;
            snap.forEach(doc => {
                const acc = doc.data();
                if(acc.currency === 'ARS') totalARS += acc.balance || 0;
                if(acc.currency === 'USD') totalUSD += acc.balance || 0;
            });
            
            const mobLiq = document.getElementById('mob-total-liquidity');
            const mobInv = document.getElementById('mob-total-invested');
            if(mobLiq) mobLiq.textContent = totalARS.toLocaleString('es-AR', {minimumFractionDigits: 2});
            if(mobInv) mobInv.textContent = totalUSD.toLocaleString('es-AR', {minimumFractionDigits: 2});

            // Patrimonio Total
            const mobBal = document.getElementById('mob-total-balance');
            if(mobBal) mobBal.textContent = (totalARS).toLocaleString('es-AR', {minimumFractionDigits: 2});
        });

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        db.collection('transactions').onSnapshot(snap => {
            let income = 0;
            let expense = 0;
            const recent = [];

            snap.forEach(doc => {
                const t = {id: doc.id, ...doc.data()};
                const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                
                if(date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                    if(t.type === 'INCOME') income += t.amount || 0;
                    if(t.type === 'EXPENSE') expense += t.amount || 0;
                }
                recent.push(t);
            });

            const mobInc = document.getElementById('mob-total-income');
            const mobExp = document.getElementById('mob-total-expense');
            if(mobInc) mobInc.textContent = income.toLocaleString('es-AR', {minimumFractionDigits: 2});
            if(mobExp) mobExp.textContent = expense.toLocaleString('es-AR', {minimumFractionDigits: 2});
            
            renderRecentMovements(recent.sort((a,b) => (b.date?.toDate ? b.date.toDate() : new Date(b.date)) - (a.date?.toDate ? a.date.toDate() : new Date(a.date))));
        });
    }

    function renderRecentMovements(allMovements) {
        const container = document.getElementById('mob-recent-activity');
        if(!container) return;
        container.innerHTML = '';

        const filterMovements = allMovements.slice(0, 10);
        if(filterMovements.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted small">No hay transacciones recientes</div>';
            return;
        }

        filterMovements.forEach(m => {
            const date = m.date?.toDate ? m.date.toDate() : new Date(m.date);
            const isIncome = m.type === 'INCOME';
            const icon = isIncome ? 'bx-trending-up' : 'bx-trending-down';
            const color = isIncome ? 'success' : 'danger';
            const sign = isIncome ? '+' : '-';

            const html = `
                <div class="d-flex align-items-center mb-3 p-3 bg-white" style="border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <div class="avatar-sm me-3">
                        <span class="avatar-title rounded-circle bg-soft-${color} text-${color}">
                            <i class="bx ${icon} font-size-18"></i>
                        </span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1 fw-bold font-size-14">${m.item || 'Transacción'}</h6>
                        <p class="text-muted small mb-0">${date.toLocaleDateString()} • ${m.accountName || 'Cuenta'}</p>
                    </div>
                    <div class="text-end">
                        <h6 class="mb-0 fw-bold text-${color}">${sign}$${(m.amount || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</h6>
                        <span class="badge ${isIncome ? 'bg-soft-success text-success' : 'bg-soft-danger text-danger'} rounded-pill font-size-10 text-uppercase">${isIncome ? 'Ingreso' : 'Egreso'}</span>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }

    // ==========================================
    // MOBILE DASHBOARD PREMIUM FUNCTIONS
    // ==========================================

    // Load Mobile Dashboard Data
    function loadMobileDashboard() {
        const userNameEl = document.getElementById('mob-user-name');
        
        auth.onAuthStateChanged(user => {
            if (user) {
                // Set user name
                db.collection('users').doc(user.uid).get().then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        const name = userData.displayName || 'Usuario';
                        const firstName = name.split(' ')[0];
                        if (userNameEl) userNameEl.textContent = firstName;
                        
                        // Set avatar
                        const avatarEl = document.getElementById('mob-user-avatar');
                        if (avatarEl && userData.photoURL) {
                            avatarEl.src = userData.photoURL;
                        }
                    }
                });

                // Load liquidity and monthly stats
                loadMobileLiquidity();
                
                // Load urgent tasks
                loadUrgentTasks();
                
                // Load recent transactions
                loadMobileTransactions();
            }
        });
    }

    // Load Liquidity Total and Monthly Income/Expense
    function loadMobileLiquidity() {
        // Get all cashflow accounts
        db.collection('accounts').onSnapshot(snap => {
            let total = 0;
            snap.forEach(doc => {
                const acc = doc.data();
                if (acc.currency === 'ARS') {
                    total += acc.balance || 0;
                }
            });
            
            const balanceEl = document.getElementById('mob-home-balance');
            if (balanceEl) {
                balanceEl.textContent = `$ ${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
            }
        });

        // Get monthly income/expense
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        db.collection('transactions').onSnapshot(snap => {
            let income = 0;
            let expense = 0;

            snap.forEach(doc => {
                const t = doc.data();
                const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                
                if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                    if (t.type === 'INCOME') income += t.amount || 0;
                    if (t.type === 'EXPENSE') expense += t.amount || 0;
                }
            });

            const incomeEl = document.getElementById('mob-month-inc');
            const expenseEl = document.getElementById('mob-month-exp');
            
            if (incomeEl) {
                incomeEl.textContent = `+$ ${(income / 1000).toFixed(0)}k`;
            }
            if (expenseEl) {
                expenseEl.textContent = `-$ ${(expense / 1000).toFixed(0)}k`;
            }
        });
    }

    // Load Urgent Tasks (LATE + TODAY)
    function loadUrgentTasks() {
        db.collection('tasks').onSnapshot(snap => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];
            
            const lateTasks = [];
            const todayTasks = [];

            snap.forEach(doc => {
                if (doc.id === 'settings_categories') return;
                
                const t = { id: doc.id, ...doc.data() };
                
                // Skip completed tasks
                if (t.status === 'COMPLETED') return;
                
                // Check if LATE
                if (t.status === 'LATE' || (t.dueDate && t.dueDate < todayStr)) {
                    lateTasks.push(t);
                } else if (t.dueDate === todayStr) {
                    // Check if TODAY
                    todayTasks.push(t);
                }
            });

            // Combine: LATE first, then TODAY
            const urgentTasks = [...lateTasks, ...todayTasks].slice(0, 5);
            
            renderUrgentTasks(urgentTasks);
        });
    }

    // Render Urgent Tasks
    function renderUrgentTasks(tasks) {
        const container = document.getElementById('mob-urgent-tasks-list');
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="bx bx-check-circle font-size-24 d-block mb-2 opacity-50"></i>
                    <span class="font-size-12">Sin tareas urgentes</span>
                </div>
            `;
            return;
        }

        let html = '';
        tasks.forEach(t => {
            const isLate = t.status === 'LATE';
            const borderColor = isLate ? 'danger' : 'warning';
            const icon = isLate ? 'bx-error-circle' : 'bx-time';
            const iconColor = isLate ? 'danger' : 'warning';
            const timeDisplay = t.dueTime ? ` • ${t.dueTime}` : '';
            
            html += `
                <div class="list-group-item border-0 border-start border-4 border-${borderColor} py-3">
                    <div class="d-flex align-items-start">
                        <div class="avatar-xs me-3 mt-1">
                            <span class="avatar-title rounded-circle bg-soft-${iconColor} text-${iconColor} font-size-16">
                                <i class="bx ${icon}"></i>
                            </span>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="font-size-13 mb-1 text-dark">${t.title}</h6>
                            <p class="mb-0 text-muted font-size-11">
                                <i class="bx bx-calendar me-1"></i>${t.dueDate || 'Sin fecha'}${timeDisplay}
                                ${t.assignedTo ? `<span class="ms-2"><i class="bx bx-user me-1"></i>${t.assignedTo}</span>` : ''}
                            </p>
                        </div>
                        <div class="text-end ms-2">
                            <span class="badge bg-${borderColor}-subtle text-${borderColor} font-size-10">
                                ${isLate ? 'ATRASADA' : 'HOY'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Load Recent Transactions (3 most recent)
    function loadMobileTransactions() {
        db.collection('transactions').onSnapshot(snap => {
            const transactions = [];
            
            snap.forEach(doc => {
                const t = { id: doc.id, ...doc.data() };
                transactions.push(t);
            });

            // Sort by date descending
            transactions.sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return dateB - dateA;
            });

            // Take top 3
            const recent = transactions.slice(0, 3);
            
            renderRecentMobileTransactions(recent);
        });
    }

    // Render Recent Transactions
    function renderRecentMobileTransactions(transactions) {
        const container = document.getElementById('mob-recent-transactions');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="bx bx-receipt font-size-24 d-block mb-2 opacity-50"></i>
                    <span class="font-size-12">Sin movimientos recientes</span>
                </div>
            `;
            return;
        }

        let html = '';
        transactions.forEach(t => {
            const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
            const isIncome = t.type === 'INCOME';
            const icon = isIncome ? 'bx-trending-up' : 'bx-cart';
            const color = isIncome ? 'success' : 'danger';
            const sign = isIncome ? '+' : '-';
            
            // Format time
            const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            
            html += `
                <div class="list-group-item border-0 d-flex align-items-center py-3">
                    <div class="avatar-xs me-3">
                        <span class="avatar-title rounded-circle bg-soft-${color} text-${color} font-size-16">
                            <i class="bx ${icon}"></i>
                        </span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="font-size-13 mb-0 text-truncate">${t.item || 'Transacción'}</h6>
                        <small class="text-muted">${dateStr}, ${timeStr}</small>
                    </div>
                    <div class="text-end">
                        <h6 class="font-size-13 mb-0 text-${color}">${sign}$ ${(t.amount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</h6>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Initialize mobile dashboard (always load, CSS controls visibility)
    loadMobileDashboard();

});
