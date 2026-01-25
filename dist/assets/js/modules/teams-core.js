document.addEventListener('DOMContentLoaded', function () {
    const db = window.Imala.db;
    const auth = window.Imala.auth;
    const teamGrid = document.getElementById('team-grid');
    const totalMembers = document.getElementById('total-members');
    
    let currentUser = null;
    let allUsers = [];

    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                currentUser = { uid: user.uid, ...doc.data() };
                initView();
            });
        } else {
            window.location.href = 'auth-login.html';
        }
    });

    function initView() {
        if(document.getElementById('admin-actions')) {
            // Hide by default
            document.getElementById('admin-actions').style.display = 'none'; 
            
            if (currentUser.role === 'ADMIN' || currentUser.role === 'BROKER') {
                document.getElementById('admin-actions').style.display = 'block';
            }
        }
        
        loadTeamMembers();
    }

    function loadTeamMembers() {
        let query = db.collection('users');

        // Safe Querying Logic to prevent Permission Denied errors
        // If not Admin/Broker, we must restrict query or Firestore rejects it completely.
        
        if (currentUser.role === 'ADMIN' || currentUser.role === 'BROKER') {
            // Can query all
        } else if (currentUser.role === 'TEAM_LEADER') {
            // Can only query own team
            query = query.where('teamLeaderId', '==', currentUser.uid);
        } else if (currentUser.role === 'AGENTE' || currentUser.role === 'MEMBER') {
            // Can only see self (or colleagues if we had a teamId)
            // For now, to prevent crash, let's just show self if we can't query group
            if(currentUser.teamLeaderId) {
                 query = query.where('teamLeaderId', '==', currentUser.teamLeaderId);
            } else {
                 // No leader, can only see self. 
                 // Querying by doc ID not possible in collection query easily, 
                 // easier to just mock the array with currentUser and skip query.
                 renderGrid([currentUser]);
                 return; 
            }
        }

        query.onSnapshot(snapshot => {
            allUsers = [];
            snapshot.forEach(doc => {
                allUsers.push({ id: doc.id, ...doc.data() });
            });
            // Merge self if missing (e.g. Leader might not be in the 'teamLeaderId' query of others)
            if(!allUsers.find(u => u.id === currentUser.uid)) {
                allUsers.push(currentUser);
            }
            renderGrid(filterUsers(allUsers)); // Helper filter still useful
        }, error => {
            console.warn("Permission Error or loading issue:", error);
            // Fallback: Show at least current user
            renderGrid([currentUser]);
             // Show alert if admin trying to debug
             if(currentUser.role === 'ADMIN') alert("Query Error: " + error.message);
        });
    }

    function filterUsers(users) {
        if (currentUser.role === 'ADMIN' || currentUser.role === 'BROKER') return users;
        
        if (currentUser.role === 'TEAM_LEADER') {
            return users.filter(u => u.teamLeaderId === currentUser.uid || u.id === currentUser.uid);
        }
        
        if (currentUser.role === 'AGENTE' || currentUser.role === 'MEMBER') {
            if (currentUser.teamLeaderId) {
                return users.filter(u => u.teamLeaderId === currentUser.teamLeaderId || u.id === currentUser.teamLeaderId || u.id === currentUser.uid);
            }
            return [currentUser]; // Solo yo si no tengo equipo
        }

        return users; // Default fallback
    }

    function renderGrid(users) {
        teamGrid.innerHTML = '';
        totalMembers.textContent = `(${users.length})`;

        users.forEach(u => {
            const cardCol = document.createElement('div');
            cardCol.className = 'col-xl-3 col-sm-6';
            
            const initial = u.displayName ? u.displayName.charAt(0) : 'U';
            const roleBadge = getRoleBadge(u.role);
            
            // STRICT ADMIN ONLY for editing roles
            const canEdit = (currentUser.role === 'ADMIN') ? 
                            `<div class="dropdown float-end">
                                <a href="#" class="dropdown-toggle arrow-none" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i class="mdi mdi-dots-vertical m-0 text-muted h5"></i>
                                </a>
                                <div class="dropdown-menu dropdown-menu-end">
                                    <a class="dropdown-item edit-user-btn" href="#" data-uid="${u.id}">Editar Rol/Equipo</a>
                                </div>
                             </div>` : '';

            cardCol.innerHTML = `
                <div class="card text-center">
                    <div class="card-body">
                        ${canEdit}
                        <div class="avatar-sm mx-auto mb-4">
                            <span class="avatar-title rounded-circle bg-primary bg-soft text-primary font-size-16">
                                ${initial}
                            </span>
                        </div>
                        <h5 class="font-size-15 mb-1"><a href="#" class="text-dark">${u.displayName || 'Sin Nombre'}</a></h5>
                        <p class="text-muted">${u.email}</p>
                        
                        <div>
                             ${roleBadge}
                        </div>
                    </div>
                </div>
            `;
            teamGrid.appendChild(cardCol);
        });

        // Bind Edit Events
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openEditModal(btn.dataset.uid);
            });
        });
    }

    // Modal Logic
    const userModal = new bootstrap.Modal(document.getElementById('user-modal'));
    
    function openEditModal(uid) {
        const user = allUsers.find(u => u.id === uid);
        document.getElementById('edit-uid').value = uid;
        document.getElementById('edit-role').value = user.role || 'AGENTE';
        
        // Populate Leaders
        const leadersSelect = document.getElementById('edit-leader');
        leadersSelect.innerHTML = '<option value="">Sin Líder (Directo a Broker)</option>';
        
        allUsers.filter(u => u.role === 'TEAM_LEADER' || u.role === 'BROKER').forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.displayName;
            leadersSelect.appendChild(opt);
        });
        
        document.getElementById('edit-leader').value = user.teamLeaderId || '';
        userModal.show();
    }

    document.getElementById('btn-save-user').addEventListener('click', () => {
        const uid = document.getElementById('edit-uid').value;
        const newRole = document.getElementById('edit-role').value;
        const newLeader = document.getElementById('edit-leader').value;

        db.collection('users').doc(uid).update({
            role: newRole,
            teamLeaderId: newLeader
        }).then(() => {
            userModal.hide();
        });
    });

    function getRoleBadge(role) {
        if (role === 'BROKER') return '<span class="badge bg-danger">Broker</span>';
        if (role === 'TEAM_LEADER') return '<span class="badge bg-warning">Team Leader</span>';
        if (role === 'AGENTE' || role === 'MEMBER') return '<span class="badge bg-success">Agente</span>';
        if (role === 'ADMIN') return '<span class="badge bg-dark">Admin</span>';
        return '<span class="badge bg-secondary">Usuario</span>';
    }

    // --- INVITATION CODES LOGIC ---
    
    // Tab Listener to load codes if not loaded
    const codesTab = document.querySelector('a[href="#codes-tab"]');
    if(codesTab) {
        codesTab.addEventListener('shown.bs.tab', function (e) {
            loadInvitationCodes();
        });
    }

    function loadInvitationCodes() {
        // Only Admin/Broker should see this really.
        if(currentUser.role !== 'ADMIN' && currentUser.role !== 'BROKER') return;

        db.collection('invitationCodes').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const tbody = document.getElementById('codes-table-body');
            tbody.innerHTML = '';
            
            document.getElementById('total-codes').textContent = `(${snapshot.size})`;

            if(snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No hay códigos generados.</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const tr = document.createElement('tr');
                
                const createdDate = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : '-';
                const statusBadge = data.isActive 
                    ? `<span class="badge bg-success">Activo</span>` 
                    : `<span class="badge bg-danger">Inactivo</span>`;
                
                // Calculo de uso
                const usageRatio = `${data.usedCount} / ${data.maxUses}`;
                
                tr.innerHTML = `
                    <td><span class="fw-bold text-primary">${data.code}</span><br><small class="text-muted">${data.notes || ''}</small></td>
                    <td>${getRoleBadge(data.type)}</td>
                    <td>${usageRatio}</td>
                    <td>${createdDate}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger btn-delete-code" data-id="${doc.id}">
                            <i class="mdi mdi-delete"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Bind Delete events
            document.querySelectorAll('.btn-delete-code').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if(confirm("¿Seguro que deseas eliminar este código? Nadie más podrá usarlo.")) {
                        db.collection('invitationCodes').doc(e.currentTarget.dataset.id).delete();
                    }
                });
            });
        });
    }

    // Generate Code Form Submit
    const generateCodeForm = document.getElementById('form-generate-code');
    const generateCodeModal = new bootstrap.Modal(document.getElementById('generate-code-modal'));

    if(generateCodeForm) {
        generateCodeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const role = document.getElementById('code-role').value;
            const uses = parseInt(document.getElementById('code-uses').value);
            const notes = document.getElementById('code-notes').value;
            
            // Random string generation
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            db.collection('invitationCodes').add({
                code: code,
                type: role,
                maxUses: uses,
                usedCount: 0,
                notes: notes,
                isActive: true,
                createdAt: new Date(),
                createdBy: currentUser.uid
            }).then(() => {
                alert(`Código Generado: ${code}`);
                generateCodeForm.reset();
                generateCodeModal.hide();
                loadInvitationCodes(); // Refresh view
            }).catch(err => {
                console.error("Error creating code: ", err);
                alert("Error al crear código: " + err.message);
            });
        });
    }

});
