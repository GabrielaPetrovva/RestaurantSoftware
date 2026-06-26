(function (global) {
  "use strict";

  function cleanId(value) {
    return String(value || "").trim();
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function readQty(item) {
    const qty = safeNumber(item?.qty ?? item?.quantity, 1);
    return qty > 0 ? Math.round(qty) : 1;
  }

  function normalizeItem(item, index) {
    const qty = readQty(item);
    const price = Math.max(0, safeNumber(item?.price, 0));
    const menuId = cleanId(item?.menuId || item?.itemId || item?.id);
    const station = cleanId(item?.station || item?.targetStation).toLowerCase() === "bar"
      ? "bar"
      : "kitchen";

    return {
      id: cleanId(item?.id || menuId || `item_${index + 1}`),
      menuId,
      itemId: cleanId(item?.itemId || menuId),
      name: cleanId(item?.name || item?.title) || `Item ${index + 1}`,
      price,
      qty,
      quantity: qty,
      totalPrice: Math.round(price * qty * 100) / 100,
      category: cleanId(item?.category || item?.categoryKey || item?.type),
      station,
      qrCode: cleanId(item?.qrCode || item?.shortCode || item?.code || item?.qr)
    };
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : [])
      .map(normalizeItem)
      .filter((item) => item.name && item.qty > 0);
  }

  function calculateTotal(items) {
    return Math.round(normalizeItems(items).reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
  }

  function isValidPublicBillToken(value) {
    return /^[A-Za-z0-9_-]{32,160}$/.test(cleanId(value));
  }

  function toPublicBillItems(items) {
    return normalizeItems(items).map((item) => ({
      id: cleanId(item.id || item.menuId || item.itemId),
      name: cleanId(item.name),
      price: safeNumber(item.price, 0),
      qty: readQty(item)
    }));
  }

  function itemMergeKey(item, index) {
    return cleanId(
      item?.id ||
      item?.menuId ||
      item?.itemId ||
      item?.qrCode ||
      item?.shortCode
    ) || `name:${cleanId(item?.name || item?.title).toLowerCase()}` || `item:${index}`;
  }

  function mergeItems(existingItems, newItems) {
    const merged = new Map();

    normalizeItems(existingItems).forEach((item, index) => {
      merged.set(itemMergeKey(item, index), { ...item });
    });

    normalizeItems(newItems).forEach((item, index) => {
      const key = itemMergeKey(item, index);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...item });
        return;
      }

      const qty = readQty(existing) + readQty(item);
      const price = safeNumber(existing.price, safeNumber(item.price, 0));
      merged.set(key, {
        ...existing,
        qty,
        quantity: qty,
        price,
        totalPrice: Math.round(price * qty * 100) / 100
      });
    });

    return Array.from(merged.values());
  }

  function isActiveUnpaidOrder(order) {
    const status = cleanId(order?.status).toLowerCase();
    const paymentStatus = cleanId(order?.paymentStatus).toLowerCase();
    const orderStatus = cleanId(order?.orderStatus).toLowerCase();
    return (
      order?.paid !== true &&
      paymentStatus !== "paid" &&
      !["paid", "cancelled", "closed"].includes(status) &&
      orderStatus !== "closed"
    );
  }

  function parseCartReference(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const cartId = cleanId(parsed?.cartId || parsed?.cart_id || parsed?.id);
      if (cartId && (!parsed?.type || String(parsed.type).toLowerCase() === "cart")) {
        return {
          type: "cart",
          cartId,
          tableId: cleanId(parsed?.tableId || parsed?.table_id)
        };
      }
    } catch {}

    try {
      const url = new URL(raw, global.location?.href || "https://local.invalid/");
      const cartId = cleanId(url.searchParams.get("cartId") || url.searchParams.get("cart_id"));
      if (cartId) {
        return {
          type: "cart",
          cartId,
          tableId: cleanId(url.searchParams.get("tableId") || url.searchParams.get("table_id"))
        };
      }
    } catch {}

    const cartMatch = raw.match(/(?:^|[?&#|;,\s])cart(?:_|-)?id\s*[:=]\s*([^&#|;,\s]+)/i);
    if (!cartMatch) return null;

    const tableMatch = raw.match(/(?:^|[?&#|;,\s])table(?:_|-)?id\s*[:=]\s*([^&#|;,\s]+)/i);
    return {
      type: "cart",
      cartId: cleanId(decodeURIComponent(cartMatch[1])),
      tableId: tableMatch ? cleanId(decodeURIComponent(tableMatch[1])) : ""
    };
  }

  function cleanWaiter(waiter) {
    const uid = cleanId(waiter?.uid || waiter?.id);
    const name = cleanId(waiter?.name || waiter?.fullName || waiter?.displayName || waiter?.email);
    return { uid, name: name || "Waiter" };
  }

  async function findActiveOrderIdsForTable(db, tableId) {
    if (!tableId) return [];
    const snap = await db.collection("orders").where("tableId", "==", tableId).get();
    return snap.docs
      .filter((doc) => isActiveUnpaidOrder(doc.data() || {}))
      .map((doc) => doc.id);
  }

  async function mergeCartItemsIntoActiveOrder(options) {
    const db = options?.db;
    const FieldValue = options?.FieldValue;
    const cartId = cleanId(options?.cartId);
    const selectedTableId = cleanId(options?.selectedTableId);

    if (!db || typeof db.runTransaction !== "function") throw new Error("Firestore is not available.");
    if (!FieldValue?.serverTimestamp || !FieldValue?.arrayUnion) throw new Error("Firestore FieldValue is not available.");
    if (!cartId) throw new Error("Missing cartId.");

    const cartRef = db.collection("carts").doc(cartId);
    const newOrderRef = db.collection("orders").doc();
    const waiter = cleanWaiter(options?.waiter || {});
    const queriedActiveOrderIds = await findActiveOrderIdsForTable(db, selectedTableId);

    return db.runTransaction(async (tx) => {
      const cartSnap = await tx.get(cartRef);
      if (!cartSnap.exists) throw new Error("QR кошницата не съществува.");

      const cart = cartSnap.data() || {};
      const status = cleanId(cart.status).toLowerCase();
      const existingOrderId = cleanId(cart.orderId);
      if (existingOrderId || status === "accepted" || status === "cleared") {
        return {
          ok: true,
          alreadyAccepted: true,
          cartId,
          orderId: existingOrderId,
          tableId: cleanId(cart.tableId)
        };
      }

      if (!["draft", "pending_scan"].includes(status)) {
        throw new Error(`QR кошницата не може да бъде приета (status: ${status || "missing"}).`);
      }

      const cartItems = normalizeItems(cart.items);
      if (!cartItems.length) throw new Error("QR кошницата няма ястия.");
      const publicBillToken = cleanId(cart.publicBillToken);
      if (publicBillToken && !isValidPublicBillToken(publicBillToken)) {
        throw new Error("QR кошницата има невалиден public bill token.");
      }

      const tableId = selectedTableId || cleanId(cart.tableId);
      if (!tableId) throw new Error("Избери маса за поръчката.");

      const tableRef = db.collection("tables").doc(tableId);
      const tableSnap = await tx.get(tableRef);
      if (!tableSnap.exists) throw new Error("Избраната маса не съществува.");

      const incomingItems = normalizeItems(options?.items).length
        ? normalizeItems(options.items)
        : cartItems;
      const now = FieldValue.serverTimestamp();
      const table = tableSnap.data() || {};
      const tableNumber = cart.tableNumber ?? table.number ?? null;
      const tableLabel = tableNumber != null
        ? `Table ${tableNumber}`
        : cleanId(table.name || table.title || tableId);

      const candidateIds = [];
      const addCandidateId = (value) => {
        const id = cleanId(value);
        if (id && !candidateIds.includes(id)) candidateIds.push(id);
      };
      addCandidateId(table.currentOrderId);
      addCandidateId(table.activeOrderId);
      (Array.isArray(table.activeOrders) ? table.activeOrders : []).forEach(addCandidateId);
      (Array.isArray(table.activeOrderIds) ? table.activeOrderIds : []).forEach(addCandidateId);
      queriedActiveOrderIds.forEach(addCandidateId);

      const candidateSnaps = await Promise.all(
        candidateIds.map((id) => tx.get(db.collection("orders").doc(id)))
      );
      let activeOrderSnap = candidateSnaps.find((snap) => {
        if (!snap.exists) return false;
        const order = snap.data() || {};
        return cleanId(order.tableId) === tableId && isActiveUnpaidOrder(order);
      }) || null;

      const orderRef = activeOrderSnap?.ref || newOrderRef;
      const existingOrder = activeOrderSnap?.data() || {};
      const orderId = orderRef.id;
      const items = activeOrderSnap
        ? mergeItems(existingOrder.items, incomingItems)
        : incomingItems;
      const total = calculateTotal(items);
      const orderPatch = {
        orderId,
        tableId,
        tableNumber,
        tableLabel,
        items,
        total,
        status: existingOrder.status || "active",
        orderStatus: "open",
        paymentStatus: existingOrder.paymentStatus || "unpaid",
        paid: false,
        source: existingOrder.source || "qr",
        type: existingOrder.type || "dine-in",
        waiterId: existingOrder.waiterId || waiter.uid || null,
        createdBy: existingOrder.createdBy || waiter.uid || null,
        acceptedBy: waiter,
        activeItemCount: items.reduce((sum, item) => sum + item.qty, 0),
        updatedAt: now,
        closedAt: null,
        cartIds: FieldValue.arrayUnion(cartId)
      };

      if (publicBillToken) {
        orderPatch.publicBillToken = cleanId(existingOrder.publicBillToken) || publicBillToken;
        orderPatch.publicBillTokens = FieldValue.arrayUnion(publicBillToken);
      }

      if (!activeOrderSnap) {
        orderPatch.cartId = cartId;
        orderPatch.createdAt = now;
        orderPatch.acceptedAt = now;
      }
      tx.set(orderRef, orderPatch, { merge: true });

      const publicBillTokens = [];
      const addPublicBillToken = (value) => {
        const token = cleanId(value);
        if (isValidPublicBillToken(token) && !publicBillTokens.includes(token)) publicBillTokens.push(token);
      };
      addPublicBillToken(existingOrder.publicBillToken);
      (Array.isArray(existingOrder.publicBillTokens) ? existingOrder.publicBillTokens : []).forEach(addPublicBillToken);
      addPublicBillToken(publicBillToken);

      const publicBillPayload = {
        tableId,
        tableNumber,
        orderId,
        items: toPublicBillItems(items),
        total,
        status: existingOrder.status || "active",
        paymentStatus: existingOrder.paymentStatus || "unpaid",
        paid: false,
        updatedAt: now
      };
      publicBillTokens.forEach((token) => {
        tx.set(db.collection("public_bills").doc(token), publicBillPayload, { merge: true });
      });

      incomingItems.forEach((item, index) => {
        const itemRef = orderRef.collection("items").doc(`${cartId}_${String(index + 1).padStart(3, "0")}`);
        tx.set(itemRef, {
          ...item,
          orderId,
          tableId,
          waiterId: waiter.uid || null,
          status: "new",
          createdAt: now,
          updatedAt: now
        });
      });

      tx.set(cartRef, {
        status: "accepted",
        acceptedAt: now,
        acceptedBy: waiter,
        orderId,
        tableId,
        tableNumber,
        publicBillToken: publicBillToken || null,
        updatedAt: now
      }, { merge: true });

      tx.set(tableRef, {
        status: "busy",
        currentOrderId: orderId,
        activeOrderId: orderId,
        activeOrders: FieldValue.arrayUnion(orderId),
        activeOrderIds: FieldValue.arrayUnion(orderId),
        updatedAt: now
      }, { merge: true });

      return {
        ok: true,
        alreadyAccepted: false,
        mergedIntoExistingOrder: !!activeOrderSnap,
        cartId,
        orderId,
        tableId,
        total
      };
    });
  }

  const acceptCart = mergeCartItemsIntoActiveOrder;

  global.CartOrderFlow = Object.freeze({
    acceptCart,
    calculateTotal,
    calculateOrderTotal: calculateTotal,
    mergeCartItemsIntoActiveOrder,
    mergeItems,
    normalizeItems,
    parseCartReference
  });
})(window);
