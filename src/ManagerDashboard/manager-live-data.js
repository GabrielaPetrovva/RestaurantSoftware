import { db } from "./firebase.js";
import {
  collection,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { normalizeStationValue, looksLikeCake, looksLikeDrink } from "../js/station-utils.js";

const PAGE_SIZE = 1000;
const FINAL_REVENUE_STATUSES = new Set(["paid", "closed", "completed", "complete", "served", "done", "finished"]);
const NON_REVENUE_STATUSES = new Set(["cancelled", "canceled", "rejected", "deleted", "void", "refunded"]);
const BAR_CATEGORY_HINTS = ["напитка", "напитки", "drink", "drinks", "beverage", "beverages", "alcohol", "bar"];
const BAR_NAME_HINTS = [
  "напитка",
  "напитки",
  "drink",
  "drinks",
  "вода",
  "кафе",
  "чай",
  "бира",
  "вино",
  "коктейл",
  "сок",
  "лимонада",
  "cola",
  "fanta",
  "sprite",
  "айрян",
  "alcohol",
  "bar",
];
const ACTIVE_EMPLOYEE_STATUSES = new Set(["", "active", "активен", "enabled", "online"]);
const PAID_BONUS_STATUSES = new Set(["", "paid", "closed", "approved", "изплатен", "изплатена"]);

const store = {
  ready: false,
  loading: false,
  started: false,
  version: 0,
  errors: {},
  ordersById: new Map(),
  kitchenHistoryById: new Map(),
  barHistoryById: new Map(),
  stationDocsById: new Map(),
  menusById: new Map(),
  employeesById: new Map(),
  paymentsById: new Map(),
  bonusesById: new Map(),
  shiftsById: new Map(),
  attendanceById: new Map(),
  unsubscribers: [],
};

const subscribers = new Set();
let notifyTimer = null;

const collectionSpecs = [
  { name: "orders", mapName: "ordersById", required: true },
  { name: "menus", mapName: "menusById", required: true },
  { name: "employees", mapName: "employeesById", required: true },
  { name: "kitchen_history", mapName: "kitchenHistoryById", required: false },
  { name: "bar_history", mapName: "barHistoryById", required: false },
  { name: "bar_queue", mapName: "stationDocsById", required: false, keyPrefix: "bar_queue" },
  { name: "station_queue", mapName: "stationDocsById", required: false, keyPrefix: "station_queue" },
  { name: "station_items", mapName: "stationDocsById", required: false, keyPrefix: "station_items" },
  { name: "payments", mapName: "paymentsById", required: false },
  { name: "bonuses", mapName: "bonusesById", required: false },
  { name: "shifts", mapName: "shiftsById", required: false },
  { name: "attendance", mapName: "attendanceById", required: false },
];

const stationQueueSpecs = [
  { station: "bar", mapName: "stationDocsById" },
  { station: "kitchen", mapName: "stationDocsById" },
];

export function subscribeManagerLiveData(callback) {
  if (typeof callback !== "function") return () => {};
  subscribers.add(callback);
  startManagerLiveData();
  callback(getManagerLiveSnapshot());
  return () => subscribers.delete(callback);
}

export function getManagerLiveSnapshot() {
  return {
    ready: store.ready,
    loading: store.loading,
    version: store.version,
    errors: { ...store.errors },
    ordersById: new Map(store.ordersById),
    kitchenHistoryById: new Map(store.kitchenHistoryById),
    barHistoryById: new Map(store.barHistoryById),
    stationDocsById: new Map(store.stationDocsById),
    menusById: new Map(store.menusById),
    employeesById: new Map(store.employeesById),
    paymentsById: new Map(store.paymentsById),
    bonusesById: new Map(store.bonusesById),
    shiftsById: new Map(store.shiftsById),
    attendanceById: new Map(store.attendanceById),
  };
}

export async function startManagerLiveData() {
  if (store.started) return;
  store.started = true;
  store.loading = true;
  scheduleNotify();

  await Promise.all([
    ...collectionSpecs.map((spec) => loadCollectionHistory(spec)),
    ...stationQueueSpecs.map((spec) => loadStationQueueHistory(spec)),
  ]);

  store.ready = true;
  store.loading = false;
  store.version += 1;
  scheduleNotify();

  collectionSpecs.forEach((spec) => startCollectionListener(spec));
  stationQueueSpecs.forEach((spec) => startStationQueueListener(spec));
}

export function stopManagerLiveData() {
  store.unsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch (_err) {}
  });
  store.unsubscribers = [];
  store.started = false;
}

