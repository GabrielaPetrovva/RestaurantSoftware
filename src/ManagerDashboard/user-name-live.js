// user-name-live.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function pickNameEl() {
  return document.getElementById("userFullName") || document.querySelector(".user-name");
}

onAuthStateChanged(auth, async (user) => {
  const el = pickNameEl();
  if (!user || !el) return;

  try {
    const snap = await getDoc(doc(db, "employees", user.uid));
    if (!snap.exists()) {
      el.textContent = user.email || "User";
      return;
    }

    const data = snap.data();
    const first = String(data.firstName ?? "").trim();
    const last  = String(data.lastName ?? "").trim();

    el.textContent = (first || last) ? `${first} ${last}`.trim() : (user.email || "User");
  } catch (e) {
    console.error("user-name-live error:", e);
    el.textContent = user.email || "User";
  }
});
/* ================= END ================= */