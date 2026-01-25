// apps-clients-profile.js - Logic for Profile, Bitácora & Related Tasks

// Globals from firebase-config.js (db, auth) should be available.

let clientId = null;
let clientData = null;

document.addEventListener('DOMContentLoaded', function() {
    window.Imala.auth.checkAuth(user => {
        const urlParams = new URLSearchParams(window.location.search);
        clientId = urlParams.get('id');

        if(!clientId) {
            Swal.fire('Error', 'No se especificó un cliente.', 'error');
            return;
        }

        loadClientProfile();
        loadBitacora();
        loadRelatedTasks();
        loadAttachments();
    });
});

async function loadClientProfile() {
    try {
        const doc = await db.collection('clients').doc(clientId).get();
        if(!doc.exists) {
            Swal.fire('Error', 'Cliente no encontrado.', 'error');
            return;
        }

        clientData = doc.data();
        renderProfileHeader(clientData);
        renderProfileInfo(clientData);
        
        // Next Contact
        if(clientData.nextContact) {
             const d = new Date(clientData.nextContact.seconds * 1000);
             document.getElementById('next-contact-date').value = d.toISOString().split('T')[0];
        }

    } catch(e) {
        console.error("Error loading profile", e);
    }
}

function renderProfileHeader(data) {
    document.getElementById('profile-name').textContent = data.name;
    document.getElementById('profile-type').textContent = data.type === 'OFFICE' ? 'Oficina' : 'Cliente';
    
    // Avatar
    const avatarEl = document.getElementById('profile-avatar');
    if(data.type === 'OFFICE') {
         avatarEl.className = "avatar-title bg-primary-subtle text-primary display-4 m-0 rounded-circle";
         avatarEl.innerHTML = '<i class="bx bxs-building-house"></i>';
    } else {
         const initials = data.name.substring(0,2).toUpperCase();
         avatarEl.className = "avatar-title bg-light-subtle text-primary display-4 m-0 rounded-circle";
         avatarEl.textContent = initials;
    }

    document.getElementById('profile-email').textContent = data.email || '';
    document.getElementById('profile-phone').textContent = data.phone || '';
}

function renderProfileInfo(data) {
    document.getElementById('profile-desc').innerHTML = data.description ? `<p>${data.description}</p>` : '<p class="text-muted">Sin descripción.</p>';
    
    document.getElementById('info-email').textContent = data.email || ' - ';
    document.getElementById('info-phone').textContent = data.phone || ' - ';
    const bday = data.birthDate ? new Date(data.birthDate).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : ' - ';
    document.getElementById('info-bday').textContent = bday;
    
    // Office Name fetch if needed (placeholder for now)
    if(data.parentId) {
        db.collection('clients').doc(data.parentId).get().then(snap => {
            if(snap.exists) document.getElementById('info-office').textContent = snap.data().name;
        });
    } else {
         document.getElementById('info-office').textContent = data.type === 'OFFICE' ? 'Es Oficina' : 'Independiente';
    }
}

// --- Unified Bitacora Logic ---
let bitacoraNotes = [];
let bitacoraTasks = [];

function loadBitacora() {
    // 1. Listen to Manual Notes
    db.collection('clients').doc(clientId).collection('bitacora')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
            bitacoraNotes = [];
            snap.forEach(doc => {
                 bitacoraNotes.push({ id: doc.id, ...doc.data(), _source: 'NOTE' });
            });
            renderUnifiedBitacora();
        });

    // 2. Listen to Assigned Tasks (for History)
    db.collection('tasks').where('clientId', '==', clientId)
        .onSnapshot(snap => {
            bitacoraTasks = [];
            snap.forEach(doc => {
                 // Adapt Task to resemble a note for the timeline
                 const t = doc.data();
                 bitacoraTasks.push({
                     id: doc.id,
                     text: `Tarea: ${t.title} (${getStatusLabel(t.status)})`,
                     type: 'TASK',
                     createdAt: t.createdAt, // Assumes task has createdAt
                     _source: 'TASK'
                 });
            });
            renderUnifiedBitacora();
        });
}

