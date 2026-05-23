// Category Page JavaScript

// Order data storage
let orderItems = [];
let orderTotal = 0;
let lastOrder = []; // Store accumulated completed orders (all items from all QR generations)
const CART_STORAGE_KEY = "guest_cart_v1";
const QR_STATE_STORAGE_KEY = "guest_qr_state_v1";
const QR_TTL_MS = 20 * 60 * 1000;
let qrExpiryTimer = null;

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
    
    const lang = localStorage.getItem('language') || 'en';
    
    // Set content immediately (show original, then translate if English)
    title.textContent = name;
    desc.textContent = description;
    
    // Translate dish name and description to English when app language is English
    if (lang === 'en' && typeof window.translateText === 'function') {
        if (description && description.trim()) {
            window.translateText(description, 'bg', 'en').then(function(translated) {
                if (desc) desc.textContent = translated || description;
            }).catch(function() {});
        }
        if (name && name.trim()) {
            window.translateText(name, 'bg', 'en').then(function(translated) {
                if (title) title.textContent = translated || name;
            }).catch(function() {});
        }
    }
    if (imageUrl) {
        imageEl.src = imageUrl;
        imageEl.alt = name;
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
    addBtn.onclick = function() {
        addToOrder(name, priceValue, menuMeta);
        closeNutritionModal();
    };
    
    // Apply translations
    updateNutritionTranslations();
    
    // Show modal
    modal.style.display = 'flex';
}

