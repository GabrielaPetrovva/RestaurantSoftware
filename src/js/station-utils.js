const norm = (value) => String(value ?? "").trim().toLowerCase();

const BAR_STATION_VALUES = new Set([
  "bar",
  "drink",
  "drinks",
  "beverage",
  "beverages",
  "napitki",
  "napitka",
  "бар",
  "напитки"
]);

const KITCHEN_STATION_VALUES = new Set([
  "kitchen",
  "food",
  "kitchenfood",
  "cook",
  "kuhnq",
  "kuhnya",
  "kuhnia",
  "kuhnenska",
  "готвено",
  "кухня"
]);

const DRINK_CATEGORY_HINTS = [
  "drink",
  "drinks",
  "beverage",
  "beverages",
  "napit",
  "coffee",
  "tea",
  "bar"
];

const DRINK_NAME_KEYWORDS = [
  "drink",
  "drinks",
  "beverage",
  "beverages",
  "juice",
  "tea",
  "coffee",
  "water",
  "sparkling",
  "soda",
  "cola",
  "fanta",
  "sprite",
  "red bull",
  "energy",
  "beer",
  "wine",
  "whiskey",
  "vodka",
  "gin",
  "rum",
  "rakia",
  "ayran",
  "lemonade",
  "чай",
  "кафе",
  "вода",
  "минерална",
  "газирана",
  "сок",
  "бира",
  "вино",
  "кола",
  "фанта",
  "спрайт",
  "ред бул",
  "енергийна",
  "уиски",
  "водка",
  "джин",
  "ром",
  "ракия",
  "айрян",
  "лимонада"
];

export function normalizeStationValue(value) {
  const key = norm(value);
  if (!key) return "";
  if (BAR_STATION_VALUES.has(key)) return "bar";
  if (KITCHEN_STATION_VALUES.has(key)) return "kitchen";
  return "";
}

export function looksLikeDrink(value) {
  const text = norm(value);
  if (!text) return false;
  return DRINK_NAME_KEYWORDS.some((keyword) => text.includes(keyword));
}

function categoryLooksDrink(value) {
  const key = norm(value);
  if (!key) return false;
  return DRINK_CATEGORY_HINTS.some((hint) => key.includes(hint));
}

export function buildMenuIndexByIdAndName(rows = []) {
  const byId = new Map();
  const byName = new Map();

  for (const raw of rows) {
    if (!raw) continue;

    const id = String(raw.id || raw.menuId || raw.itemId || "").trim();
    const name = String(raw.name || raw.title || raw.itemName || "").trim();
    const station = normalizeStationValue(
      raw.station ||
      raw.department ||
      raw.prepStation ||
      raw.destination ||
      ""
    );
    const category = String(raw.category || raw.type || raw.group || "").trim();

    const row = {
      ...raw,
      id,
      name,
      station,
      category
    };

    if (id) byId.set(id, row);
    if (name) byName.set(norm(name), row);
  }

  return { byId, byName };
}

export function resolveMenuForItem(item, menuIndex = {}) {
  const byId = menuIndex.byId instanceof Map ? menuIndex.byId : new Map();
  const byName = menuIndex.byName instanceof Map ? menuIndex.byName : new Map();

  const menuId = String(item?.menuId || "").trim();
  const itemId = String(item?.itemId || "").trim();

  if (menuId && byId.has(menuId)) return byId.get(menuId);
  if (itemId && byId.has(itemId)) return byId.get(itemId);

  const nameCandidates = [
    item?.name,
    item?.title,
    item?.itemName,
    item?.itemId,
    item?.menuId
  ];

  for (const candidate of nameCandidates) {
    const key = norm(candidate);
    if (key && byName.has(key)) return byName.get(key);
  }

  return null;
}

export function resolveStationForItem(item, resolvedMenu, displayName = "") {
  const direct = normalizeStationValue(
    item?.station ||
    item?.department ||
    item?.prepStation ||
    item?.destination ||
    ""
  );
  if (direct) return direct;

  const menuStation = normalizeStationValue(
    resolvedMenu?.station ||
    resolvedMenu?.department ||
    resolvedMenu?.prepStation ||
    resolvedMenu?.destination ||
    ""
  );
  if (menuStation) return menuStation;

  const category = String(
    item?.category ||
    item?.type ||
    item?.group ||
    resolvedMenu?.category ||
    resolvedMenu?.type ||
    resolvedMenu?.group ||
    ""
  ).trim();
  if (category) return categoryLooksDrink(category) ? "bar" : "kitchen";

  const fallbackName = String(
    displayName ||
    item?.name ||
    resolvedMenu?.name ||
    item?.itemId ||
    item?.menuId ||
    ""
  ).trim();
  return looksLikeDrink(fallbackName) ? "bar" : "kitchen";
}
