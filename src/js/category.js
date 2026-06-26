// Category Page JavaScript

// Order data storage
let orderItems = [];
let orderTotal = 0;
let lastOrder = []; // In-memory view of the active Firestore bill (never the source of truth).
let activeBillOrders = [];
let activeBillTableId = "";
let activeBillToken = "";
let activeBillListeningToken = "";
let activeBillWasPaid = false;
let activeBillUnsubscribe = null;
let activeModalItem = null;
const CART_STORAGE_KEY = "guest_cart_v1";
const QR_STATE_STORAGE_KEY = "guest_qr_state_v1";
const ACTIVE_BILL_TOKEN_PREFIX = "activeBillToken_";
const PENDING_BILL_TOKEN_KEY = `${ACTIVE_BILL_TOKEN_PREFIX}pending`;
const QR_TTL_MS = 20 * 60 * 1000;
let qrExpiryTimer = null;
let activeCartId = "";
let activeCartUnsubscribe = null;
let acceptedCartHandled = false;
let cartCreateInFlight = null;

function getClientFirestore() {
    if (window.clientDb) return window.clientDb;
    if (window.firebase?.apps?.length) return window.firebase.firestore();
    throw new Error("Firebase не е зареден.");
}

function isValidPublicBillToken(value) {
    return /^[A-Za-z0-9_-]{32,160}$/.test(String(value || ""));
}

function generatePublicBillToken() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID().replace(/-/g, "") + window.crypto.randomUUID().replace(/-/g, "");
    }

    if (window.crypto?.getRandomValues) {
        const bytes = new Uint8Array(32);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    throw new Error("Secure random token generation is not available.");
}

function getPublicBillTokenStorageKey(tableId) {
    const id = String(tableId || "").trim();
    return id ? `${ACTIVE_BILL_TOKEN_PREFIX}${id}` : PENDING_BILL_TOKEN_KEY;
}

function getStoredPublicBillToken(tableId) {
    try {
        const token = localStorage.getItem(getPublicBillTokenStorageKey(tableId));
        return isValidPublicBillToken(token) ? token : "";
    } catch {
        return "";
    }
}

function persistPublicBillToken(token, tableId) {
    const resolvedToken = String(token || "").trim();
    if (!isValidPublicBillToken(resolvedToken)) throw new Error("Invalid public bill token.");

    try {
        localStorage.setItem(getPublicBillTokenStorageKey(tableId), resolvedToken);
        if (tableId) localStorage.removeItem(PENDING_BILL_TOKEN_KEY);
    } catch (error) {
        console.warn("[public-bill] token storage failed:", error);
    }
    activeBillToken = resolvedToken;
    return resolvedToken;
}

function getOrCreatePublicBillToken(tableId) {
    const storedToken = getStoredPublicBillToken(tableId);
    if (storedToken) return persistPublicBillToken(storedToken, tableId);

    const pendingToken = tableId ? getStoredPublicBillToken("") : "";
    if (pendingToken) return persistPublicBillToken(pendingToken, tableId);

    return persistPublicBillToken(generatePublicBillToken(), tableId);
}

function getClientTableContext() {
    const params = new URLSearchParams(window.location.search);
    const tableId = String(
        params.get("tableId") ||
        params.get("table") ||
        sessionStorage.getItem("activeTableId") ||
        (typeof currentTableId !== "undefined" ? currentTableId : "") ||
        (typeof selectedTableId !== "undefined" ? selectedTableId : "") ||
        ""
    ).trim();
    const explicitNumber = Number(params.get("tableNumber"));
    const idNumber = Number((tableId.match(/\d+/) || [])[0]);

    return {
        tableId,
        tableNumber: Number.isFinite(explicitNumber) && explicitNumber > 0
            ? explicitNumber
            : (Number.isFinite(idNumber) && idNumber > 0 ? idNumber : null)
    };
}

