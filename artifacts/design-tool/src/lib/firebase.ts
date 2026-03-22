import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0jN9eWMVsdDz7NcEBqf891Mf902LBg-E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "roll-forming-tooling-eng.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "roll-forming-tooling-eng",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "roll-forming-tooling-eng.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "17300890949",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:17300890949:web:e3a6affa71bf66c002ca2c",
};

let app: FirebaseApp;
let auth: Auth;
let firebaseReady = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  firebaseReady = true;
} catch (e) {
  console.warn("Firebase initialization failed. Auth features will be unavailable.", e);
  app = {} as FirebaseApp;
  auth = {} as Auth;
}

export { firebaseReady };

export { auth };
export default app;
