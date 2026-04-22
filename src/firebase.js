// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDB3Y5e25O17IXTnnCdFiuNzM4HcPTS8b4",
  authDomain: "farmplan-dashboard.firebaseapp.com",
  projectId: "farmplan-dashboard",
  storageBucket: "farmplan-dashboard.firebasestorage.app",
  messagingSenderId: "90636199901",
  appId: "1:90636199901:web:534d45722b36b29eb43834",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (The Database)
export const db = getFirestore(app);