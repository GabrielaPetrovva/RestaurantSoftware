import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collectionGroup,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const el = (id) => document.getElementById(id);
const norm = (v) => String(v ?? "").trim().toLowerCase();
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const state = {
  lang: localStorage.getItem("kitchenLang") || "bg",
  period: "today",
  me: null,
  ordersRaw: [],
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

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function periodStart(period) {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function orderStatus(order) {
  return order?.completed ? "completed" : "open";
}

function orderType(order) {
  const raw = norm(order?.orderType || order?.type || order?.serviceType || order?.mode);
  if (raw.includes("delivery") || raw.includes("takeaway") || raw.includes("pickup")) return "takeaway";
  if (order?.tableId == null || order?.tableId === "") return "takeaway";
  return "dinein";
}

function orderIdFromItemPath(path) {
  const parts = String(path || "").split("/");
  const i = parts.indexOf("orders");
  if (i >= 0 && parts[i + 1]) return parts[i + 1];
  return "";
}

function itemOrderType(item) {
  const raw = norm(item?.orderType || item?.type || item?.serviceType || item?.mode);
  if (raw.includes("delivery") || raw.includes("takeaway") || raw.includes("pickup")) return "takeaway";
  if (item?.isDelivery === true || item?.delivery === true) return "takeaway";
  if (item?.isTakeaway === true || item?.takeaway === true || item?.pickup === true) return "takeaway";
  return "dinein";
}

function toMs(value) {
  const dt = toDate(value);
  return dt ? dt.getTime() : 0;
}

function bestOrderDate(order) {
  // completed date first, then created
  return (
    toDate(order?.kitchenServedAt) ||
    toDate(order?.kitchenReadyAt) ||
    toDate(order?.kitchenStartedAt) ||
    toDate(order?.updatedAt) ||
    toDate(order?.createdAt) ||
    toDate(order?.completedAtMs) ||
    toDate(order?.startedAtMs) ||
    toDate(order?.createdAtMs) ||
    null
  );
}

function kitchenItems(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.filter((item) => {
    const station = norm(item?.station);
    // Keep strict kitchen filter; allow empty station for backward compatibility.
    return station === "kitchen" || station === "";
  });
}

function hasKitchenItems(order) {
  return kitchenItems(order).length > 0;
}

function normalizeKitchenItem(item, fallbackName = "Item") {
  const name = String(item?.name || item?.itemId || item?.menuId || fallbackName).trim();
  return {
    name,
    qty: Math.max(1, Number(item?.qty ?? item?.quantity ?? item?.count ?? item?.q) || 1),
    price: Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost) || 0,
    station: "kitchen",
    status: norm(item?.status || "new"),
    createdAtMs: toMs(item?.createdAt),
    startedAtMs: toMs(item?.startedAt),
    readyAtMs: toMs(item?.readyAt),
    servedAtMs: toMs(item?.servedAt)
  };
}

function buildOrderGroupsFromItems(items) {
  const grouped = new Map();

  items.forEach((row, idx) => {
    // Strict kitchen-only pipeline: bar items are never aggregated in stats.
    if (norm(row?.station) !== "kitchen") return;

    const orderId = String(row?.orderId || orderIdFromItemPath(row?.path || "")).trim();
    if (!orderId) return;

    if (!grouped.has(orderId)) {
      grouped.set(orderId, {
        id: orderId,
        items: [],
        createdAtMs: Number.POSITIVE_INFINITY,
        startedAtMs: Number.POSITIVE_INFINITY,
        completedAtMs: 0,
        hasOpenItem: false,
        takeawayVotes: 0,
        guests: 0,
        tableId: ""
      });
    }

    const group = grouped.get(orderId);
    const item = normalizeKitchenItem(row, `Item ${idx + 1}`);
    if (!item.name) return;
    group.items.push(item);

    if (item.createdAtMs > 0) group.createdAtMs = Math.min(group.createdAtMs, item.createdAtMs);
    const startedCandidate = item.startedAtMs || item.createdAtMs || 0;
    if (startedCandidate > 0) group.startedAtMs = Math.min(group.startedAtMs, startedCandidate);

    const itemCompleted = item.status === "served" || item.servedAtMs > 0;
    if (!itemCompleted) group.hasOpenItem = true;
    if (itemCompleted) {
      const completedCandidate = item.servedAtMs || item.readyAtMs || startedCandidate || 0;
      group.completedAtMs = Math.max(group.completedAtMs, completedCandidate);
    }

    if (itemOrderType(row) === "takeaway") group.takeawayVotes += 1;

    const guests = Number(row?.guests ?? row?.guestCount ?? row?.peopleCount);
    if (guests > 0) group.guests = Math.max(group.guests, guests);
    if (!group.tableId) group.tableId = String(row?.tableId || "").trim();
  });

  return Array.from(grouped.values())
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const createdAtMs = Number.isFinite(group.createdAtMs) ? group.createdAtMs : 0;
      const startedAtMs = Number.isFinite(group.startedAtMs) ? group.startedAtMs : (createdAtMs || 0);
      let completedAtMs = group.completedAtMs;

      if (!group.hasOpenItem && completedAtMs <= 0) {
        completedAtMs = group.items.reduce((max, item) => {
          const candidate = item.servedAtMs || item.readyAtMs || item.startedAtMs || item.createdAtMs || 0;
          return Math.max(max, candidate);
        }, 0);
      }

      const completed = !group.hasOpenItem && completedAtMs > 0;
      const durationSec = completed
        ? Math.max(0, Math.floor((completedAtMs - (startedAtMs || completedAtMs)) / 1000))
        : 0;
      const type = group.takeawayVotes > 0 ? "takeaway" : "dinein";
      const guests = group.guests > 0 ? group.guests : (type === "dinein" ? 1 : 0);

      return {
        id: group.id,
        items: group.items,
        tableId: group.tableId,
        type,
        guests,
        completed,
        createdAtMs,
        startedAtMs,
        completedAtMs: completed ? completedAtMs : 0,
        durationSec
      };
    })
    .sort((a, b) =>
      (b.completedAtMs - a.completedAtMs) ||
      (b.createdAtMs - a.createdAtMs) ||
      String(a.id).localeCompare(String(b.id))
    );
}

