import { db } from "./firebase.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * REQUIRED HTML IDs:
 *  - kpiActiveStaff  (числото "12")
 *  - kpiTotalStaff   (текста "от X общо")
 *  - tblWaiterSales  (tbody на "Продажби по Сервитьор")
 *  - tblSystemLogs   (tbody на "Системни Логове")
 *
 * Works WITHOUT composite indexes:
 *  - orders: orderBy(createdAt) + limit, then filter status in JS
 *  - logs: orderBy(createdAt) + limit
 */

const el = {
  kpiActiveStaff: document.getElementById("kpiActiveStaff"),
  kpiTotalStaff: document.getElementById("kpiTotalStaff"),
  tblWaiterSales: document.getElementById("tblWaiterSales"),
  tblSystemLogs: document.getElementById("tblSystemLogs"),
  logsToggleBtn: document.getElementById("logsToggleBtn"),
};

// Ако липсват елементи – не чупим страницата
if (!el.kpiActiveStaff) console.warn("Missing #kpiActiveStaff");
if (!el.kpiTotalStaff) console.warn("Missing #kpiTotalStaff");
if (!el.tblWaiterSales) console.warn("Missing #tblWaiterSales (tbody)");
if (!el.tblSystemLogs) console.warn("Missing #tblSystemLogs (tbody)");

let employees = [];
let orders = [];
let latestLogs = [];
let logsMode = "latest";
let cachedAllLogs = null;
let latestLogsHasMore = false;
let systemLogsLoaded = false;

const PAID_STATUSES = new Set(["paid", "closed"]); // ако имаш други, добави тук

// ============ LISTENERS (NO INDEX) ============
onSnapshot(collection(db, "employees"), (snap) => {
  employees = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAll();
});

onSnapshot(
  query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(300)),
  (snap) => {
    orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  }
);

// ============ RENDER ============
function renderAll() {
  renderKpis();
  renderWaiterSales();
}

function ensureLogsToggleBtn() {
  if (el.logsToggleBtn) return el.logsToggleBtn;
  if (!el.tblSystemLogs) return null;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "logsToggleBtn";
  btn.className = "btn btn-secondary";
  btn.hidden = true;
  btn.textContent = "Виж всички";

  const table = el.tblSystemLogs.closest("table");
  if (table) {
    table.insertAdjacentElement("afterend", btn);
  } else {
    el.tblSystemLogs.parentElement?.appendChild(btn);
  }

  el.logsToggleBtn = btn;
  return btn;
}

function setLogsToggleButton() {
  if (!ensureLogsToggleBtn()) return;

  const shouldShow = logsMode === "all" || latestLogsHasMore;
  el.logsToggleBtn.hidden = !shouldShow;
  if (!shouldShow) return;

  el.logsToggleBtn.textContent = logsMode === "all" ? "Скрий" : "Виж всички";
}

async function refreshLatestLogsHasMore() {
  try {
    const snap = await getDocs(
      query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(4))
    );
    latestLogsHasMore = snap.docs.length > 3;
  } catch (err) {
    latestLogsHasMore = false;
    console.error("logs count check:", err);
  }
  setLogsToggleButton();
}

function startLatestLogsListener() {
  if (systemLogsLoaded) return;
  systemLogsLoaded = true;

  onSnapshot(
    query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(3)),
    (snap) => {
      latestLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cachedAllLogs = null;
      if (logsMode === "latest") {
        renderLogs(latestLogs, "latest");
      }
      refreshLatestLogsHasMore();
    },
    (err) => {
      console.error("logs listener:", err);
    }
  );
}

