// src/BarDashboard/bar-data.js
import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  logAction,
  getEmployee
} from "../js/db.js";
import {
  buildMenuIndexByIdAndName
} from "../js/station-utils.js";
import {
  sendWaiterNotification
} from "../shared/waiter-notifications.js";

const el = (id) => document.getElementById(id);
const norm = (x) => String(x ?? "").trim().toLowerCase();
const LATE_AFTER_SECONDS = 15 * 60;
const DEBUG_SPLIT = false;
const ENABLE_MIRROR = false;
const STATION_BAR = new Set([
  "bar",
  "бар",
  "drink",
  "drinks",
  "beverage",
  "beverages",
  "napitki",
  "напитки",
  "напитка",
  "напит"
]);
const STATION_KITCHEN = new Set([
  "kitchen",
  "кухня",
  "cook",
  "food",
  "храна",
  "ястие",
  "kuhnq"
]);
const DRINK_HINTS = ["drink", "beverage", "напит"];
const DRINK_WORDS = [
  "tea",
  "chai",
  "coffee",
  "espresso",
  "cappuccino",
  "latte",
  "americano",
  "macchiato",
  "cola",
  "coke",
  "pepsi",
  "red bull",
  "monster",
  "чай",
  "кафе",
  "вода",
  "минерал",
  "газира",
  "тоник",
  "лимонада",
  "фреш",
  "айрян",
  "сок",
  "бира",
  "вино",
  "уиски",
  "водка",
  "джин",
  "ром",
  "текила",
  "коняк",
  "бренди",
  "коктейл"
];

const I18N = {
  bg: {
    headerTitle: "Бар Табло",
    roleBar: "Бар",
    profileHint: "Бар таблото показва активните поръчки за напитки.",
    tabOrders: "Поръчки",
    tabMetrics: "Метрики",
    exitBtn: "Изход",
    order: "Поръчка",
    table: "Маса",
    items: "Артикули",
    status: "Статус",
    age: "Време",
    start: "Започни",
    ready: "Готово",
    served: "Сервирано",
    statusNew: "Нова",
    statusPreparing: "В процес",
    statusReady: "Готова",
    statusServed: "Сервирана",
    emptyQueue: "Няма активни бар поръчки.",

    metricRevenueTitle: "Общ приход (днес)",
    metricRevenueSub: "От сервирани напитки",
    metricServedTitle: "Сервирани напитки (днес)",
    metricAvgPrepTitle: "Средно време за приготвяне",
    metricAvgPrepSub: "На база ready/served",
    metricLateTitle: "Закъснели артикули",
    metricLateSub: "Над 15 мин",
    topDrinksTitle: "Топ напитки днес",
    prepTimeTitle: "Статистика време",
    fastestLabel: "Най-бързо",
    averageLabel: "Средно",
    slowestLabel: "Най-бавно",

    sideAvgLabel: "Средно време за приготвяне",
    sideLateLabel: "Закъснели артикули",
    sideTotalLabel: "Поръчки днес",
    statusTitle: "Статус на станция",
    statusSubTitle: "Live броячи",
    sideNewType: "НОВИ",
    sideNewRow: "Нови",
    sidePreparingRow: "В процес",
    sideReadyRow: "Готови",

    noTopDrinks: "Няма данни за топ напитки"
  },
  en: {
    headerTitle: "Bar Dashboard",
    roleBar: "Bar",
    profileHint: "The bar dashboard shows active drink orders.",
    tabOrders: "Orders",
    tabMetrics: "Metrics",
    exitBtn: "Exit",
    order: "Order",
    table: "Table",
    items: "Items",
    status: "Status",
    age: "Age",
    start: "Start",
    ready: "Ready",
    served: "Served",
    statusNew: "New",
    statusPreparing: "Preparing",
    statusReady: "Ready",
    statusServed: "Served",
    emptyQueue: "No active bar orders.",

    metricRevenueTitle: "Total revenue (today)",
    metricRevenueSub: "From served drinks",
    metricServedTitle: "Drinks served (today)",
    metricAvgPrepTitle: "Average prep time",
    metricAvgPrepSub: "Based on ready/served",
    metricLateTitle: "Late items",
    metricLateSub: "Older than 15 min",
    topDrinksTitle: "Top drinks today",
    prepTimeTitle: "Preparation time stats",
    fastestLabel: "Fastest",
    averageLabel: "Average",
    slowestLabel: "Slowest",

    sideAvgLabel: "Average preparation time",
    sideLateLabel: "Late items",
    sideTotalLabel: "Total orders today",
    statusTitle: "Station status",
    statusSubTitle: "Live queue counters",
    sideNewType: "NEW",
    sideNewRow: "New",
    sidePreparingRow: "Preparing",
    sideReadyRow: "Ready",

    noTopDrinks: "No top drinks data"
  }
};

let currentLang = localStorage.getItem("barDashboardLang") || "bg";
let activeItems = [];
let allStationItems = [];
let ordersRaw = [];
let tablesById = new Map();
let menuById = new Map();
let menuByName = new Map();
const menuByIdFromMenus = new Map();
const menuByNameFromMenus = new Map();
const menuByIdFromMenuItems = new Map();
const menuByNameFromMenuItems = new Map();
let refreshTimer = null;
let syncTimer = null;
let syncRunning = false;
let syncAgain = false;
let mirrorEnabled = ENABLE_MIRROR;
let unsubQueue = null;
let unsubAllItems = null;
let unsubOrders = null;
let unsubTables = null;
let unsubMenus = null;
let unsubMenuItems = null;
let unsubRecentOrders = null;
const listenerErrors = {
  queue: "",
  allItems: ""
};

function normalizeFirestoreCode(value) {
  return String(value || "").replace("firestore/", "").trim();
}

function firestoreCode(err) {
  return normalizeFirestoreCode(err?.code || "");
}