async function loadCollectionHistory(spec) {
  const target = store[spec.mapName];
  if (!(target instanceof Map)) return;

  try {
    let lastDoc = null;
    let loaded = 0;

    while (true) {
      const parts = [collection(db, spec.name), orderBy(documentId()), limit(PAGE_SIZE)];
      if (lastDoc) parts.push(startAfter(lastDoc));

      const snap = await getDocs(query(...parts));
      snap.docs.forEach((docSnap) => {
        setMapDoc(target, docSnap, spec);
      });

      loaded += snap.docs.length;
      if (snap.docs.length < PAGE_SIZE) break;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    delete store.errors[spec.name];
    console.log(`[ManagerLiveData] loaded ${loaded} docs from ${spec.name}`);
  } catch (err) {
    handleCollectionError(spec, err);
  }
}

async function loadStationQueueHistory(spec) {
  const target = store[spec.mapName];
  if (!(target instanceof Map)) return;

  try {
    let lastDoc = null;
    let loaded = 0;
    const pathLabel = `stations/${spec.station}/queue`;

    while (true) {
      const parts = [collection(db, "stations", spec.station, "queue"), orderBy(documentId()), limit(PAGE_SIZE)];
      if (lastDoc) parts.push(startAfter(lastDoc));

      const snap = await getDocs(query(...parts));
      snap.docs.forEach((docSnap) => {
        setMapDoc(target, docSnap, {
          keyPrefix: pathLabel,
          sourceName: pathLabel,
          station: spec.station,
        });
      });

      loaded += snap.docs.length;
      if (snap.docs.length < PAGE_SIZE) break;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    delete store.errors[pathLabel];
    console.log(`[ManagerLiveData] loaded ${loaded} docs from ${pathLabel}`);
  } catch (err) {
    handleCollectionError({ name: `stations/${spec.station}/queue`, required: false }, err);
  }
}

function startCollectionListener(spec) {
  try {
    const target = store[spec.mapName];
    if (!(target instanceof Map)) return;

    const unsub = onSnapshot(
      collection(db, spec.name),
      (snap) => {
        snap.docChanges().forEach((change) => {
          const key = docKey(change.doc, spec);
          if (change.type === "removed") target.delete(key);
          else setMapDoc(target, change.doc, spec);
        });
        delete store.errors[spec.name];
        store.version += 1;
        scheduleNotify();
      },
      (err) => handleCollectionError(spec, err)
    );

    store.unsubscribers.push(unsub);
  } catch (err) {
    handleCollectionError(spec, err);
  }
}

function startStationQueueListener(spec) {
  try {
    const pathLabel = `stations/${spec.station}/queue`;
    const target = store[spec.mapName];
    if (!(target instanceof Map)) return;

    const unsub = onSnapshot(
      collection(db, "stations", spec.station, "queue"),
      (snap) => {
        snap.docChanges().forEach((change) => {
          const options = { keyPrefix: pathLabel, sourceName: pathLabel, station: spec.station };
          const key = docKey(change.doc, options);
          if (change.type === "removed") target.delete(key);
          else setMapDoc(target, change.doc, options);
        });
        delete store.errors[pathLabel];
        store.version += 1;
        scheduleNotify();
      },
      (err) => handleCollectionError({ name: pathLabel, required: false }, err)
    );

    store.unsubscribers.push(unsub);
  } catch (err) {
    handleCollectionError({ name: `stations/${spec.station}/queue`, required: false }, err);
  }
}

function setMapDoc(target, docSnap, spec = {}) {
  const data = docSnap.data() || {};
  const row = {
    id: docSnap.id,
    source: spec.sourceName || spec.name || spec.keyPrefix || "",
    path: docSnap.ref?.path || "",
    ...(spec.station ? { station: data.station || spec.station } : {}),
    ...data,
  };
  target.set(docKey(docSnap, spec), row);
}

function docKey(docSnap, spec = {}) {
  const id = String(docSnap?.id || "").trim();
  return spec.keyPrefix ? `${spec.keyPrefix}/${id}` : id;
}

function handleCollectionError(spec, err) {
  const message = String(err?.message || err || "");
  store.errors[spec.name] = message;
  const log = spec.required ? console.error : console.warn;
  log(`[ManagerLiveData] ${spec.name} unavailable:`, message);
  store.version += 1;
  scheduleNotify();
}

function scheduleNotify() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    const snap = getManagerLiveSnapshot();
    subscribers.forEach((callback) => {
      try {
        callback(snap);
      } catch (err) {
        console.error("manager live data subscriber failed:", err);
      }
    });
  }, 0);
}

