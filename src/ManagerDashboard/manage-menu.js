// manage-menu.js — SAVE IMAGE AS PATH
// ✅ Newly selected images save as normalized project paths
// ✅ Existing path/base64 images still preview correctly
// ✅ No Firebase Storage

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, doc, getDoc, onSnapshot,
  addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ================= CATEGORY MAPS ================= */
const CATEGORY_BG_TO_EN = {
  "Пърленки и хлебчета": "bread",
  "Бургер и тортила": "burger",
  "Пилешко": "chicken",

  // ✅ FIX: да е desserts (а не dessert)
  "Десерти": "desserts",

  "Напитки": "drinks",
  "Риба": "fish",
  "Паста и ризото": "pasta",
  "Пици": "pizza",
  "Свинско": "pork",
  "Сачове": "saj",
  "Салати": "salads",
  "Предястия": "starters",
  "Телешко": "veal",
};
const CATEGORY_EN_TO_BG = Object.fromEntries(
  Object.entries(CATEGORY_BG_TO_EN).map(([bg, en]) => [en, bg])
);
const CATEGORY_IMAGE_FOLDER_ALIASES = {
  drink: "drinks",
  drinks: "drinks",
  pizza: "pizza",
  dessert: "dessert",
  desserts: "dessert",
  salad: "salad",
  salads: "salad",
  starter: "starters",
  starters: "starters",
};
const CATEGORY_KEY_ALIASES = {
  drink: "drinks",
  drinks: "drinks",
  dessert: "desserts",
  desserts: "desserts",
  salad: "salads",
  salads: "salads",
  starter: "starters",
  starters: "starters",
};

function normalizeCategoryKeyToken(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[+\s-]+/g, "_")
    .replace(/_category$/, "");
}

function normalizeCategoryToEN(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (CATEGORY_BG_TO_EN[s]) return CATEGORY_BG_TO_EN[s];
  const normalized = normalizeCategoryKeyToken(s);
  return CATEGORY_KEY_ALIASES[normalized] || normalized;
}
function categoryForInputDisplay(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return CATEGORY_EN_TO_BG[s] || s;
}
function categoryKeyToImageFolder(v) {
  const key = normalizeCategoryToEN(v);
  if (!key) return "";
  return CATEGORY_IMAGE_FOLDER_ALIASES[key] || key;
}

/* ================= DOM HELPERS ================= */
function $(id) { return document.getElementById(id); }
function q(sel) { return document.querySelector(sel); }
function pickEl(...candidates) {
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string") {
      const el = $(c) || q(c);
      if (el) return el;
    } else if (c instanceof Element) {
      return c;
    }
  }
  return null;
}

