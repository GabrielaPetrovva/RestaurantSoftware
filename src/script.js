(function () {
  const shouldInitApp = !window.__SERVE_SOFTWARE_APP_INIT__;
  if (!shouldInitApp) {
    console.warn("App already initialized. Refreshing globals without duplicate init.");
  }

  window.__SERVE_SOFTWARE_APP_INIT__ = true;

 // Translation data
 const translations = {
    en: {
      nav: {
        home: 'Home',
        menu: 'Menu',
        about: 'About us',
        contact: 'Contact Us'
      },
      hero: {
        title: 'Taste The Difference',
        button: 'View Menu'
      },
      about: {
        title: 'About Us',
        subtitle: 'Our Story',
        text: 'The restaurant opened its doors in 2015 with one simple idea – to offer genuine taste and comfort in the heart of the city. Since then, we have been combining traditional recipes with modern culinary techniques to create experiences that are truly unforgettable.'
      },
      contact: {
        title: 'Contact Us',    
        subtitle: 'We’d love to hear your thoughts.',
        name: 'Your Name',
        email: 'Email Address',
        message: 'Your Message',
        button: 'Send Message'
      },
      footer: {
        privacy: 'Privacy',
        services: 'Services',
        about: 'About Us',
        quickLinks: 'Quick Links',
        menu: 'Menu',
        story: 'Our Story',
        reservations: 'Reservations',
        social: 'Social Media'
      },
      categories: {
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
      order: {
        title: 'Your Order',
        empty: 'No items added',
        total: 'Total',
        generateQR: 'Generate QR Code'
      },
      nutrition: {
        calories: 'Calories',
        carbs: 'Carbs (g)',
        protein: 'Protein (g)',
        fat: 'Fat (g)',
        addToCart: 'Add to Cart'
      },
      category: {
        backToMenu: '← Back to Menu',
        label: 'Category',
        subtitle: 'Explore the selection and choose your favorite dishes.'
      },
      menu: {
        heroTitle: 'Discover Our Categories',
        heroSubtitle: 'Choose a category and explore the full selection of dishes.'
      },
      receipt: {
        title: 'Last Order Receipt'
      }
    },
    bg: {
      nav: {
        home: 'Начало',
        menu: 'Меню',
        about: 'За нас',
        contact: 'Контакти',
        gallery: 'Галерия'
      },
      hero: {
        title: 'Опитайте разликата',
        button: 'Виж менюто'
      },
      about: {
        title: 'За нас',
        subtitle: 'Нашата история',
        text: 'Ресторантът отвори врати през 2015 г. с една проста идея – да предложи автентичен вкус и комфорт в сърцето на града. Оттогава комбинираме традиционни рецепти с модерни кулинарни техники, за да създадем преживявания, които са наистина незабравими.'
      },
      contact: {
        title: 'Оставете отзив',
        subtitle: 'Вашето мнение е важно за нас.',
        name: 'Вашето име',
        email: 'Имейл адрес',
        message: 'Вашето съобщение',
        button: 'Изпрати съобщение'
      },
      footer: {
        privacy: 'Поверителност',
        services: 'Услуги',
        about: 'За нас',
        quickLinks: 'Бързи връзки',
        menu: 'Меню',
        story: 'Нашата история',
        reservations: 'Резервации',
        social: 'Социални мрежи'
      },
      categories: {
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
      },
      order: {
        title: 'Вашата поръчка',
        empty: 'Няма добавени ястия',
        total: 'Общо',
        generateQR: 'Генерирай QR код'
      },
      nutrition: {
        calories: 'Калории',
        carbs: 'Въглехидрати (г)',
        protein: 'Протеини (г)',
        fat: 'Мазнини (г)',
        addToCart: 'Добави в количката'
      },
      category: {
        backToMenu: '← Назад към меню',
        label: 'Категория',
        subtitle: 'Разгледайте предложенията и изберете любимите си ястия.'
      },
      menu: {
        heroTitle: 'Разгледайте нашите категории',
        heroSubtitle: 'Изберете категория и вижте пълната селекция от ястия.'
      },
      receipt: {
        title: 'Последна поръчка'
      }
    }
  };

  // Translation cache and API helper for dish descriptions (BG -> EN)
  const TRANSLATION_CACHE_KEY = 'serve_translation_cache_v1';
  const translationPending = window.__translationPending || {};
  let translationCache = window.__translationCache || {};
  window.__translationPending = translationPending;
  window.__translationCache = translationCache;

  function isBadTranslationResult(value) {
    const text = String(value || '').toLowerCase();
    return (
      text.includes('mymemory warning') ||
      text.includes('you used all available free translations') ||
      text.includes('to translate more') ||
      text.includes('mymemory.translated.net') ||
      text.includes('visit https://mymemory')
    );
  }

  function clearBadTranslationCache() {
    [localStorage, sessionStorage].forEach(function(storage) {
      const keysToRemove = [];

      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          const value = storage.getItem(key);

          if (isBadTranslationResult(key) || isBadTranslationResult(value)) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(function(key) {
          storage.removeItem(key);
        });
      } catch (e) {
        // Ignore blocked storage in private mode.
      }
    });
  }

  clearBadTranslationCache();

  try {
    translationCache = {
      ...(JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY) || '{}') || {}),
      ...translationCache
    };
    window.__translationCache = translationCache;
  } catch (e) {
    translationCache = translationCache || {};
    window.__translationCache = translationCache;
  }

  function saveTranslationCache() {
    try {
      localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(translationCache));
    } catch (e) {
      // Ignore storage quota/private mode errors.
    }
  }

  Object.keys(translationCache).forEach(function(key) {
    if (isBadTranslationResult(key) || isBadTranslationResult(translationCache[key])) {
      delete translationCache[key];
    }
  });
  saveTranslationCache();

  window.translateText = function(text, fromLang = 'bg', toLang = 'en') {
    const source = String(text || '').trim();
    if (!source) return Promise.resolve('');
    if (fromLang === toLang) return Promise.resolve(source);
    if (fromLang === 'bg' && toLang === 'en') return translateBgToEn(source);
    return Promise.resolve(source);
  };

  function hasCyrillic(value) {
    return /[\u0400-\u04FF]/.test(String(value || ''));
  }

  function normalizeTranslationText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function getTranslationCacheKey(text, from = 'bg', to = 'en') {
    return `autoTranslation:${from}:${to}:${normalizeTranslationText(text)}`;
  }

  function getCachedAutoTranslation(text, from = 'bg', to = 'en') {
    const source = normalizeTranslationText(text);
    if (!source) return '';

    try {
      const cached = localStorage.getItem(getTranslationCacheKey(source, from, to));
      return cached &&
        normalizeTranslationText(cached) &&
        !hasCyrillic(cached) &&
        !isBadTranslationResult(cached)
        ? normalizeTranslationText(cached)
        : '';
    } catch (e) {
      return '';
    }
  }

  function setCachedAutoTranslation(source, translated, from = 'bg', to = 'en') {
    const cleanSource = normalizeTranslationText(source);
    const cleanTranslation = normalizeTranslationText(translated);
    if (!cleanSource || !cleanTranslation || hasCyrillic(cleanTranslation)) return;

    try {
      localStorage.setItem(getTranslationCacheKey(cleanSource, from, to), cleanTranslation);
    } catch (e) {
      // Ignore storage quota/private mode errors.
    }
  }

  const pendingAutoTranslations = window.__pendingAutoTranslations || {};
  window.__pendingAutoTranslations = pendingAutoTranslations;

  async function translateBgToEn(text) {
    const source = normalizeTranslationText(text);
    if (!source) return '';
    if (!hasCyrillic(source)) return source;

    const cached = getCachedAutoTranslation(source, 'bg', 'en');
    if (cached) return cached;

    const cacheKey = getTranslationCacheKey(source, 'bg', 'en');
    if (pendingAutoTranslations[cacheKey]) {
      return pendingAutoTranslations[cacheKey];
    }

    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=bg&tl=en&dt=t&q=' +
      encodeURIComponent(source);

    pendingAutoTranslations[cacheKey] = fetch(url)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        const translated = Array.isArray(data && data[0])
          ? data[0].map(function(part) { return (part && part[0]) || ''; }).join('')
          : '';
        const clean = normalizeTranslationText(translated);

        if (!clean || hasCyrillic(clean) || isBadTranslationResult(clean)) {
          console.warn('[AUTO TRANSLATION FAILED]', source, clean);
          return source;
        }

        setCachedAutoTranslation(source, clean, 'bg', 'en');
        return clean;
      })
      .catch(function(err) {
        console.warn('[AUTO TRANSLATION ERROR]', source, err);
        return source;
      })
      .finally(function() {
        delete pendingAutoTranslations[cacheKey];
      });

    return pendingAutoTranslations[cacheKey];
  }

  // Get saved language or default to English
  let currentLang = localStorage.getItem('language') || localStorage.getItem('lang') || 'en';
  const MENU_ITEM_TRANSLATIONS = {
    'Хлебче със сирене': {
      name: 'Cheese Bread',
      description: 'Warm bread filled with fresh cheese, baked until golden and crispy.'
    },
    'Пърленки': {
      name: 'Flatbread',
      description: 'Traditional Bulgarian flatbread, baked until golden, soft inside and crispy outside — a perfect side for any dish.'
    },
    'Пърленка': {
      name: 'Flatbread',
      description: 'Traditional Bulgarian flatbread, baked until golden, soft inside and crispy outside — a perfect side for any dish.'
    },
    'Бял хляб': {
      name: 'White Bread',
      description: 'Classic white bread served as a simple side to your meal.'
    },
    'Артизански хляб': {
      name: 'Artisan Bread',
      description: 'Fresh artisan bread served with strawberries and herbs.'
    },
    'Чеснова пърленка': {
      name: 'Garlic Flatbread',
      description: 'Traditional flatbread baked with garlic until golden and aromatic.'
    },
    'Пърленка с чесън': {
      name: 'Garlic Flatbread',
      description: 'Traditional flatbread baked with garlic until golden and aromatic.'
    },
    'Пърленка със сирене': {
      name: 'Cheese Flatbread',
      description: 'Warm Bulgarian flatbread with fresh cheese, baked until golden.'
    },
    'Пърленка с кашкавал': {
      name: 'Yellow Cheese Flatbread',
      description: 'Warm Bulgarian flatbread topped with melted yellow cheese.'
    },
    'Хлебче с кашкавал': {
      name: 'Yellow Cheese Bread',
      description: 'Warm bread with melted yellow cheese, baked until golden.'
    },
    'Чесново хлебче': {
      name: 'Garlic Bread',
      description: 'Warm bread baked with garlic until golden and fragrant.'
    },
    'Средиземноморска салата': {
      name: 'Mediterranean Salad',
      description: 'Fresh vegetables with hummus and tahini sauce.'
    },
    'Авокадо тост': {
      name: 'Avocado Toast',
      description: 'Toast with avocado and a soft-boiled egg.'
    },
    'Пържени сирени крокети': {
      name: 'Fried Cheese Croquettes',
      description: 'Golden cheese croquettes served with strawberry sauce.'
    },
    'Пържени лукови пръстени': {
      name: 'Fried Onion Rings',
      description: 'Crispy onion rings served with tartar sauce.'
    },
    'Спагети с доматен сос': {
      name: 'Spaghetti with Tomato Sauce',
      description: 'Classic spaghetti with tomato sauce and basil.'
    },
    'Спагети Карбонара': {
      name: 'Spaghetti Carbonara',
      description: 'Classic spaghetti carbonara with creamy sauce.'
    },
    'Пилешко с екзотични подправки': {
      name: 'Chicken with Exotic Spices',
      description: 'Marinated chicken seasoned with exotic spices.'
    },
    'Глазирани свински ребра': {
      name: 'Glazed Pork Ribs',
      description: 'Pork ribs with glaze and potato wedges.'
    },
    'Грил телeшки кюфтета': {
      name: 'Grilled Veal Meatballs',
      description: 'Three grilled veal meatballs served with salad and chips.'
    },
    'Грил телешки кюфтета': {
      name: 'Grilled Veal Meatballs',
      description: 'Three grilled veal meatballs served with salad and chips.'
    },
    'Смесен сач': {
      name: 'Mixed Saj',
      description: 'Slow-cooked mixed meat saj served with lemon.'
    },
    'Маргарита пица': {
      name: 'Margherita Pizza',
      description: 'Classic pizza with tomato sauce, mozzarella and basil.'
    },
    'Пица Маргарита': {
      name: 'Margherita Pizza',
      description: 'Classic pizza with tomato sauce, mozzarella and basil.'
    },
    'Сигнатурен бургер': {
      name: 'Signature Burger',
      description: 'Burger with chicken patty, cabbage and tomatoes, served with fries.'
    },
    'Шоколадов лава кейк': {
      name: 'Chocolate Lava Cake',
      description: 'Decadent chocolate cake with a molten chocolate center, served warm with vanilla ice cream, fresh strawberries and raspberry coulis.'
    },
    'Кола 330мл': {
      name: 'Cola 330 ml',
      description: 'Chilled cola soft drink.'
    },
    'Бира': {
      name: 'Beer',
      description: 'Chilled beer.'
    }
  };

  function getCurrentLang() {
    const lang = (
      localStorage.getItem('language') ||
      localStorage.getItem('lang') ||
      (typeof currentLanguage !== 'undefined' && currentLanguage) ||
      currentLang ||
      'en'
    );
    return translations[lang] ? lang : 'en';
  }

  function normalizeMenuText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function pickTextValue(values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim() && !isBadTranslationResult(value)) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  function readMenuPath(item, path) {
    return String(path || '')
      .split('.')
      .reduce(function(value, key) {
        return value && value[key];
      }, item);
  }

  function pickMenuPaths(item, paths) {
    return pickTextValue(paths.map(function(path) {
      return readMenuPath(item, path);
    }));
  }

  function getLocalItemTranslation(item, lang) {
    const translations = (window.MENU_TRANSLATIONS && window.MENU_TRANSLATIONS.items) || {};
    const legacyTranslations = MENU_ITEM_TRANSLATIONS || {};
    const possibleKeys = [
      item && item.id,
      item && item.docId,
      item && item.menuId,
      item && item.itemId,
      item && item.slug,
      item && item.name,
      normalizeMenuText(item && item.name),
      item && item.title,
      normalizeMenuText(item && item.title),
      pickMenuPaths(item, ['name.bg', 'title.bg', 'translations.bg.name', 'translations.bg.title'])
    ].filter(Boolean);

    function findIn(source) {
      for (const key of possibleKeys) {
        const normalizedKey = normalizeMenuText(key);
        for (const [translationKey, value] of Object.entries(source)) {
          if (normalizeMenuText(translationKey) !== normalizedKey) continue;
          if (value && value[lang]) return value[lang];
          if (lang === 'en' && (value.name || value.description)) return value;
          return null;
        }
      }
      return null;
    }

    return findIn(translations) || findIn(legacyTranslations);
  }

  function getLocalMenuTranslation(item) {
    return getLocalItemTranslation(item, 'en');
  }

  function getTranslatedCategory(categoryKeyOrName) {
    const lang = getCurrentLang();
    const raw = String(categoryKeyOrName || '').trim();
    const key = normalizeMenuText(raw);
    const categories = (window.MENU_TRANSLATIONS && window.MENU_TRANSLATIONS.categories) || {};

    for (const [categoryKey, value] of Object.entries(categories)) {
      if (
        normalizeMenuText(categoryKey) === key ||
        normalizeMenuText(value && value.bg) === key ||
        normalizeMenuText(value && value.en) === key
      ) {
        return (value && (value[lang] || value.en || value.bg)) || raw;
      }
    }

    return raw;
  }

  function pickLocalizedMenuValue(item, lang, fieldNames) {
    const containers = [
      item && item.translations && item.translations[lang],
      item && item.translation && item.translation[lang],
      item && item.i18n && item.i18n[lang],
      item && item.localized && item.localized[lang],
      item && item.locale && item.locale[lang],
      item && item[lang]
    ].filter(Boolean);

    for (const container of containers) {
      const value = pickTextValue(fieldNames.map((field) => container[field]));
      if (value) return value;
    }

    return '';
  }

  function getMenuItemBaseName(item) {
    return pickMenuPaths(item, [
      'name.bg',
      'nameBg',
      'nameBG',
      'name_bg',
      'bgName',
      'bulgarianName',
      'title.bg',
      'titleBg',
      'title_bg',
      'translations.bg.name',
      'translations.bg.title',
      'i18n.bg.name',
      'i18n.bg.title',
      'localized.bg.name',
      'localized.bg.title',
      'bg.name',
      'bg.title',
      'name',
      'title'
    ]) || 'Item';
  }

  function getMenuItemBaseDescription(item) {
    return pickMenuPaths(item, [
      'description.bg',
      'descriptionBg',
      'descriptionBG',
      'description_bg',
      'bgDescription',
      'bulgarianDescription',
      'desc.bg',
      'descBg',
      'desc_bg',
      'details.bg',
      'detailsBg',
      'details_bg',
      'translations.bg.description',
      'translations.bg.desc',
      'i18n.bg.description',
      'i18n.bg.desc',
      'localized.bg.description',
      'localized.bg.desc',
      'bg.description',
      'bg.desc',
      'description',
      'desc',
      'details'
    ]);
  }

  function getMenuItemEnglishName(item) {
    return pickMenuPaths(item, [
      'nameEn',
      'nameEN',
      'name_en',
      'enName',
      'en_name',
      'engName',
      'eng_name',
      'englishName',
      'english_name',
      'nameEnglish',
      'name_english',
      'name.en',
      'titleEn',
      'titleEN',
      'title_en',
      'enTitle',
      'en_title',
      'engTitle',
      'eng_title',
      'englishTitle',
      'english_title',
      'title.en',
      'translations.en.name',
      'translations.en.title',
      'translation.en.name',
      'translation.en.title',
      'i18n.en.name',
      'i18n.en.title',
      'localized.en.name',
      'localized.en.title',
      'locale.en.name',
      'locale.en.title',
      'en.name',
      'en.title',
      'translations.name.en',
      'translations.title.en',
      'i18n.name.en',
      'i18n.title.en',
      'localized.name.en',
      'localized.title.en'
    ]) || pickLocalizedMenuValue(item, 'en', ['name', 'title']);
  }

  function getMenuItemEnglishDescription(item) {
    return pickMenuPaths(item, [
      'descriptionEn',
      'descriptionEN',
      'description_en',
      'enDescription',
      'en_description',
      'engDescription',
      'eng_description',
      'englishDescription',
      'english_description',
      'descriptionEnglish',
      'description_english',
      'description.en',
      'descEn',
      'descEN',
      'desc_en',
      'enDesc',
      'en_desc',
      'engDesc',
      'eng_desc',
      'englishDesc',
      'english_desc',
      'descEnglish',
      'desc_english',
      'desc.en',
      'detailsEn',
      'detailsEN',
      'details_en',
      'enDetails',
      'en_details',
      'engDetails',
      'eng_details',
      'englishDetails',
      'english_details',
      'detailsEnglish',
      'details_english',
      'details.en',
      'translations.en.description',
      'translations.en.desc',
      'translations.en.details',
      'translation.en.description',
      'translation.en.desc',
      'i18n.en.description',
      'i18n.en.desc',
      'i18n.en.details',
      'localized.en.description',
      'localized.en.desc',
      'localized.en.details',
      'locale.en.description',
      'locale.en.desc',
      'en.description',
      'en.desc',
      'en.details',
      'translations.description.en',
      'translations.desc.en',
      'translations.details.en',
      'i18n.description.en',
      'i18n.desc.en',
      'localized.description.en',
      'localized.desc.en'
    ]) || pickLocalizedMenuValue(item, 'en', ['description', 'desc', 'details']);
  }

  function hasCyrillicText(text) {
    return hasCyrillic(text);
  }

  function getTranslatedItem(item) {
    const sourceName = getMenuItemBaseName(item);
    const sourceDescription = getMenuItemBaseDescription(item);
    const lang = getCurrentLang();

    if (lang === 'en') {
      const englishName = getMenuItemEnglishName(item);
      const englishDescription = getMenuItemEnglishDescription(item);
      const localTranslation = getLocalItemTranslation(item, 'en');
      const cachedName = getCachedAutoTranslation(sourceName, 'bg', 'en');
      const cachedDescription = getCachedAutoTranslation(sourceDescription, 'bg', 'en');
      const hasValidEnglishName =
        englishName &&
        !hasCyrillicText(englishName) &&
        !isBadTranslationResult(englishName);
      const hasValidEnglishDescription =
        englishDescription &&
        !hasCyrillicText(englishDescription) &&
        !isBadTranslationResult(englishDescription);
      const localName = localTranslation &&
        !hasCyrillicText(localTranslation.name) &&
        !isBadTranslationResult(localTranslation.name)
        ? localTranslation.name
        : '';
      const localDescription = localTranslation &&
        !hasCyrillicText(localTranslation.description) &&
        !isBadTranslationResult(localTranslation.description)
        ? localTranslation.description
        : '';
      const displayName = hasValidEnglishName ? englishName : (localName || cachedName || sourceName);
      const displayDescription = hasValidEnglishDescription
        ? englishDescription
        : (localDescription || cachedDescription || sourceDescription);

      console.log('[ITEM RAW]', sourceName, sourceDescription);
      console.log('[ITEM TRANSLATED SYNC]', displayName, displayDescription);

      return {
        ...item,
        displayName,
        displayDescription,
        _sourceName: sourceName,
        _sourceDescription: sourceDescription,
        _hasDirectEnName: !!hasValidEnglishName,
        _hasDirectEnDescription: !!hasValidEnglishDescription,
        _hasCachedEnName: !!cachedName,
        _hasCachedEnDescription: !!cachedDescription,
        _hasLocalEnName: !!localName,
        _hasLocalEnDescription: !!localDescription
      };
    }

    return {
      ...item,
      displayName: sourceName,
      displayDescription: sourceDescription,
      _sourceName: sourceName,
      _sourceDescription: sourceDescription,
      _hasDirectEnName: false,
      _hasDirectEnDescription: false
    };
  }

  function translateWithTimeout(text, fallback) {
    return Promise.resolve(fallback || text || '');
  }

  async function getTranslatedItemAsync(item) {
    const sourceName = getMenuItemBaseName(item);
    const sourceDescription = getMenuItemBaseDescription(item);
    const lang = getCurrentLang();

    if (lang !== 'en') {
      return {
        ...item,
        displayName: sourceName,
        displayDescription: sourceDescription
      };
    }

    const syncItem = getTranslatedItem(item);
    const needsNameTranslation = hasCyrillicText(syncItem.displayName) && hasCyrillicText(sourceName);
    const needsDescriptionTranslation =
      hasCyrillicText(syncItem.displayDescription) && hasCyrillicText(sourceDescription);
    const [translatedName, translatedDescription] = await Promise.all([
      needsNameTranslation ? translateBgToEn(sourceName) : Promise.resolve(syncItem.displayName),
      needsDescriptionTranslation ? translateBgToEn(sourceDescription) : Promise.resolve(syncItem.displayDescription)
    ]);
    const result = {
      ...item,
      displayName: translatedName || sourceName,
      displayDescription: translatedDescription || sourceDescription
    };

    console.log('[ITEM TRANSLATED ASYNC]', result.displayName, result.displayDescription);
    return result;
  }

  window.getCurrentLang = getCurrentLang;
  window.getTranslatedItem = getTranslatedItem;
  window.getTranslatedItemAsync = getTranslatedItemAsync;
  window.hasCyrillic = hasCyrillic;
  window.normalizeTranslationText = normalizeTranslationText;
  window.getTranslationCacheKey = getTranslationCacheKey;
  window.translateBgToEn = translateBgToEn;
  window.isBadTranslationResult = isBadTranslationResult;
  window.MENU_ITEM_TRANSLATIONS = MENU_ITEM_TRANSLATIONS;
  window.normalizeMenuText = normalizeMenuText;
  window.getLocalItemTranslation = getLocalItemTranslation;
  window.getLocalMenuTranslation = getLocalMenuTranslation;
  window.getTranslatedCategory = getTranslatedCategory;
  window.currentLang = currentLang;

  // Function to change language
  function changeLanguage(lang) {
    if (!['en', 'bg'].includes(lang)) return;
    const languageChanged = currentLang !== lang;
    currentLang = lang;
    window.currentLang = currentLang;
    localStorage.setItem('language', lang);
    localStorage.setItem('lang', lang);
    updateLanguage();
    updateLanguageButtons();
    if (typeof window.renderCurrentMenuCategory === 'function') {
      window.renderCurrentMenuCategory();
    } else if (typeof renderCurrentMenuCategory === 'function') {
      renderCurrentMenuCategory();
    } else if (typeof renderMenuItems === 'function') {
      renderMenuItems();
    }

    const openModal =
      document.getElementById('nutritionModal') ||
      document.getElementById('dishModal') ||
      document.getElementById('itemModal');
    const modalIsOpen = openModal && (
      openModal.classList.contains('active') ||
      openModal.classList.contains('show') ||
      openModal.classList.contains('open') ||
      openModal.style.display === 'flex' ||
      openModal.style.display === 'block'
    );

    if (modalIsOpen && typeof window.updateOpenDishModalLanguage === 'function') {
      window.updateOpenDishModalLanguage();
    }
    if (languageChanged || typeof window.renderCurrentMenuCategory !== 'function') {
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
    }
  }

  // Function to update language buttons
  function updateLanguageButtons() {
    const lang = getCurrentLang();
    const langEn = document.getElementById('lang-en');
    const langBg = document.getElementById('lang-bg');
    if (langEn) langEn.classList.toggle('active', lang === 'en');
    if (langBg) langBg.classList.toggle('active', lang === 'bg');
  }

  function getNestedTranslation(source, path) {
    return String(path || '')
      .split('.')
      .reduce(function(obj, key) {
        return obj && obj[key];
      }, source);
  }

  // Function to update all text content
  function updateLanguage() {
    const lang = getCurrentLang();
    const t = translations[lang] || translations.en;
    currentLang = lang;
    window.currentLang = lang;
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;

    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      const value = getNestedTranslation(t, key);
      if (value !== undefined && value !== null) {
        element.textContent = value;
      }
    });

    // Update all elements with data-translate-placeholder attribute
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
      const key = element.getAttribute('data-translate-placeholder');
      const value = getNestedTranslation(t, key);
      if (value !== undefined && value !== null) {
        element.placeholder = value;
      }
    });
    
    // Update nutrition modal translations if function exists
    if (typeof updateNutritionTranslations === 'function') {
      updateNutritionTranslations();
    }
  }

  // Function to get category translation
  function getCategoryTranslation(categoryKey) {
    const translated = getTranslatedCategory(categoryKey);
    return translated || String(categoryKey || '').toUpperCase();
  }

  let sliderAutoplayTimer = null;
  let sliderCurrent = 0;
  let sliderTouchStartX = 0;
  let testimonialAutoplayTimer = null;
  let testimonialCurrent = 0;

  function bindOnce(target, eventName, handler, options, keySuffix) {
    if (!target || typeof target.addEventListener !== 'function') return;
    const key = `serveBound${keySuffix || eventName}`;

    if (target.dataset) {
      if (target.dataset[key] === 'true') return;
      target.dataset[key] = 'true';
    } else {
      const prop = `__${key}`;
      if (target[prop]) return;
      target[prop] = true;
    }

    target.addEventListener(eventName, handler, options);
  }

  function resetScrollLockState() {
    const navMenu = document.getElementById('navMenu') || document.querySelector('nav ul');
    const menuToggle = document.getElementById('menuToggle') || document.querySelector('.menu-toggle');

    document.body.style.overflow = '';
    document.body.classList.remove('menu-open');

    if (navMenu) {
      navMenu.classList.remove('show');
    }
    if (menuToggle) {
      menuToggle.classList.remove('active');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  }

  function closeMenu() {
    resetScrollLockState();
  }

  function toggleMenu() {
    const navMenu = document.getElementById('navMenu') || document.querySelector('nav ul');
    const menuToggle = document.getElementById('menuToggle') || document.querySelector('.menu-toggle');
    const body = document.body;

    if (!navMenu || !menuToggle) return;

    navMenu.classList.toggle('show');
    menuToggle.classList.toggle('active');
    menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('show') ? 'true' : 'false');
    body.classList.toggle('menu-open', navMenu.classList.contains('show'));
    body.style.overflow = navMenu.classList.contains('show') ? 'hidden' : '';
  }
  function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    function handleScroll() {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }

    bindOnce(window, 'scroll', handleScroll, undefined, 'NavbarScroll');
    handleScroll();
  }

  function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle') || document.querySelector('.menu-toggle');
    const navMenu = document.getElementById('navMenu') || document.querySelector('nav ul');

    if (menuToggle && !menuToggle.getAttribute('onclick')) {
      bindOnce(menuToggle, 'click', toggleMenu, undefined, 'MenuToggle');
    }

    if (navMenu) {
      navMenu.querySelectorAll('a').forEach((link) => {
        bindOnce(link, 'click', closeMenu, undefined, 'CloseMenuLink');
      });

      bindOnce(navMenu, 'click', function(e) {
        if (e.target === navMenu) closeMenu();
      }, undefined, 'NavOverlay');
    }

    bindOnce(window, 'resize', function() {
      if (window.innerWidth > 768) closeMenu();
    }, undefined, 'CloseMenuResize');

    bindOnce(window, 'pageshow', resetScrollLockState, undefined, 'ResetScrollLockPageshow');
  }

  // Legacy contact form implementation kept inactive after init consolidation.
  function initLegacyContactDisabled() {
    const form = document.getElementById("contact-form");
    const toast = document.getElementById("toast");
    const lang = localStorage.getItem("language") || "en";

    if (!form || !toast) {
      return;
    }

    const toastMessages = {
      en: {
        sending: "Sending message...",
        success: "Message sent successfully!",
        failed: "Failed to send message.",
        serviceDown: "Message service is unavailable."
      },
      bg: {
        sending: "Изпращане на съобщение...",
        success: "Съобщението е изпратено успешно!",
        failed: "Грешка при изпращане на съобщението.",
        serviceDown: "Услугата за изпращане не е налична."
      }
    };
    const t = toastMessages[lang] || toastMessages.en;

    if (!window.emailjs) {
      console.error("EmailJS is not loaded.");
      showToast(t.serviceDown, false);
      return;
    }

    emailjs.init("kGsBidM1aclQjY3y3");

    form.addEventListener("submit", async function(e) {
      e.preventDefault();
      showToast(t.sending, true);

      try {
        await emailjs.sendForm(
          "service_3d3a8yj",
          "template_u7f8rnm",
          this
        );
        showToast(t.success, true);
        form.reset();
      } catch (error) {
        console.error(error);
        showToast(t.failed, false);
      }
    });

    function showToast(message, success = true) {
      toast.textContent = message;
      toast.style.backgroundColor = success ? "#4caf50" : "#f44336"; // green or red
      toast.classList.add("show");

      setTimeout(() => {
        toast.classList.remove("show");
      }, 3000); // disappears after 3 seconds
    }
  }

  function initSlider() {
    const slides = Array.from(document.querySelectorAll('.slide'));
    const dotsContainer = document.getElementById('sliderDots');
    const slider = document.querySelector('.slider');

    if (!slides.length || !dotsContainer || !slider) return;
    if (window.__SLIDER_INIT__) return;

    window.__SLIDER_INIT__ = true;
    console.count("initSlider");

    if (!dotsContainer.dataset.built) {
      dotsContainer.innerHTML = '';
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Slide ${i + 1}`);
        bindOnce(dot, 'click', function() {
          goToSlide(i);
        }, undefined, `SliderDot${i}`);
        dotsContainer.appendChild(dot);
      });
      dotsContainer.dataset.built = 'true';
    }

    function getDots() {
      return Array.from(dotsContainer.querySelectorAll('.slider-dot'));
    }

    function goToSlide(n) {
      const dots = getDots();
      if (!slides.length || !dots.length) return;

      slides[sliderCurrent]?.classList.remove('active');
      dots[sliderCurrent]?.classList.remove('active');
      sliderCurrent = (n + slides.length) % slides.length;
      slides[sliderCurrent]?.classList.add('active');
      dots[sliderCurrent]?.classList.add('active');
      resetAutoplay();
    }

    function resetAutoplay() {
      if (sliderAutoplayTimer) clearInterval(sliderAutoplayTimer);
      sliderAutoplayTimer = setInterval(function() {
        goToSlide(sliderCurrent + 1);
      }, 5000);
    }

    window.changeSlide = function(dir) {
      goToSlide(sliderCurrent + dir);
    };

    bindOnce(slider, 'mouseenter', function() {
      if (sliderAutoplayTimer) clearInterval(sliderAutoplayTimer);
    }, undefined, 'SliderMouseEnter');

    bindOnce(slider, 'mouseleave', resetAutoplay, undefined, 'SliderMouseLeave');

    bindOnce(slider, 'touchstart', function(e) {
      sliderTouchStartX = e.touches[0].clientX;
    }, { passive: true }, 'SliderTouchStart');

    bindOnce(slider, 'touchend', function(e) {
      const diff = sliderTouchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) goToSlide(sliderCurrent + (diff > 0 ? 1 : -1));
    }, undefined, 'SliderTouchEnd');

    resetAutoplay();
  }

  function initReveal() {
    if (window.__REVEAL_INIT__) return;
    const revealTargets = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger-children');
    if (!revealTargets.length) return;

    window.__REVEAL_INIT__ = true;

    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach((el) => el.classList.add('visible'));
      return;
    }

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      bindOnce(anchor, 'click', function(e) {
        const targetSelector = this.getAttribute('href');
        if (!targetSelector || targetSelector.length <= 1) return;

        const target = document.querySelector(targetSelector);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }, undefined, 'SmoothScroll');
    });
  }

  function initContactForm() {
    const form = document.getElementById('contact-form');
    const toast = document.getElementById('toast');

    if (!form || !toast) return;

    const toastMessages = {
      en: {
        sending: 'Sending message...',
        success: 'Message sent successfully!',
        failed: 'Failed to send message.',
        serviceDown: 'Message service is unavailable.'
      },
      bg: {
        sending: '\u0418\u0437\u043f\u0440\u0430\u0449\u0430\u043d\u0435 \u043d\u0430 \u0441\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435...',
        success: '\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e \u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d\u043e \u0443\u0441\u043f\u0435\u0448\u043d\u043e!',
        failed: '\u0413\u0440\u0435\u0448\u043a\u0430 \u043f\u0440\u0438 \u0438\u0437\u043f\u0440\u0430\u0449\u0430\u043d\u0435 \u043d\u0430 \u0441\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e.',
        serviceDown: '\u0423\u0441\u043b\u0443\u0433\u0430\u0442\u0430 \u0437\u0430 \u0438\u0437\u043f\u0440\u0430\u0449\u0430\u043d\u0435 \u043d\u0435 \u0435 \u043d\u0430\u043b\u0438\u0447\u043d\u0430.'
      }
    };

    function getToastMessages() {
      const lang = getCurrentLang();
      return toastMessages[lang] || toastMessages.en;
    }

    function showToast(message, success = true) {
      toast.textContent = message;
      toast.style.backgroundColor = success ? '#4caf50' : '#f44336';
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    bindOnce(form, 'submit', async function(e) {
      e.preventDefault();
      const t = getToastMessages();
      showToast(t.sending, true);

      if (!window.emailjs) {
        showToast(t.serviceDown, false);
        return;
      }

      if (!window.__EMAILJS_CONTACT_INIT__) {
        emailjs.init('kGsBidM1aclQjY3y3');
        window.__EMAILJS_CONTACT_INIT__ = true;
      }

      try {
        await emailjs.sendForm('service_3d3a8yj', 'template_u7f8rnm', form);
        showToast(t.success, true);
        form.reset();
      } catch (error) {
        console.error(error);
        showToast(t.failed, false);
      }
    }, undefined, 'ContactSubmit');
  }

  function initTestimonials() {
    const slidesEl = document.getElementById('testiSlides');
    const dotsEl = document.getElementById('testiDots');
    const prev = document.getElementById('testiPrev');
    const next = document.getElementById('testiNext');

    if (!slidesEl || !dotsEl || !prev || !next) return;
    if (window.__TESTIMONIALS_INIT__) return;

    const slides = Array.from(slidesEl.querySelectorAll('.testimonial-slide'));
    if (!slides.length) return;

    window.__TESTIMONIALS_INIT__ = true;

    if (!dotsEl.dataset.built) {
      dotsEl.innerHTML = '';
      slides.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.className = 'testi-dot' + (idx === 0 ? ' active' : '');
        dot.type = 'button';
        bindOnce(dot, 'click', function() {
          goTo(idx);
        }, undefined, `TestimonialDot${idx}`);
        dotsEl.appendChild(dot);
      });
      dotsEl.dataset.built = 'true';
    }

    function getDots() {
      return Array.from(dotsEl.querySelectorAll('.testi-dot'));
    }

    function goTo(index) {
      const dots = getDots();
      testimonialCurrent = (index + slides.length) % slides.length;
      slidesEl.style.transform = `translateX(-${testimonialCurrent * 100}%)`;
      dots.forEach((dot, i) => dot.classList.toggle('active', i === testimonialCurrent));
      resetAuto();
    }

    function resetAuto() {
      if (testimonialAutoplayTimer) clearInterval(testimonialAutoplayTimer);
      testimonialAutoplayTimer = setInterval(function() {
        goTo(testimonialCurrent + 1);
      }, 5000);
    }

    bindOnce(prev, 'click', function() {
      goTo(testimonialCurrent - 1);
    }, undefined, 'TestimonialPrev');

    bindOnce(next, 'click', function() {
      goTo(testimonialCurrent + 1);
    }, undefined, 'TestimonialNext');

    resetAuto();
  }

  function initFaq() {
    document.querySelectorAll('.faq-question').forEach((btn) => {
      bindOnce(btn, 'click', function() {
        const item = btn.closest('.faq-item');
        if (!item) return;

        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach((openItem) => openItem.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      }, undefined, 'FaqToggle');
    });
  }

  function initApp() {
    console.count("initApp");
    resetScrollLockState();
    updateLanguage();
    updateLanguageButtons();
    initNavbar();
    initMobileMenu();
    initSlider();
    initReveal();
    initSmoothScroll();
    initContactForm();
    initTestimonials();
    initFaq();
  }

  window.translations = translations;
  window.getCurrentLang = getCurrentLang;
  window.getTranslatedItem = getTranslatedItem;
  window.getTranslatedItemAsync = getTranslatedItemAsync;
  window.hasCyrillic = hasCyrillic;
  window.normalizeTranslationText = normalizeTranslationText;
  window.getTranslationCacheKey = getTranslationCacheKey;
  window.translateBgToEn = translateBgToEn;
  window.isBadTranslationResult = isBadTranslationResult;
  window.MENU_ITEM_TRANSLATIONS = MENU_ITEM_TRANSLATIONS;
  window.normalizeMenuText = normalizeMenuText;
  window.getLocalItemTranslation = getLocalItemTranslation;
  window.getLocalMenuTranslation = getLocalMenuTranslation;
  window.getTranslatedCategory = getTranslatedCategory;
  window.getNestedTranslation = getNestedTranslation;
  window.currentLang = currentLang;
  window.changeLanguage = changeLanguage;
  window.updateLanguage = updateLanguage;
  window.updateLanguageButtons = updateLanguageButtons;
  window.getCategoryTranslation = getCategoryTranslation;
  window.toggleMenu = toggleMenu;
  window.closeMenu = closeMenu;

  if (shouldInitApp) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp, { once: true });
    } else {
      initApp();
    }
  }
})();
