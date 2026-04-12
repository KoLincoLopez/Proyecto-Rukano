
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA8pj-W-4QdQnZN_dLdA4h6H_EuNPz1G3s",
  authDomain: "rukano-sph.firebaseapp.com",
  projectId: "rukano-sph",
  storageBucket: "rukano-sph.firebasestorage.app",
  messagingSenderId: "435102787677",
  appId: "1:435102787677:web:f0f6303d4479985bdcc5b4",
  measurementId: "G-GSHTT9TB42"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios 
export const db = getFirestore(app);
export const auth = getAuth(app);