// src/Login/login.js
import { auth, db } from "../js/firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ================= CONFIG ================= */
const OWNER_EMAILS = [
  "vencimkolev@gmail.com",
  "manager2@gmail.com"
];

const norm = (x) => String(x ?? "").trim().toLowerCase();
const isOwnerEmail = (email) => OWNER_EMAILS.includes(norm(email));

function routeByRole(role) {
  const r = norm(role);
  if (r === "manager") return "../ManagerDashboard/index.html";
  if (r === "waiter") return "../WaiterDashboard/index.html";
  if (r === "kitchen" || r === "cook") return "../KitchenSoftware/index.html";
  if (r === "bar") return "../BarDashboard/index.html";
  return "./waiting-approval.html";
}

async function getEmployee(uid) {
  const snap = await getDoc(doc(db, "employees", uid));
  return snap.exists() ? snap.data() : null;
}

/* ================= AUTH UI ONLY ================= */
// Само UI (бутон logout да се вижда ако има user). НИКАКВИ redirect-и тук.
onAuthStateChanged(auth, (user) => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.style.display = user ? "inline-flex" : "none";
});

/* ================= UI HELPERS ================= */
window.toggleTheme = function () {
  const body = document.body;
  const icon = document.getElementById("theme-icon");
  if (!body || !icon) return;

  if (body.classList.contains("light")) {
    body.classList.replace("light", "dark");
    icon.textContent = "☀️";
  } else {
    body.classList.replace("dark", "light");
    icon.textContent = "🌙";
  }
};

window.switchTab = function (tab) {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  if (!loginForm || !signupForm) return;

  loginForm.classList.toggle("active", tab === "login");
  signupForm.classList.toggle("active", tab === "signup");

  document.querySelectorAll(".tab-button").forEach((b, i) => {
    b.classList.toggle("active",
      (tab === "login" && i === 0) || (tab === "signup" && i === 1)
    );
  });
};

/* ================= LOGIN ================= */
window.handleLogin = async function (event) {
  event.preventDefault();

  try {
    const email = document.getElementById("login-username")?.value?.trim() || "";
    const password = document.getElementById("login-password")?.value || "";
    if (!email || !password) return alert("Въведи имейл и парола.");

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const emp = await getEmployee(uid);
    if (!emp) return alert("Нямаш employees профил. Свържи се с мениджър.");

    if (norm(emp.status) !== "active") {
      window.location.href = "./waiting-approval.html";
      return;
    }

    window.location.href = routeByRole(emp.role);
  } catch (err) {
    console.error(err);
    alert("❌ Грешка при логин: " + (err?.message || err));
  }
};

/* ================= SIGN UP ================= */
window.handleSignup = async function (event) {
  event.preventDefault();

  try {
    const firstName = document.getElementById("signup-firstname")?.value?.trim() || "";
    const lastName  = document.getElementById("signup-lastname")?.value?.trim() || "";
    const email     = document.getElementById("signup-email")?.value?.trim() || "";
    const password  = document.getElementById("signup-password")?.value || "";

    if (!email || !password) return alert("Имейл и парола са задължителни.");

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const owner = isOwnerEmail(email);

    await setDoc(doc(db, "employees", uid), {
      firstName,
      lastName,
      email,
      role: owner ? "manager" : null,
      status: owner ? "active" : "pending",
      createdAt: serverTimestamp()
    }, { merge: true });

    window.location.href = owner
      ? "../ManagerDashboard/index.html"
      : "./waiting-approval.html";

  } catch (err) {
    console.error(err);
    alert("❌ Грешка при регистрация: " + (err?.message || err));
  }
};

/* ================= LOGOUT ================= */
window.forceLogout = async function () {
  try {
    await signOut(auth);
    alert("Излезе от акаунта.");
    // по желание: оставаш на login страницата (няма нужда от redirect)
  } catch (e) {
    console.error(e);
  }
};
