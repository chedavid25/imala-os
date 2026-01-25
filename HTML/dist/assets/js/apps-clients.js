// apps-clients.js - Logic for Clients & Offices Management

// Firebase references (Globals from firebase-config.js)
// db and auth are already defined.

let clients = [];
let currentFilter = 'ALL';
let currentView = 'GRID';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    window.Imala.auth.checkAuth(user => {
        console.log("Auth User:", user);
        loadClients();
    });
});

// --- Actions ---
function openWhatsApp(phone) {
    if(!phone) return;
    const clean = phone.replace(/[^0-9]/g, '');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if(isMobile) {
        // Mobile: Trigger App Intent
        window.open(`https://wa.me/${clean}`, '_blank');
    } else {
        // Desktop: Open/Reuse 'whatsapp_window'
        window.open(`https://web.whatsapp.com/send?phone=${clean}`, 'whatsapp_window');
    }
}

// --- Load Data ---
async function loadClients() {
    // Listen to 'clients' collection
    db.collection('clients').onSnapshot(snap => {
        clients = [];
        snap.forEach(doc => {
            clients.push({ id: doc.id, ...doc.data() });
        });
        
        updateTotalCount();
        renderCurrentView();
        populateOfficeSelect();
    });
}

// --- Logic -> View Toggling ---
function toggleView(mode) {
    currentView = mode;
    renderCurrentView();
}

function renderCurrentView() {
    const grid = document.getElementById('clients-grid');
    const list = document.getElementById('clients-list');

    if(currentView === 'GRID') {
        grid.classList.remove('d-none');
        list.classList.add('d-none');
        renderClientsGrid();
    } else {
        grid.classList.add('d-none');
        list.classList.remove('d-none');
        renderClientsList();
    }
}

// --- Logic -> Filters ---
function filterClients(type) {
    currentFilter = type; // ALL, CLIENT, OFFICE
    
    // Update Tabs UI
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    if(type === 'ALL') document.getElementById('tab-all').classList.add('active');
    if(type === 'CLIENT') document.getElementById('tab-clients').classList.add('active');
    if(type === 'OFFICE') document.getElementById('tab-offices').classList.add('active');

    renderCurrentView();
}

function updateTotalCount() {
    document.getElementById('total-clients-count').textContent = `(${clients.length})`;
}