/* ================= UI HELPERS ================= */
function setErr(msg) {
  console.error(msg);
  const errorEl = pickEl("menuError", "#menuError", ".menu-error");
  if (errorEl) errorEl.textContent = msg;
}
function clearErr() {
  const errorEl = pickEl("menuError", "#menuError", ".menu-error");
  if (errorEl) errorEl.textContent = "";
}
function norm(x) { return String(x ?? "").trim(); }
function cleanId(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
}
function numOrNull(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ✅ FIX: грамаж винаги "300 г."
function normalizeWeight(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";

  // взима числото (ако има)
  const m = s.match(/(\d+([.,]\d+)?)/);
  if (!m) return s;

  const n = m[1].replace(",", ".");
  return `${n} г.`;
}

/* ================= IMAGE HELPERS ================= */

// DB PATH: "..\\images\\pizza_category\\pizza.jpg"
// UI SRC:  "/images/pizza_category/pizza.jpg"
function dbImageToPublicSrc(dbPath) {
  let p = String(dbPath || "").trim();
  if (!p) return "";

  // allow url / base64
  if (/^(https?:)?\/\//i.test(p)) return p;
  if (/^data:image\//i.test(p)) return p;

  p = p.replace(/\\/g, "/");
  const normalizedLower = p.toLowerCase();

  // contains /images/ somewhere
  const idx = normalizedLower.indexOf("/images/");
  if (idx >= 0) return `..${p.slice(idx)}`;
  const imageIdx = normalizedLower.indexOf("/image/");
  if (imageIdx >= 0) return `../images/${p.slice(imageIdx + "/image/".length)}`;

  // ../images/... -> /images/...
  if (normalizedLower.startsWith("../images/")) return p;
  if (normalizedLower.startsWith("../image/")) return `../images/${p.slice("../image/".length)}`;

  // ./images/... -> /images/...
  if (normalizedLower.startsWith("./images/")) return `..${p.slice(1)}`;
  if (normalizedLower.startsWith("./image/")) return `../images/${p.slice("./image/".length)}`;

  // images/... -> /images/...
  if (normalizedLower.startsWith("images/")) return `../${p}`;
  if (normalizedLower.startsWith("image/")) return `../images/${p.slice("image/".length)}`;

  return p;
}

// Main helper for new path-based image values.
function buildDbImagePath(categoryEN, fileName) {
  const cat = categoryKeyToImageFolder(categoryEN);
  if (!cat) return "";

  const folder = `${cat}_category`;
  const file = String(fileName || "").replace(/\\/g, "/").split("/").pop();
  if (!file) return "";

  return normalizeDbImagePath(`../images/${folder}/${file}`);
}

function normalizeImageFolderPath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw)) return raw;
  if (/^data:image\//i.test(raw)) return raw;

  let normalized = raw.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const imagesMarker = "/images/";
  const idx = lower.indexOf(imagesMarker);
  const imageMarker = "/image/";
  const imageIdx = lower.indexOf(imageMarker);

  if (idx >= 0) {
    normalized = `../images/${normalized.slice(idx + imagesMarker.length)}`;
  } else if (imageIdx >= 0) {
    normalized = `../images/${normalized.slice(imageIdx + imageMarker.length)}`;
  } else if (/^\.\.\/images\//i.test(normalized)) {
    normalized = `../images/${normalized.slice("../images/".length)}`;
  } else if (/^\.\.\/image\//i.test(normalized)) {
    normalized = `../images/${normalized.slice("../image/".length)}`;
  } else if (/^\.\/images\//i.test(normalized)) {
    normalized = `../images/${normalized.slice("./images/".length)}`;
  } else if (/^\.\/image\//i.test(normalized)) {
    normalized = `../images/${normalized.slice("./image/".length)}`;
  } else if (/^images\//i.test(normalized)) {
    normalized = `../images/${normalized.slice("images/".length)}`;
  } else if (/^image\//i.test(normalized)) {
    normalized = `../images/${normalized.slice("image/".length)}`;
  }

  return normalized.replace(/\/{2,}/g, "/");
}

function normalizeDbImagePath(value) {
  const normalized = normalizeImageFolderPath(value);
  if (!normalized) return "";
  if (/^(https?:)?\/\//i.test(normalized)) return normalized;
  if (/^data:image\//i.test(normalized)) return normalized;
  return normalized;
}

// expose (optional)
window.dbImageToPublicSrc = dbImageToPublicSrc;
window.buildDbImagePath = buildDbImagePath;

/* ================= DOM (robust selectors) ================= */
const form = pickEl("menuForm", "#menuForm", "form[data-menu-form]");

const nameEl = pickEl("menuName", "#menuName", 'input[name="name"]');
const categoryEl = pickEl("menuCategory", "#menuCategory", 'input[name="category"]', 'select[name="category"]');
const priceEl = pickEl("menuPrice", "#menuPrice", 'input[name="price"]');
const costEl = pickEl("menuCost", "#menuCost", 'input[name="cost"]');
const stationEl = pickEl("menuStation", "#menuStation", 'select[name="station"]', 'input[name="station"]');
const activeEl = pickEl("menuActive", "#menuActive", 'input[name="active"]');

const saveBtn = pickEl("menuSaveBtn", "#menuSaveBtn", 'button[type="submit"]');
const cancelBtn = pickEl("menuCancelBtn", "#menuCancelBtn", 'button[data-cancel-menu]', 'button[data-close-menu]');

const listEl = pickEl("menuAdminList", "#menuAdminList");
const countEl = pickEl("menuTotalCount", "#menuTotalCount");

const idEl = pickEl("menuId", "#menuId", 'input[name="id"]');
const descEl = pickEl("menuDescription", "#menuDescription", 'textarea[name="description"]');
const weightEl = pickEl("menuWeight", "#menuWeight", 'input[name="weight"]');

const caloriesEl = pickEl("menuCalories", "#menuCalories", 'input[name="calories"]');
const proteinEl  = pickEl("menuProtein", "#menuProtein", 'input[name="protein"]');
const carbsEl    = pickEl("menuCarbs", "#menuCarbs", 'input[name="carbs"]');
const fatEl      = pickEl("menuFat", "#menuFat", 'input[name="fat"]');

// Image elements
const imageFileEl = pickEl(
  "menuImageFile", "#menuImageFile",
  'input[type="file"][name="image"]',
  'input[type="file"]'
);
const imagePrevEl = pickEl(
  "menuImagePreview", "#menuImagePreview",
  'img[data-image-preview]',
  'img.preview'
);
const imageRemoveBtn = pickEl(
  "menuImageRemoveBtn", "#menuImageRemoveBtn",
  'button[data-remove-image]'
);

/* ================= MODAL ================= */
const modalEl = pickEl("menuEditorModal", "#menuEditorModal", ".menu-modal");
const modalTitleEl = pickEl("menuModalTitle", "#menuModalTitle", "[data-menu-modal-title]");
const openAddBtn = pickEl("openAddMenuModalBtn", "#openAddMenuModalBtn", "[data-open-add-menu]");

function openMenuModal(title = "Нов артикул") {
  if (!modalEl) return;
  if (modalTitleEl) modalTitleEl.textContent = title;
  modalEl.style.display = "block";
  document.body.style.overflow = "hidden";
}
function closeMenuModal() {
  if (!modalEl) return;
  modalEl.style.display = "none";
  document.body.style.overflow = "";
}
window.openMenuModal = openMenuModal;
window.closeMenuModal = closeMenuModal;

function wireModalClose() {
  if (!modalEl) return;

  modalEl.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.hasAttribute("data-close-modal")) closeMenuModal();
    if (t === modalEl) closeMenuModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl.style.display === "block") closeMenuModal();
  });
}

