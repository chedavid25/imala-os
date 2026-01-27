/**
 * Sidebar Menu Component
 * Unifica el menú de navegación para todas las páginas.
 * Se debe incluir antes de app.js para asegurar que MetisMenu funcione correctamente.
 */

(function() {
    const sidebarContainer = document.getElementById('sidebar-menu');
    if (!sidebarContainer) return;

    const currentPath = window.location.pathname.split("/").pop() || 'index.html';

    const menuHTML = `
        <ul class="metismenu list-unstyled" id="side-menu">
            <li class="menu-title" data-key="t-menu">Principal</li>
            <li>
                <a href="index.html">
                    <i data-feather="home"></i>
                    <span data-key="t-dashboard">Dashboard</span>
                </a>
            </li>
            <li class="menu-title" data-key="t-modules">Módulos</li>
            <li>
                <a href="apps-tareas.html">
                    <i data-feather="grid"></i>
                    <span data-key="t-tasks">Gestión Tareas</span>
                </a>
            </li>
            <li>
                <a href="apps-clients.html">
                    <i data-feather="users"></i>
                    <span data-key="t-clients">Gestión Clientes</span>
                </a>
            </li>
            <li>
                <a href="apps-cashflow.html">
                    <i data-feather="dollar-sign"></i>
                    <span data-key="t-cashflow">Cashflow</span>
                </a>
            </li>
             <li>
                <a href="apps-analytics.html">
                    <i data-feather="pie-chart"></i>
                    <span data-key="t-analytics">Gráficos de Gestión</span>
                </a>
            </li>
            
            <li class="menu-title" data-key="t-settings">Configuración</li>
            <li>
                <a href="javascript: void(0);" class="has-arrow">
                    <i data-feather="settings"></i>
                    <span data-key="t-settings">Mi Cuenta</span>
                </a>
                <ul class="sub-menu" aria-expanded="false">
                    <li><a href="apps-perfil.html" data-key="t-profile">Mi Perfil</a></li>
                    
                    <!-- Admin Link (Hidden by default) -->
                    <li id="admin-menu-link" style="display:none">
                        <a href="apps-config-members.html" data-key="t-admin-members">Admin. Miembros</a>
                    </li>

                    <li><a href="#" onclick="window.Imala.auth.signOut(); window.location.href='auth-login.html';" data-key="t-logout">Cerrar Sesión</a></li>
                </ul>
            </li>
        </ul>
    `;

    sidebarContainer.innerHTML = menuHTML;

    // Logic to set Active state based on URL (Simple version, App.js might overwrite or enhance this)
    // Actually app.js handles active state. We just inject HTML.
    
    // Logic for Admin Visibility
    // We need to wait for Firebase to initialize.
    // If window.Imala.auth is ready, we use it. If not, we wait.
    
    function checkAdminRole(user) {
        if(!user) return;
        
        // We need to fetch role from DB because Custom Claims might not be set or we want to rely on Firestore 'role' field
        const db = window.Imala.db; // Assumed initialized in firebase-config.js
        if(db) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if(doc.exists) {
                    const data = doc.data();
                    if(data.role === 'ADMIN' || data.role === 'BROKER') { // Allowing Broker too? User said "solo si tiene el rol de admin". Let's stick to ADMIN strictly if requested, or broader if safer. User said "rol de admin".
                         // However, in previous tasks we treated Broker as high priv. Let's stick to ADMIN as requested.
                         if(data.role === 'ADMIN') {
                             const adminLink = document.getElementById('admin-menu-link');
                             if(adminLink) adminLink.style.display = 'block';
                         }
                    }
                }
            }).catch(err => console.error("Error checking role for menu", err));
        }
    }

    // Attempt to hook into auth
    // We assume firebase-config.js runs before this and sets window.Imala
    const checkInterval = setInterval(() => {
        if(window.Imala && window.Imala.auth) {
            clearInterval(checkInterval);
            window.Imala.auth.onAuthStateChanged(user => {
                checkAdminRole(user);
            });
        }
    }, 100);

})();
