// 1️⃣ Инициализация на Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBESLv5HFSw8 FmhFx3n44gKxQC7XbibY28", 
    authDomain: "reustarant-software.firebaseapp.com",
    projectId:"reustarant-software",
    storageBucket: "reustarant-software.firebasestorage.app", 
    messagingSenderId: "910706453590",
    appId: "1:910706453590: web: f952cc3f40f7bef2009ff7"
    };
  
// --- Firebase init (предполага, че firebaseConfig вече е дефиниран) ---
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// !!! СМЕНИ ако колекцията ти е с друго име (на снимката е menu_cat...):
const CATEGORIES_COLLECTION = "menu_categories";
const MENUS_COLLECTION = "menus";

// Нормализиране на пътя към снимка:
// - ако е "../images/..." -> оставяме
// - ако е "categories/..." -> правим "../images/categories/..."
const CATEGORY_IMAGE_FILE_ALIASES = {
  dessert: "dessert",
  desserts: "dessert",
  salad: "salad",
  salads: "salad",
  starter: "starter",
  starters: "starter"
};

const CATEGORY_DISPLAY_ORDER = [
  'starter',
  'starters',
  'salad',
  'salads',
  'bread',
  'pizza',
  'pasta',
  'chicken',
  'pork',
  'veal',
  'fish',
  'saj',
  'burger',
  'dessert',
  'desserts',
  'drinks'
];

function categoryImageFallback(categoryKey) {
  const key = String(categoryKey || "").trim().toLowerCase();
  if (!key) return "../images/background.jpg";
  const fileKey = CATEGORY_IMAGE_FILE_ALIASES[key] || key;
  return `../images/categories/${fileKey}.jpg`;
}

