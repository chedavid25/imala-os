document.addEventListener('DOMContentLoaded', function () {
    
    // ==========================================
    // 1. Initialization
    // ==========================================
    
    const db = window.Imala.db;
    const auth = window.Imala.auth;
    
    // UI Elements
    const userModal = new bootstrap.Modal(document.getElementById('user-modal'));
    const structureModal = new bootstrap.Modal(document.getElementById('structure-modal'));
    
    let users = [];
    let offices = [];
    let teams = [];
    let dataTable;

    // ==========================================
    // 2. Auth & Admin Check
    // ==========================================
    
    auth.onAuthStateChanged(user => {
        if (user) {
            // In strict mode we should check if user is ADMIN.
            // For now (Dev Mode allowed in rules) we proceed, but let's query the user role just in case to show warnings.
            db.collection('users').doc(user.uid).get().then(doc => {
                if(doc.exists && doc.data().role !== 'ADMIN') {
                     // alert('Aviso: Estás accediendo a esta zona sin ser Admin (Modo Desarrollo).');
                }
                loadCoreData();
            });
        } else {
            window.location.href = 'auth-login.html';
        }
    });

    function loadCoreData() {
        // Load Offices
        db.collection('offices').onSnapshot(snap => {
            offices = [];
            snap.forEach(doc => offices.push({ id: doc.id, ...doc.data() }));
            renderStructureList();
            updateDropdowns(); // Update modal selects
        });

        // Load Teams
        db.collection('teams').onSnapshot(snap => {
            teams = [];
            snap.forEach(doc => teams.push({ id: doc.id, ...doc.data() }));
            renderStructureList();
            updateDropdowns();
        });

        // Load Users
        db.collection('users').onSnapshot(snap => {
            console.log("Admin Panel: Recibida actualización de usuarios. Cantidad:", snap.size);
            users = [];
            snap.forEach(doc => {
                const d = doc.data();
                console.log("Usuario encontrado:", d.displayName, d.email);
                users.push({ id: doc.id, ...d });
            });
            renderUsersTable();
            renderStructureList(); // Update independent list too
        }, err => {
            console.error("Error cargando usuarios:", err);
        });
    }

    // ==========================================
    // 3. User Management (Assignment Logic)
    // ==========================================

    function renderUsersTable() {
        if (dataTable) dataTable.destroy();
        
        const tbody = document.querySelector('#datatable-users tbody');
        tbody.innerHTML = '';

        users.forEach(u => {
            const tr = document.createElement('tr');
            
            // Resolve Names
            const officeName = offices.find(o => o.id === u.officeId)?.name || '-';
            const teamName = teams.find(t => t.id === u.teamId)?.name || '-';
            
            let assignmentInfo = '-';
            if(u.role === 'ASSISTANT' && u.assignedToId) {
                if(u.assignedToType === 'USER') {
                    const boss = users.find(boss => boss.id === u.assignedToId);
                    assignmentInfo = `Asiste a: <b>${boss ? boss.displayName : 'Usuario Desconocido'}</b>`;
                } else if (u.assignedToType === 'TEAM') {
                    const t = teams.find(x => x.id === u.assignedToId);
                    assignmentInfo = `Asiste al Equipo: <b>${t ? t.name : 'Desc.'}</b>`;
                } else if (u.assignedToType === 'OFFICE') {
                    const o = offices.find(x => x.id === u.assignedToId);
                    assignmentInfo = `Asiste a Oficina: <b>${o ? o.name : 'Desc.'}</b>`;
                }
            }

            let roleBadge = 'bg-secondary';
            if(u.role === 'ADMIN') roleBadge = 'bg-danger';
            if(u.role === 'BROKER') roleBadge = 'bg-primary';
            if(u.role === 'TEAM_LEADER') roleBadge = 'bg-info';
            if(u.role === 'MEMBER') roleBadge = 'bg-success';
            if(u.role === 'ASSISTANT') roleBadge = 'bg-warning text-dark';

            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-xs me-2">
                            <span class="avatar-title rounded-circle bg-light text-primary font-size-12">
                                ${u.displayName ? u.displayName.charAt(0) : 'U'}
                            </span>
                        </div>
                        <div>
                            <h5 class="font-size-14 mb-0">${u.displayName || 'Sin Nombre'}</h5>
                            <small class="text-muted">ID: ${u.id.substring(0,6)}...</small>
                        </div>
                    </div>
                </td>
                <td>${u.email}</td>
                <td><span class="badge ${roleBadge} font-size-11">${u.role || 'MEMBER'}</span></td>
                <td>
                    <div class="d-flex flex-column font-size-11">
                        <span>Ofi: ${officeName}</span>
                        <span>Eq: ${teamName}</span>
                    </div>
                </td>
                <td><small>${assignmentInfo}</small></td>
                <td>
                    <button class="btn btn-sm btn-soft-primary edit-user-btn" data-id="${u.id}"><i class="mdi mdi-pencil"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Init DataTable
        dataTable = $('#datatable-users').DataTable({
            language: { emptyTable: "No hay usuarios" }
        });

        // Event Delegation
        tbody.onclick = (e) => {
            const btn = e.target.closest('.edit-user-btn');
            if(btn) openEditUserModal(btn.dataset.id);
        };
    }

    // ==========================================
    // 4. Modals & Forms (Users)
    // ==========================================

    const roleSelect = document.getElementById('edit-user-role');
    const contextFields = document.querySelectorAll('.context-field');
    const assistRadios = document.getElementsByName('assist-type');

    roleSelect.addEventListener('change', updateContextFields);
    
    assistRadios.forEach(r => r.addEventListener('change', updateAssistantTargetSelect));

    function updateContextFields() {
        const role = roleSelect.value;
        contextFields.forEach(field => {
            const visibleFor = field.dataset.visibleFor.split(' ');
            if(visibleFor.includes(role)) {
                field.classList.remove('d-none');
            } else {
                field.classList.add('d-none');
            }
        });
        
        // Special Trigger for Assistant
        if(role === 'ASSISTANT') updateAssistantTargetSelect();
    }

    function updateAssistantTargetSelect() {
        const type = document.querySelector('input[name="assist-type"]:checked').value;
        const targetSelect = document.getElementById('edit-assist-target');
        targetSelect.innerHTML = '';

        if(type === 'USER') {
            users.forEach(u => {
                if(u.id !== document.getElementById('edit-user-id').value) { // Don't assign to self
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = `${u.displayName} (${u.role || 'MEMBER'})`;
                    targetSelect.appendChild(opt);
                }
            });
        } else if (type === 'TEAM') {
            teams.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                targetSelect.appendChild(opt);
            });
        } else if (type === 'OFFICE') {
            offices.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.id;
                opt.textContent = o.name;
                targetSelect.appendChild(opt);
            });
        }
    }

    function openEditUserModal(uid) {
        const u = users.find(x => x.id === uid);
        if(!u) return;

        document.getElementById('edit-user-id').value = uid;
        document.getElementById('edit-user-name').value = u.displayName || u.email;
        document.getElementById('edit-user-role').value = u.role || 'MEMBER';
        
        // Trigger logic to hide/show fields
        updateContextFields();

        // Set Values after fields are visible
        if(u.officeId) document.getElementById('edit-user-office').value = u.officeId;
        if(u.teamId) document.getElementById('edit-user-team').value = u.teamId;

        if(u.role === 'ASSISTANT') {
            const type = u.assignedToType || 'USER';
            // Select Radio
            const rad = document.querySelector(`input[name="assist-type"][value="${type}"]`);
            if(rad) {
                rad.checked = true;
                updateAssistantTargetSelect(); // Refresh select list based on radio
                document.getElementById('edit-assist-target').value = u.assignedToId || '';
            }
        }

        userModal.show();
    }

    document.getElementById('form-user').addEventListener('submit', (e) => {
        e.preventDefault();
        const uid = document.getElementById('edit-user-id').value;
        const role = document.getElementById('edit-user-role').value;
        
        const data = { role: role };

        // Hierarchy Logic
        if(['BROKER', 'TEAM_LEADER', 'MEMBER', 'ASSISTANT'].includes(role)) {
            data.officeId = document.getElementById('edit-user-office').value || null;
        } else {
             data.officeId = null; 
        }

        if(['TEAM_LEADER', 'MEMBER', 'ASSISTANT'].includes(role)) {
            data.teamId = document.getElementById('edit-user-team').value || null;
        } else {
            data.teamId = null;
        }

        // Assistant Logic
        if(role === 'ASSISTANT') {
            data.assignedToType = document.querySelector('input[name="assist-type"]:checked').value;
            data.assignedToId = document.getElementById('edit-assist-target').value;
        } else {
            data.assignedToType = null;
            data.assignedToId = null;
        }

        db.collection('users').doc(uid).update(data)
            .then(() => {
                userModal.hide();
                // We might want to update the office/team managerId field too if this user is now a Broker/Leader
                // But for now, let's keep it simple: Roles define access.
            })
            .catch(err => alert('Error: ' + err.message));
    });

    // ==========================================
    // 5. Structure Management (Offices/Teams)
    // ==========================================

    const btnAddOffice = document.getElementById('btn-add-office');
    const btnAddTeam = document.getElementById('btn-add-team');
    const formStruct = document.getElementById('form-structure');

    btnAddOffice.addEventListener('click', () => {
        openStructureModal('OFFICE');
    });

    btnAddTeam.addEventListener('click', () => {
        openStructureModal('TEAM');
    });

    function openStructureModal(type) {
        document.getElementById('struct-type').value = type;
        document.getElementById('struct-id').value = ''; // Empty for create
        document.getElementById('struct-name').value = '';
        
        if(type === 'OFFICE') {
            document.getElementById('structure-modal-title').textContent = 'Nueva Oficina';
            document.getElementById('struct-office-group').classList.add('d-none');
        } else {
            document.getElementById('structure-modal-title').textContent = 'Nuevo Equipo';
            document.getElementById('struct-office-group').classList.remove('d-none');
            
            // Populate Office Select
            const parentSel = document.getElementById('struct-parent-office');
            parentSel.innerHTML = '';
            offices.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.id;
                opt.textContent = o.name;
                parentSel.appendChild(opt);
            });
        }
        structureModal.show();
    }

    formStruct.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('struct-type').value;
        const name = document.getElementById('struct-name').value;
        const parentId = document.getElementById('struct-parent-office').value;

        // Auto-ID Generation (Firestore .add() does this automatically)
        const collection = type === 'OFFICE' ? 'offices' : 'teams';
        const payload = { name: name, createdAt: new Date() };

        if(type === 'TEAM') {
            payload.officeId = parentId;
        }

        db.collection(collection).add(payload)
            .then(() => {
                structureModal.hide();
            })
            .catch(err => alert(err.message));
    });

    function renderStructureList() {
        // Render Offices
        const oList = document.getElementById('office-list');
        oList.innerHTML = '';
        offices.forEach(o => {
            const div = document.createElement('div');
            div.className = 'card mb-1 border border-primary border-opacity-25';
            div.innerHTML = `
                <div class="card-body p-2 d-flex justify-content-between align-items-center">
                    <div>
                        <i class="mdi mdi-building text-primary me-2"></i> 
                        <b>${o.name}</b>
                        <br><small class="text-muted text-xs ms-4">ID: ${o.id.substring(0,4)}...</small>
                    </div>
                </div>
            `;
            oList.appendChild(div);
        });

        // Render Teams
        const tList = document.getElementById('team-list');
        tList.innerHTML = '';
        teams.forEach(t => {
            const parentName = offices.find(o => o.id === t.officeId)?.name || 'Sin Oficina';
            const div = document.createElement('div');
            div.className = 'card mb-1 border border-info border-opacity-25';
            div.innerHTML = `
                <div class="card-body p-2 d-flex justify-content-between align-items-center">
                    <div>
                        <i class="mdi mdi-account-group text-info me-2"></i> 
                        <b>${t.name}</b>
                        <br><small class="text-muted ms-4">Ofi: ${parentName}</small>
                    </div>
                </div>
            `;
            tList.appendChild(div);
        });

        // Render Independent Users
        const iList = document.getElementById('independent-list');
        iList.innerHTML = '';
        const independents = users.filter(u => !u.officeId && !u.teamId);
        
        independents.forEach(u => {
            const div = document.createElement('div');
            div.className = 'card mb-1 border border-warning border-opacity-25';
            div.innerHTML = `
                <div class="card-body p-2 d-flex justify-content-between align-items-center">
                    <div class="text-truncate" style="max-width: 80%;">
                        <i class="mdi mdi-account text-warning me-2"></i> 
                        <b>${u.displayName || u.email || 'Sin Nombre'}</b>
                        <br><small class="text-muted ms-4">${u.role || 'Member'}</small>
                    </div>
                    <button class="btn btn-sm btn-ghost-secondary edit-user-btn" data-id="${u.id}"><i class="mdi mdi-pencil"></i></button>
                </div>
            `;
            iList.appendChild(div);
        });
        
        // Add listeners for independent list edit buttons
        iList.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditUserModal(btn.dataset.id));
        });
    }

    // --- Create User Logic ---
    const btnAddUserStruct = document.getElementById('btn-add-user-struct');
    if(btnAddUserStruct) {
        btnAddUserStruct.addEventListener('click', () => openCreateUserModal());
    }

    function openCreateUserModal() {
        document.getElementById('edit-user-id').value = ''; // Empty ID = Create
        document.getElementById('edit-user-name').value = '';
        document.getElementById('edit-user-name').removeAttribute('readonly'); // Allow editing name
        document.getElementById('edit-user-email').value = '';
        document.getElementById('edit-user-email').removeAttribute('readonly'); // Enable email
        document.getElementById('email-warning').classList.add('d-none');
        
        document.getElementById('edit-user-role').value = 'MEMBER';
        document.getElementById('edit-user-office').value = '';
        document.getElementById('edit-user-team').value = '';
        document.getElementById('user-modal-title').textContent = 'Nuevo Usuario';
        
        updateContextFields();
        userModal.show();
    }
    
    // Override openEditUserModal to fix readonly states
    const originalOpenEdit = openEditUserModal;
    openEditUserModal = function(uid) {
        const u = users.find(x => x.id === uid);
        if(!u) return;

        document.getElementById('edit-user-id').value = uid;
        document.getElementById('edit-user-name').value = u.displayName || '';
        document.getElementById('edit-user-name').removeAttribute('readonly'); // Always allow name edit

        document.getElementById('edit-user-email').value = u.email || '';
        document.getElementById('edit-user-email').setAttribute('readonly', true); // Email locked on edit
        document.getElementById('email-warning').classList.remove('d-none');

        document.getElementById('edit-user-role').value = u.role || 'MEMBER';
        document.getElementById('user-modal-title').textContent = 'Editar Usuario';

        // Trigger logic to hide/show fields
        updateContextFields();

        if(u.officeId) document.getElementById('edit-user-office').value = u.officeId;
        if(u.teamId) document.getElementById('edit-user-team').value = u.teamId;

        if(u.role === 'ASSISTANT') {
            const type = u.assignedToType || 'USER';
            const rad = document.querySelector(`input[name="assist-type"][value="${type}"]`);
            if(rad) {
                rad.checked = true;
                updateAssistantTargetSelect();
                document.getElementById('edit-assist-target').value = u.assignedToId || '';
            }
        }
        userModal.show();
    }

    // Update Form Submit for Creation
    document.getElementById('form-user').addEventListener('submit', (e) => {
        e.preventDefault();
        const uid = document.getElementById('edit-user-id').value;
        const name = document.getElementById('edit-user-name').value;
        const email = document.getElementById('edit-user-email').value;
        const role = document.getElementById('edit-user-role').value;
        
        const data = { 
            displayName: name,
            role: role,
            updatedAt: new Date()
        };
        
        if(!uid) {
            data.email = email;
            data.createdAt = new Date();
        }

        // Hierarchy Logic
        if(['BROKER', 'TEAM_LEADER', 'MEMBER', 'ASSISTANT'].includes(role)) {
            data.officeId = document.getElementById('edit-user-office').value || null;
        } else {
             data.officeId = null; 
        }

        if(['TEAM_LEADER', 'MEMBER', 'ASSISTANT'].includes(role)) {
            data.teamId = document.getElementById('edit-user-team').value || null;
        } else {
            data.teamId = null;
        }

        // Assistant Logic
        if(role === 'ASSISTANT') {
            data.assignedToType = document.querySelector('input[name="assist-type"]:checked').value;
            data.assignedToId = document.getElementById('edit-assist-target').value;
        } else {
            data.assignedToType = null;
            data.assignedToId = null;
        }

        if(uid) {
            db.collection('users').doc(uid).update(data)
                .then(() => userModal.hide())
                .catch(err => alert('Error: ' + err.message));
        } else {
            // Create New
            // Note: This creates a Firestore doc but NOT Auth User. 
            // In a real app we'd need a Cloud Function or secondary App instance.
            db.collection('users').add(data)
                .then(() => {
                    userModal.hide(); 
                    alert('Usuario creado en base de datos. Nota: Esto no crea la cuenta de acceso (Auth), solo el perfil.');
                })
                .catch(err => alert('Error: ' + err.message));
        }
    });

    function updateDropdowns() {
        const offSel = document.getElementById('edit-user-office');
        const teamSel = document.getElementById('edit-user-team');
        
        // Save current selection to restore if possible
        const curOff = offSel.value;
        const curTeam = teamSel.value;

        offSel.innerHTML = '<option value="">Sin Oficina</option>';
        offices.forEach(o => {
             const opt = document.createElement('option');
             opt.value = o.id;
             opt.textContent = o.name;
             offSel.appendChild(opt);
        });

        teamSel.innerHTML = '<option value="">Sin Equipo</option>';
        teams.forEach(t => {
             const opt = document.createElement('option');
             opt.value = t.id;
             opt.textContent = t.name;
             teamSel.appendChild(opt);
        });

        offSel.value = curOff;
        teamSel.value = curTeam;
    }

});