async function ensureAllLogsCached() {
  if (cachedAllLogs !== null) return;
  const snap = await getDocs(query(collection(db, "logs"), orderBy("createdAt", "desc")));
  cachedAllLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function loadSystemLogs() {
  startLatestLogsListener();
  logsMode = "latest";
  renderLogs(latestLogs, "latest");
  setLogsToggleButton();
  refreshLatestLogsHasMore();
}

window.addEventListener("manager:tabchange", (e) => {
  if (e?.detail?.tabName === "settings") {
    loadSystemLogs();
  }
});

async function onLogsToggleClick() {
  try {
    if (logsMode === "latest") {
      await ensureAllLogsCached();
      logsMode = "all";
      renderLogs(cachedAllLogs ?? [], "all");
      setLogsToggleButton();
      return;
    }

    logsMode = "latest";
    renderLogs(latestLogs, "latest");
    setLogsToggleButton();
  } catch (err) {
    console.error("logs toggle:", err);
  }
}

ensureLogsToggleBtn()?.addEventListener("click", onLogsToggleClick);

function renderKpis() {
  if (!el.kpiActiveStaff && !el.kpiTotalStaff) return;

  const total = employees.length;
  const active = employees.filter((e) => e.status === "active").length;

  if (el.kpiActiveStaff) el.kpiActiveStaff.textContent = String(active);
  if (el.kpiTotalStaff) el.kpiTotalStaff.textContent = `от ${total} общо`;
}

function renderWaiterSales() {
  if (!el.tblWaiterSales) return;

  const paidOrders = orders.filter((o) => PAID_STATUSES.has(o.status));

  // waiterId -> { name, revenue, tables:Set, status }
  const map = new Map();

  for (const o of paidOrders) {
    const waiterId = o.waiterId || o.waiterUID || o.staffId || o.employeeId || o.createdBy;
    if (!waiterId) continue;

    const name =
      o.waiterName ||
      o.waiter ||
      findEmpName(waiterId) ||
      String(waiterId);

    const total = Number(o.total ?? o.sum ?? o.amount ?? 0);
    const tableId = o.tableId ?? o.tableNumber ?? o.table ?? null;

    const cur = map.get(waiterId) || {
      name,
      revenue: 0,
      tables: new Set(),
      status: "active",
    };

    cur.name = name;
    cur.revenue += Number.isFinite(total) ? total : 0;

    if (tableId != null) cur.tables.add(String(tableId));

    map.set(waiterId, cur);
  }

  // статус от employees
  for (const [id, cur] of map.entries()) {
    const emp = employees.find((e) => e.id === id);
    if (emp?.status) cur.status = emp.status;
  }

  const rows = Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  el.tblWaiterSales.innerHTML = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${fmtMoney(r.revenue)} EUR</td>
        <td>${r.tables.size}</td>
        <td>${badge(r.status)}</td>
      </tr>
    `
        )
        .join("")
    : `
    <tr>
      <td colspan="4" style="opacity:.7;padding:10px;">
        Няма paid/closed поръчки или липсва waiterId в orders.
      </td>
    </tr>`;
}

function renderLogs(logRows, mode = "latest") {
  if (!el.tblSystemLogs) return;

  const sorted = [...(logRows ?? [])].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  const rows = mode === "latest" ? sorted.slice(0, 3) : sorted;

  el.tblSystemLogs.innerHTML = rows.length
    ? rows
        .map(
          (l) => `
      <tr>
        <td>${fmtDate(l.createdAt)}</td>
        <td>${esc(l.userName ?? "System")}</td>
        <td>${esc(l.action ?? "—")}</td>
        <td>${esc(l.details ?? "—")}</td>
      </tr>
    `
        )
        .join("")
    : `
    <tr>
      <td colspan="4" style="opacity:.7;padding:10px;">Няма логове.</td>
    </tr>`;
}

// ============ HELPERS ============
function findEmpName(uid) {
  const e = employees.find((x) => x.id === uid);
  if (!e) return null;
  const n = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
  return n || e.displayName || e.email || null;
}

function badge(status) {
  if (status === "active") return `<span class="status-badge status-success">Активен</span>`;
  if (status === "pending") return `<span class="status-badge status-warning">Чака</span>`;
  return `<span class="status-badge status-info">Почивка</span>`;
}

function fmtMoney(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x)
    ? x.toLocaleString("bg-BG", { maximumFractionDigits: 0 })
    : "0";
}

function toMillis(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return 0;
  return d.getTime();
}

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString("bg-BG");
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