/* ================= IMAGE STATE ================= */
let selectedImageFile = null;
let selectedImagePath = "";
let currentImage = undefined; // undefined=don’t touch, null=remove, string=existing image value

function showPreview(src) {
  if (!imagePrevEl) return;
  if (!src) {
    imagePrevEl.src = "";
    imagePrevEl.style.display = "none";
    if (imageRemoveBtn) imageRemoveBtn.style.display = "none";
    return;
  }
  imagePrevEl.src = src;
  imagePrevEl.style.display = "block";
  if (imageRemoveBtn) imageRemoveBtn.style.display = "inline-flex";
}


function wireImage() {
  if (!imageFileEl) return;

  imageFileEl.addEventListener("change", () => {
    const nextFile = imageFileEl.files?.[0] || null;

    if (!nextFile) {
      selectedImageFile = null;
      selectedImagePath = "";
      showPreview(currentImage ? dbImageToPublicSrc(currentImage) : "");
      return;
    }

    const category = normalizeCategoryToEN(categoryEl?.value);
    if (!category) {
      alert("Първо избери категория, после избери снимка.");
      imageFileEl.value = "";
      selectedImageFile = null;
      selectedImagePath = "";
      showPreview("");
      return;
    }

    selectedImageFile = nextFile;
    selectedImagePath = buildDbImagePath(category, nextFile.name);
    if (!selectedImagePath) {
      alert("Неуспешно генериране на пътя до снимката.");
      imageFileEl.value = "";
      selectedImageFile = null;
      selectedImagePath = "";
      showPreview("");
      return;
    }

    showPreview(URL.createObjectURL(nextFile));
    currentImage = undefined;
  });

  imageRemoveBtn?.addEventListener("click", () => {
    selectedImageFile = null;
    selectedImagePath = "";
    if (imageFileEl) imageFileEl.value = "";
    showPreview("");
    currentImage = null;
  });
}

