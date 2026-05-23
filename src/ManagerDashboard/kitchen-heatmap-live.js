import {
  subscribeManagerLiveData,
  buildRevenueOrders,
  buildMenuIndex,
  normalizeOrderItems,
  mapValues,
  toDateSafe,
  firstNumber,
} from "./manager-live-data.js";
import { classifyKitchenHeatmapCount } from "../shared/kitchen-statistics.js";

const DAY_LABELS = ["Пон", "Вто", "Сря", "Чет", "Пет", "Съб", "Нед"];

const TIME_SLOTS = [
  { label: "12:00-14:00", startHour: 12, endHour: 14 },
  { label: "18:00-20:00", startHour: 18, endHour: 20 },
  { label: "20:00-22:00", startHour: 20, endHour: 22 },
];

const root = document.getElementById("kitchenHeatmapCard");
const cells = Array.from(root?.querySelectorAll(".heatmap-cell") || []);
let lastDebugSignature = "";

if (cells.length) {
  bindCellInteractions();
  renderHeatmap();
  subscribeManagerLiveData((snapshot) => {
    const candidate = selectHeatmapCandidate(snapshot);
    renderHeatmap(candidate.rows);
    logHeatmapDebug(candidate);
  });
}

function bindCellInteractions() {
  cells.forEach((cell) => {
    if (cell.dataset.heatmapBound === "1") return;
    cell.dataset.heatmapBound = "1";

    cell.addEventListener("click", (event) => {
      event.stopImmediatePropagation();

      const count = cell.dataset.count || cell.textContent.trim();
      const day = cell.dataset.dayLabel || cell.dataset.day || "";
      const slot = cell.dataset.slot || "";
      const countLabel = cell.dataset.countLabel || "ястия";
      const label = [day, slot].filter(Boolean).join(" | ");

      window.alert(`${label ? `${label}: ` : ""}${count} ${countLabel}`);
    });
  });
}

function selectHeatmapCandidate(snapshot) {
  const menuIndex = buildMenuIndex(snapshot.menusById);
  const historyCandidate = buildHistoryCandidate(mapValues(snapshot.kitchenHistoryById), menuIndex);
  const ordersCandidate = buildOrdersCandidate(buildRevenueOrders(snapshot));

  if (historyCandidate.validTimedRecords > 0) return historyCandidate;
  if (ordersCandidate.validTimedRecords > 0) return ordersCandidate;
  if (historyCandidate.loadedDocs > 0) return historyCandidate;
  if (ordersCandidate.loadedDocs > 0) return ordersCandidate;
  return historyCandidate;
}

function buildHistoryCandidate(records, menuIndex) {
  return buildHeatmapCandidate("kitchen_history", records, (record) => {
    const items = normalizeOrderItems(record, menuIndex);
    const kitchenItems = items.filter((item) => item.station === "kitchen");
    const fromItems = countItemsQuantity(kitchenItems);
    if (fromItems > 0) return fromItems;
    return resolveFallbackItemCount(record);
  });
}

function buildOrdersCandidate(orders) {
  return buildHeatmapCandidate("orders", orders, (order) => {
    const kitchenItems = (order.items || []).filter((item) => item.station === "kitchen");
    return countItemsQuantity(kitchenItems);
  });
}

function buildHeatmapCandidate(sourceName, records, countResolver) {
  const counts = TIME_SLOTS.map(() => DAY_LABELS.map(() => 0));
  let validTimedRecords = 0;
  let sampleParsedRecord = null;

  (Array.isArray(records) ? records : []).forEach((record) => {
    const date = extractRecordDate(record);
    if (!date) return;

    const dayIndex = (date.getDay() + 6) % 7;
    const slotIndex = resolveSlotIndex(date.getHours());
    if (dayIndex < 0 || dayIndex >= DAY_LABELS.length || slotIndex < 0) return;

    const totalItems = Number(countResolver(record)) || 0;
    if (totalItems <= 0) return;

    counts[slotIndex][dayIndex] += totalItems;
    validTimedRecords += 1;

    if (!sampleParsedRecord) {
      sampleParsedRecord = {
        id: String(record?.canonicalId || record?.orderId || record?.id || ""),
        timestamp: date.toISOString(),
        day: DAY_LABELS[dayIndex],
        slot: TIME_SLOTS[slotIndex].label,
        items: totalItems,
      };
    }
  });

  const rows = flattenHeatmapCounts(counts);
  return {
    sourceName,
    loadedDocs: Array.isArray(records) ? records.length : 0,
    validTimedRecords,
    cellsUpdated: rows.filter((row) => Number(row.count) > 0).length,
    rows,
    sampleParsedRecord,
  };
}

