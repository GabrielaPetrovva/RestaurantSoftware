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
  KITCHEN_STATS_PERIOD_STORAGE_KEY,
  buildKitchenHeatmapData,
  buildKitchenOrdersByHourModel,
  classifyKitchenHeatmapCount,
  getStoredKitchenStatsPeriod,
  normalizeKitchenStatsOrder
} from "../shared/kitchen-statistics.js";

const root = document.getElementById("kitchenHeatmapCard");
const cells = Array.from(root?.querySelectorAll(".heatmap-cell") || []);

const state = {
  ordersRaw: [],
  period: getStoredKitchenStatsPeriod()
};

function currentPeriod() {
  state.period = getStoredKitchenStatsPeriod();
  return state.period;
}

function renderHeatmap() {
  if (!cells.length) return;

  const { filteredOrders } = buildKitchenOrdersByHourModel(state.ordersRaw, currentPeriod(), "bg");
  const rows = buildKitchenHeatmapData(filteredOrders);

  cells.forEach((cell, index) => {
    const row = rows[index] || {
      day: cell.dataset.dayLabel || cell.dataset.day || "",
      slot: cell.dataset.slot || "",
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
    cell.classList.remove("heat-low", "heat-medium", "heat-high");
    cell.classList.add(classifyKitchenHeatmapCount(count));
    cell.title = `${day} | ${slot} | ${count} поръчки`;
  });
}

if (cells.length) {
  renderHeatmap();

  onSnapshot(
    query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(KITCHEN_STATS_ORDERS_QUERY_LIMIT)
    ),
    (snap) => {
      state.ordersRaw = snap.docs.map((docSnap) => normalizeKitchenStatsOrder(docSnap.id, docSnap.data() || {}));
      renderHeatmap();
    },
    (err) => {
      const msg = String(err?.message || err || "");
      const code = String(err?.code || "").replace("firestore/", "");
      console.error("manager heatmap orders listener error:", {
        code,
        message: msg,
        query: `orders orderBy(createdAt desc) limit(${KITCHEN_STATS_ORDERS_QUERY_LIMIT})`
      });
    }
  );

  window.addEventListener("storage", (event) => {
    if (event.key && event.key !== KITCHEN_STATS_PERIOD_STORAGE_KEY) return;
    renderHeatmap();
  });
}
