import { db } from "./firebase.js";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  KITCHEN_STATS_ORDERS_QUERY_LIMIT,
  classifyKitchenHeatmapCount
} from "../shared/kitchen-statistics.js";

const DAY_LABELS = [
  "\u041F\u043E\u043D",
  "\u0412\u0442\u043E",
  "\u0421\u0440\u044F",
  "\u0427\u0435\u0442",
  "\u041F\u0435\u0442",
  "\u0421\u044A\u0431",
  "\u041D\u0435\u0434"
];

const TIME_SLOTS = [
  { label: "12:00-14:00", startHour: 12, endHour: 14 },
  { label: "18:00-20:00", startHour: 18, endHour: 20 },
  { label: "20:00-22:00", startHour: 20, endHour: 22 }
];

const root = document.getElementById("kitchenHeatmapCard");
const cells = Array.from(root?.querySelectorAll(".heatmap-cell") || []);

const state = {
  sources: {
    kitchen_history: {
      docs: [],
      ready: false
    },
    orders: {
      docs: [],
      ready: false
    }
  },
  lastDebugSignature: ""
};

function bindCellInteractions() {
  cells.forEach((cell) => {
    if (cell.dataset.heatmapBound === "1") return;
    cell.dataset.heatmapBound = "1";

    cell.addEventListener("click", (event) => {
      event.stopImmediatePropagation();

      const count = cell.dataset.count || cell.textContent.trim();
      const day = cell.dataset.dayLabel || cell.dataset.day || "";
      const slot = cell.dataset.slot || "";
      const countLabel = cell.dataset.countLabel || "\u044F\u0441\u0442\u0438\u044F";
      const label = [day, slot].filter(Boolean).join(" | ");

      window.alert(`${label ? `${label}: ` : ""}${count} ${countLabel}`);
    });
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
        count: 0
      });
    });
  });
  return rows;
}

function renderHeatmap(rows = emptyHeatmapRows()) {
  if (!cells.length) return;

  cells.forEach((cell, index) => {
    const row = rows[index] || emptyHeatmapRows()[index] || {
      day: "",
      slot: "",
      count: 0
    };

    const count = Number(row.count) || 0;
    const day = row.day || "";
    const slot = row.slot || "";

    cell.textContent = String(count);
    cell.dataset.day = day;
    cell.dataset.dayLabel = day;
    cell.dataset.slot = slot;
    cell.dataset.count = String(count);
    cell.dataset.countLabel = "\u044F\u0441\u0442\u0438\u044F";
    cell.classList.remove("heat-low", "heat-medium", "heat-high");
    cell.classList.add(classifyKitchenHeatmapCount(count));
    cell.title = `${day} | ${slot} | ${count} \u044F\u0441\u0442\u0438\u044F`;
  });
}

function renderFromBestSource() {
  const candidate = selectHeatmapCandidate();
  renderHeatmap(candidate.rows);
  logHeatmapDebug(candidate);
}

function selectHeatmapCandidate() {
  const historyCandidate = buildHeatmapCandidate(
    "kitchen_history",
    state.sources.kitchen_history.docs
  );
  const ordersCandidate = buildHeatmapCandidate(
    "orders",
    state.sources.orders.docs
  );

  if (historyCandidate.validTimedRecords > 0) return historyCandidate;
  if (ordersCandidate.validTimedRecords > 0) return ordersCandidate;
  if (historyCandidate.loadedDocs > 0) return historyCandidate;
  if (ordersCandidate.loadedDocs > 0) return ordersCandidate;

  return historyCandidate;
}

function buildHeatmapCandidate(sourceName, docs) {
  const counts = TIME_SLOTS.map(() => DAY_LABELS.map(() => 0));
  let validTimedRecords = 0;
  let sampleParsedRecord = null;

  (Array.isArray(docs) ? docs : []).forEach((record) => {
    const date = extractRecordDate(record);
    if (!date) return;

    const dayIndex = (date.getDay() + 6) % 7;
    const slotIndex = resolveSlotIndex(date.getHours());
    if (dayIndex < 0 || dayIndex >= DAY_LABELS.length || slotIndex < 0) return;

    const items = extractOrderItems(record);
    const itemCount = countItemsQuantity(items);
    const fallbackCount = resolveFallbackItemCount(record);
    const totalItems = itemCount > 0 ? itemCount : fallbackCount;
    if (totalItems <= 0) return;

    counts[slotIndex][dayIndex] += totalItems;
    validTimedRecords += 1;

    if (!sampleParsedRecord) {
      sampleParsedRecord = {
        id: String(record?.orderId || record?.id || ""),
        timestamp: date.toISOString(),
        day: DAY_LABELS[dayIndex],
        slot: TIME_SLOTS[slotIndex].label,
        items: totalItems
      };
    }
  });

  const rows = flattenHeatmapCounts(counts);
  const cellsUpdated = rows.filter((row) => Number(row.count) > 0).length;

  return {
    sourceName,
    loadedDocs: Array.isArray(docs) ? docs.length : 0,
    validTimedRecords,
    cellsUpdated,
    rows,
    sampleParsedRecord
  };
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
        count: Number(counts?.[slotIndex]?.[dayIndex] || 0)
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
  const containers = [record, record?.order, record?.row].filter(Boolean);
  const orderedFields = [
    "orderedAt",
    "createdAt",
    "timestamp",
    "createdAtMs",
    "timestampMs",
    "paidAt",
    "completedAt",
    "servedAt",
    "closedAt",
    "updatedAt",
    "date"
  ];

  for (const container of containers) {
    for (const fieldName of orderedFields) {
      const parsed = toSafeDate(container?.[fieldName]);
      if (parsed) return parsed;
    }

    const fromParts = toDateFromParts(container?.date, container?.time);
    if (fromParts) return fromParts;
  }

  return null;
}

