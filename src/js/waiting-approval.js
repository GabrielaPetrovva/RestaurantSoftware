import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const norm = (x) => String(x ?? "").trim().toLowerCase();

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

function routeByRole(role) {
  const r = norm(role);
  if (r === "manager") return fromHere("ManagerDashboard/index.html");
  if (r === "waiter") return fromHere("WaiterDashboard/index.html");
  if (r === "cook") return fromHere("KitchenSoftware/index.html");
  if (r === "bar") return fromHere("BarDashboard/index.html");
  return fromHere("Login/waiting-approval.html");
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = fromHere("Login/login.html");
    return;
  }

  // ако имаш елемент за имейл — ще го напълни (по желание)
  setText("whoami", user.email || "");

  const ref = doc(db, "employees", user.uid);
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;

    const emp = snap.data();
    const status = norm(emp.status);
    const role = norm(emp.role);

    if (status === "active") {
      window.location.href = routeByRole(role);
    }
  }, (err) => {
    console.error(err);
    alert("❌ Firestore права: " + err.message);
  });
});
