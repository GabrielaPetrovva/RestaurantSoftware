import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ====== TARGETS (по ID-тата, които сложи) ====== */
const el = {
  total: document.getElementById("kpiTotalMenuItems"),
  topName: document.getElementById("kpiTopSellerName"),
  topSales: document.getElementById("kpiTopSellerSales"),
  lowName: document.getElementById("kpiLowSellerName"),
  lowSales: document.getElementById("kpiLowSellerSales"),
  top10: document.getElementById("tblTop10"),
  low: document.getElementById("tblLow"),
};

let menus = [];   // {id, name, price, category, ...}
let orders = [];  // depends on your structure

/* ===== MENUS ===== */
onSnapshot(collection(db, "menus"), (snap) => {
  menus = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  compute();
}, (e) => console.error("menus listener error:", e));

/* ===== ORDERS ===== */
onSnapshot(collection(db, "orders"), (snap) => {
  orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  compute();
}, (e) => console.error("orders listener error:", e));

function compute() {
  if (!menus.length) return;

  // KPI: Total menu items (можеш да решиш дали да са само active)
  const activeMenus = menus.filter(m => m.active !== false);
  if (el.total) el.total.textContent = String(activeMenus.length);

  // Map menuId -> name/price (fallback по name)
  const menuById = new Map(menus.map(m => [m.id, m]));

  // Aggregate sales from orders
  // Key: menuId if present, else name
  const agg = new Map(); // key -> {name, sales, revenue}

  for (const o of orders) {
    const items = normalizeItems(o);
    for (const it of items) {
      const qty = it.qty;
      if (!qty || qty <= 0) continue;

      const key = it.menuId || it.name; // prefer id
      if (!key) continue;

      // resolve name/price if missing
      let name = it.name;
      let price = it.price;

      if (it.menuId && menuById.has(it.menuId)) {
        const m = menuById.get(it.menuId);
        name = name || m.name;
        if (!Number.isFinite(price)) price = Number(m.price ?? 0);
      }

      if (!name) continue;
      if (!Number.isFinite(price)) price = 0;

      const cur = agg.get(key) || { name, sales: 0, revenue: 0 };
      cur.name = name;
      cur.sales += qty;
      cur.revenue += qty * price;
      agg.set(key, cur);
    }
  }

  const rows = Array.from(agg.values());

  // If no sales yet
  if (!rows.length) {
    if (el.topName) el.topName.textContent = "—";
    if (el.topSales) el.topSales.textContent = "0 продажби";
    if (el.lowName) el.lowName.textContent = "—";
    if (el.lowSales) el.lowSales.textContent = "0 продажби";
    if (el.top10) el.top10.innerHTML = "";
    if (el.low) el.low.innerHTML = "";
    return;
  }

  // Top / Low seller
  const top = rows.slice().sort((a,b)=>b.sales-a.sales)[0];
  const low = rows.slice().sort((a,b)=>a.sales-b.sales)[0];

  if (el.topName) el.topName.textContent = top.name;
  if (el.topSales) el.topSales.textContent = `${top.sales} продажби`;

  if (el.lowName) el.lowName.textContent = low.name;
  if (el.lowSales) el.lowSales.textContent = `${low.sales} продажби`;

  // Top 10
  if (el.top10) {
    const top10 = rows.slice().sort((a,b)=>b.sales-a.sales).slice(0,10);
    el.top10.innerHTML = top10.map((r, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${esc(r.name)}</td>
        <td>${r.sales}</td>
        <td>${fmtMoney(r.revenue)} EUR</td>
        <td>—</td>
      </tr>
    `).join("");
  }

  // Low sellers (пример: 5)
  if (el.low) {
    const low5 = rows.slice().sort((a,b)=>a.sales-b.sales).slice(0,5);
    el.low.innerHTML = low5.map((r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${r.sales}</td>
        <td>${fmtMoney(r.revenue)} EUR</td>
        <td><button type="button" class="action-btn">Прегледай</button></td>
      </tr>
    `).join("");
  }
}

/* ===== Supports common order formats =====
   Returns: [{menuId, name, price, qty}]
*/
function normalizeItems(order) {
  // Case A: order.items is array
  if (Array.isArray(order.items)) {
    return order.items.map(it => ({
      menuId: it.menuId || it.itemId || it.menuItemId || it.productId || null,
      name: it.name || null,
      price: Number(it.price),
      qty: Number(it.qty ?? it.quantity ?? it.count ?? 0),
    }));
  }

  // Case B: order.cartItems is array
  if (Array.isArray(order.cartItems)) {
    return order.cartItems.map(it => ({
      menuId: it.menuId || it.itemId || it.menuItemId || null,
      name: it.name || null,
      price: Number(it.price),
      qty: Number(it.qty ?? it.quantity ?? 0),
    }));
  }

  // Case C: order has map {menuId: qty}
  if (order.itemsMap && typeof order.itemsMap === "object") {
    return Object.entries(order.itemsMap).map(([menuId, qty]) => ({
      menuId,
      name: null,
      price: NaN,
      qty: Number(qty ?? 0),
    }));
  }

  return [];
}

function fmtMoney(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x)
    ? x.toLocaleString("bg-BG", { maximumFractionDigits: 0 })
    : "0";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
// --- IGNORE ---