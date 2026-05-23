import {
  subscribeManagerLiveData,
  buildRevenueOrders,
  mapValues,
  toDateSafe,
  numberOrNull,
  formatMoneyEUR,
  formatPercent,
  escapeHtml,
  normalizeKey,
} from "./manager-live-data.js";

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

subscribeManagerLiveData((snapshot) => {
  compute(snapshot);
});

function compute(snapshot) {
  const menus = mapValues(snapshot.menusById);
  const activeMenus = menus.filter((menu) => menu.active !== false);
  const revenueOrders = buildRevenueOrders(snapshot);
  const rows = buildMenuRows(activeMenus, revenueOrders);
  const soldRows = rows.filter((row) => row.sales > 0);

  setText(el.total, String(activeMenus.length));
  setText(el.newMonth, formatNewThisMonth(activeMenus));

  const top = soldRows[0] || null;
  const low = rows.slice().sort((left, right) => left.sales - right.sales || left.name.localeCompare(right.name, "bg"))[0] || null;

  setText(el.topName, top ? top.name : "—");
  setText(el.topSales, top ? `${top.sales} продажби` : "0 продажби");
  setText(el.lowName, low ? low.name : "—");
  setText(el.lowSales, low ? `${low.sales} продажби` : "0 продажби");

  const margins = soldRows.map((row) => row.marginPct).filter((value) => Number.isFinite(value));
  setText(el.avgMargin, margins.length ? formatPercent(avg(margins)) : "—");
  setText(el.marginTrend, margins.length ? "Live от база данни" : "Няма cost данни");

  renderTop10(soldRows);
  renderLow(rows);
  renderMatrix(soldRows);
  renderAI(soldRows, low);
}

function buildMenuRows(activeMenus, revenueOrders) {
  const rows = new Map();

  activeMenus.forEach((menu) => {
    const key = menuKey(menu);
    if (!key) return;
    rows.set(key, {
      key,
      name: menuName(menu),
      sales: 0,
      revenue: 0,
      cost: 0,
      marginPct: null,
      hasCost: numberOrNull(menu.cost) != null,
    });
  });

  revenueOrders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.menuId || normalizeKey(item.name);
      if (!key) return;

      const current = rows.get(key) || {
        key,
        name: item.name || key,
        sales: 0,
        revenue: 0,
        cost: 0,
        marginPct: null,
        hasCost: false,
      };

      const qty = Number(item.qty) || 0;
      const revenue = numberOrNull(item.total) ?? ((Number(item.price) || 0) * qty);
      const unitCost = numberOrNull(item.cost);

      current.name = item.name || current.name;
      current.sales += qty;
      current.revenue += revenue;
      if (unitCost != null) {
        current.cost += unitCost * qty;
        current.hasCost = true;
      }

      rows.set(key, current);
    });
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      marginPct: row.hasCost && row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : null,
    }))
    .sort((left, right) => right.sales - left.sales || right.revenue - left.revenue || left.name.localeCompare(right.name, "bg"));
}

function renderTop10(rows) {
  if (!el.top10) return;

  const top10 = rows.slice(0, 10);
  el.top10.innerHTML = top10.length
    ? top10.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${row.sales}</td>
          <td>${escapeHtml(formatMoneyEUR(row.revenue))}</td>
          <td>${row.marginPct == null ? "—" : escapeHtml(formatPercent(row.marginPct))}</td>
        </tr>
      `).join("")
    : emptyRow(5);
}

function renderLow(rows) {
  if (!el.low) return;

  const lowRows = rows.slice()
    .sort((left, right) => left.sales - right.sales || left.revenue - right.revenue || left.name.localeCompare(right.name, "bg"))
    .slice(0, 5);

  el.low.innerHTML = lowRows.length
    ? lowRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${row.sales}</td>
          <td>${escapeHtml(formatMoneyEUR(row.revenue))}</td>
          <td><span class="status-badge status-info">Наблюдавай</span></td>
        </tr>
      `).join("")
    : emptyRow(4);
}

function renderMatrix(rows) {
  if (!el.stars || !el.plow || !el.puzzle || !el.dogs) return;

  const valid = rows.filter((row) => row.sales > 0 && Number.isFinite(row.marginPct));
  if (!valid.length) {
    setList(el.stars, ["Няма достатъчно продажби и cost данни."]);
    setList(el.plow, ["Добави cost в реалните menu документи, за да се смята марж."]);
    setList(el.puzzle, ["Няма данни."]);
    setList(el.dogs, ["Няма данни."]);
    return;
  }

  const medianSales = median(valid.map((row) => row.sales));
  const medianMargin = median(valid.map((row) => row.marginPct));
  const stars = [];
  const plow = [];
  const puzzle = [];
  const dogs = [];

  valid.forEach((row) => {
    const popular = row.sales >= medianSales;
    const profitable = row.marginPct >= medianMargin;
    const line = `${row.name} - ${row.sales} продажби, ${formatPercent(row.marginPct)} марж`;

    if (popular && profitable) stars.push(line);
    else if (popular) plow.push(line);
    else if (profitable) puzzle.push(line);
    else dogs.push(line);
  });

  setList(el.stars, stars.slice(0, 6));
  setList(el.plow, plow.slice(0, 6));
  setList(el.puzzle, puzzle.slice(0, 6));
  setList(el.dogs, dogs.slice(0, 6));
}

function renderAI(rows, low) {
  if (!el.ai) return;

  const top = rows[0] || null;
  if (!top) {
    el.ai.innerHTML = `
      <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #666;">Няма препоръка</div>
        <div style="font-size: 14px; color: #666;">Няма достатъчно реални продажби в orders.</div>
      </div>
    `;
    return;
  }

  el.ai.innerHTML = `
    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 15px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #4CAF50;">
        ✓ Препоръка: Промотирай “${escapeHtml(top.name)}”
      </div>
      <div style="font-size: 14px; color: #666;">
        Най-продаван артикул: ${top.sales} продажби.
      </div>
    </div>

    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #ff9800;">
        Внимание: “${escapeHtml(low?.name ?? "—")}”
      </div>
      <div style="font-size: 14px; color: #666;">
        ${low ? `${low.sales} продажби.` : "Няма данни."}
      </div>
    </div>
  `;
}

function formatNewThisMonth(menus) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const count = menus.filter((menu) => {
    const date = toDateSafe(menu.createdAt);
    return date && date >= monthStart;
  }).length;
  return count ? `${count} нови този месец` : "—";
}

function menuKey(menu) {
  return String(menu.id || menu.menuId || menu.itemId || menu.productId || normalizeKey(menuName(menu))).trim();
}

function menuName(menu) {
  return String(menu.name || menu.title || menu.itemName || menu.productName || menu.id || "—").trim();
}

function setList(node, rows) {
  const values = Array.isArray(rows) && rows.length ? rows : ["—"];
  node.innerHTML = values.map((row) => `<li>${escapeHtml(row)}</li>`).join("");
}

function setText(node, value) {
  if (node) node.textContent = String(value ?? "—");
}

function emptyRow(colspan) {
  return `<tr><td colspan="${colspan}" style="opacity:.7;padding:10px;">Няма данни.</td></tr>`;
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const rows = values.slice().sort((left, right) => left - right);
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}
