// Imalá OS - Main Entry Point

console.log("🚀 Imalá OS: Core System Loading...");

document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication State
    if (window.Imala && window.Imala.auth) {
        window.Imala.auth.onAuthStateChanged(user => {
            if (user) {
                console.log("👤 User Logged In:", user.email);
                loadUserProfile(user);
            } else {
                console.log("👤 No User Logged In");
                // Redirect to login if not on auth pages
                const path = window.location.pathname;
                if (!path.includes('auth-login') && !path.includes('auth-register') && !path.includes('auth-recoverpw')) {
                     window.location.href = 'auth-login.html'; 
                }
            }
        });
    }

    // Handle Logout everywhere
    const logoutBtns = document.querySelectorAll('[href="auth-logout.html"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.Imala.auth.signOut().then(() => {
                window.location.href = 'auth-login.html';
            });
        });
    });
});

function loadUserProfile(user) {
    // Basic Info from Auth
    const nameDisplay = document.getElementById('dashboard-user-name');
    const headerNameDisplay = document.getElementById('header-user-name');
    const roleDisplay = document.getElementById('dashboard-user-role');
    const avatarDisplay = document.getElementById('dashboard-user-avatar');
    const headerAvatarDisplay = document.getElementById('header-user-avatar');

    if (nameDisplay) nameDisplay.textContent = user.displayName || user.email;
    if (headerNameDisplay) headerNameDisplay.textContent = user.displayName || "Usuario";
    
    // Fetch Extended Profile from Firestore
    window.Imala.db.collection('users').doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            console.log("📄 Profile Data:", data);
            
            if (roleDisplay) roleDisplay.textContent = data.role || 'Miembro';
            
            // Update Name if Firestore has it and Auth doesn't
            if (!user.displayName && data.displayName) {
                 if (nameDisplay) nameDisplay.textContent = data.displayName;
                 if (headerNameDisplay) headerNameDisplay.textContent = data.displayName;
            }

            // Update Avatar if available
            if (data.photoURL) {
                if (avatarDisplay) avatarDisplay.src = data.photoURL;
                if (headerAvatarDisplay) headerAvatarDisplay.src = data.photoURL;
            }
        } else {
            console.log("⚠️ No Profile Doc found for user");
        }
    }).catch((error) => {
        console.error("Error fetching profile:", error);
    });
}
