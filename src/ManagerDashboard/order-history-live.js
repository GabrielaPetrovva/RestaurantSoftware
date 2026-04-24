import { db } from "../js/firebase.js";
import {
  collection,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const MAX_VISIBLE_RESULTS = 100;
const DEFAULT_COLLAPSED_RESULTS = Math.min(5, MAX_VISIBLE_RESULTS);
const FINAL_STATUSES = new Set(["paid", "closed", "cancelled", "completed", "served"]);
const LIVE_STATUSES = new Set(["new", "created", "open", "pending", "preparing", "cooking", "ready", "in_progress", "busy"]);
const DISPLAYABLE_STATUSES = new Set([...FINAL_STATUSES, ...LIVE_STATUSES]);

const els = {
  section: document.getElementById("history"),
  filtersForm: document.getElementById("orderHistoryFilters"),
  date: document.getElementById("orderHistoryDate"),
  table: document.getElementById("orderHistoryTable"),
  waiter: document.getElementById("orderHistoryWaiter"),
  orderNumber: document.getElementById("orderHistoryOrderNumber"),
  toggleBtn: document.getElementById("orderHistoryToggleBtn"),
  clearBtn: document.getElementById("orderHistoryClearBtn"),
  summary: document.getElementById("orderHistorySummary"),
  error: document.getElementById("orderHistoryError"),
  empty: document.getElementById("orderHistoryEmpty"),
  body: document.getElementById("orderHistoryTableBody"),
  tableOptions: document.getElementById("orderHistoryTables"),
  waiterOptions: document.getElementById("orderHistoryWaiters"),
};

const state = {
  ready: false,
  active: Boolean(document.getElementById("history")?.classList.contains("active")),
  ordersRaw: [],
  tablesById: new Map(),
  employeesById: new Map(),
  itemsByOrderId: new Map(),
  loadingItems: new Set(),
  orderError: "",
  showAllOrdersHistory: false,
};

if (els.section && els.body) {
  bindUi();
  startLiveReaders();
  render();
}

function bindUi() {
  els.filtersForm?.addEventListener("submit", (event) => event.preventDefault());

  [els.date, els.table, els.waiter, els.orderNumber].forEach((node) => {
    if (!node) return;
    const eventName = node.type === "date" ? "change" : "input";
    node.addEventListener(eventName, () => render());
  });

  els.toggleBtn?.addEventListener("click", () => {
    state.showAllOrdersHistory = !state.showAllOrdersHistory;
    render();
  });

  els.clearBtn?.addEventListener("click", () => {
    if (els.filtersForm) els.filtersForm.reset();
    render();
  });

  window.addEventListener("manager:tabchange", (event) => {
    state.active = event?.detail?.tabName === "history";
    render();
  });
}

function startLiveReaders() {
  onSnapshot(
    collection(db, "orders"),
    (snap) => {
      state.ready = true;
      state.orderError = "";
      state.ordersRaw = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      render();
    },
    (err) => {
      state.ready = true;
      state.orderError = `Грешка при зареждане на поръчките: ${err?.message || err}`;
      render();
    }
  );

  onSnapshot(collection(db, "tables"), (snap) => {
    state.tablesById.clear();
    snap.forEach((docSnap) => state.tablesById.set(String(docSnap.id), docSnap.data() || {}));
    render();
  });

  onSnapshot(collection(db, "employees"), (snap) => {
    state.employeesById.clear();
    snap.forEach((docSnap) => state.employeesById.set(String(docSnap.id), docSnap.data() || {}));
    render();
  });
}

function render() {
  if (!els.section || !els.body) return;

  const historyOrders = state.ordersRaw
    .filter(shouldDisplayOrder)
    .sort((left, right) => historyTimestamp(right) - historyTimestamp(left));

  renderSuggestions(historyOrders);

  if (!state.ready) {
    updateToggleButton();
    setSummary("Зареждане на историята...");
    setError("");
    setEmpty(false);
    els.body.innerHTML = `<tr><td colspan="7">Зареждане...</td></tr>`;
    return;
  }

  const filtered = historyOrders.filter(matchesFilters);
  const visible = state.showAllOrdersHistory
    ? filtered
    : filtered.slice(0, DEFAULT_COLLAPSED_RESULTS);
  updateToggleButton();

  if (state.active) {
    loadMissingItems(visible);
  }

  setError(state.orderError);

  if (!filtered.length) {
    setSummary("Няма намерени поръчки.");
    setEmpty(true);
    els.body.innerHTML = "";
    return;
  }

  setEmpty(false);
  setSummary(buildSummaryText(filtered.length, visible.length, historyOrders.length));

  els.body.innerHTML = visible.map((order) => renderOrderRow(order)).join("");
}

function renderSuggestions(orders) {
  if (els.tableOptions) {
    const tableValues = uniqueSorted(
      orders.map((order) => tableLabel(order)).filter(Boolean)
    );
    els.tableOptions.innerHTML = tableValues.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
  }

  if (els.waiterOptions) {
    const waiterValues = uniqueSorted(
      orders.map((order) => waiterLabel(order)).filter((value) => value && value !== "—")
    );
    els.waiterOptions.innerHTML = waiterValues.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
  }
}

function buildSummaryTextLegacy(filteredCount, visibleCount, totalHistoryCount) {
  const parts = [`Намерени ${filteredCount} поръчки`];
  if (visibleCount < filteredCount) {
    parts.push(`показани ${visibleCount}`);
  }
  parts.push(`от общо ${totalHistoryCount} в списъка`);
  return parts.join(" • ");
}

function buildSummaryText(filteredCount, visibleCount, totalHistoryCount) {
  const parts = [
    `Намерени ${filteredCount} поръчки`,
    `показани ${visibleCount}`,
    `от общо ${totalHistoryCount} в списъка`,
  ];
  return parts.join(" • ");
}

function updateToggleButton() {
  if (!els.toggleBtn) return;
  els.toggleBtn.textContent = state.showAllOrdersHistory ? "Покажи по-малко" : "Виж всички";
}

function renderOrderRow(order) {
  const itemsState = resolveOrderItems(order);
  const total = resolveOrderTotal(order, itemsState.items);

  return `
    <tr>
      <td><span class="order-history-order-id">${escapeHtml(orderNumber(order))}</span></td>
      <td>${escapeHtml(formatDateTime(historyTimestamp(order)))}</td>
      <td>${escapeHtml(tableLabel(order))}</td>
      <td>${escapeHtml(waiterLabel(order))}</td>
      <td>${renderItemsCell(itemsState)}</td>
      <td>${escapeHtml(formatMoney(total))}</td>
      <td>${renderStatusBadge(order)}</td>
    </tr>
  `;
}

function renderItemsCell({ items, loading }) {
  if (items.length) {
    return `
      <div class="order-history-items">
        ${items.map((item) => renderItem(item)).join("")}
      </div>
    `;
  }

  if (loading) {
    return `<div class="order-history-items-loading">Зареждане на артикули...</div>`;
  }

  return `<div class="order-history-items-empty">Няма записани артикули.</div>`;
}

function renderItem(item) {
  const metaParts = [];
  if (item.variant) metaParts.push(item.variant);
  if (item.notes) metaParts.push(item.notes);
  if (item.extras) metaParts.push(`Добавки: ${item.extras}`);

  return `
    <div class="order-history-item">
      <div class="order-history-item-line">
        <span class="order-history-item-main">${escapeHtml(`${item.qty} x ${item.name}`)}</span>
        ${item.price != null ? `<span class="order-history-item-price">${escapeHtml(formatMoney(item.price))}</span>` : ""}
      </div>
      ${metaParts.length ? `<div class="order-history-item-meta">${escapeHtml(metaParts.join(" • "))}</div>` : ""}
    </div>
  `;
}

function renderStatusBadge(order) {
  const status = historyStatus(order);
  const labelMap = {
    paid: "Платена",
    closed: "Затворена",
    cancelled: "Отказана",
    completed: "Завършена",
    served: "Сервирана",
    ready: "Готова",
    preparing: "Подготовка",
    cooking: "Приготвя се",
    in_progress: "В процес",
    new: "Нова",
    created: "Създадена",
    open: "Отворена",
    pending: "Изчаква",
    busy: "Активна",
  };

  let className = "status-info";
  if (FINAL_STATUSES.has(status) && status !== "cancelled") {
    className = "status-success";
  } else if (status === "cancelled") {
    className = "status-danger";
  } else if (LIVE_STATUSES.has(status)) {
    className = "status-warning";
  }

  return `<span class="status-badge ${className}">${escapeHtml(labelMap[status] || status || "—")}</span>`;
}

function setSummary(text) {
  if (els.summary) els.summary.textContent = text;
}

function setError(message) {
  if (!els.error) return;
  const hasMessage = Boolean(String(message || "").trim());
  els.error.hidden = !hasMessage;
  els.error.textContent = hasMessage ? String(message) : "";
}

function setEmpty(isVisible) {
  if (!els.empty) return;
  els.empty.hidden = !isVisible;
}

function matchesFilters(order) {
  const dateValue = String(els.date?.value || "").trim();
  const tableValue = normalize(els.table?.value);
  const waiterValue = normalize(els.waiter?.value);
  const orderValue = normalize(els.orderNumber?.value);

  if (dateValue && toLocalDateKey(historyTimestamp(order)) !== dateValue) return false;

  if (tableValue) {
    const haystack = normalize([
      tableLabel(order),
      order.tableName,
      order.tableNumber,
      order.table,
      order.tableId,
    ].join(" "));
    if (!haystack.includes(tableValue)) return false;
  }

  if (waiterValue) {
    const haystack = normalize([
      waiterLabel(order),
      waiterId(order),
      employeeName(state.employeesById.get(waiterId(order))),
      state.employeesById.get(waiterId(order))?.email,
    ].join(" "));
    if (!haystack.includes(waiterValue)) return false;
  }

  if (orderValue) {
    const haystack = normalize([
      orderNumber(order),
      order.orderId,
      order.orderNumber,
      order.receiptNumber,
      order.id,
    ].join(" "));
    if (!haystack.includes(orderValue)) return false;
  }

  return true;
}

function shouldDisplayOrder(order) {
  const status = historyStatus(order);
  return (
    DISPLAYABLE_STATUSES.has(status) ||
    normalize(order?.paymentStatus) === "paid" ||
    normalize(order?.paymentStatus) === "unpaid" ||
    historyTimestamp(order) > 0 ||
    toMillis(order?.closedAt) > 0 ||
    toMillis(order?.servedAt) > 0 ||
    normalizeItems(order?.items).length > 0 ||
    Number(order?.activeItemCount || 0) > 0
  );
}

function historyStatus(order) {
  const direct = normalize(order?.status);
  if (DISPLAYABLE_STATUSES.has(direct)) return direct;

  const orderStatus = normalize(order?.orderStatus);
  if (DISPLAYABLE_STATUSES.has(orderStatus)) return orderStatus;

  if (normalize(order?.paymentStatus) === "paid") return "paid";
  if (toMillis(order?.closedAt) > 0) return "closed";
  if (toMillis(order?.servedAt) > 0) return "served";
  return direct || orderStatus || "open";
}

function historyTimestamp(order) {
  return (
    toMillis(order?.closedAt) ||
    toMillis(order?.paidAt) ||
    toMillis(order?.completedAt) ||
    toMillis(order?.servedAt) ||
    toMillis(order?.updatedAt) ||
    toMillis(order?.createdAt)
  );
}

function orderNumber(order) {
  return String(order?.orderNumber || order?.receiptNumber || order?.orderId || order?.id || "—");
}

function waiterId(order) {
  return String(order?.waiterId || order?.waiterUID || order?.staffId || order?.employeeId || order?.createdBy || "");
}

function waiterLabel(order) {
  const rawName = String(order?.waiterName || order?.waiter || order?.waiterLabel || "").trim();
  if (rawName) return rawName;

  const employee = state.employeesById.get(waiterId(order));
  const resolved = employeeName(employee);
  if (resolved) return resolved;

  return waiterId(order) || "—";
}

function tableLabel(order) {
  const raw = order?.tableNumber ?? order?.tableName ?? order?.table ?? null;
  if (raw != null && String(raw).trim() !== "") return String(raw);

  const tableIdValue = String(order?.tableId || "").trim();
  if (!tableIdValue) return "—";

  const table = state.tablesById.get(tableIdValue);
  if (!table) return tableIdValue;

  const number = table?.number ?? table?.tableNumber ?? table?.name ?? tableIdValue;
  return String(number);
}

function employeeName(employee) {
  if (!employee) return "";
  return String(
    employee?.name ||
    employee?.displayName ||
    [employee?.firstName, employee?.lastName].filter(Boolean).join(" ").trim() ||
    employee?.email ||
    ""
  ).trim();
}

function resolveOrderItems(order) {
  const summaryItems = normalizeItems(order?.items);
  if (summaryItems.length) {
    return { items: mergeItems(summaryItems), loading: false };
  }

  const cached = state.itemsByOrderId.get(String(order.id));
  if (Array.isArray(cached) && cached.length) {
    return { items: mergeItems(cached), loading: false };
  }

  return { items: [], loading: state.loadingItems.has(String(order.id)) };
}

function loadMissingItems(orders) {
  orders.forEach((order) => {
    const orderId = String(order?.id || "");
    if (!orderId) return;
    if (normalizeItems(order?.items).length) return;
    if (state.itemsByOrderId.has(orderId) || state.loadingItems.has(orderId)) return;

    state.loadingItems.add(orderId);

    readOrderItems(orderId)
      .then((items) => {
        state.itemsByOrderId.set(orderId, items);
      })
      .catch((err) => {
        console.warn("order history items read failed:", { orderId, err });
        state.itemsByOrderId.set(orderId, []);
      })
      .finally(() => {
        state.loadingItems.delete(orderId);
        render();
      });
  });
}

async function readOrderItems(orderId) {
  const snap = await getDocs(collection(db, "orders", orderId, "items"));
  return normalizeItems(
    snap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((left, right) => toMillis(left?.createdAt) - toMillis(right?.createdAt))
  );
}

function resolveOrderTotal(order, items) {
  const directCandidates = [
    order?.total,
    order?.sum,
    order?.amount,
    order?.totalRevenue,
  ];

  for (const candidate of directCandidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }

  if (!items.length) return null;

  return items.reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    const price = Number(item?.price || 0);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = String(
        item?.name ||
        item?.title ||
        item?.label ||
        item?.itemName ||
        item?.productName ||
        item?.itemId ||
        item?.menuId ||
        ""
      ).trim();
      if (!name) return null;

      const qtyValue = Number(item?.qty ?? item?.quantity ?? item?.count ?? item?.q ?? 1);
      const priceValue = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost);

      return {
        name,
        qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
        price: Number.isFinite(priceValue) ? priceValue : null,
        notes: String(item?.notes || item?.note || item?.comment || "").trim(),
        variant: String(item?.variant || item?.size || item?.option || "").trim(),
        extras: normalizeExtras(item?.extras ?? item?.addons ?? item?.additions),
      };
    })
    .filter(Boolean);
}

