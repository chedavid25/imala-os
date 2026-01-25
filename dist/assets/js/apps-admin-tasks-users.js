document.addEventListener('DOMContentLoaded', function () {
    
    // ==========================================
    // 1. Initialization
    // ==========================================
    
    const db = window.Imala.db;
    const auth = window.Imala.auth;
    
    // Check Auth
    auth.onAuthStateChanged(user => {
        if (!user) window.location.href = 'auth-login.html';
        else {
             // In prod: Check if admin
             loadData();
             loadTasks();
        }
    });

    const taskModal = new bootstrap.Modal(document.getElementById('task-modal'));
    let users = [], offices = [], teams = [];
    let dataTable;

    // ==========================================
    // 2. Load Core Data (for selectors)
    // ==========================================

    function loadData() {
        // Users
        db.collection('users').get().then(snap => {
            users = [];
            snap.forEach(d => users.push({id: d.id, ...d.data()}));
            updateTargetSelect();
        });

        // Offices
        db.collection('offices').get().then(snap => {
            offices = [];
            snap.forEach(d => offices.push({id: d.id, ...d.data()}));
            populateFilterSelects(); // Update UI
        });

        // Teams
        db.collection('teams').get().then(snap => {
            teams = [];
            snap.forEach(d => teams.push({id: d.id, ...d.data()}));
            populateFilterSelects(); // Update UI
        });
    }

    // ==========================================
    // 3. UI Logic (Modal & Selectors)
    // ==========================================

    const btnNewTask = document.getElementById('btn-new-task');
    const formTask = document.getElementById('form-task');
    const radTypes = document.getElementsByName('assign-type');
    const targetSelect = document.getElementById('assign-target');



    radTypes.forEach(rad => {
        rad.addEventListener('change', updateTargetSelect);
    });

    function updateTargetSelect() {
        const type = document.querySelector('input[name="assign-type"]:checked').value;
        targetSelect.innerHTML = '';
        targetSelect.classList.remove('d-none');

        if(type === 'ALL') {
             targetSelect.classList.add('d-none'); // No ID needed
             return;
        }

        let data = [];
        if(type === 'USER') {
            data = users.map(u => ({ id: u.id, name: `${u.displayName} (${u.email})` }));
        } else if (type === 'OFFICE') {
            data = offices.map(o => ({ id: o.id, name: o.name }));
        } else if (type === 'TEAM') {
            data = teams.map(t => ({ id: t.id, name: t.name }));
        } else if (type === 'ROLE') {
            data = [
                { id: 'ADMIN', name: 'Administradores' },
                { id: 'BROKER', name: 'Brokers' },
                { id: 'TEAM_LEADER', name: 'Team Leaders' },
                { id: 'MEMBER', name: 'Miembros' },
                { id: 'ASSISTANT', name: 'Asistentes' }
            ];
        }

        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            targetSelect.appendChild(opt);
        });
    }

    // ==========================================
    // 4. Create Task Logic
    // ==========================================

    // ==========================================
    // 5. Create / Edit Task Logic
    // ==========================================

    const storage = window.Imala.storage; 

    // Global Edit State
    let currentEditTaskId = null;

    // Reset Modal on Open New
    btnNewTask.addEventListener('click', () => {
        formTask.reset();
        currentEditTaskId = null; // Reset edit mode
        document.getElementById('taskModalLabel').textContent = 'Crear Nueva Tarea';
        document.getElementById('btn-save-task').textContent = 'Asignar Tarea';
        document.getElementById('type-user').checked = true;
        updateTargetSelect();
        taskModal.show();
    });

    formTask.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Show loading state
        const btnSubmit = formTask.querySelector('button[type="submit"]');
        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="bx bx-loader bx-spin font-size-16 align-middle me-2"></i> Guardando...';

        try {
            const title = document.getElementById('task-title').value;
            const priority = document.getElementById('task-priority').value;
            const description = document.getElementById('task-desc').value;
            const dateVal = document.getElementById('task-date').value;
            const fileInput = document.getElementById('task-file');
            
            const assignType = document.querySelector('input[name="assign-type"]:checked').value;
            let assignId = null;
            if(assignType !== 'ALL') {
                assignId = document.getElementById('assign-target').value;
            }

            let fileUrl = null;
            let fileName = null;

            // 1. Upload File if selected (or keep existing if edit?)
            // If editing and no new file, we lose the old one unless logic handles it.
            // Simplified: Only upload if new file is picked.
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const storageRef = storage.ref();
                const fileRef = storageRef.child(`assigned_tasks/${Date.now()}_${file.name}`);
                
                await fileRef.put(file);
                fileUrl = await fileRef.getDownloadURL();
                fileName = file.name;
            }

            // 2. Prepare Data
            const taskData = {
                title,
                priority,
                description,
                assignedToType: assignType,
                assignedToId: assignId,
                dueDate: dateVal ? new Date(dateVal) : null,
                // Only update these if it's a new file, otherwise keep existing (handled by merge or check)
                // We'll handle merge below
            };
            
            if(fileUrl) {
                taskData.fileUrl = fileUrl;
                taskData.fileName = fileName;
            }
            
            // 3. Save (Create or Update)
            if (currentEditTaskId) {
                 // UPDATE
                 await db.collection('assigned_tasks').doc(currentEditTaskId).update(taskData);
                 Swal.fire({
                    title: '¡Actualizado!',
                    text: 'La tarea se ha actualizado correctamente.',
                    icon: 'success',
                    confirmButtonColor: '#556ee6'
                });
            } else {
                 // CREATE
                 taskData.status = 'PENDING';
                 taskData.createdAt = new Date();
                 taskData.createdBy = auth.currentUser.uid;
                 
                 await db.collection('assigned_tasks').add(taskData);
                 Swal.fire({
                    title: '¡Tarea Creada!',
                    text: 'La tarea se ha asignado correctamente.',
                    icon: 'success',
                    confirmButtonColor: '#556ee6'
                });
            }
            
            // Success cleanup
            taskModal.hide();
            formTask.reset();
            currentEditTaskId = null; // Reset

        } catch (err) {
            console.error(err);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un problema: ' + err.message,
                icon: 'error',
                confirmButtonColor: '#f46a6a'
            });
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnText;
        }
    });

    // ... (Filter & Load Logic) ...

    // ==========================================
    // 8. Edit Logic (Real Implementation)
    // ==========================================
    window.editTask = function(id) {
        const task = allTasks.find(t => t.id === id);
        if(!task) return;

        currentEditTaskId = id;
        
        // Populate Form
        document.getElementById('taskModalLabel').textContent = 'Editar Tarea';
        document.getElementById('btn-save-task').textContent = 'Guardar Cambios';
        
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-desc').value = task.description || '';
        
        if(task.dueDate) {
             let d = task.dueDate;
             if(d.seconds) d = new Date(d.seconds * 1000);
             else if (typeof d === 'string') d = new Date(d);
             
             // Format YYYY-MM-DD
             const year = d.getFullYear();
             const month = String(d.getMonth() + 1).padStart(2, '0');
             const day = String(d.getDate()).padStart(2, '0');
             document.getElementById('task-date').value = `${year}-${month}-${day}`;
        }
        
        // Set Radio
        const radios = document.getElementsByName('assign-type');
        radios.forEach(r => {
            if(r.value === task.assignedToType) r.checked = true;
        });
        
        updateTargetSelect();
        
        // Set Select (needs timeout or direct set after update)
        setTimeout(() => {
             if(task.assignedToId) document.getElementById('assign-target').value = task.assignedToId;
        }, 50);

        taskModal.show();
    };

    // ==========================================
    // 5. Load & Render Tasks
    // ==========================================

    // ==========================================
    // 5. Load & Filter Tasks
    // ==========================================

    let allTasks = []; // Store all fetched tasks
    
    // Init Filters
    const filterUserSearch = document.getElementById('filter-user-search');
    const filterTeam = document.getElementById('filter-team');
    const filterOffice = document.getElementById('filter-office');
    const filterMonth = document.getElementById('filter-month');
    const filterPriority = document.getElementById('filter-priority');
    const filterStatus = document.getElementById('filter-status');
    const btnClearFilters = document.getElementById('btn-clear-filters');

    // Set default month to current
    const dateNow = new Date();
    const monthStr = dateNow.toISOString().slice(0, 7); // YYYY-MM
    filterMonth.value = monthStr;

    // Listeners
    [filterTeam, filterOffice, filterMonth, filterPriority, filterStatus].forEach(el => el.addEventListener('change', applyFilters));
    filterUserSearch.addEventListener('input', applyFilters);
    
    btnClearFilters.addEventListener('click', () => {
        filterUserSearch.value = '';
        filterTeam.value = 'ALL';
        filterOffice.value = 'ALL';
        filterMonth.value = '';
        filterPriority.value = 'ALL';
        filterStatus.value = 'ALL';
        applyFilters();
    });

    // Populate Filter Selects when Data Loaded
    function populateFilterSelects() {
        // Teams
        let htmlTeams = '<option value="ALL">Todos los Equipos</option>';
        teams.forEach(t => htmlTeams += `<option value="${t.id}">${t.name}</option>`);
        filterTeam.innerHTML = htmlTeams;

        // Offices
        let htmlOffices = '<option value="ALL">Todas las Oficinas</option>';
        offices.forEach(o => htmlOffices += `<option value="${o.id}">${o.name}</option>`);
        filterOffice.innerHTML = htmlOffices;
    }

    function loadTasks() {
        // Real-time listener for assigned tasks
        db.collection('assigned_tasks').orderBy('createdAt', 'desc').onSnapshot(snap => {
            allTasks = [];
            snap.forEach(d => allTasks.push({id: d.id, ...d.data()}));
            
            // Check for overdue tasks
            checkLateTasks(allTasks);
            
            // Notifications (Counter)
            updateNotifications(allTasks);
            
            // Populate filters if not done (checking specific length or flag, or just run safe idempotent)
            if(filterTeam.options.length <= 1 && teams.length > 0) populateFilterSelects();
            
            applyFilters();
        });
    }

    function checkLateTasks(tasks) {
        const todayStr = new Date().toISOString().split('T')[0];
        
        tasks.forEach(t => {
            // Guard clause if no date
            if(!t.dueDate) return;

            let dueStr = '';
            // Convert Firestore Timestamp to YYYY-MM-DD
            if(t.dueDate.seconds) {
                dueStr = new Date(t.dueDate.seconds * 1000).toISOString().split('T')[0];
            } else if (typeof t.dueDate === 'string') {
                dueStr = t.dueDate; // Legacy or string format
            } else if (t.dueDate instanceof Date) {
               dueStr = t.dueDate.toISOString().split('T')[0];
            }

            if(t.status === 'PENDING' && dueStr && dueStr < todayStr) {
                console.log(`Marcando tarea ${t.id} como Atrasada`);
                db.collection('assigned_tasks').doc(t.id).update({ status: 'LATE' });
            }
        });
    }

    function applyFilters() {
        let filtered = [...allTasks];
        
        const searchVal = filterUserSearch.value.toLowerCase();
        const teamVal = filterTeam.value;
        const officeVal = filterOffice.value;
        const mVal = filterMonth.value;
        const pVal = filterPriority.value;
        const sVal = filterStatus.value;

        // Filter by Month
        if(mVal) {
             filtered = filtered.filter(t => {
                 let dateStr = '';
                 
                 // Prioritize DueDate
                 if(t.dueDate) {
                     if(t.dueDate.seconds) dateStr = new Date(t.dueDate.seconds * 1000).toISOString();
                     else if(t.dueDate instanceof Date) dateStr = t.dueDate.toISOString();
                     else dateStr = t.dueDate; // assume string
                 } 
                 // Fallback to CreatedAt
                 else if(t.createdAt) {
                    if(t.createdAt.seconds) dateStr = new Date(t.createdAt.seconds * 1000).toISOString();
                 }

                 if(!dateStr) return false;
                 return dateStr.startsWith(mVal);
             });
        }

        if(pVal !== 'ALL') {
             filtered = filtered.filter(t => t.priority === pVal);
        }

        if(sVal !== 'ALL') {
             filtered = filtered.filter(t => t.status === sVal);
        }

        renderTable(filtered);
    }

    function renderTable(taskList) {
        if(dataTable) {
            dataTable.clear();
            dataTable.destroy();
        }
        
        const tbody = document.querySelector('#datatable-tasks tbody');
        tbody.innerHTML = '';

        taskList.forEach(t => {
            // ... Badge Logic (Keep existing) ...
            let badge = 'badge bg-secondary';
            if(t.priority === 'HIGH') badge = 'badge bg-danger';
            if(t.priority === 'MEDIUM') badge = 'badge bg-warning text-dark';
            if(t.priority === 'LOW') badge = 'badge bg-success';

            let statusBadge = 'badge bg-secondary';
            let statusText = t.status || 'PENDING';
            if(statusText === 'PENDING') { statusBadge = 'badge bg-warning text-dark'; statusText = 'Pendiente'; }
            if(statusText === 'COMPLETED') { statusBadge = 'badge bg-success'; statusText = 'Completado'; }
            if(statusText === 'LATE') { statusBadge = 'badge bg-danger'; statusText = 'Atrasado'; }

            let assignedText = '';
            if(t.assignedToType === 'ALL') assignedText = '<span class="badge bg-dark">Todos</span>';
            else if(t.assignedToType === 'ROLE') assignedText = `<span class="badge bg-info">Rol: ${t.assignedToId}</span>`;
            else if(t.assignedToType === 'USER') {
                const u = users.find(u => u.id === t.assignedToId);
                assignedText = `<i class="mdi mdi-account"></i> ${u ? u.displayName : 'Usuario'}`;
            }
            else if(t.assignedToType === 'OFFICE') {
                 const o = offices.find(x => x.id === t.assignedToId);
                 assignedText = `<i class="mdi mdi-building"></i> ${o ? o.name : 'Oficina'}`;
            }
            else if(t.assignedToType === 'TEAM') {
                const tm = teams.find(x => x.id === t.assignedToId);
                assignedText = `<i class="mdi mdi-account-group"></i> ${tm ? tm.name : 'Equipo'}`;
            }
            
            // Notification Dot for Chat
            let chatBtnClass = 'btn-soft-primary';
            let chatIcon = 'bx-chat';
            let badgeHtml = '';
            
            if(t.hasAdminUnread) {
                chatBtnClass = 'btn-soft-danger position-relative'; // Changed to soft-danger for better look
                // Check counter
                let count = t.adminUnreadCount || 0;
                if(count > 0) {
                     badgeHtml = `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">${count}</span>`;
                } else {
                     badgeHtml = '<span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"></span>';
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <h5 class="text-truncate font-size-14 mb-1">${t.title}</h5>
                    <p class="text-muted mb-0 font-size-12">${t.description || ''}</p>
                </td>
                <td><span class="${badge}">${t.priority === 'HIGH' ? 'Alta' : (t.priority === 'MEDIUM' ? 'Media' : 'Baja')}</span></td>
                <td>${assignedText}</td>
                <td>${t.dueDate ? new Date(t.dueDate.seconds * 1000).toLocaleDateString() : (typeof t.dueDate === 'string' ? t.dueDate : '-')}</td>
                <td><span class="${statusBadge}">${statusText}</span></td>
                <td>${t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : '-'}</td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm ${chatBtnClass}" onclick="openAdminChat('${t.id}')" title="Bitácora">
                           <i class="bx ${chatIcon} font-size-16"></i>
                           ${badgeHtml}
                        </button>
                        <button class="btn btn-sm btn-soft-info" onclick="editTask('${t.id}')" title="Editar">
                           <i class="mdi mdi-pencil font-size-16"></i>
                        </button>
                        <button class="btn btn-sm btn-soft-danger" onclick="deleteTask('${t.id}')" title="Eliminar">
                           <i class="mdi mdi-trash-can font-size-16"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // DataTable Re-init
        dataTable = $('#datatable-tasks').DataTable({
             language: { 
                 emptyTable: "No hay tareas encontradas con estos filtros",
                 search: "Buscar:",
                 paginate: { first: "Primero", last: "Último", next: "Sig", previous: "Ant" },
                 info: "Mostrando _START_ a _END_ de _TOTAL_",
                 lengthMenu: "Mostrar _MENU_"
             }
        });
    }

    // ==========================================
    // 6. Notification & Chat Logic (Admin)
    // ==========================================

    let adminChatUnsubscribe = null;
    let currentChatTaskId = null;
    const adminChatModal = new bootstrap.Modal(document.getElementById('admin-chat-modal'));
    const adminChatHistory = document.getElementById('admin-chat-history');
    const adminChatInput = document.getElementById('admin-chat-input');
    const btnAdminSend = document.getElementById('btn-admin-send');
    const notiBadge = document.getElementById('noti-badge');
    const notiList = document.getElementById('noti-list');

    // 6.1 Open Chat
    window.openAdminChat = function(id) {
        currentChatTaskId = id;
        
        // Mark as read (reset flag and counter)
        db.collection('assigned_tasks').doc(id).update({ 
            hasAdminUnread: false,
            adminUnreadCount: 0
        });

        if(adminChatUnsubscribe) adminChatUnsubscribe();
        
        adminChatHistory.innerHTML = '<li class="text-center text-muted mt-5">Cargando bitácora...</li>';

        adminChatUnsubscribe = db.collection('assigned_tasks').doc(id).collection('messages')
            .orderBy('createdAt', 'asc')
            .onSnapshot(snap => {
                adminChatHistory.innerHTML = '';
                if(snap.empty) {
                    adminChatHistory.innerHTML = '<li class="text-center text-muted mt-5">No hay mensajes. Escribe uno para iniciar.</li>';
                    return;
                }

                snap.forEach(doc => {
                     const msg = doc.data();
                     const isMe = msg.senderId === auth.currentUser.uid;
                     const li = document.createElement('li');
                     const time = msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                     
                     li.innerHTML = `
                         <div class="d-flex ${isMe ? 'justify-content-end' : ''} mb-3">
                             <div class="${isMe ? 'bg-primary text-white' : 'bg-light'} p-2 rounded" style="max-width: 80%;">
                                 <small class="d-block ${isMe ? 'text-white-50' : 'text-muted'} font-size-10">${msg.senderName} - ${time}</small>
                                 <span>${msg.text}</span>
                             </div>
                         </div>
                     `;
                     adminChatHistory.appendChild(li);
                });
                adminChatHistory.scrollTop = adminChatHistory.scrollHeight;
            });
            
        adminChatModal.show();
    };

    // 6.2 Send Message
    btnAdminSend.addEventListener('click', () => {
        const text = adminChatInput.value.trim();
        if(!text || !currentChatTaskId) return;

        db.collection('assigned_tasks').doc(currentChatTaskId).collection('messages').add({
            text: text,
            senderId: auth.currentUser.uid,
            senderName: 'Equipo Imalá', // Branding change
            createdAt: new Date()
        }).then(() => {
            adminChatInput.value = '';
            // Mark user unread with counter
            db.collection('assigned_tasks').doc(currentChatTaskId).update({ 
                hasUserUnread: true,
                userUnreadCount: firebase.firestore.FieldValue.increment(1)
            }); 
        });
    });

    // 6.3 Global Notifications (Counter)
    // Hook into loadTasks -> checkLateTasks -> Here we can count unreads
    function updateNotifications(tasks) {
        let unreadCount = 0;
        let htmlList = '';

        tasks.forEach(t => {
            if(t.hasAdminUnread) {
                unreadCount++;
                htmlList += `
                    <a href="javascript:void(0);" onclick="openAdminChat('${t.id}')" class="text-reset notification-item">
                        <div class="d-flex">
                            <div class="avatar-xs me-3">
                                <span class="avatar-title bg-danger rounded-circle font-size-16">
                                    <i class="bx bx-chat"></i>
                                </span>
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="mb-1">${t.title}</h6>
                                <div class="font-size-12 text-muted">
                                    <p class="mb-1">Nuevo mensaje en bitácora</p>
                                </div>
                            </div>
                        </div>
                    </a>
                `;
            }
        });

        if(unreadCount > 0) {
            notiBadge.style.display = 'block';
            notiBadge.textContent = unreadCount;
            notiList.innerHTML = htmlList;
        } else {
            notiBadge.style.display = 'none';
            notiList.innerHTML = '<div class="text-center p-3 text-muted">No hay notificaciones nuevas.</div>';
        }
    }
    
    // Call this inside loadTasks listener
    
    
    // ==========================================
    // 7. Delete Logic
    // ==========================================
    window.deleteTask = function(id) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f46a6a',
            cancelButtonColor: '#74788d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                db.collection('assigned_tasks').doc(id).delete().then(() => {
                     Swal.fire('Eliminado', 'La tarea ha sido eliminada.', 'success');
                }).catch(err => {
                     Swal.fire('Error', 'No se pudo eliminar: ' + err.message, 'error');
                });
            }
        });
    };



});