/* ================= STATE ================= */
let editingId = null;
let started = false;

/* ================= INIT / AUTH GUARD ================= */
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) return;

    const empSnap = await getDoc(doc(db, "employees", user.uid));
    if (!empSnap.exists()) {
      setErr("Няма employees документ за този акаунт.");
      return;
    }
    const emp = empSnap.data();
    if (emp.status !== "active" || emp.role !== "manager") {
      setErr(`Нямаш права. status=${emp.status}, role=${emp.role}`);
      return;
    }

    if (started) return;
    started = true;

    if (!form) {
      setErr("Липсва menuForm в HTML (id или селектор).");
      return;
    }

    clearErr();
    wireModalClose();
    wireForm();
    wireButtons();
    wireImage();
    startCategorySuggestions();
    startMenusListener();
    wireMenuLiveEvents();

    openAddBtn?.addEventListener("click", () => {
      resetForm();
      openMenuModal("Нов артикул");
    });
  } catch (e) {
    setErr("Auth/guard грешка: " + e.message);
  }
});

/* ================= CATEGORY SUGGESTIONS ================= */
function startCategorySuggestions() {
  if (!categoryEl) return;

  let dl = document.getElementById("menuCategoryList");
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = "menuCategoryList";
    document.body.appendChild(dl);
  }
  categoryEl.setAttribute("list", "menuCategoryList");

  onSnapshot(collection(db, "menu_categories"), (snap) => {
    const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    dl.innerHTML = cats
      .map(c => `<option value="${String(c.name ?? c.id).replace(/"/g, "&quot;")}"></option>`)
      .join("");
  }, (err) => setErr("menu_categories: " + err.message));
}

/* ================= MENUS LISTENER ================= */
function startMenusListener() {
  onSnapshot(collection(db, "menus"), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const activeCount = items.filter(i => i.active !== false).length;
    if (countEl) countEl.textContent = String(activeCount);
    if (listEl) renderList(items);
  }, (err) => setErr("menus: " + err.message));
}

/* ================= OPTIONAL ADMIN LIST ================= */
function renderList(items) {
  if (!listEl) return;
  if (!items.length) {
    listEl.innerHTML = `<div style="opacity:.7;">Няма артикули.</div>`;
    return;
  }

  items.sort((a, b) => (b.active !== false) - (a.active !== false));

  listEl.innerHTML = items.map(i => {
    const isActive = i.active !== false;
    return `
      <div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #eee;opacity:${isActive ? 1 : 0.55}">
        <div style="flex:1;min-width:260px">
          <b>${String(i.name ?? "")}</b>
          <div style="font-size:12px;opacity:.8">${String(i.category ?? "")} • ${String(i.station ?? "")}</div>
        </div>
        <div style="width:90px;text-align:right">${Number(i.price ?? 0).toFixed(2)} EUR</div>
        <div style="width:90px;text-align:right">${Number(i.cost ?? 0).toFixed(2)} EUR</div>
        <button type="button" data-edit="${i.id}" class="btn btn-secondary">Edit</button>
        <button type="button" data-toggle="${i.id}" data-active="${isActive ? "1" : "0"}" class="btn btn-secondary">
          ${isActive ? "Deactivate" : "Activate"}
        </button>
        <button type="button" data-del="${i.id}" class="btn btn-secondary">Delete</button>
      </div>
    `;
  }).join("");

  listEl.onclick = async (e) => {
    const btn = e.target;
    if (!(btn instanceof HTMLElement)) return;

    const editId = btn.dataset.edit;
    const toggleId = btn.dataset.toggle;
    const delId = btn.dataset.del;

    try {
      clearErr();

      if (delId) {
        if (!confirm("Сигурен ли си, че триеш артикула?")) return;
        await deleteDoc(doc(db, "menus", delId));
        if (editingId === delId) resetForm();
        return;
      }

      if (toggleId) {
        const currentlyActive = btn.dataset.active === "1";
        await updateDoc(doc(db, "menus", toggleId), {
          active: !currentlyActive,
          updatedAt: serverTimestamp()
        });
        return;
      }

      if (editId) {
        const snap = await getDoc(doc(db, "menus", editId));
        if (!snap.exists()) return alert("Артикулът не съществува.");
        openEdit({ id: editId, ...snap.data() });
        openMenuModal("Редакция на артикул");
      }
    } catch (err) {
      setErr("List action грешка: " + err.message);
      alert(err.message);
    }
  };
}

