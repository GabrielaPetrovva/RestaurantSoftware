import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  KITCHEN_STATS_ORDERS_QUERY_LIMIT,
  buildKitchenOrdersByHourModel,
  getStoredKitchenStatsPeriod,
  normalizeKitchenStatsHistory,
  normalizeKitchenStatsOrder,
  normalizeKitchenStatsPeriod,
  periodStart,
  setStoredKitchenStatsPeriod
} from "../shared/kitchen-statistics.js";

const el = (id) => document.getElementById(id);
const norm = (v) => String(v ?? "").trim().toLowerCase();
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const LATE_THRESHOLD_SEC = 300;
const DRINK_WORDS = [
  "бира", "вино", "чай", "кафе", "вода", "сок", "кола", "фанта", "спрайт", "уиски", "водка", "джин", "ром", "коктейл",
  "cocktail", "beer", "wine", "tea", "coffee", "water", "juice", "cola", "fanta", "sprite", "whiskey", "vodka", "gin", "rum"
];

const state = {
  lang: localStorage.getItem("kitchenLang") || "bg",
  period: getStoredKitchenStatsPeriod(),
  me: null,
  ordersRaw: [],
  historyRaw: [],
  unsubscribers: []
};

const i18n = {
  bg: {
    headerTitle: "Кухненска статистика",
    backBtn: "Назад към таблото",
    exitBtn: "Изход",
    filterLabel: "Период:",
    periodToday: "Днес",
    periodWeek: "Тази седмица",
    periodMonth: "Този месец",
    periodYear: "Тази година",
    totalOrdersLabel: "Общо поръчки",
    completedOrdersLabel: "Завършени поръчки",
    avgCookingTimeLabel: "Средно време за готвене",
    lateOrdersLabel: "Забавени поръчки",
    avgCheckLabel: "Среден чек",
    servedGuestsLabel: "Обслужени гости",
    vsYesterdayLabel: "спрямо вчера",
    vsYesterdayLabel2: "спрямо вчера",
    successRateLabel: "процент успеваемост",
    vsTargetLabel: "спрямо цел",
    ofTotalLabel: "от общо",
    vsLastWeekLabel: "спрямо миналата седмица",
    ordersPerHourTitle: "Поръчки по час",
    orderTypesTitle: "Типове поръчки",
    dineInLabel: "На място",
    topDishesTitle: "Топ ястия",
    dishNameHeader: "Име на ястие",
    ordersHeader: "Поръчки",
    revenueHeader: "Приход",
    avgTimeHeader: "Средно време",
    statusHeader: "Статус",
    onTimeLabel: "Навреме",
    delayedLabel: "Забавено",
    loading: "Зареждане...",
    noData: "Няма данни за избрания период.",
    confirmExit: "Сигурни ли сте, че искате да излезете?"
  },
  en: {
    headerTitle: "Kitchen Statistics",
    backBtn: "Back to Dashboard",
    exitBtn: "Exit",
    filterLabel: "Period:",
    periodToday: "Today",
    periodWeek: "This Week",
    periodMonth: "This Month",
    periodYear: "This Year",
    totalOrdersLabel: "Total Orders",
    completedOrdersLabel: "Completed Orders",
    avgCookingTimeLabel: "Avg Cooking Time",
    lateOrdersLabel: "Late Orders",
    avgCheckLabel: "Average Check",
    servedGuestsLabel: "Served Guests",
    vsYesterdayLabel: "vs yesterday",
    vsYesterdayLabel2: "vs yesterday",
    successRateLabel: "success rate",
    vsTargetLabel: "vs target",
    ofTotalLabel: "of total",
    vsLastWeekLabel: "vs last week",
    ordersPerHourTitle: "Orders per Hour",
    orderTypesTitle: "Order Types",
    dineInLabel: "Dine-in",
    takeawayLabel: "Takeaway",
    topDishesTitle: "Top Dishes",
    dishNameHeader: "Dish Name",
    ordersHeader: "Orders",
    revenueHeader: "Revenue",
    avgTimeHeader: "Avg Time",
    statusHeader: "Status",
    onTimeLabel: "On Time",
    delayedLabel: "Delayed",
    loading: "Loading...",
    noData: "No data for selected period.",
    confirmExit: "Are you sure you want to exit?"
  }
};

