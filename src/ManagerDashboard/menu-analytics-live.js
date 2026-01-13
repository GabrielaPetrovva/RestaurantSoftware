import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const el = {
  total: document.getElementById("kpiTotalMenuItems"),
  newMonth: document.getElementById("kpiNewThisMonth"),
  avgMargin: document.getElementById("kpiAvgMargin"),
  marginTrend: document.getElementById("kpiMarginTrend"),

  topName: document.getElementById("kpiTopSellerName"),
  topSales: document.getElementById("kpiTopSellerSales"),
  lowName: document.getElementById("kpiLowSellerName"),
  lowSales: document.getElementById("kpiLowSellerSales"),

  top10: document.getElementById("tblTop10"),
  low: document.getElementById("tblLow"),

  stars: document.getElementById("matrixStars"),
  plow: document.getElementById("matrixPlow"),
  puzzle: document.getElementById("matrixPuzzle"),
  dogs: document.getElementById("matrixDogs"),

  ai: document.getElementById("aiRecs"),
};

let menus = [];
let orders = [];

onSnapshot(collection(db, "menus"), (snap) => {
  menus = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  compute();
});

onSnapshot(collection(db, "orders"), (snap) => {
  orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  compute();
});

function compute() {
  if (!menus.length) return;

  const activeMenus = menus.filter(m => m.active !== false);
  if (el.total) el.total.textContent = String(activeMenus.length);

  // new this month (ако имаш createdAt)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = activeMenus.filter(m => {
    const t = toDate(m.createdAt);
    return t && t >= monthStart;
  }).length;
  if (el.newMonth) el.newMonth.textContent = newThisMonth ? `${newThisMonth} нови този месец` : "—";

  // maps
  const menuById = new Map(menus.map(m => [m.id, m]));
  const menuByName = new Map(
    menus
      .filter(m => (m.name ?? "").trim().length)
      .map(m => [String(m.name).trim().toLowerCase(), m])
  );

  const agg = new Map(); // key -> {name, sales, revenue, marginPct}

  for (const o of orders) {
    const items = normalizeItems(o);
    for (const it of items) {
      if (!it.qty || it.qty <= 0) continue;

      // resolve menu doc
      let m = null;
      if (it.menuId && menuById.has(it.menuId)) {
        m = menuById.get(it.menuId);
      } else if (it.name) {
        m = menuByName.get(String(it.name).trim().toLowerCase()) || null;
      }

      const name = it.name || m?.name;
      if (!name) continue;

      const price = Number.isFinite(it.price) ? it.price : Number(m?.price ?? 0);
      const cost = Number(m?.cost);

      const key = (it.menuId && menuById.has(it.menuId)) ? it.menuId : String(name).trim().toLowerCase();

      const cur = agg.get(key) || { name, sales: 0, revenue: 0, marginPct: null };
      cur.name = name;
      cur.sales += it.qty;
      cur.revenue += it.qty * (Number.isFinite(price) ? price : 0);

      // marginPct ако имаме cost
      if (Number.isFinite(cost) && Number.isFinite(price) && price > 0) {
        cur.marginPct = Math.round(((price - cost) / price) * 100);
      }

      agg.set(key, cur);
    }
  }

  const rows = Array.from(agg.values()).sort((a, b) => b.sales - a.sales);

  const top = rows[0];
  const low = rows.slice().sort((a,b)=>a.sales-b.sales)[0];

  if (el.topName) el.topName.textContent = top ? top.name : "—";
  if (el.topSales) el.topSales.textContent = top ? `${top.sales} продажби` : "0 продажби";
  if (el.lowName) el.lowName.textContent = low ? low.name : "—";
  if (el.lowSales) el.lowSales.textContent = low ? `${low.sales} продажби` : "0 продажби";

  const margins = rows.map(r => r.marginPct).filter(v => Number.isFinite(v));
  if (el.avgMargin) el.avgMargin.textContent = margins.length ? `${avg(margins).toFixed(1)}%` : "—";
  if (el.marginTrend) el.marginTrend.textContent = margins.length ? "Live от базата" : "Няма cost данни";

  if (el.top10) {
    const top10 = rows.slice(0, 10);
    el.top10.innerHTML = top10.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.name)}</td>
        <td>${r.sales}</td>
        <td>${fmtMoney(r.revenue)} EUR</td>
        <td>${Number.isFinite(r.marginPct) ? r.marginPct + "%" : "—"}</td>
      </tr>
    `).join("");
  }

  if (el.low) {
    const low5 = rows.slice().sort((a,b)=>a.sales-b.sales).slice(0, 5);
    el.low.innerHTML = low5.map((r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${r.sales}</td>
        <td>${fmtMoney(r.revenue)} EUR</td>
        <td><span class="status-badge status-info">Наблюдавай</span></td>
      </tr>
    `).join("");
  }

  renderMatrix(rows);
  renderAI(rows);
}

