// Imalá OS - Firebase Configuration
// WARNING: Do not expose these keys in a public repository

const firebaseConfig = {
  apiKey: "AIzaSyDBf6gRyjGcmhjSzQjfSRK3iny2Qz2Stdk",
  authDomain: "imala-os.firebaseapp.com",
  projectId: "imala-os",
  storageBucket: "imala-os.firebasestorage.app",
  messagingSenderId: "867131157710",
  appId: "1:867131157710:web:db634d17c3230694da349f"
};

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
        storage = firebase.storage();
        functions = firebase.functions();
        
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
