// bar-name-live.js – same logic as Manager user-name-live.js and Kitchen kitchen-name-live.js
import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function pickNameEl() {
  return document.getElementById("barUserName") || document.getElementById("userName") || document.querySelector(".user-name");
}

onAuthStateChanged(auth, async (user) => {
  const nameEl = pickNameEl();
  if (!user) {
    if (typeof window !== "undefined") window.__barEmail = null;
    return;
  }
  if (typeof window !== "undefined") window.__barEmail = user.email || null;
  if (!nameEl) return;

  try {
    const snap = await getDoc(doc(db, "employees", user.uid));
    if (!snap.exists()) {
      nameEl.textContent = user.email || "User";
      return;
    }

    const data = snap.data();
    const first = String(data.firstName ?? "").trim();
    const last = String(data.lastName ?? "").trim();

    nameEl.textContent = (first || last) ? `${first} ${last}`.trim() : (user.email || "User");
  } catch (e) {
    console.error("bar-name-live error:", e);
    nameEl.textContent = user.email || "User";
  }
});