function renderHeatmap(rows = emptyHeatmapRows()) {
  if (!cells.length) return;
  const fallbackRows = rows.length ? rows : emptyHeatmapRows();

  cells.forEach((cell, index) => {
    const row = fallbackRows[index] || emptyHeatmapRows()[index] || { day: "", slot: "", count: 0 };
    const count = Number(row.count) || 0;
    const day = row.day || "";
    const slot = row.slot || "";

    cell.textContent = String(count);
    cell.dataset.day = day;
    cell.dataset.dayLabel = day;
    cell.dataset.slot = slot;
    cell.dataset.count = String(count);
    cell.dataset.countLabel = "ястия";
    cell.classList.remove("heat-low", "heat-medium", "heat-high");
    cell.classList.add(classifyKitchenHeatmapCount(count));
    cell.title = `${day} | ${slot} | ${count} ястия`;
  });
}

function emptyHeatmapRows() {
  const rows = [];
  TIME_SLOTS.forEach((slot, slotIndex) => {
    DAY_LABELS.forEach((day, dayIndex) => {
      rows.push({
        day,
        dayIndex,
        slot: slot.label,
        slotIndex,
        count: 0,
      });
    });
  });
  return rows;
}

function flattenHeatmapCounts(counts) {
  const rows = [];
  TIME_SLOTS.forEach((slot, slotIndex) => {
    DAY_LABELS.forEach((day, dayIndex) => {
      rows.push({
        day,
        dayIndex,
        slot: slot.label,
        slotIndex,
        count: Number(counts?.[slotIndex]?.[dayIndex] || 0),
      });
    });
  });
  return rows;
}

function resolveSlotIndex(hour) {
  const safeHour = Number(hour);
  if (!Number.isFinite(safeHour)) return -1;
  return TIME_SLOTS.findIndex((slot) => safeHour >= slot.startHour && safeHour < slot.endHour);
}

function extractRecordDate(record) {
  const raw = record?.raw || record;
  const containers = [record, raw, raw?.order].filter(Boolean);
  const fields = [
    "servedAt",
    "kitchenDoneAt",
    "doneAt",
    "completedAt",
    "paidAt",
    "closedAt",
    "orderedAt",
    "createdAt",
    "timestamp",
    "updatedAt",
    "date",
  ];

  for (const container of containers) {
    for (const fieldName of fields) {
      const parsed = toDateSafe(container?.[fieldName]);
      if (parsed) return parsed;
    }

    const fromParts = toDateFromParts(container?.date, container?.time);
    if (fromParts) return fromParts;
  }

  if (record?.timestamp) return toDateSafe(record.timestamp);
  return null;
}

function countItemsQuantity(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const qty = Number(item.qty ?? item.quantity ?? item.count ?? 1);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);
}

function resolveFallbackItemCount(record) {
  const direct = firstNumber(record.totalQty, record.activeItemCount, record.itemCount, record.count, record.quantity);
  return direct != null && direct > 0 ? direct : 0;
}

function toDateFromParts(dateValue, timeValue) {
  const datePart = normalizeDatePart(dateValue);
  const timePart = normalizeTimePart(timeValue);
  if (!datePart || !timePart) return null;
  return toDateSafe(`${datePart}T${timePart}`);
}

function normalizeDatePart(value) {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;

  const parsed = toDateSafe(value);
  if (!parsed) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function normalizeTimePart(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
}

function logHeatmapDebug(candidate) {
  const signature = [
    candidate.sourceName,
    candidate.loadedDocs,
    candidate.validTimedRecords,
    candidate.cellsUpdated,
    candidate.sampleParsedRecord?.id || "",
    candidate.sampleParsedRecord?.timestamp || "",
  ].join("|");

  if (signature === lastDebugSignature) return;
  lastDebugSignature = signature;

  console.log(`[Heatmap] source collection: ${candidate.sourceName}`);
  console.log(`[Heatmap] loaded docs: ${candidate.loadedDocs}`);
  console.log(`[Heatmap] valid timed records: ${candidate.validTimedRecords}`);
  console.log(`[Heatmap] cells updated: ${candidate.cellsUpdated}`);
  if (candidate.sampleParsedRecord) {
    console.log("[Heatmap] sample parsed record:", candidate.sampleParsedRecord);
  }
}
