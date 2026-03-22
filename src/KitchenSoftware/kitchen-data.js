import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getEmployee } from "../js/db.js";
import {
  buildMenuIndexByIdAndName
} from "../js/station-utils.js";

const el = (id) => document.getElementById(id);
const norm = (v) => String(v ?? "").trim().toLowerCase();
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const DEBUG_SPLIT = false;
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

const state = {
  lang: localStorage.getItem("kitchenLang") || "bg",
  me: null,
  ordersRaw: [],
  queueItems: [],
  allStationItems: [],
  kitchenOrders: [],
  takeawayOrders: [],
  employeesById: new Map(),
  tablesById: new Map(),
  menuByIdFromMenus: new Map(),
  menuByNameFromMenus: new Map(),
  menuByIdFromMenuItems: new Map(),
  menuByNameFromMenuItems: new Map(),
  menuById: new Map(),
  menuByName: new Map(),
  listenerErrors: {
    role: "",
    queue: "",
    allItems: "",
    orders: "",
    employees: "",
    tables: "",
    menus: "",
    menuItems: ""
  },
  unsubscribers: []
};
let renderTimer = null;
let kitchenClickDelegationInitialized = false;

const i18n = {
  bg: {
    headerTitle: "Кухненско Табло",
    exitBtn: "Изход",
    tabOrders: "Поръчки",
    tabMetrics: "Статистики",
    metricsTitle: "Средно време за готвене",
    avgTimeLabel: "Средно време",
    lateOrdersLabel: "Забавени поръчки",
    totalOrdersLabel: "Общо поръчки",
    takeawayTitle: "За вкъщи / Доставка",
    btnStart: "Започни готвене",
    btnReady: "Готово",
    bumpOff: "Премахни",
    btnServed: "Сервирано",
    priority: "Приоритет",
    order: "Поръчка",
    table: "Маса",
    takeaway: "За вкъщи",
    delivery: "Доставка",
    emptyQueue: "Няма активни поръчки за кухня.",
    emptyTakeaway: "Няма поръчки за вкъщи/доставка.",
    confirmExit: "Сигурни ли сте, че искате да излезете?",
    actionError: "Грешка при обновяване на поръчката."
  },
  en: {
    headerTitle: "Kitchen Dashboard",
    exitBtn: "Exit",
    tabOrders: "Orders",
    tabMetrics: "Metrics",
    metricsTitle: "Average cooking time",
    avgTimeLabel: "Average time",
    lateOrdersLabel: "Late orders",
    totalOrdersLabel: "Total orders",
    takeawayTitle: "Takeaway / Delivery",
    btnStart: "Start cooking",
    btnReady: "Ready",
    bumpOff: "Bump off",
    btnServed: "Served",
    priority: "Priority",
    order: "Order",
    table: "Table",
    takeaway: "Takeaway",
    delivery: "Delivery",
    emptyQueue: "No active kitchen orders.",
    emptyTakeaway: "No takeaway/delivery orders.",
    confirmExit: "Are you sure you want to exit?",
    actionError: "Failed to update order."
  }
};

function t(key) {
  return i18n[state.lang]?.[key] || i18n.en[key] || key;
}

function normalizeFirestoreCode(value) {
  return String(value || "").replace("firestore/", "").trim();
}

function fsErrInfo(err) {
  return {
    code: err?.code ? String(err.code) : "",
    message: err?.message ? String(err.message) : String(err || "")
  };
}

function clearListenerError(scope) {
  if (!scope) {
    Object.keys(state.listenerErrors).forEach((k) => {
      state.listenerErrors[k] = "";
    });
    return;
  }
  if (scope in state.listenerErrors) state.listenerErrors[scope] = "";
}

function setListenerError(scope, text) {
  if (!(scope in state.listenerErrors)) return;
  state.listenerErrors[scope] = String(text || "");
}

function currentUiError() {
  return (
    state.listenerErrors.role ||
    state.listenerErrors.queue ||
    state.listenerErrors.allItems ||
    state.listenerErrors.orders ||
    state.listenerErrors.employees ||
    state.listenerErrors.tables ||
    state.listenerErrors.menus ||
    state.listenerErrors.menuItems ||
    ""
  );
}

function stationUiErrorText(code, message) {
  if (code === "permission-denied") {
    return "❌ Нямаш права. Провери employees/{uid}: status=\"active\" и role=\"kitchen\". Провери и дали правилата са деплойнати в правилния Firebase проект.";
  }
  if (code === "failed-precondition") {
    return "Липсва index за collectionGroup(items). Създай го от Firebase Console.";
  }
  return `Грешка при зареждане на kitchen dashboard: ${message || "unknown error"}`;
}

