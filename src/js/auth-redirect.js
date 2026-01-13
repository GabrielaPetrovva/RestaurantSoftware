// src/js/auth-redirect.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const OWNER_EMAILS = [
  "vencimkolev@gmail.com",
  "manager2@gmail.com"
];

const norm = (x) => String(x ?? "").trim().toLowerCase();

function isLoginPage() {
  // работи и за /src/Login/login.html
  const p = window.location.pathname.toLowerCase();
  return p.includes("/login/") || p.endsWith("/login.html");
}

function fromHere(relFromSrc) {
  const p = window.location.pathname;
  const lower = p.toLowerCase();
  const idx = lower.lastIndexOf("/src/");
  if (idx === -1) return relFromSrc;

  const after = p.slice(idx + 5);
  const parts = after.split("/").filter(Boolean);
  const up = Math.max(0, parts.length - 1);
  return "../".repeat(up) + relFromSrc;
}

const PATHS = {
  login: () => fromHere("Login/login.html"),
  waiting: () => fromHere("Login/waiting-approval.html"),
  manager: () => fromHere("ManagerDashboard/index.html"),
  waiter: () => fromHere("WaiterDashboard/index.html"),
  kitchen: () => fromHere("KitchenSoftware/index.html"),
  bar: () => fromHere("BarDashboard/index.html"),
};

function routeByRole(role) {
  const r = norm(role);
  if (r === "manager") return PATHS.manager();
  if (r === "waiter") return PATHS.waiter();
  if (r === "kitchen" || r === "cook") return PATHS.kitchen();
  if (r === "bar") return PATHS.bar();
  return PATHS.waiting();
}

function isOn(part) {
  return window.location.pathname.toLowerCase().includes(part.toLowerCase());
}

async function ensureEmployeeDoc(user) {
  const uid = user.uid;
  const ref = doc(db, "employees", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return snap.data();

  const isOwner = OWNER_EMAILS.includes(norm(user.email));
  const payload = {
    firstName: "",
    lastName: "",
    email: user.email || "",
    role: isOwner ? "manager" : null,
    status: isOwner ? "active" : "pending",
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
  const snap2 = await getDoc(ref);
  return snap2.exists() ? snap2.data() : null;
}

export function startAuthRedirectGuard() {
  onAuthStateChanged(auth, async (user) => {
    try {
      // ⛔ Login страницата НЕ се пипа
      if (isLoginPage()) return;

      if (!user) {
        window.location.replace(PATHS.login());
        return;
      }

      const emp = await ensureEmployeeDoc(user);
      if (!emp) {
        alert("❌ Няма employees профил.");
        window.location.replace(PATHS.login());
        return;
      }

      const status = norm(emp.status);
      const role = norm(emp.role);

      // waiting-approval е позволена за pending
      if (status !== "active") {
        if (!isOn("waiting-approval")) {
          window.location.replace(PATHS.waiting());
        }
        return;
      }

      // Ако вече си в правилния dashboard — не пипай
      const want = routeByRole(role);
      const current = window.location.pathname;

      // ако текущата страница е точно dashboard-а (или поне частта му), не redirect-ваме
      if (
        (role === "manager" && isOn("managerdashboard")) ||
        (role === "waiter" && isOn("waiterdashboard")) ||
        ((role === "kitchen" || role === "cook") && isOn("kitchensoftware")) ||
        (role === "bar" && isOn("bardashboard"))
      ) return;

      window.location.replace(want);
    } catch (err) {
      console.error("auth-redirect error:", err);
      alert("❌ Auth guard error: " + (err?.message || err));
    }
  });
}
