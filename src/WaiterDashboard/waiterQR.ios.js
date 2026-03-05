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
  
    const appBox = document.getElementById("appBox");
    const loginEmail = document.getElementById("loginEmail");
    const loginPass = document.getElementById("loginPass");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");
    const authStatus = document.getElementById("authStatus");

    let scanner = null;
    let scannerStarting = false;
    let cameraAccessPrimed = false;
    let scannedOrder = null;
    let menuCacheLoaded = false;
    const menuById = new Map();
    const menuByName = new Map();
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

    const BAR_STATIONS = new Set(["bar", "drink", "drinks", "beverage", "beverages", "napitki"]);
    const KITCHEN_STATIONS = new Set(["kitchen", "cook", "food", "kuhnq"]);

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

    function textHasAnyHint(text, hints) {
      const source = String(text || "").trim().toLowerCase();
      if (!source) return false;
      return hints.some((keyword) => source.includes(String(keyword || "").toLowerCase()));
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
          station: normalizeStationForSend(row.station || row.department || ""),
          category: String(row.category || row.type || "").trim()
        };
        if (id) menuById.set(id, normalized);
        if (name) menuByName.set(norm(name), normalized);
      });
    }

    function resolveMenuForItem(item) {
      const menuId = String(item?.menuId || "").trim();
      const itemId = String(item?.itemId || "").trim();
      const nameKey = norm(item?.name || "");

      if (menuId && menuById.has(menuId)) return menuById.get(menuId);
      if (itemId && menuById.has(itemId)) return menuById.get(itemId);
      if (nameKey && menuByName.has(nameKey)) return menuByName.get(nameKey);
      return null;
    }

    function stationForItem(item, resolvedMenu = null) {
      const directStation = normalizeStationForSend(item?.station || item?.department || "");
      if (directStation) return directStation;

      const categoryText = [
        item?.category,
        item?.type,
        resolvedMenu?.category,
        resolvedMenu?.type
      ]
        .filter((part) => String(part || "").trim().length > 0)
        .join(" ");
      if (textHasAnyHint(categoryText, DRINK_CATEGORY_HINTS)) return "bar";

      const nameText = String(
        item?.name ||
        resolvedMenu?.name ||
        item?.title ||
        item?.productName ||
        item?.itemId ||
        item?.menuId ||
        ""
      ).trim();
      if (textHasAnyHint(nameText, BAR_NAME_KEYWORDS)) return "bar";

      return "kitchen";
    }

    async function loadMenuCache() {
      if (menuCacheLoaded) return;
      menuCacheLoaded = true;
      const rows = [];

      const collections = ["menus", "menu_items"];
      for (const collectionName of collections) {
        try {
          const snap = await db.collection(collectionName).get();
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

    async function withResolvedStations(items) {
      const pack = await resolveStationsForSend(items);
      return pack.items;
    }

    function safeTotal(x) {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    }
  
    function setStatus(text, cls) {
      scanStatusEl.textContent = text;
      scanStatusEl.className = cls || "muted";
    }
  
    function canSend() {
      return !!scannedOrder && !!tableSelect.value;
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
  
      const items = Array.isArray(scannedOrder.items) ? scannedOrder.items : [];
  
      itemsEl.innerHTML = items.length
        ? items
            .map(
              (it) => `
            <div class="itemRow">
              <div>${esc(it.name)} × ${esc(it.qty)}</div>
              <div>${fmtMoney(it.price)} €</div>
            </div>
          `
            )
            .join("")
        : `<div class="muted">Няма items.</div>`;
  
      totalEl.textContent = `Общо (сканирано): ${fmtMoney(scannedOrder.total)} €`;
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

    function buildOrderObject(obj, converted) {
      const items = Array.isArray(obj?.items) ? obj.items : [];
      if (!items.length) return null;

      return {
        note: obj.note || "",
        items,
        total: safeTotal(obj.total || calcTotalFromItems(items)),
        createdAtLocal: obj.createdAtLocal || new Date().toISOString(),
        _convertedFromNonJson: !!converted,
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
        if (obj && Array.isArray(obj.items)) {
          return buildOrderObject(
            {
              ...obj,
              note: obj.note || note,
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

        if (parsedItems && Array.isArray(parsedItems.items) && parsedItems.items.length) {
          return buildOrderObject(
            {
              note: parsedItems.note || note,
              items: parsedItems.items,
              total: safeTotal(parsedItems.total || p.get("total")),
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

      try {
        const obj = JSON.parse(text);
        if (obj && Array.isArray(obj.items)) {
          return buildOrderObject(obj, false);
        }

        const nested = parseJsonLike(obj?.data || obj?.order || obj?.payload);
        if (nested && Array.isArray(nested.items)) {
          return buildOrderObject(nested, false);
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
  
    async function startScanner() {
      if (scannerStarting) return;
      scannerStarting = true;
      msgEl.textContent = "";
      setStatus("Стартирам камера…", "muted");
  
      if (!window.Html5Qrcode) {
        setStatus("❌ Html5Qrcode липсва", "err");
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
  
      const config = { fps: 10, qrbox: { width: 260, height: 260 } };
  
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

        const onDecoded = (decodedText) => {
          decodedBox.textContent = decodedText || "(empty)";
          const parsed = parseOrderFromQR(decodedText);

          if (!parsed) {
            setStatus("QR payload cannot be converted to order.", "err");
            return;
          }

          scannedOrder = parsed;
          if (parsed._convertedFromNonJson) {
            setStatus("QR converted and loaded.", "ok");
          } else {
            setStatus("QR scanned successfully.", "ok");
          }
          renderOrder();
        };

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
            await scanner.start(candidate, config, onDecoded, () => {});
            started = true;
            break;
          } catch (err) {
            lastStartErr = err;
          }
        }
        if (!started) throw lastStartErr || new Error("Cannot start camera.");
  
        iosInlineVideoFix();
      } catch (e) {
        const info = normalizeCameraError(e);
        if (String(e?.name || "").trim() === "NotAllowedError") {
          cameraAccessPrimed = false;
        }
        setStatus(info.ui, "err");
        if (info.detail) msgEl.textContent = info.detail;
        btnStart.disabled = false;
        btnStop.disabled = true;
      } finally {
        scannerStarting = false;
      }
    }
  
    async function stopScanner() {
      try {
        if (scanner) {
          await scanner.stop();
          await scanner.clear();
          scanner = null;
        }
      } catch {}
  
      btnStart.disabled = false;
      btnStop.disabled = true;
      setStatus("Спряна камера.", "muted");
      scannerStarting = false;
    }
  
    // ✅ items нормализация
    function normalizeItems(arr) {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((x) => ({
          // if menuId exists in QR payload, use it (fallback to id/itemId)
          menuId: String(x?.menuId ?? x?.menu_id ?? x?.id ?? x?.itemId ?? "").trim(),
          itemId: String(x?.itemId ?? x?.menuId ?? x?.menu_id ?? x?.id ?? "").trim(),
          name: String(x?.name ?? x?.item ?? x?.title ?? x?.itemId ?? x?.menuId ?? "").trim(),
          qty: Number(x?.qty ?? x?.quantity ?? x?.count ?? x?.q ?? 1),
          price: Number(x?.price ?? x?.unitPrice ?? x?.unit_price ?? x?.cost ?? 0),
          category: String(x?.category ?? x?.group ?? x?.type ?? "").trim(),
          categoryId: String(x?.categoryId ?? x?.category_id ?? "").trim(),
          type: String(x?.type ?? "").trim(),
          isDrink: x?.isDrink === true || String(x?.isDrink || "").toLowerCase() === "true",
          notes: String(x?.notes ?? x?.note ?? x?.comment ?? "").trim(),
          station: String(x?.station ?? x?.targetStation ?? x?.department ?? x?.prepStation ?? x?.destination ?? "").trim(),
        }))
        .filter((x) => (x.name || x.menuId || x.itemId) && Number.isFinite(x.qty) && x.qty > 0);
    }
  
    function calcTotalFromItems(items) {
      return normalizeItems(items).reduce((sum, it) => {
        return sum + Number(it.qty || 0) * Number(it.price || 0);
      }, 0);
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
        const menuStation = normalizeStationForSend(menu.station || "");
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
      const qty = Math.max(1, Number(raw?.qty || 1));
      const price = Number(raw?.price || 0);
      const notes = String(raw?.notes || raw?.note || "").trim();
      const station = normalizeStationForSend(raw?.station) || resolveStationFallbackByName(name);
      const category = String(raw?.category || "").trim();
      return {
        itemId,
        menuId,
        name,
        qty,
        price: Number.isFinite(price) ? price : 0,
        category,
        station,
        notes
      };
    }

    function sameItem(left, right) {
      const leftId = norm(left?.menuId || left?.itemId || "");
      const rightId = norm(right?.menuId || right?.itemId || "");
      const leftStation = normalizeStationForSend(left?.station);
      const rightStation = normalizeStationForSend(right?.station);
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
        out[idx].qty = (Number(out[idx].qty) || 0) + next.qty;
        if (!out[idx].menuId && next.menuId) out[idx].menuId = next.menuId;
        if (!out[idx].itemId && next.itemId) out[idx].itemId = next.itemId;
        if (!out[idx].name && next.name) out[idx].name = next.name;
        if (!Number.isFinite(Number(out[idx].price))) out[idx].price = next.price;
        if (!String(out[idx].category || "").trim() && next.category) out[idx].category = next.category;
        if (!String(out[idx].station || "").trim() && next.station) out[idx].station = next.station;
        if (!String(out[idx].notes || out[idx].note || "").trim() && next.notes) out[idx].notes = next.notes;
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

    async function getActiveOrderForTable(tableData) {
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
        const snap = await db.collection("orders").doc(orderId).get();
        if (!snap.exists) continue;
        const orderData = snap.data() || {};
        if (isOrderClosed(orderData)) continue;
        return { orderId, orderData };
      }
      return null;
    }

    async function ensureOrderForTable({ tableId, tableData, waiterId, tableLabel, note }) {
      const active = await getActiveOrderForTable(tableData);
      if (active?.orderId) {
        return active.orderId;
      }
      const orderRef = db.collection("orders").doc();
      const nowTs = firebase.firestore.FieldValue.serverTimestamp();
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

    async function appendItemsToDashboardOrder({ orderId, tableId, waiterId, tableLabel, note, items }) {
      const orderRef = db.collection("orders").doc(orderId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(orderRef);
        const orderData = snap.exists ? (snap.data() || {}) : {};
        if (isOrderClosed(orderData)) {
          throw new Error("Order is already closed/paid.");
        }

        const mergedItems = mergeOrderItems(orderData.items, items);
        const summary = summarizeItems(mergedItems);
        const nowTs = firebase.firestore.FieldValue.serverTimestamp();
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

    async function fallbackSaveScan({ tableId, items, note, meUid, error }) {
      const payload = {
        tableId: String(tableId || ""),
        items: normalizeItems(items),
        note: String(note || ""),
        source: "waiter_qr_fallback",
        waiterId: meUid || null,
        createdBy: meUid || null,
        errorCode: String(error?.code || ""),
        errorMessage: String(error?.message || ""),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("waiter_scans").add(payload);
    }
  
    async function sendOrder() {
      btnSend.disabled = true;
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
        const sendDb = firebase.firestore();
        const FieldValue = firebase.firestore.FieldValue;
  
        const tableId = tableSelect.value;
        const rawItems = scannedOrder?.items || scannedOrder?.order?.items || [];
        const scannedItems = rawItems.map(toPlainItem).filter((i) => i.name);
        if (!scannedItems.length) {
          msgEl.textContent = "❌ Няма items в сканираната поръчка.";
          return;
        }
        const menuMap = await buildMenuNameMap(sendDb);
        console.log("[scanner] menuMap size:", menuMap.size);
        for (const item of scannedItems) {
          item.station = resolveStationForWrite(item);
        }

        console.table(
          scannedItems.map((it) => ({
            name: it.name,
            qty: it.qty,
            price: it.price,
            menuId: it.menuId || "",
            category: it.category || "",
            station: it.station
          }))
        );
        const scannedNote = String(scannedOrder?.note || "");

        const tableRef = sendDb.collection("tables").doc(tableId);
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

        const orderId = await ensureOrderForTable({
          tableId,
          tableData,
          waiterId: meUid,
          tableLabel,
          note: scannedNote
        });

        const orderRef = sendDb.collection("orders").doc(orderId);
        for (const item of scannedItems) {
          await upsertByMenuIdOrName(sendDb, FieldValue, orderId, tableId, meUid, item, menuMap);
        }

        await appendItemsToDashboardOrder({
          orderId,
          tableId,
          waiterId: meUid,
          tableLabel,
          note: scannedNote,
          items: scannedItems
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

        console.log("[waiter] sent order", orderId, { items: scannedItems.length });

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
            await fallbackSaveScan({
              tableId: tableSelect?.value || "",
              items: scannedOrder?.items || [],
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
        btnSend.disabled = false;
      }
    }
  
    // events
    bindTap(btnStart, startScanner);
    bindTap(btnStop, stopScanner);
    bindTap(btnSend, sendOrder);
  
    btnBack?.addEventListener("click", () => history.back());
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
