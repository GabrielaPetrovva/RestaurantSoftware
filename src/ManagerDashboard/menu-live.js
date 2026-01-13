// menu-live.js (FULL) — shows ALL items (active + inactive)
// - Count shows ONLY active items -> #menuTotalCount
// - Results show ONLY when you type in search
// - Stable GRID layout (never collapses)
// - Price/Cost on the right, buttons AFTER them (far right)
// - Toggle does NOT remove item from list (it stays, badge changes)
// - Emits events for manage-menu.js:
//    menu:edit, menu:toggle, menu:delete

import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const countEl = document.getElementById("menuTotalCount");
const listEl = document.getElementById("menuLiveList");
const catsEl = document.getElementById("menuLiveCategories");
const searchEl = document.getElementById("menuLiveSearch");

let cats = [];
let items = [];
let selectedCat = "all";
let search = "";

/* ================= LIVE LISTENERS ================= */
onSnapshot(
  collection(db, "menu_categories"),
  (snap) => {
    cats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCats();
    renderList();
  },
  (err) => console.error("menu_categories listener:", err)
);

onSnapshot(
  collection(db, "menus"),
  (snap) => {
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList();
  },
  (err) => console.error("menus listener:", err)
);

/* ================= UI EVENTS ================= */
searchEl?.addEventListener("input", () => {
  search = (searchEl.value || "").trim().toLowerCase();
  renderList();
});

catsEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cat]");
  if (!btn) return;
  selectedCat = btn.dataset.cat;
  renderCats();
  renderList();
});

// ✅ ACTION BUTTONS (delegation)
listEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (!id) return;

  if (action === "edit") {
    if (window.openMenuModal) window.openMenuModal("Редакция на артикул");
    window.dispatchEvent(new CustomEvent("menu:edit", { detail: { id } }));
    return;
  }

  if (action === "toggle") {
    window.dispatchEvent(new CustomEvent("menu:toggle", { detail: { id } }));
    return;
  }

  if (action === "delete") {
    window.dispatchEvent(new CustomEvent("menu:delete", { detail: { id } }));
    return;
  }
});

/* ================= RENDER ================= */
function renderCats() {
  if (!catsEl) return;

  const buttons = [{ id: "all", name: "Всички" }].concat(
    cats.map((c) => ({ id: c.id, name: c.name ?? c.id }))
  );

  catsEl.innerHTML = buttons
    .map(
      (b) => `
    <button type="button"
      data-cat="${esc(b.id)}"
      style="padding:8px 12px;margin:0 8px 8px 0;border-radius:10px;border:1px solid #ddd;
             background:${b.id === selectedCat ? "#111" : "#fff"};
             color:${b.id === selectedCat ? "#fff" : "#111"};
             cursor:pointer;">
      ${esc(b.name)}
    </button>
  `
    )
    .join("");
}

