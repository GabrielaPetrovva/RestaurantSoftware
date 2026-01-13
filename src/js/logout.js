// src/js/logout.js
import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

window.logout = async function () {
  try {
    await signOut(auth);
    window.location.href = "../Login/login.html";
  } catch (err) {
    console.error("Logout error:", err);
    alert("Грешка при излизане от акаунта.");
  }
};
