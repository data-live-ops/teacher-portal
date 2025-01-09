import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";


const firebaseConfig = {
    apiKey: "AIzaSyCsutqU60g4yy4rLkgZJ3AgopvQrT4xoLw",
    authDomain: "teacher-portal-d3240.firebaseapp.com",
    projectId: "teacher-portal-d3240",
    storageBucket: "teacher-portal-d3240.firebasestorage.app",
    messagingSenderId: "525373651239",
    appId: "1:525373651239:web:a8cdab364e6991e01a5102",
    measurementId: "G-7EG1ML1Q6V"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