export function buildMenuIndex(menusById) {
  const byId = new Map();
  const byName = new Map();

  mapValues(menusById).forEach((menu) => {
    const ids = [
      menu?.id,
      menu?.menuId,
      menu?.itemId,
      menu?.menuItemId,
      menu?.productId,
    ].map(cleanString).filter(Boolean);
    const name = cleanString(menu?.name || menu?.title || menu?.itemName || menu?.productName);

    ids.forEach((id) => byId.set(id, menu));
    if (name) byName.set(normalizeKey(name), menu);
  });

  return { byId, byName };
}

export function getCanonicalOrderId(record = {}) {
  return cleanString(
    record.orderId ||
    record.sourceOrderId ||
    record.originalOrderId ||
    record.id ||
    record.order?.id ||
    record.orderNumber ||
    record.receiptNumber
  );
}

export function normalizeOrder(record = {}, source = record.source || "orders", menuIndex = buildMenuIndex(new Map())) {
  const id = cleanString(record.id || record.path || getCanonicalOrderId(record));
  const items = normalizeOrderItems(record, menuIndex);
  const itemTotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = firstNumber(
    record.total,
    record.totalAmount,
    record.totalPrice,
    record.sum,
    record.amount,
    record.grandTotal,
    record.finalTotal,
    record.paidAmount,
    record.revenue,
    record.totalRevenue,
    record.order?.total,
    record.order?.totalAmount,
    record.order?.amount
  );

  const status = normalizeStatus(record);
  const timestamp = getOrderFinalTimestamp(record);

  return {
    id,
    canonicalId: getCanonicalOrderId({ ...record, id }) || id,
    source,
    raw: record,
    status,
    timestamp,
    total: total != null ? total : itemTotal,
    tableId: cleanString(record.tableId || record.table || record.order?.tableId),
    tableNumber: cleanString(record.tableNumber || record.tableName || record.tableLabel || record.order?.tableNumber),
    waiterId: cleanString(record.waiterId || record.waiterUID || record.createdBy || record.employeeId || record.staffId || record.order?.waiterId),
    waiterName: cleanString(record.waiterName || record.waiter || record.waiterLabel || record.order?.waiterName),
    items,
  };
}

export function normalizeOrderItems(record = {}, menuIndex = buildMenuIndex(new Map())) {
  const candidates = [
    record.items,
    record.order?.items,
    record.cartItems,
    record.products,
    record.order?.products,
    record.lines,
    record.order?.lines,
    record.order?.cartItems,
  ];

  const rawItems = candidates.find((candidate) => Array.isArray(candidate)) || [];
  return rawItems.map((item) => normalizeOrderItem(item, menuIndex)).filter(Boolean);
}