/* ================= BUTTONS ================= */
function wireButtons() {
  cancelBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetForm();
    closeMenuModal();
  });
}

/* ================= SAVE (ADD/EDIT) ================= */
function wireForm() {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const restoreSaveButton = () => {
      if (!saveBtn) return;
      saveBtn.disabled = false;
      saveBtn.textContent = editingId ? "Запази" : "Добави артикул";
    };

    const manualId = cleanId(idEl?.value);

    const name = norm(nameEl?.value);
    const category = normalizeCategoryToEN(categoryEl?.value);
    const price = numOrNull(priceEl?.value);
    const cost = numOrNull(costEl?.value);
    const station = norm(stationEl?.value || "kitchen");
    const active = activeEl ? !!activeEl.checked : true;

    const description = norm(descEl?.value);
    const weight = normalizeWeight(weightEl?.value);

    const calories = numOrNull(caloriesEl?.value);
    const protein  = numOrNull(proteinEl?.value);
    const carbs    = numOrNull(carbsEl?.value);
    const fat      = numOrNull(fatEl?.value);

    if (!name) return alert("Напиши име на артикул.");
    if (!category) return alert("Въведи категория.");
    if (price == null || price <= 0) return alert("Невалидна цена.");
    if (cost == null || cost < 0) return alert("Невалиден разход (cost).");

    try {
      clearErr();
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Запазване...";
      }

      const payload = {
        name,
        category,
        price,
        cost,
        station,
        active,

        ...(description ? { description } : {}),
        ...(weight ? { weight } : {}),

        ...(calories != null ? { calories } : {}),
        ...(protein  != null ? { protein } : {}),
        ...(carbs    != null ? { carbs } : {}),
        ...(fat      != null ? { fat } : {}),

        updatedAt: serverTimestamp()
      };

      if (selectedImagePath) {
        payload.image = normalizeDbImagePath(selectedImagePath);
      } else if (typeof currentImage === "string" && currentImage.trim()) {
        payload.image = normalizeDbImagePath(currentImage);
      } else if (currentImage === null) {
        payload.image = deleteField();
      }
      // else undefined = don’t touch

      console.log("Saving menu image path:", payload.image);

      if (editingId) {
        // EDIT
        await updateDoc(doc(db, "menus", editingId), payload);
      } else {
        // ADD
        if (manualId) {
          const ref = doc(db, "menus", manualId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            restoreSaveButton();
            return alert("Вече съществува артикул с това ID. Избери друго.");
          }
          payload.createdAt = serverTimestamp();
          await setDoc(ref, payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "menus"), payload);
        }
      }

      resetForm();
      closeMenuModal();
    } catch (err) {
      console.error("Menu save error:", err);
      const message = String(err?.message || err || "Неизвестна грешка.");
      setErr("Запис грешка: " + message);
      alert(message);
      restoreSaveButton();
    }
  });
}