function setClientTablePointer(tableId, tableNumber = null) {
    const resolvedTableId = String(tableId || "").trim();
    if (!resolvedTableId) return;

    activeBillTableId = resolvedTableId;
    try {
        sessionStorage.setItem("activeTableId", resolvedTableId);
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set("tableId", resolvedTableId);
    if (tableNumber != null && Number.isFinite(Number(tableNumber))) {
        url.searchParams.set("tableNumber", String(tableNumber));
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function toFirestoreCartItems(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => {
        const qty = getQrQty(item?.qty ?? item?.quantity);
        const price = Number(item?.price || 0);
        const menuId = getStableMenuId(item) || String(item?.id || `item_${index + 1}`);
        return {
            id: String(item?.id || menuId),
            menuId,
            itemId: String(item?.itemId || menuId),
            name: String(item?.name || item?.title || `Item ${index + 1}`),
            price: Number.isFinite(price) ? price : 0,
            qty,
            quantity: qty,
            category: String(item?.category || item?.categoryKey || item?.type || ""),
            station: String(item?.station || item?.targetStation || ""),
            qrCode: String(item?.qrCode || item?.shortCode || item?.code || item?.qr || "")
        };
    });
}

function setActiveCartPointer(cartId) {
    activeCartId = String(cartId || "").trim();
    const url = new URL(window.location.href);
    if (activeCartId) url.searchParams.set("cartId", activeCartId);
    else url.searchParams.delete("cartId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function stopActiveCartListener() {
    if (typeof activeCartUnsubscribe === "function") activeCartUnsubscribe();
    activeCartUnsubscribe = null;
}

function stopActiveBillListener() {
    if (typeof activeBillUnsubscribe === "function") activeBillUnsubscribe();
    activeBillUnsubscribe = null;
    activeBillListeningToken = "";
}

function isActiveUnpaidBill(order) {
    const status = String(order?.status || "").trim().toLowerCase();
    const paymentStatus = String(order?.paymentStatus || "").trim().toLowerCase();
    const orderStatus = String(order?.orderStatus || "").trim().toLowerCase();
    return (
        order?.paid !== true &&
        paymentStatus !== "paid" &&
        !["paid", "cancelled", "closed"].includes(status) &&
        orderStatus !== "closed"
    );
}

function updateActiveBillMemory(orders) {
    activeBillOrders = Array.isArray(orders) ? orders : [];
    const allItems = activeBillOrders.flatMap((order) => Array.isArray(order.items) ? order.items : []);
    const mergedItems = window.CartOrderFlow?.mergeItems
        ? window.CartOrderFlow.mergeItems([], allItems)
        : allItems;

    lastOrder = mergedItems.map((item) => {
        const quantity = Number(item.qty ?? item.quantity) || 1;
        const price = Number(item.price) || 0;
        return {
            ...item,
            qty: quantity,
            quantity,
            price,
            totalPrice: Math.round(price * quantity * 100) / 100
        };
    });
}

function getActiveOrderItemCount() {
    return lastOrder.reduce((sum, item) => {
        return sum + (Number(item.qty ?? item.quantity) || 0);
    }, 0);
}

function updateActiveOrderBadge() {
    const count = getActiveOrderItemCount();
    const badge = document.getElementById("activeOrderCount");
    const button = document.getElementById("activeOrderButton");

    if (badge) {
        badge.textContent = String(count);
        badge.dataset.count = String(count);
        badge.setAttribute("aria-label", `${count} поръчани артикула`);
    }
    if (button) {
        button.title = count > 0 ? `Активна сметка (${count})` : "Няма активна сметка за тази маса";
        button.setAttribute("aria-label", count > 0
            ? `Отвори активната сметка, ${count} артикула`
            : "Отвори активната сметка");
    }
}

function listenActiveOrderForCustomerTable(tableId) {
    const resolvedTableId = String(tableId || "").trim();
    if (!resolvedTableId) {
        activeBillWasPaid = false;
        resetLastOrderReceiptUi();
        return;
    }

    const publicBillToken = getStoredPublicBillToken(resolvedTableId);
    if (!publicBillToken) {
        stopActiveBillListener();
        activeBillTableId = resolvedTableId;
        activeBillToken = "";
        activeBillListeningToken = "";
        activeBillWasPaid = false;
        resetLastOrderReceiptUi();
        return;
    }

    if (
        activeBillTableId === resolvedTableId &&
        activeBillListeningToken === publicBillToken &&
        activeBillUnsubscribe
    ) return;

    stopActiveBillListener();
    setClientTablePointer(resolvedTableId);
    activeBillToken = publicBillToken;
    activeBillListeningToken = publicBillToken;

    const db = getClientFirestore();
    activeBillUnsubscribe = db.collection("public_bills")
        .doc(publicBillToken)
        .onSnapshot((snap) => {
            if (!snap.exists) {
                activeBillWasPaid = false;
                resetLastOrderReceiptUi();
                return;
            }

            const bill = snap.data() || {};
            const status = String(bill.status || "").toLowerCase();
            const paymentStatus = String(bill.paymentStatus || "").toLowerCase();
            if (bill.paid === true || status === "paid" || paymentStatus === "paid") {
                activeBillWasPaid = true;
                resetLastOrderReceiptUi();
                return;
            }

            activeBillWasPaid = false;
            const activeBills = [{
                id: String(bill.orderId || publicBillToken),
                ...bill
            }].filter(isActiveUnpaidBill);
            updateActiveBillMemory(activeBills);
            updateActiveOrderBadge();

            if (!activeBills.length) {
                resetLastOrderReceiptUi();
                return;
            }

            const receiptModal = document.getElementById("activeOrderModal");
            if (receiptModal?.classList.contains("show") || receiptModal?.style.display === "block") {
                renderActiveBillReceipt();
            }
            console.log("[active-bill] Firestore update", {
                tableId: resolvedTableId,
                orderId: bill.orderId || "",
                itemCount: lastOrder.length
            });
        }, (error) => {
            console.error("[active-bill] listener failed:", error);
            showOrderMessage("Активната сметка не можа да се зареди.");
        });
}

function listenActiveBillForTable(tableId) {
    return listenActiveOrderForCustomerTable(tableId);
}

function getQrSafeId(value) {
    return encodeURIComponent(String(value || "").trim());
}

function getQrQty(value) {
    const qty = Number(value ?? 1);
    return Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1;
}

function makeShortQrCode(index, prefix = "") {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    const n = Math.max(1, Number(index || 1));
    return `${prefix}${n.toString(alphabet.length)}`;
}

function getShortQrCodePrefix(category) {
    const key = String(category || "").trim().toLowerCase();
    const map = {
        drinks: "d",
        drink: "d",
        beverages: "d",
        beverage: "d",
        food: "f",
        dessert: "s",
        desserts: "s",
        burger: "b",
        burgers: "b",
        pizza: "p",
        pizzas: "p",
        salad: "l",
        salads: "l"
    };
    if (map[key]) return map[key];
    const fallback = key.replace(/[^a-z0-9]/g, "");
    return fallback ? fallback.slice(0, 1) : "";
}

function getRuntimeShortQrCode(item, index) {
    const existing = String(item?.qrCode || item?.shortCode || item?.code || item?.qr || "").trim();
    if (existing) return existing;
    const prefix = getShortQrCodePrefix(item?.category || item?.categoryKey || item?.categorySlug || item?.type || "");
    return makeShortQrCode(index + 1, prefix);
}

function normalizeQrName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function getStableMenuId(item) {
    return String(
        item?.menuId ||
        item?.itemId ||
        item?.id ||
        item?.docId ||
        item?.firestoreId ||
        ""
    ).trim();
}

function resolveDishImageUrl(path) {
    let p = String(path || "").trim();
    if (!p) return "";
    if (/^data:image\//i.test(p)) return p;
    if (/^(https?:)?\/\//i.test(p)) return p;

    p = p.replace(/\\/g, "/");
    const lower = p.toLowerCase();

    if (lower.startsWith("../images/")) return p;
    if (lower.startsWith("../image/")) return `../images/${p.slice("../image/".length)}`;
    if (lower.startsWith("./images/")) return `..${p.slice(1)}`;
    if (lower.startsWith("./image/")) return `../images/${p.slice("./image/".length)}`;
    if (lower.startsWith("images/")) return `../${p}`;
    if (lower.startsWith("image/")) return `../images/${p.slice("image/".length)}`;

    return `../images/${p}`;
}

function getDishNumber(item, keys) {
    for (const key of keys) {
        const value = item?.[key] ?? item?.nutrition?.[key];
        const number = Number(value);
        if (Number.isFinite(number)) return number;
    }
    return 0;
}

function buildMenuMetaFromItem(item) {
    const menuId = getStableMenuId(item);
    const qrCode = String(item?.qrCode || item?.shortCode || item?.code || item?.qr || "").trim();

    return {
        id: menuId,
        menuId,
        itemId: menuId,
        category: item?.category || item?.categoryKey || item?.categorySlug || item?.categoryId || item?.type || "",
        station: item?.station || item?.targetStation || item?.department || "",
        qrCode,
        shortCode: item?.shortCode || qrCode,
        code: item?.code || qrCode,
        qr: item?.qr || qrCode,
        item
    };
}

function getDisplayItem(item) {
    if (typeof window.getTranslatedItem === "function") {
        return window.getTranslatedItem(item);
    }

    return {
        ...item,
        displayName: item?.name || item?.title || "Item",
        displayDescription: item?.description || item?.desc || item?.details || ""
    };
}

function getDishPriceValue(item, fallback) {
    const value = Number(item?.price ?? item?.cost ?? item?.priceValue ?? fallback ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function formatDishPrice(value) {
    const price = Number(value);
    return Number.isFinite(price) && price > 0 ? `${price.toFixed(2)} \u20ac` : "";
}

function buildMenuLookup(menuList) {
    const byId = new Map();
    const byName = new Map();
    const byQrCode = new Map();

    (Array.isArray(menuList) ? menuList : []).forEach((item) => {
        if (!item) return;

        const id = getStableMenuId(item);
        const name = normalizeQrName(item.name || item.title || "");
        const qrCode = String(item.qrCode || item.shortCode || item.code || item.qr || "").trim();

        const normalized = {
            ...item,
            id,
            menuId: id,
            itemId: id,
            name: String(item.name || item.title || "").trim(),
            price: Number(item.price ?? item.cost ?? 0) || 0,
            qrCode,
            shortCode: String(item.shortCode || item.qrCode || item.code || item.qr || "").trim(),
            code: String(item.code || item.qrCode || item.shortCode || item.qr || "").trim(),
            qr: String(item.qr || item.qrCode || item.shortCode || item.code || "").trim()
        };

        if (id) byId.set(id, normalized);
        if (name) byName.set(name, normalized);
        if (qrCode) byQrCode.set(qrCode.toLowerCase(), normalized);
    });

    return { byId, byName, byQrCode };
}

function resolveCartItemFromMenu(raw, menuLookup) {
    if (!raw) return raw;

    const id = getStableMenuId(raw);
    const nameKey = normalizeQrName(raw.name || raw.title || "");
    const qrKey = String(raw.qrCode || raw.shortCode || raw.code || raw.qr || "").trim().toLowerCase();

    const found =
        (id && menuLookup?.byId?.get(id)) ||
        (qrKey && menuLookup?.byQrCode?.get(qrKey)) ||
        (nameKey && menuLookup?.byName?.get(nameKey)) ||
        null;

    if (!found) return raw;

    const menuId = String(raw.menuId || raw.itemId || raw.id || found.id || "").trim();
    const qrCode = String(raw.qrCode || raw.shortCode || raw.code || raw.qr || found.qrCode || found.shortCode || found.code || found.qr || "").trim();

    return {
        ...raw,
        id: raw.id || menuId,
        menuId,
        itemId: raw.itemId || menuId,
        name: String(raw.name || raw.title || found.name || found.title || "").trim(),
        price: Number(raw.price ?? found.price ?? found.cost ?? 0) || 0,
        category: String(raw.category || found.category || found.categoryKey || found.categorySlug || found.type || "").trim(),
        station: String(raw.station || found.station || found.department || "").trim(),
        qrCode,
        shortCode: String(raw.shortCode || raw.qrCode || raw.code || raw.qr || found.shortCode || found.qrCode || found.code || found.qr || "").trim(),
        code: String(raw.code || raw.qrCode || raw.shortCode || raw.qr || found.code || found.qrCode || found.shortCode || found.qr || "").trim(),
        qr: String(raw.qr || raw.qrCode || raw.shortCode || raw.code || found.qr || found.qrCode || found.shortCode || found.code || "").trim()
    };
}

function getQrMenuList() {
    if (Array.isArray(window.menusCache)) return window.menusCache;
    if (Array.isArray(window.menuItems)) return window.menuItems;
    if (Array.isArray(window.MENU)) return window.MENU;
    return [];
}

function encodeCompactOrderForQr(order, menuList = []) {
    const items = Array.isArray(order.items || order.cartItems || order)
        ? (order.items || order.cartItems || order)
        : [];
    const menuLookup = buildMenuLookup(menuList);

    const merged = new Map();
    const missingIds = [];

    items.forEach((raw) => {
        if (!raw) return;

        const item = resolveCartItemFromMenu(raw, menuLookup);
        const menuId = String(item.menuId || item.itemId || item.id || "").trim();
        if (!menuId) {
            missingIds.push(raw.name || raw.title || "Unknown item");
            return;
        }

        const qty = getQrQty(item.qty ?? item.quantity ?? item.count ?? item.q ?? 1);

        if (!merged.has(menuId)) {
            merged.set(menuId, qty);
        } else {
            merged.set(menuId, merged.get(menuId) + qty);
        }
    });

    if (missingIds.length) {
        if (missingIds.length === 1) {
            throw new Error("Артикулът няма menuId и не може да се генерира кратък QR.");
        }

        throw new Error(
            "Някои артикули нямат menuId и QR ще стане прекалено голям: " +
            missingIds.join(", ")
        );
    }

    if (!merged.size) {
        throw new Error("Няма артикули за QR.");
    }

    const encodedItems = Array.from(merged.entries())
        .map(([menuId, qty]) => `${getQrSafeId(menuId)}:${qty}`)
        .join(",");

    const parts = ["R1"];

    const tableId = String(order.tableId || "").trim();
    if (tableId) {
        parts.push(`t=${getQrSafeId(tableId)}`);
    }

    parts.push(`i=${encodedItems}`);

    const note = String(order.note || order.comment || "").trim();
    if (note) {
        parts.push(`n=${getQrSafeId(note).slice(0, 120)}`);
    }

    return parts.join("|");
}

function encodeResolvedCompactOrderForQr(order, menuList = []) {
    const items = Array.isArray(order.items || order.cartItems || order)
        ? (order.items || order.cartItems || order)
        : [];
    const menuLookup = buildMenuLookup(menuList);
    const merged = new Map();
    const missingIds = [];

    items.forEach((raw) => {
        if (!raw) return;

        const item = resolveCartItemFromMenu(raw, menuLookup);
        const menuId = getStableMenuId(item);
        if (!menuId) {
            missingIds.push(raw.name || raw.title || "Unknown item");
            return;
        }

        const qty = getQrQty(item.qty ?? item.quantity ?? item.count ?? item.q ?? 1);
        merged.set(menuId, (merged.get(menuId) || 0) + qty);
    });

    if (missingIds.length) {
        throw new Error(
            "Артикулът няма menuId и не е намерен в menus по име: " +
            missingIds.join(", ")
        );
    }

    if (!merged.size) {
        throw new Error("Няма артикули за QR.");
    }

    const encodedItems = Array.from(merged.entries())
        .map(([menuId, qty]) => `${getQrSafeId(menuId)}:${qty}`)
        .join(",");
    const parts = ["R1"];

    const tableId = String(order.tableId || "").trim();
    if (tableId) {
        parts.push(`t=${getQrSafeId(tableId)}`);
    }

    parts.push(`i=${encodedItems}`);

    const note = String(order.note || order.comment || "").trim();
    if (note) {
        parts.push(`n=${getQrSafeId(note).slice(0, 120)}`);
    }

    return parts.join("|");
}

function encodeUltraCompactOrderForQr(order, menuList = []) {
    const items = Array.isArray(order.items || order.cartItems || order)
        ? (order.items || order.cartItems || order)
        : [];

    const menuById = new Map();
    const menuByName = new Map();
    const hasMenuList = Array.isArray(menuList) && menuList.length > 0;

    (Array.isArray(menuList) ? menuList : []).forEach((m, index) => {
        if (!m) return;

        const id = String(m.id || m.menuId || m.itemId || "").trim();
        const name = String(m.name || m.title || "").trim().toLowerCase();
        const qrCode = String(m.qrCode || m.shortCode || m.code || m.qr || "").trim();

        const normalized = {
            ...m,
            id,
            qrCode
        };

        if (id) menuById.set(id, normalized);
        if (name) menuByName.set(name, normalized);
    });

    const merged = new Map();
    const missingCodes = [];

    items.forEach((raw) => {
        if (!raw) return;

        const menuId = String(raw.menuId || raw.itemId || raw.id || "").trim();
        const name = String(raw.name || raw.title || "").trim().toLowerCase();

        const menu = menuById.get(menuId) || menuByName.get(name);
        const codeSource = menu || (!hasMenuList ? raw : null);
        const code = String(codeSource?.qrCode || codeSource?.shortCode || codeSource?.code || codeSource?.qr || "").trim();

        console.log("[QR-ITEM-CODE]", {
            name: raw.name || raw.title || menu?.name || menu?.title || "",
            menuId: menuId || menu?.id || raw.id || "",
            qrCode: code
        });

        if (!code) {
            missingCodes.push(raw.name || raw.title || menuId || "Unknown item");
            return;
        }

        const qty = getQrQty(raw.qty ?? raw.quantity ?? raw.count ?? raw.q ?? 1);

        if (!merged.has(code)) {
            merged.set(code, qty);
        } else {
            merged.set(code, merged.get(code) + qty);
        }
    });

    if (missingCodes.length) {
        throw new Error("Някои артикули нямат short QR код: " + missingCodes.join(", "));
    }

    if (!merged.size) {
        throw new Error("Няма артикули за QR.");
    }

    const encodedItems = Array.from(merged.entries())
        .map(([code, qty]) => `${encodeURIComponent(code)}:${qty}`)
        .join(",");

    const parts = ["R2"];

    const tableId = String(order.tableId || "").trim();
    if (tableId) {
        parts.push(`t=${encodeURIComponent(tableId)}`);
    }

    parts.push(`i=${encodedItems}`);

    const note = String(order.note || order.comment || "").trim();
    if (note) {
        parts.push(`n=${encodeURIComponent(note).slice(0, 80)}`);
    }

    return parts.join("|");
}

function encodeUltraCompactResolvedOrderForQr(order, menuList = []) {
    const items = Array.isArray(order.items || order.cartItems || order)
        ? (order.items || order.cartItems || order)
        : [];
    const menuLookup = buildMenuLookup(menuList);
    const hasMenuList = Array.isArray(menuList) && menuList.length > 0;

    const merged = new Map();
    const missingCodes = [];

    items.forEach((raw) => {
        if (!raw) return;

        const menuId = getStableMenuId(raw);
        const nameKey = normalizeQrName(raw.name || raw.title || "");
        const qrKey = String(raw.qrCode || raw.shortCode || raw.code || raw.qr || "").trim().toLowerCase();
        const menu =
            (menuId && menuLookup.byId.get(menuId)) ||
            (qrKey && menuLookup.byQrCode.get(qrKey)) ||
            (nameKey && menuLookup.byName.get(nameKey)) ||
            null;
        const item = menu ? resolveCartItemFromMenu(raw, menuLookup) : raw;
        const codeSource = menu || (!hasMenuList ? item : null);
        const code = String(codeSource?.qrCode || codeSource?.shortCode || codeSource?.code || codeSource?.qr || "").trim();

        console.log("[QR-ITEM-CODE]", {
            name: item.name || item.title || menu?.name || menu?.title || "",
            menuId: getStableMenuId(item) || menu?.id || "",
            qrCode: code
        });

        if (!code) {
            missingCodes.push(item.name || item.title || getStableMenuId(item) || "Unknown item");
            return;
        }

        const qty = getQrQty(item.qty ?? item.quantity ?? item.count ?? item.q ?? 1);
        merged.set(code, (merged.get(code) || 0) + qty);
    });

    if (missingCodes.length) {
        throw new Error("Missing qrCode for " + missingCodes.join(", "));
    }

    if (!merged.size) {
        throw new Error("Няма артикули за QR.");
    }

    const encodedItems = Array.from(merged.entries())
        .map(([code, qty]) => `${encodeURIComponent(code)}:${qty}`)
        .join(",");

    const parts = ["R2"];

    const tableId = String(order.tableId || "").trim();
    if (tableId) {
        parts.push(`t=${encodeURIComponent(tableId)}`);
    }

    parts.push(`i=${encodedItems}`);

    const note = String(order.note || order.comment || "").trim();
    if (note) {
        parts.push(`n=${encodeURIComponent(note).slice(0, 80)}`);
    }

    return parts.join("|");
}

function encodeBestCompactOrderForQr(order, menuList = []) {
    try {
        const r2 = encodeUltraCompactResolvedOrderForQr(order, menuList);
        if (r2 && r2.startsWith("R2|")) return r2;
    } catch (err) {
        console.warn("[QR] R2 failed, fallback to R1:", err);
    }

    return encodeResolvedCompactOrderForQr(order, menuList);
}

// Show nutrition information modal
function showNutritionInfo(name, description, calories, carbs, protein, fat, weight, price, priceValue, imageUrl, menuMeta = {}) {
    const modal = document.getElementById('nutritionModal');
    const title = document.getElementById('nutrition-title');
    const desc = document.getElementById('nutrition-description');
    const imageEl = document.getElementById('nutrition-image');
    const caloriesEl = document.getElementById('nutrition-calories');
    const carbsEl = document.getElementById('nutrition-carbs');
    const proteinEl = document.getElementById('nutrition-protein');
    const fatEl = document.getElementById('nutrition-fat');
    const weightEl = document.getElementById('nutrition-weight');
    const priceEl = document.getElementById('nutrition-price');
    const addBtn = document.getElementById('nutrition-add-btn');

    if (!modal || !title || !desc || !imageEl || !caloriesEl || !carbsEl || !proteinEl || !fatEl || !weightEl || !priceEl || !addBtn) {
        console.warn("Nutrition modal markup is missing.");
        return;
    }

    function safeDisplayText(value, fallback) {
        if (typeof window.isBadTranslationResult === 'function' && window.isBadTranslationResult(value)) {
            return fallback || '';
        }

        return value || fallback || '';
    }
    
    const lang = localStorage.getItem('language') || 'en';
    const menuItem = menuMeta.item || {
        ...menuMeta,
        name,
        description,
        calories,
        carbs,
        protein,
        fat,
        weight,
        price: priceValue,
        image: imageUrl
    };
    activeModalItem = menuItem;
    window.activeModalItem = activeModalItem;
    const translatedItem = typeof window.getTranslatedItem === 'function'
        ? window.getTranslatedItem(menuItem)
        : { displayName: name, displayDescription: description };
    const translationKey = String(menuMeta.menuId || menuMeta.itemId || menuMeta.id || name || "").trim();

    modal.dataset.translationKey = translationKey;
    const displayName = safeDisplayText(translatedItem.displayName, name);
    const displayDescription = safeDisplayText(translatedItem.displayDescription, description);
    title.textContent = displayName;
    desc.textContent = displayDescription;

    if (imageUrl) {
        imageEl.src = imageUrl;
        imageEl.alt = displayName;
        imageEl.style.display = 'block';
    } else {
        imageEl.style.display = 'none';
    }
    caloriesEl.textContent = calories;
    carbsEl.textContent = carbs;
    proteinEl.textContent = protein;
    fatEl.textContent = fat;
    
    // Set weight and price
    if (weight) {
        const weightLabel = lang === 'bg' ? 'Тегло' : 'Weight';
        // Ensure weight ends with "г." (gram symbol with period)
        let displayWeight = weight.trim();
        if (displayWeight && !displayWeight.endsWith('г.')) {
            // If it ends with just "г", add period; otherwise append " г."
            if (displayWeight.endsWith('г')) {
                displayWeight = displayWeight + '.';
            } else if (!displayWeight.includes('г')) {
                displayWeight = displayWeight + ' г.';
            }
        }
        weightEl.textContent = `${weightLabel}: ${displayWeight}`;
        weightEl.style.display = 'block';
    } else {
        weightEl.style.display = 'none';
    }
    // Format price to always show 2 decimal places
    if (price && price.includes('€')) {
        const priceNum = parseFloat(price.replace(' €', '').replace(',', '.'));
        if (!isNaN(priceNum)) {
            priceEl.textContent = priceNum.toFixed(2) + ' €';
        } else {
            priceEl.textContent = price;
        }
    } else {
        priceEl.textContent = price;
    }
    
    // Update add button
    bindModalAddToCart();
    addBtn.onclick = null;
    
    // Apply translations
    updateNutritionTranslations();
    bindDishModalClose();
    
    // Show modal
    modal.hidden = false;
    modal.style.display = 'flex';
    modal.classList.add('active', 'show', 'open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    updateNutritionModalTranslationAsync(menuItem, translationKey);
}

async function updateNutritionModalTranslationAsync(item, translationKey) {
    const lang = localStorage.getItem('language') || localStorage.getItem('lang') || window.currentLang || 'en';
    if (lang !== 'en') return;
    if (!item || typeof window.getTranslatedItemAsync !== 'function') return;

    const modal = document.getElementById('nutritionModal');
    if (!modal || modal.hidden || modal.getAttribute('aria-hidden') === 'true') return;
    if (translationKey && modal.dataset.translationKey !== translationKey) return;

    const translated = await window.getTranslatedItemAsync(item);
    const stillEnglish = (localStorage.getItem('language') || localStorage.getItem('lang') || window.currentLang || 'en') === 'en';
    if (!stillEnglish) return;
    if (!modal || modal.hidden || modal.getAttribute('aria-hidden') === 'true') return;
    if (translationKey && modal.dataset.translationKey !== translationKey) return;
    if (window.activeModalItem && window.activeModalItem !== item) return;

    const title = document.getElementById('nutrition-title');
    const desc = document.getElementById('nutrition-description');
    const imageEl = document.getElementById('nutrition-image');

    if (title) title.textContent = translated.displayName || '';
    if (desc) desc.textContent = translated.displayDescription || '';
    if (imageEl) imageEl.alt = translated.displayName || '';

    console.log('[MODAL TRANSLATED ASYNC]', translated.displayName, translated.displayDescription);
}

// Close nutrition modal
function closeNutritionModal() {
    const modal = document.getElementById('nutritionModal');
    if (!modal) return;

    modal.classList.remove('active', 'show', 'open');
    modal.hidden = true;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function addToCart(item) {
    if (!item) return;

    const displayItem = getDisplayItem(item);
    const dishName = displayItem.displayName || "Item";
    const priceValue = getDishPriceValue(item);
    addToOrder(dishName, priceValue, buildMenuMetaFromItem(item));
}

function getOrderSourceItem(orderItem) {
    const menuId = String(orderItem?.menuId || orderItem?.itemId || orderItem?.id || "").trim();
    const nameKey = normalizeQrName(orderItem?.name || orderItem?.title || "");
    const menuList = getQrMenuList();

    return (Array.isArray(menuList) ? menuList : []).find((item) => {
        const itemId = getStableMenuId(item);
        const itemName = normalizeQrName(item?.name || item?.title || "");
        return (menuId && itemId === menuId) || (nameKey && itemName === nameKey);
    }) || null;
}

function getOrderItemDisplayName(orderItem) {
    const sourceItem = getOrderSourceItem(orderItem);
    if (sourceItem) return getDisplayItem(sourceItem).displayName || orderItem?.name || "Item";
    const lang = localStorage.getItem("language") || localStorage.getItem("lang") || window.currentLang || "en";
    if (lang !== "en") return orderItem?.name || orderItem?.title || "Item";
    if (orderItem?.displayName) return orderItem.displayName;
    return getDisplayItem(orderItem).displayName || orderItem?.name || "Item";
}

function openDishModal(item) {
    if (!item) return;

    activeModalItem = item;
    window.activeModalItem = activeModalItem;
    const displayItem = getDisplayItem(item);
    const priceValue = getDishPriceValue(item);

    showNutritionInfo(
        displayItem.displayName || "Item",
        displayItem.displayDescription || "",
        getDishNumber(item, ["calories", "kcal"]),
        getDishNumber(item, ["carbs", "carbohydrates"]),
        getDishNumber(item, ["protein", "proteins"]),
        getDishNumber(item, ["fat", "fats"]),
        item.weight || item.grams || "",
        formatDishPrice(priceValue),
        priceValue,
        resolveDishImageUrl(item.imageUrl || item.image || item.img || item.photo || ""),
        buildMenuMetaFromItem(item)
    );
}

async function updateOpenDishModalLanguage() {
    const modal =
        document.getElementById('nutritionModal') ||
        document.getElementById('dishModal') ||
        document.getElementById('itemModal');

    if (!modal || modal.hidden || modal.getAttribute('aria-hidden') === 'true') return;
    if (!activeModalItem && window.activeModalItem) activeModalItem = window.activeModalItem;
    if (!activeModalItem) return;

    const requestedLang = localStorage.getItem('language') || localStorage.getItem('lang') || window.currentLang || 'en';
    const displayItem = typeof window.getTranslatedItemAsync === 'function'
        ? await window.getTranslatedItemAsync(activeModalItem)
        : getDisplayItem(activeModalItem);
    const currentLang = localStorage.getItem('language') || localStorage.getItem('lang') || window.currentLang || 'en';
    if (currentLang !== requestedLang) return;
    const stillCurrentItem = !window.activeModalItem || window.activeModalItem === activeModalItem;
    if (!stillCurrentItem) return;
    const titleEl =
        modal.querySelector('[data-modal-title]') ||
        modal.querySelector('.modal-title') ||
        modal.querySelector('h2') ||
        modal.querySelector('h3');
    const descEl =
        modal.querySelector('[data-modal-description]') ||
        modal.querySelector('.modal-description') ||
        modal.querySelector('.description') ||
        document.getElementById('nutrition-description');
    const img = modal.querySelector('[data-modal-image], .modal-image, img');

    if (titleEl) titleEl.textContent = displayItem.displayName || 'Item';
    if (descEl) descEl.textContent = displayItem.displayDescription || '';
    if (img) img.alt = displayItem.displayName || 'Item';
}

function bindModalAddToCart() {
    const modal = document.getElementById('nutritionModal');
    if (!modal) return;

    const btn =
        modal.querySelector('[data-modal-add-to-cart]') ||
        modal.querySelector('[data-add-to-cart-modal]') ||
        modal.querySelector('.modal-add-to-cart') ||
        document.getElementById('nutrition-add-btn') ||
        modal.querySelector('.add-to-cart');

    if (!btn || btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!activeModalItem) return;
        addToCart(activeModalItem);
        closeNutritionModal();
    });
}

function bindDishModalClose() {
    if (window.__DISH_MODAL_CLOSE_BOUND__) return;
    window.__DISH_MODAL_CLOSE_BOUND__ = true;

    const modal = document.getElementById('nutritionModal');
    if (!modal) return;

    modal.querySelectorAll('[data-close-modal], .modal-close, .close, .close-btn, .nutrition-close').forEach((btn) => {
        btn.addEventListener('click', closeNutritionModal);
    });

    modal.addEventListener('click', function(event) {
        if (event.target === modal || event.target.classList.contains('modal-overlay')) {
            closeNutritionModal();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeNutritionModal();
    });
}

if (typeof window !== "undefined") {
    window.activeModalItem = activeModalItem;
    window.addToCart = addToCart;
    window.openDishModal = openDishModal;
    window.openNutritionModal = openDishModal;
    window.showNutritionInfo = showNutritionInfo;
    window.closeNutritionModal = closeNutritionModal;
    window.closeDishModal = closeNutritionModal;
    window.updateOpenDishModalLanguage = updateOpenDishModalLanguage;
    window.updateNutritionModalTranslationAsync = updateNutritionModalTranslationAsync;
    window.updateNutritionTranslations = updateNutritionTranslations;
    window.bindDishModalClose = bindDishModalClose;
    window.bindModalAddToCart = bindModalAddToCart;
}

// Update nutrition modal translations
function updateNutritionTranslations() {
    // Use the global translations from script.js if available
    if (typeof translations !== 'undefined' && typeof currentLang !== 'undefined') {
        const t = translations[currentLang];
        if (t && t.nutrition) {
            // Update labels with data-translate attribute
            document.querySelectorAll('[data-translate^="nutrition."]').forEach(element => {
                const key = element.getAttribute('data-translate');
                const keys = key.split('.');
                let value = t;
                for (let k of keys) {
                    value = value[k];
                }
                if (value) {
                    element.textContent = value;
                }
            });
        }
    } else {
        // Fallback translations
        const lang = localStorage.getItem('language') || 'en';
        const translations = {
            en: {
                calories: 'Calories',
                carbs: 'Carbs (g)',
                protein: 'Protein (g)',
                fat: 'Fat (g)',
                addToCart: 'Add to Cart'
            },
            bg: {
                calories: 'Калории',
                carbs: 'Въглехидрати (г)',
                protein: 'Протеини (г)',
                fat: 'Мазнини (г)',
                addToCart: 'Добави в количката'
            }
        };
        
        const t = translations[lang] || translations.en;
        document.querySelectorAll('[data-translate^="nutrition."]').forEach(element => {
            const key = element.getAttribute('data-translate');
            const keys = key.split('.');
            let value = t;
            for (let k of keys) {
                value = value[k];
            }
            if (value) {
                element.textContent = value;
            }
        });
    }
}

// Add item to order
function addToOrder(dishName, price, menuMeta = {}) {
    const menuId = String(menuMeta.menuId || menuMeta.itemId || menuMeta.id || "").trim();
    const category = String(menuMeta.category || "").trim();
    const station = String(menuMeta.station || "").trim();
    const qrCode = String(menuMeta.qrCode || menuMeta.shortCode || menuMeta.code || menuMeta.qr || "").trim();
    const sourceItem = menuMeta.item || null;
    const sourceDisplayItem = sourceItem ? getDisplayItem(sourceItem) : null;
    const sourceName = String(sourceItem?.name || sourceItem?.title || menuMeta.name || dishName || "Item").trim();
    const displayName = String(sourceDisplayItem?.displayName || dishName || sourceName || "Item").trim();

    // Check if item already exists in order
    const existingItem = orderItems.find((item) => {
        if (menuId) {
            const existingMenuId = String(item.menuId || item.itemId || "").trim();
            return existingMenuId === menuId || (!existingMenuId && (item.name === sourceName || item.name === dishName));
        }
        return item.name === sourceName || item.name === dishName;
    });
    
    if (existingItem) {
        existingItem.quantity += 1;
        existingItem.qty = existingItem.quantity;
        existingItem.name = sourceName;
        existingItem.displayName = displayName;
        existingItem.nameEn = displayName;
        if (menuId) {
            existingItem.id = menuId;
            existingItem.menuId = menuId;
            existingItem.itemId = menuId;
        }
        if (category) existingItem.category = category;
        if (station) existingItem.station = station;
        if (qrCode) {
            existingItem.qrCode = qrCode;
            existingItem.shortCode = qrCode;
            existingItem.code = qrCode;
            existingItem.qr = qrCode;
        }
        existingItem.totalPrice = existingItem.price * existingItem.quantity;
    } else {
        orderItems.push({
            id: menuId,
            menuId,
            itemId: menuId,
            name: sourceName,
            displayName,
            nameEn: displayName,
            price: price,
            category,
            station,
            qrCode,
            shortCode: qrCode,
            code: qrCode,
            qr: qrCode,
            qty: 1,
            quantity: 1,
            totalPrice: price
        });
    }
    
    updateOrderTotal();
    updateOrderCount();
    clearQrState();
    saveOrderToStorage();
    
    // Show success message
    const lang = localStorage.getItem('language') || 'en';
    const addedMsg = lang === 'bg' ? `${dishName} е добавен в поръчката!` : `${dishName} added to order!`;
    showOrderMessage(addedMsg);
}

// Remove item from order
function removeFromOrder(dishName) {
    orderItems = orderItems.filter(item => item.name !== dishName);
    updateOrderTotal();
    updateOrderCount();
    clearQrState();
    saveOrderToStorage();
    
    // Refresh order display if modal is open
    const orderModal = document.getElementById('orderSummaryModal');
    if (orderModal && orderModal.style.display === 'block') {
        displayOrderItems();
    }
}

// Update quantity of item in order
function updateItemQuantity(dishName, newQuantity) {
    const item = orderItems.find(item => item.name === dishName);
    if (item) {
        if (newQuantity <= 0) {
            removeFromOrder(dishName);
        } else {
            item.quantity = newQuantity;
            item.qty = newQuantity;
            item.totalPrice = item.price * item.quantity;
            updateOrderTotal();
            updateOrderCount();
            clearQrState();
            saveOrderToStorage();
            
            // Refresh order display if modal is open
            const orderModal = document.getElementById('orderSummaryModal');
            if (orderModal && orderModal.style.display === 'block') {
                displayOrderItems();
            }
        }
    }
}

// Calculate total order price
function updateOrderTotal() {
    orderTotal = orderItems.reduce((total, item) => total + item.totalPrice, 0);
}

// Update order count in button
function updateOrderCount() {
    const totalItems = orderItems.reduce((total, item) => total + item.quantity, 0);
    const orderCountElements = document.getElementsByClassName('order-badge');
    Array.from(orderCountElements).forEach(el => {
        el.textContent = totalItems;
        // Hide badge when count is 0
        if (totalItems === 0) {
            el.style.display = 'none';
        } else {
            el.style.display = 'flex';
        }
    });
}

// Toggle order summary modal
function toggleOrderSummary() {
    const modal = document.getElementById('orderSummaryModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'block';
        displayOrderItems();
    }
}

// Display order items in modal
function displayOrderItems() {
    const orderItemsContainer = document.getElementById('order-items');
    const totalPriceElement = document.getElementById('total-price');
    const emptyOrderEl = document.querySelector('.empty-order');
    
    // Get translations
    const lang = localStorage.getItem('language') || 'en';
    const emptyMsg = lang === 'bg' ? 'Няма добавени ястия' : 'No items added';
    
    if (orderItems.length === 0) {
        if (emptyOrderEl) {
            emptyOrderEl.textContent = emptyMsg;
        } else {
            orderItemsContainer.innerHTML = `<p class="empty-order">${emptyMsg}</p>`;
        }
    } else {
        orderItemsContainer.innerHTML = orderItems.map(item => `
            <div class="order-item">
                <div class="order-item-info">
                    <div class="order-item-name">${getOrderItemDisplayName(item)}</div>
                    <div class="order-item-quantity">
                        <button onclick="updateItemQuantity('${item.name}', ${item.quantity - 1})" class="quantity-btn">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button onclick="updateItemQuantity('${item.name}', ${item.quantity + 1})" class="quantity-btn">+</button>
                    </div>
                </div>
                <div class="order-item-price">${item.totalPrice.toFixed(2)} €</div>
                <button onclick="removeFromOrder('${item.name}')" class="remove-btn">×</button>
            </div>
        `).join('');
    }
    
    totalPriceElement.textContent = orderTotal.toFixed(2);
}

function clearOrderCartAfterQr() {
    console.warn("[QR] clearOrderCartAfterQr is disabled; use clearCartExplicitly() for explicit cart clear.");
    return;

    console.log("[QR] clearing cart after QR close");

    if (Array.isArray(window.cart)) window.cart.length = 0;
    if (Array.isArray(window.cartItems)) window.cartItems.length = 0;
    if (Array.isArray(window.orderItems)) window.orderItems.length = 0;

    if (typeof cart !== "undefined" && Array.isArray(cart)) cart.length = 0;
    if (typeof cartItems !== "undefined" && Array.isArray(cartItems)) cartItems.length = 0;
    if (typeof orderItems !== "undefined" && Array.isArray(orderItems)) orderItems.length = 0;

    if (typeof currentOrder !== "undefined" && currentOrder && Array.isArray(currentOrder.items)) {
        currentOrder.items = [];
    }

    orderItems = [];
    orderTotal = 0;

    try {
        localStorage.removeItem("cart");
        localStorage.removeItem("cartItems");
        localStorage.removeItem("orderItems");
        localStorage.removeItem("currentOrder");
        localStorage.removeItem("restaurantOrder");
        sessionStorage.removeItem("cart");
        sessionStorage.removeItem("cartItems");
        sessionStorage.removeItem("orderItems");
        sessionStorage.removeItem("currentOrder");
        sessionStorage.removeItem("restaurantOrder");
    } catch (e) {
        console.warn("[QR] storage clear skipped:", e);
    }

    const qrContainer = document.getElementById("orderQrCode");
    if (qrContainer) qrContainer.innerHTML = "";

    const orderList = document.getElementById("order-items")
        || document.getElementById("orderItems")
        || document.querySelector(".order-items")
        || document.querySelector(".cart-items");

    if (orderList) orderList.innerHTML = "";

    const totalEls = [
        document.getElementById("cart-total"),
        document.getElementById("total"),
        document.getElementById("order-total"),
        document.getElementById("total-price"),
        document.querySelector(".cart-total"),
        document.querySelector(".order-total")
    ].filter(Boolean);

    totalEls.forEach((el) => {
        el.textContent = el.id === "total-price" ? "0.00" : "0.00 €";
    });

    updateOrderTotal();
    updateOrderCount();
    saveOrderToStorage();

    if (typeof renderCart === "function") renderCart();
    if (typeof updateCart === "function") updateCart();
    if (typeof updateCartUI === "function") updateCartUI();
    if (typeof updateTotal === "function") updateTotal();

    if (document.getElementById("orderSummaryModal")) {
        displayOrderItems();
    }

    document.body.classList.remove("modal-open");
}

function getCartItemsRef() {
    if (typeof cartItems !== "undefined" && Array.isArray(cartItems)) return cartItems;
    if (typeof cart !== "undefined" && Array.isArray(cart)) return cart;
    if (typeof orderItems !== "undefined" && Array.isArray(orderItems)) return orderItems;
    if (Array.isArray(window.cartItems)) return window.cartItems;
    if (Array.isArray(window.cart)) return window.cart;
    if (Array.isArray(window.orderItems)) return window.orderItems;
    return [];
}

function refreshCartUi() {
    updateOrderTotal();
    updateOrderCount();

    if (typeof renderCart === "function") renderCart();
    if (typeof updateCart === "function") updateCart();
    if (typeof updateCartUI === "function") updateCartUI();
    if (typeof updateTotal === "function") updateTotal();

    if (document.getElementById("order-items") && document.getElementById("total-price")) {
        displayOrderItems();
    }
}

function saveCartState() {
    try {
        const items = getCartItemsRef();
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
            items,
            total: orderTotal,
            savedAt: Date.now()
        }));
    } catch (e) {
        console.warn("[cart] save failed:", e);
    }
}

function loadCartState() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed.items) ? parsed.items : [];

        return items;
    } catch (e) {
        console.warn("[cart] load failed:", e);
        return [];
    }
}

function restoreCartState() {
    const items = loadCartState();
    if (!items.length) return 0;

    const restoredItems = items.map((item) => ({ ...item }));

    orderItems = restoredItems;

    if (typeof cartItems !== "undefined" && Array.isArray(cartItems)) {
        cartItems.length = 0;
        cartItems.push(...restoredItems);
    } else if (typeof cart !== "undefined" && Array.isArray(cart)) {
        cart.length = 0;
        cart.push(...restoredItems);
    } else if (Array.isArray(window.cartItems)) {
        window.cartItems.length = 0;
        window.cartItems.push(...restoredItems);
    } else if (Array.isArray(window.cart)) {
        window.cart.length = 0;
        window.cart.push(...restoredItems);
    } else {
        window.cartItems = restoredItems;
    }

    refreshCartUi();
    console.log("[cart] restored", restoredItems.length);
    return restoredItems.length;
}

function setRestoreQrButtonVisible(isVisible) {
    const restoreBtn = document.getElementById("restoreQrBtn");
    if (restoreBtn) {
        restoreBtn.style.display = isVisible ? "inline-flex" : "none";
    }
}

function clearCartUI() {
    const items = getCartItemsRef();
    if (Array.isArray(items)) items.length = 0;

    orderItems = [];
    orderTotal = 0;

    if (Array.isArray(window.cartItems)) window.cartItems.length = 0;
    if (Array.isArray(window.cart)) window.cart.length = 0;

    refreshCartUi();
}

function clearCartLocalStorage() {
    const activeCartKeys = [
        CART_STORAGE_KEY,
        QR_STATE_STORAGE_KEY,
        "restaurantOrder",
        "cart",
        "cartItems",
        "orderItems",
        "currentCart",
        "currentOrder",
        "lastOrder"
    ];

    try {
        activeCartKeys.forEach((key) => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
    } catch (e) {
        console.warn("[cart] storage clear failed:", e);
    }

    setRestoreQrButtonVisible(false);
}

function hideQrCode() {
    const qrBox = document.getElementById("orderQrCode");
    if (qrBox) qrBox.innerHTML = "";

    const qrModal = document.getElementById("qrModal") || document.querySelector(".qr-modal");
    if (qrModal) {
        qrModal.style.display = "none";
        qrModal.classList.remove("active", "show", "open");
    }

    if (qrExpiryTimer) clearInterval(qrExpiryTimer);
    qrExpiryTimer = null;
    setRestoreQrButtonVisible(false);
}

function clearCartExplicitly() {
    clearCartUI();
    clearCartLocalStorage();
    hideQrCode();
    stopActiveCartListener();
    setActiveCartPointer("");
}

function listenToClientCart(cartId) {
    const resolvedCartId = String(cartId || "").trim();
    if (!resolvedCartId) return;

    stopActiveCartListener();
    activeCartId = resolvedCartId;
    acceptedCartHandled = false;

    const db = getClientFirestore();
    activeCartUnsubscribe = db.collection("carts").doc(resolvedCartId).onSnapshot((snap) => {
        if (!snap.exists) return;
        const cart = snap.data() || {};
        const status = String(cart.status || "").toLowerCase();

        if (!["accepted", "cleared"].includes(status) || acceptedCartHandled) return;
        acceptedCartHandled = true;

        const acceptedTableId = String(cart.tableId || getClientTableContext().tableId || "").trim();
        const acceptedBillToken = String(cart.publicBillToken || "").trim();
        if (acceptedTableId) {
            setClientTablePointer(acceptedTableId, cart.tableNumber);
            if (isValidPublicBillToken(acceptedBillToken)) {
                persistPublicBillToken(acceptedBillToken, acceptedTableId);
            }
            listenActiveBillForTable(acceptedTableId);
        }

        clearCartUI();
        clearCartLocalStorage();
        hideQrCode();
        stopActiveCartListener();
        setActiveCartPointer("");

        showOrderMessage("Поръчката е приета от сервитьор.");
        console.log("[cart] accepted by waiter", {
            cartId: resolvedCartId,
            orderId: cart.orderId || ""
        });
    }, (error) => {
        console.error("[cart] listener failed:", error);
        showOrderMessage("Неуспешно проследяване на QR поръчката. Опитайте отново.");
    });
}

function saveQrState(qrPayload, qrHtmlOrDataUrl = "", cartId = "") {
    try {
        const generatedAt = Date.now();
        const state = {
            qrPayload,
            qrHtmlOrDataUrl,
            cartId: String(cartId || ""),
            generatedAt,
            expiresAt: generatedAt + QR_TTL_MS
        };

        localStorage.setItem(QR_STATE_STORAGE_KEY, JSON.stringify(state));
        setRestoreQrButtonVisible(true);
        console.log("[QR] state saved", {
            length: qrPayload?.length,
            expiresAt: new Date(state.expiresAt).toLocaleTimeString()
        });
        return state;
    } catch (e) {
        console.warn("[QR] save state failed:", e);
        return null;
    }
}

function loadQrState() {
    try {
        const raw = localStorage.getItem(QR_STATE_STORAGE_KEY);
        if (!raw) return null;

        const state = JSON.parse(raw);
        if (!state || !state.qrPayload) return null;

        return state;
    } catch (e) {
        console.warn("[QR] load state failed:", e);
        return null;
    }
}

function isQrStateExpired(state) {
    return !state || !state.expiresAt || Date.now() > Number(state.expiresAt);
}

function clearQrState() {
    try {
        localStorage.removeItem(QR_STATE_STORAGE_KEY);
        setRestoreQrButtonVisible(false);
    } catch {}
}

function showQrExpiredMessage() {
    const msg = "QR кодът е изтекъл. Количката е запазена - натисни Generate QR Code, за да създадеш нов.";

    console.warn("[QR]", msg);

    const box =
        document.getElementById("qrMessage") ||
        document.getElementById("qrStatus") ||
        document.querySelector(".qr-message");

    if (box) {
        box.textContent = msg;
        box.classList.add("warning");
    } else if (typeof showOrderMessage === "function") {
        showOrderMessage(msg);
    } else {
        alert(msg);
    }
}

function getQrExpiryInfoEl() {
    let el = document.getElementById("qrExpiryInfo");
    if (el) return el;

    const modalContent = document.querySelector("#qrModal .qr-modal-content");
    if (!modalContent) return null;

    el = document.createElement("div");
    el.id = "qrExpiryInfo";
    el.className = "qr-expiry-info";
    modalContent.appendChild(el);
    return el;
}

function showQrExpiryInfo(expiresAt) {
    const el = getQrExpiryInfoEl();
    if (!el) return;

    if (qrExpiryTimer) {
        clearInterval(qrExpiryTimer);
    }

    function tick() {
        const left = Number(expiresAt || 0) - Date.now();

        if (left <= 0) {
            el.textContent = "QR кодът е изтекъл. Количката е запазена.";
            clearInterval(qrExpiryTimer);
            qrExpiryTimer = null;
            clearQrState();
            return;
        }

        const min = Math.floor(left / 60000);
        const sec = Math.floor((left % 60000) / 1000);
        el.textContent = `QR е валиден още ${min}:${String(sec).padStart(2, "0")} мин.`;
    }

    tick();
    qrExpiryTimer = setInterval(tick, 1000);
}

// Generate a Firestore cart and encode only its id in the QR code.
async function createNewQR() {
    if (cartCreateInFlight) return cartCreateInFlight;

    cartCreateInFlight = (async () => {
        const lang = localStorage.getItem('language') || 'en';
        const sourceItems = getCartItemsRef();

        if (!Array.isArray(sourceItems) || sourceItems.length === 0) {
            showOrderMessage(lang === 'bg' ? 'Поръчката е празна!' : 'Order is empty!');
            return null;
        }

        try {
            const db = getClientFirestore();
            const FieldValue = firebase.firestore.FieldValue;
            const table = getClientTableContext();
            const publicBillToken = getOrCreatePublicBillToken(table.tableId);
            const noteInput = document.getElementById("noteInput") || document.getElementById("orderNote");
            const menuList = getQrMenuList();
            const menuLookup = buildMenuLookup(menuList);
            const resolvedItems = sourceItems.map((item) => resolveCartItemFromMenu(item, menuLookup));
            const items = toFirestoreCartItems(resolvedItems);
            const total = Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100;
            const cartRef = db.collection("carts").doc();
            const cartId = cartRef.id;

            await cartRef.set({
                cartId,
                tableId: table.tableId,
                tableNumber: table.tableNumber,
                publicBillToken,
                items,
                total,
                note: String(noteInput?.value || ""),
                status: "pending_scan",
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                acceptedAt: null,
                acceptedBy: null,
                orderId: null
            });

            const qrPayload = JSON.stringify({
                type: "cart",
                cartId,
                tableId: table.tableId
            });

            const orderModal = document.getElementById('orderSummaryModal');
            if (orderModal) orderModal.style.display = 'none';

            const qrState = saveQrState(qrPayload, "", cartId);
            saveCartState();
            setActiveCartPointer(cartId);
            listenToClientCart(cartId);
            if (table.tableId) listenActiveOrderForCustomerTable(table.tableId);
            generateQRCodeModal(qrPayload);
            showQrExpiryInfo(qrState?.expiresAt || Date.now() + QR_TTL_MS);

            console.log("[QR] Firestore cart generated", {
                cartId,
                tableId: table.tableId,
                itemCount: items.length,
                total
            });
            return cartId;
        } catch (err) {
            console.error("Firestore QR cart generation failed:", err);
            showOrderMessage(err?.message || (
                lang === 'bg'
                    ? 'QR поръчката не можа да се запише във Firebase. Опитай пак.'
                    : 'The QR order could not be saved. Please try again.'
            ));
            return null;
        }
    })();

    try {
        return await cartCreateInFlight;
    } finally {
        cartCreateInFlight = null;
    }
}

async function openSavedQrIfValid() {
    const state = loadQrState();

    if (!state) {
        await createNewQR();
        return;
    }

    if (isQrStateExpired(state)) {
        clearQrState();
        showQrExpiredMessage();
        return;
    }

    renderQrFromPayload(state.qrPayload);
    showQrModal();
    showQrExpiryInfo(state.expiresAt);
    if (state.cartId) {
        setActiveCartPointer(state.cartId);
        listenToClientCart(state.cartId);
    }
}

async function handleGenerateQrClick() {
    const state = loadQrState();

    if (state && !isQrStateExpired(state)) {
        renderQrFromPayload(state.qrPayload);
        showQrModal();
        showQrExpiryInfo(state.expiresAt);
        if (state.cartId) {
            setActiveCartPointer(state.cartId);
            listenToClientCart(state.cartId);
        }
        console.log("[QR] reopened existing QR");
        return;
    }

    if (state && isQrStateExpired(state)) {
        clearQrState();
        showQrExpiredMessage();
    }

    await createNewQR();
}

async function generateQR() {
    return handleGenerateQrClick();
}

function showOrderQrError(qrContainer, message) {
    qrContainer.innerHTML = '';

    const errorMessage = document.createElement('p');
    errorMessage.className = 'qr-error';
    errorMessage.textContent = message;
    qrContainer.appendChild(errorMessage);
}

function updateOrderQrInstruction() {
    const instruction = document.getElementById('qrScanInstruction');
    const lang = localStorage.getItem('language') || 'en';
    if (instruction) {
        instruction.textContent = lang === 'bg'
            ? 'Сканирайте този код за да видите детайлите на поръчката'
            : 'Scan this code to view order details';
    }

}

// Render the existing order payload as a scannable QR code.
function renderOrderQr(qrPayload) {
    const qrContainer = document.getElementById('orderQrCode');
    if (!qrContainer) return;

    qrContainer.innerHTML = '';
    updateOrderQrInstruction();

    if (!qrPayload || typeof qrPayload !== 'string') {
        showOrderQrError(qrContainer, 'Няма данни за QR код.');
        return;
    }

    if (!window.QRCode || typeof window.QRCode.toCanvas !== 'function') {
        showOrderQrError(qrContainer, 'QR библиотеката не е заредена.');
        return;
    }

    const qrCanvas = document.createElement('canvas');
    qrCanvas.id = 'order-qr-canvas';
    qrContainer.appendChild(qrCanvas);

    try {
        window.QRCode.toCanvas(qrCanvas, qrPayload, {
            errorCorrectionLevel: 'H',
            margin: 4,
            width: 230,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, function (error) {
            if (!error) return;

            console.error('QR Code generation error:', error);
            showOrderQrError(qrContainer, 'QR кодът не можа да бъде генериран.');
        });
    } catch (error) {
        console.error('QR Code generation error:', error);
        showOrderQrError(qrContainer, 'QR кодът не можа да бъде генериран.');
    }
}

// Generate QR code in full-screen modal
function renderQrFromPayload(qrPayload) {
    renderOrderQr(qrPayload);
}

function showQrModal() {
    const qrModal = document.getElementById('qrModal');
    if (qrModal) {
        qrModal.classList.add('active', 'show', 'open');
        qrModal.style.display = 'flex';
    }
}

function generateQRCodeModal(text) {
    renderQrFromPayload(text);
    showQrModal();
}

// Close QR modal
function closeQRModal() {
    const qrModal = document.getElementById('qrModal');
    if (qrModal) {
        qrModal.style.display = 'none';
        qrModal.classList.remove('active', 'show', 'open');
    }

    if (qrExpiryTimer) {
        clearInterval(qrExpiryTimer);
        qrExpiryTimer = null;
    }
}

if (typeof window !== "undefined") {
    window.closeQRModal = closeQRModal;
    window.handleGenerateQrClick = handleGenerateQrClick;
    window.generateQR = generateQR;
    window.renderOrderQr = renderOrderQr;
    window.openSavedQrIfValid = openSavedQrIfValid;
    window.clearCartExplicitly = clearCartExplicitly;
    window.clearCartUI = clearCartUI;
    window.clearCartLocalStorage = clearCartLocalStorage;
    window.hideQrCode = hideQrCode;
}

function escapeReceiptHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getCustomerActiveOrderStatusLabel(lang) {
    if (activeBillWasPaid) return lang === 'bg' ? 'Сметката е платена.' : 'The bill is paid.';
    if (!activeBillOrders.length) {
        return lang === 'bg'
            ? 'Все още няма приета поръчка за тази маса.'
            : 'There is no accepted order for this table yet.';
    }

    const statuses = activeBillOrders.map((order) => String(order.status || '').toLowerCase());
    if (statuses.includes('ready')) return lang === 'bg' ? 'Готова' : 'Ready';
    if (statuses.some((status) => ['preparing', 'in_progress', 'processing'].includes(status))) {
        return lang === 'bg' ? 'В процес' : 'In progress';
    }
    return lang === 'bg' ? 'Неплатена' : 'Unpaid';
}

function renderActiveBillReceipt() {
    const receiptModal = document.getElementById('activeOrderModal');
    const receiptItems = document.getElementById('activeOrderItems');
    const receiptTotal = document.getElementById('activeOrderTotal');
    const statusElement = document.getElementById('activeOrderStatus');
    if (!receiptModal || !receiptItems || !receiptTotal) return;

    const lang = localStorage.getItem('language') || 'en';
    const title = receiptModal.querySelector('h2');
    if (title) title.textContent = lang === 'bg' ? 'Активна сметка' : 'Active bill';
    if (statusElement) statusElement.textContent = getCustomerActiveOrderStatusLabel(lang);

    let meta = document.getElementById('receipt-active-meta');
    if (!meta) {
        meta = document.createElement('div');
        meta.id = 'receipt-active-meta';
        meta.className = 'receipt-active-meta';
        title?.insertAdjacentElement('afterend', meta);
    }
    meta.textContent = activeBillOrders.map((order) => {
        return `${order.id} • ${order.status || 'active'}`;
    }).join(' | ');

    if (!activeBillOrders.length || !lastOrder.length) {
        const emptyText = activeBillWasPaid
            ? (lang === 'bg' ? 'Сметката е платена.' : 'The bill is paid.')
            : (lang === 'bg'
                ? 'Все още няма приета поръчка за тази маса.'
                : 'There is no accepted order for this table yet.');
        receiptItems.innerHTML = `<p class="active-order-empty">${emptyText}</p>`;
        receiptTotal.textContent = '0.00';
        meta.textContent = '';
        return;
    }

    const total = lastOrder.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    receiptItems.innerHTML = lastOrder.map(item => `
        <div class="receipt-item">
            <div class="receipt-item-name">
                <div>${escapeReceiptHtml(getOrderItemDisplayName(item))}</div>
                <div class="receipt-item-unit">${Number(item.price || 0).toFixed(2)} € / ${lang === 'bg' ? 'бр.' : 'unit'}</div>
            </div>
            <div class="receipt-item-quantity">x${item.quantity}</div>
            <div class="receipt-item-price">${Number(item.totalPrice || 0).toFixed(2)} €</div>
        </div>
    `).join('');
    receiptTotal.textContent = total.toFixed(2);
}

// Show the active Firestore bill next to the temporary cart.
function showLastOrderReceipt() {
    const receiptModal = document.getElementById('activeOrderModal');
    if (!receiptModal) return;
    renderActiveBillReceipt();
    receiptModal.style.display = 'block';
    receiptModal.classList.add('show');
    receiptModal.setAttribute('aria-hidden', 'false');
}

// Close receipt modal
function closeReceiptModal() {
    const receiptModal = document.getElementById('activeOrderModal');
    if (!receiptModal) return;
    receiptModal.style.display = 'none';
    receiptModal.classList.remove('show');
    receiptModal.setAttribute('aria-hidden', 'true');
}

function resetLastOrderReceiptUi() {
    updateActiveBillMemory([]);
    updateActiveOrderBadge();
    renderActiveBillReceipt();
}

function clearLastOrderReceipt() {
    try {
        localStorage.removeItem('lastOrder');
    } catch (error) {
        console.warn('[receipt] Could not clear lastOrder:', error);
    }
    if (!activeBillOrders.length) resetLastOrderReceiptUi();
}

if (typeof window !== 'undefined') {
    window.clearLastOrderReceipt = clearLastOrderReceipt;
    window.listenActiveBillForTable = listenActiveBillForTable;
    window.listenActiveOrderForCustomerTable = listenActiveOrderForCustomerTable;
}

// Show order message
function showOrderMessage(message) {
    // Remove existing message if any
    const existingMessage = document.querySelector('.order-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageElement = document.createElement('div');
    messageElement.className = 'order-message';
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background-color: #ff8c00;
        color: #2c1810;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: bold;
        z-index: 3000;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageElement);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        messageElement.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            messageElement.remove();
        }, 300);
    }, 3000);
}

