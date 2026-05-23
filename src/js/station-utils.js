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
  "напитка",
  "напитки",
  "Р±Р°СЂ",
  "РЅР°РїРёС‚РєРё"
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
  "кухня",
  "готвено",
  "РіРѕС‚РІРµРЅРѕ",
  "РєСѓС…РЅСЏ"
]);

const DRINK_CATEGORY_WORDS = [
  "drink", "drinks",
  "beverage", "beverages",
  "bar", "бар",
  "напитка", "напитки", "napit", "напит",
  "alcohol", "алкохол",
  "coffee", "кафе",
  "tea", "чай",
  "wine", "вино",
  "beer", "бира",
  "cocktail", "коктейл"
];

const DRINK_WORDS = [
  "напитка", "напитки", "drink", "drinks", "beverage", "beverages",

  "вода", "water", "минерална", "минерал", "газирана", "газира",
  "sparkling", "сода", "soda", "тоник",
  "cola", "кола", "coke", "pepsi", "пепси",
  "fanta", "фанта", "sprite", "спрайт",
  "сок", "juice", "фреш", "fresh",
  "лимонада", "lemonade", "айрян", "ayran",

  "кафе", "coffee", "еспресо", "espresso",
  "капучино", "cappuccino", "лате", "латте", "latte",
  "макиато", "macchiato", "американо", "americano",
  "фрапе", "frappe", "мока", "mocha",

  "чай", "tea",

  "бира", "beer", "вино", "wine",
  "бяло вино", "white wine", "червено вино", "red wine",
  "розе", "rose", "rosé", "просеко", "prosecco",
  "шампанско", "champagne",

  "уиски", "whisky", "whiskey", "водка", "vodka",
  "ракия", "rakia", "ром", "rum", "джин", "gin",
  "текила", "tequila", "коняк", "cognac",
  "бренди", "brandy", "ликьор", "liqueur",

  "коктейл", "cocktail", "мохито", "mojito",
  "маргарита", "margarita", "джин тоник", "gin tonic",
  "аперол", "aperol", "сприц", "spritz",

  "ред бул", "red bull", "monster", "монстър",
  "енергийна", "energy", "енерг"
];

export const READY_DESSERT_WORDS = [
  "торта",
  "торти",
  "cake",
  "cakes",
  "шоколадова торта",
  "чийзкейк",
  "cheesecake",
  "тирамису",
  "tiramisu",
  "баклава",
  "baklava",
  "сладолед",
  "ice cream",
  "паста",
  "пасти",
  "еклер",
  "еклери",
  "мъфин",
  "muffin",
  "крем карамел",
  "крем",
  "десерт в чаша"
];

export const MADE_TO_ORDER_DESSERT_WORDS = [
  "палачинка",
  "палачинки",
  "pancake",
  "pancakes",
  "гофрета",
  "гофрети",
  "waffle",
  "waffles",
  "суфле",
  "souffle",
  "катма",
  "катми",
  "fried dessert",
  "hot dessert"
];

export const DESSERT_CATEGORY_WORDS = [
  "dessert",
  "desserts",
  "desert",
  "deserts",
  "десерт",
  "десерти",
  "сладки",
  "sweet",
  "sweets"
];

export const PASTA_FOOD_WORDS = [
  "карбонара",
  "carbonara",
  "болонезе",
  "bolognese",
  "спагети",
  "spaghetti",
  "макарони",
  "macaroni",
  "пене",
  "penne",
  "tagliatelle",
  "талятели"
];

export function hasAnyKeyword(text, keywords) {
  const source = String(text || "").toLowerCase();
  return keywords.some((word) => source.includes(String(word).toLowerCase()));
}

export function normalizeStationValue(value) {
  const key = norm(value);
  if (!key) return "";
  if (BAR_STATION_VALUES.has(key)) return "bar";
  if (KITCHEN_STATION_VALUES.has(key)) return "kitchen";
  return "";
}

export function buildStationText(item, resolvedMenu) {
  return [
    item?.name,
    item?.title,
    item?.productName,
    item?.itemName,
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

export function looksLikeDessertCategory(item, resolvedMenu = null) {
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

export function looksLikeMadeToOrderDessert(item, resolvedMenu = null) {
  const text = buildStationText(item, resolvedMenu);
  return hasAnyKeyword(text, MADE_TO_ORDER_DESSERT_WORDS);
}

export function looksLikePastaFood(item, resolvedMenu = null) {
  const text = buildStationText(item, resolvedMenu);
  return hasAnyKeyword(text, ["паста", "пасти"]) && hasAnyKeyword(text, PASTA_FOOD_WORDS);
}

export function looksLikeReadyDessert(item, resolvedMenu = null) {
  const text = typeof item === "string" && !resolvedMenu
    ? norm(item)
    : buildStationText(item, resolvedMenu);

  if (hasAnyKeyword(text, ["паста", "пасти"]) && hasAnyKeyword(text, PASTA_FOOD_WORDS)) return false;

  return hasAnyKeyword(text, READY_DESSERT_WORDS);
}

export function looksLikeDrink(item, resolvedMenu = null) {
  if (item && typeof item === "object") {
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

    return hasAnyKeyword(buildStationText(item, resolvedMenu), DRINK_WORDS);
  }

  const text = norm(item);
  return hasAnyKeyword(text, DRINK_WORDS) || hasAnyKeyword(text, DRINK_CATEGORY_WORDS);
}

export function looksLikeCake(value, resolvedMenu = null) {
  return looksLikeReadyDessert(value, resolvedMenu);
}

function stationLogName(item, resolvedMenu) {
  return String(
    item?.name ||
    item?.title ||
    item?.productName ||
    item?.itemName ||
    resolvedMenu?.name ||
    resolvedMenu?.title ||
    item?.itemId ||
    item?.menuId ||
    ""
  ).trim();
}

function stationLogCategory(item, resolvedMenu) {
  return String(
    item?.category ||
    item?.categoryKey ||
    item?.categorySlug ||
    item?.type ||
    resolvedMenu?.category ||
    resolvedMenu?.categoryKey ||
    resolvedMenu?.categorySlug ||
    resolvedMenu?.type ||
    ""
  ).trim();
}

function logStationRouting(item, resolvedMenu, directStation, finalStation, reason) {
  console.log("[station-routing]", {
    name: stationLogName(item, resolvedMenu),
    category: stationLogCategory(item, resolvedMenu),
    directStation,
    finalStation,
    reason
  });
}

export function resolveFinalStation(item, resolvedMenu = null) {
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
    const category = String(raw.category || raw.categoryKey || raw.type || raw.group || "").trim();

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
    item?.productName,
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
  return resolveFinalStation(
    displayName ? { ...item, name: displayName || item?.name } : item,
    resolvedMenu
  );
}
