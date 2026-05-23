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
firebase.initializeApp(firebaseConfig);
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

// ---------------- MENU PAGE: categories ----------------
async function renderCategoriesPage() {
  const topRow = document.getElementById("topRow");
  const bottomRow = document.getElementById("bottomRow");

  if (!topRow || !bottomRow) {
    console.error("Missing #topRow / #bottomRow in menu.html");
    return;
  }

  topRow.innerHTML = "";
  bottomRow.innerHTML = "";

  const snap = await db.collection(CATEGORIES_COLLECTION).get();

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
  const lang = localStorage.getItem('language') || 'en';
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
    const translatedName = categoryTranslations[lang] && categoryTranslations[lang][catKey] 
      ? categoryTranslations[lang][catKey] 
      : cat.name;

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
  const menuDiv = document.getElementById("menu");
  const titleEl = document.getElementById("category-title");

  if (!menuDiv) {
    console.error("Missing #menu in category.html");
    return;
  }

  const cat = (currentCategory || "").trim();
  if (!cat) {
    const lang = localStorage.getItem('language') || 'en';
    const errorMsg = lang === 'bg' ? 'Липсва category параметър в URL.' : 'Missing category parameter in URL.';
    menuDiv.innerHTML = `<p>${errorMsg}</p>`;
    return;
  }

  if (titleEl) {
    // Get translation for category
    const lang = localStorage.getItem('language') || 'en';
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
    const translatedName = categoryTranslations[lang] && categoryTranslations[lang][catKey] 
      ? categoryTranslations[lang][catKey] 
      : cat.toUpperCase();
    titleEl.textContent = translatedName;
  }

  menuDiv.innerHTML = "";

  let snap;
  let collectionSource = `${MENUS_COLLECTION}.where(active == true)`;

  try {
    snap = await db
      .collection(MENUS_COLLECTION)
      .where("active", "==", true)
      .get();

    if (snap.empty) {
      console.warn("[MENU] active query returned no items, falling back to full collection.");
      collectionSource = MENUS_COLLECTION;
      snap = await db.collection(MENUS_COLLECTION).get();
    }
  } catch (err) {
    console.warn("[MENU] active query failed, falling back to full collection:", err);
    collectionSource = MENUS_COLLECTION;
    snap = await db.collection(MENUS_COLLECTION).get();
  }

  const selectedKey = normalizeCategoryValue(cat);
  const allItems = snap.docs
    .map((docSnap) => normalizeMenuItemFromDoc(docSnap))
    .filter(isMenuItemVisible);
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
    const lang = localStorage.getItem('language') || 'en';
    const emptyMsg = lang === 'bg' ? 'Няма заредени ястия за тази категория.' : 'No loaded items for this category.';
    menuDiv.innerHTML = `<p>${emptyMsg}</p>`;
    return;
  }

  for (const item of filteredItems) {
    const safeMenuId = item.menuId || item.itemId || item.id || item.docId || "";

    const itemEl = document.createElement("div");
    itemEl.className = "menu-item";
    itemEl.style.cursor = 'pointer';
    
    // Add click handler to show nutrition modal
    itemEl.onclick = function() {
      const calories = item.calories || 0;
      const carbs = item.carbs || 0;
      const protein = item.protein || 0;
      const fat = item.fat || 0;
      const weight = item.weight || '';
      const price = item.price != null ? Number(item.price).toFixed(2) + ' €' : '';
      const priceValue = item.price || 0;
      
      showNutritionInfo(
        item.name || 'Unknown Item',
        item.description || '',
        calories,
        carbs,
        protein,
        fat,
        weight,
        price,
        priceValue,
          resolveImg(item.image),
        {
          id: safeMenuId,
          menuId: safeMenuId,
          itemId: safeMenuId,
          category: item.category || item.categoryKey || item.categorySlug || item.categoryId || item.type || "",
          station: item.station || item.targetStation || item.department || "",
          qrCode: item.qrCode || item.shortCode || item.code || item.qr || "",
          shortCode: item.shortCode || item.qrCode || item.code || item.qr || "",
          code: item.code || item.qrCode || item.shortCode || item.qr || "",
          qr: item.qr || item.qrCode || item.shortCode || item.code || ""
        }
      );
    };
    
    // Build HTML with only available data
    let itemHTML = `<img src="${resolveImg(item.image)}" alt="${item.name || "Item"}">
      <div class="item-info">
        <h3>${item.name || "Unknown Item"}</h3>`;
    
    if (item.description) {
      itemHTML += `<p>${item.description}</p>`;
    }
    
    if (item.price != null) {
      itemHTML += `<span>${Number(item.price).toFixed(2)} €</span>`;
    }
    
    itemHTML += `</div>`;
    
    itemEl.innerHTML = itemHTML;
    menuDiv.appendChild(itemEl);
  }
}

// ---------------- Run ----------------
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
