import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBE5Lv5HfSw8FmhFx3n44gKxQC7XbibY28",
  authDomain: "reustarant-software.firebaseapp.com",
  projectId: "reustarant-software",
  storageBucket: "reustarant-software.firebasestorage.app",
  messagingSenderId: "910706453590",
  appId: "1:910706453590:web:f952cc3f40f7bef2009ff7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

window.db = db; // ✅ за Console