export function normalizeOrderItem(item = {}, menuIndex = buildMenuIndex(new Map())) {
  if (!item || typeof item !== "object") return null;

  const menuId = cleanString(item.menuId || item.itemId || item.menuItemId || item.productId || item.id);
  const name = cleanString(item.name || item.title || item.itemName || item.productName || item.label || menuId);
  if (!name && !menuId) return null;

  const qty = Math.max(1, firstNumber(item.qty, item.quantity, item.count, item.q) ?? 1);
  const explicitLineTotal = firstNumber(item.total, item.totalPrice, item.lineTotal, item.subtotal, item.amount);
  const price = firstNumber(
    item.price,
    item.unitPrice,
    item.unit_price,
    item.salesPrice,
    explicitLineTotal != null && qty > 0 ? explicitLineTotal / qty : null
  ) ?? 0;

  const partial = {
    name,
    menuId,
    itemId: cleanString(item.itemId || item.menuItemId),
    productId: cleanString(item.productId),
    category: cleanString(item.category || item.type || item.group),
    station: cleanString(item.station || item.targetStation || item.department || item.prepStation || item.destination),
    price,
    qty,
    total: explicitLineTotal != null ? explicitLineTotal : price * qty,
  };

  const menu = resolveMenuForItem(partial, menuIndex);
  const cost = firstNumber(item.cost, item.unitCost, menu?.cost);
  const station = resolveItemStation(partial, menu);

  return {
    ...partial,
    category: cleanString(partial.category || menu?.category || menu?.type || "Без категория"),
    station,
    cost,
  };
}

export function resolveMenuForItem(item, menuIndex) {
  if (!item) return null;
  const ids = [item.menuId, item.itemId, item.productId].map(cleanString).filter(Boolean);
  for (const id of ids) {
    if (menuIndex.byId?.has(id)) return menuIndex.byId.get(id);
  }

  const nameKey = normalizeKey(item.name);
  return nameKey ? menuIndex.byName?.get(nameKey) || null : null;
}

export function resolveItemStation(item = {}, menuDoc = null) {
  const text = [
    item.name,
    item.category,
    item.type,
    item.group,
    menuDoc?.name,
    menuDoc?.title,
    menuDoc?.category,
    menuDoc?.type,
    menuDoc?.group,
  ].join(" ");

  const itemStation = normalizeStationValue(item.station || item.targetStation || item.department || item.prepStation || item.destination);
  if (itemStation === "bar") return "bar";
  if (itemStation === "kitchen" && !looksLikeCake(text)) return "kitchen";

  const menuStation = normalizeStationValue(menuDoc?.station || menuDoc?.department || menuDoc?.prepStation || menuDoc?.destination);
  if (menuStation === "bar") return "bar";
  if (menuStation === "kitchen" && !looksLikeCake(text)) return "kitchen";

  if (looksLikeCake(text)) return "bar";
  if (looksLikeDrink(text)) return "bar";

  const category = normalizeText(item.category || menuDoc?.category || menuDoc?.type || "");
  if (BAR_CATEGORY_HINTS.some((hint) => category.includes(hint))) return "bar";

  const name = normalizeText(item.name || menuDoc?.name || "");
  if (BAR_NAME_HINTS.some((hint) => name.includes(hint))) return "bar";

  return "kitchen";
}

export function isFinalRevenueOrder(record = {}) {
  const statusValues = [
    record.status,
    record.orderStatus,
    record.paymentStatus,
    record.state,
    record.order?.status,
    record.order?.paymentStatus,
  ].map(normalizeText).filter(Boolean);

  if (statusValues.some((status) => NON_REVENUE_STATUSES.has(status))) return false;
  if (record.paid === true || record.isPaid === true || record.order?.paid === true || record.order?.isPaid === true) return true;
  if (statusValues.some((status) => FINAL_REVENUE_STATUSES.has(status))) return true;
  if (normalizeText(record.paymentStatus) === "paid" || normalizeText(record.order?.paymentStatus) === "paid") return true;
  return Boolean(toMillis(record.paidAt) || toMillis(record.closedAt) || toMillis(record.completedAt) || toMillis(record.servedAt));
}

