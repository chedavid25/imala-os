// imala-auth.js - Auth Helpers

(function() {
    // Ensure window.Imala exists (it should be created by firebase-config.js)
    if (!window.Imala) window.Imala = {};

    window.Imala.auth = window.Imala.auth || {};

    // Helper: Check Auth State & Redirect if needed
    window.Imala.auth.checkAuth = function(callback) {
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                // User is signed in.
                if(callback) callback(user);
            } else {
                // No user is signed in. Redirect to login.
                console.warn("User not signed in. Redirecting...");
                window.location.href = 'auth-login.html';
            }
        });
    };

    // Helper: Sign Out
    window.Imala.auth.signOut = function() {
        firebase.auth().signOut().then(() => {
            window.location.href = 'auth-login.html';
        }).catch((error) => {
            console.error("Sign Out Error", error);
        });
    };

    // Global Header Update
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            const headerAvatar = document.getElementById('header-user-avatar');
            const headerName = document.getElementById('header-user-name');
            
            if (headerAvatar && user.photoURL) {
                headerAvatar.src = user.photoURL;
            }
            if (headerName && user.displayName) {
                headerName.textContent = user.displayName;
            }
        }
    });

})();