function handleSnapshotError(label, err, opts = {}) {
  const info = fsErrInfo(err);
  const code = normalizeFirestoreCode(info.code);
  const msg = info.message;
  const query = opts.query || opts.collection || "";
  console.warn(`⚠️ ${label}`, { code, message: msg, query, raw: err });

  if (code === "failed-precondition") {
    const idxLink = String(msg || "").match(/https?:\/\/\S+/)?.[0] || "";
    console.warn(`Missing Firestore index for ${label}`, idxLink || "Open Firestore Console -> Firestore -> Indexes");
  }

  const scope = opts.scope || "orders";
  setListenerError(scope, stationUiErrorText(code, msg));
  scheduleRender();
  return { code, message: msg, query };
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderAll();
  }, 120);
}

function setDebugBoxMessage(text) {
  const box = el("debugBox");
  if (box) box.textContent = String(text || "");
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  const mins = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${mins}:${String(rest).padStart(2, "0")}`;
}

function timerClass(seconds) {
  if (seconds > 300) return "danger";
  if (seconds > 180) return "warning";
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
  const direct = normalizeStationValue(
    item?.station || item?.targetStation || item?.department || item?.prepStation || item?.destination
  );
  if (direct === "bar" || direct === "kitchen") return direct;

  const menu = state.menuByName.get(norm(name));

  if (looksLikeDrink(item?.category, item?.type, name, menu?.name, menu?.category)) return "bar";

  const menuStation = normalizeStationValue(menu?.station || menu?.prepStation || menu?.department);
  if (menuStation === "bar" || menuStation === "kitchen") return menuStation;

  return "kitchen";
}

function statusFromOrder(order) {
  const s = norm(order?.kitchenStatus || order?.kitchen_status || order?.cookingStatus);
  if (["pending", "new", "created"].includes(s)) return "pending";
  if (["cooking", "preparing", "in_progress", "in-progress"].includes(s)) return "cooking";
  if (["ready", "done"].includes(s)) return "ready";
  if (["served", "completed", "closed", "paid", "cancelled"].includes(s)) return "served";

  const orderStatus = norm(order?.status);
  if (["paid", "closed", "cancelled"].includes(orderStatus)) return "served";
  if (orderStatus === "ready") return "ready";
  return "pending";
}

function isClosedOrder(order) {
  const status = norm(order?.status);
  return ["paid", "closed", "cancelled"].includes(status) || statusFromOrder(order) === "served";
}

function waiterName(order) {
  const waiterId = order.waiterId || order.waiterUID || order.staffId || order.employeeId || order.createdBy;
  if (!waiterId) return "Unknown";
  const emp = state.employeesById.get(String(waiterId));
  if (!emp) return String(waiterId);
  return (
    emp.name ||
    [emp.firstName, emp.lastName].filter(Boolean).join(" ").trim() ||
    emp.email ||
    String(waiterId)
  );
}

function tableLabel(order) {
  if (order.tableNumber != null) return order.tableNumber;
  if (order.table != null) return order.table;
  if (order.tableId == null || order.tableId === "") return "Delivery";
  const table = state.tablesById.get(String(order.tableId));
  if (table?.number != null) return table.number;
  return order.tableId;
}

function orderType(order) {
  const raw = norm(order.orderType || order.type || order.serviceType || order.mode);
  if (raw.includes("delivery")) return "delivery";
  if (raw.includes("takeaway") || raw.includes("pickup")) return "takeaway";
  if (order.tableId == null || order.tableId === "") return "delivery";
  return "dinein";
}

function isKitchenItem(item) {
  const station = normalizeStationValue(item?.station);
  if (!station) {
    console.warn("[kitchen] item missing station, skipped", item);
    return false;
  }
  return station === "kitchen";
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

    const menu = state.menuByName.get(norm(name));
    const station = itemStation(it, name);

    const normalizedItem = {
      ...it,
      menuId: String(it?.menuId || it?.itemId || "").trim(),
      itemId: String(it?.itemId || it?.menuId || "").trim(),
      category: String(it?.category || menu?.category || "").trim(),
      name,
      qty: Math.max(1, Number(it?.qty ?? it?.quantity ?? it?.count ?? it?.q) || 1),
      price: Number(it?.price ?? it?.unitPrice ?? it?.unit_price ?? it?.cost) || 0,
      notes: String(it?.notes || it?.note || it?.comment || "").trim(),
      station
    };

    if (DEBUG_SPLIT) {
      console.log("SPLIT ITEM:", {
        rawName: it?.name,
        finalName: name,
        menuId: normalizedItem.menuId,
        category: normalizedItem.category,
        station: normalizedItem.station,
        item: normalizedItem
      });
    }

    if (station === "bar") {
      barItems.push(normalizedItem);
    } else if (station === "kitchen") {
      kitchenItems.push(normalizedItem);
    } else if (DEBUG_SPLIT) {
      console.warn("UNKNOWN STATION, SKIPPED:", normalizedItem);
    }
  });

  if (DEBUG_SPLIT) {
    console.log("KITCHEN ITEMS:", kitchenItems);
    console.log("BAR ITEMS:", barItems);
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

function kitchenItems(order) {
  return orderItems(order).filter((i) => i.station === "kitchen");
}

function isTakeaway(order) {
  return orderType(order) !== "dinein";
}

function refreshMenuIndex() {
  const rows = [];
  state.menuByIdFromMenuItems.forEach((value) => rows.push(value));
  state.menuByIdFromMenus.forEach((value) => rows.push(value));
  const merged = buildMenuIndexByIdAndName(rows);
  state.menuById = merged.byId;
  state.menuByName = merged.byName;
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
  recalcQueues();
  scheduleRender();
}

function orderNumber(order) {
  if (order.orderNumber != null) return String(order.orderNumber);
  if (typeof order.id === "string") return order.id.slice(0, 6).toUpperCase();
  return String(order.id ?? "—");
}

function createdAt(order) {
  return toDate(order.kitchenStartedAt) || toDate(order.createdAt) || new Date();
}

function buildOrderView(order) {
  const { kitchenItems: items } = splitOrderItems(order);
  if (!items.length) return null;

  const started = createdAt(order);
  const ageSeconds = Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000));
  const status = statusFromOrder(order);

  return {
    id: order.id,
    number: orderNumber(order),
    waiter: waiterName(order),
    table: tableLabel(order),
    status,
    late: ageSeconds > 300 && status !== "ready",
    priority: Boolean(order.priority),
    ageSeconds,
    items,
    type: orderType(order),
    raw: order
  };
}

function recalcQueues() {
  rebuildOrdersFromQueueItems();
}

function orderIdFromItemPath(path) {
  const parts = String(path || "").split("/");
  const i = parts.indexOf("orders");
  if (i >= 0 && parts[i + 1]) return parts[i + 1];
  return "";
}

function queueItemOrderType(item) {
  const raw = norm(item?.orderType || item?.type || item?.serviceType || item?.mode);
  if (raw.includes("delivery")) return "delivery";
  if (raw.includes("takeaway") || raw.includes("pickup")) return "takeaway";
  if (item?.isDelivery === true || item?.delivery === true) return "delivery";
  if (item?.isTakeaway === true || item?.takeaway === true || item?.pickup === true) return "takeaway";
  return "dinein";
}

function normalizeQueueItem(item, fallbackName) {
  const name = String(item?.name || item?.itemId || item?.menuId || fallbackName || "Item").trim();
  return {
    ...item,
    name,
    qty: Math.max(1, Number(item?.qty ?? item?.quantity ?? item?.count ?? item?.q) || 1),
    notes: String(item?.notes || item?.note || item?.comment || "").trim(),
    status: norm(item?.status || "new")
  };
}

function rebuildOrdersFromQueueItems() {
  const byOrder = new Map();
  const nowMs = Date.now();

  for (const row of state.queueItems) {
    const station = normalizeStationValue(row?.station);
    if (station !== "kitchen") {
      console.error("KITCHEN IGNORE ITEM WITH INVALID STATION", {
        path: row?.path || "",
        station: row?.station
      });
      continue;
    }
    const orderId = orderIdFromItemPath(row?.path);
    if (!orderId) continue;

    if (!byOrder.has(orderId)) {
      byOrder.set(orderId, {
        id: orderId,
        items: [],
        oldestMs: Infinity,
        newestMs: 0,
        hasInProgress: false,
        hasDelivery: false,
        hasTakeaway: false,
        tableId: "",
        table: "",
        waiter: ""
      });
    }

    const group = byOrder.get(orderId);
    const normalizedItem = normalizeQueueItem(row, `Item ${group.items.length + 1}`);
    if (normalizedItem.status === "done") continue;
    const created = toDate(row?.createdAt);
    const createdMs = created ? created.getTime() : nowMs;
    group.oldestMs = Math.min(group.oldestMs, createdMs);
    group.newestMs = Math.max(group.newestMs, createdMs);
    group.items.push(normalizedItem);

    if (normalizedItem.status === "in_progress") group.hasInProgress = true;

    const type = queueItemOrderType(row);
    if (type === "delivery") group.hasDelivery = true;
    if (type === "takeaway") group.hasTakeaway = true;

    if (!group.tableId) group.tableId = String(row?.tableId || "").trim();
    if (!group.table) group.table = String(row?.tableNumber ?? row?.table ?? "").trim();
    if (!group.waiter) {
      group.waiter = String(
        row?.waiterName ||
        row?.waiter ||
        row?.createdByName ||
        row?.createdBy ||
        ""
      ).trim();
    }
  }

  const kitchen = [];
  const takeaway = [];
  const raw = [];

  byOrder.forEach((group) => {
    if (!group.items.length) return;

    const status = group.hasInProgress ? "cooking" : "pending";
    const ageSeconds = Math.max(0, Math.floor((nowMs - group.oldestMs) / 1000));
    const type = group.hasDelivery ? "delivery" : (group.hasTakeaway ? "takeaway" : "dinein");
    const tableText = group.table || "";
    const waiterText = group.waiter || "";

    const vm = {
      id: group.id,
      number: String(group.id || "").slice(0, 6).toUpperCase(),
      table: tableText,
      waiter: waiterText,
      status,
      ageSeconds,
      newestMs: group.newestMs || group.oldestMs || nowMs,
      items: group.items,
      late: ageSeconds > 300 && status !== "done",
      priority: false,
      type,
      raw: {
        id: group.id,
        tableId: group.tableId || "",
        status
      }
    };

    raw.push(vm.raw);
    if (type === "delivery" || type === "takeaway") takeaway.push(vm);
    else kitchen.push(vm);
  });

  const sorter = (a, b) => (b.newestMs - a.newestMs) || String(a.id).localeCompare(String(b.id));

  kitchen.sort(sorter);
  takeaway.sort(sorter);
  state.kitchenOrders = kitchen;
  state.takeawayOrders = takeaway;
  state.ordersRaw = raw;
}

function updateLanguageTexts() {
  const headerTitle = el("headerTitle");
  const exitBtn = el("exitBtn");
  const tabMetrics = el("tabMetrics");
  const metricsTitle = el("metricsTitle");
  const avgTimeLabel = el("avgTimeLabel");
  const lateOrdersLabel = el("lateOrdersLabel");
  const totalOrdersLabel = el("totalOrdersLabel");
  const takeawayTitle = el("takeawayTitle");
  const langBtn = el("langBtn");
  const modalLangBtn = el("modalLangBtn");
  const tabOrders = el("tabOrders");

  if (headerTitle) headerTitle.textContent = t("headerTitle");
  if (exitBtn) exitBtn.textContent = t("exitBtn");
  if (tabMetrics) tabMetrics.textContent = t("tabMetrics");
  if (metricsTitle) metricsTitle.textContent = t("metricsTitle");
  if (avgTimeLabel) avgTimeLabel.textContent = t("avgTimeLabel");
  if (lateOrdersLabel) lateOrdersLabel.textContent = t("lateOrdersLabel");
  if (totalOrdersLabel) totalOrdersLabel.textContent = t("totalOrdersLabel");
  if (takeawayTitle) takeawayTitle.textContent = t("takeawayTitle");
  if (langBtn) langBtn.textContent = state.lang === "bg" ? "EN" : "BG";
  if (modalLangBtn) modalLangBtn.textContent = state.lang === "bg" ? "EN" : "BG";

  if (tabOrders) {
    tabOrders.innerHTML = `${t("tabOrders")} <span class="badge" id="ordersBadge">${Math.min(state.kitchenOrders.length, 10)}</span>`;
  }
}

function initKitchenClickDelegation() {
  if (kitchenClickDelegationInitialized) return;

  const containers = [el("ordersSection"), el("takeawayOrders")].filter(Boolean);
  if (!containers.length) return;

  const onClick = async (e) => {
    const container = e.currentTarget;
    const btn = e.target.closest("[data-action][data-order-id]");
    if (!btn || !container.contains(btn)) return;

    const action = String(btn.dataset.action || "");
    const orderId = String(btn.dataset.orderId || "").trim();
    if (!orderId) return;

    let nextStatus = "";
    if (action === "start-cooking") nextStatus = "in_progress";
    if (action === "mark-done") nextStatus = "done";
    if (!nextStatus) return;

    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;

    console.log("KITCHEN ACTION", { orderId, action, nextStatus });
    try {
      const updatedCount = await setKitchenItemsStatus(orderId, nextStatus);
      console.log("KITCHEN ACTION COMMIT", { orderId, nextStatus, updatedCount });
      setDebugBoxMessage("");
    } catch (err) {
      const message = String(err?.message || err || "Unknown kitchen action error");
      console.error("kitchen click action failed:", { orderId, action, nextStatus, err });
      setDebugBoxMessage(`Kitchen action error: ${message}`);
    } finally {
      btn.disabled = false;
    }
  };

  containers.forEach((node) => node.addEventListener("click", onClick));
  kitchenClickDelegationInitialized = true;
}

function renderOrders() {
  const container = el("ordersSection");
  if (!container) return;

  const uiError = currentUiError();
  if (uiError) {
    container.innerHTML = `<div class="empty-state">${esc(uiError)}</div>`;
    return;
  }

  const top10 = state.kitchenOrders.slice(0, 10);
  if (DEBUG_SPLIT) {
    console.log("KITCHEN GROUPS:", { total: state.kitchenOrders.length, rendered: top10.length });
  }

  if (!top10.length) {
    container.innerHTML = `<div class="empty-state">${esc(t("emptyQueue"))}</div>`;
    return;
  }

  container.innerHTML = top10
    .map((order) => {
      const kitchenItems = Array.isArray(order.items) ? order.items : [];
      if (DEBUG_SPLIT) {
        console.log("Rendering KITCHEN order:", order.id);
        console.log("Kitchen item count:", kitchenItems.length);
      }

      const actionHtml =
        order.status === "pending"
          ? `<button class="btn btn-start" data-action="start-cooking" data-order-id="${esc(order.id)}">${esc(t("btnStart"))}</button>`
          : `<button class="btn btn-ready" data-action="mark-done" data-order-id="${esc(order.id)}">${esc(t("btnReady"))}</button>`;

      const itemsHtml = kitchenItems
        .map((item) => {
          const notes = item.notes ? `<div class="item-notes">${esc(item.notes)}</div>` : "";
          return `<div class="order-item"><div class="item-name">${esc(item.name)} x${item.qty}</div>${notes}</div>`;
        })
        .join("");

      return `
        <div class="order-card ${order.priority ? "priority" : ""} ${order.late ? "late" : ""}">
          <div class="order-header">
            <div class="order-info">
              <div class="order-number">${esc(t("order"))} #${esc(order.number)}</div>
              <div class="order-waiter">${esc(order.waiter)}</div>
              <div class="order-table">${esc(t("table"))} ${esc(order.table)}</div>
              ${order.priority ? `<span class="priority-badge">${esc(t("priority"))}</span>` : ""}
            </div>
            <div class="order-timer ${timerClass(order.ageSeconds)}">${formatTime(order.ageSeconds)}</div>
          </div>
          <div class="order-items">${itemsHtml}</div>
          <div class="order-actions">${actionHtml}</div>
        </div>
      `;
    })
    .join("");

}

function renderTakeaway() {
  const container = el("takeawayOrders");
  if (!container) return;

  const top10 = state.takeawayOrders.slice(0, 10);
  if (DEBUG_SPLIT) {
    console.log("KITCHEN TAKEAWAY:", { total: state.takeawayOrders.length, rendered: top10.length });
  }

  if (!top10.length) {
    container.innerHTML = `<div class="empty-state">${esc(t("emptyTakeaway"))}</div>`;
    return;
  }

  container.innerHTML = top10
    .map((order) => {
      const typeLabel = order.type === "delivery" ? t("delivery") : t("takeaway");
      const items = order.items.map((i) => `${esc(i.name)} x${i.qty}`).join(", ");
      return `
        <div class="takeaway-order">
          <div class="takeaway-header">
            <span class="takeaway-number">${esc(t("order"))} #${esc(order.number)}</span>
            <span class="takeaway-type">${esc(typeLabel)}</span>
          </div>
          <div class="takeaway-items">${items}</div>
          <div class="takeaway-actions">
            <button class="btn btn-served btn-small" data-action="mark-done" data-order-id="${esc(order.id)}">${esc(t("btnReady"))}</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMetrics() {
  const all = [...state.kitchenOrders, ...state.takeawayOrders];
  const totalEl = el("totalOrders");
  const lateEl = el("lateOrders");
  const avgEl = el("avgTime");

  const total = all.length;
  const late = all.filter((o) => o.late).length;
  const avgSec = total ? Math.round(all.reduce((sum, o) => sum + o.ageSeconds, 0) / total) : 0;

  if (totalEl) totalEl.textContent = String(total);
  if (lateEl) lateEl.textContent = String(late);
  if (avgEl) avgEl.textContent = formatTime(avgSec);
}

function renderAll() {
  updateLanguageTexts();
  renderOrders();
  renderTakeaway();
  renderMetrics();
}

async function updateTableStatus(order, nextStatus) {
  const tableId = order?.tableId;
  if (!tableId) return;

  let status = null;
  if (nextStatus === "ready") status = "ready";
  if (nextStatus === "cooking") status = "busy";
  if (nextStatus === "served") status = norm(order?.status) === "paid" ? "free" : "busy";
  if (!status) return;

  try {
    await updateDoc(doc(db, "tables", String(tableId)), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("table status update failed:", err);
  }
}

async function archiveKitchenOrder(orderId) {
  const orderIdValue = String(orderId || "").trim();
  if (!orderIdValue) return 0;

  const itemsSnap = await getDocs(collection(db, "orders", orderIdValue, "items"));
  const kitchenItems = [];

  itemsSnap.forEach((itemSnap) => {
    const data = itemSnap.data() || {};
    const station = normalizeStationValue(data?.station);
    if (station !== "kitchen") {
      if (!station) {
        console.error("archiveKitchenOrder: item missing station", {
          orderId: orderIdValue,
          itemPath: itemSnap.ref.path
        });
      }
      return;
    }

    kitchenItems.push({
      name: String(data?.name || data?.itemId || data?.menuId || "Item").trim(),
      qty: Math.max(1, Number(data?.qty ?? data?.quantity ?? data?.count ?? 1) || 1),
      price: Number(data?.price ?? data?.unitPrice ?? data?.unit_price ?? 0) || 0,
      notes: String(data?.notes || data?.note || data?.comment || "").trim() || null,
      station: "kitchen",
      createdAt: toDate(data?.createdAt),
      startedAt: toDate(data?.startedAt),
      readyAt: toDate(data?.readyAt),
      servedAt: toDate(data?.servedAt)
    });
  });

  const validItems = kitchenItems.filter((item) => item.name.length > 0);
  if (!validItems.length) {
    console.warn("archiveKitchenOrder: no kitchen items", { orderId: orderIdValue });
    return 0;
  }

  let orderData = {};
  try {
    const orderSnap = await getDoc(doc(db, "orders", orderIdValue));
    orderData = orderSnap.exists() ? (orderSnap.data() || {}) : {};
  } catch (err) {
    console.warn("archiveKitchenOrder: order read failed", { orderId: orderIdValue, err });
  }

  const minMs = (values) => {
    let out = 0;
    values.forEach((value) => {
      const ms = value instanceof Date ? value.getTime() : 0;
      if (ms > 0) out = out > 0 ? Math.min(out, ms) : ms;
    });
    return out;
  };

  const createdMs = minMs(validItems.map((item) => item.createdAt));
  const startedMs = minMs(validItems.map((item) => item.startedAt));
  const readyMs = minMs(validItems.map((item) => item.readyAt));
  const servedMsFromItems = minMs(validItems.map((item) => item.servedAt));
  const servedMs = servedMsFromItems || Date.now();

  const anchorMs = startedMs || createdMs || servedMs;
  const durationSec = Math.max(0, Math.floor((servedMs - anchorMs) / 1000));
  const totalQty = validItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const totalRevenue = validItems.reduce(
    (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)),
    0
  );

  const tableIdRaw = orderData?.tableId;
  const tableId = tableIdRaw == null || tableIdRaw === "" ? null : String(tableIdRaw);
  const tableNameRaw = orderData?.tableName ?? orderData?.table ?? orderData?.tableNumber ?? null;
  const tableName = tableNameRaw == null || tableNameRaw === "" ? null : String(tableNameRaw);
  const guestsRaw = Number(orderData?.guests ?? orderData?.guestCount ?? orderData?.peopleCount);
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? guestsRaw : null;
  const orderTypeRaw = String(orderData?.orderType || orderData?.type || orderData?.serviceType || orderData?.mode || "").trim();

  const payload = {
    orderId: orderIdValue,
    tableId,
    tableName,
    guests,
    createdAt: createdMs > 0 ? new Date(createdMs) : null,
    startedAt: startedMs > 0 ? new Date(startedMs) : null,
    readyAt: readyMs > 0 ? new Date(readyMs) : null,
    servedAt: new Date(servedMs),
    durationSec,
    totalQty,
    totalRevenue,
    items: validItems.map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      notes: item.notes,
      station: "kitchen"
    })),
    orderType: orderTypeRaw || null,
    source: "kitchen",
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, "kitchen_history", orderIdValue), payload, { merge: true });
  return validItems.length;
}