function t(key) {
  return i18n[state.lang]?.[key] || i18n.en[key] || key;
}

function fmtDuration(sec) {
  const safe = Math.max(0, Math.round(Number(sec) || 0));
  const mins = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${mins}:${String(rest).padStart(2, "0")}`;
}

function money(v) {
  return `EUR ${(Number(v) || 0).toFixed(2)}`;
}

function isTakeawayOrder(order) {
  const raw = norm(order?.orderType || order?.type || order?.serviceType || order?.mode || "");
  return raw.includes("delivery") || raw.includes("takeaway") || raw.includes("pickup");
}

function orderType(order) {
  return isTakeawayOrder(order) ? "takeaway" : "dinein";
}

function isCompletedKitchenOrder(order) {
  return norm(order?.kitchenStatus) === "done" || Number(order?.kitchenDoneAtMs || 0) > 0;
}

function orderIdOf(row) {
  return String(row?.orderId || row?.id || "").trim();
}

function normalizeDishName(item) {
  return String(
    item?.name ||
    item?.title ||
    item?.itemName ||
    item?.productName ||
    item?.itemId ||
    item?.menuId ||
    ""
  ).trim();
}

function itemQty(item, fallback = 1) {
  return Number(item?.qty ?? item?.quantity ?? item?.count ?? item?.q ?? fallback) || fallback;
}

function itemPrice(item) {
  return Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0) || 0;
}

function isDrinkItem(item) {
  const station = norm(item?.station);
  if (station === "bar") return true;
  if (item?.isDrink === true) return true;

  const category = norm(item?.category || item?.cat || item?.type || "");
  if (
    category.includes("drink") ||
    category.includes("napit") ||
    category.includes("beverage") ||
    category.includes("напит")
  ) return true;

  const nameText = norm(normalizeDishName(item));
  return DRINK_WORDS.some((word) => nameText.includes(norm(word)));
}

function orderTotal(order) {
  const totalValue = Number(order?.totalValue || 0);
  if (totalValue > 0) return totalValue;

  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, item) => sum + (itemPrice(item) * itemQty(item)), 0);
}

function filterHistoryByPeriod(period = state.period) {
  const startMs = periodStart(period).getTime();
  return state.historyRaw
    .filter((h) => (h?.servedAtMs || 0) >= startMs)
    .sort((a, b) => (Number(b?.servedAtMs) || 0) - (Number(a?.servedAtMs) || 0));
}

function computeModel(period = state.period) {
  const ordersByHourModel = buildKitchenOrdersByHourModel(state.ordersRaw, period, state.lang);
  const filteredOrders = ordersByHourModel.filteredOrders;
  const filteredHistory = filterHistoryByPeriod(period);
  const filteredCompletedOrders = filteredOrders.filter(isCompletedKitchenOrder);

  const totalOrders = filteredOrders.length;
  const completedOrders = filteredCompletedOrders.length;

  const historyById = new Map(
    filteredHistory.map((h) => [String(h?.orderId || h?.id || "").trim(), h])
  );
  const durationByCompletedOrderId = new Map();
  const durations = [];
  filteredCompletedOrders.forEach((order, idx) => {
    const orderId = orderIdOf(order) || `__idx_${idx}`;
    const fromHistory = historyById.get(orderId);
    let durationSec = 0;

    if (fromHistory) {
      durationSec = Math.max(0, Number(fromHistory?.durationSec || 0));
    } else {
      const doneMs = Number(order?.kitchenDoneAtMs || 0);
      const startMs = Number(order?.kitchenStartedAtMs || 0) || Number(order?.createdAtMs || 0);
      if (doneMs > 0 && startMs > 0) {
        durationSec = Math.max(0, Math.floor((doneMs - startMs) / 1000));
      }
    }

    durations.push(durationSec);
    durationByCompletedOrderId.set(orderId, durationSec);
  });

  const avgCookingTime = durations.length
    ? durations.reduce((sum, sec) => sum + sec, 0) / durations.length
    : 0;
  const lateOrders = durations.filter((sec) => sec > LATE_THRESHOLD_SEC).length;

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const avgCheck = totalOrders ? (totalRevenue / totalOrders) : 0;

  const servedGuests = filteredOrders.reduce((sum, order) => {
    const guestsValue = Number(order?.guestsValue || 0);
    if (guestsValue > 0) return sum + guestsValue;
    return sum + (isTakeawayOrder(order) ? 0 : 1);
  }, 0);

  const typeCounts = filteredOrders.reduce(
    (acc, order) => {
      if (orderType(order) === "takeaway") acc.takeaway += 1;
      else acc.dinein += 1;
      return acc;
    },
    { dinein: 0, takeaway: 0 }
  );

  const buckets = ordersByHourModel.buckets;

  const dishMap = new Map();
  filteredOrders.forEach((order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const orderDishKeys = new Set();

    items.forEach((item) => {
      const name = normalizeDishName(item);
      if (!name) return;

      const station = norm(item?.station);
      if (station && station !== "kitchen") return;
      if (isDrinkItem(item)) return;

      const qty = itemQty(item);
      if (qty <= 0) return;

      const key = norm(name);
      const cur = dishMap.get(key) || {
        name,
        orders: 0,
        revenue: 0,
        totalSec: 0,
        samples: 0
      };
      cur.orders += qty;
      cur.revenue += itemPrice(item) * qty;
      dishMap.set(key, cur);
      orderDishKeys.add(key);
    });

    const orderId = orderIdOf(order);
    if (!orderId || !durationByCompletedOrderId.has(orderId)) return;

    const durationSec = durationByCompletedOrderId.get(orderId);
    orderDishKeys.forEach((key) => {
      const cur = dishMap.get(key);
      if (!cur) return;
      cur.totalSec += durationSec;
      cur.samples += 1;
    });
  });

  const topDishes = Array.from(dishMap.values())
    .sort((a, b) => (b.orders - a.orders) || (b.revenue - a.revenue) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 6)
    .map((dish) => {
      const avgSec = dish.samples ? dish.totalSec / dish.samples : 0;
      return {
        ...dish,
        avgSec,
        delayed: avgSec > LATE_THRESHOLD_SEC
      };
    });

  console.log("[stats/render]", {
    period: state.period,
    filteredOrders: filteredOrders.length,
    filteredCompletedOrders: filteredCompletedOrders.length,
    filteredHistory: filteredHistory.length,
    totalOrders,
    completedOrders,
    avgCookingTime,
    lateOrders,
    avgCheck,
    servedGuests,
    topDishNames: topDishes.map((x) => x.name)
  });

  return {
    total: totalOrders,
    totalOrders,
    completed: completedOrders,
    completedOrders,
    avgDuration: avgCookingTime,
    late: lateOrders,
    lateOrders,
    avgCheck,
    servedGuests,
    typeCounts,
    buckets,
    topDishes
  };
}

function renderBars(buckets) {
  const box = el("ordersPerHourChart");
  if (!box) return;

  if (!buckets.length) {
    box.innerHTML = `<div style="margin:auto;color:#6b7280;font-size:0.875rem;">${esc(t("noData"))}</div>`;
    return;
  }

  const max = Math.max(...buckets.map((b) => b.count), 1);
  box.innerHTML = buckets
    .map((bucket) => {
      const pct = Math.max(15, Math.round((bucket.count / max) * 100));
      return `
        <div class="bar" style="height:${pct}%;">
          <span class="bar-value">${bucket.count}</span>
          <span class="bar-label">${esc(bucket.label)}</span>
        </div>
      `;
    })
    .join("");
}

function renderPie(typeCounts) {
  const dineCircle = el("pieDineIn");
  const takeawayCircle = el("pieTakeaway");
  const dinePctEl = el("dineInPercent");
  const takeawayPctEl = el("takeawayPercent");
  if (!dineCircle || !takeawayCircle || !dinePctEl || !takeawayPctEl) return;

  const total = typeCounts.dinein + typeCounts.takeaway;
  const dineRatio = total ? typeCounts.dinein / total : 0;
  const takeRatio = total ? typeCounts.takeaway / total : 0;
  const C = 2 * Math.PI * 40;

  const dineLen = C * dineRatio;
  const takeLen = C * takeRatio;

  dineCircle.setAttribute("stroke-dasharray", `${dineLen} ${C}`);
  dineCircle.setAttribute("stroke-dashoffset", "0");

  takeawayCircle.setAttribute("stroke-dasharray", `${takeLen} ${C}`);
  takeawayCircle.setAttribute("stroke-dashoffset", `${-dineLen}`);

  dinePctEl.textContent = `${Math.round(dineRatio * 100)}%`;
  takeawayPctEl.textContent = `${Math.round(takeRatio * 100)}%`;
}

function renderTopDishes(rows) {
  const body = el("topDishesBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280;">${esc(t("noData"))}</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((row) => {
      const badgeClass = row.delayed ? "badge-warning" : "badge-success";
      const badgeLabel = row.delayed ? t("delayedLabel") : t("onTimeLabel");
      return `
        <tr>
          <td><strong>${esc(row.name)}</strong></td>
          <td>${row.orders}</td>
          <td>${money(row.revenue)}</td>
          <td>${fmtDuration(row.avgSec)}</td>
          <td><span class="badge ${badgeClass}">${esc(badgeLabel)}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderCards(model) {
  const totalOrdersValue = el("totalOrdersValue");
  const completedOrdersValue = el("completedOrdersValue");
  const avgCookingTimeValue = el("avgCookingTimeValue");
  const lateOrdersValue = el("lateOrdersValue");
  const avgCheckValue = el("avgCheckValue");
  const servedGuestsValue = el("servedGuestsValue");

  if (totalOrdersValue) totalOrdersValue.textContent = String(model.total);
  if (completedOrdersValue) completedOrdersValue.textContent = String(model.completed);
  if (avgCookingTimeValue) avgCookingTimeValue.textContent = fmtDuration(model.avgDuration);
  if (lateOrdersValue) lateOrdersValue.textContent = String(model.late);
  if (avgCheckValue) avgCheckValue.textContent = money(model.avgCheck);
  if (servedGuestsValue) servedGuestsValue.textContent = String(model.servedGuests);
}

function renderModel() {
  const pf = el("periodFilter");
  if (pf) state.period = normalizeKitchenStatsPeriod(pf.value || state.period);
  const model = computeModel(state.period);
  renderCards(model);
  renderBars(model.buckets);
  renderPie(model.typeCounts);
  renderTopDishes(model.topDishes);
}

function applyLanguage() {
  const periodSelect = el("periodFilter");
  if (periodSelect && periodSelect.options.length >= 4) {
    periodSelect.options[0].text = t("periodToday");
    periodSelect.options[1].text = t("periodWeek");
    periodSelect.options[2].text = t("periodMonth");
    periodSelect.options[3].text = t("periodYear");
  }

  const ids = [
    ["headerTitle", "headerTitle"],
    ["backBtn", "backBtn"],
    ["exitBtn", "exitBtn"],
    ["filterLabel", "filterLabel"],
    ["totalOrdersLabel", "totalOrdersLabel"],
    ["completedOrdersLabel", "completedOrdersLabel"],
    ["avgCookingTimeLabel", "avgCookingTimeLabel"],
    ["lateOrdersLabel", "lateOrdersLabel"],
    ["avgCheckLabel", "avgCheckLabel"],
    ["servedGuestsLabel", "servedGuestsLabel"],
    ["vsYesterdayLabel", "vsYesterdayLabel"],
    ["vsYesterdayLabel2", "vsYesterdayLabel2"],
    ["successRateLabel", "successRateLabel"],
    ["vsTargetLabel", "vsTargetLabel"],
    ["ofTotalLabel", "ofTotalLabel"],
    ["vsLastWeekLabel", "vsLastWeekLabel"],
    ["ordersPerHourTitle", "ordersPerHourTitle"],
    ["orderTypesTitle", "orderTypesTitle"],
    ["dineInLabel", "dineInLabel"],
    ["takeawayLabel", "takeawayLabel"],
    ["topDishesTitle", "topDishesTitle"],
    ["dishNameHeader", "dishNameHeader"],
    ["ordersHeader", "ordersHeader"],
    ["revenueHeader", "revenueHeader"],
    ["avgTimeHeader", "avgTimeHeader"],
    ["statusHeader", "statusHeader"]
  ];

  ids.forEach(([id, key]) => {
    const node = el(id);
    if (node) node.textContent = t(key);
  });

  const langBtn = el("langBtn");
  if (langBtn) langBtn.textContent = state.lang === "bg" ? "EN" : "BG";

  renderModel();
}

function bindPeriodFilter() {
  const periodFilter = el("periodFilter");
  if (!periodFilter || periodFilter.dataset.bound === "1") return;
  periodFilter.dataset.bound = "1";
  periodFilter.addEventListener("change", () => {
    state.period = setStoredKitchenStatsPeriod(periodFilter.value || state.period);
    console.log("[stats] period changed ->", state.period, "start:", periodStart(state.period).toISOString());
    renderModel();
  });
}

function clearListeners() {
  state.unsubscribers.forEach((unsub) => {
    try {
      if (typeof unsub === "function") unsub();
    } catch (err) {
      console.warn("unsubscribe error:", err);
    }
  });
  state.unsubscribers = [];
}

function startLiveListeners() {
  clearListeners();

  state.unsubscribers.push(
    onSnapshot(
      query(
        collection(db, "orders"),
        orderBy("createdAt", "desc"),
        limit(KITCHEN_STATS_ORDERS_QUERY_LIMIT)
      ),
      (snap) => {
        state.ordersRaw = snap.docs.map((d) => normalizeKitchenStatsOrder(d.id, d.data() || {}));
        console.log("[stats/orders] loaded", state.ordersRaw.length);
        renderModel();
      },
      (err) => {
        const msg = String(err?.message || err || "");
        const code = String(err?.code || "").replace("firestore/", "");
        console.error("kitchen statistics orders listener error:", {
          code,
          message: msg,
          query: `orders orderBy(createdAt desc) limit(${KITCHEN_STATS_ORDERS_QUERY_LIMIT})`
        });
      }
    )
  );

  state.unsubscribers.push(
    onSnapshot(
      query(
        collection(db, "kitchen_history"),
        orderBy("servedAt", "desc"),
        limit(5000)
      ),
      (snap) => {
        state.historyRaw = snap.docs.map((d) => normalizeKitchenStatsHistory(d.id, d.data() || {}));
        console.log("[stats/history] loaded", state.historyRaw.length);
        renderModel();
      },
      (err) => {
        const msg = String(err?.message || err || "");
        const code = String(err?.code || "").replace("firestore/", "");
        console.error("kitchen statistics history listener error:", {
          code,
          message: msg,
          query: "kitchen_history orderBy(servedAt desc) limit(5000)"
        });
        if (code === "failed-precondition") {
          const link = msg.match(/https?:\/\/\S+/)?.[0] || "";
          console.warn("Missing index for kitchen history statistics query.", link || "Create index in Firestore Console.");
        }
      }
    )
  );
}

window.updateStats = () => renderModel();

window.toggleLanguage = () => {
  state.lang = state.lang === "bg" ? "en" : "bg";
  localStorage.setItem("kitchenLang", state.lang);
  applyLanguage();
};

window.goBack = () => {
  window.location.href = "index.html";
};

window.exit = async () => {
  if (!confirm(t("confirmExit"))) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.error("signOut error:", err);
  }
  window.location.href = "../Login/login.html";
};

onAuthStateChanged(auth, async (user) => {
  clearListeners();

  if (!user) {
    window.location.href = "../Login/login.html";
    return;
  }

  try {
    const empSnap = await getDoc(doc(db, "employees", user.uid));
    const me = empSnap.exists() ? empSnap.data() : null;

    const status = norm(me?.status);
    if (status && status !== "active") {
      window.location.href = "../Login/waiting-approval.html";
      return;
    }

    state.me = me || {};
    const waiterName = el("waiterName");
    if (waiterName) {
      waiterName.textContent =
        me?.name ||
        [me?.firstName, me?.lastName].filter(Boolean).join(" ").trim() ||
        me?.email ||
        "Kitchen";
    }

    const period = el("periodFilter");
    if (period) {
      period.value = state.period;
      state.period = normalizeKitchenStatsPeriod(period.value || state.period);
    }
    setStoredKitchenStatsPeriod(state.period);

    bindPeriodFilter();
    applyLanguage();
    startLiveListeners();
  } catch (err) {
    console.error("statistics init error:", err);
    window.location.href = "../Login/login.html";
  }
});
