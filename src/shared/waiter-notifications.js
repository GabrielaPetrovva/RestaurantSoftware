import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export const WAITER_NOTIFICATIONS_COLLECTION = "waiter_notifications";
export const WAITER_NOTIFICATIONS_LIMIT = 10;

const TYPE_STARTED = "item_started";
const TYPE_READY = "item_ready";

const STATUS_TEXT = {
  [TYPE_STARTED]: { bg: "Започнато", en: "Started" },
  [TYPE_READY]: { bg: "Готово", en: "Ready" }
};

const STATION_TEXT = {
  kitchen: { bg: "Кухня", en: "Kitchen" },
  bar: { bg: "Бар", en: "Bar" }
};

function firstText(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function normalizeType(type) {
  return String(type || "").trim() === TYPE_READY ? TYPE_READY : TYPE_STARTED;
}

function sanitizeDocIdSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "x";
}

function formatIndexedTableLabel(value, lang = "bg") {
  const text = firstText(value);
  if (!text) return "";
  const indexedMatch = text.match(/^(?:маса|table)\s+(\d+)$/i);
  if (indexedMatch) {
    return lang === "bg" ? `Маса ${indexedMatch[1]}` : `Table ${indexedMatch[1]}`;
  }
  if (/^\d+$/.test(text)) {
    return lang === "bg" ? `Маса ${text}` : `Table ${text}`;
  }
  return text;
}

function extractTableNumber(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "number" && Number.isFinite(value)) return value;

    const text = String(value).trim();
    if (!text) continue;

    if (/^\d+$/.test(text)) return Number(text);

    const match = text.match(/(\d+)/);
    if (match) return Number(match[1]);
  }
  return null;
}

function itemDocIdFromPath(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function orderIdFromPath(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  const orderIndex = parts.indexOf("orders");
  return orderIndex >= 0 && parts[orderIndex + 1] ? parts[orderIndex + 1] : "";
}

export function getItemName(item) {
  return firstText(
    item?.name,
    item?.title,
    item?.itemName,
    item?.productName,
    item?.label
  ) || "Неизвестен артикул";
}

export function getTableLabel(item, order = null, { lang = "bg" } = {}) {
  const direct = firstText(
    item?.tableLabel,
    item?.tableName,
    item?.tableNumber,
    item?.table,
    order?.tableLabel,
    order?.tableName,
    order?.tableNumber,
    order?.table
  );
  const directLabel = formatIndexedTableLabel(direct, lang);
  if (directLabel) return directLabel;

  const tableNumber = extractTableNumber(
    item?.tableNumber,
    item?.tableLabel,
    item?.tableName,
    item?.table,
    order?.tableNumber,
    order?.tableLabel,
    order?.tableName,
    order?.table
  );
  if (tableNumber != null) {
    return lang === "bg" ? `Маса ${tableNumber}` : `Table ${tableNumber}`;
  }

  const tableId = firstText(item?.tableId, order?.tableId);
  if (/^\d+$/.test(tableId)) {
    return lang === "bg" ? `Маса ${tableId}` : `Table ${tableId}`;
  }

  return lang === "bg" ? "Неизвестна маса" : "Unknown table";
}

export function getStation(source) {
  return String(source || "").trim().toLowerCase() === "bar" ? "bar" : "kitchen";
}

export function getNotificationStatusText(type, lang = "bg") {
  const normalizedType = normalizeType(type);
  return STATUS_TEXT[normalizedType]?.[lang] || STATUS_TEXT[normalizedType]?.bg || "";
}

export function getStationLabel(station, lang = "bg") {
  const normalizedStation = getStation(station);
  return STATION_TEXT[normalizedStation]?.[lang] || STATION_TEXT[normalizedStation]?.bg || "";
}

export function toWaiterNotificationDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") {
    return new Date((value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000));
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toWaiterNotificationMs(value) {
  const date = toWaiterNotificationDate(value);
  return date ? date.getTime() : 0;
}

export function formatWaiterNotification(notification, { lang = "bg" } = {}) {
  const stationLabel = getStationLabel(notification?.station, lang);
  const tableLabel = getTableLabel(notification, notification, { lang });
  const statusText = getNotificationStatusText(notification?.type, lang);
  const itemName = getItemName(notification);
  return `[${stationLabel}] ${tableLabel} • ${statusText}: ${itemName}`;
}

export function getWaiterNotificationStatusClass(notification) {
  return normalizeType(notification?.type) === TYPE_READY ? "is-ready" : "is-started";
}

export function getWaiterNotificationsQuery(db) {
  return query(
    collection(db, WAITER_NOTIFICATIONS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(WAITER_NOTIFICATIONS_LIMIT)
  );
}

export function mapWaiterNotificationsSnapshot(snapshot) {
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, path: docSnap.ref.path, ...docSnap.data() }))
    .sort((left, right) => {
      const rightMs = toWaiterNotificationMs(right.createdAt) || toWaiterNotificationMs(right.createdAtClient);
      const leftMs = toWaiterNotificationMs(left.createdAt) || toWaiterNotificationMs(left.createdAtClient);
      return rightMs - leftMs;
    })
    .slice(0, WAITER_NOTIFICATIONS_LIMIT);
}

export function buildWaiterNotificationPayload({ type, station, item, order = null, orderId }) {
  const normalizedType = normalizeType(type);
  const normalizedStation = getStation(station);
  const resolvedOrderId = firstText(orderId, item?.orderId, order?.orderId, order?.id, orderIdFromPath(item?.path));
  const resolvedItemId = firstText(
    item?.id,
    itemDocIdFromPath(item?.path),
    item?.itemId,
    item?.menuId
  ) || getItemName(item);
  const tableNumber = extractTableNumber(
    item?.tableNumber,
    item?.tableLabel,
    item?.tableName,
    item?.table,
    order?.tableNumber,
    order?.tableLabel,
    order?.tableName,
    order?.table
  );

  return {
    type: normalizedType,
    station: normalizedStation,
    itemName: getItemName(item),
    tableNumber: tableNumber != null ? tableNumber : null,
    tableLabel: getTableLabel(item, order, { lang: "bg" }),
    orderId: resolvedOrderId || "",
    itemId: resolvedItemId,
    itemPath: firstText(item?.path),
    createdAt: serverTimestamp(),
    createdAtClient: Date.now(),
    read: false,
    target: "waiter",
    statusText: getNotificationStatusText(normalizedType, "bg")
  };
}

function buildWaiterNotificationDocId(payload) {
  return [
    "waiter",
    payload.station,
    payload.type,
    payload.orderId || "order",
    payload.itemId || "item"
  ].map(sanitizeDocIdSegment).join("__");
}

export async function sendWaiterNotification(db, params) {
  const payload = buildWaiterNotificationPayload(params);
  if (!payload.orderId) {
    throw new Error("Missing orderId for waiter notification");
  }

  const ref = doc(db, WAITER_NOTIFICATIONS_COLLECTION, buildWaiterNotificationDocId(payload));
  await setDoc(ref, payload);
  return {
    sent: true,
    duplicate: false,
    id: ref.id,
    payload
  };
}