// Close nutrition modal
function closeNutritionModal() {
    const modal = document.getElementById('nutritionModal');
    modal.style.display = 'none';
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

    // Check if item already exists in order
    const existingItem = orderItems.find((item) => {
        if (menuId) {
            const existingMenuId = String(item.menuId || item.itemId || "").trim();
            return existingMenuId === menuId || (!existingMenuId && item.name === dishName);
        }
        return item.name === dishName;
    });
    
    if (existingItem) {
        existingItem.quantity += 1;
        existingItem.qty = existingItem.quantity;
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
            name: dishName,
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
                    <div class="order-item-name">${item.name}</div>
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

    const qrContainer = document.getElementById("qr-code-display");
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

function clearCartExplicitly() {
    const items = getCartItemsRef();
    if (Array.isArray(items)) items.length = 0;

    orderItems = [];
    orderTotal = 0;

    try {
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(QR_STATE_STORAGE_KEY);
        localStorage.removeItem("restaurantOrder");
        localStorage.removeItem("cart");
        localStorage.removeItem("cartItems");
        localStorage.removeItem("orderItems");
        localStorage.removeItem("currentOrder");
        sessionStorage.removeItem("cart");
        sessionStorage.removeItem("cartItems");
        sessionStorage.removeItem("orderItems");
        sessionStorage.removeItem("currentOrder");
    } catch (e) {
        console.warn("[cart] explicit clear storage failed:", e);
    }

    setRestoreQrButtonVisible(false);
    refreshCartUi();
}

function saveQrState(qrPayload, qrHtmlOrDataUrl = "") {
    try {
        const generatedAt = Date.now();
        const state = {
            qrPayload,
            qrHtmlOrDataUrl,
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

// Generate QR code for order
function createNewQR() {
    const lang = localStorage.getItem('language') || 'en';
    
    if (orderItems.length === 0) {
        const emptyMsg = lang === 'bg' ? 'Поръчката е празна!' : 'Order is empty!';
        showOrderMessage(emptyMsg);
        return;
    }
    
    let qrPayload = "";
    try {
        const currentTable = typeof currentTableId !== "undefined" ? currentTableId : "";
        const selectedTable = typeof selectedTableId !== "undefined" ? selectedTableId : "";
        const noteInput =
            document.getElementById("noteInput") ||
            document.getElementById("orderNote") ||
            null;
        const menuList = getQrMenuList();
        const menuLookup = buildMenuLookup(menuList);
        const resolvedItems = orderItems.map((item) => resolveCartItemFromMenu(item, menuLookup));

        console.log("[QR cart resolved items]", resolvedItems.map((x) => ({
            name: x.name,
            menuId: x.menuId,
            itemId: x.itemId,
            qrCode: x.qrCode || x.shortCode || x.code || x.qr,
            price: x.price
        })));

        const orderForQr = {
            tableId: currentTable || selectedTable || "",
            items: resolvedItems,
            note: noteInput?.value || ""
        };

        qrPayload = encodeBestCompactOrderForQr(orderForQr, menuList);

        console.log("[QR-GENERATED]", {
            format: qrPayload.startsWith("R2|") ? "R2" : "R1",
            length: qrPayload.length,
            payload: qrPayload
        });
    } catch (err) {
        console.error("Compact QR generation failed:", err);
        const failMsg = err?.message || (
            lang === 'bg'
                ? 'QR кодът не можа да се генерира. Опитай пак.'
                : 'QR code could not be generated. Please try again.'
        );
        showOrderMessage(failMsg);
        return;
    }

    // Add current order items to accumulated receipt before clearing
    // If item already exists in lastOrder, merge quantities
    const currentOrderCopy = JSON.parse(JSON.stringify(orderItems)); // Deep copy
    
    currentOrderCopy.forEach(newItem => {
        const existingItem = lastOrder.find(item => item.name === newItem.name);
        if (existingItem) {
            // Item exists - add quantities and update total price
            existingItem.quantity += newItem.quantity;
            existingItem.totalPrice = existingItem.price * existingItem.quantity;
        } else {
            // New item - add to receipt
            lastOrder.push(newItem);
        }
    });
    
    localStorage.setItem('lastOrder', JSON.stringify(lastOrder));
    
    // Close order summary modal
    const orderModal = document.getElementById('orderSummaryModal');
    if (orderModal) orderModal.style.display = 'none';

    // Generate QR code in full-screen modal
    const qrState = saveQrState(qrPayload);
    saveCartState();
    generateQRCodeModal(qrPayload);
    showQrExpiryInfo(qrState?.expiresAt || Date.now() + QR_TTL_MS);
    console.log("[QR] generated successfully", {
        length: qrPayload.length,
        expiresAt: qrState ? new Date(qrState.expiresAt).toLocaleTimeString() : ""
    });
    
    // Show receipt button
    const receiptIcon = document.getElementById('receipt-icon');
    if (receiptIcon) {
        receiptIcon.style.display = 'flex';
    }
}

function openSavedQrIfValid() {
    const state = loadQrState();

    if (!state) {
        createNewQR();
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
}

async function handleGenerateQrClick() {
    const state = loadQrState();

    if (state && !isQrStateExpired(state)) {
        renderQrFromPayload(state.qrPayload);
        showQrModal();
        showQrExpiryInfo(state.expiresAt);
        console.log("[QR] reopened existing QR");
        return;
    }

    if (state && isQrStateExpired(state)) {
        clearQrState();
        showQrExpiredMessage();
    }

    createNewQR();
}

async function generateQR() {
    return handleGenerateQrClick();
}

// Generate QR code in full-screen modal
function renderQrFromPayload(text) {
    const qrDisplay = document.getElementById('qr-code-display');
    if (!qrDisplay) return;
    
    // Clear previous QR code
    qrDisplay.innerHTML = '';
    
    // Create QR code canvas using QRCode.js (if available) or fallback
    const qrCodeElement = document.createElement('canvas');
    qrCodeElement.id = 'qr-code';
    qrCodeElement.style.width = 'min(82vw, 460px)';
    qrCodeElement.style.height = 'min(82vw, 460px)';
    qrCodeElement.style.imageRendering = 'pixelated';
    
    // Try to use QRCode.js library if available
    if (typeof QRCode !== 'undefined') {
        qrDisplay.appendChild(qrCodeElement);
        QRCode.toCanvas(qrCodeElement, text, {
            errorCorrectionLevel: 'M',
            margin: 6,
            scale: 12,
            width: 1000,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, function (error) {
            if (error) {
                console.error('QR Code generation error:', error);
                qrDisplay.innerHTML = '';
                // Fallback to simple visual representation
                generateQRCodeFallback(qrDisplay, text);
            }
        });
    } else {
        // Fallback if QRCode.js is not loaded
        generateQRCodeFallback(qrDisplay, text);
    }

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

// Fallback QR code display (simple text representation)
function generateQRCodeFallback(container, text) {
    const lang = localStorage.getItem('language') || 'en';
    const qrScanMsg = lang === 'bg' ? 'Сканирайте този код за да видите детайлите на поръчката' : 'Scan this code to view order details';
    
    container.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 8px; display: inline-block; max-width: 90vw; max-height: 90vh; overflow: auto;">
            <div style="font-family: monospace; font-size: 12px; line-height: 1.2; color: black; white-space: pre-wrap; word-break: break-all;">
                ${text}
            </div>
            <p style="margin-top: 20px; color: #666; font-size: 0.9rem; text-align: center;">
                ${qrScanMsg}
            </p>
        </div>
    `;
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
    window.openSavedQrIfValid = openSavedQrIfValid;
    window.clearCartExplicitly = clearCartExplicitly;
}

// Show last order receipt
function showLastOrderReceipt() {
    // Load last order from localStorage if not in memory
    if (!lastOrder) {
        const savedLastOrder = localStorage.getItem('lastOrder');
        if (savedLastOrder) {
            lastOrder = JSON.parse(savedLastOrder);
        }
    }
    
    if (!lastOrder || lastOrder.length === 0) {
        const lang = localStorage.getItem('language') || 'en';
        const noOrderMsg = lang === 'bg' ? 'Няма запазена поръчка' : 'No saved order';
        showOrderMessage(noOrderMsg);
        return;
    }
    
    const receiptModal = document.getElementById('receiptModal');
    const receiptItems = document.getElementById('receipt-items');
    const receiptTotal = document.getElementById('receipt-total-price');
    
    // Calculate total from last order
    const total = lastOrder.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Display receipt items (read-only)
    receiptItems.innerHTML = lastOrder.map(item => `
        <div class="receipt-item">
            <div class="receipt-item-name">${item.name}</div>
            <div class="receipt-item-quantity">x${item.quantity}</div>
            <div class="receipt-item-price">${item.totalPrice.toFixed(2)} €</div>
        </div>
    `).join('');
    
    receiptTotal.textContent = total.toFixed(2);
    
    // Show modal
    receiptModal.style.display = 'block';
    receiptModal.classList.add('show');
}

// Close receipt modal
function closeReceiptModal() {
    const receiptModal = document.getElementById('receiptModal');
    receiptModal.style.display = 'none';
    receiptModal.classList.remove('show');
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
    
    // Check if last order exists and show receipt button
    const savedLastOrder = localStorage.getItem('lastOrder');
    if (savedLastOrder) {
        const parsedOrder = JSON.parse(savedLastOrder);
        // Ensure it's an array (handle both old format and new format)
        lastOrder = Array.isArray(parsedOrder) ? parsedOrder : (parsedOrder ? [parsedOrder] : []);
        
        if (lastOrder.length > 0) {
            const receiptIcon = document.getElementById('receipt-icon');
            if (receiptIcon) {
                receiptIcon.style.display = 'flex';
            }
        }
    }
    
    // Apply translations to nutrition modal if it exists
    if (document.getElementById('nutritionModal')) {
        updateNutritionTranslations();
    }
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const orderModal = document.getElementById('orderSummaryModal');
    const nutritionModal = document.getElementById('nutritionModal');
    const qrModal = document.getElementById('qrModal');
    const receiptModal = document.getElementById('receiptModal');
    
    if (event.target === orderModal) {
        orderModal.style.display = 'none';
    }
    
    if (event.target === nutritionModal) {
        nutritionModal.style.display = 'none';
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
        const receiptModal = document.getElementById('receiptModal');
        
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
            nutritionModal.style.display = 'none';
            return;
        }
    }
});
