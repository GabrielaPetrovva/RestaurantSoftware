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
function resolveImg(path) {
  if (!path) return "../images/default.jpg";
  if (path.startsWith("http")) return path;
  if (path.startsWith("../") || path.startsWith("/")) return path;
  return `../images/${path}`;
}

const isCategoryPage = window.location.pathname.includes("category.html");
const urlParams = new URLSearchParams(window.location.search);
const currentCategory = urlParams.get("category"); // напр. "burger"

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

  // sort by order
  cats.sort((a, b) => a.order - b.order);

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
        <img src="${resolveImg(cat.image)}" alt="${translatedName}">
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

  // IMPORTANT: category в базата ти е "burger", "bread" и т.н.
  const snap = await db
    .collection(MENUS_COLLECTION)
    .where("active", "==", true)
    .where("category", "==", cat)
    .get();

  console.log(`Items loaded for "${cat}":`, snap.size);

  if (snap.empty) {
    const lang = localStorage.getItem('language') || 'en';
    const emptyMsg = lang === 'bg' ? 'Няма активни ястия в тази категория.' : 'No active items in this category.';
    menuDiv.innerHTML = `<p>${emptyMsg}</p>`;
    return;
  }

  snap.forEach(doc => {
    const item = doc.data();
    const lang = localStorage.getItem('language') || 'en';
    const noDesc = lang === 'bg' ? 'Описание не е налично' : 'Description not available';
    const noPrice = lang === 'bg' ? 'Цена не е зададена' : 'Price not set';

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
      const price = item.price != null ? item.price + ' лв' : noPrice;
      const priceValue = item.price || 0;
      
      showNutritionInfo(
        item.name || 'Unknown Item',
        item.description || noDesc,
        calories,
        carbs,
        protein,
        fat,
        weight,
        price,
        priceValue,
        resolveImg(item.image)
      );
    };
    
    itemEl.innerHTML = `
      <img src="${resolveImg(item.image)}" alt="${item.name || "Item"}">
      <div class="item-info">
        <h3>${item.name || "Unknown Item"}</h3>
        <p>${item.description || noDesc}</p>
        <span>${item.price != null ? item.price + " лв" : noPrice}</span>
      </div>
    `;
    menuDiv.appendChild(itemEl);
  });
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