/* ================= EDIT / RESET ================= */
function openEdit(item) {
  editingId = item.id;

  if (idEl) {
    idEl.value = item.id;
    idEl.disabled = true;
  }

  if (nameEl) nameEl.value = item.name ?? "";
  if (categoryEl) categoryEl.value = categoryForInputDisplay(item.category);
  if (priceEl) priceEl.value = item.price ?? "";
  if (costEl) costEl.value = item.cost ?? "";
  if (stationEl) stationEl.value = item.station ?? "kitchen";
  if (activeEl) activeEl.checked = item.active !== false;

  if (descEl) descEl.value = item.description ?? "";
  if (weightEl) weightEl.value = item.weight ?? "";

  if (caloriesEl) caloriesEl.value = item.calories ?? "";
  if (proteinEl)  proteinEl.value  = item.protein ?? "";
  if (carbsEl)    carbsEl.value    = item.carbs ?? "";
  if (fatEl)      fatEl.value      = item.fat ?? "";

  selectedImageFile = null;
  selectedImagePath = "";
  currentImage = item.image || undefined;

  // preview for existing image
  showPreview(currentImage ? dbImageToPublicSrc(currentImage) : "");

  if (imageFileEl) imageFileEl.value = "";

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Запази";
  }
  if (cancelBtn) cancelBtn.style.display = "inline-flex";
}

function resetForm() {
  editingId = null;

  if (idEl) {
    idEl.disabled = false;
    idEl.value = "";
  }

  if (nameEl) nameEl.value = "";
  if (categoryEl) categoryEl.value = "";
  if (priceEl) priceEl.value = "";
  if (costEl) costEl.value = "";
  if (stationEl) stationEl.value = "kitchen";
  if (activeEl) activeEl.checked = true;

  if (descEl) descEl.value = "";
  if (weightEl) weightEl.value = "";
  if (caloriesEl) caloriesEl.value = "";
  if (proteinEl)  proteinEl.value  = "";
  if (carbsEl)    carbsEl.value    = "";
  if (fatEl)      fatEl.value      = "";

  selectedImageFile = null;
  selectedImagePath = "";
  currentImage = undefined;

  if (imageFileEl) imageFileEl.value = "";
  showPreview("");

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Добави артикул";
  }
  if (cancelBtn) cancelBtn.style.display = "none";

  clearErr();
}

/* ================= menu-live.js EVENTS ================= */
function wireMenuLiveEvents() {
  window.addEventListener("menu:edit", async (e) => {
    const id = e?.detail?.id;
    if (!id) return;

    try {
      clearErr();
      const ref = doc(db, "menus", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setErr("Този артикул вече не съществува.");
        return;
      }
      openEdit({ id: snap.id, ...snap.data() });
      openMenuModal("Редакция на артикул");
    } catch (err) {
      setErr("Edit грешка: " + err.message);
    }
  });

  window.addEventListener("menu:toggle", async (e) => {
    const id = e?.detail?.id;
    if (!id) return;

    try {
      clearErr();
      const ref = doc(db, "menus", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setErr("Този артикул вече не съществува.");
        return;
      }
      const data = snap.data();
      const currentlyActive = data?.active !== false;

      await updateDoc(ref, {
        active: !currentlyActive,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      setErr("Toggle грешка: " + err.message);
    }
  });

  window.addEventListener("menu:delete", async (e) => {
    const id = e?.detail?.id;
    if (!id) return;

    try {
      clearErr();
      if (!confirm("Сигурен ли си, че триеш артикула?")) return;

      await deleteDoc(doc(db, "menus", id));

      if (editingId === id) {
        resetForm();
        closeMenuModal();
      }
    } catch (err) {
      setErr("Delete грешка: " + err.message);
    }
  });
}

/* ================= END ================= */