function resolveImg(path, opts = {}) {
  const kind = opts.kind || "";
  const categoryKey = opts.categoryKey || "";
  const fallback = kind === "category"
    ? categoryImageFallback(categoryKey)
    : "../images/background.jpg";

  let p = String(path || "").trim();
  if (!p) return fallback;
  if (/^data:image\//i.test(p)) return p;
  if (/^(https?:)?\/\//i.test(p)) return p;

  p = p.replace(/\\/g, "/");
  const lower = p.toLowerCase();

  const idx = lower.indexOf("/images/");
  if (idx >= 0) return `..${p.slice(idx)}`;
  const imageIdx = lower.indexOf("/image/");
  if (imageIdx >= 0) return `../images/${p.slice(imageIdx + "/image/".length)}`;
  if (lower.startsWith("../images/")) return p;
  if (lower.startsWith("../image/")) return `../images/${p.slice("../image/".length)}`;
  if (lower.startsWith("./images/")) return `..${p.slice(1)}`;
  if (lower.startsWith("./image/")) return `../images/${p.slice("./image/".length)}`;
  if (lower.startsWith("images/")) return `../${p}`;
  if (lower.startsWith("image/")) return `../images/${p.slice("image/".length)}`;
  if (lower.startsWith("categories/")) return `../images/${p}`;

  return `../images/${p}`;
}

const isCategoryPage = window.location.pathname.includes("category.html");
const urlParams = new URLSearchParams(window.location.search);
const currentCategory = urlParams.get("category"); // напр. "burger"
let categoryRenderRunId = 0;
let categoriesLoaded = false;
let categoriesCache = [];
let categoriesLoadPromise = null;
let menuLoaded = false;
let menusCache = [];
let menuLoadPromise = null;
let menuCollectionSource = `${MENUS_COLLECTION}.where(active == true)`;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMenuLanguage() {
  return typeof window.getCurrentLang === "function"
    ? window.getCurrentLang()
    : (localStorage.getItem("language") || localStorage.getItem("lang") || "en");
}

function getMenuItemForDisplay(item) {
  if (typeof window.getTranslatedItem === "function") {
    return window.getTranslatedItem(item);
  }

  return {
    ...item,
    displayName: item?.name || item?.title || "Unknown Item",
    displayDescription: item?.description || item?.desc || ""
  };
}

function getMenuItemStableId(item) {
  return String(
    item?.id ||
    item?.docId ||
    item?.menuId ||
    item?.itemId ||
    item?.firestoreId ||
    ""
  ).trim();
}

async function updateMenuCardTranslationAsync(card, item) {
  const lang = getMenuLanguage();
  if (lang !== "en") return;
  if (!card || !item || typeof window.getTranslatedItemAsync !== "function") return;

  const translated = await window.getTranslatedItemAsync(item);
  if (getMenuLanguage() !== "en") return;
  if (!card.isConnected) return;

  const titleEl = card.querySelector("[data-menu-item-title]");
  const descEl = card.querySelector("[data-menu-item-description]");
  const imgEl = card.querySelector("img");

  if (titleEl) titleEl.textContent = translated.displayName || "";
  if (descEl) descEl.textContent = translated.displayDescription || "";
  if (imgEl) imgEl.alt = translated.displayName || "";

  console.log("[ITEM TRANSLATED ASYNC]", translated.displayName, translated.displayDescription);
}

function findMenuItemById(id) {
  const wantedId = String(id || "").trim();
  if (!wantedId) return null;

  const lists = [
    window.menusCache,
    window.menuItemsCache,
    window.allMenuItems,
    window.menuItems,
    menusCache
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;

    const found = list.find((item) => {
      return [
        item?.id,
        item?.docId,
        item?.menuId,
        item?.itemId,
        item?.firestoreId
      ].some((value) => String(value || "").trim() === wantedId);
    });

    if (found) return found;
  }

  return null;
}

function bindMenuPopupDelegation() {
  const container =
    document.getElementById("menuItems") ||
    document.getElementById("menu") ||
    document.querySelector(".menu-items") ||
    document.querySelector(".menu-grid");

  if (!container) return;
  if (!isCategoryPage && container.id !== "menuItems") return;
  if (container.dataset.popupDelegationBound === "true") return;
  container.dataset.popupDelegationBound = "true";

  container.addEventListener("click", function(event) {
    const addBtn = event.target.closest("[data-add-to-cart], .add-to-cart, .add-btn");
    if (addBtn && container.contains(addBtn)) {
      event.preventDefault();
      event.stopPropagation();

      const id =
        addBtn.dataset.id ||
        addBtn.dataset.itemId ||
        addBtn.closest("[data-menu-item-id]")?.dataset.menuItemId;
      const item = findMenuItemById(id);

      if (item && typeof window.addToCart === "function") {
        window.addToCart(item);
      }

      return;
    }

    const card = event.target.closest("[data-menu-item-id], .menu-card, .menu-item, .dish-card");
    if (!card || !container.contains(card)) return;

    const id = card.dataset.menuItemId || card.dataset.id || card.dataset.itemId;
    const item = findMenuItemById(id);

    if (!item) {
      console.warn("No menu item found for modal id:", id);
      return;
    }

    if (typeof window.openDishModal === "function") {
      window.openDishModal(item);
    } else if (typeof window.openNutritionModal === "function") {
      window.openNutritionModal(item);
    } else if (typeof showNutritionInfo === "function") {
      const itemId = getMenuItemStableId(item);
      const displayItem = typeof window.getTranslatedItem === "function"
        ? window.getTranslatedItem(item)
        : {
          displayName: item.name || item.title || "Unknown Item",
          displayDescription: item.description || item.desc || ""
        };
      showNutritionInfo(
        displayItem.displayName || "Unknown Item",
        displayItem.displayDescription || "",
        item.calories || 0,
        item.carbs || 0,
        item.protein || 0,
        item.fat || 0,
        item.weight || "",
        item.price != null ? Number(item.price).toFixed(2) + " EUR" : "",
        Number(item.price || 0),
        resolveImg(item.image),
        {
          id: itemId,
          menuId: itemId,
          itemId,
          category: item.category || item.categoryKey || item.categorySlug || item.categoryId || item.type || "",
          station: item.station || item.targetStation || item.department || "",
          qrCode: item.qrCode || item.shortCode || item.code || item.qr || "",
          shortCode: item.shortCode || item.qrCode || item.code || item.qr || "",
          code: item.code || item.qrCode || item.shortCode || item.qr || "",
          qr: item.qr || item.qrCode || item.shortCode || item.code || "",
          item
        }
      );
    } else {
      console.error("openDishModal function is missing.");
    }
  });
}

function normalizeCategoryValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMenuItemFromDoc(docSnap) {
  const data = docSnap?.data?.() || {};
  const menuId = String(data.menuId || data.itemId || docSnap?.id || "").trim();
  const itemId = String(data.itemId || data.menuId || docSnap?.id || "").trim();
  const qrCode = String(data.qrCode || data.shortCode || data.code || data.qr || "").trim();

  return {
    ...data,
    id: docSnap?.id || data.id || menuId,
    docId: docSnap?.id || data.docId || menuId,
    menuId,
    itemId,
    qrCode: qrCode || data.qrCode || "",
    shortCode: String(data.shortCode || data.qrCode || data.code || data.qr || "").trim(),
    code: String(data.code || data.qrCode || data.shortCode || data.qr || "").trim(),
    qr: String(data.qr || data.qrCode || data.shortCode || data.code || "").trim()
  };
}

function isMenuItemVisible(item) {
  if (!item) return false;
  if (item.active === false) return false;

  const status = normalizeCategoryValue(item.status);
  if (status && status !== "active" && status !== "available") return false;

  return true;
}

function getMenuItemCategoryValues(item) {
  return [
    item?.category,
    item?.categoryKey,
    item?.categorySlug,
    item?.categoryId,
    item?.type
  ].map(normalizeCategoryValue).filter(Boolean);
}

function categoryValueMatches(value, selectedKey) {
  if (!value || !selectedKey) return false;
  return (
    value === selectedKey ||
    `${value}s` === selectedKey ||
    value === `${selectedKey}s`
  );
}

function menuItemMatchesCategory(item, selectedKey) {
  return getMenuItemCategoryValues(item).some((value) => categoryValueMatches(value, selectedKey));
}

function logMenuCategoryFilter(selectedCategory, selectedKey, allItems, filteredItems, source) {
  console.log("[MENU CATEGORY FILTER]", {
    selectedCategory,
    selectedKey,
    source,
    totalItems: allItems.length,
    filteredItems: filteredItems.length,
    sample: allItems.slice(0, 5).map((x) => ({
      id: x.id,
      menuId: x.menuId,
      name: x.name,
      category: x.category,
      categoryKey: x.categoryKey,
      categorySlug: x.categorySlug,
      categoryId: x.categoryId,
      type: x.type,
      hasQrCode: !!(x.qrCode || x.shortCode || x.code || x.qr)
    }))
  });
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

function makeUniqueRuntimeShortQrCode(item, startIndex, usedCodes) {
  const existing = String(item?.qrCode || item?.shortCode || item?.code || item?.qr || "").trim();
  if (existing) return existing;

  let index = Math.max(0, Number(startIndex || 0));
  let code = getRuntimeShortQrCode(item, index);

  while (usedCodes?.has(String(code).toLowerCase())) {
    index += 1;
    code = getRuntimeShortQrCode(item, index);
  }

  return code;
}

async function persistMissingQrCode(docRef, item, qrCode) {
  if (!docRef || !qrCode || item?.qrCode || item?.shortCode || item?.code || item?.qr) {
    return String(item?.qrCode || item?.shortCode || item?.code || item?.qr || "").trim();
  }
  try {
    await docRef.set({
      qrCode,
      shortCode: qrCode,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return qrCode;
  } catch (err) {
    console.warn("[Menu QR] qrCode backfill skipped:", { id: docRef.id, qrCode, err });
    return "";
  }
}

async function buildQrMenuCacheFromDocs(docs) {
  const sourceDocs = Array.isArray(docs) ? docs : [];
  return sourceDocs.map((doc) => normalizeMenuItemFromDoc(doc));
}

async function loadQrMenuCache(fallbackSnap) {
  try {
    if (menuLoaded || menuLoadPromise) {
      return loadMenuOnce();
    }

    const snap = await db
      .collection(MENUS_COLLECTION)
      .where("active", "==", true)
      .get();
    return buildQrMenuCacheFromDocs(snap.docs);
  } catch (err) {
    console.warn("[QR] full menu cache skipped:", err);
    return buildQrMenuCacheFromDocs(fallbackSnap?.docs || []);
  }
}

async function loadCategoriesOnce() {
  if (categoriesLoaded) return categoriesCache;
  if (categoriesLoadPromise) return categoriesLoadPromise;

  console.count("loadMenuOnce");

  categoriesLoadPromise = db.collection(CATEGORIES_COLLECTION).get()
    .then((snap) => {
      const cats = [];
      snap.forEach(doc => {
        const c = doc.data();
        if (!c?.category) return;
        cats.push({
          key: String(c.category).trim(),
          name: c.name || c.category,
          image: c.image || "",
          order: Number.isFinite(c.order) ? c.order : 9999
        });
      });

      categoriesCache = cats;
      categoriesLoaded = true;
      return categoriesCache;
    })
    .finally(() => {
      categoriesLoadPromise = null;
    });

  return categoriesLoadPromise;
}

async function loadMenuOnce() {
  if (menuLoaded) return menusCache;
  if (menuLoadPromise) return menuLoadPromise;

  console.count("loadMenuOnce");

  menuLoadPromise = (async function() {
    let snap;
    menuCollectionSource = `${MENUS_COLLECTION}.where(active == true)`;

    try {
      snap = await db
        .collection(MENUS_COLLECTION)
        .where("active", "==", true)
        .get();

      if (snap.empty) {
        console.warn("[MENU] active query returned no items, falling back to full collection.");
        menuCollectionSource = MENUS_COLLECTION;
        snap = await db.collection(MENUS_COLLECTION).get();
      }
    } catch (err) {
      console.warn("[MENU] active query failed, falling back to full collection:", err);
      menuCollectionSource = MENUS_COLLECTION;
      snap = await db.collection(MENUS_COLLECTION).get();
    }

    menusCache = snap.docs
      .map((docSnap) => normalizeMenuItemFromDoc(docSnap))
      .filter(isMenuItemVisible);
    menuLoaded = true;
    window.menusCache = menusCache;
    if (!window.__MENU_TRANSLATION_TABLE_LOGGED__) {
      window.__MENU_TRANSLATION_TABLE_LOGGED__ = true;
      console.table(menusCache.map((x) => ({
        id: x.id,
        category: x.category,
        name: x.name,
        description: x.description,
        nameEn: x.nameEn,
        descriptionEn: x.descriptionEn
      })));
    }

    return menusCache;
  })().finally(() => {
    menuLoadPromise = null;
  });

  return menuLoadPromise;
}

// ---------------- MENU PAGE: categories ----------------
async function renderCategoriesPage() {
  console.count("renderMenu");
  const topRow = document.getElementById("topRow");
  const bottomRow = document.getElementById("bottomRow");

  if (!topRow || !bottomRow) {
    console.error("Missing #topRow / #bottomRow in menu.html");
    return;
  }

  topRow.innerHTML = "";
  bottomRow.innerHTML = "";
  topRow.classList.remove('last-row');
  topRow.removeAttribute('data-last-row-count');
  bottomRow.classList.remove('last-row');
  bottomRow.removeAttribute('data-last-row-count');
  document.querySelectorAll('.digital-menu-board .menu-row:not(#topRow):not(#bottomRow)').forEach((row) => row.remove());

  const cats = (await loadCategoriesOnce()).slice();

  /*
  const cats = [];
  snap.forEach(doc => {
    const c = doc.data();
    if (!c?.category) return;
    cats.push({
      key: String(c.category).trim(),     // "bread"
      name: c.name || c.category,         // "Пърленки и хлебчета"
      image: c.image || "",               // "categories/bread.jpg"
      order: Number.isFinite(c.order) ? c.order : 9999
    });
  });
  */

  // Stable display order: starters, salads, mains, etc.
  cats.sort((a, b) => {
    const aKey = String(a.key || '').toLowerCase();
    const bKey = String(b.key || '').toLowerCase();
    const aIndex = CATEGORY_DISPLAY_ORDER.indexOf(aKey);
    const bIndex = CATEGORY_DISPLAY_ORDER.indexOf(bKey);
    const aRank = aIndex === -1 ? 999 : aIndex;
    const bRank = bIndex === -1 ? 999 : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    if (a.order !== b.order) return a.order - b.order;
    return aKey.localeCompare(bKey);
  });

  console.log("Categories loaded:", cats.map(x => x.key));

  // Category translations
  const lang = getMenuLanguage();
  const categoryTranslations = {
    en: {
      pasta: 'Pasta',
      burger: 'Burger & Tortilla',
      bread: 'Bread',
      pizza: 'Pizza',
      chicken: 'Chicken',
      pork: 'Pork',
      veal: 'Veal',
      fish: 'Fish',
      salad: 'Salads',
      salads: 'Salads',
      starter: 'Starters',
      starters: 'Starters',
      saj: 'Saj',
      dessert: 'Desserts',
      drinks: 'Drinks'
    },
    bg: {
      pasta: 'Паста',
      burger: 'Бургер и Тортила',
      bread: 'Пърленки и Хлебчета',
      pizza: 'Пици',
      chicken: 'Пиле',
      pork: 'Свинско',
      veal: 'Телешко',
      fish: 'Рибни',
      salad: 'Салати',
      salads: 'Салати',
      starter: 'Стартери',
      starters: 'Стартери',
      saj: 'Сачове',
      dessert: 'Десерти',
      drinks: 'Напитки'
    }
  };

  // Distribute categories into rows of 5
  const CATEGORIES_PER_ROW = 5;
  const totalRows = Math.ceil(cats.length / CATEGORIES_PER_ROW);
  
  cats.forEach((cat, idx) => {
    const card = document.createElement("div");
    card.className = "menu-card";
    card.onclick = () =>
      (window.location.href = `category.html?category=${encodeURIComponent(cat.key)}`);

    // Translate category name
    const catKey = cat.key.toLowerCase();
    const translatedName = typeof window.getTranslatedCategory === "function"
      ? window.getTranslatedCategory(cat.key || cat.name)
      : (categoryTranslations[lang] && categoryTranslations[lang][catKey]
        ? categoryTranslations[lang][catKey]
        : cat.name);

    card.innerHTML = `
      <div class="card-image">
        <img src="${resolveImg(cat.image, { kind: "category", categoryKey: cat.key })}" alt="${translatedName}">
      </div>
      <div class="card-label">${translatedName}</div>
    `;

    // Determine which row to add to
    const rowIndex = Math.floor(idx / CATEGORIES_PER_ROW);
    let currentRow;
    
    if (rowIndex === 0) {
      currentRow = topRow;
    } else if (rowIndex === 1) {
      currentRow = bottomRow;
    } else {
      // Create additional rows if needed
      const digitalMenuBoard = topRow.parentElement;
      const rowId = `menu-row-${rowIndex + 1}`;
      let nextRow = document.getElementById(rowId);
      
      if (!nextRow) {
        nextRow = document.createElement("div");
        nextRow.className = "menu-row";
        nextRow.id = rowId;
        digitalMenuBoard.appendChild(nextRow);
      }
      currentRow = nextRow;
    }
    
    currentRow.appendChild(card);
    
    // Add class to last row items for special styling
    const isLastRow = rowIndex === totalRows - 1;
    const itemsInLastRow = cats.length % CATEGORIES_PER_ROW || CATEGORIES_PER_ROW;
    if (isLastRow && itemsInLastRow < CATEGORIES_PER_ROW) {
      card.classList.add('last-row-item');
      card.setAttribute('data-last-row-count', itemsInLastRow);
      // Also add class to the row container
      currentRow.classList.add('last-row');
      currentRow.setAttribute('data-last-row-count', itemsInLastRow);
    }
  });
}

// ---------------- CATEGORY PAGE: items ----------------
async function renderCategoryPage() {
  console.count("renderMenu");
  const renderRunId = ++categoryRenderRunId;
  const menuDiv = document.getElementById("menu");
  const titleEl = document.getElementById("category-title");

  if (!menuDiv) {
    console.error("Missing #menu in category.html");
    return;
  }
  bindMenuPopupDelegation();

  const cat = (currentCategory || "").trim();
  if (!cat) {
    const lang = getMenuLanguage();
    const errorMsg = lang === 'bg' ? 'Липсва category параметър в URL.' : 'Missing category parameter in URL.';
    menuDiv.innerHTML = `<p>${errorMsg}</p>`;
    return;
  }

  if (titleEl) {
    // Get translation for category
    const lang = getMenuLanguage();
    const categoryTranslations = {
      en: {
        pasta: 'Pasta',
        burger: 'Burger & Tortilla',
        bread: 'Bread',
        pizza: 'Pizza',
        chicken: 'Chicken',
        pork: 'Pork',
        veal: 'Veal',
        fish: 'Fish',
        salad: 'Salads',
        salads: 'Salads',
        starter: 'Starters',
        starters: 'Starters',
        saj: 'Saj',
        dessert: 'Desserts',
        drinks: 'Drinks'
      },
      bg: {
        pasta: 'Паста',
        burger: 'Бургер и Тортила',
        bread: 'Пърленки и Хлебчета',
        pizza: 'Пици',
        chicken: 'Пиле',
        pork: 'Свинско',
        veal: 'Телешко',
        fish: 'Рибни',
        salad: 'Салати',
        salads: 'Салати',
        starter: 'Стартери',
        starters: 'Стартери',
        saj: 'Сачове',
        dessert: 'Десерти',
        drinks: 'Напитки'
      }
    };
    
    const catKey = cat.toLowerCase();
    const translatedName = typeof window.getTranslatedCategory === "function"
      ? window.getTranslatedCategory(cat)
      : (categoryTranslations[lang] && categoryTranslations[lang][catKey]
        ? categoryTranslations[lang][catKey]
        : cat.toUpperCase());
    titleEl.textContent = translatedName;
  }

  menuDiv.innerHTML = "";

  const selectedKey = normalizeCategoryValue(cat);
  const allItems = await loadMenuOnce();
  const collectionSource = menuCollectionSource;
  let filteredItems = allItems.filter((item) => menuItemMatchesCategory(item, selectedKey));

  if (!filteredItems.length) {
    filteredItems = allItems.filter((item) => {
      const values = getMenuItemCategoryValues(item);
      return values.some((value) => value.includes(selectedKey) || selectedKey.includes(value));
    });
  }

  logMenuCategoryFilter(
    {
      key: cat,
      slug: cat,
      id: cat,
      name: cat
    },
    selectedKey,
    allItems,
    filteredItems,
    collectionSource
  );

  window.menusCache = allItems;
  window.menuItems = filteredItems;

  if (!filteredItems.length) {
    const lang = getMenuLanguage();
    const emptyMsg = lang === 'bg' ? 'Няма заредени ястия за тази категория.' : 'No loaded items for this category.';
    menuDiv.innerHTML = `<p>${emptyMsg}</p>`;
    return;
  }

  const displayItems = filteredItems.map((item, index) => ({
    item,
    index,
    translatedItem: getMenuItemForDisplay(item)
  }));

  if (renderRunId !== categoryRenderRunId) return;

  for (const { item, translatedItem, index } of displayItems) {
    const existingMenuId = getMenuItemStableId(item);
    const safeMenuId = existingMenuId || `${selectedKey}-${index}`;
    if (!existingMenuId) {
      item.id = safeMenuId;
      item.menuId = safeMenuId;
      item.itemId = safeMenuId;
    }
    const displayName = translatedItem.displayName || "Unknown Item";
    const displayDescription = translatedItem.displayDescription || "";

    const itemEl = document.createElement("div");
    itemEl.className = "menu-item";
    itemEl.style.cursor = 'pointer';
    itemEl.setAttribute("data-menu-item-id", safeMenuId);
    itemEl.dataset.id = safeMenuId;
    itemEl.dataset.itemId = safeMenuId;
    
    // Build HTML with only available data
    let itemHTML = `<img src="${resolveImg(item.image)}" alt="${escapeHtml(displayName)}">
      <div class="item-info">
        <h3 data-menu-item-title>${escapeHtml(displayName)}</h3>`;
    
    if (displayDescription) {
      itemHTML += `<p data-menu-item-description>${escapeHtml(displayDescription)}</p>`;
    }
    
    if (item.price != null) {
      itemHTML += `<span>${Number(item.price).toFixed(2)} €</span>`;
    }
    
    itemHTML += `</div>`;
    
    itemEl.innerHTML = itemHTML;
    menuDiv.appendChild(itemEl);
    updateMenuCardTranslationAsync(itemEl, item);
  }

  bindMenuPopupDelegation();
}

// ---------------- Run ----------------
let menuRenderQueued = false;
let menuRenderPromise = Promise.resolve();

function renderCurrentMenuCategory() {
  if (menuRenderQueued) return menuRenderPromise;

  menuRenderQueued = true;
  menuRenderPromise = Promise.resolve()
    .then(async () => {
      menuRenderQueued = false;
      if (isCategoryPage) {
        await renderCategoryPage();
      } else {
        await renderCategoriesPage();
      }
    })
    .catch((e) => {
      console.error(e);
    });

  return menuRenderPromise;
}

function rerenderMenuPageForLanguage() {
  return renderCurrentMenuCategory();
}

window.renderCategoryPage = renderCategoryPage;
window.renderCategoriesPage = renderCategoriesPage;
window.renderCurrentMenuCategory = renderCurrentMenuCategory;
window.findMenuItemById = findMenuItemById;
window.bindMenuPopupDelegation = bindMenuPopupDelegation;
window.updateMenuCardTranslationAsync = updateMenuCardTranslationAsync;

if (!window.__SERVE_MENU_LANGUAGE_BOUND__) {
  window.__SERVE_MENU_LANGUAGE_BOUND__ = true;
  window.addEventListener("languagechange", rerenderMenuPageForLanguage);
  window.addEventListener("storage", (event) => {
    if (event.key === "language" || event.key === "lang") {
      rerenderMenuPageForLanguage();
    }
  });
}

if (!window.__SERVE_MENU_PAGE_INIT__) {
  window.__SERVE_MENU_PAGE_INIT__ = true;

  (async function main() {
  try {
    if (isCategoryPage) {
      await renderCategoryPage();
    } else {
      await renderCategoriesPage();
    }
  } catch (e) {
    console.error(e);
    const fallback = document.getElementById("menu");
    if (fallback) fallback.innerHTML = "<p>Грешка при зареждане.</p>";
  }
  })();
}
