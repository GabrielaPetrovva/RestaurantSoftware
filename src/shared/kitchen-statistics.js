export const KITCHEN_STATS_PERIOD_STORAGE_KEY = "kitchenStatsPeriod";
export const KITCHEN_STATS_ORDERS_QUERY_LIMIT = 5000;
export const KITCHEN_HEATMAP_DAY_LABELS_BG = ["Пон", "Вто", "Сря", "Чет", "Пет", "Съб", "Нед"];
export const KITCHEN_HEATMAP_SLOTS = [
  { label: "12:00-14:00", startHour: 12, endHour: 14 },
  { label: "18:00-20:00", startHour: 18, endHour: 20 },
  { label: "20:00-22:00", startHour: 20, endHour: 22 }
];

const VALID_PERIODS = new Set(["today", "week", "month", "year"]);

export function normalizeKitchenStatsPeriod(period) {
  const key = String(period || "").trim().toLowerCase();
  return VALID_PERIODS.has(key) ? key : "today";
}

export function getStoredKitchenStatsPeriod(storage = globalThis?.localStorage) {
  try {
    return normalizeKitchenStatsPeriod(storage?.getItem?.(KITCHEN_STATS_PERIOD_STORAGE_KEY));
  } catch (err) {
    console.warn("kitchen stats period read failed:", err);
    return "today";
  }
}

export function setStoredKitchenStatsPeriod(period, storage = globalThis?.localStorage) {
  const normalized = normalizeKitchenStatsPeriod(period);
  try {
    storage?.setItem?.(KITCHEN_STATS_PERIOD_STORAGE_KEY, normalized);
  } catch (err) {
    console.warn("kitchen stats period write failed:", err);
  }
  return normalized;
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toMs(value) {
  const dt = toDate(value);
  return dt ? dt.getTime() : 0;
}

export function normalizeKitchenStatsOrder(id, data = {}) {
  return {
    id,
    ...data,
    createdAtMs: toMs(data.createdAt),
    kitchenDoneAtMs: toMs(data.kitchenDoneAt),
    kitchenStartedAtMs: toMs(data.kitchenStartedAt),
    items: Array.isArray(data.items) ? data.items : [],
    totalValue: Number(data.total || data.totalAmount || 0),
    guestsValue: Number(data.guests || data.guestCount || data.people || 0)
  };
}

export function normalizeKitchenStatsHistory(id, data = {}) {
  return {
    id,
    ...data,
    servedAtMs: toMs(data.servedAt),
    createdAtMs: toMs(data.createdAt),
    durationSec: Number(data.durationSec || 0),
    totalRevenue: Number(data.totalRevenue || 0),
    guests: Number(data.guests || 0),
    items: Array.isArray(data.items) ? data.items : []
  };
}

export function periodStart(period, now = new Date()) {
  const normalized = normalizeKitchenStatsPeriod(period);
  if (normalized === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (normalized === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }
  if (normalized === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (normalized === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function filterKitchenStatsOrdersByPeriod(ordersRaw, period) {
  const startMs = periodStart(period).getTime();
  return (Array.isArray(ordersRaw) ? ordersRaw : [])
    .filter((order) => (Number(order?.createdAtMs) || 0) >= startMs)
    .sort((left, right) => (Number(right?.createdAtMs) || 0) - (Number(left?.createdAtMs) || 0));
}

export function bucketKey(date, period, lang = "bg") {
  const normalized = normalizeKitchenStatsPeriod(period);
  if (normalized === "today") {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  }
  if (normalized === "year") {
    return date.toLocaleString(lang === "bg" ? "bg-BG" : "en-US", { month: "short" });
  }
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

export function buildKitchenOrdersByHourBuckets(filteredOrders, period, lang = "bg") {
  const normalized = normalizeKitchenStatsPeriod(period);
  const bucketMap = new Map();

  (Array.isArray(filteredOrders) ? filteredOrders : []).forEach((order) => {
    const createdAtMs = Number(order?.createdAtMs || 0);
    if (createdAtMs <= 0) return;

    const createdAt = new Date(createdAtMs);
    const key = bucketKey(createdAt, normalized, lang);

    let sortMs = createdAtMs;
    if (normalized === "today") sortMs = createdAt.getHours();
    else if (normalized === "year") sortMs = createdAt.getMonth();
    else sortMs = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime();

    const current = bucketMap.get(key) || { label: key, count: 0, sortMs };
    current.count += 1;
    current.sortMs = Math.min(current.sortMs, sortMs);
    bucketMap.set(key, current);
  });

  return Array.from(bucketMap.values())
    .sort((left, right) => left.sortMs - right.sortMs)
    .map((row) => ({ label: row.label, count: row.count }))
    .slice(-8);
}

export function buildKitchenOrdersByHourModel(ordersRaw, period, lang = "bg") {
  const filteredOrders = filterKitchenStatsOrdersByPeriod(ordersRaw, period);
  return {
    filteredOrders,
    buckets: buildKitchenOrdersByHourBuckets(filteredOrders, period, lang)
  };
}

export function buildKitchenHeatmapData(
  filteredOrders,
  dayLabels = KITCHEN_HEATMAP_DAY_LABELS_BG,
  slots = KITCHEN_HEATMAP_SLOTS
) {
  const counts = slots.map(() => dayLabels.map(() => 0));

  (Array.isArray(filteredOrders) ? filteredOrders : []).forEach((order) => {
    const createdAtMs = Number(order?.createdAtMs || 0);
    if (createdAtMs <= 0) return;

    const createdAt = new Date(createdAtMs);
    if (Number.isNaN(createdAt.getTime())) return;

    const dayIndex = (createdAt.getDay() + 6) % 7;
    const hour = createdAt.getHours();
    const slotIndex = slots.findIndex((slot) => hour >= slot.startHour && hour < slot.endHour);

    if (dayIndex < 0 || dayIndex >= dayLabels.length || slotIndex < 0) return;
    counts[slotIndex][dayIndex] += 1;
  });

  const rows = [];
  slots.forEach((slot, slotIndex) => {
    dayLabels.forEach((day, dayIndex) => {
      rows.push({
        day,
        slot: slot.label,
        count: counts[slotIndex][dayIndex],
        dayIndex,
        slotIndex
      });
    });
  });
  return rows;
}

export function classifyKitchenHeatmapCount(count) {
  const value = Number(count) || 0;
  if (value >= 51) return "heat-high";
  if (value >= 31) return "heat-medium";
  return "heat-low";
}