export function getOrderFinalTimestamp(record = {}) {
  const containers = [record, record.order].filter(Boolean);
  const fields = [
    "paidAt",
    "closedAt",
    "completedAt",
    "servedAt",
    "createdAt",
    "timestamp",
    "orderedAt",
    "updatedAt",
    "date",
  ];

  for (const container of containers) {
    for (const field of fields) {
      const ms = toMillis(container?.[field]);
      if (ms > 0) return ms;
    }
  }

  return 0;
}

export function buildRevenueOrders(snapshot) {
  const menuIndex = buildMenuIndex(snapshot.menusById);
  const byCanonical = new Map();

  mapValues(snapshot.ordersById).forEach((record) => {
    const normalized = normalizeOrder(record, "orders", menuIndex);
    if (!isFinalRevenueOrder(record)) return;
    byCanonical.set(normalized.canonicalId, normalized);
  });

  const supplementSources = [
    ["kitchen_history", snapshot.kitchenHistoryById],
    ["bar_history", snapshot.barHistoryById],
    ["payments", snapshot.paymentsById],
  ];

  supplementSources.forEach(([source, rows]) => {
    mapValues(rows).forEach((record) => {
      const normalized = normalizeOrder(record, source, menuIndex);
      if (!normalized.canonicalId) return;
      const hasOrderLink = source !== "payments" || hasExplicitOrderReference(record);

      const existing = byCanonical.get(normalized.canonicalId);
      if (existing) {
        byCanonical.set(normalized.canonicalId, mergeMissingOrderData(existing, normalized));
        return;
      }

      const hasRevenueSignal = normalized.total > 0 || normalized.items.length > 0;
      if (hasOrderLink && hasRevenueSignal && isFinalRevenueOrder(record)) {
        byCanonical.set(normalized.canonicalId, normalized);
      }
    });
  });

  return Array.from(byCanonical.values());
}

export function buildStationRevenueSummary(snapshot) {
  const summary = {
    kitchenRevenue: 0,
    barRevenue: 0,
    kitchenItemsCount: 0,
    barItemsCount: 0,
    totalRevenue: 0,
    totalItemsCount: 0,
  };

  buildRevenueOrders(snapshot).forEach((order) => {
    summary.totalRevenue += Number(order.total) || 0;

    order.items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const revenue = Number(item.total) || ((Number(item.price) || 0) * qty);
      summary.totalItemsCount += qty;

      if (item.station === "bar") {
        summary.barRevenue += revenue;
        summary.barItemsCount += qty;
      } else {
        summary.kitchenRevenue += revenue;
        summary.kitchenItemsCount += qty;
      }
    });
  });

  return summary;
}

function mergeMissingOrderData(primary, supplement) {
  return {
    ...primary,
    total: primary.total > 0 ? primary.total : supplement.total,
    items: primary.items.length ? primary.items : supplement.items,
    timestamp: primary.timestamp || supplement.timestamp,
    waiterId: primary.waiterId || supplement.waiterId,
    waiterName: primary.waiterName || supplement.waiterName,
    tableId: primary.tableId || supplement.tableId,
    tableNumber: primary.tableNumber || supplement.tableNumber,
  };
}

function hasExplicitOrderReference(record = {}) {
  return Boolean(cleanString(
    record.orderId ||
    record.sourceOrderId ||
    record.originalOrderId ||
    record.order?.id ||
    record.orderNumber ||
    record.receiptNumber
  ));
}

