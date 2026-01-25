// Imala OS - Register Logic

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.querySelector('form');
    const emailInput = document.getElementById('useremail');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('userpassword');
    const googleBtn = document.getElementById('btn-google-signup');

    const inviteCodeInput = document.getElementById('inviteCode');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            const username = usernameInput.value;
            const code = inviteCodeInput.value.trim().toUpperCase();

            if(!email || !password || !username || !code) {
                alert("Por favor completa todos los campos, incluido el código de invitación.");
                return;
            }

            // 1. Validate Invitation Code First
            try {
                const codesSnapshot = await window.Imala.db.collection('invitationCodes')
                    .where('code', '==', code)
                    .get();

                if (codesSnapshot.empty) {
                    alert("El código de invitación no existe.");
                    return;
                }

                const codeDoc = codesSnapshot.docs[0];
                const codeData = codeDoc.data();

                if (!codeData.isActive) {
                    alert("Este código de invitación ha sido desactivado.");
                    return;
                }

                if (codeData.usedCount >= codeData.maxUses) {
                    alert("Este código de invitación ya ha alcanzado su límite de usos.");
                    return;
                }

                // 2. Create Auth User
                const userCredential = await window.Imala.auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 3. Update Profile
                await user.updateProfile({ displayName: username });

                // 4. Create User Doc with Role from Code
                // Override role if it's the master admin email, otherwise use code type
                const finalRole = email === 'contacto@imala.com.ar' ? 'ADMIN' : (codeData.type || 'MEMBER');

                await window.Imala.db.collection('users').doc(user.uid).set({
                    email: email,
                    displayName: username,
                    role: finalRole,
                    createdAt: new Date(),
                    officeId: null,
                    invitedByCode: code
                });

                // 5. Increment Code Usage
                await window.Imala.db.collection('invitationCodes').doc(codeDoc.id).update({
                    usedCount: firebase.firestore.FieldValue.increment(1)
                });

                alert('Cuenta creada exitosamente. Redirigiendo...');
                window.location.href = 'index.html';

            } catch (error) {
                console.error("Error during registration:", error);
                alert("Error durante el registro: " + error.message);
                
                // Optional: If Auth User was created but DB failed, typically you'd want to rollback (delete user),
                // but for this MVP simplicity we leave it. A retry might work if user exists.
            }
        });
    }
    
    // Reuse Google Logic from Login if needed, or import shared utility
    if (googleBtn) {
         googleBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            // 1. Check if Code is present and valid in DB *before* Popup
            const inviteCodeInput = document.getElementById('inviteCode');
            const code = inviteCodeInput ? inviteCodeInput.value.trim().toUpperCase() : '';

            if(!code) {
                alert("Debes ingresar un código de invitación v\u00E1lido antes de continuar con Google.");
                return;
            }

            try {
                // Validate Code
                const codesSnapshot = await window.Imala.db.collection('invitationCodes')
                    .where('code', '==', code)
                    .get();

                if (codesSnapshot.empty) {
                    alert("El código de invitación no existe.");
                    return;
                }

                const codeDoc = codesSnapshot.docs[0];
                const codeData = codeDoc.data();

                if (!codeData.isActive) {
                    alert("Este código de invitación ha sido desactivado.");
                    return;
                }

                if (codeData.usedCount >= codeData.maxUses) {
                    alert("Este código de invitación ya ha alcanzado su límite de usos.");
                    return;
                }

                // 2. Proceed to Google Auth
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await window.Imala.auth.signInWithPopup(provider);
                
                // 3. Check if user exists or is new
                const userRef = window.Imala.db.collection('users').doc(result.user.uid);
                const doc = await userRef.get();

                if (!doc.exists) {
                    // New User: Create with Code Role
                    const email = result.user.email;
                    // Override role if admin email
                    const finalRole = email === 'contacto@imala.com.ar' ? 'ADMIN' : (codeData.type || 'MEMBER');

                    await userRef.set({
                        email: email,
                        displayName: result.user.displayName,
                        photoURL: result.user.photoURL,
                        role: finalRole,
                        createdAt: new Date(),
                        officeId: null,
                        invitedByCode: code
                    });

                    // Increment Code Usage
                    await window.Imala.db.collection('invitationCodes').doc(codeDoc.id).update({
                        usedCount: firebase.firestore.FieldValue.increment(1)
                    });
                } else {
                    // Existing User: Just login, ignore code (or maybe alert them?)
                    console.log("User already exists, code not consumed.");
                }

                window.location.href = 'index.html';

            } catch (error) {
                console.error("Error with Google Sign Up:", error);
                alert("Error: " + error.message);
            }
        });
    }
});