function normalizeExtras(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry?.name || entry?.label || entry || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return String(value || "").trim();
}

function mergeItems(items) {
  const merged = new Map();

  items.forEach((item) => {
    const key = [
      normalize(item?.name),
      item?.price ?? "",
      normalize(item?.notes),
      normalize(item?.variant),
      normalize(item?.extras),
    ].join("|");

    const existing = merged.get(key);
    if (existing) {
      existing.qty += Number(item?.qty || 0);
      return;
    }

    merged.set(key, {
      name: String(item?.name || "").trim(),
      qty: Number(item?.qty || 0) || 1,
      price: item?.price != null ? Number(item.price) : null,
      notes: String(item?.notes || "").trim(),
      variant: String(item?.variant || "").trim(),
      extras: String(item?.extras || "").trim(),
    });
  });

  return Array.from(merged.values());
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "bg", { numeric: true, sensitivity: "base" }));
}

function formatDateTime(ms) {
  if (!ms) return "—";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("bg-BG");
}

function toLocalDateKey(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return Number(value.toMillis()) || 0;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? Number(date.getTime()) || 0 : 0;
  }
  if (typeof value.seconds === "number") {
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return (value.seconds * 1000) + Math.floor(nanos / 1000000);
  }
  if (value instanceof Date) return Number(value.getTime()) || 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}
