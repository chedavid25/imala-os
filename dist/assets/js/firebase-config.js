// Imalá OS - Firebase Configuration
// WARNING: Do not expose these keys in a public repository

// Load from window.ImalaConfig (defined in config.js)
const firebaseConfig = window.ImalaConfig ? window.ImalaConfig.firebase : {
    // Fallback or Error
    apiKey: "MISSING_CONFIG",
    authDomain: "MISSING.firebaseapp.com",
    projectId: "missing",
    storageBucket: "missing.firebasestorage.app",
    messagingSenderId: "0000000000",
    appId: "1:0000000000:web:00000000000000"
};

if(firebaseConfig.apiKey === "MISSING_CONFIG") {
    console.error("CRITICAL: C:\Users\David Pc\OneDrive\Escritorio\Imalá OS\dist\assets\js\config.js not loaded or missing keys.");
}

// Initialize Firebase Global Instances
// This script assumes that the Firebase SDK scripts (app, auth, firestore, etc.) 
// are loaded BEFORE this file in the HTML.

let app, auth, db, storage, functions;

try {
    // Check for global firebase object (from CDN scripts)
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Optional services (check availability)
        if (firebase.storage) {
            storage = firebase.storage();
        } else {
            console.warn("⚠️ Firebase Storage SDK not loaded.");
        }

        if (firebase.functions) {
            functions = firebase.functions();
        } else {
             console.warn("⚠️ Firebase Functions SDK not loaded.");
        }
        
        console.log("✅ Imalá OS: Firebase initialized successfully");
    } 
    // Check for modular syntax (if we switch to modules later)
    else {
        console.error("⚠️ Firebase Global Object not found. Ensure CDN scripts are loaded.");
        alert("Error Fatal: No se pudo cargar Firebase desde Google Servers. Revisa tu internet o si tienes un bloqueador de anuncios.");
    }
} catch (error) {
    console.error("❌ Error initializing Firebase:", error);
    alert("Error al inicializar Firebase: " + error.message);
}

// Global helper to access services easily in console or other scripts
window.Imala = {
    app,
    auth,
    db,
    storage,
    functions
};