function renderMatrix(rows) {
  if (!el.stars || !el.plow || !el.puzzle || !el.dogs) return;

  const valid = rows.filter(r => Number.isFinite(r.marginPct));
  if (!valid.length) {
    el.stars.innerHTML = `<li>Няма данни за разход (cost) → не мога да сметна марж.</li>`;
    el.plow.innerHTML = `<li>Добави поле <b>cost</b> в menus документите.</li>`;
    el.puzzle.innerHTML = `<li>Пример: cost: 3.20 (EUR)</li>`;
    el.dogs.innerHTML = `<li>После всичко ще се изчислява автоматично.</li>`;
    return;
  }

  const medianSales = median(valid.map(r => r.sales));
  const medianMargin = median(valid.map(r => r.marginPct));

  const stars = [], plow = [], puzzle = [], dogs = [];

  for (const r of valid) {
    const popHigh = r.sales >= medianSales;
    const marginHigh = r.marginPct >= medianMargin;
    const line = `• ${esc(r.name)} - ${r.sales} продажби, ${r.marginPct}% марж`;

    if (popHigh && marginHigh) stars.push(line);
    else if (popHigh && !marginHigh) plow.push(line);
    else if (!popHigh && marginHigh) puzzle.push(line);
    else dogs.push(line);
  }

  el.stars.innerHTML = stars.slice(0, 6).map(x => `<li>${x}</li>`).join("") || `<li>—</li>`;
  el.plow.innerHTML = plow.slice(0, 6).map(x => `<li>${x}</li>`).join("") || `<li>—</li>`;
  el.puzzle.innerHTML = puzzle.slice(0, 6).map(x => `<li>${x}</li>`).join("") || `<li>—</li>`;
  el.dogs.innerHTML = dogs.slice(0, 6).map(x => `<li>${x}</li>`).join("") || `<li>—</li>`;
}

function renderAI(rows) {
  if (!el.ai) return;

  const top = rows[0];
  const low = rows.slice().sort((a,b)=>a.sales-b.sales)[0];

  el.ai.innerHTML = `
    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 15px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #4CAF50;">
        ✓ Препоръка: Промотирай “${esc(top?.name ?? "—")}”
      </div>
      <div style="font-size: 14px; color: #666;">
        ${top ? `Най-продаван: ${top.sales} продажби.` : "Няма данни от orders."}
      </div>
    </div>

    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #ff9800;">
        ⚠ Внимание: “${esc(low?.name ?? "—")}”
      </div>
      <div style="font-size: 14px; color: #666;">
        ${low ? `Само ${low.sales} продажби.` : "Няма данни от orders."}
      </div>
    </div>
  `;
}

function normalizeItems(order) {
  if (Array.isArray(order.items)) {
    return order.items.map(it => ({
      menuId: it.menuId || it.itemId || it.menuItemId || it.productId || null,
      name: it.name || null,
      price: Number(it.price),
      qty: Number(it.qty ?? it.quantity ?? it.count ?? 0),
    }));
  }
  if (Array.isArray(order.cartItems)) {
    return order.cartItems.map(it => ({
      menuId: it.menuId || it.itemId || it.menuItemId || null,
      name: it.name || null,
      price: Number(it.price),
      qty: Number(it.qty ?? it.quantity ?? 0),
    }));
  }
  return [];
}

function toDate(ts) {
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function avg(arr) { return arr.reduce((a,b)=>a+b,0) / arr.length; }
function median(arr) {
  const a = arr.slice().sort((x,y)=>x-y);
  const mid = Math.floor(a.length/2);
  return a.length % 2 ? a[mid] : (a[mid-1] + a[mid]) / 2;
}

function fmtMoney(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toLocaleString("bg-BG", { maximumFractionDigits: 0 }) : "0";
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