// Save order to localStorage
function saveOrderToStorage() {
    localStorage.setItem('restaurantOrder', JSON.stringify(orderItems));
    saveCartState();
}

// Load order from localStorage
function loadOrderFromStorage() {
    if (restoreCartState()) return;

    const savedOrder = localStorage.getItem('restaurantOrder');
    if (savedOrder) {
        orderItems = JSON.parse(savedOrder);
        updateOrderTotal();
        updateOrderCount();
        saveCartState();
    }
}

// Clear order
function clearOrder() {
    clearCartExplicitly();
    
    const orderModal = document.getElementById('orderSummaryModal');
    if (orderModal && orderModal.style.display === 'block') {
        displayOrderItems();
    }
    
    const lang = localStorage.getItem('language') || 'en';
    const clearedMsg = lang === 'bg' ? 'Поръчката е изчистена!' : 'Order cleared!';
    showOrderMessage(clearedMsg);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .order-item-info {
        flex: 1;
    }
    
    .order-item-quantity {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }
    
    .quantity-btn {
        background-color: #ff8c00;
        color: #2c1810;
        border: none;
        border-radius: 50%;
        width: 25px;
        height: 25px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s;
    }
    
    .quantity-btn:hover {
        background-color: #ff6b00;
    }
    
    .quantity {
        color: white;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
    }
    
    .remove-btn {
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 1.2rem;
        font-weight: bold;
        transition: background-color 0.3s;
    }
    
    .remove-btn:hover {
        background-color: #c82333;
    }
`;
document.head.appendChild(style);

// Load order when page loads
window.addEventListener('DOMContentLoaded', function() {
    loadOrderFromStorage();

    const restoreBtn = document.getElementById("restoreQrBtn");
    if (restoreBtn) {
        restoreBtn.addEventListener("click", openSavedQrIfValid);
    }

    const qrState = loadQrState();
    const urlCartId = new URLSearchParams(window.location.search).get("cartId");
    if (qrState && isQrStateExpired(qrState)) {
        clearQrState();
        console.log("[QR] saved QR expired after refresh; cart remains.");
    } else if (qrState) {
        setRestoreQrButtonVisible(true);
        console.log("[QR] saved QR available after refresh", {
            expiresAt: new Date(qrState.expiresAt).toLocaleTimeString()
        });
    } else {
        setRestoreQrButtonVisible(false);
    }

    const cartIdToWatch = String(urlCartId || qrState?.cartId || "").trim();
    if (cartIdToWatch) {
        activeCartId = cartIdToWatch;
        try {
            listenToClientCart(cartIdToWatch);
        } catch (error) {
            console.error("[cart] listener initialization failed:", error);
        }
    }
    const tableContext = getClientTableContext();
    if (tableContext.tableId) {
        try {
            listenActiveBillForTable(tableContext.tableId);
        } catch (error) {
            console.error("[active-bill] listener initialization failed:", error);
        }
    } else {
        resetLastOrderReceiptUi();
    }
    
    // Apply translations to nutrition modal if it exists
    if (document.getElementById('nutritionModal')) {
        updateNutritionTranslations();
        bindDishModalClose();
        bindModalAddToCart();
    }
}, { once: true });

window.addEventListener("pagehide", () => {
    stopActiveCartListener();
    stopActiveBillListener();
});
window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    const tableId = getClientTableContext().tableId;
    if (tableId) listenActiveBillForTable(tableId);
    const cartId = String(new URLSearchParams(window.location.search).get("cartId") || loadQrState()?.cartId || "").trim();
    if (cartId) listenToClientCart(cartId);
});

// Close modal when clicking outside
if (!window.__MENU_MODAL_CLOSE_BOUND__) {
window.__MENU_MODAL_CLOSE_BOUND__ = true;

window.addEventListener('click', function(event) {
    const orderModal = document.getElementById('orderSummaryModal');
    const nutritionModal = document.getElementById('nutritionModal');
    const qrModal = document.getElementById('qrModal');
    const receiptModal = document.getElementById('activeOrderModal');
    
    if (event.target === orderModal) {
        orderModal.style.display = 'none';
    }
    
    if (event.target === nutritionModal) {
        closeNutritionModal();
    }
    
    if (event.target === qrModal) {
        closeQRModal();
    }
    
    if (event.target === receiptModal) {
        closeReceiptModal();
    }
});

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const orderModal = document.getElementById('orderSummaryModal');
        const nutritionModal = document.getElementById('nutritionModal');
        const qrModal = document.getElementById('qrModal');
        const receiptModal = document.getElementById('activeOrderModal');
        
        const qrModalIsOpen = qrModal && (
            qrModal.style.display === 'flex' ||
            qrModal.style.display === 'block' ||
            qrModal.classList.contains('active') ||
            qrModal.classList.contains('show') ||
            qrModal.classList.contains('open')
        );

        if (qrModalIsOpen) {
            closeQRModal();
            return;
        }
        
        if (receiptModal && receiptModal.style.display === 'block') {
            closeReceiptModal();
            return;
        }
        
        if (orderModal && orderModal.style.display === 'block') {
            orderModal.style.display = 'none';
            return;
        }
        
        if (nutritionModal && nutritionModal.style.display === 'flex') {
            closeNutritionModal();
            return;
        }
    }
});
}