function renderUnifiedBitacora() {
    const list = document.getElementById('bitacora-list');
    list.innerHTML = '';
    
    // Merge & Sort
    const allItems = [...bitacoraNotes, ...bitacoraTasks];
    allItems.sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime()/1000) : 0;
        const dateB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime()/1000) : 0;
        return dateB - dateA; // Descending
    });

    if(allItems.length === 0) {
        list.innerHTML = '<li class="text-center text-muted p-3">No hay registros en la bitácora todavía.</li>';
        return;
    }

    allItems.forEach(item => {
        const dateRaw = item.createdAt ? (item.createdAt.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt)) : new Date();
        const dateStr = dateRaw.toLocaleDateString() + ' ' + dateRaw.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        let iconClass = 'bx-pencil'; 
        if(item.type === 'TASK') iconClass = 'bx-task';
        if(item.type === 'MEETING') iconClass = 'bx-microphone';
        if(item.type === 'SYSTEM') iconClass = 'bx-cog';

        list.innerHTML += `
            <li class="event-list">
                <div class="event-timeline-dot">
                    <i class="bx ${iconClass} font-size-18"></i>
                </div>
                <div class="d-flex mb-2">
                    <div class="flex-shrink-0 me-3">
                        <i class="bx ${iconClass} h2 text-primary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div>
                            <h5 class="font-size-15 mb-0">${item.text}</h5>
                            <small class="text-muted">${dateStr}</small>
                        </div>
                    </div>
                </div>
            </li>
        `;
    });
}

function addBitacoraNote() {
    const text = document.getElementById('note-input').value;
    if(!text.trim()) return;

    db.collection('clients').doc(clientId).collection('bitacora').add({
        text: text,
        type: 'MANUAL',
        createdAt: new Date(),
        createdBy: auth.currentUser.uid
    }).then(() => {
        document.getElementById('note-input').value = '';
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Nota agregada',
            showConfirmButton: false,
            timer: 1500
        });
    });
}

