(function () {
  const COLLECTION = "guest_qr_sessions";

  function normalizeQrText(payload) {
    return String(payload || "").trim().replace(/\s+/g, "");
  }

  function hashQrPayload(payload) {
    const text = normalizeQrText(payload);
    if (!text) return "";

    let hash = 5381;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    }

    return `qr_${(hash >>> 0).toString(36)}`;
  }

  function createSessionId() {
    const rand = Math.random().toString(36).slice(2, 10);
    return `g_${Date.now().toString(36)}_${rand}`;
  }

  function extractSessionId(rawText) {
    const raw = String(rawText || "").trim();
    if (!raw.startsWith("R1|") && !raw.startsWith("R2|")) return "";

    return raw
      .split("|")
      .slice(1)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx <= 0) return null;
        const key = part.slice(0, idx);
        const value = part.slice(idx + 1);
        return key === "s" ? decodeURIComponent(value) : null;
      })
      .find(Boolean) || "";
  }

  function resolveSessionId(rawText, explicitSessionId) {
    const explicit = String(explicitSessionId || "").trim();
    if (explicit) return explicit;

    const extracted = extractSessionId(rawText);
    if (extracted) return extracted;

    return hashQrPayload(rawText);
  }

  function toReceiptItems(items) {
    return (Array.isArray(items) ? items : [])
      .map((raw) => {
        const name = String(raw?.name ?? raw?.title ?? raw?.item ?? "").trim();
        if (!name) return null;

        const qty = Number(raw?.qty ?? raw?.quantity ?? raw?.count ?? 1);
        const quantity = Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1;
        const price = Number(raw?.price ?? raw?.unitPrice ?? 0) || 0;
        const totalRaw = raw?.totalPrice ?? raw?.lineTotal ?? raw?.total;
        const totalPrice = totalRaw == null ? price * quantity : Number(totalRaw) || price * quantity;

        return {
          name,
          displayName: name,
          quantity,
          qty: quantity,
          price,
          totalPrice,
          menuId: String(raw?.menuId ?? raw?.itemId ?? raw?.id ?? "").trim()
        };
      })
      .filter(Boolean);
  }

  async function registerPending(db, sessionId, items, qrPayload) {
    const docId = String(sessionId || "").trim();
    if (!docId || !db) return docId;

    const FieldValue = firebase.firestore.FieldValue;
    await db.collection(COLLECTION).doc(docId).set({
      status: "pending",
      sessionId: docId,
      qrPayload: String(qrPayload || "").trim(),
      items: toReceiptItems(items),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return docId;
  }

  async function markScanned(db, rawText, items, extra) {
    const sessionId = resolveSessionId(rawText, extra?.sessionId);
    if (!sessionId || !db) return sessionId;

    const FieldValue = firebase.firestore.FieldValue;
    await db.collection(COLLECTION).doc(sessionId).set({
      status: "scanned",
      sessionId,
      items: toReceiptItems(items),
      tableId: String(extra?.tableId || "").trim(),
      scannedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return sessionId;
  }

  async function markSubmitted(db, rawText, data) {
    const payload = data || {};
    const sessionId = resolveSessionId(rawText, payload.sessionId);
    if (!sessionId || !db) return sessionId;

    const FieldValue = firebase.firestore.FieldValue;

    await db.collection(COLLECTION).doc(sessionId).set({
      status: "submitted",
      sessionId,
      orderId: String(payload.orderId || "").trim(),
      tableId: String(payload.tableId || "").trim(),
      items: toReceiptItems(payload.items || []),
      submittedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return sessionId;
  }

  window.GuestQrSession = {
    COLLECTION,
    normalizeQrText,
    hashQrPayload,
    createSessionId,
    extractSessionId,
    resolveSessionId,
    toReceiptItems,
    registerPending,
    markScanned,
    markSubmitted
  };
})();
