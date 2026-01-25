// Imala OS - Register Logic

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.querySelector('form');
    const emailInput = document.getElementById('useremail');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('userpassword');
    const googleBtn = document.querySelector('.mdi-google').closest('a');

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            const username = usernameInput.value;

            if(!email || !password || !username) return;

            window.Imala.auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Created
                    const user = userCredential.user;
                    
                    // Update Profile
                    user.updateProfile({
                        displayName: username
                    });

                    // Create User Doc in Firestore
                    const role = email === 'contacto@imala.com.ar' ? 'ADMIN' : 'MEMBER';

                    window.Imala.db.collection('users').doc(user.uid).set({
                        email: email,
                        displayName: username,
                        role: role,
                        createdAt: new Date(),
                        officeId: null
                    }).then(() => {
                         window.location.href = 'index.html';
                    });

                })
                .catch((error) => {
                    console.error(error);
                    alert("Error: " + error.message);
                });
        });
    }
    
    // Reuse Google Logic from Login if needed, or import shared utility
    if (googleBtn) {
         googleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const provider = new firebase.auth.GoogleAuthProvider();
            window.Imala.auth.signInWithPopup(provider)
                .then((result) => {
                     // Same logic as login check
                     const userRef = window.Imala.db.collection('users').doc(result.user.uid);
                     userRef.get().then((doc) => {
                        if (!doc.exists) {
                            const email = result.user.email;
                            const role = email === 'contacto@imala.com.ar' ? 'ADMIN' : 'MEMBER';

                            userRef.set({
                                email: email,
                                displayName: result.user.displayName,
                                photoURL: result.user.photoURL,
                                role: role,
                                createdAt: new Date(),
                                officeId: null
                            });
                        }
                        window.location.href = 'index.html';
                     });
                }).catch((error) => {
                    alert("Error: " + error.message);
                });
        });
    }
});
