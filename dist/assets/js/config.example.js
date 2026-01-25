// Imala OS - Example Configuration
// Rename this file to config.js and fill in your values
// Do not commit config.js to public repositories

window.ImalaConfig = {
    firebase: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT.firebasestorage.app",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID"
    },
    googleCalendar: {
        clientId: 'YOUR_GCAL_CLIENT_ID',
        apiKey: 'YOUR_GCAL_API_KEY',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scopes: 'https://www.googleapis.com/auth/calendar'
    }
};
