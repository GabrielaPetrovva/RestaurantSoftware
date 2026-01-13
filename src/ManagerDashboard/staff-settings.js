import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, doc, getDoc, onSnapshot,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ================= DOM ================= */
const totalEl  = document.getElementById("staffTotalCount");
const listEl   = document.getElementById("staffList");
const searchEl = document.getElementById("staffSearch");
const errEl    = document.getElementById("staffError");

// modal
const modalEl = document.getElementById("staffEditorModal");
const modalTitleEl = document.getElementById("staffModalTitle");
const editIdEl = document.getElementById("staffEditId");
const editRoleEl = document.getElementById("staffEditRole");
const editActiveEl = document.getElementById("staffEditActive");
const saveBtn = document.getElementById("staffSaveBtn");
const cancelBtn = document.getElementById("staffCancelBtn");

let staff = [];
let search = "";
let editingId = null;

/* ================= helpers ================= */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function setErr(msg) {
  console.error(msg);
  if (errEl) errEl.textContent = msg;
}
function clearErr() {
  if (errEl) errEl.textContent = "";
}
function fullName(e) {
  const fn = (e.firstName ?? "").trim();
  const ln = (e.lastName ?? "").trim();
  const n = `${fn} ${ln}`.trim();
  return n || "—";
}
function isActive(e) {
  // status: "active" / "inactive"
  return String(e.status ?? "active") === "active";
}

/* ================= modal ================= */
function openModal(title = "Редакция") {
  if (modalTitleEl) modalTitleEl.textContent = title;
  modalEl.style.display = "block";
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modalEl.style.display = "none";
  document.body.style.overflow = "";
}
modalEl?.addEventListener("click", (e) => {
  if (e.target && e.target.hasAttribute("data-close-modal")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalEl?.style.display === "block") closeModal();
});
cancelBtn?.addEventListener("click", () => closeModal());

/* ================= auth guard (manager only) ================= */
let started = false;

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) return;

    const empSnap = await getDoc(doc(db, "employees", user.uid));
    if (!empSnap.exists()) {
      setErr("Няма employees документ за този акаунт.");
      return;
    }

    const me = empSnap.data();
    if (me.status !== "active" || me.role !== "manager") {
      setErr(`Нямаш права. status=${me.status}, role=${me.role}`);
      return;
    }

    clearErr();
    if (started) return;
    started = true;

    wireSearch();
    listenEmployees();
    wireActions();
  } catch (err) {
    setErr("Грешка: " + err.message);
  }
});

/* ================= search ================= */
function wireSearch() {
  searchEl?.addEventListener("input", () => {
    search = (searchEl.value || "").trim().toLowerCase();
    render();
  });
}

/* ================= listener ================= */
function listenEmployees() {
  onSnapshot(collection(db, "employees"), (snap) => {
    staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (totalEl) totalEl.textContent = String(staff.length);
    render();
  }, (err) => setErr("employees listener: " + err.message));
}

/* ================= render ================= */
function render() {
  if (!listEl) return;

  const filtered = staff.filter(e => {
    if (!search) return true;
    const hay = `${e.id} ${fullName(e)} ${(e.email ?? "")} ${(e.role ?? "")} ${(e.status ?? "")}`.toLowerCase();
    return hay.includes(search);
  });

  ensureCss();

  if (!filtered.length) {
    listEl.innerHTML = `<div style="opacity:.7;padding:10px;">Няма резултат.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(e => {
    const active = isActive(e);
    const badge = active
      ? `<span class="st-badge st-active">active</span>`
      : `<span class="st-badge st-inactive">inactive</span>`;

    return `
      <div class="st-row" data-id="${esc(e.id)}">
        <div class="st-id">${esc(e.id)}</div>

        <div class="st-main">
          <div class="st-name">${esc(fullName(e))}</div>
          <div class="st-sub">${esc(e.email ?? "—")}</div>
        </div>

        <div class="st-role">${esc(e.role ?? "—")}</div>

        <div class="st-status">${badge}</div>

        <div class="st-actions">
          <button type="button" class="btn btn-secondary" data-action="edit">Edit</button>
          <button type="button" class="btn btn-secondary" data-action="toggle">
            ${active ? "Deactivate" : "Activate"}
          </button>
          <button type="button" class="btn btn-secondary st-danger" data-action="delete">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

/* ================= actions ================= */
function wireActions() {
  // delegation for row buttons
  listEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const row = btn.closest(".st-row");
    const id = row?.dataset?.id;
    if (!id) return;

    const action = btn.dataset.action;

    if (action === "edit") {
      const emp = staff.find(x => x.id === id);
      if (!emp) return;

      editingId = id;
      editIdEl.textContent = id;
      editRoleEl.value = (emp.role === "bar" || emp.role === "cook" || emp.role === "waiter") ? emp.role : "waiter";
      editActiveEl.checked = isActive(emp);

      openModal("Редакция на служител");
      return;
    }

    if (action === "toggle") {
      const emp = staff.find(x => x.id === id);
      if (!emp) return;

      const nextStatus = isActive(emp) ? "inactive" : "active";
      await updateDoc(doc(db, "employees", id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
      return;
    }

    if (action === "delete") {
      if (!confirm("Сигурен ли си, че триеш този служител?")) return;
      await deleteDoc(doc(db, "employees", id));
      return;
    }
  });

  // save from modal
  saveBtn?.addEventListener("click", async () => {
    if (!editingId) return;

    try {
      clearErr();

      const role = editRoleEl.value;
      const status = editActiveEl.checked ? "active" : "inactive";

      await updateDoc(doc(db, "employees", editingId), {
        role,
        status,
        updatedAt: serverTimestamp()
      });

      closeModal();
      editingId = null;
    } catch (err) {
      setErr("Save error: " + err.message);
    }
  });
}

/* ================= CSS injected once ================= */
function ensureCss() {
  if (document.getElementById("staffCssInjected")) return;
  const style = document.createElement("style");
  style.id = "staffCssInjected";
  style.textContent = `
    .st-row{
      display:grid;
      grid-template-columns: 220px 1fr 120px 110px 260px;
      gap:12px;
      align-items:center;
      padding:12px;
      border:1px solid #eee;
      border-radius:12px;
      margin-bottom:10px;
      background:#fff;
    }
    .st-id{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:12px; opacity:.85; overflow:hidden; text-overflow:ellipsis; }
    .st-main{ min-width:0; }
    .st-name{ font-weight:700; }
    .st-sub{ font-size:12px; opacity:.75; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .st-role{ font-weight:700; text-transform:lowercase; }
    .st-actions{ display:flex; gap:8px; justify-content:flex-end; }
    .st-danger{ background:#ffecec !important; color:#c00 !important; }
    .st-badge{
      font-weight:700;
      font-size:12px;
      padding:3px 10px;
      border-radius:999px;
      border:1px solid #ddd;
      display:inline-block;
      text-align:center;
      min-width:86px;
    }
    .st-active{ border-color:#cfe9d1; background:#eef9f0; color:#1b7a2a; }
    .st-inactive{ border-color:#ffd5d5; background:#fff1f1; color:#b30000; }

    @media (max-width: 980px){
      .st-row{ grid-template-columns: 1fr; }
      .st-actions{ justify-content:flex-start; flex-wrap:wrap; }
      .st-sub{ white-space:normal; }
    }
  `;
  document.head.appendChild(style);
}
/* ===================== END STAFF SETTINGS ===================== */

// Expose function to fill form for editing
window.fillEditForm = fillEditForm;