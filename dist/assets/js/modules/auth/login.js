// Imala OS - Login Logic

document.addEventListener('DOMContentLoaded', () => {
    console.log("Login script loaded");
    const loginForm = document.querySelector('form'); 
    const emailInput = document.getElementById('email') || document.querySelector('input[type="text"]'); 
    const passwordInput = document.querySelector('input[type="password"]');
    const googleBtn = document.getElementById('btn-google-login') || document.querySelector('.mdi-google').closest('a');

    // Fix Template IDs if necessary to match standard
    if (document.getElementById('username')) {
        document.getElementById('username').id = 'email';
        document.getElementById('email').type = 'email';
        document.getElementById('email').placeholder = 'Enter email';
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = passwordInput.value;
            
            if(!email || !password) return;

            // Show loading state (optional)

            window.Imala.auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Signed in
                    console.log("Logged in:", userCredential.user);
                    window.location.href = 'index.html';
                })
                .catch((error) => {
                    console.error(error);
                    alert("Error: " + error.message);
                });
        });
    }

    if (googleBtn) {
        googleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Google Login Clicked");

            if (!window.Imala || !window.Imala.auth) {
                alert("Error Crítico: Firebase no se ha iniciado. Revisa tu conexión o la consola.");
                console.error("window.Imala is missing:", window.Imala);
                return;
            }

            const provider = new firebase.auth.GoogleAuthProvider();
            window.Imala.auth.signInWithPopup(provider)
                .then((result) => {
                    console.log("Google Sign In:", result.user);
                    // Check if user exists in Firestore 'users' collection, if not create it
                    checkAndCreateUser(result.user);
                }).catch((error) => {
                    console.error("Login Error:", error);
                    alert("Google Sign In Error: " + error.message);
                });
        });
    }
});

function checkAndCreateUser(user) {
    const userRef = window.Imala.db.collection('users').doc(user.uid);
    userRef.get().then((doc) => {
        if (doc.exists) {
            window.location.href = 'index.html';
        } else {
            // New User via Google - Create basic profile
            userRef.set({
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: 'MEMBER', // Default role
                createdAt: new Date(),
                officeId: null
            }).then(() => {
                window.location.href = 'index.html';
            });
        }
    });
}