function indexLinkFromError(err) {
  return String(err?.message || "").match(/https?:\/\/\S+/)?.[0] || "";
}

function stationUiErrorText(code, message) {
  if (code === "permission-denied") {
    return "Нямаш права: провери employees/{uid} role=bar status=active + rules";
  }
  if (code === "failed-precondition") {
    return "Липсва Firestore index: виж console за линк Create index";
  }
  return `Грешка при зареждане на бар таблото: ${message || "unknown error"}`;
}

function currentStationListenerError() {
  return listenerErrors.queue || listenerErrors.allItems || "";
}

function clearStationListenerError(scope) {
  if (!scope) {
    listenerErrors.queue = "";
    listenerErrors.allItems = "";
    return;
  }

  if (scope === "queue") {
    listenerErrors.queue = "";
    return;
  }

  if (scope === "allItems") {
    listenerErrors.allItems = "";
  }
}

function setDebug(text, scope = "") {
  const msg = String(text || "");
  if (!scope) {
    listenerErrors.queue = msg;
    listenerErrors.allItems = msg;
    return;
  }
  if (scope === "bar queue") {
    listenerErrors.queue = msg;
    return;
  }
  listenerErrors.allItems = msg;
}

function handleStationError(label, err, info) {
  const code = normalizeFirestoreCode(info?.code || err?.code || "");
  const msg = String(info?.message || err?.message || err || "");
  const queryHint = String(
    info?.query ||
    (label === "bar queue"
      ? "collectionGroup(items) where station==\"bar\" orderBy(createdAt asc)"
      : "collectionGroup(items) where station==\"bar\" orderBy(createdAt desc)")
  );
  console.warn(label, { code, msg, query: queryHint, info, err });
  setDebug(`${label}: ${code || "unknown"} — ${msg}`, label);

  if (code === "failed-precondition") {
    const idxLink = indexLinkFromError(err);
    console.warn(`Missing Firestore index for query: ${queryHint}`, idxLink || "Open Firestore Console -> Indexes.");
  }

  setDebug(stationUiErrorText(code, msg), label);
}

function stopOrderMirrorListeners() {
  if (unsubOrders) {
    unsubOrders();
    unsubOrders = null;
  }
  if (unsubMenus) {
    unsubMenus();
    unsubMenus = null;
  }
  if (unsubMenuItems) {
    unsubMenuItems();
    unsubMenuItems = null;
  }
}

function stopTablesListener() {
  if (unsubTables) {
    unsubTables();
    unsubTables = null;
  }
}

function stopRecentOrdersListener() {
  if (unsubRecentOrders) {
    unsubRecentOrders();
    unsubRecentOrders = null;
  }
}

function startRecentOrdersDebugListener() {
  stopRecentOrdersListener();
}

function t(key) {
  return I18N[currentLang]?.[key] || I18N.en[key] || key;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>\"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[m]));
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return (ts.seconds * 1000) + Math.floor((ts.nanoseconds || 0) / 1000000);
  const n = Number(ts);
  return Number.isFinite(n) ? n : 0;
}

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatMMSS(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatEUR(amount) {
  return `${Number(amount || 0).toFixed(2)} EUR`;
}

function orderIdFromPath(path) {
  const m = String(path || "").match(/^orders\/([^/]+)\/items\//);
  return m ? m[1] : "unknown";
}

function firstText(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function unknownTableLabel() {
  return currentLang === "bg" ? "Неизвестна маса" : "Unknown table";
}

function tableDocLabel(tableDoc, fallbackId = "") {
  return firstText(
    tableDoc?.number,
    tableDoc?.tableNumber,
    tableDoc?.name,
    tableDoc?.title,
    fallbackId
  );
}

function resolveTableLabel(item, order = null) {
  const direct = firstText(
    item?.table,
    item?.tableNumber,
    item?.tableName,
    order?.table,
    order?.tableNumber,
    order?.tableName
  );
  if (direct) return direct;

  const tableId = firstText(item?.tableId, order?.tableId);
  if (!tableId) return "";
  return tableDocLabel(tablesById.get(String(tableId)), String(tableId));
}

function statusLabel(st) {
  const s = norm(st);
  if (s === "new") return t("statusNew");
  if (s === "in_progress") return t("statusPreparing");
  if (s === "done") return t("statusReady");
  return st || "-";
}

function timerClass(seconds) {
  if (seconds >= LATE_AFTER_SECONDS) return "danger";
  if (seconds >= Math.floor(LATE_AFTER_SECONDS * 0.66)) return "warning";
  return "";
}

function normalizeStationValue(value) {
  const key = norm(value);
  if (!key) return "";
  if (STATION_BAR.has(key)) return "bar";
  if (STATION_KITCHEN.has(key)) return "kitchen";
  return "";
}

function looksLikeDrink(category, type, name, menuName, menuCategory) {
  const categoryText = [category, type, menuCategory].map(norm).join(" ");
  if (DRINK_HINTS.some((hint) => categoryText.includes(hint))) return true;

  const nameText = [name, menuName].map(norm).join(" ");
  return DRINK_WORDS.some((word) => nameText.includes(word));
}

function itemStation(item, name) {
  return normalizeStationValue(
    item?.station || item?.targetStation || item?.department || item?.prepStation || item?.destination
  );
}

function orderItems(order) {
  const list = Array.isArray(order?.items) ? order.items : [];
  return list.map((it) => {
    const name = String(
      it?.name || it?.title || it?.label || it?.itemName || it?.productName || it?.itemId || it?.menuId || ""
    ).trim();
    return { ...it, name };
  });
}

function splitOrderItems(order) {
  const items = orderItems(order);
  const kitchenItems = [];
  const barItems = [];

  if (DEBUG_SPLIT) {
    console.group("ORDER DEBUG:", order?.id || "no-id");
    console.log("Original items:", order?.items);
  }

  items.forEach((it, idx) => {
    const name = String(it?.name || it?.itemId || it?.menuId || `Item ${idx + 1}`).trim();
    if (!name) return;

    const station = itemStation(it, name);
    if (station !== "bar" && station !== "kitchen") return;
    const menu = menuByName.get(norm(name));

    const normalizedItem = {
      ...it,
      name,
      qty: Math.max(1, Number(it?.qty ?? it?.quantity ?? it?.count ?? it?.q) || 1),
      price: Number(it?.price ?? it?.unitPrice ?? it?.unit_price ?? it?.cost) || 0,
      notes: String(it?.notes || it?.note || it?.comment || "").trim(),
      menuId: String(it?.menuId || it?.itemId || "").trim(),
      itemId: String(it?.itemId || it?.menuId || "").trim(),
      category: String(it?.category || menu?.category || "").trim(),
      station
    };

    if (station === "bar") barItems.push(normalizedItem);
    else kitchenItems.push(normalizedItem);
  });

  if (DEBUG_SPLIT) {
    console.log("Kitchen Items:", kitchenItems);
    console.log("Bar Items:", barItems);

    const wrongInKitchen = kitchenItems.filter((i) => normalizeStationValue(i.station) !== "kitchen");
    const wrongInBar = barItems.filter((i) => normalizeStationValue(i.station) !== "bar");

    if (wrongInKitchen.length > 0) {
      console.error("❌ DRINK FOUND IN KITCHEN:", wrongInKitchen);
    }

    if (wrongInBar.length > 0) {
      console.error("❌ FOOD FOUND IN BAR:", wrongInBar);
    }

    if (kitchenItems.length === 0 && barItems.length === 0) {
      console.warn("⚠️ ORDER HAS NO VALID ITEMS AFTER SPLIT");
    }

    console.groupEnd();
  }

  return { kitchenItems, barItems };
}

function barItems(order) {
  return splitOrderItems(order).barItems;
}

function refreshMenuIndex() {
  const rows = [];
  menuByIdFromMenus.forEach((value) => rows.push(value));
  menuByIdFromMenuItems.forEach((value) => rows.push(value));
  const merged = buildMenuIndexByIdAndName(rows);
  menuById = merged.byId;
  menuByName = merged.byName;
}

function applyMenuSnapshot(targetById, targetByName, snap) {
  targetById.clear();
  targetByName.clear();
  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, ...(d.data() || {}) }));
  const index = buildMenuIndexByIdAndName(rows);
  index.byId.forEach((value, key) => targetById.set(key, value));
  index.byName.forEach((value, key) => targetByName.set(key, value));

  refreshMenuIndex();
  scheduleOrderSync();
}