async function setKitchenItemsStatus(orderId, nextStatus) {
  const orderIdValue = String(orderId || "").trim();
  if (!orderIdValue) throw new Error("Missing orderId");

  const status = norm(nextStatus);
  if (!["in_progress", "done"].includes(status)) {
    throw new Error(`Invalid kitchen status: ${nextStatus}`);
  }

  const fromStatus = status === "in_progress" ? "new" : "in_progress";
  const itemsRef = query(
    collection(db, "orders", orderIdValue, "items"),
    where("station", "==", "kitchen"),
    where("status", "==", fromStatus)
  );
  const snap = await getDocs(itemsRef);
  const batch = writeBatch(db);
  let updatedCount = 0;

  snap.forEach((itemSnap) => {
    const payload = {
      status,
      updatedAt: serverTimestamp()
    };
    if (status === "in_progress") payload.startedAt = serverTimestamp();
    if (status === "done") payload.doneAt = serverTimestamp();

    batch.update(itemSnap.ref, payload);
    updatedCount += 1;
  });

  if (updatedCount === 0) {
    console.warn("KITCHEN ACTION NO ITEMS", { orderId: orderIdValue, nextStatus: status });
    return 0;
  }

  await batch.commit();
  console.log("KITCHEN ITEMS UPDATED", { orderId: orderIdValue, nextStatus: status, updatedCount });

  try {
    const orderSummary = {
      kitchenStatus: status,
      kitchenUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (status === "in_progress") orderSummary.kitchenStartedAt = serverTimestamp();
    if (status === "done") orderSummary.kitchenDoneAt = serverTimestamp();
    await updateDoc(doc(db, "orders", orderIdValue), orderSummary);
  } catch (summaryErr) {
    console.warn("kitchen summary update failed:", summaryErr);
  }

  if (status === "done") {
    try {
      const archivedItems = await archiveKitchenOrder(orderIdValue);
      console.log("KITCHEN HISTORY UPSERT", { orderId: orderIdValue, archivedItems });
    } catch (archiveErr) {
      console.warn("archiveKitchenOrder failed", { orderId: orderIdValue, archiveErr });
    }
  }

  const match =
    state.kitchenOrders.find((o) => String(o.id) === orderIdValue) ||
    state.takeawayOrders.find((o) => String(o.id) === orderIdValue) ||
    null;
  if (match?.raw) {
    await updateTableStatus(match.raw, status === "in_progress" ? "cooking" : "ready");
  }

  return updatedCount;
}

function switchTab(tab) {
  if (tab === "metrics") {
    window.location.href = "statisticks.html";
    return;
  }

  document.querySelectorAll(".tab").forEach((node) => node.classList.remove("active"));
  const activeTab = el(`tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`);
  if (activeTab) activeTab.classList.add("active");
}

function openKitchenProfileModal() {
  const modal = el("kitchenProfileModal");
  if (!modal) return;

  const me = state.me || {};
  const profileName = el("kitchenProfileName");
  const profileEmail = el("kitchenProfileEmail");
  const nameFromHeader = el("kitchenUserName");

  if (profileName) {
    const fromHeader = nameFromHeader?.textContent?.trim();
    profileName.textContent =
      fromHeader || nameFromEmployee(me, "") || "—";
  }
  if (profileEmail) {
    profileEmail.textContent =
      (typeof window !== "undefined" && window.__kitchenEmail) || me?.email || "—";
  }

  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeKitchenProfileModal() {
  const modal = el("kitchenProfileModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindUiActions() {
  const langBtn = el("langBtn");
  if (langBtn) {
    langBtn.addEventListener("click", () => {
      if (typeof window.toggleLanguage === "function") window.toggleLanguage();
    });
  }

  const modalLangBtn = el("modalLangBtn");
  if (modalLangBtn) {
    modalLangBtn.addEventListener("click", () => {
      if (typeof window.toggleLanguage === "function") window.toggleLanguage();
      modalLangBtn.textContent = state.lang === "bg" ? "EN" : "BG";
    });
  }

  const exitBtn = el("exitBtn");
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      void exitDashboard();
    });
  }

  const modalExitBtn = el("modalExitBtn");
  if (modalExitBtn) {
    modalExitBtn.addEventListener("click", () => {
      void exitDashboard();
    });
  }

  const openProfileBtn = el("openProfileBtn");
  if (openProfileBtn) {
    openProfileBtn.addEventListener("click", () => openKitchenProfileModal());
  }

  document.querySelectorAll("[data-close-kitchen-profile]").forEach((node) => {
    node.addEventListener("click", () => closeKitchenProfileModal());
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = el("kitchenProfileModal");
    if (m && m.getAttribute("aria-hidden") === "false") closeKitchenProfileModal();
  });

  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab || "orders");
    });
  });
}