function renderList() {
  if (!listEl) return;

  // ✅ active count is only for KPI
  const activeCount = items.filter((i) => i.active !== false).length;
  if (countEl) countEl.textContent = String(activeCount);

  const hasSearch = search.length > 0;

  // show results ONLY when user searches (както го искаш)
  if (!hasSearch) {
    listEl.innerHTML = `
      <div style="opacity:.7;padding:10px;">
        Напиши в търсачката, за да провериш дали артикулът съществува.
      </div>
    `;
    return;
  }

  // ✅ show ALL items (active + inactive)
  let visible = items.slice();

  // category filter
  if (selectedCat !== "all") {
    visible = visible.filter((i) => String(i.category ?? "") === selectedCat);
  }

  // search filter
  visible = visible.filter((i) => {
    const hay = `${i.name ?? ""} ${i.description ?? ""} ${i.category ?? ""}`.toLowerCase();
    return hay.includes(search);
  });

  const catName = (catId) => cats.find((c) => c.id === catId)?.name ?? catId ?? "";
  const activeLabel = (i) => (i.active !== false ? "Deactivate" : "Activate");

  ensureMenuCss();

  listEl.innerHTML = visible.length
    ? visible
        .map((i) => {
          const img = i.image
            ? `<img class="ml-img" src="${esc(i.image)}" alt="">`
            : `<div class="ml-img ml-img-empty"></div>`;

          const status = i.active !== false ? "Active" : "Inactive";
          const statusClass = i.active !== false ? "ml-status-active" : "ml-status-inactive";

          return `
          <div class="ml-row" data-menu-id="${esc(i.id)}">
            ${img}

            <div class="ml-text">
              <div class="ml-title">${esc(i.name)}</div>
              ${i.description ? `<div class="ml-desc">${esc(i.description)}</div>` : ""}
              <div class="ml-meta">
                ${esc(catName(i.category))}
                <span class="ml-dot">•</span>
                <span class="ml-status ${statusClass}">${status}</span>
              </div>
            </div>

            <div class="ml-prices">
              <div class="ml-price">Цена: ${fmtMoney(i.price)} EUR</div>
              <div class="ml-cost">Cost: ${fmtMoneyOrDash(i.cost)} EUR</div>
            </div>

            <div class="ml-actions">
              <button type="button" class="btn btn-secondary" data-action="edit" data-id="${esc(i.id)}">Edit</button>
              <button type="button" class="btn btn-secondary" data-action="toggle" data-id="${esc(i.id)}">${activeLabel(i)}</button>
              <button type="button" class="btn btn-secondary ml-danger" data-action="delete" data-id="${esc(i.id)}">Delete</button>
            </div>
          </div>
        `;
        })
        .join("")
    : `
      <div style="opacity:.7;padding:10px;">
        Няма резултат за: <b>${esc(search)}</b>
      </div>
    `;
}

/* ================= CSS (injected once) ================= */
function ensureMenuCss() {
  if (document.getElementById("menuLiveCssInjected")) return;

  const style = document.createElement("style");
  style.id = "menuLiveCssInjected";
  style.textContent = `
    .ml-row{
      display:grid;
      grid-template-columns: 70px 1fr 170px 280px;
      gap:14px;
      align-items:center;
      padding:12px;
      border:1px solid #eee;
      border-radius:12px;
      margin-bottom:10px;
      background:#fff;
    }
    .ml-img{
      width:70px;height:70px;object-fit:cover;border-radius:10px;
    }
    .ml-img-empty{
      background:#f2f2f2;border:1px dashed #ddd;
    }
    .ml-text{ min-width:0; }
    .ml-title{ font-weight:700; }
    .ml-desc{ opacity:.75;font-size:13px;margin-top:3px; }
    .ml-meta{ opacity:.75;font-size:12px;margin-top:4px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .ml-dot{ opacity:.6; }

    .ml-status{
      font-weight:700;
      font-size:12px;
      padding:3px 8px;
      border-radius:999px;
      border:1px solid #ddd;
      background:#fafafa;
    }
    .ml-status-active{ border-color:#cfe9d1; background:#eef9f0; color:#1b7a2a; }
    .ml-status-inactive{ border-color:#ffd5d5; background:#fff1f1; color:#b30000; }

    .ml-prices{ text-align:right; white-space:nowrap; }
    .ml-price{ font-weight:700; }
    .ml-cost{ opacity:.75; }

    .ml-actions{
      display:flex;
      gap:8px;
      justify-content:flex-end;
      align-items:center;
      flex-wrap:nowrap;
    }
    .ml-danger{
      background:#ffecec !important;
      color:#c00 !important;
    }

    @media (max-width: 980px){
      .ml-row{ grid-template-columns: 70px 1fr; }
      .ml-prices{ text-align:left; }
      .ml-actions{ justify-content:flex-start; flex-wrap:wrap; }
    }
  `;
  document.head.appendChild(style);
}

/* ================= HELPERS ================= */
function fmtMoney(p) {
  const n = Number(p);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
function fmtMoneyOrDash(p) {
  const n = Number(p);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}
/* ===================== END MENU LIVE ===================== */

// Expose function to fill form for editing
window.fillMenuFormForEdit = fillFormForEdit;