function orderDuration(order) {
  return Math.max(0, Number(order?.durationSec) || 0);
}

function orderRevenue(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
}

function guestsFromOrder(order) {
  const raw = Number(order?.guests);
  if (raw > 0) return raw;
  return orderType(order) === "dinein" ? 1 : 0;
}

function bucketKey(date, period = state.period) {
  if (period === "today") {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  }
  if (period === "year") {
    return date.toLocaleString(state.lang === "bg" ? "bg-BG" : "en-US", { month: "short" });
  }
  return date.toLocaleDateString(state.lang === "bg" ? "bg-BG" : "en-US", {
    month: "2-digit",
    day: "2-digit"
  });
}

function filteredOrders() {
  const start = periodStart(state.period);
  return state.ordersRaw
    .map((order) => {
      const best = bestOrderDate(order);
      return { ...order, _bestAt: best };
    })
    .filter((order) => order._bestAt && order._bestAt >= start && hasKitchenItems(order))
    .sort((a, b) => (b._bestAt - a._bestAt) || String(a.id).localeCompare(String(b.id)));
}

function computeModel(period = state.period) {
  const startMs = periodStart(period).getTime();
  const filtered = filteredOrders();

  const totalOrders = filtered.length;
  const completedOrdersList = filtered
    .map((order) => ({
      ...order,
      _completedAtMs: Number(order?.completedAtMs) || 0
    }))
    .filter((order) => order.completed === true && order._completedAtMs >= startMs);

  const completedOrders = completedOrdersList.length;
  const durations = completedOrdersList.map((o) => orderDuration(o)).filter((sec) => sec > 0);
  const avgDuration = durations.length
    ? durations.reduce((sum, val) => sum + val, 0) / durations.length
    : 0;
  const lateOrders = durations.filter((sec) => sec > 300).length;
  const revenue = completedOrdersList.reduce((sum, order) => sum + orderRevenue(order), 0);
  const avgCheck = completedOrders ? revenue / completedOrders : 0;
  const servedGuests = completedOrdersList.reduce((sum, order) => sum + guestsFromOrder(order), 0);

  const typeCounts = filtered.reduce(
    (acc, order) => {
      if (orderType(order) === "dinein") acc.dinein += 1;
      else acc.takeaway += 1;
      return acc;
    },
    { dinein: 0, takeaway: 0 }
  );

  const bucketMap = new Map();
  filtered.forEach((order) => {
    const key = bucketKey(order._bestAt, period);
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
  });

  const buckets = Array.from(bucketMap.entries())
    .map(([label, count]) => ({ label, count }))
    .slice(-8);

  const dishMap = new Map();
  completedOrdersList.forEach((order) => {
    const sec = Math.max(0, Number(order?.durationSec) || 0);
    const perOrderDish = new Map();
    const items = kitchenItems(order);

    items.forEach((item) => {
      const key = norm(item.name);
      if (!key) return;
      const cur = perOrderDish.get(key) || {
        name: item.name,
        orders: 0,
        revenue: 0
      };
      cur.orders += Number(item.qty) || 0;
      cur.revenue += (Number(item.price) || 0) * (Number(item.qty) || 0);
      perOrderDish.set(key, cur);
    });

    perOrderDish.forEach((row, key) => {
      const cur = dishMap.get(key) || {
        name: row.name,
        orders: 0,
        revenue: 0,
        totalSec: 0,
        samples: 0,
        lateCount: 0
      };
      cur.orders += row.orders;
      cur.revenue += row.revenue;
      cur.totalSec += sec;
      cur.samples += 1;
      if (sec > 300) cur.lateCount += 1;
      dishMap.set(key, cur);
    });
  });

  const topDishes = Array.from(dishMap.values())
    .sort((a, b) => (b.orders - a.orders) || (b.revenue - a.revenue) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 6)
    .map((dish) => ({
      ...dish,
      avgSec: dish.samples ? dish.totalSec / dish.samples : 0,
      delayed: (dish.samples ? (dish.totalSec / dish.samples) : 0) > 300
    }));

  return {
    total: totalOrders,
    totalOrders,
    completed: completedOrders,
    completedOrders,
    avgDuration,
    late: lateOrders,
    lateOrders,
    avgCheck,
    servedGuests,
    typeCounts,
    buckets,
    topDishes,
    filteredCount: filtered.length
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

function debugPeriod(model, filteredCount) {
  console.log(
    "[stats] period=", state.period,
    "ordersRaw=", state.ordersRaw.length,
    "filtered=", filteredCount,
    "totalOrders=", model.totalOrders,
    "completed=", model.completedOrders
  );
}

function renderModel() {
  const pf = el("periodFilter");
  if (pf) state.period = pf.value || "today";
  const start = periodStart(state.period);
  const filtered = filteredOrders();
  const model = computeModel(state.period);
  console.log(
    "[period]", state.period, "start", start.toISOString(),
    "raw", state.ordersRaw.length, "filtered", filtered.length,
    "sampleBest", filtered[0]?._bestAt
  );
  renderCards(model);
  renderBars(model.buckets);
  renderPie(model.typeCounts);
  renderTopDishes(model.topDishes);
  debugPeriod(model, model.filteredCount);
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
    state.period = periodFilter.value || "today";
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
        collectionGroup(db, "items"),
        where("station", "==", "kitchen"),
        orderBy("createdAt", "desc"),
        limit(1500)
      ),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }));
        state.ordersRaw = buildOrderGroupsFromItems(rows);
        renderModel();
      },
      (err) => {
        const msg = String(err?.message || err || "");
        const code = String(err?.code || "").replace("firestore/", "");
        console.error("kitchen statistics items listener error:", {
          code,
          message: msg,
          query: "collectionGroup(items) where station==\"kitchen\" orderBy(createdAt desc) limit(1500)"
        });
        if (code === "failed-precondition") {
          const link = msg.match(/https?:\/\/\S+/)?.[0] || "";
          console.warn("Missing index for kitchen statistics query.", link || "Create index in Firestore Console.");
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
    if (period) state.period = period.value || "today";

    bindPeriodFilter();
    applyLanguage();
    startLiveListeners();
  } catch (err) {
    console.error("statistics init error:", err);
    window.location.href = "../Login/login.html";
  }
});
