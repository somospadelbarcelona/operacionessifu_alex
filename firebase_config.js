// Configuración de Firebase para SIFU Girona Hub
// Para habilitar el guardado en internet, crea un proyecto en Firebase (https://console.firebase.google.com/),
// activa Firestore Database en modo producción o prueba, y sustituye los valores de abajo
// con las credenciales de tu proyecto.

const firebaseConfig = {
  apiKey: "EJEMPLO_API_KEY_REMPLAZAR",
  authDomain: "sifu-girona-hub.firebaseapp.com",
  projectId: "sifu-girona-hub",
  storageBucket: "sifu-girona-hub.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Control de modo de funcionamiento de la aplicación
// Pon esto en 'true' una vez que hayas sustituido las credenciales de arriba por las tuyas.
const ENABLE_FIREBASE = false; 