async function exitDashboard() {
  if (!confirm(t("confirmExit"))) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.error("signOut error:", err);
  }
  window.location.href = "../Login/login.html";
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

function listenData() {
  clearListeners();
  clearListenerError("queue");
  clearListenerError("allItems");
  clearListenerError("orders");
  clearListenerError("tables");
  clearListenerError("menus");
  clearListenerError("menuItems");

  const qQueue = query(
    collectionGroup(db, "items"),
    where("station", "==", "kitchen"),
    where("status", "in", ["new", "in_progress"]),
    orderBy("createdAt", "asc"),
    limit(300)
  );

  state.unsubscribers.push(
    onSnapshot(
      qQueue,
      (snap) => {
        clearListenerError("queue");
        const rows = snap.docs.map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }));
        state.queueItems = rows;
        rebuildOrdersFromQueueItems();
        scheduleRender();
      },
      (err) => {
        handleSnapshotError("kitchen queue", err, {
          scope: "queue",
          query: "collectionGroup(items) where station==\"kitchen\" where status in [new,in_progress] orderBy(createdAt asc) limit(300)"
        });
      }
    )
  );

  const qAll = query(
    collectionGroup(db, "items"),
    where("station", "==", "kitchen"),
    where("status", "in", ["new", "in_progress", "done"]),
    orderBy("createdAt", "desc"),
    limit(1000)
  );

  state.unsubscribers.push(
    onSnapshot(
      qAll,
      (snap) => {
        clearListenerError("allItems");
        state.allStationItems = snap.docs.map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }));
        scheduleRender();
      },
      (err) => {
        handleSnapshotError("kitchen all-items", err, {
          scope: "allItems",
          query: "collectionGroup(items) where station==\"kitchen\" where status in [new,in_progress,done] orderBy(createdAt desc) limit(1000)"
        });
      }
    )
  );

  state.unsubscribers.push(
    onSnapshot(
      query(collection(db, "tables"), orderBy("number", "asc")),
      (snap) => {
        clearListenerError("tables");
        if (DEBUG_SPLIT) console.log("SNAPSHOT SIZE:", snap.size, "(tables)");
        state.tablesById.clear();
        snap.forEach((d) => state.tablesById.set(String(d.id), d.data() || {}));
        scheduleRender();
      },
      (err) => {
        handleSnapshotError("tables listener", err, {
          scope: "tables",
          query: "tables orderBy(number asc)"
        });
      }
    )
  );

  state.unsubscribers.push(
    onSnapshot(
      collection(db, "menus"),
      (snap) => {
        clearListenerError("menus");
        if (DEBUG_SPLIT) console.log("SNAPSHOT SIZE:", snap.size, "(menus)");
        applyMenuSnapshot(state.menuByIdFromMenus, state.menuByNameFromMenus, snap);
      },
      (err) => {
        handleSnapshotError("menus listener", err, {
          scope: "menus",
          collection: "menus"
        });
      }
    )
  );

  state.unsubscribers.push(
    onSnapshot(
      collection(db, "menu_items"),
      (snap) => {
        clearListenerError("menuItems");
        if (DEBUG_SPLIT) console.log("SNAPSHOT SIZE:", snap.size, "(menu_items)");
        applyMenuSnapshot(state.menuByIdFromMenuItems, state.menuByNameFromMenuItems, snap);
      },
      (err) => {
        handleSnapshotError("menu_items listener", err, {
          scope: "menuItems",
          collection: "menu_items"
        });
      }
    )
  );
}