function barStatusFromOrder(order) {
  const bs = norm(order?.barStatus || order?.bar_status || order?.drinkStatus);
  if (["new", "pending", "created"].includes(bs)) return "new";
  if (["preparing", "in_progress", "in-progress", "mixing", "cooking"].includes(bs)) return "preparing";
  if (["ready", "done"].includes(bs)) return "ready";
  if (["served"].includes(bs)) return "served";

  const os = norm(order?.status);
  if (["paid", "closed", "cancelled"].includes(os)) return "served";
  if (os === "ready") return "ready";
  return "new";
}

function queueKeyFor(orderId, item) {
  const menuId = norm(item?.menuId || "");
  const name = norm(item?.name || item?.itemId || "");
  const price = Number(item?.price || 0).toFixed(2);
  return `${String(orderId || "")}|${menuId}|${name}|${price}`;
}

function queueKeyFromStationItem(item) {
  if (item?.queueKey) return String(item.queueKey);
  return queueKeyFor(orderIdFromPath(item?.path), item);
}

function drinkItemsFromOrder(order) {
  const orderId = String(order?.id || "").trim();
  const strictBarItems = barItems(order);
  return strictBarItems.map((item, index) => ({
    ...item,
    queueKey: `${queueKeyFor(orderId, item)}|${index}`
  }));
}

function virtualBarItemsFromOrders({ activeOnly = false } = {}) {
  const out = [];
  for (const order of ordersRaw) {
    const orderId = String(order?.id || "").trim();
    if (!orderId) continue;

    const status = barStatusFromOrder(order);
    if (activeOnly && !["new", "preparing", "ready"].includes(status)) continue;

    const drinks = drinkItemsFromOrder(order);
    if (!drinks.length) continue;
    drinks.forEach((item, idx) => {
      out.push({
        ...item,
        status,
        createdAt: order?.createdAt || null,
        startedAt: order?.barStartedAt || null,
        readyAt: order?.barReadyAt || null,
        servedAt: order?.barServedAt || null,
        path: `orders/${orderId}/items/virtual-${idx}`,
        virtual: true
      });
    });
  }
  return out;
}