// --- Tasks Integration ---
function loadRelatedTasks() {
    // Show tasks where clientId == current
    // Assuming 'tasks' collection has 'clientId' field
    db.collection('tasks').where('clientId', '==', clientId)
    .limit(10)
    .get().then(snap => {
         const list = document.getElementById('tasks-list');
         list.innerHTML = '';
         if(snap.empty) {
             list.innerHTML = '<li class="list-group-item text-center text-muted">No hay tareas pendientes.</li>';
             return;
         }
         
         let tasks = [];
         snap.forEach(doc => tasks.push(doc.data()));
         
         // Client-side sort
         tasks.sort((a,b) => (a.dueDate || '') > (b.dueDate || '') ? 1 : -1);

         tasks.forEach(t => {
             const createdRaw = t.createdAt ? (t.createdAt.seconds ? new Date(t.createdAt.seconds * 1000) : new Date(t.createdAt)) : new Date();
             const createdStr = createdRaw.toLocaleDateString();
             
             const statusBadge = getStatusBadgeHTML(t.status);

             list.innerHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0">${t.title}</h6>
                        <small class="text-muted">Creación: ${createdStr}</small>
                    </div>
                    ${statusBadge}
                </li>`;
         });
    }).catch(err => {
        console.error("Error loading tasks:", err);
        document.getElementById('tasks-list').innerHTML = `<li class="list-group-item text-danger text-center">Error al cargar tareas: ${err.message}</li>`;
    });
}

function getStatusLabel(s) {
    if (s === 'TODO') return 'Pendiente'; 
    if (s === 'COMPLETED') return 'Completado'; 
    if (s === 'LATE') return 'Atrasado'; 
    return s;
}

function getStatusBadgeHTML(s) {
    if (s === 'TODO') return '<span class="badge bg-warning">Pendiente</span>';
    if (s === 'COMPLETED') return '<span class="badge bg-success">Completado</span>';
    if (s === 'LATE') return '<span class="badge bg-danger">Atrasado</span>';
    return `<span class="badge bg-secondary">${s}</span>`;
}

async function updateNextContact() {
    const dateVal = document.getElementById('next-contact-date').value;
    if(!dateVal) return;

    // 1. Update Client Record
    const contactDate = new Date(dateVal);
    await db.collection('clients').doc(clientId).update({
        nextContact: contactDate
    });

    // 2. Create Automated Task
    const taskTitle = `Seguimiento: ${clientData.name}`;
    
    // Check if task already exists (simple check to avoid spam, optional but good UX)
    // For now, just create it.
    
    await db.collection('tasks').add({
        title: taskTitle,
        description: 'Tarea generada automáticamente desde Perfil de Cliente (Próximo Contacto).',
        dueDate: contactDate,
        clientId: clientId,
        clientName: clientData.name,
        status: 'PENDING',
        createdAt: new Date(),
        createdBy: auth.currentUser.uid
    });

    // 3. Log to Bitácora
    await db.collection('clients').doc(clientId).collection('bitacora').add({
        text: `Se programó un próximo contacto para el ${dateVal}`,
        type: 'SYSTEM',
        createdAt: new Date()
    });

    Swal.fire('Agenda Actualizada', 'Se creó la tarea de seguimiento automáticamente.', 'success');
}

// --- Attachments Logic ---
function loadAttachments() {
    db.collection('clients').doc(clientId).collection('attachments')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
            const list = document.getElementById('attachments-list');
            list.innerHTML = '';
            
            if(snap.empty) {
                list.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No hay archivos adjuntos.</td></tr>';
                return;
            }

            snap.forEach(doc => {
                const f = doc.data();
                const dateStr = f.createdAt ? (f.createdAt.seconds ? new Date(f.createdAt.seconds*1000).toLocaleDateString() : new Date().toLocaleDateString()) : '-';
                
                // Icon based on type
                let icon = 'bx-file';
                if(f.type.includes('pdf')) icon = 'bxs-file-pdf text-danger';
                else if(f.type.includes('image')) icon = 'bxs-image text-success';
                else if(f.type.includes('word') || f.type.includes('officedocument')) icon = 'bxs-file-doc text-primary';
                else if(f.type.includes('spreadsheet') || f.type.includes('excel')) icon = 'bxs-file-json text-success';

                list.innerHTML += `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <i class="bx ${icon} font-size-24 me-2"></i>
                                <div>
                                    <h5 class="font-size-14 mb-1"><a href="${f.url}" target="_blank" class="text-dark">${f.name}</a></h5>
                                    <small class="text-muted">${f.type}</small>
                                </div>
                            </div>
                        </td>
                        <td>${dateStr}</td>
                        <td>${formatBytes(f.size)}</td>
                        <td>
                            <div class="d-flex gap-2">
                                <a href="${f.url}" target="_blank" class="btn btn-sm btn-soft-primary"><i class="bx bx-download"></i></a>
                                <button class="btn btn-sm btn-soft-danger" onclick="deleteAttachment('${doc.id}', '${f.name}')">
                                    <i class="bx bx-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        });
}

async function uploadAttachment() {
    const input = document.getElementById('attachment-input');
    const file = input.files[0];
    if(!file) {
        Swal.fire('Atención', 'Selecciona un archivo primero', 'warning');
        return;
    }

    if(!window.Imala.storage) {
         Swal.fire('Error', 'Firebase Storage no está habilitado.', 'error');
         return;
    }

    // 1. Upload to Storage
    const storageRef = window.Imala.storage.ref();
    // Path: clients/{clientId}/{fileName}
    const fileRef = storageRef.child(`clients/${clientId}/${file.name}`);

    Swal.fire({
        title: 'Subiendo...',
        text: 'Por favor espera',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        // 2. Save Reference in Firestore (Subcollection)
        await db.collection('clients').doc(clientId).collection('attachments').add({
            name: file.name,
            type: file.type,
            size: file.size,
            url: downloadURL,
            createdAt: new Date(),
            createdBy: auth.currentUser.uid
        });

        Swal.fire('Completado', 'Archivo subido correctamente', 'success');
        input.value = ''; // Reset input

    } catch(err) {
        console.error("Upload error", err);
        Swal.fire('Error', 'No se pudo subir el archivo: ' + err.message, 'error');
    }
}

async function deleteAttachment(docId, fileName) {
    const confirm = await Swal.fire({
        title: '¿Seguro?',
        text: "Se eliminará el archivo permanentemente",
        icon: 'warning',
        showCancelButton: true
    });
    if(!confirm.isConfirmed) return;

    try {
        Swal.showLoading();
        
        // 1. Delete from Storage
        if(window.Imala.storage) {
            const fileRef = window.Imala.storage.ref().child(`clients/${clientId}/${fileName}`);
            await fileRef.delete().catch(e => console.warn("File not found in storage, deleting doc only", e));
        }

        // 2. Delete from Firestore
        await db.collection('clients').doc(clientId).collection('attachments').doc(docId).delete();

        Swal.fire('Eliminado', 'Archivo eliminado.', 'success');
    } catch(err) {
        console.error(err);
        Swal.fire('Error', 'Error al eliminar: ' + err.message, 'error');
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
