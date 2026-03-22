(function attachSharedOrders(global) {
  "use strict";

  function toId(value) {
    return String(value || "").trim();
  }

  function toLower(value) {
    return String(value || "").trim().toLowerCase();
  }

  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeStation(value) {
    return toLower(value) === "bar" ? "bar" : "kitchen";
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        name: String(item?.name || item?.itemId || item?.menuId || "Item").trim(),
        qty: Math.max(1, toNumber(item?.qty, 1)),
        price: toNumber(item?.price, 0),
        menuId: toId(item?.menuId || item?.itemId),
        category: String(item?.category || "").trim(),
        station: normalizeStation(item?.station),
        notes: String(item?.notes || item?.note || "").trim()
      }))
      .filter((item) => item.name);
  }

  function hasClosedAtValue(value) {
    return value !== undefined && value !== null;
  }

  function isClosedOrder(orderData) {
    const status = toLower(orderData?.status);
    const paymentStatus = toLower(orderData?.paymentStatus);
    const orderStatus = toLower(orderData?.orderStatus);
    return (
      paymentStatus === "paid" ||
      orderStatus === "closed" ||
      status === "paid" ||
      status === "closed" ||
      status === "cancelled" ||
      hasClosedAtValue(orderData?.closedAt)
    );
  }

  function isOpenOrderForTable(orderData, tableId) {
    if (toId(orderData?.tableId) !== tableId) return false;
    if (isClosedOrder(orderData)) return false;

    const status = toLower(orderData?.status);
    const orderStatus = toLower(orderData?.orderStatus);
    if (orderStatus && orderStatus !== "open") return false;
    if (status && status !== "open" && status !== "created") return false;
    return true;
  }

  function closedReason(orderData) {
    const paymentStatus = toLower(orderData?.paymentStatus) || "-";
    const status = toLower(orderData?.status) || "-";
    const orderStatus = toLower(orderData?.orderStatus) || "-";
    const closedAt = hasClosedAtValue(orderData?.closedAt) ? "set" : "null";
    return "paymentStatus=" + paymentStatus + ", status=" + status + ", orderStatus=" + orderStatus + ", closedAt=" + closedAt;
  }

  function timestampToMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") {
      return Number(value.toMillis()) || 0;
    }
    if (typeof value.seconds === "number") {
      const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
      return (value.seconds * 1000) + Math.floor(nanos / 1000000);
    }
    if (value instanceof Date) return Number(value.getTime()) || 0;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function orderSortKey(orderData) {
    return timestampToMillis(orderData?.updatedAt) || timestampToMillis(orderData?.createdAt) || 0;
  }

  function pickLatestOpenOrder(candidates, tableId) {
    const valid = [];
    (Array.isArray(candidates) ? candidates : []).forEach((entry) => {
      const data = entry?.data || {};
      if (toId(data.tableId) !== tableId) return;

      if (isClosedOrder(data)) {
        console.log("CLOSED ORDER ignored: " + entry.id + " (" + closedReason(data) + ")");
        return;
      }

      if (!isOpenOrderForTable(data, tableId)) return;
      valid.push(entry);
    });

    if (!valid.length) return null;
    valid.sort((a, b) => orderSortKey(b.data) - orderSortKey(a.data));
    return valid[0];
  }

  function countAndTotal(items) {
    let totalDelta = 0;
    let countDelta = 0;
    items.forEach((item) => {
      totalDelta += toNumber(item.price, 0) * toNumber(item.qty, 1);
      countDelta += toNumber(item.qty, 1);
    });
    return { totalDelta, countDelta };
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function sanitizeMetaValue(value, depth) {
    if (depth > 4) return null;
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") return value;
    if (value instanceof Date) return value;
    if (Array.isArray(value)) {
      return value
        .map((entry) => sanitizeMetaValue(entry, depth + 1))
        .filter((entry) => entry !== undefined);
    }
    if (isPlainObject(value)) {
      const out = {};
      Object.keys(value).forEach((key) => {
        const next = sanitizeMetaValue(value[key], depth + 1);
        if (next !== undefined) out[key] = next;
      });
      return out;
    }
    return String(value);
  }

  function sanitizeOrderMeta(meta) {
    if (!isPlainObject(meta)) return {};
    const clean = sanitizeMetaValue(meta, 0);
    return isPlainObject(clean) ? clean : {};
  }

  function buildOpenOrderPayload(opts) {
    const meta = sanitizeOrderMeta(opts?.orderMeta || {});
    const isCreate = Boolean(opts?.createdAt);
    const payload = {
      ...meta,
      orderId: toId(opts?.orderId),
      tableId: toId(opts?.tableId),
      waiterId: opts?.waiterId || null,
      status: "open",
      orderStatus: "open",
      paymentStatus: "unpaid",
      closedAt: null,
      updatedAt: opts?.nowTs,
      activeItemCount: toNumber(opts?.activeItemCount, 0),
      total: toNumber(opts?.total, 0)
    };

    if (isCreate) {
      if (!("createdBy" in payload)) payload.createdBy = opts?.waiterId || null;
      if (!("type" in payload)) payload.type = "dine-in";
      if (!("note" in payload)) payload.note = "";
      payload.createdAt = opts.createdAt;
    }

    return payload;
  }

  function buildItemPayload(item, orderId, tableId, nowTs) {
    return {
      orderId,
      tableId,
      name: item.name,
      qty: toNumber(item.qty, 1),
      price: toNumber(item.price, 0),
      menuId: item.menuId || "",
      category: item.category || "",
      station: normalizeStation(item.station),
      notes: item.notes || "",
      status: "new",
      createdAt: nowTs,
      updatedAt: nowTs
    };
  }

  function samePrice(left, right) {
    return Math.abs(toNumber(left, 0) - toNumber(right, 0)) < 0.00001;
  }

  function itemsMatch(leftItem, rightItem) {
    const leftMenuId = toId(leftItem?.menuId || leftItem?.itemId);
    const rightMenuId = toId(rightItem?.menuId || rightItem?.itemId);
    const leftStation = normalizeStation(leftItem?.station);
    const rightStation = normalizeStation(rightItem?.station);
    const leftNotes = toLower(leftItem?.notes || leftItem?.note || "");
    const rightNotes = toLower(rightItem?.notes || rightItem?.note || "");

    if (leftMenuId && rightMenuId) {
      return (
        leftMenuId === rightMenuId &&
        leftStation === rightStation &&
        leftNotes === rightNotes
      );
    }

    const leftName = toLower(leftItem?.name || leftItem?.itemId || leftItem?.menuId || "");
    const rightName = toLower(rightItem?.name || rightItem?.itemId || rightItem?.menuId || "");
    return (
      leftName === rightName &&
      leftStation === rightStation &&
      leftNotes === rightNotes &&
      samePrice(leftItem?.price, rightItem?.price)
    );
  }

  function mergeIncomingItems(items) {
    const merged = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      const incomingQty = Math.max(1, toNumber(item?.qty, 1));
      const idx = merged.findIndex((entry) => itemsMatch(entry, item));
      if (idx < 0) {
        merged.push({
          ...item,
          qty: incomingQty
        });
        return;
      }

      merged[idx].qty = toNumber(merged[idx].qty, 1) + incomingQty;
      if (!merged[idx].menuId && item.menuId) merged[idx].menuId = item.menuId;
      if (!merged[idx].name && item.name) merged[idx].name = item.name;
      if (!merged[idx].category && item.category) merged[idx].category = item.category;
      if (!merged[idx].notes && item.notes) merged[idx].notes = item.notes;
      if (!merged[idx].station && item.station) merged[idx].station = item.station;
    });
    return merged;
  }

  async function getOpenOrderForTable(client, params) {
    const tableId = toId(params?.tableId);
    if (!tableId) throw new Error("Missing tableId");
    if (!client || typeof client.getOpenOrderForTable !== "function") {
      throw new Error("Invalid orders client");
    }
    return client.getOpenOrderForTable({ tableId });
  }

  async function getOrCreateOpenOrderForTable(client, params) {
    const tableId = toId(params?.tableId);
    if (!tableId) throw new Error("Missing tableId");

    const waiterId = toId(params?.waiterId) || null;
    const orderMeta = params?.orderMeta || {};

    let openOrder = null;
    try {
      openOrder = await getOpenOrderForTable(client, { tableId });
    } catch (err) {
      console.warn("[orders] getOpenOrderForTable failed for table", tableId, err);
    }
    if (openOrder?.orderId) {
      console.log("FOUND OPEN ORDER for table " + tableId + ": " + openOrder.orderId);
      console.log("[orders] table", tableId, "using orderId", openOrder.orderId, "status=open");
      return openOrder.orderId;
    }

    const result = await client.getOrCreateOpenOrderForTableTx({
      tableId,
      waiterId,
      orderMeta
    });

    if (result?.created) {
      console.log("NO OPEN ORDER, creating new for table " + tableId + ": " + result.orderId);
    } else {
      console.log("FOUND OPEN ORDER for table " + tableId + ": " + result.orderId);
    }

    console.log("[orders] table", tableId, "using orderId", result.orderId, "status=open");
    return result.orderId;
  }

  async function appendItemsToOrder(client, params) {
    const tableId = toId(params?.tableId);
    if (!tableId) throw new Error("Missing tableId");

    const waiterId = toId(params?.waiterId) || null;
    const orderId = toId(params?.orderId) || "";
    const itemsToWrite = normalizeItems(params?.items);
    if (!itemsToWrite.length) return orderId;

    const orderMeta = params?.orderMeta || {};
    const result = await client.appendItemsInTransaction({
      tableId,
      orderId,
      waiterId,
      items: itemsToWrite,
      orderMeta
    });

    console.log("[orders] table", tableId, "using orderId", result.orderId, "status=open");
    console.table(itemsToWrite.map((item) => ({
      name: item.name,
      qty: item.qty,
      station: item.station
    })));
    return result.orderId;
  }

  async function closeOrder(client, params) {
    const orderId = toId(params?.orderId);
    if (!orderId) throw new Error("Missing orderId");
    const tableId = toId(params?.tableId);

    await client.closeOrder({
      orderId,
      tableId,
      closeMeta: params?.closeMeta || {}
    });
  }

  function makeCompatClient(db) {
    const fv = global.firebase?.firestore?.FieldValue;
    if (!db || !fv) throw new Error("Compat Firestore client is not available");

    const ordersCol = db.collection("orders");
    const tablesCol = db.collection("tables");
    const now = () => fv.serverTimestamp();
    const arrUnion = (...values) => fv.arrayUnion(...values);
    const arrRemove = (...values) => fv.arrayRemove(...values);

    // Required composite indexes:
    // 1) orders: tableId ASC, status ASC, updatedAt DESC
    // 2) orders: tableId ASC, status ASC, createdAt DESC (fallback query)
    function openOrderQueryByUpdatedAt(tableId) {
      return ordersCol
        .where("tableId", "==", tableId)
        .where("status", "==", "open")
        .orderBy("updatedAt", "desc")
        .limit(5);
    }

    function openOrderQueryByCreatedAt(tableId) {
      return ordersCol
        .where("tableId", "==", tableId)
        .where("status", "==", "open")
        .orderBy("createdAt", "desc")
        .limit(5);
    }

    function mapCompatCandidate(snap) {
      return {
        id: snap.id,
        ref: snap.ref,
        data: snap.data() || {}
      };
    }

    async function safeQueryGet(queryRef, label) {
      try {
        return await queryRef.get();
      } catch (err) {
        console.warn("[orders] compat query failed (" + label + "):", err);
        return null;
      }
    }

    async function safeTxQueryGet(tx, queryRef, label) {
      try {
        return await tx.get(queryRef);
      } catch (err) {
        console.warn("[orders] compat tx query failed (" + label + "):", err);
        return null;
      }
    }

    async function readOpenOrderDirect(tableId) {
      const byUpdated = await safeQueryGet(openOrderQueryByUpdatedAt(tableId), "updatedAt");
      let candidate = byUpdated
        ? pickLatestOpenOrder(byUpdated.docs.map(mapCompatCandidate), tableId)
        : null;
      if (candidate) return candidate;

      const byCreated = await safeQueryGet(openOrderQueryByCreatedAt(tableId), "createdAt");
      candidate = byCreated
        ? pickLatestOpenOrder(byCreated.docs.map(mapCompatCandidate), tableId)
        : null;
      return candidate || null;
    }

    async function readOpenOrderFromActiveOrdersTx(tx, tableId, tableData) {
      const activeOrders = Array.isArray(tableData?.activeOrders) ? tableData.activeOrders : [];
      for (const rawOrderId of activeOrders) {
        const orderId = toId(rawOrderId);
        if (!orderId) continue;
        const orderRef = ordersCol.doc(orderId);
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) continue;
        const orderData = orderSnap.data() || {};
        if (isClosedOrder(orderData)) {
          console.log("CLOSED ORDER ignored: " + orderId + " (" + closedReason(orderData) + ")");
          continue;
        }
        if (!isOpenOrderForTable(orderData, tableId)) continue;
        return { id: orderId, ref: orderRef, data: orderData };
      }
      return null;
    }

    async function readOpenOrderTx(tx, tableId, tableData) {
      const byUpdated = await safeTxQueryGet(tx, openOrderQueryByUpdatedAt(tableId), "updatedAt");
      let candidate = byUpdated
        ? pickLatestOpenOrder(byUpdated.docs.map(mapCompatCandidate), tableId)
        : null;
      if (candidate) return candidate;

      const byCreated = await safeTxQueryGet(tx, openOrderQueryByCreatedAt(tableId), "createdAt");
      candidate = byCreated
        ? pickLatestOpenOrder(byCreated.docs.map(mapCompatCandidate), tableId)
        : null;
      if (candidate) return candidate;

      return readOpenOrderFromActiveOrdersTx(tx, tableId, tableData);
    }

    return {
      async getOpenOrderForTable({ tableId }) {
        const candidate = await readOpenOrderDirect(tableId);
        if (!candidate) return null;
        return { orderId: candidate.id, data: candidate.data };
      },

      async getOrCreateOpenOrderForTableTx({ tableId, waiterId, orderMeta }) {
        return db.runTransaction(async (tx) => {
          const nowTs = now();
          const tableRef = tablesCol.doc(tableId);
          const tableSnap = await tx.get(tableRef);
          const tableData = tableSnap.exists ? (tableSnap.data() || {}) : {};
          const candidate = await readOpenOrderTx(tx, tableId, tableData);

          if (candidate) {
            const existing = candidate.data || {};
            tx.set(candidate.ref, buildOpenOrderPayload({
              orderId: candidate.id,
              tableId,
              waiterId: waiterId || toId(existing.waiterId) || null,
              nowTs,
              total: toNumber(existing.total, 0),
              activeItemCount: toNumber(existing.activeItemCount, 0),
              orderMeta
            }), { merge: true });
            tx.set(tableRef, {
              status: "busy",
              currentOrderId: candidate.id,
              activeOrders: arrUnion(candidate.id),
              updatedAt: nowTs
            }, { merge: true });
            return { orderId: candidate.id, created: false };
          }

          const orderRef = ordersCol.doc();
          tx.set(orderRef, buildOpenOrderPayload({
            orderId: orderRef.id,
            tableId,
            waiterId,
            nowTs,
            createdAt: nowTs,
            total: 0,
            activeItemCount: 0,
            orderMeta
          }), { merge: true });
          tx.set(tableRef, {
            status: "busy",
            currentOrderId: orderRef.id,
            activeOrders: arrUnion(orderRef.id),
            updatedAt: nowTs
          }, { merge: true });
          return { orderId: orderRef.id, created: true };
        });
      },

      async appendItemsInTransaction({ tableId, orderId, waiterId, items, orderMeta }) {
        return db.runTransaction(async (tx) => {
          const nowTs = now();
          const tableRef = tablesCol.doc(tableId);
          const tableSnap = await tx.get(tableRef);
          const tableData = tableSnap.exists ? (tableSnap.data() || {}) : {};
          const preferredOrderId = toId(orderId);
          let selected = null;
          let created = false;

          if (preferredOrderId) {
            const preferredRef = ordersCol.doc(preferredOrderId);
            const preferredSnap = await tx.get(preferredRef);
            if (preferredSnap.exists) {
              const preferredData = preferredSnap.data() || {};
              if (isOpenOrderForTable(preferredData, tableId)) {
                selected = { id: preferredOrderId, ref: preferredRef, data: preferredData };
              } else if (isClosedOrder(preferredData)) {
                console.log("CLOSED ORDER ignored: " + preferredOrderId + " (" + closedReason(preferredData) + ")");
              }
            }
          }

          if (!selected) {
            selected = await readOpenOrderTx(tx, tableId, tableData);
          }

          if (!selected) {
            const orderRef = ordersCol.doc();
            selected = { id: orderRef.id, ref: orderRef, data: {} };
            created = true;
          }

          const incomingItems = mergeIncomingItems(items);
          const deltas = countAndTotal(incomingItems);
          const nextTotal = created
            ? deltas.totalDelta
            : toNumber(selected.data.total, 0) + deltas.totalDelta;
          const nextCount = created
            ? deltas.countDelta
            : toNumber(selected.data.activeItemCount, 0) + deltas.countDelta;

          const existingItemsSnap = await tx.get(selected.ref.collection("items").limit(500));
          const existingItems = existingItemsSnap.docs.map((snap) => ({
            ref: snap.ref,
            data: snap.data() || {}
          }));

          tx.set(selected.ref, buildOpenOrderPayload({
            orderId: selected.id,
            tableId,
            waiterId: waiterId || toId(selected.data.waiterId) || null,
            nowTs,
            createdAt: created ? nowTs : undefined,
            total: nextTotal,
            activeItemCount: nextCount,
            orderMeta
          }), { merge: true });

          incomingItems.forEach((item) => {
            const match = existingItems.find((entry) => itemsMatch(entry.data, item));
            if (!match) {
              const itemRef = selected.ref.collection("items").doc();
              const payload = buildItemPayload(item, selected.id, tableId, nowTs);
              tx.set(itemRef, payload);
              existingItems.push({ ref: itemRef, data: payload });
              return;
            }

            const nextQty = toNumber(match.data.qty, 0) + toNumber(item.qty, 1);
            const patch = {
              orderId: selected.id,
              tableId,
              qty: nextQty,
              updatedAt: nowTs,
              status: "new"
            };

            if (!toId(match.data.menuId || match.data.itemId) && toId(item.menuId)) {
              patch.menuId = toId(item.menuId);
            }
            if (!String(match.data.name || "").trim() && String(item.name || "").trim()) {
              patch.name = String(item.name).trim();
            }
            if (!Number.isFinite(Number(match.data.price))) {
              patch.price = toNumber(item.price, 0);
            }
            if (!String(match.data.category || "").trim() && String(item.category || "").trim()) {
              patch.category = String(item.category).trim();
            }
            if (!String(match.data.notes || match.data.note || "").trim() && String(item.notes || "").trim()) {
              patch.notes = String(item.notes).trim();
            }
            if (!String(match.data.station || "").trim() && String(item.station || "").trim()) {
              patch.station = normalizeStation(item.station);
            }

            tx.set(match.ref, patch, { merge: true });
            match.data = { ...match.data, ...patch };
          });

          tx.set(tableRef, {
            status: "busy",
            currentOrderId: selected.id,
            activeOrders: arrUnion(selected.id),
            updatedAt: nowTs
          }, { merge: true });

          return { orderId: selected.id, created };
        });
      },

      async closeOrder({ orderId, tableId, closeMeta }) {
        return db.runTransaction(async (tx) => {
          const nowTs = now();
          const orderRef = ordersCol.doc(orderId);
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists) return;

          const orderData = orderSnap.data() || {};
          const resolvedTableId = toId(tableId || orderData.tableId);
          const payload = {
            ...(closeMeta || {}),
            status: "closed",
            orderStatus: "closed",
            closedAt: nowTs,
            updatedAt: nowTs
          };
          if (resolvedTableId) payload.tableId = resolvedTableId;
          tx.set(orderRef, payload, { merge: true });

          if (!resolvedTableId) return;
          const tableRef = tablesCol.doc(resolvedTableId);
          const tableSnap = await tx.get(tableRef);
          const tableInfo = tableSnap.exists ? (tableSnap.data() || {}) : {};
          const activeOrders = Array.isArray(tableInfo.activeOrders) ? tableInfo.activeOrders : [];
          const remaining = activeOrders.filter((id) => toId(id) !== orderId);

          tx.set(tableRef, {
            activeOrders: arrRemove(orderId),
            currentOrderId: remaining.length ? remaining[remaining.length - 1] : null,
            status: remaining.length ? "busy" : "free",
            updatedAt: nowTs
          }, { merge: true });
        });
      }
    };
  }

  function makeModularClient(db, sdk) {
    if (!db || !sdk) throw new Error("Modular Firestore client is missing");
    const {
      collection,
      doc,
      getDocs,
      query,
      where,
      orderBy,
      limit,
      runTransaction,
      serverTimestamp,
      arrayUnion,
      arrayRemove
    } = sdk;
    if (
      !collection ||
      !doc ||
      !getDocs ||
      !query ||
      !where ||
      !orderBy ||
      !limit ||
      !runTransaction ||
      !serverTimestamp ||
      !arrayUnion ||
      !arrayRemove
    ) {
      throw new Error("Incomplete modular Firestore SDK");
    }

    const ordersCol = collection(db, "orders");
    const tablesCol = collection(db, "tables");

    // Required composite indexes:
    // 1) orders: tableId ASC, status ASC, updatedAt DESC
    // 2) orders: tableId ASC, status ASC, createdAt DESC (fallback query)
    function openOrderQueryByUpdatedAt(tableId) {
      return query(
        ordersCol,
        where("tableId", "==", tableId),
        where("status", "==", "open"),
        orderBy("updatedAt", "desc"),
        limit(5)
      );
    }

    function openOrderQueryByCreatedAt(tableId) {
      return query(
        ordersCol,
        where("tableId", "==", tableId),
        where("status", "==", "open"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
    }

    function mapModularCandidate(snap) {
      return {
        id: snap.id,
        ref: snap.ref,
        data: snap.data() || {}
      };
    }

    async function safeQueryGet(queryRef, label) {
      try {
        return await getDocs(queryRef);
      } catch (err) {
        console.warn("[orders] modular query failed (" + label + "):", err);
        return null;
      }
    }

    async function safeTxQueryGet(tx, queryRef, label) {
      try {
        return await tx.get(queryRef);
      } catch (err) {
        console.warn("[orders] modular tx query failed (" + label + "):", err);
        return null;
      }
    }

    async function readOpenOrderDirect(tableId) {
      const byUpdated = await safeQueryGet(openOrderQueryByUpdatedAt(tableId), "updatedAt");
      let candidate = byUpdated
        ? pickLatestOpenOrder(byUpdated.docs.map(mapModularCandidate), tableId)
        : null;
      if (candidate) return candidate;

      const byCreated = await safeQueryGet(openOrderQueryByCreatedAt(tableId), "createdAt");
      candidate = byCreated
        ? pickLatestOpenOrder(byCreated.docs.map(mapModularCandidate), tableId)
        : null;
      return candidate || null;
    }

    async function readOpenOrderFromActiveOrdersTx(tx, tableId, tableData) {
      const activeOrders = Array.isArray(tableData?.activeOrders) ? tableData.activeOrders : [];
      for (const rawOrderId of activeOrders) {
        const orderId = toId(rawOrderId);
        if (!orderId) continue;
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) continue;
        const orderData = orderSnap.data() || {};
        if (isClosedOrder(orderData)) {
          console.log("CLOSED ORDER ignored: " + orderId + " (" + closedReason(orderData) + ")");
          continue;
        }
        if (!isOpenOrderForTable(orderData, tableId)) continue;
        return { id: orderId, ref: orderRef, data: orderData };
      }
      return null;
    }

    async function readOpenOrderTx(tx, tableId, tableData) {
      const byUpdated = await safeTxQueryGet(tx, openOrderQueryByUpdatedAt(tableId), "updatedAt");
      let candidate = byUpdated
        ? pickLatestOpenOrder(byUpdated.docs.map(mapModularCandidate), tableId)
        : null;
      if (candidate) return candidate;

      const byCreated = await safeTxQueryGet(tx, openOrderQueryByCreatedAt(tableId), "createdAt");
      candidate = byCreated
        ? pickLatestOpenOrder(byCreated.docs.map(mapModularCandidate), tableId)
        : null;
      if (candidate) return candidate;

      return readOpenOrderFromActiveOrdersTx(tx, tableId, tableData);
    }

    return {
      async getOpenOrderForTable({ tableId }) {
        const candidate = await readOpenOrderDirect(tableId);
        if (!candidate) return null;
        return { orderId: candidate.id, data: candidate.data };
      },

      async getOrCreateOpenOrderForTableTx({ tableId, waiterId, orderMeta }) {
        return runTransaction(db, async (tx) => {
          const nowTs = serverTimestamp();
          const tableRef = doc(tablesCol, tableId);
          const tableSnap = await tx.get(tableRef);
          const tableData = tableSnap.exists() ? (tableSnap.data() || {}) : {};
          const candidate = await readOpenOrderTx(tx, tableId, tableData);

          if (candidate) {
            const existing = candidate.data || {};
            tx.set(candidate.ref, buildOpenOrderPayload({
              orderId: candidate.id,
              tableId,
              waiterId: waiterId || toId(existing.waiterId) || null,
              nowTs,
              total: toNumber(existing.total, 0),
              activeItemCount: toNumber(existing.activeItemCount, 0),
              orderMeta
            }), { merge: true });
            tx.set(tableRef, {
              status: "busy",
              currentOrderId: candidate.id,
              activeOrders: arrayUnion(candidate.id),
              updatedAt: nowTs
            }, { merge: true });
            return { orderId: candidate.id, created: false };
          }

          const orderRef = doc(collection(db, "orders"));
          tx.set(orderRef, buildOpenOrderPayload({
            orderId: orderRef.id,
            tableId,
            waiterId,
            nowTs,
            createdAt: nowTs,
            total: 0,
            activeItemCount: 0,
            orderMeta
          }), { merge: true });
          tx.set(tableRef, {
            status: "busy",
            currentOrderId: orderRef.id,
            activeOrders: arrayUnion(orderRef.id),
            updatedAt: nowTs
          }, { merge: true });
          return { orderId: orderRef.id, created: true };
        });
      },

      async appendItemsInTransaction({ tableId, orderId, waiterId, items, orderMeta }) {
        return runTransaction(db, async (tx) => {
          const nowTs = serverTimestamp();
          const tableRef = doc(tablesCol, tableId);
          const tableSnap = await tx.get(tableRef);
          const tableData = tableSnap.exists() ? (tableSnap.data() || {}) : {};
          const preferredOrderId = toId(orderId);
          let selected = null;
          let created = false;

          if (preferredOrderId) {
            const preferredRef = doc(db, "orders", preferredOrderId);
            const preferredSnap = await tx.get(preferredRef);
            if (preferredSnap.exists()) {
              const preferredData = preferredSnap.data() || {};
              if (isOpenOrderForTable(preferredData, tableId)) {
                selected = { id: preferredOrderId, ref: preferredRef, data: preferredData };
              } else if (isClosedOrder(preferredData)) {
                console.log("CLOSED ORDER ignored: " + preferredOrderId + " (" + closedReason(preferredData) + ")");
              }
            }
          }

          if (!selected) {
            selected = await readOpenOrderTx(tx, tableId, tableData);
          }

          if (!selected) {
            const orderRef = doc(collection(db, "orders"));
            selected = { id: orderRef.id, ref: orderRef, data: {} };
            created = true;
          }

          const incomingItems = mergeIncomingItems(items);
          const deltas = countAndTotal(incomingItems);
          const nextTotal = created
            ? deltas.totalDelta
            : toNumber(selected.data.total, 0) + deltas.totalDelta;
          const nextCount = created
            ? deltas.countDelta
            : toNumber(selected.data.activeItemCount, 0) + deltas.countDelta;

          const itemsQuery = query(collection(db, "orders", selected.id, "items"), limit(500));
          const existingItemsSnap = await tx.get(itemsQuery);
          const existingItems = existingItemsSnap.docs.map((snap) => ({
            ref: snap.ref,
            data: snap.data() || {}
          }));

          tx.set(selected.ref, buildOpenOrderPayload({
            orderId: selected.id,
            tableId,
            waiterId: waiterId || toId(selected.data.waiterId) || null,
            nowTs,
            createdAt: created ? nowTs : undefined,
            total: nextTotal,
            activeItemCount: nextCount,
            orderMeta
          }), { merge: true });

          incomingItems.forEach((item) => {
            const match = existingItems.find((entry) => itemsMatch(entry.data, item));
            if (!match) {
              const itemRef = doc(collection(db, "orders", selected.id, "items"));
              const payload = buildItemPayload(item, selected.id, tableId, nowTs);
              tx.set(itemRef, payload);
              existingItems.push({ ref: itemRef, data: payload });
              return;
            }

            const nextQty = toNumber(match.data.qty, 0) + toNumber(item.qty, 1);
            const patch = {
              orderId: selected.id,
              tableId,
              qty: nextQty,
              updatedAt: nowTs,
              status: "new"
            };

            if (!toId(match.data.menuId || match.data.itemId) && toId(item.menuId)) {
              patch.menuId = toId(item.menuId);
            }
            if (!String(match.data.name || "").trim() && String(item.name || "").trim()) {
              patch.name = String(item.name).trim();
            }
            if (!Number.isFinite(Number(match.data.price))) {
              patch.price = toNumber(item.price, 0);
            }
            if (!String(match.data.category || "").trim() && String(item.category || "").trim()) {
              patch.category = String(item.category).trim();
            }
            if (!String(match.data.notes || match.data.note || "").trim() && String(item.notes || "").trim()) {
              patch.notes = String(item.notes).trim();
            }
            if (!String(match.data.station || "").trim() && String(item.station || "").trim()) {
              patch.station = normalizeStation(item.station);
            }

            tx.set(match.ref, patch, { merge: true });
            match.data = { ...match.data, ...patch };
          });

          tx.set(tableRef, {
            status: "busy",
            currentOrderId: selected.id,
            activeOrders: arrayUnion(selected.id),
            updatedAt: nowTs
          }, { merge: true });

          return { orderId: selected.id, created };
        });
      },

      async closeOrder({ orderId, tableId, closeMeta }) {
        return runTransaction(db, async (tx) => {
          const nowTs = serverTimestamp();
          const orderRef = doc(db, "orders", orderId);
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists()) return;

          const orderData = orderSnap.data() || {};
          const resolvedTableId = toId(tableId || orderData.tableId);
          const payload = {
            ...(closeMeta || {}),
            status: "closed",
            orderStatus: "closed",
            closedAt: nowTs,
            updatedAt: nowTs
          };
          if (resolvedTableId) payload.tableId = resolvedTableId;
          tx.set(orderRef, payload, { merge: true });

          if (!resolvedTableId) return;
          const tableRef = doc(tablesCol, resolvedTableId);
          const tableSnap = await tx.get(tableRef);
          const tableInfo = tableSnap.exists() ? (tableSnap.data() || {}) : {};
          const activeOrders = Array.isArray(tableInfo.activeOrders) ? tableInfo.activeOrders : [];
          const remaining = activeOrders.filter((id) => toId(id) !== orderId);

          tx.set(tableRef, {
            activeOrders: arrayRemove(orderId),
            currentOrderId: remaining.length ? remaining[remaining.length - 1] : null,
            status: remaining.length ? "busy" : "free",
            updatedAt: nowTs
          }, { merge: true });
        });
      }
    };
  }

  global.SharedOrders = {
    makeCompatClient,
    makeModularClient,
    getOpenOrderForTable,
    getOrCreateOpenOrderForTable,
    appendItemsToOrder,
    closeOrder
  };
})(window);
