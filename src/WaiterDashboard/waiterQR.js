(function () {
  // ========= Debug =========
  const dbg = document.getElementById("debugBox");
  const showDebug = (m) => {
    if (!dbg) return;
    dbg.style.display = "block";
    dbg.textContent = String(m || "");
  };
  const clearDebug = () => {
    if (!dbg) return;
    dbg.style.display = "none";
    dbg.textContent = "";
  };

  if (!window.firebase) {
    showDebug("вќЊ Firebase compat SDK not loaded");
    return;
  }
  if (!window.Html5Qrcode) {
    showDebug("вљ пёЏ Html5Qrcode not loaded. Check ./html5-qrcode.min.js");
  }

  const db = window.db || firebase.firestore();
  const auth = firebase.auth();

  // ========= CONFIG =========
  const COLLECTIONS = {
    tables: "tables",
    orders: "orders",
    carts: "carts",
    menus: "menus",
  };

  // SAFE_MODE:
  // true  -> СЃР°РјРѕ Р»РѕРіРІР° РІ waiter_scans (Р°РєРѕ rules СЃР° СЃС‚РµРіРЅР°С‚Рё)
  // false -> СЂРµР°Р»РЅРѕ РїРёС€Рµ РїРѕ orders/tables/items
  const SAFE_MODE = false;
  const SCANS_COLLECTION = "waiter_scans";

  // ========= DOM =========
  const el = (id) => document.getElementById(id);

  const scanStatusEl = el("scanStatus");
  const decodedBox = el("decodedBox");
  const tablesStatusEl = el("tablesStatus");
  const tableSelect = el("tableSelect");

  const metaEl = el("meta");
  const itemsEl = el("items");
  const totalEl = el("total");
  const msgEl = el("msg");

  const btnStart = el("btnStart");
  const btnStop = el("btnStop");
  const btnSend = el("btnSend");
  const btnBack = el("btnBack");

  const loginEmail = el("loginEmail");
  const loginPass = el("loginPass");
  const btnLogin = el("btnLogin");
  const btnLogout = el("btnLogout");
  const authStatus = el("authStatus");

  // ========= State =========
  let scanner = null;
  let scannerStarting = false;
  let cameraAccessPrimed = false;
  let lastRawText = null;
  let menuCacheLoaded = false;
  const menuById = new Map();
  const menuByName = new Map();

  // resolved model (СЃР»РµРґ fetch)
  let resolved = null;
  // {
  //   source: "orders"|"carts"|"path",
  //   docId: "...",
  //   tableId: "...",
  //   restaurantId: "...",
  //   data: {...},          // РѕСЂРёРіРёРЅР°Р»РЅРёСЏ РґРѕРєСѓРјРµРЅС‚
  //   items: [...], total: number, note: string
  // }

  // ========= Helpers =========
  function firebaseErr(e) {
    const code = e?.code ? String(e.code) : "";
    const msg = e?.message ? String(e.message) : String(e || "");
    return (code ? code + " вЂ” " : "") + msg;
  }

  function setStatus(text, type) {
    if (!scanStatusEl) return;
    scanStatusEl.classList.remove("ok", "err");
    if (type === "ok") scanStatusEl.classList.add("ok");
    if (type === "err") scanStatusEl.classList.add("err");
    scanStatusEl.textContent = String(text || "");
  }

  function isLocalhostHost(hostname) {
    const h = String(hostname || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  }

  function normalizeCameraError(err) {
    const name = String(err?.name || "").trim();
    const msg = String(err?.message || err || "").trim();
    const text = `${name} ${msg}`.toLowerCase();
    const permissionDenied =
      name === "NotAllowedError" ||
      name === "PermissionDeniedError" ||
      text.includes("permission denied") ||
      text.includes("permission dismissed") ||
      text.includes("notallowederror");

    if (!window.isSecureContext && !isLocalhostHost(window.location?.hostname)) {
      return {
        ui: "❌ Камерата изисква HTTPS (или localhost).",
        detail: "Отвори страницата през https:// и позволи Camera."
      };
    }
    if (permissionDenied) {
      return {
        ui: "❌ Достъпът до камерата е отказан.",
        detail: "Разреши Camera от иконата до адреса и презареди страницата."
      };
    }
    if (name === "NotFoundError" || text.includes("requested device not found")) {
      return {
        ui: "❌ Няма открита камера.",
        detail: "Провери дали устройството има камера и дали не е заета."
      };
    }
    if (name === "NotReadableError" || text.includes("could not start video source")) {
      return {
        ui: "❌ Камерата е заета от друго приложение.",
        detail: "Затвори другите приложения/табове, които ползват камерата."
      };
    }
    return {
      ui: "❌ Камера: " + (msg || "unknown error"),
      detail: ""
    };
  }

  async function getCameraPermissionState() {
    if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
      return "unknown";
    }
    try {
      const result = await navigator.permissions.query({ name: "camera" });
      const state = String(result?.state || "").toLowerCase();
      if (state === "granted" || state === "denied" || state === "prompt") {
        return state;
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  async function ensureCameraPreflight() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      throw new Error("getUserMedia is not supported in this browser.");
    }
    if (!window.isSecureContext && !isLocalhostHost(window.location?.hostname)) {
      throw new Error("Camera requires a secure context (HTTPS/localhost).");
    }
  }

  async function primeCameraAccess() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    stream.getTracks().forEach((t) => {
      try { t.stop(); } catch {}
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    cameraAccessPrimed = true;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));
  }

  function safeNum(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmtMoney(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  }

  function normalizeItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        menuId: String(x?.menuId ?? x?.menu_id ?? x?.id ?? x?.itemId ?? "").trim(),
        itemId: String(x?.itemId ?? x?.menuId ?? x?.menu_id ?? x?.id ?? "").trim(),
        name: String(x?.name ?? x?.title ?? x?.productName ?? x?.itemId ?? x?.menuId ?? "").trim(),
        qty: safeNum(x?.qty ?? x?.quantity ?? 1, 1),
        price: safeNum(x?.price ?? x?.unitPrice ?? x?.unit_price ?? 0, 0),
        category: String(x?.category ?? x?.categoryKey ?? x?.cat ?? "").trim(),
        categoryId: String(x?.categoryId ?? x?.category_id ?? "").trim(),
        type: String(x?.type ?? "").trim(),
        isDrink: x?.isDrink === true || String(x?.isDrink || "").toLowerCase() === "true",
        notes: String(x?.notes ?? x?.note ?? x?.comment ?? "").trim(),
        station: String(x?.station ?? "").trim(),
      }))
      .filter((x) => (x.name || x.menuId || x.itemId) && Number.isFinite(x.qty) && x.qty > 0);
  }

  function calcTotalFromItems(items) {
    return normalizeItems(items).reduce((sum, it) => sum + safeNum(it.qty) * safeNum(it.price), 0);
  }

  function toPlainItem(raw) {
    const name = String(raw?.name ?? raw?.item ?? raw?.title ?? "").trim();
    const qty = Number(raw?.qty ?? raw?.quantity ?? 1) || 1;
    const price = Number(raw?.price ?? raw?.unitPrice ?? 0) || 0;
    const menuId = String(raw?.menuId ?? raw?.id ?? "").trim();
    const category = String(raw?.category ?? raw?.cat ?? "").trim();
    return { name, qty, price, menuId, category };
  }

  function normalizeName(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  async function buildMenuNameMap(dbInstance) {
    const map = new Map();
    async function loadCollection(colName) {
      const snap = await dbInstance.collection(colName).get();
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const name = data.name || data.title;
        if (!name) return;
        const key = normalizeName(name);
        if (!map.has(key)) map.set(key, { id: docSnap.id, ...data });
      });
    }
    try { await loadCollection("menu_items"); } catch (e) {}
    try { await loadCollection("menus"); } catch (e) {}
    return map;
  }

  const DRINK_WORDS = [
    "чай", "tea", "кафе", "coffee", "еспресо", "espresso", "лате", "latte", "капучино", "cappuccino",
    "вода", "water", "сок", "juice", "кола", "cola", "coke", "pepsi", "фанта", "fanta", "спрайт", "sprite",
    "бира", "beer", "вино", "wine", "уиски", "whiskey", "водка", "vodka", "джин", "gin", "ром", "rum",
    "коктейл", "cocktail", "лимонада", "lemonade", "айрян"
  ];

  function resolveStationFromNameCategory(name, category) {
    const n = String(name || "").toLowerCase();
    const c = String(category || "").toLowerCase();
    const isDrink = DRINK_WORDS.some((w) => n.includes(w)) || c.includes("drink") || c.includes("напит");
    return isDrink ? "bar" : "kitchen";
  }

  function resolveStationForWrite(item) {
    const menuId = String(item?.menuId || "").trim();
    if (menuId && menuById.has(menuId)) {
      const menu = menuById.get(menuId) || {};
      const menuStation = normalizeStationValue(menu.station || "");
      if (menuStation === "bar" || menuStation === "kitchen") return menuStation;
    }
    return resolveStationFromNameCategory(item?.name, item?.category);
  }

  async function upsertByMenuIdOrName(dbInstance, FieldValue, orderId, tableId, waiterId, item, menuMap) {
    const itemsCol = dbInstance.collection("orders").doc(orderId).collection("items");

    const name = String(item?.name || "").trim();
    const qty = Number(item?.qty ?? item?.quantity ?? 1) || 1;
    const price = Number(item?.price || 0) || 0;
    const key = normalizeName(name);

    let menuId = "";
    const m = menuMap.get(key);
    if (m && m.id) menuId = String(m.id);

    console.log("[scanner] scanned key:", key, "resolved menuId:", menuId);

    if (menuId) {
      await itemsCol.doc(menuId).set({
        name,
        price: (m?.price != null ? Number(m.price) : price),
        qty: FieldValue.increment(qty),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      console.log("[scanner] merged into doc(menuId) =", menuId);
      return;
    }

    const snap = await itemsCol.where("name", "==", name).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.set({
        qty: FieldValue.increment(qty),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      console.log("[scanner] merged by name into doc =", snap.docs[0].id);
      return;
    }

    await itemsCol.add({
      orderId, tableId, waiterId,
      name, price, qty,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log("[scanner] created new item doc for", name);
  }

  function isOrderClosed(orderData) {
    const status = String(orderData?.status || "").trim().toLowerCase();
    const paymentStatus = String(orderData?.paymentStatus || "").trim().toLowerCase();
    if (paymentStatus === "paid") return true;
    if (status === "paid" || status === "closed" || status === "cancelled") return true;
    if (orderData?.closedAt != null) return true;
    return false;
  }

  function mergeOrderItems(existingItems, incomingItems) {
    const out = Array.isArray(existingItems) ? existingItems.map((x) => ({ ...x })) : [];
    for (const raw of Array.isArray(incomingItems) ? incomingItems : []) {
      const next = {
        name: String(raw?.name || "").trim(),
        qty: Math.max(1, Number(raw?.qty || 1)),
        price: Number(raw?.price || 0) || 0,
        menuId: String(raw?.menuId || "").trim(),
        category: String(raw?.category || "").trim(),
        station: raw?.station === "bar" ? "bar" : "kitchen"
      };
      const idx = out.findIndex((item) => {
        const leftId = String(item?.menuId || "").trim().toLowerCase();
        const rightId = String(next.menuId || "").trim().toLowerCase();
        const leftName = String(item?.name || "").trim().toLowerCase();
        const rightName = String(next.name || "").trim().toLowerCase();
        const leftStation = String(item?.station || "").trim().toLowerCase();
        const rightStation = String(next.station || "").trim().toLowerCase();
        return (leftId && rightId ? leftId === rightId : leftName === rightName) && leftStation === rightStation;
      });
      if (idx < 0) {
        out.push(next);
        continue;
      }
      out[idx].qty = (Number(out[idx].qty) || 0) + next.qty;
      if (!out[idx].menuId && next.menuId) out[idx].menuId = next.menuId;
      if (!out[idx].category && next.category) out[idx].category = next.category;
      if (!out[idx].name && next.name) out[idx].name = next.name;
      if (!Number.isFinite(Number(out[idx].price))) out[idx].price = next.price;
      out[idx].station = out[idx].station === "bar" ? "bar" : rightStation;
    }
    return out;
  }

  function summarizeItems(items) {
    let total = 0;
    let count = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const qty = Math.max(0, Number(item?.qty || 0));
      const price = Number(item?.price || 0);
      total += qty * (Number.isFinite(price) ? price : 0);
      count += qty;
    }
    return { total, count };
  }

  const BAR_STATIONS = new Set(["bar", "drink", "drinks", "beverage", "beverages", "napitki", "napitka"]);
  const KITCHEN_STATIONS = new Set(["kitchen", "food", "kitchenfood", "cook", "kuhnq", "kuhnya", "kuhnia", "кухня"]);
  const DRINK_CATEGORY_HINTS = ["drink", "beverage", "напит"];
  const BAR_NAME_KEYWORDS = [
    "вода",
    "минерал",
    "газира",
    "тоник",
    "лимонада",
    "фреш",
    "айрян",
    "сок",
    "juice",
    "чай",
    "tea",
    "кафе",
    "coffee",
    "еспресо",
    "espresso",
    "капучино",
    "cappuccino",
    "американо",
    "americano",
    "латте",
    "latte",
    "макиато",
    "macchiato",
    "фрапе",
    "frappe",
    "кола",
    "cola",
    "coke",
    "pepsi",
    "red bull",
    "ред бул",
    "monster",
    "монстър",
    "бира",
    "beer",
    "вино",
    "wine",
    "уиски",
    "whisky",
    "водка",
    "vodka",
    "джин",
    "gin",
    "ром",
    "rum",
    "текила",
    "tequila",
    "коняк",
    "cognac",
    "бренди",
    "brandy",
    "коктейл",
    "cocktail"
  ];

  function normalizeStationValue(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (BAR_STATIONS.has(raw)) return "bar";
    if (KITCHEN_STATIONS.has(raw)) return "kitchen";
    return "";
  }

  const BG_DRINK_WORDS = ["чай","кафе","вода","бира","вино","сок","кола","фанта","спрайт","енерг","уиски","водка","ракия","ром","джин","лимонада","айрян"];

  function resolveStationFallbackByName(name) {
    const n = String(name || "").toLowerCase();
    return BG_DRINK_WORDS.some((w) => n.includes(w)) ? "bar" : "kitchen";
  }

  async function resolveStation(dbInstance, item) {
    const direct = String(item.station || "").toLowerCase().trim();
    if (direct === "bar" || direct === "kitchen") return direct;

    const menuId = String(item.menuId || "").trim();
    if (menuId) {
      try {
        const snap = await dbInstance.collection("menus").doc(menuId).get();
        if (snap.exists) {
          const menu = snap.data() || {};
          const st = String(menu.station || "").toLowerCase().trim();
          if (st === "bar" || st === "kitchen") return st;

          const cat = String(menu.category || menu.type || "").toLowerCase();
          if (cat.includes("напит") || cat.includes("drink")) return "bar";
          if (menu.isDrink === true) return "bar";
        }
      } catch (err) {
        console.warn("resolveStation menu lookup failed:", { menuId, err });
      }
    }

    return resolveStationFallbackByName(item.name);
  }

  function textHasAnyHint(text, hints) {
    const source = String(text || "").trim().toLowerCase();
    if (!source) return false;
    return hints.some((keyword) => source.includes(String(keyword || "").toLowerCase()));
  }

  function stationForItem(item, resolvedMenu = null) {
    const directStation = normalizeStationValue(item?.station || item?.department || "");
    if (directStation) return directStation;

    const categoryText = [
      item?.category,
      item?.type,
      resolvedMenu?.category,
      resolvedMenu?.type
    ]
      .filter((part) => String(part || "").trim().length > 0)
      .join(" ");
    if (textHasAnyHint(categoryText, DRINK_CATEGORY_HINTS)) {
      return "bar";
    }

    const nameText = String(
      item?.name ||
      resolvedMenu?.name ||
      item?.title ||
      item?.productName ||
      item?.itemId ||
      item?.menuId ||
      ""
    ).trim();
    if (textHasAnyHint(nameText, BAR_NAME_KEYWORDS)) {
      return "bar";
    }

    return "kitchen";
  }

  function buildMenuIndexByIdAndName(rows) {
    menuById.clear();
    menuByName.clear();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row) return;
      const id = String(row.id || row.menuId || row.itemId || "").trim();
      const name = String(row.name || row.title || "").trim();
      const normalized = {
        ...row,
        id,
        name,
        station: normalizeStationValue(row.station || row.department || ""),
        category: String(row.category || row.type || "").trim()
      };
      if (id) menuById.set(id, normalized);
      if (name) menuByName.set(name.toLowerCase(), normalized);
    });
  }

  function resolveMenuForItem(item) {
    const menuId = String(item?.menuId || "").trim();
    const itemId = String(item?.itemId || "").trim();
    const nameKey = String(item?.name || "").trim().toLowerCase();

    if (menuId && menuById.has(menuId)) return menuById.get(menuId);
    if (itemId && menuById.has(itemId)) return menuById.get(itemId);
    if (nameKey && menuByName.has(nameKey)) return menuByName.get(nameKey);
    return null;
  }

  async function loadMenuCache() {
    if (menuCacheLoaded) return;
    menuCacheLoaded = true;
    const rows = [];
    const collections = [COLLECTIONS.menus, "menu_items"];

    for (const collectionName of collections) {
      try {
        const snap = await db.collection(collectionName).get();
        snap.forEach((docSnap) => rows.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
      } catch (err) {
        // collection may not exist in every deployment
      }
    }

    buildMenuIndexByIdAndName(rows);
  }

  async function normalizeStationsForSend(items) {
    const list = normalizeItems(items);
    const menuCache = new Map();
    await loadMenuCache();

    const resolved = [];
    for (const src of list) {
      const item = { ...src };
      const localMenu = resolveMenuForItem(item);
      let menuId = String(item.menuId || localMenu?.id || item.itemId || "").trim();
      if (menuId) item.menuId = menuId;
      if (!item.itemId && menuId) item.itemId = menuId;

      let menuData = localMenu || null;
      if (!menuData && menuId) {
        if (!menuCache.has(menuId)) {
          let found = null;
          for (const collectionName of [COLLECTIONS.menus, "menu_items"]) {
            try {
              const menuSnap = await db.collection(collectionName).doc(menuId).get();
              if (menuSnap.exists) {
                found = { id: menuSnap.id, ...(menuSnap.data() || {}) };
                break;
              }
            } catch (err) {
              console.warn("menu lookup failed:", { menuId, collection: collectionName, err });
            }
          }
          menuCache.set(menuId, found);
        }
        menuData = menuCache.get(menuId);
      }

      const displayName = String(item.name || menuData?.name || item.itemId || item.menuId || "").trim();
      const station = stationForItem(
        {
          ...item,
          category: String(item.category || menuData?.category || "").trim(),
          type: String(item.type || menuData?.type || "").trim(),
          name: displayName
        },
        menuData
      );

      resolved.push({
        ...item,
        menuId: String(menuId || "").trim(),
        itemId: String(item.itemId || menuId || "").trim(),
        name: displayName || `Item ${resolved.length + 1}`,
        category: String(item.category || menuData?.category || "").trim(),
        station
      });
    }

    return { items: resolved };
  }

  function resetUI() {
    resolved = null;
    lastRawText = null;
    if (decodedBox) decodedBox.textContent = "(empty)";
    if (metaEl) metaEl.textContent = "РќСЏРјР° Р·Р°СЂРµРґРµРЅР° РїРѕСЂСЉС‡РєР°.";
    if (itemsEl) itemsEl.innerHTML = "";
    if (totalEl) totalEl.textContent = "";
    if (msgEl) msgEl.textContent = "";
    setStatus("Р§Р°РєР°РјРµ СЃРєР°РЅРёСЂР°РЅРµвЂ¦", "muted");
    updateSendButton();
  }

  function canSend() {
    return !!resolved && !!(tableSelect && tableSelect.value);
  }

  function updateSendButton() {
    if (btnSend) btnSend.disabled = !canSend();
  }

  function renderResolved() {
    if (!resolved) {
      if (metaEl) metaEl.textContent = "РќСЏРјР° Р·Р°СЂРµРґРµРЅР° РїРѕСЂСЉС‡РєР°.";
      if (itemsEl) itemsEl.innerHTML = "";
      if (totalEl) totalEl.textContent = "";
      updateSendButton();
      return;
    }

    if (metaEl) {
      metaEl.innerHTML = `
        <div class="badge">Р—Р°СЂРµРґРµРЅРѕ вњ…</div>
        <div class="muted" style="margin-top:6px;">
          Source: ${esc(resolved.source)} вЂў ID: ${esc(resolved.docId)}
        </div>
        <div class="muted" style="margin-top:6px;">
          Note: ${esc(resolved.note || "вЂ”")}
        </div>
      `;
    }

    const items = normalizeItems(resolved.items || []);
    if (itemsEl) {
      itemsEl.innerHTML = items.length
        ? items.map((it) => `
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.06)">
            <div>${esc(it.name)} Г— ${esc(it.qty)}</div>
            <div>${fmtMoney(it.price)} Р»РІ.</div>
          </div>
        `).join("")
        : `<div class="muted">РќСЏРјР° items РІ РґРѕРєСѓРјРµРЅС‚Р°.</div>`;
    }

    const total = Number.isFinite(Number(resolved.total)) ? safeNum(resolved.total) : calcTotalFromItems(items);
    if (totalEl) totalEl.textContent = `РћР±С‰Рѕ: ${fmtMoney(total)} Р»РІ.`;
    updateSendButton();
  }

  // ========= QR payload extraction =========
  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function decodeLoose(v) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    try {
      return decodeURIComponent(s.replace(/\+/g, "%20"));
    } catch {
      return s;
    }
  }

  function readNum(v, fallback = null) {
    if (v == null || v === "") return fallback;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  function parseLoosePairs(rawText) {
    const out = {};
    const text = String(rawText || "").trim();
    if (!text) return out;

    const chunks = text.split(/[&\n;]+/).map((x) => x.trim()).filter(Boolean);
    for (const chunk of chunks) {
      const m = chunk.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
      if (!m) continue;
      const key = String(m[1] || "").trim().toLowerCase();
      const value = decodeLoose(m[2] || "");
      if (!key || value === "") continue;
      out[key] = value;
    }
    return out;
  }

  function parseItemsFromLoose(rawItems) {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return normalizeItems(rawItems);

    if (typeof rawItems === "object") {
      const arr = Array.isArray(rawItems.items) ? rawItems.items : [rawItems];
      return normalizeItems(arr);
    }

    const text = String(rawItems || "").trim();
    if (!text) return [];

    const asJson = safeJsonParse(text);
    if (Array.isArray(asJson)) return normalizeItems(asJson);
    if (asJson && typeof asJson === "object") {
      const arr = Array.isArray(asJson.items) ? asJson.items : [asJson];
      return normalizeItems(arr);
    }

    const rows = text.split(/[|\n;]+/).map((x) => x.trim()).filter(Boolean);
    const hasRowDelimiter = /[|\n;]/.test(text);
    const parsed = rows.map((row) => {
      let name = "";
      let qty = 1;
      let price = 0;
      let matchedStructured = false;

      const delim = row.includes(",") ? "," : (row.includes("*") ? "*" : (row.includes(":") ? ":" : ""));
      if (delim) {
        const parts = row.split(delim).map((x) => x.trim()).filter((x) => x.length > 0);
        if (parts.length >= 3) {
          name = parts[0];
          qty = readNum(parts[1], 1);
          price = readNum(parts[2], 0);
          matchedStructured = true;
        } else if (parts.length === 2) {
          name = parts[0];
          qty = readNum(parts[1], 1);
          matchedStructured = true;
        }
      }

      if (!name) {
        const rxWithPrice = row.match(/^(.+?)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*[@\- ]\s*(\d+(?:[.,]\d+)?)$/);
        const rxNoPrice = row.match(/^(.+?)\s*[xX]\s*(\d+(?:[.,]\d+)?)$/);
        if (rxWithPrice) {
          name = rxWithPrice[1].trim();
          qty = readNum(rxWithPrice[2], 1);
          price = readNum(rxWithPrice[3], 0);
          matchedStructured = true;
        } else if (rxNoPrice) {
          name = rxNoPrice[1].trim();
          qty = readNum(rxNoPrice[2], 1);
          matchedStructured = true;
        }
      }

      if (!name && hasRowDelimiter) {
        name = row;
        matchedStructured = true;
      }

      if (!matchedStructured || !name) return null;
      return { name, qty, price };
    }).filter(Boolean);

    return normalizeItems(parsed);
  }

  function pickLoose(obj, keys) {
    for (const k of keys) {
      const v = obj[k];
      if (v != null && String(v).trim() !== "") return v;
    }
    return null;
  }

  function tryParseUrl(text) {
    try {
      const t = String(text || "").trim();
      if (!t) return null;
      const u = /^https?:\/\//i.test(t) ? new URL(t) : new URL("https://x.local/" + t.replace(/^\//, ""));
      return u;
    } catch {
      return null;
    }
  }

  function cleanId(v) {
    if (v == null) return null;
    let s = String(v).trim();
    if (!s) return null;

    // Р°РєРѕ Рµ URL
    try {
      if (/^https?:\/\//i.test(s)) {
        const u = new URL(s);
        s = u.pathname.split("/").filter(Boolean).pop() || s;
      }
    } catch {}

    s = s.split("?")[0].split("#")[0].trim();
    if (s.includes("/")) s = s.split("/").filter(Boolean).pop() || s;

    try { s = decodeURIComponent(s); } catch {}
    s = s.replaceAll("/", "").trim();
    return s || null;
  }

  function extractIdsFromText(decodedText) {
    const raw = String(decodedText || "").trim();
    const out = { orderId: null, cartId: null, tableId: null, restaurantId: null, docPath: null };

    // 1) full doc path? (even segments)
    const pathCand = raw.split("?")[0].split("#")[0].replace(/^\/+/, "");
    const parts = pathCand.split("/").filter(Boolean);
    if (parts.length >= 2 && parts.length % 2 === 0) {
      out.docPath = pathCand;
    }

    // 2) JSON
    const j = safeJsonParse(raw);
    if (j && typeof j === "object") {
      out.orderId = cleanId(j.orderId || j.order || j.o);
      out.cartId = cleanId(j.cartId || j.cart || j.c);
      out.tableId = cleanId(j.tableId || j.table || j.t);
      out.restaurantId = cleanId(j.restaurantId || j.rid || j.restaurant);
      return out;
    }

    // 3) URL with params
    const u = tryParseUrl(raw);
    if (u) {
      const p = u.searchParams;
      out.orderId = cleanId(p.get("orderId") || p.get("order") || p.get("o"));
      out.cartId = cleanId(p.get("cartId") || p.get("cart") || p.get("c"));
      out.tableId = cleanId(p.get("tableId") || p.get("table") || p.get("t"));
      out.restaurantId = cleanId(p.get("restaurantId") || p.get("rid") || p.get("restaurant"));

      // path last segment fallback
      if (!out.orderId && !out.cartId) {
        const seg = u.pathname.split("/").filter(Boolean).pop();
        // if path looks like /orders/{id} or /carts/{id}
        const maybe = cleanId(seg);
        if (maybe) out.orderId = maybe;
      }
      return out;
    }

    // 4) loose key=value / key:value
    const kv = parseLoosePairs(raw);
    if (Object.keys(kv).length) {
      out.orderId = cleanId(pickLoose(kv, ["orderid", "order", "o"]));
      out.cartId = cleanId(pickLoose(kv, ["cartid", "cart", "c"]));
      out.tableId = cleanId(pickLoose(kv, ["tableid", "table", "t"]));
      out.restaurantId = cleanId(pickLoose(kv, ["restaurantid", "rid", "restaurant"]));
      if (out.orderId || out.cartId || out.tableId || out.restaurantId) return out;
    }

    // 5) plain id fallback
    out.orderId = cleanId(raw);
    return out;
  }

  function parseInlineOrderFromText(decodedText) {
    const raw = String(decodedText || "").trim();
    if (!raw) return null;

    const fromObject = (obj, mode) => {
      if (!obj || typeof obj !== "object") return null;

      const items = parseItemsFromLoose(
        obj.items ??
        obj.cartItems ??
        obj.orderItems ??
        obj.order?.items ??
        obj.lines ??
        obj.products ??
        obj.item
      );
      if (!items.length) return null;

      const note = String(obj.note ?? obj.comment ?? obj.comments ?? obj.customerNote ?? "").trim();
      const totalRaw = obj.total ?? obj.sum;
      const total = Number.isFinite(Number(totalRaw)) ? safeNum(totalRaw) : calcTotalFromItems(items);

      return {
        mode,
        orderId: cleanId(obj.orderId || obj.order || obj.o),
        cartId: cleanId(obj.cartId || obj.cart || obj.c),
        tableId: cleanId(obj.tableId || obj.table || obj.t),
        restaurantId: cleanId(obj.restaurantId || obj.rid || obj.restaurant),
        note,
        items,
        total,
        rawObject: obj,
      };
    };

    const j = safeJsonParse(raw);
    if (Array.isArray(j)) {
      const items = parseItemsFromLoose(j);
      if (items.length) {
        return {
          mode: "json-array",
          orderId: null,
          cartId: null,
          tableId: null,
          restaurantId: null,
          note: "",
          items,
          total: calcTotalFromItems(items),
          rawObject: { items: j },
        };
      }
    }

    const jsonObj = fromObject(j, "json-object");
    if (jsonObj) return jsonObj;

    const u = tryParseUrl(raw);
    if (u) {
      const p = u.searchParams;
      const urlObj = {
        orderId: p.get("orderId") || p.get("order") || p.get("o"),
        cartId: p.get("cartId") || p.get("cart") || p.get("c"),
        tableId: p.get("tableId") || p.get("table") || p.get("t"),
        restaurantId: p.get("restaurantId") || p.get("rid") || p.get("restaurant"),
        note: p.get("note") || p.get("comment") || p.get("comments"),
        total: p.get("total") || p.get("sum"),
        items: p.get("items") || p.get("cartItems") || p.get("orderItems") || p.get("lines") || p.get("products"),
      };

      if (!urlObj.items) {
        const itemParams = [];
        p.forEach((value, key) => {
          if (/^item\d*$/i.test(key)) itemParams.push(value);
        });
        if (itemParams.length) urlObj.items = itemParams.join("|");
      }

      const urlParsed = fromObject(urlObj, "url-params");
      if (urlParsed) return urlParsed;
    }

    const kv = parseLoosePairs(raw);
    if (Object.keys(kv).length) {
      const kvObj = {
        orderId: pickLoose(kv, ["orderid", "order", "o"]),
        cartId: pickLoose(kv, ["cartid", "cart", "c"]),
        tableId: pickLoose(kv, ["tableid", "table", "t"]),
        restaurantId: pickLoose(kv, ["restaurantid", "rid", "restaurant"]),
        note: pickLoose(kv, ["note", "comment", "comments", "customernote"]),
        total: pickLoose(kv, ["total", "sum"]),
        items: pickLoose(kv, ["items", "cartitems", "orderitems", "lines", "products", "item"]),
      };

      if (!kvObj.items) {
        const itemKeys = Object.keys(kv)
          .filter((k) => /^item\d*$/i.test(k))
          .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
        if (itemKeys.length) kvObj.items = itemKeys.map((k) => kv[k]).join("|");
      }

      const kvParsed = fromObject(kvObj, "kv-text");
      if (kvParsed) return kvParsed;
    }

    const plainItems = parseItemsFromLoose(raw);
    if (plainItems.length) {
      return {
        mode: "plain-text-items",
        orderId: null,
        cartId: null,
        tableId: null,
        restaurantId: null,
        note: "",
        items: plainItems,
        total: calcTotalFromItems(plainItems),
        rawObject: { items: plainItems },
      };
    }

    return null;
  }

  // ========= Firestore fetch =========
  async function tryGetByDocPath(path) {
    if (!path) return null;
    const snap = await db.doc(path).get();
    return snap;
  }

  function mapDocToResolved(source, docId, data) {
    const items = normalizeItems(
      data?.items ||
      data?.cartItems ||
      data?.orderItems ||
      data?.order?.items ||
      []
    );

    const total =
      (data?.total != null && Number.isFinite(Number(data.total))) ? safeNum(data.total) :
      (data?.sum != null && Number.isFinite(Number(data.sum))) ? safeNum(data.sum) :
      calcTotalFromItems(items);

    const note = String(data?.note ?? data?.comment ?? data?.comments ?? data?.customerNote ?? "").trim();

    return {
      source,
      docId,
      tableId: cleanId(data?.tableId || data?.table || data?.t),
      restaurantId: cleanId(data?.restaurantId || data?.rid || data?.restaurant),
      data: data || {},
      items,
      total,
      note,
    };
  }

  async function resolveFromQR(decodedText) {
    const ids = extractIdsFromText(decodedText);

    // РїРѕРєР°Р·РІР°РјРµ РєР°РєРІРѕ СЃРјРµ РёР·РІР°РґРёР»Рё + РєР°РєРІРѕ С‰Рµ РѕРїРёС‚Р°РјРµ
    const plan = {
      extracted: ids,
      attempts: [],
    };

    // 0) doc path
    if (ids.docPath) {
      plan.attempts.push({ type: "docPath", path: ids.docPath });
      const snap = await tryGetByDocPath(ids.docPath);
      if (snap.exists) return { resolved: mapDocToResolved("path", snap.ref.path, snap.data()), plan };
    }

    // 1) orders/{orderId}
    if (ids.orderId) {
      plan.attempts.push({ type: "orders.doc", id: ids.orderId });
      const doc = await db.collection(COLLECTIONS.orders).doc(ids.orderId).get();
      if (doc.exists) return { resolved: mapDocToResolved("orders", doc.id, doc.data()), plan };
    }

    // 2) carts/{cartId}
    if (ids.cartId) {
      plan.attempts.push({ type: "carts.doc", id: ids.cartId });
      const doc = await db.collection(COLLECTIONS.carts).doc(ids.cartId).get();
      if (doc.exists) return { resolved: mapDocToResolved("carts", doc.id, doc.data()), plan };
    }

    // 3) fallback: Р°РєРѕ РЅСЏРјР° cartId, РЅРѕ РёРјР°РјРµ orderId, РїСЂРѕР±РІР°РјРµ Рё carts СЃ orderId (РјРЅРѕРіРѕ С…РѕСЂР° СЃР»Р°РіР°С‚ вЂњidвЂќ Р±РµР· РґР° РєР°Р·РІР°С‚ РєР°РєРІРѕ Рµ)
    if (!ids.cartId && ids.orderId) {
      plan.attempts.push({ type: "carts.doc(fallback)", id: ids.orderId });
      const doc = await db.collection(COLLECTIONS.carts).doc(ids.orderId).get();
      if (doc.exists) return { resolved: mapDocToResolved("carts", doc.id, doc.data()), plan };
    }

    // 4) inline payload fallback (JSON, URL params, key=value, plain items)
    const inline = parseInlineOrderFromText(decodedText);
    if (inline) {
      plan.attempts.push({
        type: "inlinePayload",
        mode: inline.mode,
        hasOrderId: !!inline.orderId,
        hasCartId: !!inline.cartId,
      });

      const sourceId = inline.orderId || inline.cartId || "inline_payload";
      return {
        resolved: {
          source: "inline",
          docId: sourceId,
          tableId: inline.tableId,
          restaurantId: inline.restaurantId,
          data: inline.rawObject || {},
          items: inline.items,
          total: inline.total,
          note: inline.note || "",
        },
        plan,
      };
    }

    return { resolved: null, plan };
  }

  // ========= Tables =========
  async function loadTables() {
    try {
      tablesStatusEl.textContent = "Р—Р°СЂРµР¶РґР°Рј РјР°СЃРёвЂ¦";
      tableSelect.innerHTML = `<option value="">вЂ” РёР·Р±РµСЂРё РјР°СЃР° вЂ”</option>`;

      const snap = await db.collection(COLLECTIONS.tables).get();
      const tables = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      tables.sort((a, b) => String(a.number ?? a.name ?? a.id).localeCompare(String(b.number ?? b.name ?? b.id), "bg", { numeric: true }));

      for (const t of tables) {
        const opt = document.createElement("option");
        const n = t.number;
        const label = Number.isFinite(Number(n)) ? `РњР°СЃР° ${n}` : (t.name || t.title || t.id);
        opt.value = String(t.id);
        opt.textContent = label;
        tableSelect.appendChild(opt);
      }

      tablesStatusEl.textContent = `РњР°СЃРё: ${tables.length}`;
    } catch (e) {
      tablesStatusEl.textContent = "вќЊ tables РЅРµ СЃРµ Р·Р°СЂРµРґРёС…Р°";
      msgEl.textContent = "вќЊ tables error: " + firebaseErr(e);
      showDebug("loadTables(): " + firebaseErr(e));
    }
  }

  // ========= Scanner =========
  let scanLock = false;

  async function onScan(decodedText) {
    if (scanLock) return;
    scanLock = true;
    setTimeout(() => (scanLock = false), 900);

    clearDebug();
    msgEl.textContent = "";
    lastRawText = decodedText;

    setStatus("РЎРєР°РЅРёСЂР°РЅРѕвЂ¦", "muted");

    try {
      const { resolved: r, plan } = await resolveFromQR(decodedText);

      decodedBox.textContent = JSON.stringify(
        { rawText: decodedText, plan, found: !!r, foundSource: r?.source || null, foundId: r?.docId || null },
        null,
        2
      );

      if (!r) {
        resolved = null;
        renderResolved();
        setStatus("вќЊ РќРµ РЅР°РјРµСЂРёС… order/cart РґРѕРєСѓРјРµРЅС‚ РїРѕ С‚РѕР·Рё QR.", "err");
        return;
      }

      resolved = r;

      // auto-select table if found
      const tId = cleanId(r.tableId);
      if (tId) {
        const exists = Array.from(tableSelect.options).some((o) => o.value === tId);
        if (exists) tableSelect.value = tId;
      }

      setStatus("вњ… Р—Р°СЂРµРґРµРЅРѕ РѕС‚ Р±Р°Р·Р°С‚Р°!", "ok");
      renderResolved();
    } catch (e) {
      resolved = null;
      renderResolved();
      setStatus("вќЊ Р“СЂРµС€РєР° РїСЂРё Р·Р°СЂРµР¶РґР°РЅРµ РѕС‚ Р±Р°Р·Р°С‚Р°.", "err");
      showDebug("resolveFromQR(): " + firebaseErr(e));
    }
  }

  async function startScanner() {
    if (scannerStarting) return;
    scannerStarting = true;
    clearDebug();
    msgEl.textContent = "";

    if (!window.Html5Qrcode) {
      setStatus("вќЊ Html5Qrcode Р»РёРїСЃРІР°", "err");
      scannerStarting = false;
      return;
    }

    const readerEl = document.getElementById("reader");
    if (!readerEl) {
      setStatus("❌ Липсва scanner контейнер (#reader).", "err");
      msgEl.textContent = "Отвори Waiter QR страницата отново (waiterQR.html).";
      btnStart.disabled = false;
      btnStop.disabled = true;
      scannerStarting = false;
      return;
    }

    try {
      if (scanner) {
        await scanner.stop().catch(() => {});
        await scanner.clear().catch(() => {});
        scanner = null;
      }
    } catch {}

    scanner = new Html5Qrcode("reader");
    btnStart.disabled = true;
    btnStop.disabled = false;
    setStatus("РЎС‚Р°СЂС‚РёСЂР°Рј РєР°РјРµСЂР°вЂ¦", "muted");

    const config = { fps: 12, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true };

    try {
      await ensureCameraPreflight();
      const permissionState = await getCameraPermissionState();
      if (permissionState === "denied") {
        cameraAccessPrimed = false;
        setStatus("❌ Достъпът до камерата е отказан.", "err");
        msgEl.textContent = "Разреши Camera от иконата до адреса и презареди страницата.";
        btnStart.disabled = false;
        btnStop.disabled = true;
        return;
      }
      if (!cameraAccessPrimed && permissionState !== "granted") {
        await primeCameraAccess();
      }

      const cameraCandidates = [
        { facingMode: { exact: "environment" } },
        { facingMode: "environment" },
        { facingMode: { ideal: "environment" } },
        { facingMode: "user" }
      ];
      let started = false;
      let lastStartErr = null;
      for (const candidate of cameraCandidates) {
        try {
          await scanner.start(candidate, config, onScan, () => {});
          started = true;
          break;
        } catch (err) {
          lastStartErr = err;
        }
      }
      if (!started) throw lastStartErr || new Error("Cannot start camera.");

      setStatus("РљР°РјРµСЂР°: ON вЂў РЎРєРµРЅРµСЂ РіРѕС‚РѕРІ вњ…", "ok");
    } catch (e) {
      const info = normalizeCameraError(e);
      if (String(e?.name || "").trim() === "NotAllowedError") {
        cameraAccessPrimed = false;
      }
      btnStart.disabled = false;
      btnStop.disabled = true;
      setStatus(info.ui, "err");
      if (info.detail) msgEl.textContent = info.detail;
      showDebug("camera: " + firebaseErr(e));
    } finally {
      scannerStarting = false;
    }
  }

  async function stopScanner() {
    try {
      if (scanner) {
        await scanner.stop().catch(() => {});
        await scanner.clear().catch(() => {});
        scanner = null;
      }
    } catch {}
    btnStart.disabled = false;
    btnStop.disabled = true;
    setStatus("РЎРїСЂСЏРЅР° РєР°РјРµСЂР°.", "muted");
    scannerStarting = false;
  }

  async function sendOrder() {
    clearDebug();

    if (!resolved) {
      msgEl.textContent = "вќЊ РќСЏРјР° Р·Р°СЂРµРґРµРЅР° РїРѕСЂСЉС‡РєР° РѕС‚ QR.";
      return;
    }
    if (!tableSelect.value) {
      msgEl.textContent = "вќЊ РР·Р±РµСЂРё РјР°СЃР°.";
      return;
    }

    btnSend.disabled = true;
    msgEl.textContent = "РР·РїСЂР°С‰Р°РјвЂ¦";

    try {
      const sendDb = firebase.firestore();
      const FieldValue = firebase.firestore.FieldValue;
      const tableId = tableSelect.value;
      const rawItems = resolved?.items || resolved?.order?.items || [];
      const items = rawItems.map(toPlainItem).filter((i) => i.name);
      if (!items.length) {
        msgEl.textContent = "вќЊ РќСЏРјР° items РІ РґРѕРєСѓРјРµРЅС‚Р°.";
        btnSend.disabled = false;
        return;
      }
      const menuMap = await buildMenuNameMap(sendDb);
      console.log("[scanner] menuMap size:", menuMap.size);
      items.forEach((item) => {
        item.station = resolveStationForWrite(item);
      });
      console.table(items.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        menuId: i.menuId || "",
        category: i.category || "",
        station: i.station
      })));

      if (SAFE_MODE) {
        await sendDb.collection(SCANS_COLLECTION).add({
          createdAt: FieldValue.serverTimestamp(),
          staffUid: auth.currentUser?.uid || null,
          staffEmail: auth.currentUser?.email || null,
          tableId,
          source: resolved.source,
          sourceId: resolved.docId,
          items,
          total: safeNum(resolved.total, calcTotalFromItems(items)),
          note: String(resolved?.note || ""),
          rawText: lastRawText == null ? null : String(lastRawText),
          status: "sent_safe",
        });
        msgEl.textContent = "вњ… Р“РѕС‚РѕРІРѕ (SAFE MODE): Р·Р°РїРёСЃР°РЅРѕ РІ waiter_scans";
        btnSend.disabled = false;
        return;
      }

      const tableRef = sendDb.collection(COLLECTIONS.tables).doc(tableId);
      const tableSnap = await tableRef.get();

      if (!tableSnap.exists) {
        msgEl.textContent = "вќЊ РўР°Р·Рё РјР°СЃР° РЅРµ СЃСЉС‰РµСЃС‚РІСѓРІР° РІ Р±Р°Р·Р°С‚Р°.";
        btnSend.disabled = false;
        return;
      }

      const tableData = tableSnap.data() || {};
      const tableLabel =
        tableData?.number != null
          ? `Table ${tableData.number}`
          : String(tableData?.name || tableData?.title || tableId);
      const waiterId = auth.currentUser?.uid || "waiter_qr_scan";
      const activeOrders = Array.isArray(tableData?.activeOrders) ? tableData.activeOrders : [];
      let orderId = String(tableData?.currentOrderId || "").trim();
      if (!orderId && activeOrders.length) {
        orderId = String(activeOrders[activeOrders.length - 1] || "").trim();
      }

      let orderRef = orderId
        ? sendDb.collection(COLLECTIONS.orders).doc(orderId)
        : sendDb.collection(COLLECTIONS.orders).doc();

      if (orderId) {
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists || isOrderClosed(orderSnap.data() || {})) {
          orderId = "";
          orderRef = sendDb.collection(COLLECTIONS.orders).doc();
        }
      }

      if (!orderId) {
        orderId = orderRef.id;
        await orderRef.set({
          orderId,
          tableId,
          tableLabel,
          waiterId,
          createdBy: waiterId,
          source: "waiter_qr",
          type: "dine-in",
          status: "open",
          orderStatus: "open",
          paymentStatus: "unpaid",
          closedAt: null,
          note: String(resolved?.note || ""),
          items: [],
          total: 0,
          activeItemCount: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      for (const item of items) {
        await upsertByMenuIdOrName(sendDb, FieldValue, orderId, tableId, waiterId, item, menuMap);
      }

      const orderSnapAfter = await orderRef.get();
      const orderDataAfter = orderSnapAfter.exists ? (orderSnapAfter.data() || {}) : {};
      const mergedItems = mergeOrderItems(orderDataAfter.items, items);
      const summary = summarizeItems(mergedItems);

      await orderRef.set({
        tableId,
        tableLabel,
        waiterId: waiterId || orderDataAfter.waiterId || null,
        createdBy: orderDataAfter.createdBy || waiterId || null,
        source: orderDataAfter.source || "waiter_qr",
        type: orderDataAfter.type || "dine-in",
        status: orderDataAfter.status || "open",
        orderStatus: "open",
        paymentStatus: "unpaid",
        closedAt: null,
        note: String(resolved?.note || orderDataAfter.note || ""),
        items: mergedItems,
        total: summary.total,
        activeItemCount: summary.count,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      await tableRef.set({
        status: "busy",
        currentOrderId: orderId,
        updatedAt: FieldValue.serverTimestamp(),
        activeOrders: FieldValue.arrayUnion(orderId)
      }, { merge: true });

      resetUI();
      msgEl.textContent = `Added to bill: ${orderId}`;
    } catch (e) {
      const err = firebaseErr(e);
      msgEl.textContent = "вќЊ Р“СЂРµС€РєР°: " + err;
      showDebug("sendOrder(): " + err);
    } finally {
      btnSend.disabled = false;
    }
  }

  // ========= Events =========
  if (btnStart) btnStart.addEventListener("click", startScanner);
  if (btnStop) btnStop.addEventListener("click", stopScanner);
  if (btnSend) btnSend.addEventListener("click", sendOrder);
  if (btnBack) btnBack.addEventListener("click", () => history.back());
  if (tableSelect) tableSelect.addEventListener("change", updateSendButton);

  // ========= Auth =========
  if (btnLogin) btnLogin.addEventListener("click", async () => {
    clearDebug();
    msgEl.textContent = "";
    const email = (loginEmail.value || "").trim();
    const pass = (loginPass.value || "").trim();
    if (!email || !pass) {
      authStatus.textContent = "вќЊ Р’СЉРІРµРґРё email + password.";
      return;
    }
    authStatus.textContent = "Р’Р»РёР·Р°РјвЂ¦";
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
      authStatus.textContent = "вќЊ Р“СЂРµС€РєР° РІС…РѕРґ: " + firebaseErr(e);
      showDebug("login: " + firebaseErr(e));
    }
  });

  if (btnLogout) btnLogout.addEventListener("click", async () => {
    try { await auth.signOut(); } catch {}
  });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      authStatus.textContent = `вњ… Р›РѕРіРЅР°С‚: ${user.email || user.uid}`;
      if (btnLogout) btnLogout.disabled = false;
      resetUI();
      await loadTables();
    } else {
      authStatus.textContent = "РќРµ СЃРё Р»РѕРіРЅР°С‚.";
      if (btnLogout) btnLogout.disabled = true;
      await stopScanner().catch(() => {});
      resetUI();
      if (tableSelect) tableSelect.innerHTML = `<option value="">вЂ” РёР·Р±РµСЂРё РјР°СЃР° вЂ”</option>`;
      if (tablesStatusEl) tablesStatusEl.textContent = "";
    }
  });

  // init
  resetUI();
})();