function mergeWithVirtual(primaryItems, virtualItems) {
  const out = [...primaryItems];
  const seen = new Set(primaryItems.map((i) => queueKeyFromStationItem(i)));
  for (const item of virtualItems) {
    const key = queueKeyFromStationItem(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function queuePayloadFromOrder(order, item) {
  const status = barStatusFromOrder(order);
  const createdAt = order?.createdAt || serverTimestamp();
  const updatedAt = order?.updatedAt || serverTimestamp();

  const payload = {
    queueKey: item.queueKey,
    menuId: item.menuId || "",
    name: item.name,
    qty: Number(item.qty || 1),
    price: Number(item.price || 0),
    station: "bar",
    status,
    source: "order_mirror",
    createdBy: order?.createdBy || order?.waiterId || null,
    createdAt
  };

  if (status === "preparing") payload.startedAt = order?.barStartedAt || updatedAt;
  if (status === "ready") {
    payload.startedAt = order?.barStartedAt || createdAt;
    payload.readyAt = order?.barReadyAt || updatedAt;
  }
  if (status === "served") {
    payload.startedAt = order?.barStartedAt || createdAt;
    payload.readyAt = order?.barReadyAt || updatedAt;
    payload.servedAt = order?.barServedAt || updatedAt;
  }

  return payload;
}

function isMutableQueueStatus(st) {
  const s = norm(st);
  return !s || s === "new" || s === "preparing" || s === "ready";
}

function disableMirror(reason, err) {
  if (!mirrorEnabled) return;
  mirrorEnabled = false;

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  syncRunning = false;
  syncAgain = false;
  ordersRaw = [];
  stopOrderMirrorListeners();

  const code = firestoreCode(err);
  const message = String(err?.message || reason || "mirror disabled");
  console.warn("mirror disabled", { reason, code, message });

  renderAll();
}

function scheduleOrderSync() {
  if (!mirrorEnabled) return;
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncBarQueueFromOrders().catch((err) => {
      if (firestoreCode(err) === "permission-denied") {
        disableMirror("permission-denied", err);
        return;
      }
      console.warn("bar order sync error:", err);
    });
  }, 140);
}

async function syncBarQueueFromOrders() {
  if (!mirrorEnabled) return;
  if (syncRunning) {
    syncAgain = true;
    return;
  }
  syncRunning = true;

  try {
    const minMs = startOfTodayMs() - (24 * 60 * 60 * 1000);
    const existingByKey = new Map();
    for (const item of allStationItems) {
      existingByKey.set(queueKeyFromStationItem(item), item);
    }

    for (const order of ordersRaw) {
      const orderId = String(order?.id || "").trim();
      if (!orderId) continue;
      const createdMs = tsToMs(order?.createdAt);
      if (createdMs && createdMs < minMs) continue;

      const drinks = drinkItemsFromOrder(order);
      if (!drinks.length) continue;

      for (const drink of drinks) {
        const key = drink.queueKey;
        const existing = existingByKey.get(key);

        if (!existing) {
          try {
            const payload = queuePayloadFromOrder(order, drink);
            const ref = await addDoc(collection(db, "orders", orderId, "items"), payload);
            existingByKey.set(key, { ...payload, path: `orders/${orderId}/items/${ref.id}` });
          } catch (err) {
            if (firestoreCode(err) === "permission-denied") {
              disableMirror("permission-denied", err);
              return;
            }
            console.warn("bar mirror create failed:", err);
          }
          continue;
        }

        if (!existing.path) continue;
        if (!isMutableQueueStatus(existing.status)) continue;

        const patch = {};
        const wantQty = Number(drink.qty || 1);
        const haveQty = Number(existing.qty || 1);
        if (wantQty !== haveQty) patch.qty = wantQty;

        const wantPrice = Number(drink.price || 0);
        const havePrice = Number(existing.price || 0);
        if (wantPrice !== havePrice) patch.price = wantPrice;

        if (String(existing.name || "") !== String(drink.name || "")) patch.name = drink.name;
        if (String(existing.menuId || "") !== String(drink.menuId || "")) patch.menuId = drink.menuId || "";

        if (Object.keys(patch).length) {
          patch.updatedAt = serverTimestamp();
          try {
            await updateDoc(doc(db, existing.path), patch);
          } catch (err) {
            if (firestoreCode(err) === "permission-denied") {
              disableMirror("permission-denied", err);
              return;
            }
            console.warn("bar mirror update failed:", err);
          }
        }
      }
    }
  } finally {
    syncRunning = false;
    if (syncAgain) {
      syncAgain = false;
      void syncBarQueueFromOrders();
    }
  }
}

function startOrderMirrorListeners() {
  // Mirror mode intentionally disabled: bar queue must rely only on collectionGroup("items").
  return;
}

function groupByOrder(items) {
  const now = Date.now();
  const map = new Map();

  for (const item of items) {
    const station = normalizeStationValue(item?.station);
    if (!station) {
      console.warn("[bar] item missing station, skipped", item);
      continue;
    }
    if (station !== "bar") {
      continue;
    }

    const orderId = orderIdFromPath(item.path);
    const createdMs = tsToMs(item.createdAt) || now;
    const qty = Number(item.qty || 1);

    if (!map.has(orderId)) {
      map.set(orderId, {
        orderId,
        shortId: orderId.slice(0, 6),
        newestCreatedMs: createdMs,
        hasInProgress: false,
        table: "",
        tableId: "",
        tableName: "",
        tableNumber: "",
        items: []
      });
    }

    const g = map.get(orderId);
    const status = norm(item.status || "new");
    if (status === "done") continue;
    if (status === "in_progress") g.hasInProgress = true;
    g.newestCreatedMs = Math.max(g.newestCreatedMs, createdMs);

    const resolvedTable = resolveTableLabel(item);
    const tableId = firstText(item?.tableId);
    const tableName = firstText(item?.tableName);
    const tableNumber = firstText(item?.tableNumber);

    if (!g.table && resolvedTable) g.table = resolvedTable;
    if (!g.tableId && tableId) g.tableId = tableId;
    if (!g.tableName && tableName) g.tableName = tableName;
    if (!g.tableNumber && tableNumber) g.tableNumber = tableNumber;

    g.items.push({
      ...item,
      qty,
      createdMs,
      ageSec: Math.floor((now - createdMs) / 1000),
      table: resolvedTable,
      tableId,
      tableName,
      tableNumber
    });
  }

  return Array.from(map.values())
    .sort((a, b) => b.newestCreatedMs - a.newestCreatedMs)
    .map((g) => ({
      ...g,
      status: g.hasInProgress ? "in_progress" : "new",
      ageSec: Math.floor((now - g.newestCreatedMs) / 1000)
    }));
}

function flattenBarQueueEntries(groups) {
  return groups.flatMap((group) =>
    group.items.map((item, index) => ({
      entryKey: `${group.orderId}:${item.id || item.path || item.queueKey || index}`,
      orderId: group.orderId,
      shortId: group.shortId,
      status: group.hasInProgress ? "in_progress" : "new",
      ageSec: group.ageSec,
      table: resolveTableLabel(item, group),
      item
    }))
  );
}

function findBarItemByPath(itemPath) {
  const targetPath = String(itemPath || "").trim();
  if (!targetPath) return null;
  return activeItems.find((item) => String(item?.path || "").trim() === targetPath) || null;
}

function minBarDate(values) {
  let out = null;
  values.forEach((value) => {
    const ms = tsToMs(value);
    if (ms <= 0) return;
    if (!out || ms < out.getTime()) out = new Date(ms);
  });
  return out;
}

function maxBarDate(values) {
  let out = null;
  values.forEach((value) => {
    const ms = tsToMs(value);
    if (ms <= 0) return;
    if (!out || ms > out.getTime()) out = new Date(ms);
  });
  return out;
}

function summarizeBarStationItems(items) {
  const stationItems = Array.isArray(items) ? items : [];
  if (!stationItems.length) return null;

  const statuses = stationItems.map((item) => norm(item?.status || "new"));
  const allDone = statuses.every((status) => status === "done");
  const anyInProgress = statuses.some((status) => status === "in_progress");
  const anyStarted = statuses.some((status) => status === "in_progress" || status === "done");

  return {
    allDone,
    barStatus: allDone ? "done" : (anyInProgress ? "in_progress" : "new"),
    barStartedAt: anyStarted
      ? minBarDate(stationItems.map((item) => item?.startedAt || item?.createdAt))
      : null,
    barReadyAt: allDone
      ? maxBarDate(stationItems.map((item) => item?.doneAt || item?.readyAt))
      : null
  };
}

async function syncBarOrderSummary(orderId) {
  const orderIdValue = String(orderId || "").trim();
  if (!orderIdValue) return null;

  const snap = await getDocs(
    query(
      collection(db, "orders", orderIdValue, "items"),
      where("station", "==", "bar")
    )
  );

  const stationItems = snap.docs.map((itemSnap) => ({
    id: itemSnap.id,
    path: itemSnap.ref.path,
    ...itemSnap.data()
  }));
  const summary = summarizeBarStationItems(stationItems);
  if (!summary) return null;

  await updateDoc(doc(db, "orders", orderIdValue), {
    barStatus: summary.barStatus,
    barStartedAt: summary.barStartedAt || null,
    barReadyAt: summary.allDone ? (summary.barReadyAt || new Date()) : null,
    barUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return summary;
}

async function notifyWaiterFromBar(type, orderId, item) {
  try {
    const tableLabel = resolveTableLabel(item) || unknownTableLabel();
    const result = await sendWaiterNotification(db, {
      type,
      station: "bar",
      item,
      order: {
        id: orderId,
        tableLabel
      },
      orderId
    });
    const payload = result.payload || {};
    const actionLabel = type === "item_ready" ? "READY" : "START";
    const itemName = payload.itemName || String(item?.name || "").trim() || "Неизвестен артикул";

    if (result.sent) {
      console.log(`[WaiterNotify] ${actionLabel} sent -> bar | ${payload.tableLabel || tableLabel} | ${itemName}`);
      return;
    }

    if (result.duplicate) {
      console.info(`[WaiterNotify] ${actionLabel} duplicate skipped -> bar | ${payload.tableLabel || tableLabel} | ${itemName}`);
    }
  } catch (err) {
    console.warn("bar waiter notification failed:", {
      orderId,
      itemPath: item?.path || "",
      err
    });
  }
}

async function updateBarItemStatus(orderId, itemPath, nextStatus, contextItem = null) {
  const orderIdValue = String(orderId || "").trim();
  const itemPathValue = String(itemPath || "").trim();
  const status = norm(nextStatus);

  if (!orderIdValue || !itemPathValue) return 0;
  if (!["in_progress", "done"].includes(status)) return 0;

  const item = contextItem || findBarItemByPath(itemPathValue);
  if (!item) throw new Error("Missing bar item context");

  const payload = {
    status,
    updatedAt: serverTimestamp()
  };
  if (status === "in_progress") payload.startedAt = serverTimestamp();
  if (status === "done") {
    payload.doneAt = serverTimestamp();
    payload.readyAt = serverTimestamp();
  }

  await updateDoc(doc(db, itemPathValue), payload);

  try {
    await syncBarOrderSummary(orderIdValue);
  } catch (summaryErr) {
    console.warn("bar summary update failed:", summaryErr);
  }

  await notifyWaiterFromBar(
    status === "done" ? "item_ready" : "item_started",
    orderIdValue,
    item
  );

  await logAction({
    actorUid: auth.currentUser?.uid || null,
    actorEmail: auth.currentUser?.email || null,
    type: "ORDER",
    message: `Bar item status -> ${status}`,
    meta: { orderId: orderIdValue, itemPath: itemPathValue, status }
  });

  return 1;
}

async function updateBarOrderItemsStatus(orderId, nextStatus) {
  const orderIdValue = String(orderId || "").trim();
  const status = norm(nextStatus);
  if (!orderIdValue) return 0;
  if (!["in_progress", "done"].includes(status)) return 0;

  const fromStatus = status === "in_progress" ? "new" : "in_progress";
  const itemsRef = query(
    collection(db, "orders", orderIdValue, "items"),
    where("station", "==", "bar"),
    where("status", "==", fromStatus)
  );
  const snap = await getDocs(itemsRef);
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  let updatedCount = 0;
  snap.forEach((d) => {
    const payload = { status, updatedAt: serverTimestamp() };
    if (status === "in_progress") payload.startedAt = serverTimestamp();
    if (status === "done") {
      payload.doneAt = serverTimestamp();
      payload.readyAt = serverTimestamp();
    }
    batch.update(d.ref, payload);
    updatedCount += 1;
  });
  await batch.commit();

  await logAction({
    actorUid: auth.currentUser?.uid || null,
    actorEmail: auth.currentUser?.email || null,
    type: "ORDER",
    message: `Bar order status -> ${status}`,
    meta: { orderId: orderIdValue, status, updatedCount }
  });

  return updatedCount;
}

function bindActionButtons() {
  document.querySelectorAll(".barOrderActionBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await updateBarItemStatus(
          btn.dataset.orderId,
          btn.dataset.itemPath,
          btn.dataset.nextStatus,
          findBarItemByPath(btn.dataset.itemPath)
        );
      } catch (e) {
        console.error("bar status update error:", e);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function renderQueue() {
  const box = el("barQueue");
  if (!box) return;

  const uiError = currentStationListenerError();
  if (uiError) {
    box.innerHTML = `<div class="order-card"><div class="drink-item">${escapeHtml(uiError)}</div></div>`;
    return;
  }

  const groups = groupByOrder(activeItems);
  const top10Groups = groups.slice(0, 10);
  const entries = flattenBarQueueEntries(top10Groups);

  if (DEBUG_SPLIT) {
    console.log("BAR GROUPS:", { total: groups.length, renderedOrders: top10Groups.length, renderedItems: entries.length });
  }

  if (!entries.length) {
    box.innerHTML = `<div class="order-card"><div class="drink-item">${escapeHtml(t("emptyQueue"))}</div></div>`;
    return;
  }

  box.innerHTML = entries.map((entry) => {
    const item = entry.item;
    const st = norm(item.status);
    const tableText = entry.table || unknownTableLabel();

    if (DEBUG_SPLIT) {
      console.log("Rendering BAR item:", entry.orderId, item?.name);
    }

    return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-info">
            <div class="order-number">${escapeHtml(t("order"))} #${escapeHtml(entry.shortId)}</div>
            <div class="table-info">${escapeHtml(t("table"))}: ${escapeHtml(tableText)}</div>
          </div>
          <div class="order-time ${timerClass(entry.ageSec)}">${formatMMSS(entry.ageSec)}</div>
        </div>

        <div class="drink-item">
          <div>${escapeHtml(item.name)} x${Number(item.qty || 1)}</div>
          <div class="drink-note">${escapeHtml(t("status"))}: ${escapeHtml(statusLabel(st))} • ${escapeHtml(t("age"))}: ${formatMMSS(item.ageSec)}</div>
        </div><!--
              <div>${escapeHtml(item.name)} × ${Number(item.qty || 1)}</div>
              <div class="drink-note">${escapeHtml(t("status"))}: ${escapeHtml(statusLabel(st))} • ${escapeHtml(t("age"))}: ${formatMMSS(item.ageSec)}</div>
        --><div style="display:flex; gap:8px; margin-top:10px;">
          ${
            st === "in_progress"
              ? `<button class="btn btn-ready barOrderActionBtn" data-order-id="${escapeHtml(entry.orderId)}" data-item-path="${escapeHtml(item.path || "")}" data-next-status="done">${escapeHtml(t("ready"))}</button>`
              : `<button class="btn btn-start barOrderActionBtn" data-order-id="${escapeHtml(entry.orderId)}" data-item-path="${escapeHtml(item.path || "")}" data-next-status="in_progress">${escapeHtml(t("start"))}</button>`
          }
        </div>
      </div>
    `;
  }).join("");

  bindActionButtons();
}

function computeStats() {
  const nowMs = Date.now();
  const todayMs = startOfTodayMs();

  const todayItems = allStationItems.filter((i) => tsToMs(i.createdAt) >= todayMs);
  const active = activeItems;

  const newCount = active.filter((i) => norm(i.status) === "new").length;
  const preparingCount = active.filter((i) => norm(i.status) === "in_progress").length;
  const readyCount = active.filter((i) => norm(i.status) === "done").length;

  const lateCount = active.filter((i) => {
    const ageSec = Math.floor((nowMs - tsToMs(i.createdAt)) / 1000);
    return ageSec >= LATE_AFTER_SECONDS;
  }).length;

  const orderIds = new Set(todayItems.map((i) => orderIdFromPath(i.path)));

  const finishedItems = todayItems.filter((i) => {
    const st = norm(i.status);
    return st === "done";
  });

  const servedOnly = todayItems.filter((i) => norm(i.status) === "done");

  const revenue = servedOnly.reduce((sum, i) => {
    return sum + (Number(i.price || 0) * Number(i.qty || 1));
  }, 0);

  const prepDurations = finishedItems
    .map((i) => {
      const started = tsToMs(i.startedAt) || tsToMs(i.createdAt);
      const done = tsToMs(i.doneAt) || tsToMs(i.servedAt) || tsToMs(i.readyAt);
      return (started > 0 && done > started) ? (done - started) : 0;
    })
    .filter((ms) => ms > 0);

  const avgPrepMs = prepDurations.length
    ? Math.floor(prepDurations.reduce((a, b) => a + b, 0) / prepDurations.length)
    : 0;

  const fastestMs = prepDurations.length ? Math.min(...prepDurations) : 0;
  const slowestMs = prepDurations.length ? Math.max(...prepDurations) : 0;

  const byName = new Map();
  for (const i of todayItems) {
    const name = String(i.name || "Unknown");
    const qty = Number(i.qty || 1);
    const amount = Number(i.price || 0) * qty;

    if (!byName.has(name)) {
      byName.set(name, { name, qty: 0, revenue: 0 });
    }
    const row = byName.get(name);
    row.qty += qty;
    row.revenue += amount;
  }

  const topDrinks = Array.from(byName.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    newCount,
    preparingCount,
    readyCount,
    lateCount,
    totalOrders: orderIds.size,
    servedCount: servedOnly.reduce((sum, i) => sum + Number(i.qty || 1), 0),
    inProgressCount: newCount + preparingCount,
    revenue,
    avgPrepMs,
    fastestMs,
    slowestMs,
    topDrinks
  };
}

function renderTopDrinks(topDrinks) {
  const box = el("topDrinksList");
  if (!box) return;

  if (!topDrinks.length) {
    box.innerHTML = `<div class="drink-list-item"><div class="drink-details">${escapeHtml(t("noTopDrinks"))}</div></div>`;
    return;
  }

  box.innerHTML = topDrinks.map((row, idx) => `
    <div class="drink-list-item">
      <div class="drink-rank">${idx + 1}</div>
      <div class="drink-details">
        <div class="drink-list-name">${escapeHtml(row.name)}</div>
      </div>
      <div class="drink-stats">
        <div class="drink-count">${row.qty}</div>
        <div class="drink-revenue">${formatEUR(row.revenue)}</div>
      </div>
    </div>
  `).join("");
}

function renderMetrics() {
  const s = computeStats();

  if (el("metricRevenue")) el("metricRevenue").textContent = formatEUR(s.revenue);
  if (el("metricServed")) el("metricServed").textContent = String(s.servedCount);
  if (el("metricInProgressSub")) el("metricInProgressSub").textContent = `${s.inProgressCount} ${currentLang === "bg" ? "в процес" : "in progress"}`;
  if (el("metricAvgPrep")) el("metricAvgPrep").textContent = formatMMSS(Math.floor(s.avgPrepMs / 1000));
  if (el("metricLate")) el("metricLate").textContent = String(s.lateCount);

  if (el("prepFastest")) el("prepFastest").textContent = formatMMSS(Math.floor(s.fastestMs / 1000));
  if (el("prepAverage")) el("prepAverage").textContent = formatMMSS(Math.floor(s.avgPrepMs / 1000));
  if (el("prepSlowest")) el("prepSlowest").textContent = formatMMSS(Math.floor(s.slowestMs / 1000));

  if (el("sideAvgPrep")) el("sideAvgPrep").textContent = formatMMSS(Math.floor(s.avgPrepMs / 1000));
  if (el("sideLateItems")) el("sideLateItems").textContent = String(s.lateCount);
  if (el("sideTotalOrders")) el("sideTotalOrders").textContent = String(s.totalOrders);

  if (el("sideNewCount")) el("sideNewCount").textContent = String(s.newCount);
  if (el("sidePreparingCount")) el("sidePreparingCount").textContent = String(s.preparingCount);
  if (el("sideReadyCount")) el("sideReadyCount").textContent = String(s.readyCount);

  if (el("metricsBadge")) el("metricsBadge").textContent = String(s.lateCount);

  renderTopDrinks(s.topDrinks);
}

function renderTexts() {
  if (el("headerTitle")) el("headerTitle").textContent = t("headerTitle");
  if (el("modalExitBtn")) el("modalExitBtn").textContent = t("exitBtn");
  if (el("barProfileRole")) el("barProfileRole").textContent = t("roleBar");
  if (el("barProfileHint")) el("barProfileHint").textContent = t("profileHint");
  if (el("tabOrders")) el("tabOrders").textContent = t("tabOrders");
  if (el("tabMetrics")) {
    const badge = `<span class="notification-badge" id="metricsBadge">${el("metricsBadge")?.textContent || "0"}</span>`;
    el("tabMetrics").innerHTML = `${escapeHtml(t("tabMetrics"))} ${badge}`;
  }

  if (el("metricRevenueTitle")) el("metricRevenueTitle").textContent = t("metricRevenueTitle");
  if (el("metricRevenueSub")) el("metricRevenueSub").textContent = t("metricRevenueSub");
  if (el("metricServedTitle")) el("metricServedTitle").textContent = t("metricServedTitle");
  if (el("metricAvgPrepTitle")) el("metricAvgPrepTitle").textContent = t("metricAvgPrepTitle");
  if (el("metricAvgPrepSub")) el("metricAvgPrepSub").textContent = t("metricAvgPrepSub");
  if (el("metricLateTitle")) el("metricLateTitle").textContent = t("metricLateTitle");
  if (el("metricLateSub")) el("metricLateSub").textContent = t("metricLateSub");

  if (el("topDrinksTitle")) el("topDrinksTitle").textContent = t("topDrinksTitle");
  if (el("prepTimeTitle")) el("prepTimeTitle").textContent = t("prepTimeTitle");
  if (el("fastestLabel")) el("fastestLabel").textContent = t("fastestLabel");
  if (el("averageLabel")) el("averageLabel").textContent = t("averageLabel");
  if (el("slowestLabel")) el("slowestLabel").textContent = t("slowestLabel");

  if (el("sideAvgLabel")) el("sideAvgLabel").textContent = t("sideAvgLabel");
  if (el("sideLateLabel")) el("sideLateLabel").textContent = t("sideLateLabel");
  if (el("sideTotalLabel")) el("sideTotalLabel").textContent = t("sideTotalLabel");
  if (el("statusTitle")) el("statusTitle").textContent = t("statusTitle");
  if (el("statusSubTitle")) el("statusSubTitle").textContent = t("statusSubTitle");
  if (el("sideNewType")) el("sideNewType").textContent = t("sideNewType");
  if (el("sideNewRow")) el("sideNewRow").innerHTML = `${escapeHtml(t("sideNewRow"))}: <span id="sideNewCount">${el("sideNewCount")?.textContent || "0"}</span>`;
  if (el("sidePreparingRow")) el("sidePreparingRow").innerHTML = `${escapeHtml(t("sidePreparingRow"))}: <span id="sidePreparingCount">${el("sidePreparingCount")?.textContent || "0"}</span>`;
  if (el("sideReadyRow")) el("sideReadyRow").innerHTML = `${escapeHtml(t("sideReadyRow"))}: <span id="sideReadyCount">${el("sideReadyCount")?.textContent || "0"}</span>`;

  if (el("modalLangBtn")) el("modalLangBtn").textContent = currentLang === "bg" ? "EN" : "BG";
}

function renderAll() {
  renderTexts();
  renderQueue();
  renderMetrics();
}

function openBarProfileModal() {
  const modal = el("barProfileModal");
  const nameEl = el("barUserName");
  const profileName = el("barProfileName");
  const profileEmail = el("barProfileEmail");
  if (modal) {
    if (profileName && nameEl) profileName.textContent = nameEl?.textContent || "—";
    if (profileEmail) profileEmail.textContent = (typeof window !== "undefined" && window.__barEmail) ? window.__barEmail : "—";
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}

function closeBarProfileModal() {
  const modal = el("barProfileModal");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
}

function bindHeaderActions() {
  const openProfileBtn = el("openProfileBtn");
  if (openProfileBtn) {
    openProfileBtn.addEventListener("click", openBarProfileModal);
  }

  document.querySelectorAll("[data-close-bar-profile]").forEach((node) => {
    node.addEventListener("click", closeBarProfileModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = el("barProfileModal");
      if (modal && modal.getAttribute("aria-hidden") === "false") closeBarProfileModal();
    }
  });

  const modalLangBtn = el("modalLangBtn");
  if (modalLangBtn) {
    modalLangBtn.addEventListener("click", () => {
      if (typeof window.toggleLanguage === "function") window.toggleLanguage();
    });
  }

  const modalExitBtn = el("modalExitBtn");
  if (modalExitBtn) {
    modalExitBtn.addEventListener("click", () => {
      closeBarProfileModal();
      if (typeof window.logout === "function") window.logout();
    });
  }
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const ordersSection = el("orders-section");
  const metricsSection = el("metrics-section");

  const setTab = (tabName) => {
    tabs.forEach((tBtn) => tBtn.classList.toggle("active", tBtn.dataset.tab === tabName));

    if (ordersSection) ordersSection.classList.toggle("active", tabName === "orders");
    if (metricsSection) metricsSection.classList.toggle("active", tabName === "metrics");
  };

  tabs.forEach((tBtn) => {
    tBtn.addEventListener("click", () => setTab(tBtn.dataset.tab || "orders"));
  });
}

function startLiveClockRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    renderQueue();
    renderMetrics();
  }, 1000);
}

window.toggleLanguage = () => {
  currentLang = currentLang === "bg" ? "en" : "bg";
  localStorage.setItem("barDashboardLang", currentLang);
  renderAll();
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../Login/login.html";
    return;
  }

  let me = null;
  try {
    me = await getEmployee(user.uid);
  } catch (err) {
    console.warn("bar employee load failed:", err);
    me = null;
  }

  if (typeof window !== "undefined") window.__barEmail = user.email || null;
  /* barUserName is updated by bar-name-live.js (same as Manager/Kitchen) */

  if (unsubQueue) unsubQueue();
  if (unsubAllItems) unsubAllItems();
  stopTablesListener();
  stopOrderMirrorListeners();
  stopRecentOrdersListener();

  mirrorEnabled = ENABLE_MIRROR;
  ordersRaw = [];
  tablesById.clear();
  clearStationListenerError();

  const role = norm(me?.role);
  const status = norm(me?.status);
  const hasAccess = Boolean(me) && role === "bar" && status === "active";
  if (!hasAccess) {
    const accessMsg = "❌ Нямаш активна роля. В employees/{uid} трябва role='bar' и status='active'.";
    console.warn("bar access check failed", { uid: user.uid, role, status, me });
    activeItems = [];
    allStationItems = [];
    tablesById.clear();
    setDebug(accessMsg);
    renderAll();
    return;
  }

  const qQueue = query(
    collectionGroup(db, "items"),
    where("station", "==", "bar"),
    where("status", "in", ["new", "in_progress"]),
    orderBy("createdAt", "asc"),
    limit(300)
  );

  unsubQueue = onSnapshot(
    qQueue,
    (snap) => {
      clearStationListenerError("queue");
      activeItems = snap.docs.map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }));
      renderAll();
    },
    (err) => {
      handleStationError("bar queue", err, {
        query: "collectionGroup(items) where station==\"bar\" where status in [new,in_progress] orderBy(createdAt asc) limit(300)"
      });
      activeItems = [];
      renderAll();
    }
  );

  const qAll = query(
    collectionGroup(db, "items"),
    where("station", "==", "bar"),
    where("status", "in", ["new", "in_progress", "done"]),
    orderBy("createdAt", "desc"),
    limit(1000)
  );

  unsubAllItems = onSnapshot(
    qAll,
    (snap) => {
      clearStationListenerError("allItems");
      allStationItems = snap.docs.map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }));
      renderMetrics();
      scheduleOrderSync();
    },
    (err) => {
      handleStationError("bar all-items", err, {
        query: "collectionGroup(items) where station==\"bar\" where status in [new,in_progress,done] orderBy(createdAt desc) limit(1000)"
      });
      allStationItems = [];
      renderAll();
    }
  );

  unsubTables = onSnapshot(
    query(collection(db, "tables"), orderBy("number", "asc")),
    (snap) => {
      const next = new Map();
      snap.forEach((d) => next.set(String(d.id), d.data() || {}));
      tablesById = next;
      renderQueue();
    },
    (err) => {
      console.warn("bar tables listener failed:", err);
      tablesById.clear();
      renderQueue();
    }
  );

  if (mirrorEnabled) {
    startOrderMirrorListeners();
  } else {
    console.info("mirror disabled");
  }

  setupTabs();
  startLiveClockRefresh();
  renderAll();
});

bindHeaderActions();

window.addEventListener("beforeunload", () => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (syncTimer) clearTimeout(syncTimer);
  if (unsubQueue) unsubQueue();
  if (unsubAllItems) unsubAllItems();
  stopTablesListener();
  stopOrderMirrorListeners();
  stopRecentOrdersListener();
});