async function loadMe(user) {
  try {
    return await getEmployee(user.uid);
  } catch (err) {
    console.warn("kitchen employee load failed:", err);
    return null;
  }
}

function nameFromEmployee(emp, fallback) {
  return (
    emp?.name ||
    [emp?.firstName, emp?.lastName].filter(Boolean).join(" ").trim() ||
    emp?.email ||
    fallback
  );
}

window.toggleLanguage = () => {
  state.lang = state.lang === "bg" ? "en" : "bg";
  localStorage.setItem("kitchenLang", state.lang);
  renderAll();
};

window.switchTab = switchTab;
window.exit = exitDashboard;
window.startCooking = (orderId) => setKitchenItemsStatus(orderId, "in_progress");
window.markReady = (orderId) => setKitchenItemsStatus(orderId, "done");
window.bumpOff = (orderId) => setKitchenItemsStatus(orderId, "done");
window.markServed = (orderId) => setKitchenItemsStatus(orderId, "done");

bindUiActions();
initKitchenClickDelegation();

setInterval(() => {
  if (!state.kitchenOrders.length && !state.takeawayOrders.length) return;
  renderOrders();
  renderTakeaway();
  renderMetrics();
}, 1000);

renderAll();

onAuthStateChanged(auth, async (user) => {
  clearListeners();
  clearListenerError("role");

  if (!user) {
    window.location.href = "../Login/login.html";
    return;
  }

  try {
    const me = await loadMe(user);
    const role = norm(me?.role);
    const status = norm(me?.status);
    const hasAccess = Boolean(me) && role === "kitchen" && status === "active";
    if (!hasAccess) {
      const msg = "❌ Нямаш активна роля. В employees/{uid} трябва role='kitchen' и status='active'.";
      console.warn("kitchen access check failed", { uid: user.uid, role, status, me });
      state.me = me || {};
      state.ordersRaw = [];
      state.queueItems = [];
      state.allStationItems = [];
      state.kitchenOrders = [];
      state.takeawayOrders = [];
      setListenerError("role", msg);
      renderAll();
      return;
    }

    clearListenerError("role");
    state.me = me || {};
    const waiterNameEl = el("waiterName");
    if (waiterNameEl) waiterNameEl.textContent = nameFromEmployee(me || {}, user.email || "Kitchen");

    listenData();
  } catch (err) {
    console.error("Kitchen init error:", err);
    window.location.href = "../Login/login.html";
  }
});