// --- Logic -> Rendering ---
function renderClientsGrid() {
    const grid = document.getElementById('clients-grid');
    grid.innerHTML = '';
    
    let filtered = clients;
    if(currentFilter !== 'ALL') {
        filtered = clients.filter(c => c.type === currentFilter);
    }

    if(filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center mt-5">
                <div class="avatar-xl mx-auto mb-4">
                    <div class="avatar-title bg-light rounded-circle text-primary display-4">
                        <i class="bx bx-user-x"></i>
                    </div>
                </div>
                <h5 class="text-muted">No se encontraron registros.</h5>
            </div>
        `;
        return;
    }

    filtered.forEach(client => {
        const isOffice = client.type === 'OFFICE';
        const officeName = client.officeName || (client.parentId ? getOfficeName(client.parentId) : 'Independiente');
        
        // Quick Actions Links
        const mailLink = client.email ? `mailto:${client.email}` : '#';
        const profileLink = `apps-clients-profile.html?id=${client.id}`;
        
        // Avatar / Icon
        let avatarHTML = '';
        if(isOffice) {
             avatarHTML = `
                <div class="avatar-xl mx-auto mb-4">
                    <div class="avatar-title bg-primary-subtle text-primary display-4 m-0 rounded-circle">
                         <i class="bx bxs-building-house"></i>
                    </div>
                </div>
             `;
        } else {
             // Initials
             const initials = client.name ? client.name.substring(0,2).toUpperCase() : '??';
             avatarHTML = `
                <div class="avatar-xl mx-auto mb-4">
                    <div class="avatar-title bg-light-subtle text-primary display-4 m-0 rounded-circle">
                        ${initials}
                    </div>
                </div>
             `;
        }
        
        // Buttons: WhatsApp | Mail | Profile (Bitácora)
        const waBtn = client.phone 
            ? `<button onclick="openWhatsApp('${client.phone}')" class="btn btn-outline-light text-truncate" data-bs-toggle="tooltip" title="WhatsApp"><i class="mdi mdi-whatsapp font-size-18 text-success"></i></button>` 
            : `<button class="btn btn-outline-light text-truncate disabled"><i class="mdi mdi-whatsapp font-size-18 text-muted"></i></button>`;
            
        const mailBtn = client.email
            ? `<a href="${mailLink}" class="btn btn-outline-light text-truncate" data-bs-toggle="tooltip" title="Email"><i class="mdi mdi-email-outline font-size-18 text-danger"></i></a>`
            : `<button class="btn btn-outline-light text-truncate disabled"><i class="mdi mdi-email-outline font-size-18 text-muted"></i></button>`;

        const profileBtn = `<a href="${profileLink}" class="btn btn-outline-light text-truncate w-100"><i class="uil uil-user me-1"></i> Ver Bitácora / Perfil</a>`;

        grid.innerHTML += `
            <div class="col-xl-3 col-sm-6">
                <div class="card text-center border shadow-none">
                    <div class="card-body">
                         <div class="dropdown text-end">
                            <a class="text-muted dropdown-toggle font-size-16" href="#" role="button" data-bs-toggle="dropdown" aria-haspopup="true">
                              <i class="bx bx-dots-horizontal-rounded"></i>
                            </a>
                            <div class="dropdown-menu dropdown-menu-end">
                                <a class="dropdown-item" href="#" onclick="editClient('${client.id}')">Editar</a>
                                <div class="dropdown-divider"></div>
                                <a class="dropdown-item text-danger" href="#" onclick="deleteClient('${client.id}')">Eliminar</a>
                            </div>
                        </div>

                        ${avatarHTML}
                        
                        <h5 class="font-size-16 mb-1"><a href="${profileLink}" class="text-body">${client.name}</a></h5>
                        <p class="text-muted mb-2">${isOffice ? '<span class="badge bg-primary">OFICINA</span>' : '<span class="badge bg-success">CLIENTE</span>'}</p>
                        
                        ${!isOffice ? `<small class="text-muted d-block mb-3">Oficina: <strong>${officeName}</strong></small>` : '<div class="mb-3">&nbsp;</div>'}
                        
                         <div class="d-flex justify-content-center gap-2 mb-3">
                            ${waBtn}
                            ${mailBtn}
                        </div>
                    </div>
                    <div class="btn-group border-top" role="group">
                        ${profileBtn}
                    </div>
                </div>
            </div>
        `;
    });
}

function renderClientsList() {
    const tbody = document.getElementById('clients-table-body');
    tbody.innerHTML = '';

    let filtered = clients;
    if(currentFilter !== 'ALL') {
        filtered = clients.filter(c => c.type === currentFilter);
    }
    
    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No se encontraron registros.</td></tr>';
        return;
    }

    filtered.forEach(client => {
         const isOffice = client.type === 'OFFICE';
         const officeName = client.officeName || (client.parentId ? getOfficeName(client.parentId) : 'Independiente');
         const profileLink = `apps-clients-profile.html?id=${client.id}`;
         
         // Type Badge
         const typeBadge = isOffice ? '<span class="badge bg-primary">OFICINA</span>' : `<span class="badge bg-success">CLIENTE</span><br><small class="text-muted">${officeName}</small>`;
         
         // Contact Info
         let contactInfo = '';
         if(client.email) contactInfo += `<div><i class="mdi mdi-email me-1"></i> ${client.email}</div>`;
         if(client.phone) contactInfo += `<div><a href="#" onclick="openWhatsApp('${client.phone}')" class="text-body"><i class="mdi mdi-whatsapp me-1 text-success"></i> ${client.phone}</a></div>`;
         if(!contactInfo) contactInfo = '<span class="text-muted">-</span>';

         tbody.innerHTML += `
            <tr>
                <td>
                    <h5 class="font-size-14 mb-1"><a href="${profileLink}" class="text-dark">${client.name}</a></h5>
                </td>
                <td>${typeBadge}</td>
                <td>${contactInfo}</td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-link font-size-16 shadow-none py-0 text-muted dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bx bx-dots-horizontal-rounded"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="${profileLink}">Ver Perfil / Bitácora</a></li>
                            <li><a class="dropdown-item" href="#" onclick="editClient('${client.id}')">Editar</a></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="deleteClient('${client.id}')">Eliminar</a></li>
                        </ul>
                    </div>
                </td>
            </tr>
         `;
    });
}

function getOfficeName(id) {
    const office = clients.find(c => c.id === id);
    return office ? office.name : 'Desconocida';
}

function populateOfficeSelect() {
    const select = document.getElementById('client-office');
    select.innerHTML = '<option value="">- Ninguna / Independiente -</option>';
    
    // Only filter Offices
    const offices = clients.filter(c => c.type === 'OFFICE');
    offices.forEach(off => {
        select.innerHTML += `<option value="${off.id}">${off.name}</option>`;
    });
}

// --- Logic -> Modal & CRUD ---

function toggleClientFields() {
    const type = document.querySelector('input[name="clientType"]:checked').value;
    const personalFields = document.getElementById('personal-fields');
    
    if(type === 'OFFICE') {
        personalFields.classList.add('d-none');
    } else {
        personalFields.classList.remove('d-none');
    }
}

async function saveClient() {
    const id = document.getElementById('client-id').value;
    const name = document.getElementById('client-name').value;
    const type = document.querySelector('input[name="clientType"]:checked').value;
    const desc = document.getElementById('client-desc').value;
    
    if(!name) {
        alert("El nombre es obligatorio");
        return;
    }

    const data = {
        name: name,
        type: type,
        description: desc,
        updatedAt: new Date()
    };

    if(type === 'CLIENT') {
        data.email = document.getElementById('client-email').value;
        data.phone = document.getElementById('client-phone').value;
        data.birthDate = document.getElementById('client-bday').value;
        data.parentId = document.getElementById('client-office').value || null;
    }

    try {
        if(id) {
            await db.collection('clients').doc(id).update(data);
            if(type === 'CLIENT') checkAndCreateBirthdayTask(id, name, data.birthDate);
        } else {
            data.createdAt = new Date();
            const docRef = await db.collection('clients').add(data);
            if(type === 'CLIENT') checkAndCreateBirthdayTask(docRef.id, name, data.birthDate);
        }
        
        // Reset and Close
        document.getElementById('form-client').reset();
        document.getElementById('client-id').value = '';
        const modalEl = document.getElementById('newClientModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        Swal.fire({
            icon: 'success',
            title: 'Guardado',
            timer: 1500,
            showConfirmButton: false
        });

    } catch(e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
    }
}

async function checkAndCreateBirthdayTask(clientId, clientName, birthDate) {
    if(!birthDate || !clientId) return;

    // Calculate next birthday
    const today = new Date();
    const bdayParts = birthDate.split('-'); // YYYY-MM-DD
    let nextBday = new Date(today.getFullYear(), parseInt(bdayParts[1])-1, parseInt(bdayParts[2]));
    
    if (nextBday < today) {
        nextBday.setFullYear(today.getFullYear() + 1);
    }
    
    const nextBdayStr = nextBday.toISOString().split('T')[0];

    // Check if task exists
    const snap = await db.collection('tasks')
        .where('clientId', '==', clientId)
        .where('type', '==', 'BIRTHDAY')
        .get();

    if(!snap.empty) {
        // Update existing? For now, just leave it if exists to avoid dupes/spam
        return; 
    }

    // Create New
    await db.collection('tasks').add({
        title: `🎂 Cumpleaños de ${clientName}`,
        description: 'Saludar por su cumpleaños.',
        dueDate: nextBdayStr,
        clientId: clientId,
        clientName: clientName,
        type: 'BIRTHDAY',
        recurrence: 'YEARLY',
        priority: 'HIGH',
        status: 'TODO',
        category: 'General',
        createdAt: new Date(),
        assignedTo: 'Ambos' // Default
    });
    
    console.log("Birthday Task Created for", clientName);
}

function editClient(id) {
    const client = clients.find(c => c.id === id);
    if(!client) return;

    document.getElementById('client-id').value = client.id;
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-desc').value = client.description || '';
    
    // Radio Type
    if(client.type === 'OFFICE') {
        document.getElementById('type-office').checked = true;
    } else {
        document.getElementById('type-client').checked = true;
        document.getElementById('client-email').value = client.email || '';
        document.getElementById('client-phone').value = client.phone || '';
        document.getElementById('client-bday').value = client.birthDate || '';
        document.getElementById('client-office').value = client.parentId || '';
    }
    toggleClientFields();

    const modal = new bootstrap.Modal(document.getElementById('newClientModal'));
    modal.show();
}

async function deleteClient(id) {
    if(!confirm("¿Estás seguro de eliminar este registro?")) return;
    await db.collection('clients').doc(id).delete();
}