function extractOrderItems(record) {
  const candidates = [
    record?.items,
    record?.row?.items,
    record?.order?.items,
    record?.products,
    record?.order?.products,
    record?.lines,
    record?.order?.lines,
    record?.cartItems
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function countItemsQuantity(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum;

    const qtyValue = Number(item.quantity ?? item.qty ?? item.count ?? item.q ?? 1);
    const safeQty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
    return sum + safeQty;
  }, 0);
}

function resolveFallbackItemCount(record) {
  const candidates = [
    record?.totalQty,
    record?.activeItemCount,
    record?.itemCount,
    record?.count
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }

  return 0;
}

function toSafeDate(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value.toDate === "function") {
    try {
      return toSafeDate(value.toDate());
    } catch (_err) {
      return null;
    }
  }

  if (typeof value.toMillis === "function") {
    try {
      return toSafeDate(value.toMillis());
    } catch (_err) {
      return null;
    }
  }

  if (typeof value === "object") {
    const seconds = Number(value.seconds ?? value._seconds);
    const nanos = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    if (Number.isFinite(seconds)) {
      return toSafeDate((seconds * 1000) + Math.floor(nanos / 1000000));
    }
  }

  if (typeof value === "number") {
    return fromUnixNumber(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numericDate = fromUnixNumber(Number(trimmed));
      if (numericDate) return numericDate;
    }

    const normalized = normalizeDateText(trimmed);
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function fromUnixNumber(value) {
  if (!Number.isFinite(value)) return null;

  const abs = Math.abs(value);
  let normalized = value;

  if (abs > 0 && abs < 100000000000) {
    normalized = value * 1000;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateText(value) {
  const dotted = String(value).match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?$/
  );
  if (dotted) {
    return `${dotted[3]}-${dotted[2]}-${dotted[1]}T${normalizeTimePart(dotted[4] || "00:00")}`;
  }

  return String(value);
}

function toDateFromParts(dateValue, timeValue) {
  const datePart = normalizeDatePart(dateValue);
  const timePart = normalizeTimePart(timeValue);
  if (!datePart || !timePart) return null;

  return toSafeDate(`${datePart}T${timePart}`);
}

function normalizeDatePart(value) {
  if (value == null || value === "") return "";

  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;

  const parsed = toSafeDate(value);
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
    candidate.sampleParsedRecord?.timestamp || ""
  ].join("|");

  if (signature === state.lastDebugSignature) return;
  state.lastDebugSignature = signature;

  console.log(`[Heatmap] source collection: ${candidate.sourceName}`);
  console.log(`[Heatmap] loaded docs: ${candidate.loadedDocs}`);
  console.log(`[Heatmap] valid timed records: ${candidate.validTimedRecords}`);
  console.log(`[Heatmap] cells updated: ${candidate.cellsUpdated}`);
  if (candidate.sampleParsedRecord) {
    console.log("[Heatmap] sample parsed record:", candidate.sampleParsedRecord);
  }
}

function startSourceListener(sourceName, queryRef, queryLabel) {
  onSnapshot(
    queryRef,
    (snap) => {
      state.sources[sourceName].docs = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() || {})
      }));
      state.sources[sourceName].ready = true;
      renderFromBestSource();
    },
    (err) => {
      state.sources[sourceName].docs = [];
      state.sources[sourceName].ready = true;

      const msg = String(err?.message || err || "");
      const code = String(err?.code || "").replace("firestore/", "");
      console.error(`manager heatmap ${sourceName} listener error:`, {
        code,
        message: msg,
        query: queryLabel
      });

      renderFromBestSource();
    }
  );
}

if (cells.length) {
  bindCellInteractions();
  renderHeatmap();

  startSourceListener(
    "kitchen_history",
    query(
      collection(db, "kitchen_history"),
      orderBy("servedAt", "desc"),
      limit(KITCHEN_STATS_ORDERS_QUERY_LIMIT)
    ),
    `kitchen_history orderBy(servedAt desc) limit(${KITCHEN_STATS_ORDERS_QUERY_LIMIT})`
  );

  startSourceListener(
    "orders",
    query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(KITCHEN_STATS_ORDERS_QUERY_LIMIT)
    ),
    `orders orderBy(createdAt desc) limit(${KITCHEN_STATS_ORDERS_QUERY_LIMIT})`
  );
}
