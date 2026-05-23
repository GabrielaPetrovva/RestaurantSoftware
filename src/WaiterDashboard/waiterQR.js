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
  if (!window.Html5Qrcode && !window.__loadHtml5Qrcode) {
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
  const manualQrInput = el("manualQrInput");
  const btnManualQr = el("btnManualQr");

  const loginEmail = el("loginEmail");
  const loginPass = el("loginPass");
  const btnLogin = el("btnLogin");
  const btnLogout = el("btnLogout");
  const authStatus = el("authStatus");

  // ========= State =========
  let scanner = null;
  let scannerStarting = false;
  let scannerStopping = false;
  let scannerStarted = false;
  let scannerResizeTimer = null;
  let cameraAccessPrimed = false;
  let lastRawText = null;
  let menuCacheLoaded = false;
  const menuById = new Map();
  const menuByName = new Map();
  const menuByQrCode = new Map();

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

  function bindTap(node, fn) {
    if (!node) return;
    node.addEventListener("click", fn);
  }

  function isTransitionError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    return (
      msg.includes("already under transition") ||
      msg.includes("cannot transition to a new state") ||
      msg.includes("scanner is already started") ||
      msg.includes("scanner is not running")
    );
  }

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") ||
      Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 820;
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

  function getScannerBoxSize() {
    const wrap = document.querySelector(".qr-reader-wrap");
    const reader = document.getElementById("reader");
    const target = wrap || reader;
    const rect = target ? target.getBoundingClientRect() : null;

    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

    const base = rect && rect.width > 0
      ? Math.min(rect.width, rect.height || rect.width)
      : Math.min(vw, vh);

    const isSmallPhone = Math.min(vw, vh) <= 430;

    // Denser QR codes need a larger scan box.
    const ratio = isSmallPhone ? 0.92 : 0.90;
    const minSize = isSmallPhone ? 260 : 320;
    const maxSize = isSmallPhone ? 520 : 700;

    const size = Math.max(minSize, Math.min(maxSize, Math.floor(base * ratio)));

    return {
      width: size,
      height: size
    };
  }

  function getDynamicQrBox(viewfinderWidth, viewfinderHeight) {
    const minEdge = Math.min(viewfinderWidth || 0, viewfinderHeight || 0);
    const fallback = getScannerBoxSize();

    if (!minEdge || minEdge < 220) return fallback;

    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const isSmallPhone = Math.min(vw, window.innerHeight || vw) <= 430;

    const ratio = isSmallPhone ? 0.92 : 0.90;
    const minSize = isSmallPhone ? 260 : 320;
    const maxSize = isSmallPhone ? 520 : 700;

    const size = Math.max(minSize, Math.min(maxSize, Math.floor(minEdge * ratio)));

    return {
      width: size,
      height: size
    };
  }

  function getStrongScannerConfigs() {
    const staticQrbox = getScannerBoxSize();

    const formats = [];
    try {
      if (window.Html5QrcodeSupportedFormats?.QR_CODE != null) {
        formats.push(window.Html5QrcodeSupportedFormats.QR_CODE);
      }
    } catch {}

    const base = {
      qrbox: getDynamicQrBox,
      rememberLastUsedCamera: true,
      disableFlip: false
    };

    if (formats.length) base.formatsToSupport = formats;

    return [
      { ...base, fps: 10 },
      { ...base, fps: 8 },
      {
        fps: 6,
        qrbox: staticQrbox,
        rememberLastUsedCamera: true,
        disableFlip: false
      }
    ];
  }

  function withHighResCameraConstraints(base) {
    return {
      ...base,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [
        { focusMode: "continuous" },
        { exposureMode: "continuous" },
        { whiteBalanceMode: "continuous" }
      ]
    };
  }

  async function getCameraCandidates() {
    const candidates = [];
    const mobile = isMobileDevice();

    if (mobile) {
      candidates.push(
        { facingMode: { ideal: "environment" } },
        { facingMode: "environment" },
        { facingMode: { exact: "environment" } },
        { facingMode: "user" }
      );
      return candidates;
    }

    try {
      if (window.Html5Qrcode && typeof Html5Qrcode.getCameras === "function") {
        const cameras = await Html5Qrcode.getCameras();

        if (Array.isArray(cameras) && cameras.length) {
          const backCamera = cameras.find((cam) => {
            const label = String(cam.label || "").toLowerCase();
            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("environment") ||
              label.includes("зад") ||
              label.includes("основ")
            );
          });

          if (backCamera?.id) {
            candidates.push({ deviceId: { exact: backCamera.id } });
          }

          cameras.forEach((cam) => {
            if (cam?.id && cam.id !== backCamera?.id) {
              candidates.push({ deviceId: { exact: cam.id } });
            }
          });
        }
      }
    } catch (e) {
      console.warn("getCameras failed:", e);
    }

    candidates.push(
      { facingMode: { ideal: "environment" } },
      { facingMode: "environment" },
      { facingMode: { exact: "environment" } },
      { facingMode: "user" }
    );

    return candidates;
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
    if (x == null || x === "") return fallback;
    const n = Number(String(x ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  function readQty(value, fallback = 1) {
    const n = Number(String(value ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return n;
  }

  function readLineTotal(item) {
    const qty = readQty(item?.qty ?? item?.quantity ?? item?.count ?? item?.q ?? item?.amount, 1);
    const price = safeNum(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost ?? 0, 0);
    const totalRaw = item?.totalPrice ?? item?.lineTotal ?? item?.total;
    const totalPrice = totalRaw == null ? null : safeNum(totalRaw, null);
    return Number.isFinite(Number(totalPrice)) ? Number(totalPrice) : price * qty;
  }

  function fmtMoney(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  }

  function normalizeItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => {
        const qty = readQty(x?.qty ?? x?.quantity ?? x?.count ?? x?.q ?? x?.amount, 1);
        const price = safeNum(x?.price ?? x?.unitPrice ?? x?.unit_price ?? x?.cost ?? 0, 0);
        const totalPriceRaw = x?.totalPrice ?? x?.lineTotal ?? x?.total;
        const totalPrice = totalPriceRaw == null ? null : safeNum(totalPriceRaw, null);
        return {
          menuId: String(x?.menuId ?? x?.menu_id ?? x?.id ?? x?.itemId ?? "").trim(),
          itemId: String(x?.itemId ?? x?.menuId ?? x?.menu_id ?? x?.id ?? "").trim(),
          qrCode: String(x?.qrCode ?? x?.shortCode ?? x?.code ?? x?.qr ?? "").trim(),
          shortCode: String(x?.shortCode ?? x?.qrCode ?? x?.code ?? x?.qr ?? "").trim(),
          code: String(x?.code ?? x?.qrCode ?? x?.shortCode ?? x?.qr ?? "").trim(),
          qr: String(x?.qr ?? x?.qrCode ?? x?.shortCode ?? x?.code ?? "").trim(),
          name: String(x?.name ?? x?.item ?? x?.title ?? x?.productName ?? x?.itemId ?? x?.menuId ?? "").trim(),
          qty,
          price,
          totalPrice,
          category: String(x?.category ?? x?.categoryKey ?? x?.categorySlug ?? x?.cat ?? x?.group ?? x?.type ?? "").trim(),
          categorySlug: String(x?.categorySlug ?? "").trim(),
          categoryId: String(x?.categoryId ?? x?.category_id ?? "").trim(),
          type: String(x?.type ?? "").trim(),
          isDrink: x?.isDrink === true || String(x?.isDrink || "").toLowerCase() === "true",
          notes: String(x?.notes ?? x?.note ?? x?.comment ?? "").trim(),
          station: String(x?.station ?? x?.targetStation ?? x?.department ?? x?.prepStation ?? x?.destination ?? "").trim(),
        };
      })
      .filter((x) => (x.name || x.menuId || x.itemId || x.qrCode || x.shortCode) && Number.isFinite(x.qty) && x.qty > 0);
  }

  function calcTotalFromItems(items) {
    return normalizeItems(items).reduce((sum, it) => sum + readLineTotal(it), 0);
  }

  function buildOrderFromCompactPayload(obj) {
    if (!obj || Number(obj.v) !== 3 || !Array.isArray(obj.i)) return null;

    const items = obj.i.map((row) => {
      if (Array.isArray(row)) {
        return {
          name: String(row[0] || "").trim(),
          qty: Number(row[1] || 1),
          price: Number(row[2] || 0),
          category: String(row[3] || "").trim(),
          station: String(row[4] || "").trim()
        };
      }

      if (row && typeof row === "object") {
        return {
          name: String(row.n || row.name || "").trim(),
          qty: Number(row.q || row.qty || 1),
          price: Number(row.p || row.price || 0),
          category: String(row.c || row.category || "").trim(),
          station: String(row.s || row.station || "").trim()
        };
      }

      return null;
    }).filter(Boolean).filter((x) => x.name && x.qty > 0);

    if (!items.length) return null;

    return {
      note: obj.n || obj.note || "",
      tableId: obj.t || obj.tableId || "",
      items,
      total: items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0),
      createdAtLocal: new Date().toISOString(),
      _convertedFromCompact: true
    };
  }

  function parseUltraCompactTextOrder(text) {
    const raw = String(text || "").trim();
    if (!raw.startsWith("R2|")) return null;

    const parts = raw.split("|").slice(1);
    const data = {};

    parts.forEach((part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return;
      const key = part.slice(0, idx);
      const value = part.slice(idx + 1);
      data[key] = value;
    });

    const itemsRaw = String(data.i || "").trim();
    if (!itemsRaw) return null;

    const items = itemsRaw
      .split(",")
      .map((pair) => {
        const [codeRaw, qtyRaw] = pair.split(":");
        const qrCode = decodeURIComponent(String(codeRaw || "").trim());
        const qty = Math.max(1, Number(qtyRaw || 1) || 1);

        if (!qrCode) return null;

        return {
          qrCode,
          shortCode: qrCode,
          code: qrCode,
          qr: qrCode,
          menuId: "",
          itemId: "",
          name: "",
          qty,
          price: 0,
          category: "",
          station: ""
        };
      })
      .filter(Boolean);

    if (!items.length) return null;

    return {
      note: data.n ? decodeURIComponent(data.n) : "",
      tableId: data.t ? decodeURIComponent(data.t) : "",
      items,
      total: 0,
      createdAtLocal: new Date().toISOString(),
      _convertedFromUltraCompactText: true
    };
  }

  function parseCompactTextOrder(text) {
    const raw = String(text || "").trim();
    if (!raw.startsWith("R1|")) return null;

    const parts = raw.split("|").slice(1);
    const data = {};

    parts.forEach((part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return;

      const key = part.slice(0, idx);
      const value = part.slice(idx + 1);
      data[key] = value;
    });

    const itemsRaw = String(data.i || "").trim();
    if (!itemsRaw) return null;

    const items = itemsRaw
      .split(",")
      .map((pair) => {
        const [idRaw, qtyRaw] = pair.split(":");
        const menuId = decodeURIComponent(String(idRaw || "").trim());
        const qty = Math.max(1, Number(qtyRaw || 1) || 1);

        if (!menuId) return null;

        return {
          menuId,
          itemId: menuId,
          name: "",
          qty,
          price: 0,
          category: "",
          station: ""
        };
      })
      .filter(Boolean);

    if (!items.length) return null;

    return {
      note: data.n ? decodeURIComponent(data.n) : "",
      tableId: data.t ? decodeURIComponent(data.t) : "",
      items,
      total: 0,
      createdAtLocal: new Date().toISOString(),
      _convertedFromCompactText: true
    };
  }

  function toPlainItem(raw) {
    const name = String(raw?.name ?? raw?.item ?? raw?.title ?? "").trim();
    const qty = readQty(raw?.qty ?? raw?.quantity ?? raw?.count ?? raw?.q ?? raw?.amount, 1);
    const price = safeNum(raw?.price ?? raw?.unitPrice ?? raw?.unit_price ?? raw?.cost ?? 0, 0);
    const totalPriceRaw = raw?.totalPrice ?? raw?.lineTotal ?? raw?.total;
    const totalPrice = totalPriceRaw == null ? null : safeNum(totalPriceRaw, null);
    const menuId = String(raw?.menuId ?? raw?.id ?? "").trim();
    const qrCode = String(raw?.qrCode ?? raw?.shortCode ?? raw?.code ?? raw?.qr ?? "").trim();
    const category = String(raw?.category ?? raw?.categoryKey ?? raw?.categorySlug ?? raw?.cat ?? "").trim();
    const itemId = String(raw?.itemId ?? raw?.menuId ?? raw?.id ?? "").trim();
    const type = String(raw?.type ?? "").trim();
    const station = String(raw?.station ?? raw?.targetStation ?? raw?.department ?? raw?.prepStation ?? raw?.destination ?? "").trim();
    return { name, qty, price, totalPrice, menuId, itemId, qrCode, shortCode: qrCode, code: qrCode, qr: qrCode, category, type, station };
  }

  function unwrapOrderPayload(obj) {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj.items)) return obj;
    if (obj.order && typeof obj.order === "object") {
      if (Array.isArray(obj.order.items)) return obj.order;
    }
    if (obj.payload && typeof obj.payload === "object") {
      if (Array.isArray(obj.payload.items)) return obj.payload;
      if (obj.payload.order && Array.isArray(obj.payload.order.items)) return obj.payload.order;
    }
    if (obj.data && typeof obj.data === "object") {
      if (Array.isArray(obj.data.items)) return obj.data;
      if (obj.data.order && Array.isArray(obj.data.order.items)) return obj.data.order;
    }
    return obj;
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
    "напитка", "напитки", "drink", "drinks", "beverage", "beverages",
    "вода", "water", "минерална", "минерал", "газирана", "газира", "сода", "soda", "тоник",
    "cola", "кола", "coke", "pepsi", "пепси", "fanta", "фанта", "sprite", "спрайт",
    "сок", "juice", "фреш", "fresh", "лимонада", "lemonade", "айрян", "ayran",
    "кафе", "coffee", "еспресо", "espresso", "капучино", "cappuccino",
    "лате", "латте", "latte", "макиато", "macchiato", "американо", "americano",
    "фрапе", "frappe", "мока", "mocha", "чай", "tea",
    "бира", "beer", "вино", "wine", "бяло вино", "white wine", "червено вино", "red wine",
    "розе", "rose", "rosé", "просеко", "prosecco", "шампанско", "champagne",
    "уиски", "whisky", "whiskey", "водка", "vodka", "ракия", "rakia",
    "ром", "rum", "джин", "gin", "текила", "tequila", "коняк", "cognac",
    "бренди", "brandy", "ликьор", "liqueur", "коктейл", "cocktail",
    "мохито", "mojito", "маргарита", "margarita", "джин тоник", "gin tonic",
    "аперол", "aperol", "сприц", "spritz", "ред бул", "red bull",
    "monster", "монстър", "енергийна", "energy", "енерг"
  ];
  const DRINK_CATEGORY_WORDS = [
    "drink", "drinks", "beverage", "beverages", "bar", "бар",
    "напитка", "напитки", "napit", "напит",
    "alcohol", "алкохол", "coffee", "кафе", "tea", "чай",
    "wine", "вино", "beer", "бира", "cocktail", "коктейл"
  ];
  const READY_DESSERT_WORDS = [
    "торта", "торти", "cake", "cakes", "шоколадова торта", "чийзкейк", "cheesecake",
    "тирамису", "tiramisu", "баклава", "baklava", "сладолед", "ice cream",
    "паста", "пасти", "еклер", "еклери", "мъфин", "muffin", "крем карамел",
    "крем", "десерт в чаша"
  ];
  const MADE_TO_ORDER_DESSERT_WORDS = [
    "палачинка", "палачинки", "pancake", "pancakes", "гофрета", "гофрети",
    "waffle", "waffles", "суфле", "souffle", "катма", "катми",
    "fried dessert", "hot dessert"
  ];
  const DESSERT_CATEGORY_WORDS = [
    "dessert", "desserts", "desert", "deserts", "десерт", "десерти",
    "сладки", "sweet", "sweets"
  ];
  const PASTA_FOOD_WORDS = [
    "карбонара", "carbonara", "болонезе", "bolognese", "спагети",
    "spaghetti", "макарони", "macaroni", "пене", "penne",
    "tagliatelle", "талятели"
  ];

  function hasAnyKeyword(text, keywords) {
    const source = String(text || "").toLowerCase();
    return keywords.some((word) => source.includes(String(word).toLowerCase()));
  }

  function buildStationText(item, resolvedMenu = null) {
    return [
      item?.name,
      item?.title,
      item?.productName,
      item?.itemId,
      item?.menuId,
      item?.category,
      item?.categoryKey,
      item?.categorySlug,
      item?.type,
      item?.station,
      item?.department,
      resolvedMenu?.name,
      resolvedMenu?.title,
      resolvedMenu?.category,
      resolvedMenu?.categoryKey,
      resolvedMenu?.categorySlug,
      resolvedMenu?.type,
      resolvedMenu?.station,
      resolvedMenu?.department
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function looksLikeReadyDessert(item, resolvedMenu = null) {
    const text = typeof item === "string" && !resolvedMenu ? String(item || "").toLowerCase() : buildStationText(item, resolvedMenu);
    if (hasAnyKeyword(text, ["паста", "пасти"]) && hasAnyKeyword(text, PASTA_FOOD_WORDS)) return false;
    return hasAnyKeyword(text, READY_DESSERT_WORDS);
  }

  function looksLikeMadeToOrderDessert(item, resolvedMenu = null) {
    return hasAnyKeyword(buildStationText(item, resolvedMenu), MADE_TO_ORDER_DESSERT_WORDS);
  }

  function looksLikePastaFood(item, resolvedMenu = null) {
    const text = buildStationText(item, resolvedMenu);
    return hasAnyKeyword(text, ["паста", "пасти"]) && hasAnyKeyword(text, PASTA_FOOD_WORDS);
  }

  function looksLikeDessertCategory(item, resolvedMenu = null) {
    const text = [
      item?.category,
      item?.categoryKey,
      item?.categorySlug,
      item?.type,
      resolvedMenu?.category,
      resolvedMenu?.categoryKey,
      resolvedMenu?.categorySlug,
      resolvedMenu?.type
    ].filter(Boolean).join(" ").toLowerCase();
    return hasAnyKeyword(text, DESSERT_CATEGORY_WORDS);
  }

  function looksLikeDrink(item, resolvedMenu = null) {
    if (item?.isDrink === true || resolvedMenu?.isDrink === true) return true;
    const categoryText = [
      item?.category,
      item?.categoryKey,
      item?.categorySlug,
      item?.type,
      resolvedMenu?.category,
      resolvedMenu?.categoryKey,
      resolvedMenu?.categorySlug,
      resolvedMenu?.type
    ].filter(Boolean).join(" ").toLowerCase();
    if (hasAnyKeyword(categoryText, DRINK_CATEGORY_WORDS)) return true;
    const nameText = buildStationText(item, resolvedMenu);
    return hasAnyKeyword(nameText, DRINK_WORDS);
  }

  function looksLikeCakeNameCategory(name, category = "") {
    return looksLikeReadyDessert({ name, category });
  }

  function resolveStationFromNameCategory(name, category) {
    return resolveFinalStation({ name, category });
  }

  function resolveStationForWrite(item, menuMap = null) {
    const menuId = String(item?.menuId || "").trim();
    const itemName = String(item?.name || item?.itemId || item?.menuId || "").trim();
    const itemCategory = String(item?.category || item?.categoryKey || item?.categorySlug || item?.type || "").trim();
    let resolvedMenu = null;
    if (menuId && menuById.has(menuId)) {
      resolvedMenu = menuById.get(menuId) || null;
    }

    const key = normalizeName(item?.name || "");
    const mappedMenu = menuMap && key ? menuMap.get(key) : null;
    if (!resolvedMenu && mappedMenu) resolvedMenu = mappedMenu;

    return resolveFinalStation({ ...item, name: itemName, category: itemCategory }, resolvedMenu);
  }

  async function upsertByMenuIdOrName(dbInstance, FieldValue, orderId, tableId, waiterId, item, menuMap) {
    const itemsCol = dbInstance.collection("orders").doc(orderId).collection("items");

    const name = String(item?.name || "").trim();
    const qty = readQty(item?.qty ?? item?.quantity ?? item?.count ?? item?.q ?? item?.amount, 1);
    const key = normalizeName(name);
    const mappedMenu = menuMap.get(key) || null;
    const menuId = String(item?.menuId || mappedMenu?.id || "").trim();
    const category = String(item?.category || mappedMenu?.category || mappedMenu?.type || "").trim();
    const station = resolveStationForWrite({ ...item, menuId, category }, menuMap);
    const price = Number(mappedMenu?.price != null ? mappedMenu.price : item?.price || 0) || 0;
    const totalPrice = readLineTotal({ ...item, qty, price });

    const basePayload = {
      orderId: String(orderId || ""),
      tableId: String(tableId || ""),
      waiterId: String(waiterId || ""),
      name,
      qty,
      price,
      totalPrice,
      menuId: menuId || "",
      category: category || "",
      station,
      status: "new"
    };

    console.log("[scanner] scanned key:", key, "resolved menuId:", menuId);

    if (menuId) {
      await itemsCol.doc(menuId).set({
        ...basePayload,
        qty: FieldValue.increment(qty),
        totalPrice: FieldValue.increment(totalPrice),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      console.log("[scanner] merged into doc(menuId) =", menuId);
      return;
    }

    const snap = await itemsCol.where("name", "==", name).limit(10).get();
    const existingDoc = snap.docs.find((docSnap) => {
      const docData = docSnap.data() || {};
      return String(docData.station || "").trim().toLowerCase() === station;
    });
    if (existingDoc) {
      await existingDoc.ref.set({
        ...basePayload,
        qty: FieldValue.increment(qty),
        totalPrice: FieldValue.increment(totalPrice),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      console.log("[scanner] merged by name+station into doc =", existingDoc.id);
      return;
    }

    await itemsCol.add({
      ...basePayload,
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
      const qty = readQty(raw?.qty ?? raw?.quantity ?? raw?.count ?? raw?.q ?? raw?.amount, 1);
      const price = Number(raw?.price || 0) || 0;
      const station = resolveFinalStation(raw);
      const next = {
        name: String(raw?.name || "").trim(),
        qty,
        price,
        totalPrice: readLineTotal({ ...raw, qty, price }),
        menuId: String(raw?.menuId || "").trim(),
        category: String(raw?.category || raw?.categoryKey || raw?.categorySlug || "").trim(),
        station
      };
      const idx = out.findIndex((item) => {
        const leftId = String(item?.menuId || "").trim().toLowerCase();
        const rightId = String(next.menuId || "").trim().toLowerCase();
        const leftName = String(item?.name || "").trim().toLowerCase();
        const rightName = String(next.name || "").trim().toLowerCase();
        const leftStation = resolveFinalStation(item);
        const rightStation = String(next.station || "").trim().toLowerCase();
        return (leftId && rightId ? leftId === rightId : leftName === rightName) && leftStation === rightStation;
      });
      if (idx < 0) {
        out.push(next);
        continue;
      }
      const existingTotal = readLineTotal(out[idx]);
      out[idx].qty = (Number(out[idx].qty) || 0) + next.qty;
      out[idx].totalPrice = existingTotal + next.totalPrice;
      if (!out[idx].menuId && next.menuId) out[idx].menuId = next.menuId;
      if (!out[idx].category && next.category) out[idx].category = next.category;
      if (!out[idx].name && next.name) out[idx].name = next.name;
      if (!Number.isFinite(Number(out[idx].price))) out[idx].price = next.price;
      out[idx].station = rightStation;
    }
    return out;
  }

  function summarizeItems(items) {
    let total = 0;
    let count = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const qty = readQty(item?.qty ?? item?.quantity ?? item?.count ?? item?.q ?? item?.amount, 1);
      total += readLineTotal(item);
      count += qty;
    }
    return { total, count };
  }

  const BAR_STATIONS = new Set(["bar", "drink", "drinks", "beverage", "beverages", "napitki", "napitka", "бар", "напитки"]);
  const KITCHEN_STATIONS = new Set(["kitchen", "food", "kitchenfood", "cook", "kuhnq", "kuhnya", "kuhnia", "кухня"]);
  const DRINK_CATEGORY_HINTS = DRINK_CATEGORY_WORDS;
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

  const BG_DRINK_WORDS = DRINK_WORDS;

  function logStationRouting(item, resolvedMenu, directStation, finalStation, reason) {
    console.log("[station-routing]", {
      name: String(item?.name || item?.title || item?.productName || resolvedMenu?.name || item?.itemId || item?.menuId || "").trim(),
      category: String(item?.category || item?.categoryKey || item?.categorySlug || item?.type || resolvedMenu?.category || resolvedMenu?.categoryKey || resolvedMenu?.categorySlug || resolvedMenu?.type || "").trim(),
      directStation,
      finalStation,
      reason
    });
  }

  function resolveFinalStation(item, resolvedMenu = null) {
    const directStation = normalizeStationValue(
      item?.station ||
      item?.targetStation ||
      item?.department ||
      item?.prepStation ||
      item?.destination ||
      resolvedMenu?.station ||
      resolvedMenu?.department ||
      resolvedMenu?.prepStation ||
      resolvedMenu?.destination ||
      ""
    );
    const done = (finalStation, reason) => {
      logStationRouting(item, resolvedMenu, directStation, finalStation, reason);
      return finalStation;
    };

    if (looksLikeMadeToOrderDessert(item, resolvedMenu)) return done("kitchen", "made-to-order-dessert");
    if (looksLikePastaFood(item, resolvedMenu)) return done("kitchen", "default-kitchen");
    if (looksLikeDrink(item, resolvedMenu)) return done("bar", "drink");
    if (looksLikeReadyDessert(item, resolvedMenu)) return done("bar", "ready-dessert");
    if (directStation === "bar") return done("bar", "direct-bar");
    if (directStation === "kitchen") return done("kitchen", "direct-kitchen");
    if (looksLikeDessertCategory(item, resolvedMenu)) return done("kitchen", "dessert-category-default-kitchen");
    return done("kitchen", "default-kitchen");
  }

  function resolveStationFallbackByName(name) {
    return resolveFinalStation({ name });
  }

  async function resolveStation(dbInstance, item) {
    const itemName = String(item?.name || item?.itemId || item?.menuId || "").trim();
    const itemCategory = String(item?.category || item?.categoryKey || item?.categorySlug || item?.type || "").trim();
    let menuData = null;
    const menuId = String(item.menuId || "").trim();
    if (menuId) {
      try {
        const snap = await dbInstance.collection("menus").doc(menuId).get();
        if (snap.exists) {
          menuData = { id: snap.id, ...(snap.data() || {}) };
        }
      } catch (err) {
        console.warn("resolveStation menu lookup failed:", { menuId, err });
      }
    }

    return resolveFinalStation({ ...item, name: itemName, category: itemCategory }, menuData);
  }

  function textHasAnyHint(text, hints) {
    const source = String(text || "").trim().toLowerCase();
    if (!source) return false;
    return hints.some((keyword) => source.includes(String(keyword || "").toLowerCase()));
  }

  function stationForItem(item, resolvedMenu = null) {
    return resolveFinalStation(item, resolvedMenu);
  }

  function buildMenuIndexByIdAndName(rows) {
    menuById.clear();
    menuByName.clear();
    menuByQrCode.clear();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row) return;
      const id = String(row.id || row.menuId || row.itemId || "").trim();
      const name = String(row.name || row.title || "").trim();
      const qrCode = String(row.qrCode || row.shortCode || row.code || row.qr || "").trim();
      const normalized = {
        ...row,
        id,
        name,
        qrCode,
        shortCode: qrCode,
        code: String(row.code || qrCode || "").trim(),
        qr: String(row.qr || qrCode || "").trim(),
        station: normalizeStationValue(row.station || row.department || ""),
        category: String(row.category || row.categoryKey || row.categorySlug || row.type || "").trim()
      };
      if (id) menuById.set(id, normalized);
      if (name) menuByName.set(name.toLowerCase(), normalized);
      if (qrCode) menuByQrCode.set(qrCode.toLowerCase(), normalized);
    });

    console.log("[QR menu index]", {
      byId: menuById.size,
      byName: menuByName.size,
      byQrCode: menuByQrCode.size
    });
  }

  function resolveMenuForItem(item) {
    const qrCode = String(item?.qrCode || item?.shortCode || item?.code || item?.qr || "").trim().toLowerCase();
    const menuId = String(item?.menuId || "").trim();
    const itemId = String(item?.itemId || "").trim();
    const nameKey = String(item?.name || "").trim().toLowerCase();

    if (qrCode && menuByQrCode.has(qrCode)) return menuByQrCode.get(qrCode);
    if (menuId && menuById.has(menuId)) return menuById.get(menuId);
    if (itemId && menuById.has(itemId)) return menuById.get(itemId);
    if (nameKey && menuByName.has(nameKey)) return menuByName.get(nameKey);
    return null;
  }

  async function loadMenuCache(dbInstance = db) {
    if (menuCacheLoaded) return;
    menuCacheLoaded = true;
    const rows = [];
    const collections = [COLLECTIONS.menus, "menu_items"];

    for (const collectionName of collections) {
      try {
        const snap = await dbInstance.collection(collectionName).get();
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
    await loadMenuCache(db);

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
          category: String(item.category || menuData?.category || menuData?.categoryKey || menuData?.categorySlug || "").trim(),
          categorySlug: String(item.categorySlug || menuData?.categorySlug || "").trim(),
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
        category: String(item.category || menuData?.category || menuData?.categoryKey || menuData?.categorySlug || "").trim(),
        station
      });
    }

    return { items: resolved };
  }

  async function hydrateScannedOrderItemsFromMenu(order) {
    if (!order || !Array.isArray(order.items)) return order;

    const needsHydration =
      order._convertedFromUltraCompactText === true ||
      order._convertedFromCompactText === true ||
      order._convertedFromCompact === true ||
      order.items.some((item) => !String(item?.name || "").trim());
    if (!needsHydration) return order;

    try {
      await loadMenuCache(db);
    } catch (e) {
      console.warn("[QR] menu cache load failed:", e);
    }

    const hydrated = order.items.map((item) => {
      const menu = resolveMenuForItem(item);
      if (!menu) {
        const qrCode = String(item.qrCode || item.shortCode || item.code || item.qr || item.menuId || item.itemId || "").trim();
        if (qrCode && !String(item.name || "").trim()) {
          return {
            ...item,
            qrCode,
            shortCode: String(item.shortCode || item.qrCode || item.code || item.qr || "").trim(),
            code: String(item.code || item.qrCode || item.shortCode || item.qr || "").trim(),
            qr: String(item.qr || item.qrCode || item.shortCode || item.code || "").trim(),
            name: `Unknown item ${qrCode}`,
            price: Number(item.price || 0) || 0,
            totalPrice: 0,
            _unresolvedQrItem: true
          };
        }
        return item;
      }

      const price = Number(menu.price ?? menu.cost ?? item.price ?? 0) || 0;
      const qty = Number(item.qty || 1) || 1;

      return {
        ...item,
        qrCode: String(item.qrCode || item.shortCode || menu.qrCode || menu.shortCode || menu.code || menu.qr || "").trim(),
        shortCode: String(item.shortCode || item.qrCode || menu.qrCode || menu.shortCode || menu.code || menu.qr || "").trim(),
        code: String(item.code || item.qrCode || item.shortCode || menu.code || menu.qrCode || menu.shortCode || menu.qr || "").trim(),
        qr: String(item.qr || item.qrCode || item.shortCode || menu.qr || menu.qrCode || menu.shortCode || menu.code || "").trim(),
        menuId: String(item.menuId || menu.id || menu.menuId || "").trim(),
        itemId: String(item.itemId || item.menuId || menu.id || menu.menuId || "").trim(),
        name: String(item.name || menu.name || menu.title || item.qrCode || "").trim(),
        price,
        totalPrice: price * qty,
        category: String(item.category || menu.category || menu.categoryKey || menu.categorySlug || menu.type || "").trim(),
        station: String(item.station || menu.station || menu.department || "").trim()
      };
    });

    return {
      ...order,
      items: hydrated,
      total: hydrated.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * (Number(item.qty) || 1);
      }, 0)
    };
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

  function hasUnresolvedQrItems(order) {
    return Array.isArray(order?.items) && order.items.some((item) => {
      if (item._unresolvedQrItem === true) return true;
      return item._unresolvedQrCode === true;
    });
  }

  function canSend() {
    return !!resolved && !!(tableSelect && tableSelect.value) && !hasUnresolvedQrItems(resolved);
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
        ? items.map((it) => {
          const qty = readQty(it.qty, 1);
          const price = safeNum(it.price, 0);
          const lineTotal = readLineTotal(it);
          return `
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.06)">
            <div>
              <div>${esc(it.name)} × ${esc(qty)}</div>
              <div class="muted" style="font-size:12px;">${fmtMoney(price)} € / бр. — общо ${fmtMoney(lineTotal)} €</div>
            </div>
          </div>
        `;
        }).join("")
        : `<div class="muted">РќСЏРјР° items РІ РґРѕРєСѓРјРµРЅС‚Р°.</div>`;
    }

    const total = Number.isFinite(Number(resolved.total)) ? safeNum(resolved.total) : calcTotalFromItems(items);
    if (totalEl) totalEl.textContent = `Общо: ${fmtMoney(total)} €`;
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
      const payload = unwrapOrderPayload(rawItems);
      const arr = Array.isArray(payload?.items) ? payload.items : [payload];
      return normalizeItems(arr);
    }

    const text = String(rawItems || "").trim();
    if (!text) return [];

    const asJson = safeJsonParse(text);
    if (Array.isArray(asJson)) return normalizeItems(asJson);
    if (asJson && typeof asJson === "object") {
      const payload = unwrapOrderPayload(asJson);
      const arr = Array.isArray(payload?.items) ? payload.items : [payload];
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

    if (parseUltraCompactTextOrder(raw) || parseCompactTextOrder(raw)) {
      return out;
    }

    // 1) full doc path? (even segments)
    const pathCand = raw.split("?")[0].split("#")[0].replace(/^\/+/, "");
    const parts = pathCand.split("/").filter(Boolean);
    if (parts.length >= 2 && parts.length % 2 === 0) {
      out.docPath = pathCand;
    }

    // 2) JSON
    const j = safeJsonParse(raw);
    if (j && typeof j === "object") {
      out.orderId = cleanId(j.orderId || (typeof j.order === "string" || typeof j.order === "number" ? j.order : j.o));
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

    const ultraCompactText = parseUltraCompactTextOrder(raw);
    if (ultraCompactText) {
      return {
        mode: "compact-text-r2",
        orderId: null,
        cartId: null,
        tableId: cleanId(ultraCompactText.tableId),
        restaurantId: null,
        note: String(ultraCompactText.note || ""),
        items: ultraCompactText.items,
        total: ultraCompactText.total,
        rawObject: ultraCompactText,
        _convertedFromUltraCompactText: true,
      };
    }

    const compactText = parseCompactTextOrder(raw);
    if (compactText) {
      return {
        mode: "compact-text-r1",
        orderId: null,
        cartId: null,
        tableId: cleanId(compactText.tableId),
        restaurantId: null,
        note: String(compactText.note || ""),
        items: compactText.items,
        total: compactText.total,
        rawObject: compactText,
        _convertedFromCompactText: true,
      };
    }

    const fromObject = (obj, mode) => {
      if (!obj || typeof obj !== "object") return null;
      const payload = unwrapOrderPayload(obj);

      const items = parseItemsFromLoose(
        payload.items ??
        payload.cartItems ??
        payload.orderItems ??
        payload.order?.items ??
        payload.lines ??
        payload.products ??
        payload.item
      );
      if (!items.length) return null;

      const note = String(payload.note ?? payload.comment ?? payload.comments ?? payload.customerNote ?? "").trim();
      const totalRaw = payload.total ?? payload.sum;
      const total = Number.isFinite(Number(totalRaw)) ? safeNum(totalRaw) : calcTotalFromItems(items);
      const orderIdValue = payload.orderId || obj.orderId || (
        typeof obj.order === "string" || typeof obj.order === "number" ? obj.order : obj.o
      );

      return {
        mode,
        orderId: cleanId(orderIdValue),
        cartId: cleanId(payload.cartId || obj.cartId || obj.cart || obj.c),
        tableId: cleanId(payload.tableId || obj.tableId || obj.table || obj.t),
        restaurantId: cleanId(payload.restaurantId || payload.rid || obj.restaurantId || obj.rid || obj.restaurant),
        note,
        items,
        total,
        rawObject: payload,
      };
    };

    const j = safeJsonParse(raw);
    const compact = buildOrderFromCompactPayload(j);
    if (compact) {
      return {
        mode: "compact-v3",
        orderId: null,
        cartId: null,
        tableId: cleanId(compact.tableId),
        restaurantId: null,
        note: String(compact.note || ""),
        items: compact.items,
        total: compact.total,
        rawObject: compact,
        _convertedFromCompact: true,
      };
    }

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
    const payload = unwrapOrderPayload(data || {});
    const items = normalizeItems(
      payload?.items ||
      payload?.cartItems ||
      payload?.orderItems ||
      payload?.order?.items ||
      []
    );

    const total =
      (payload?.total != null && Number.isFinite(Number(payload.total))) ? safeNum(payload.total) :
      (payload?.sum != null && Number.isFinite(Number(payload.sum))) ? safeNum(payload.sum) :
      calcTotalFromItems(items);

    const note = String(payload?.note ?? payload?.comment ?? payload?.comments ?? payload?.customerNote ?? "").trim();

    return {
      source,
      docId,
      tableId: cleanId(payload?.tableId || data?.tableId || data?.table || data?.t),
      restaurantId: cleanId(payload?.restaurantId || payload?.rid || data?.restaurantId || data?.rid || data?.restaurant),
      data: payload || data || {},
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
          _convertedFromUltraCompactText: inline._convertedFromUltraCompactText === true,
          _convertedFromCompactText: inline._convertedFromCompactText === true,
          _convertedFromCompact: inline._convertedFromCompact === true,
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

  async function safeStopScanner() {
    if (scannerStopping) return;
    scannerStopping = true;

    try {
      if (scanner && scannerStarted === true) {
        try {
          await scanner.stop();
        } catch (err) {
          if (!isTransitionError(err)) {
            console.warn("[QR] scanner.stop warning:", err);
          }
        }
      }

      if (scanner) {
        try {
          await scanner.clear();
        } catch (err) {
          if (!isTransitionError(err)) {
            console.warn("[QR] scanner.clear warning:", err);
          }
        }
      }
    } finally {
      scanner = null;
      scannerStarted = false;
      scannerStarting = false;
      scannerStopping = false;
      if (btnStart) btnStart.disabled = false;
      if (btnStop) btnStop.disabled = true;
    }
  }

  async function resetScannerInstance() {
    try {
      if (scanner) {
        try { await scanner.stop(); } catch {}
        try { await scanner.clear(); } catch {}
      }
    } catch {}
    scanner = new Html5Qrcode("reader");
    scannerStarted = false;
  }

  function startWithTimeout(scannerInstance, cameraConfig, scannerConfig, onSuccess, onFailure, timeoutMs = 9000) {
    return Promise.race([
      scannerInstance.start(cameraConfig, scannerConfig, onSuccess, onFailure),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Camera start timeout."));
        }, timeoutMs);
      })
    ]);
  }

  function iosInlineVideoFix() {
    setTimeout(() => {
      document.querySelectorAll("video").forEach((v) => {
        v.setAttribute("playsinline", "true");
        v.setAttribute("webkit-playsinline", "true");
        v.muted = true;
      });
    }, 350);
  }

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

      if (decodedBox) decodedBox.textContent = decodedText || "(empty)";

      if (!r) {
        resolved = null;
        renderResolved();
        setStatus("вќЊ РќРµ РЅР°РјРµСЂРёС… order/cart РґРѕРєСѓРјРµРЅС‚ РїРѕ С‚РѕР·Рё QR.", "err");
        showDebug("resolveFromQR(): " + JSON.stringify({ plan, found: false }, null, 2));
        return;
      }

      const hydratedResolved = await hydrateScannedOrderItemsFromMenu(r);
      resolved = hydratedResolved;
      console.log("[qr-items-normalized]", normalizeItems(hydratedResolved?.items || hydratedResolved?.data?.items || hydratedResolved?.data?.order?.items || []));

      // auto-select table if found
      const tId = cleanId(hydratedResolved.tableId);
      if (tId) {
        const exists = Array.from(tableSelect.options).some((o) => o.value === tId);
        if (exists) tableSelect.value = tId;
      }

      renderResolved();
      if (hasUnresolvedQrItems(hydratedResolved)) {
        console.warn("[QR] unresolved qrCode items:", hydratedResolved.items);
        setStatus("QR е прочетен, но има неразпознати артикули.", "err");
        if (msgEl) {
          msgEl.textContent = "Кодовете от QR не са намерени в менюто. Провери qrCode/shortCode или използвай R1 fallback.";
        }
        if (btnSend) btnSend.disabled = true;
        return;
      }

      setStatus("QR сканиран успешно ✅", "ok");
    } catch (e) {
      resolved = null;
      renderResolved();
      setStatus("вќЊ Р“СЂРµС€РєР° РїСЂРё Р·Р°СЂРµР¶РґР°РЅРµ РѕС‚ Р±Р°Р·Р°С‚Р°.", "err");
      if (msgEl) msgEl.textContent = e?.message || String(e || "");
      showDebug("resolveFromQR(): " + firebaseErr(e));
    }
  }

  async function startScanner() {
    console.log("[QR] start requested", { scannerStarting, scannerStopping, scannerStarted });
    if (scannerStarting || scannerStopping || scannerStarted) {
      console.log("[QR] start ignored: scanner already busy/started");
      return;
    }

    scannerStarting = true;
    clearDebug?.();
    if (msgEl) msgEl.textContent = "";
    setStatus("Стартирам камера…", "muted");
    if (btnStart) btnStart.disabled = true;
    if (btnStop) btnStop.disabled = true;

    try {
        if (!window.Html5Qrcode && typeof window.__loadHtml5Qrcode === "function") {
          await window.__loadHtml5Qrcode();
        }

        if (!window.Html5Qrcode) {
          throw new Error("Html5Qrcode library is not loaded.");
        }

        const readerEl = document.getElementById("reader");
        if (!readerEl) {
          setStatus("❌ Липсва scanner контейнер (#reader).", "err");
          if (msgEl) msgEl.textContent = "Отвори Waiter QR страницата отново (waiterQR.html).";
          if (btnStart) btnStart.disabled = false;
          if (btnStop) btnStop.disabled = true;
          return;
        }

        if (scanner) {
          try {
            await safeStopScanner();
            scannerStarting = true;
          } catch (e) {
            console.warn("[QR] cleanup before start warning:", e);
          }
        }

        scanner = new Html5Qrcode("reader");
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = true;

        await ensureCameraPreflight();
        const permissionState = await getCameraPermissionState();
        if (permissionState === "denied") {
          cameraAccessPrimed = false;
          setStatus("❌ Достъпът до камерата е отказан.", "err");
          if (msgEl) msgEl.textContent = "Разреши Camera от иконата до адреса и презареди страницата.";
          if (btnStart) btnStart.disabled = false;
          if (btnStop) btnStop.disabled = true;
          return;
        }

        if (!isMobileDevice() && !cameraAccessPrimed && permissionState !== "granted") {
          await primeCameraAccess();
        }

        const cameraCandidates = await getCameraCandidates();
        const scannerConfigs = getStrongScannerConfigs();

        let started = false;
        let lastStartErr = null;
        let scanFailCount = 0;

        const onScanFailure = () => {
          scanFailCount += 1;

          if (scanFailCount === 30) {
            setStatus("Търся QR… целият код трябва да влиза в квадратната рамка.", "muted");
          }

          if (scanFailCount === 80) {
            setStatus("Отдалечи леко телефона и задръж стабилно. Не приближавай прекалено.", "muted");
          }

          if (scanFailCount === 140) {
            setStatus("Ако QR е плътен, отвори го по-голям на екрана и увеличи яркостта.", "muted");
          }

          if (scanFailCount > 180) {
            scanFailCount = 141;
          }
        };

        for (const candidate of cameraCandidates) {
          for (const cfg of scannerConfigs) {
            try {
              if (!scanner) {
                scanner = new Html5Qrcode("reader");
              }

              await startWithTimeout(
                scanner,
                candidate,
                cfg,
                async (decodedText) => {
                  scanFailCount = 0;
                  await onScan(decodedText);
                },
                onScanFailure,
                9000
              );

              scannerStarted = true;
              started = true;
              if (btnStart) btnStart.disabled = true;
              if (btnStop) btnStop.disabled = false;
              console.log("[QR] scanner started OK", { candidate, cfg });
              break;
            } catch (err) {
              scannerStarted = false;
              lastStartErr = err;
              console.warn("[QR] scanner start failed", { candidate, cfg, err });

              await resetScannerInstance();
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          }

          if (started) break;
        }

        if (!started) throw lastStartErr || new Error("Cannot start camera.");

        iosInlineVideoFix();
        setStatus("Камера: ON • html5-qrcode scanner готов ✅", "ok");
        if (msgEl) msgEl.textContent = "Скенерът работи стабилно само с html5-qrcode.";
        setTimeout(async () => {
          const reader = document.getElementById("reader");
          const video = reader ? reader.querySelector("video") : null;

          if (video) {
            video.setAttribute("playsinline", "true");
            video.setAttribute("webkit-playsinline", "true");
            video.muted = true;
            video.style.width = "100%";
            video.style.height = "100%";
            video.style.objectFit = "cover";
            video.style.objectPosition = "center center";
          }

          try {
            const stream = video?.srcObject;
            const track = stream && typeof stream.getVideoTracks === "function"
              ? stream.getVideoTracks()[0]
              : null;

            if (track && typeof track.getCapabilities === "function" && typeof track.applyConstraints === "function") {
              const caps = track.getCapabilities();
              const advanced = [];

              if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
                advanced.push({ focusMode: "continuous" });
              }

              if (advanced.length) {
                await track.applyConstraints({ advanced }).catch(() => {});
              }
            }
          } catch (e) {
            console.warn("[QR] focus constraints skipped:", e);
          }

          console.log("[QR] reader size", reader?.getBoundingClientRect());
          console.log("[QR] video size", video?.videoWidth, video?.videoHeight);
        }, 500);
    } catch (e) {
        scannerStarted = false;
        try {
          await safeStopScanner();
        } catch {}

        if (isTransitionError(e)) {
          console.warn("[QR] scanner transition error:", e);
          setStatus("Камерата беше заета за момент. Натисни Start отново.", "err");
          if (msgEl) msgEl.textContent = "Телефонът върна camera transition error. Скенерът е reset-нат и може да се стартира отново.";
          if (btnStart) btnStart.disabled = false;
          if (btnStop) btnStop.disabled = true;
          return;
        }

        const info = normalizeCameraError(e);
        if (String(e?.name || "").trim() === "NotAllowedError") {
          cameraAccessPrimed = false;
        }
        if (btnStart) btnStart.disabled = false;
        if (btnStop) btnStop.disabled = true;
        setStatus(info.ui, "err");
        if (info.detail && msgEl) msgEl.textContent = info.detail;
        showDebug("camera: " + firebaseErr(e));
    } finally {
      scannerStarting = false;
      if (!scannerStarted) {
        if (btnStart) btnStart.disabled = false;
        if (btnStop) btnStop.disabled = true;
      } else {
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = false;
      }
    }
  }

  async function stopScanner() {
    console.log("[QR] stop requested", { scannerStarting, scannerStopping, scannerStarted });
    if (scannerStopping) return;

    if (btnStop) btnStop.disabled = true;

    await safeStopScanner();

    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;
    setStatus("Спряна камера.", "muted");
    scannerStarting = false;

    console.log("[QR] scanner stopped OK");
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
      const items = normalizeItems(rawItems).map(toPlainItem).filter((i) => i.name);
      if (!items.length) {
        msgEl.textContent = "вќЊ РќСЏРјР° items РІ РґРѕРєСѓРјРµРЅС‚Р°.";
        btnSend.disabled = false;
        return;
      }
      console.table(items.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        totalPrice: i.totalPrice,
        menuId: i.menuId || "",
        category: i.category || "",
        station: i.station || ""
      })));

      const resolvedItems = [];
      for (const item of items) {
        const station = await resolveStation(sendDb, item);
        resolvedItems.push({
          ...item,
          station: station === "bar" ? "bar" : "kitchen"
        });
      }
      console.table(resolvedItems.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        totalPrice: i.totalPrice,
        menuId: i.menuId || "",
        category: i.category || "",
        station: i.station
      })));
      console.log("[qr-send-items]", resolvedItems.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        totalPrice: i.totalPrice
      })));

      if (SAFE_MODE) {
        await sendDb.collection(SCANS_COLLECTION).add({
          createdAt: FieldValue.serverTimestamp(),
          staffUid: auth.currentUser?.uid || null,
          staffEmail: auth.currentUser?.email || null,
          tableId,
          source: resolved.source,
          sourceId: resolved.docId,
          items: resolvedItems,
          total: safeNum(resolved.total, calcTotalFromItems(resolvedItems)),
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

      for (const item of resolvedItems) {
        await sendDb.collection("orders").doc(orderId).collection("items").add({
          orderId,
          tableId,
          waiterId,
          name: String(item.name || "").trim(),
          qty: readQty(item.qty, 1),
          price: Number(item.price || 0),
          totalPrice: readLineTotal(item),
          menuId: String(item.menuId || "").trim(),
          category: String(item.category || "").trim(),
          station: item.station === "bar" ? "bar" : "kitchen",
          status: "new",
          createdAt: FieldValue.serverTimestamp()
        });
      }

      const orderSnapAfter = await orderRef.get();
      const orderDataAfter = orderSnapAfter.exists ? (orderSnapAfter.data() || {}) : {};
      const mergedItems = mergeOrderItems(orderDataAfter.items, resolvedItems);
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
      updateSendButton();
    }
  }

  // ========= Events =========
  window.addEventListener("resize", () => {
    clearTimeout(scannerResizeTimer);
    scannerResizeTimer = setTimeout(() => {
      const reader = document.getElementById("reader");
      const video = reader ? reader.querySelector("video") : null;

      if (video) {
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.objectPosition = "center center";
      }
    }, 500);
  });

  window.addEventListener("pagehide", () => {
    if (scanner && scannerStarted && !scannerStopping) {
      scanner.stop().catch(() => {});
    }
  });

  if (btnStart) btnStart.addEventListener("click", async () => {
    if (scannerStarting || scannerStopping || scannerStarted) return;
    btnStart.disabled = true;
    await startScanner();
  });
  if (btnStop) btnStop.addEventListener("click", async () => {
    if (scannerStopping) return;
    btnStop.disabled = true;
    await stopScanner();
  });
  if (btnSend) btnSend.addEventListener("click", sendOrder);
  if (btnBack) btnBack.addEventListener("click", () => history.back());
  if (tableSelect) tableSelect.addEventListener("change", updateSendButton);
  bindTap(btnManualQr, async () => {
    const value = String(manualQrInput?.value || "").trim();
    if (!value) {
      msgEl.textContent = "❌ Няма въведен QR текст.";
      return;
    }

    if (decodedBox) decodedBox.textContent = value;

    if (typeof onScan === "function") {
      await onScan(value);
    }
  });

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