export function buildDateRanges(now = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = startOfWeek(todayStart);
  const nextWeekStart = addDays(weekStart, 7);
  const prevWeekStart = addDays(weekStart, -7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

  return {
    now,
    todayStart,
    tomorrowStart,
    yesterdayStart,
    weekStart,
    nextWeekStart,
    prevWeekStart,
    monthStart,
    nextMonthStart,
    prevMonthStart,
    yearStart,
    nextYearStart,
  };
}

export function recordsInRange(records, start, end) {
  const startMs = toMillis(start);
  const endMs = toMillis(end);
  return (Array.isArray(records) ? records : []).filter((record) => {
    const ms = Number(record.timestamp || getOrderFinalTimestamp(record.raw || record));
    return ms >= startMs && ms < endMs;
  });
}

export function sumRevenue(records) {
  return (Array.isArray(records) ? records : []).reduce((sum, record) => sum + (Number(record.total) || 0), 0);
}

export function calcPercentChange(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return null;
  return ((c - p) / p) * 100;
}

export function getEmployeeDisplayName(employee) {
  if (!employee) return "—";
  const firstLast = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return cleanString(employee.name || employee.displayName || firstLast || employee.email || employee.id || "—");
}

export function normalizeRole(role) {
  const key = normalizeText(role).replace(/[\s_-]+/g, "");
  if (["waiter", "server", "servitor", "servityor", "сервитьор"].includes(key)) return "waiter";
  if (["bar", "bartender", "barman", "бар", "барман"].includes(key)) return "bar";
  if (["kitchen", "кухня", "kuhnq", "kuhnya"].includes(key)) return "kitchen";
  if (["cook", "chef", "готвач"].includes(key)) return "cook";
  if (["manager", "admin", "мениджър", "управител"].includes(key)) return "manager";
  if (["owner", "собственик"].includes(key)) return "owner";
  return key || "—";
}

export function roleLabel(role) {
  return {
    waiter: "Сервитьор",
    bar: "Барман",
    kitchen: "Кухня",
    cook: "Готвач",
    manager: "Мениджър",
    owner: "Собственик",
  }[role] || "—";
}

export function isActiveEmployee(employee) {
  return ACTIVE_EMPLOYEE_STATUSES.has(normalizeText(employee?.status || "active"));
}

export function isPaidBonus(record) {
  return PAID_BONUS_STATUSES.has(normalizeText(record?.status || record?.paymentStatus || ""));
}

export function formatMoneyEUR(value) {
  const amount = Number(value || 0);
  const decimals = Math.abs(amount % 1) > 0.005 ? 2 : 0;
  return amount.toLocaleString("bg-BG", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("bg-BG", { maximumFractionDigits: 1 })}%`;
}

export function formatHours(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const hours = Number(value);
  return `${hours.toLocaleString("bg-BG", { maximumFractionDigits: hours % 1 ? 1 : 0 })} ч`;
}

export function formatMinutes(seconds) {
  const mins = Number(seconds) / 60;
  if (!Number.isFinite(mins)) return "—";
  return `${mins.toLocaleString("bg-BG", { maximumFractionDigits: mins % 1 ? 1 : 0 })} мин`;
}

export function formatTime(value) {
  const date = toDateSafe(value);
  if (!date) return "—";
  return date.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
}

export function toDateSafe(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    try {
      return toDateSafe(value.toDate());
    } catch (_err) {
      return null;
    }
  }
  if (typeof value.toMillis === "function") {
    try {
      return toDateSafe(value.toMillis());
    } catch (_err) {
      return null;
    }
  }
  if (typeof value === "object") {
    const seconds = Number(value.seconds ?? value._seconds);
    const nanos = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    if (Number.isFinite(seconds)) return toDateSafe((seconds * 1000) + Math.floor(nanos / 1000000));
  }
  if (typeof value === "number") {
    const normalized = Math.abs(value) > 0 && Math.abs(value) < 100000000000 ? value * 1000 : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toMillis(value) {
  const date = toDateSafe(value);
  return date ? date.getTime() : 0;
}

export function numberOrNull(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function firstNumber(...values) {
  for (const value of values) {
    const numeric = numberOrNull(value);
    if (numeric != null) return numeric;
  }
  return null;
}

export function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

export function cleanString(value) {
  return String(value ?? "").trim();
}

export function mapValues(map) {
  return Array.from(map instanceof Map ? map.values() : []);
}

export function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function normalizeStatus(record = {}) {
  return normalizeText(record.status || record.paymentStatus || record.orderStatus || record.state || record.order?.status || "—");
}
