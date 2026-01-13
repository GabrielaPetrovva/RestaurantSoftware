// approve.js (10.12.4) — approve pending employees with chosen role

import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ===== helpers ===== */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function pickListEl() {
  return (
    document.getElementById("approveList") ||
    document.getElementById("pendingList") ||
    document.getElementById("pendingEmployees") ||
    document.getElementById("approvalList") ||
    document.querySelector("[data-approve-list]") ||
    null
  );
}

function fullName(d) {
  const f = String(d.firstName ?? "").trim();
  const l = String(d.lastName ?? "").trim();
  const n = `${f} ${l}`.trim();
  return n || String(d.name ?? "").trim() || "Без име";
}

async function getMyEmp(uid) {
  const snap = await getDoc(doc(db, "employees", uid));
  return snap.exists() ? snap.data() : null;
}

/* ===== roles you allow ===== */
const ROLE_OPTIONS = [
  { value: "waiter", label: "Сервитьор" },
  { value: "bar", label: "Барман" },
  { value: "kitchen", label: "Готвач" },
  // ако искаш да можеш и мениджър да правиш:
  // { value: "manager", label: "Мениджър" },
];

/* ===== UI render ===== */
function render(list) {
  const listEl = pickListEl();
  if (!listEl) {
    console.warn("approve.js: няма контейнер за листата (#approveList).");
    return;
  }

  if (!list.length) {
    listEl.innerHTML = `<div style="opacity:.7;">Няма чакащи за одобрение.</div>`;
    return;
  }

  listEl.innerHTML = list.map(u => {
    const name = fullName(u);
    const email = u.email ?? "";
    const uid = u.uid;
    const currentRole = u.role ?? "employee";

    const roleSelect = `
      <select data-role="${esc(uid)}" class="form-control" style="max-width:180px;">
        ${ROLE_OPTIONS.map(r => `
          <option value="${esc(r.value)}"${r.value === currentRole ? " selected" : ""}>
            ${esc(r.label)}
          </option>
        `).join("")}
      </select>
    `;

    return `
      <div style="display:flex;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid #eee;">
        <div style="flex:1;min-width:260px">
          <b>${esc(name)}</b>
          <div style="font-size:12px;opacity:.8">
            ${esc(email)} • status: <b>${esc(u.status)}</b>
          </div>
          <div style="font-size:12px;opacity:.65">uid: ${esc(uid)}</div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          ${roleSelect}
          <button type="button" class="btn btn-primary" data-approve="${esc(uid)}">Одобри</button>
          <button type="button" class="btn btn-secondary" data-reject="${esc(uid)}">Откажи</button>
        </div>
      </div>
    `;
  }).join("");

  // delegated click
  listEl.onclick = async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const approveUid = t.dataset.approve;
    const rejectUid = t.dataset.reject;

    try {
      if (approveUid) {
        const sel = listEl.querySelector(`select[data-role="${CSS.escape(approveUid)}"]`);
        const role = sel?.value || "waiter";

        t.disabled = true;
        t.textContent = "Одобрявам...";

        await updateDoc(doc(db, "employees", approveUid), {
          status: "active",
          role,                         // ✅ избрана роля
          approvedAt: serverTimestamp(),
          approvedBy: auth.currentUser?.uid || null
        });

        return;
      }

      if (rejectUid) {
        if (!confirm("Сигурен ли си, че отказваш този човек?")) return;

        t.disabled = true;
        t.textContent = "Отказвам...";

        await updateDoc(doc(db, "employees", rejectUid), {
          status: "rejected",
          rejectedAt: serverTimestamp(),
          rejectedBy: auth.currentUser?.uid || null
        });

        return;
      }
    } catch (err) {
      console.error(err);
      alert("Грешка: " + err.message);
      t.disabled = false;
      t.textContent = approveUid ? "Одобри" : "Откажи";
    }
  };
}

/* ===== main ===== */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const myEmp = await getMyEmp(user.uid);

    // ✅ само manager да може да одобрява
    if (!myEmp || myEmp.status !== "active" || myEmp.role !== "manager") {
      alert("❌ Нямаш права за одобрение.");
      return;
    }

    const q = query(collection(db, "employees"), where("status", "==", "pending"));

    onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      render(list);
    }, (err) => {
      console.error(err);
      alert("❌ Firestore грешка/правила: " + err.message);
    });

  } catch (err) {
    console.error("approve init error:", err);
    alert("approve.js грешка: " + err.message);
  }
});
/* ================= END ================= */