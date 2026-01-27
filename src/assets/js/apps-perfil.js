/**
 * Logic for apps-perfil.html
 * Handles User Profile management with Firebase Auth, Firestore and Storage.
 */

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    const form = document.getElementById('form-perfil');
    const avatarInput = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarDisplay = document.getElementById('profile-avatar-display');
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const phoneInput = document.getElementById('profile-phone');
    const roleInput = document.getElementById('profile-office');
    const fullNameDisplay = document.getElementById('profile-full-name');
    const emailDisplay = document.getElementById('profile-email-display');
    const btnSave = document.getElementById('btn-save-profile');

    let currentUser = null;
    let selectedFile = null;

    // 1. Initial Auth Check
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserProfile(user);
        } else {
            // User not logged in, redirect handled by imala-auth.js but adding here as safety
            window.location.href = 'auth-login.html';
        }
    });

    async function loadUserProfile(user) {
        // Load data from Auth
        emailInput.value = user.email || "";
        emailDisplay.textContent = user.email || "-";
        nameInput.value = user.displayName || "";
        fullNameDisplay.textContent = user.displayName || "Usuario";
        
        if (user.photoURL) {
            avatarPreview.src = user.photoURL;
            avatarDisplay.src = user.photoURL;
        }

        // Load additional data from Firestore
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                phoneInput.value = data.telefono || "";
                roleInput.value = data.rol || "Agente";
                
                const roleDisplay = document.getElementById('profile-role');
                if (roleDisplay) roleDisplay.textContent = data.rol || "Agente Inmobiliario";
            }
        } catch (error) {
            console.error("Error loading profile from Firestore:", error);
        }
    }

    // 2. Avatar Selection Previsualization
    if (avatarInput) {
        avatarInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                // Basic validation
                if (file.size > 2 * 1024 * 1024) {
                    Swal.fire('Error', 'La imagen es demasiado grande. Máximo 2MB.', 'error');
                    avatarInput.value = '';
                    return;
                }

                selectedFile = file;
                const reader = new FileReader();
                reader.onload = function(event) {
                    if (avatarPreview) avatarPreview.src = event.target.result;
                    // Note: We don't update avatarDisplay until save
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 3. Save Changes
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            if (!currentUser) return;

            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="bx bx-loader bx-spin font-size-16 align-middle me-2"></i> Guardando...';

            try {
                let photoURL = currentUser.photoURL;

                // 3.1. Upload Avatar if selected
                if (selectedFile) {
                    const storageRef = storage.ref(`avatars/${currentUser.uid}`);
                    const snapshot = await storageRef.put(selectedFile);
                    photoURL = await snapshot.ref.getDownloadURL();
                }

                // 3.2. Update Auth Profile
                await currentUser.updateProfile({
                    displayName: nameInput.value,
                    photoURL: photoURL
                });

                // 3.3. Update Firestore
                await db.collection('users').doc(currentUser.uid).set({
                    nombre: nameInput.value,
                    telefono: phoneInput.value,
                    avatarUrl: photoURL,
                    lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                // 3.4. Update UI local
                fullNameDisplay.textContent = nameInput.value;
                if (avatarDisplay) avatarDisplay.src = photoURL;
                
                // 3.5. Update Global Header (immediate visual feedback)
                const headerAvatar = document.getElementById('header-user-avatar');
                const headerName = document.getElementById('header-user-name');
                if(headerAvatar) headerAvatar.src = photoURL;
                if(headerName) headerName.textContent = nameInput.value;

                Swal.fire({
                    icon: 'success',
                    title: '¡Perfil Actualizado!',
                    text: 'Tus cambios han sido guardados correctamente.',
                    timer: 2000,
                    showConfirmButton: false
                });

            } catch (error) {
                console.error("Error updating profile:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo actualizar el perfil: ' + error.message
                });
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="bx bx-save me-1"></i> Guardar Cambios';
            }
        });
    }
});
