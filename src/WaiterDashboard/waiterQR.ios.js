(function () {
    if (!window.firebase) {
      const dbg = document.getElementById("debugBox");
      if (dbg) {
        dbg.style.display = "block";
        dbg.textContent = "❌ Firebase compat SDK not loaded";
      }
      return;
    }
  
    const db = window.db || firebase.firestore();
    const auth = firebase.auth();
    const AUTH_PERSISTENCE = firebase.auth.Auth.Persistence.LOCAL;
  
    const scanStatusEl = document.getElementById("scanStatus");
    const decodedBox = document.getElementById("decodedBox");
    const tablesStatusEl = document.getElementById("tablesStatus");
    const tableSelect = document.getElementById("tableSelect");
  
    const metaEl = document.getElementById("meta");
    const itemsEl = document.getElementById("items");
    const totalEl = document.getElementById("total");
    const msgEl = document.getElementById("msg");
  
    const btnStart = document.getElementById("btnStart");
    const btnStop = document.getElementById("btnStop");
    const btnSend = document.getElementById("btnSend");
    const btnBack = document.getElementById("btnBack");
    const manualQrInput = document.getElementById("manualQrInput");
    const btnManualQr = document.getElementById("btnManualQr");
    const dashboardBackBtn = document.getElementById("dashboardBackBtn");
  
    const appBox = document.getElementById("appBox");
    const loginEmail = document.getElementById("loginEmail");
    const loginPass = document.getElementById("loginPass");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");
    const authStatus = document.getElementById("authStatus");

    let scanner = null;
    let scannerStarting = false;
    let scannerStopping = false;
    let scannerStarted = false;
    let scannerResizeTimer = null;
    let cameraAccessPrimed = false;
    let scannedOrder = null;
    let menuCacheLoaded = false;
    const menuById = new Map();
    const menuByName = new Map();
    const menuByQrCode = new Map();
    const ALLOWED_ROLES = new Set(["waiter", "manager"]);
    const WAITER_ROLE_ALIASES = new Set([
      "waiter",
      "server",
      "сервитьор",
      "servitor",
      "servityor"
    ]);
    const MANAGER_ROLE_ALIASES = new Set([
      "manager",
      "admin",
      "мениджър",
      "menidjar",
      "управител"
    ]);
    const ACTIVE_STATUS_ALIASES = new Set([
      "",
      "active",
      "активен",
      "aktivен",
      "enabled"
    ]);
    let meProfile = null;
    let deniedAuthReason = "";

    const BAR_STATIONS = new Set(["bar", "drink", "drinks", "beverage", "beverages", "napitki", "napitka", "бар", "напитки"]);
    const KITCHEN_STATIONS = new Set(["kitchen", "cook", "food", "kuhnq", "kuhnya", "kuhnia", "кухня"]);

    function normalizeRole(rawRole) {
      const role = norm(rawRole).replace(/\s+/g, "");
      if (WAITER_ROLE_ALIASES.has(role)) return "waiter";
      if (MANAGER_ROLE_ALIASES.has(role)) return "manager";
      return role;
    }

    function normalizeStatus(rawStatus) {
      const status = norm(rawStatus).replace(/\s+/g, "");
      if (!status) return "";
      return status;
    }

    function roleOf(profile) {
      return normalizeRole(profile?.role);
    }

    function statusOf(profile) {
      return normalizeStatus(profile?.status);
    }

    function canUseQr(profile) {
      if (!profile) return false;
      const role = roleOf(profile);
      if (!ALLOWED_ROLES.has(role)) return false;
      const st = statusOf(profile);
      return ACTIVE_STATUS_ALIASES.has(st);
    }

    async function loadMyProfile(uid) {
      if (!uid) return null;
      const snap = await db.collection("employees").doc(uid).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...(snap.data() || {}) };
    }
  
    function bindTap(el, fn) {
      if (!el) return;
      el.addEventListener("click", fn);
      el.addEventListener(
        "touchstart",
        function (e) {
          e.preventDefault();
          fn(e);
        },
        { passive: false }
      );
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

    async function ensureAuthPersistence() {
      try {
        await auth.setPersistence(AUTH_PERSISTENCE);
      } catch (e) {
        console.warn("auth persistence error:", e);
      }
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
  
    function fmtMoney(n) {
      const x = Number(n);
      return Number.isFinite(x) ? x.toFixed(2) : "0.00";
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
  
    function norm(v) {
      return String(v ?? "").trim().toLowerCase();
    }

    function normalizeStationValue(value) {
      const raw = norm(value);
      if (!raw) return "";
      if (BAR_STATIONS.has(raw)) return "bar";
      if (KITCHEN_STATIONS.has(raw)) return "kitchen";
      return "";
    }

    function normalizeStation(value) {
      return normalizeStationValue(value);
    }

    function normalizeStationForSend(value) {
      return normalizeStationValue(value);
    }

    const BG_DRINK_WORDS = [
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
      return hasAnyKeyword(nameText, BG_DRINK_WORDS);
    }

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
      const directStation = normalizeStationForSend(
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

    function looksLikeCakeNameCategory(name, category = "") {
      return looksLikeReadyDessert({ name, category });
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

    function textHasAnyHint(text, hints) {
      const source = String(text || "").trim().toLowerCase();
      if (!source) return false;
      return hints.some((keyword) => source.includes(String(keyword || "").toLowerCase()));
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
          station: normalizeStationForSend(row.station || row.department || ""),
          category: String(row.category || row.categoryKey || row.categorySlug || row.type || "").trim()
        };
        if (id) menuById.set(id, normalized);
        if (name) menuByName.set(norm(name), normalized);
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
      const nameKey = norm(item?.name || "");

      if (qrCode && menuByQrCode.has(qrCode)) return menuByQrCode.get(qrCode);
      if (menuId && menuById.has(menuId)) return menuById.get(menuId);
      if (itemId && menuById.has(itemId)) return menuById.get(itemId);
      if (nameKey && menuByName.has(nameKey)) return menuByName.get(nameKey);
      return null;
    }

    function stationForItem(item, resolvedMenu = null) {
      return resolveFinalStation(item, resolvedMenu);
    }

    async function loadMenuCache(dbInstance = db) {
      if (menuCacheLoaded) return;
      menuCacheLoaded = true;
      const rows = [];

      const collections = ["menus", "menu_items"];
      for (const collectionName of collections) {
        try {
          const snap = await dbInstance.collection(collectionName).get();
          snap.forEach((docSnap) => rows.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
        } catch (err) {
          // best-effort: collection may not exist in this setup
        }
      }

      buildMenuIndexByIdAndName(rows);
    }

    async function resolveStationsForSend(items) {
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
            for (const collectionName of ["menus", "menu_items"]) {
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

    async function withResolvedStations(items) {
      const pack = await resolveStationsForSend(items);
      return pack.items;
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

    function safeTotal(x) {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    }
  
    function setStatus(text, cls) {
      scanStatusEl.textContent = text;
      scanStatusEl.className = cls || "muted";
    }
  
    function hasUnresolvedQrItems(order) {
      return Array.isArray(order?.items) && order.items.some((item) => {
        if (item._unresolvedQrItem === true) return true;
        return item._unresolvedQrCode === true;
      });
    }

    function canSend() {
      return !!scannedOrder && !!tableSelect.value && !hasUnresolvedQrItems(scannedOrder);
    }
  
    function updateSendButton() {
      btnSend.disabled = !canSend();
    }
  
    function renderOrder() {
      if (!scannedOrder) {
        metaEl.textContent = "Няма заредена поръчка.";
        itemsEl.innerHTML = "";
        totalEl.textContent = "";
        updateSendButton();
        return;
      }
  
      metaEl.innerHTML = `
        <div class="badge">Сканирана поръчка ✅</div>
        <div class="muted" style="margin-top:6px;">
          Бележка: ${esc(scannedOrder.note || "—")}
        </div>
      `;
  
      const items = normalizeItems(scannedOrder.items || []);
  
      itemsEl.innerHTML = items.length
        ? items
            .map(
              (it) => {
                const qty = readQty(it.qty, 1);
                const price = safeNum(it.price, 0);
                const lineTotal = readLineTotal(it);
                return `
            <div class="itemRow">
              <div>
                <div>${esc(it.name)} × ${esc(qty)}</div>
                <div class="muted">${fmtMoney(price)} € / бр. — общо ${fmtMoney(lineTotal)} €</div>
              </div>
            </div>
          `;
              }
            )
            .join("")
        : `<div class="muted">Няма items.</div>`;
  
      const total = Number.isFinite(Number(scannedOrder.total)) ? safeNum(scannedOrder.total) : calcTotalFromItems(items);
      totalEl.textContent = `Общо (сканирано): ${fmtMoney(total)} €`;
      updateSendButton();
    }
  
    async function loadTables() {
      try {
        tablesStatusEl.textContent = "Зареждам маси…";
  
        const snap = await db.collection("tables").get();
        const tables = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
        tableSelect.innerHTML = `<option value="">— избери маса —</option>`;
  
        tables.forEach((t) => {
          const opt = document.createElement("option");
          const n = t.number;
          const label = Number.isFinite(Number(n)) ? `Маса ${n}` : t.id;
          opt.value = String(t.id);
          opt.textContent = label;
          tableSelect.appendChild(opt);
        });
  
        tablesStatusEl.textContent = `(${tables.length}) ✅`;
      } catch (e) {
        console.error("loadTables error:", e);
        tablesStatusEl.textContent = "❌ tables не се заредиха";
        msgEl.textContent = "❌ tables error: " + (e?.message || e);
      }
    }
  
    function parsePrice(v) {
      const n = Number(String(v ?? "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }

    function textToItems(rawText) {
      const text = String(rawText || "").trim();
      if (!text) return [];

      const lines = text
        .split(/\r?\n|;/)
        .map((x) => x.trim())
        .filter(Boolean);

      const items = lines.map((line) => {
        const m1 = line.match(/^(.+?)\s*[xX*]\s*(\d+)(?:\s*[-\u2013\u2014]\s*(\d+(?:[.,]\d+)?))?$/);
        if (m1) {
          return {
            name: String(m1[1]).trim(),
            qty: Number(m1[2] || 1),
            price: parsePrice(m1[3] || 0),
          };
        }

        const m2 = line.match(/^(.+?)\s*[-\u2013\u2014]\s*(\d+(?:[.,]\d+)?)(?:\s*[xX*]\s*(\d+))?$/);
        if (m2) {
          return {
            name: String(m2[1]).trim(),
            qty: Number(m2[3] || 1),
            price: parsePrice(m2[2] || 0),
          };
        }

        return {
          name: line,
          qty: 1,
          price: 0,
        };
      });

      return items.filter((x) => x.name);
    }

    function parseJsonLike(value) {
      if (value == null) return null;
      if (typeof value === "object") return value;
      try {
        return JSON.parse(String(value));
      } catch {
        return null;
      }
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

    function buildOrderObject(obj, converted) {
      const payload = unwrapOrderPayload(obj || {});
      const items = normalizeItems(Array.isArray(payload?.items) ? payload.items : []);
      if (!items.length) return null;

      return {
        note: payload.note || payload.comment || payload.comments || "",
        tableId: payload.tableId || "",
        items,
        total: safeTotal(payload.total || calcTotalFromItems(items)),
        createdAtLocal: payload.createdAtLocal || new Date().toISOString(),
        _convertedFromNonJson: !!converted,
        _convertedFromCompact: payload._convertedFromCompact === true,
        _convertedFromUltraCompactText: payload._convertedFromUltraCompactText === true,
        _convertedFromCompactText: payload._convertedFromCompactText === true,
      };
    }

    function parseOrderFromUrl(text) {
      let url;
      try {
        const raw = /^https?:\/\//i.test(text) ? text : `https://${text}`;
        url = new URL(raw);
      } catch {
        return null;
      }

      const p = url.searchParams;
      const note = p.get("note") || p.get("n") || "";

      for (const key of ["payload", "order", "data", "json"]) {
        const value = p.get(key);
        if (!value) continue;

        const decoded = decodeURIComponent(value);
        const obj = parseJsonLike(decoded);
        const payload = unwrapOrderPayload(obj);
        if (payload && Array.isArray(payload.items)) {
          return buildOrderObject(
            {
              ...payload,
              note: payload.note || note,
            },
            true
          );
        }
      }

      const itemsRaw = p.get("items");
      if (itemsRaw) {
        const decoded = decodeURIComponent(itemsRaw);
        const parsedItems = parseJsonLike(decoded);

        if (Array.isArray(parsedItems) && parsedItems.length) {
          return buildOrderObject(
            {
              note,
              items: parsedItems,
              total: safeTotal(p.get("total")),
            },
            true
          );
        }

        const parsedPayload = unwrapOrderPayload(parsedItems);
        if (parsedPayload && Array.isArray(parsedPayload.items) && parsedPayload.items.length) {
          return buildOrderObject(
            {
              note: parsedPayload.note || note,
              items: parsedPayload.items,
              total: safeTotal(parsedPayload.total || p.get("total")),
            },
            true
          );
        }
      }

      const itemParams = p.getAll("item");
      if (itemParams.length) {
        const qtyParams = p.getAll("qty");
        const quantityParams = p.getAll("quantity");
        const countParams = p.getAll("count");
        const priceParams = p.getAll("price");

        const fromParams = itemParams.map((name, idx) => ({
          name: String(name || "").trim(),
          qty: Number(
            qtyParams[idx] ??
            quantityParams[idx] ??
            countParams[idx] ??
            qtyParams[0] ??
            quantityParams[0] ??
            countParams[0] ??
            1
          ),
          price: parsePrice(priceParams[idx] ?? priceParams[0] ?? 0),
        }));
        return buildOrderObject({ note, items: fromParams }, true);
      }

      const singleName = p.get("name") || p.get("item") || p.get("product");
      if (singleName) {
        return buildOrderObject(
          {
            note,
            items: [
              {
                name: String(singleName).trim(),
                qty: Number(p.get("qty") || p.get("quantity") || p.get("count") || 1),
                price: parsePrice(p.get("price") || 0),
              },
            ],
            total: safeTotal(p.get("total")),
          },
          true
        );
      }

      const fromText = textToItems(decodeURIComponent(url.pathname.replace(/^\/+/, "")));
      if (fromText.length) {
        return buildOrderObject({ note, items: fromText }, true);
      }

      return null;
    }

    function parseOrderFromQR(decodedText) {
      const text = String(decodedText || "").trim();
      if (!text) return null;

      const ultraCompactText = parseUltraCompactTextOrder(text);
      if (ultraCompactText) {
        return buildOrderObject(ultraCompactText, true);
      }

      const compactText = parseCompactTextOrder(text);
      if (compactText) {
        return buildOrderObject(compactText, true);
      }

      try {
        const obj = JSON.parse(text);
        const compact = buildOrderFromCompactPayload(obj);
        if (compact) {
          return buildOrderObject(compact, true);
        }

        const payload = unwrapOrderPayload(obj);
        if (payload && Array.isArray(payload.items)) {
          return buildOrderObject(payload, false);
        }

        const nested = parseJsonLike(obj?.data || obj?.order || obj?.payload);
        const nestedPayload = unwrapOrderPayload(nested);
        if (nestedPayload && Array.isArray(nestedPayload.items)) {
          return buildOrderObject(nestedPayload, false);
        }
      } catch {}

      const fromUrl = parseOrderFromUrl(text);
      if (fromUrl) return fromUrl;

      const fromText = textToItems(text);
      if (fromText.length) {
        return buildOrderObject(
          {
            note: "Converted from plain QR text",
            items: fromText,
            total: calcTotalFromItems(fromText),
          },
          true
        );
      }

      return null;
    }

    async function handleDecodedQr(decodedText) {
      decodedBox.textContent = decodedText || "(empty)";
      if (msgEl) msgEl.textContent = "";

      try {
        const parsed = parseOrderFromQR(decodedText);

        if (!parsed) {
          setStatus("QR payload cannot be converted to order.", "err");
          return;
        }

        scannedOrder = await hydrateScannedOrderItemsFromMenu(parsed);
        console.log("[qr-items-normalized]", normalizeItems(scannedOrder.items || scannedOrder.order?.items || []));
        renderOrder();
        if (hasUnresolvedQrItems(scannedOrder)) {
          console.warn("[QR] unresolved qrCode items:", scannedOrder.items);
          setStatus("QR е прочетен, но има неразпознати артикули.", "err");
          if (msgEl) {
            msgEl.textContent = "Кодовете от QR не са намерени в менюто. Провери qrCode/shortCode или използвай R1 fallback.";
          }
          if (btnSend) btnSend.disabled = true;
          return;
        }

        setStatus("QR сканиран успешно ✅", "ok");
        updateSendButton();
      } catch (err) {
        console.error("[QR decode failed]", err);
        setStatus("QR е разчетен, но поръчката не се зареди.", "err");
        if (msgEl) msgEl.textContent = err?.message || String(err || "");
      }
    }

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
  
    async function startScanner() {
      console.log("[QR] start requested", { scannerStarting, scannerStopping, scannerStarted });
      if (scannerStarting || scannerStopping || scannerStarted) {
        console.log("[QR] start ignored: scanner already busy/started");
        return;
      }

      scannerStarting = true;
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
                    await handleDecodedQr(decodedText);
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
          setStatus(info.ui, "err");
          if (info.detail && msgEl) msgEl.textContent = info.detail;
          if (btnStart) btnStart.disabled = false;
          if (btnStop) btnStop.disabled = true;
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
  
    // ✅ items нормализация
    function normalizeItems(arr) {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((x) => {
          const qty = readQty(x?.qty ?? x?.quantity ?? x?.count ?? x?.q ?? x?.amount, 1);
          const price = safeNum(x?.price ?? x?.unitPrice ?? x?.unit_price ?? x?.cost ?? 0, 0);
          const totalPriceRaw = x?.totalPrice ?? x?.lineTotal ?? x?.total;
          const totalPrice = totalPriceRaw == null ? null : safeNum(totalPriceRaw, null);
          return {
            // if menuId exists in QR payload, use it (fallback to id/itemId)
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
            category: String(x?.category ?? x?.categoryKey ?? x?.categorySlug ?? x?.group ?? x?.type ?? "").trim(),
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

    function toPlainItem(raw) {
      const name = String(raw?.name ?? raw?.item ?? raw?.title ?? "").trim();
      const qty = readQty(raw?.qty ?? raw?.quantity ?? raw?.count ?? raw?.q ?? raw?.amount, 1);
      const price = safeNum(raw?.price ?? raw?.unitPrice ?? raw?.unit_price ?? raw?.cost ?? 0, 0);
      const totalPriceRaw = raw?.totalPrice ?? raw?.lineTotal ?? raw?.total;
      const totalPrice = totalPriceRaw == null ? null : safeNum(totalPriceRaw, null);
      const menuId = String(raw?.menuId ?? raw?.id ?? "").trim();
      const qrCode = String(raw?.qrCode ?? raw?.shortCode ?? raw?.code ?? raw?.qr ?? "").trim();
      const itemId = String(raw?.itemId ?? raw?.menuId ?? raw?.id ?? "").trim();
      const category = String(raw?.category ?? raw?.categoryKey ?? raw?.categorySlug ?? raw?.cat ?? "").trim();
      const type = String(raw?.type ?? "").trim();
      const station = String(raw?.station ?? raw?.targetStation ?? raw?.department ?? raw?.prepStation ?? raw?.destination ?? "").trim();
      return { name, qty, price, totalPrice, menuId, itemId, qrCode, shortCode: qrCode, code: qrCode, qr: qrCode, category, type, station };
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
      const status = norm(orderData?.status);
      const paymentStatus = norm(orderData?.paymentStatus);
      if (paymentStatus === "paid") return true;
      if (status === "paid" || status === "closed" || status === "cancelled") return true;
      if (orderData?.closedAt != null) return true;
      return false;
    }

    function makeOrderItem(raw) {
      const name = String(raw?.name || raw?.itemId || raw?.menuId || "Item").trim();
      const menuId = String(raw?.menuId || raw?.itemId || "").trim();
      const itemId = String(raw?.itemId || raw?.menuId || name).trim() || name;
      const qty = readQty(raw?.qty ?? raw?.quantity ?? raw?.count ?? raw?.q ?? raw?.amount, 1);
      const price = Number(raw?.price || 0);
      const totalPrice = readLineTotal({ ...raw, qty, price });
      const notes = String(raw?.notes || raw?.note || "").trim();
      const category = String(raw?.category || raw?.categoryKey || raw?.categorySlug || "").trim();
      const station = resolveFinalStation({ ...raw, name, category });
      return {
        itemId,
        menuId,
        name,
        qty,
        price: Number.isFinite(price) ? price : 0,
        totalPrice,
        category,
        station,
        notes
      };
    }

    function sameItem(left, right) {
      const leftId = norm(left?.menuId || left?.itemId || "");
      const rightId = norm(right?.menuId || right?.itemId || "");
      const leftStation = resolveFinalStation(left);
      const rightStation = resolveFinalStation(right);
      const leftNotes = norm(left?.notes || left?.note || "");
      const rightNotes = norm(right?.notes || right?.note || "");
      if (leftId && rightId) {
        return leftId === rightId && leftStation === rightStation && leftNotes === rightNotes;
      }
      const leftName = norm(left?.name || left?.itemId || left?.menuId || "");
      const rightName = norm(right?.name || right?.itemId || right?.menuId || "");
      const leftPrice = Number(left?.price || 0);
      const rightPrice = Number(right?.price || 0);
      return (
        leftName === rightName &&
        leftStation === rightStation &&
        leftNotes === rightNotes &&
        Math.abs(leftPrice - rightPrice) < 0.00001
      );
    }

    function mergeOrderItems(existingItems, incomingItems) {
      const out = Array.isArray(existingItems)
        ? existingItems.map((item) => ({ ...item }))
        : [];
      for (const raw of Array.isArray(incomingItems) ? incomingItems : []) {
        const next = makeOrderItem(raw);
        const idx = out.findIndex((entry) => sameItem(entry, next));
        if (idx < 0) {
          out.push(next);
          continue;
        }
        const existingTotal = readLineTotal(out[idx]);
        out[idx].qty = (Number(out[idx].qty) || 0) + next.qty;
        out[idx].totalPrice = existingTotal + next.totalPrice;
        if (!out[idx].menuId && next.menuId) out[idx].menuId = next.menuId;
        if (!out[idx].itemId && next.itemId) out[idx].itemId = next.itemId;
        if (!out[idx].name && next.name) out[idx].name = next.name;
        if (!Number.isFinite(Number(out[idx].price))) out[idx].price = next.price;
        if (!String(out[idx].category || "").trim() && next.category) out[idx].category = next.category;
        out[idx].station = next.station;
        if (!String(out[idx].notes || out[idx].note || "").trim() && next.notes) out[idx].notes = next.notes;
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

    async function getActiveOrderForTable(dbInstance, tableData) {
      const candidates = [];
      const currentOrderId = String(tableData?.currentOrderId || "").trim();
      if (currentOrderId) candidates.push(currentOrderId);
      const activeOrders = Array.isArray(tableData?.activeOrders) ? tableData.activeOrders : [];
      for (let i = activeOrders.length - 1; i >= 0; i -= 1) {
        const id = String(activeOrders[i] || "").trim();
        if (!id || candidates.includes(id)) continue;
        candidates.push(id);
      }
      for (const orderId of candidates) {
        const snap = await dbInstance.collection("orders").doc(orderId).get();
        if (!snap.exists) continue;
        const orderData = snap.data() || {};
        if (isOrderClosed(orderData)) continue;
        return { orderId, orderData };
      }
      return null;
    }

    async function ensureOrderForTable(dbInstance, FieldValue, { tableId, tableData, waiterId, tableLabel, note }) {
      const active = await getActiveOrderForTable(dbInstance, tableData);
      if (active?.orderId) {
        return active.orderId;
      }
      const orderRef = dbInstance.collection("orders").doc();
      const nowTs = FieldValue.serverTimestamp();
      await orderRef.set({
        orderId: orderRef.id,
        tableId,
        waiterId,
        createdBy: waiterId,
        tableLabel,
        type: "dine-in",
        source: "waiter_qr",
        status: "created",
        orderStatus: "open",
        paymentStatus: "unpaid",
        closedAt: null,
        note: String(note || ""),
        items: [],
        activeItemCount: 0,
        total: 0,
        createdAt: nowTs,
        updatedAt: nowTs
      }, { merge: true });
      return orderRef.id;
    }

    async function appendItemsToDashboardOrder(dbInstance, FieldValue, { orderId, tableId, waiterId, tableLabel, note, items }) {
      const orderRef = dbInstance.collection("orders").doc(orderId);
      await dbInstance.runTransaction(async (tx) => {
        const snap = await tx.get(orderRef);
        const orderData = snap.exists ? (snap.data() || {}) : {};
        if (isOrderClosed(orderData)) {
          throw new Error("Order is already closed/paid.");
        }

        const mergedItems = mergeOrderItems(orderData.items, items);
        const summary = summarizeItems(mergedItems);
        const nowTs = FieldValue.serverTimestamp();
        const existingStatus = String(orderData.status || "").trim();

        tx.set(orderRef, {
          orderId,
          tableId,
          waiterId: waiterId || orderData.waiterId || null,
          createdBy: orderData.createdBy || waiterId || null,
          tableLabel: tableLabel || orderData.tableLabel || tableId,
          type: orderData.type || "dine-in",
          source: orderData.source || "waiter_qr",
          status: existingStatus || "created",
          orderStatus: "open",
          paymentStatus: "unpaid",
          closedAt: null,
          note: String(note || orderData.note || ""),
          items: mergedItems,
          activeItemCount: summary.count,
          total: summary.total,
          createdAt: orderData.createdAt || nowTs,
          updatedAt: nowTs
        }, { merge: true });
      });
      return orderRef;
    }

    async function fallbackSaveScan(dbInstance, FieldValue, { tableId, items, note, meUid, error }) {
      const safeItems = (Array.isArray(items) ? items : [])
        .map((raw) => toPlainItem(raw))
        .filter((item) => item.name)
        .map((item) => ({ ...item, station: resolveStationForWrite(item) }));
      const payload = {
        tableId: String(tableId || ""),
        items: safeItems,
        note: String(note || ""),
        source: "waiter_qr_fallback",
        waiterId: meUid || null,
        createdBy: meUid || null,
        errorCode: String(error?.code || ""),
        errorMessage: String(error?.message || ""),
        createdAt: FieldValue.serverTimestamp(),
      };
      await dbInstance.collection("waiter_scans").add(payload);
    }
  
    async function sendOrder() {
      btnSend.disabled = true;
      const db = firebase.firestore();
      const FieldValue = firebase.firestore.FieldValue;
      let fallbackItems = [];
      try {
        if (!scannedOrder) {
          msgEl.textContent = "❌ Няма сканирана поръчка.";
          return;
        }
        if (!tableSelect.value) {
          msgEl.textContent = "❌ Избери маса.";
          return;
        }
  
        msgEl.textContent = "Записвам поръчката…";

        const user = auth.currentUser;
        if (!user) {
          msgEl.textContent = "❌ Трябва да си логнат.";
          return;
        }

        meProfile = meProfile || (await loadMyProfile(user.uid));
        if (!canUseQr(meProfile)) {
          msgEl.textContent = "❌ Достъп само за сервитьор или мениджър.";
          return;
        }

        const meUid = String(user.uid || "");
  
        const tableId = tableSelect.value;
        const rawItems = scannedOrder?.items || scannedOrder?.order?.items || [];
        const scannedItems = normalizeItems(rawItems).map(toPlainItem).filter((i) => i.name);
        fallbackItems = scannedItems;
        if (!scannedItems.length) {
          msgEl.textContent = "❌ Няма items в сканираната поръчка.";
          return;
        }
        console.table(
          scannedItems.map((it) => ({
            name: it.name,
            qty: it.qty,
            price: it.price,
            totalPrice: it.totalPrice,
            menuId: it.menuId || "",
            category: it.category || "",
            station: it.station || ""
          }))
        );

        const resolvedItems = [];
        for (const item of scannedItems) {
          const station = await resolveStation(db, item);
          resolvedItems.push({
            ...item,
            station: station === "bar" ? "bar" : "kitchen"
          });
        }
        fallbackItems = resolvedItems;

        console.table(
          resolvedItems.map((it) => ({
            name: it.name,
            qty: it.qty,
            price: it.price,
            totalPrice: it.totalPrice,
            menuId: it.menuId || "",
            category: it.category || "",
            station: it.station
          }))
        );
        console.log("[qr-send-items]", resolvedItems.map((it) => ({
          name: it.name,
          qty: it.qty,
          price: it.price,
          totalPrice: it.totalPrice
        })));
        const scannedNote = String(scannedOrder?.note || "");

        const tableRef = db.collection("tables").doc(tableId);
        const tableSnap = await tableRef.get();
        if (!tableSnap.exists) {
          msgEl.textContent = "❌ Тази маса не съществува в базата.";
          return;
        }

        const tableData = tableSnap.data() || {};
        const tableLabel =
          tableData?.number != null
            ? `Table ${tableData.number}`
            : String(tableData?.name || tableData?.title || tableId);

        const orderId = await ensureOrderForTable(db, FieldValue, {
          tableId,
          tableData,
          waiterId: meUid,
          tableLabel,
          note: scannedNote
        });

        const orderRef = db.collection("orders").doc(orderId);
        for (const item of resolvedItems) {
          await db.collection("orders").doc(orderId).collection("items").add({
            orderId,
            tableId,
            waiterId: meUid,
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

        await appendItemsToDashboardOrder(db, FieldValue, {
          orderId,
          tableId,
          waiterId: meUid,
          tableLabel,
          note: scannedNote,
          items: resolvedItems
        });

        await orderRef.set({
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        await tableRef.set({
          status: "busy",
          currentOrderId: orderId,
          updatedAt: FieldValue.serverTimestamp(),
          activeOrders: FieldValue.arrayUnion(orderId)
        }, { merge: true });

        console.log("[waiter] sent order", orderId, { items: resolvedItems.length });

        scannedOrder = null;
        decodedBox.textContent = "(empty)";
        renderOrder();
        updateSendButton();
        msgEl.textContent = `Added to bill: ${orderId}`;
      } catch (e) {
        console.error("send order error:", e);
        const extra = e?.code ? ` (${e.code})` : "";
        const code = String(e?.code || "");
        const msg = String(e?.message || e || "");
        const denied = code.includes("permission-denied") || /insufficient permissions/i.test(msg);

        if (denied) {
          try {
            await fallbackSaveScan(db, FieldValue, {
              tableId: tableSelect?.value || "",
              items: fallbackItems,
              note: scannedOrder?.note || "",
              meUid: auth.currentUser?.uid || null,
              error: e,
            });
            msgEl.textContent = "⚠️ Нямаш права за orders/tables. Записах заявката в waiter_scans.";
          } catch (fallbackErr) {
            msgEl.textContent = "❌ Грешка права: " + msg + extra;
          }
        } else {
          msgEl.textContent = "❌ Грешка: " + msg + extra;
        }
      } finally {
        updateSendButton();
      }
    }
  
    // events
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

    bindTap(btnStart, async () => {
      if (scannerStarting || scannerStopping || scannerStarted) return;
      btnStart.disabled = true;
      await startScanner();
    });
    bindTap(btnStop, async () => {
      if (scannerStopping) return;
      btnStop.disabled = true;
      await stopScanner();
    });
    bindTap(btnSend, sendOrder);
    bindTap(btnManualQr, async () => {
      const value = String(manualQrInput?.value || "").trim();
      if (!value) {
        msgEl.textContent = "❌ Няма въведен QR текст.";
        return;
      }

      decodedBox.textContent = value;
      await handleDecodedQr(value);
    });
  
    btnBack?.addEventListener("click", () => history.back());
    dashboardBackBtn?.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
    tableSelect?.addEventListener("change", updateSendButton);
  
    // auth
    bindTap(btnLogin, async () => {
      try {
        msgEl.textContent = "";
        deniedAuthReason = "";
        const email = (loginEmail.value || "").trim();
        const pass = (loginPass.value || "").trim();
  
        if (!email || !pass) {
          authStatus.textContent = "❌ Въведи email + password.";
          return;
        }
  
        authStatus.textContent = "Влизам…";
        await ensureAuthPersistence();
        await auth.signInWithEmailAndPassword(email, pass);
      } catch (e) {
        console.error("login error:", e);
        authStatus.textContent = "❌ Грешка вход: " + (e?.message || e);
      }
    });
  
    bindTap(btnLogout, async () => {
      try {
        await auth.signOut();
      } catch (e) {}
    });

    // Persist session: first login is manual, next loads auto-login.
    ensureAuthPersistence();
  
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        btnLogout.disabled = false;

        try {
          meProfile = await loadMyProfile(user.uid);
        } catch (e) {
          meProfile = null;
        }

        if (!canUseQr(meProfile)) {
          deniedAuthReason = `❌ Достъп само за role waiter/manager и status active (role=${roleOf(meProfile) || "-"}, status=${statusOf(meProfile) || "-"})`;
          try {
            await auth.signOut();
          } catch {}
          return;
        }

        deniedAuthReason = "";

        authStatus.textContent = `✅ Логнат: ${user.email || user.uid} (${roleOf(meProfile)})`;
        if (appBox) appBox.classList.remove("hide");
        await loadTables();
      } else {
        meProfile = null;
        authStatus.textContent = deniedAuthReason || "Не си логнат.";
        deniedAuthReason = "";
        btnLogout.disabled = true;
        if (appBox) appBox.classList.add("hide");
  
        await stopScanner();
  
        scannedOrder = null;
        decodedBox.textContent = "(empty)";
        setStatus("Чакаме сканиране…", "muted");
        renderOrder();
  
        tableSelect.innerHTML = `<option value="">— избери маса —</option>`;
        tablesStatusEl.textContent = "";
      }
    });
  })();
