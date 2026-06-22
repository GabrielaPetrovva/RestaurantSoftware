(function () {
  const categories = {
    pizza: { en: "Pizza", bg: "Пици" },
    pizzas: { en: "Pizza", bg: "Пици" },
    dessert: { en: "Desserts", bg: "Десерти" },
    desserts: { en: "Desserts", bg: "Десерти" },
    drinks: { en: "Drinks", bg: "Напитки" },
    drink: { en: "Drinks", bg: "Напитки" },
    chicken: { en: "Chicken", bg: "Пилешко" },
    burger: { en: "Burger & Tortilla", bg: "Бургер и тортила" },
    burgers: { en: "Burger & Tortilla", bg: "Бургер и тортила" },
    tortilla: { en: "Burger & Tortilla", bg: "Бургер и тортила" },
    bread: { en: "Bread", bg: "Пърленки и хлебчета" },
    pasta: { en: "Pasta & Risotto", bg: "Паста и ризото" },
    risotto: { en: "Pasta & Risotto", bg: "Паста и ризото" },
    fish: { en: "Fish", bg: "Риба" },
    salads: { en: "Salads", bg: "Салати" },
    salad: { en: "Salads", bg: "Салати" },
    starters: { en: "Starters", bg: "Предястия" },
    starter: { en: "Starters", bg: "Предястия" },
    appetizers: { en: "Starters", bg: "Предястия" },
    veal: { en: "Veal", bg: "Телешко" },
    pork: { en: "Pork", bg: "Свинско" },
    saj: { en: "Saj", bg: "Сачове" },
    food: { en: "Food", bg: "Храна" },
    храна: { en: "Food", bg: "Храна" },
    напитки: { en: "Drinks", bg: "Напитки" }
  };

  const items = {
    "\u0448\u043e\u043f\u0441\u043a\u0430 \u0441\u0430\u043b\u0430\u0442\u0430": {
      en: {
        name: "Shopska Salad",
        description: "Traditional Bulgarian salad with tomatoes, cucumbers, peppers, onions and white brined cheese."
      },
      bg: {
        name: "\u0428\u043e\u043f\u0441\u043a\u0430 \u0441\u0430\u043b\u0430\u0442\u0430",
        description: "\u0422\u0440\u0430\u0434\u0438\u0446\u0438\u043e\u043d\u043d\u0430 \u0431\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0430 \u0441\u0430\u043b\u0430\u0442\u0430 \u0441 \u0434\u043e\u043c\u0430\u0442\u0438, \u043a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0438, \u0447\u0443\u0448\u043a\u0438, \u043b\u0443\u043a \u0438 \u0431\u044f\u043b\u043e \u0441\u0430\u043b\u0430\u043c\u0443\u0440\u0435\u043d\u043e \u0441\u0438\u0440\u0435\u043d\u0435."
      }
    },
    "\u0433\u0440\u044a\u0446\u043a\u0430 \u0441\u0430\u043b\u0430\u0442\u0430": {
      en: {
        name: "Greek Salad",
        description: "Classic Greek salad with tomatoes, cucumbers, olives, onions and feta cheese."
      },
      bg: {
        name: "\u0413\u0440\u044a\u0446\u043a\u0430 \u0441\u0430\u043b\u0430\u0442\u0430",
        description: "\u041a\u043b\u0430\u0441\u0438\u0447\u0435\u0441\u043a\u0430 \u0433\u0440\u044a\u0446\u043a\u0430 \u0441\u0430\u043b\u0430\u0442\u0430 \u0441 \u0434\u043e\u043c\u0430\u0442\u0438, \u043a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0438, \u043c\u0430\u0441\u043b\u0438\u043d\u0438, \u043b\u0443\u043a \u0438 \u0444\u0435\u0442\u0430."
      }
    },
    "\u0441\u0430\u043b\u0430\u0442\u0430 \u0441 \u0440\u0438\u0431\u0438 \u043c\u0438\u043a\u0441": {
      en: {
        name: "Mixed Fish Salad",
        description: "Fresh salad with a mix of fish, vegetables and a light dressing."
      },
      bg: {
        name: "\u0421\u0430\u043b\u0430\u0442\u0430 \u0441 \u0440\u0438\u0431\u0438 \u043c\u0438\u043a\u0441",
        description: "\u0421\u0432\u0435\u0436\u0430 \u0441\u0430\u043b\u0430\u0442\u0430 \u0441 \u043c\u0438\u043a\u0441 \u043e\u0442 \u0440\u0438\u0431\u0438, \u0437\u0435\u043b\u0435\u043d\u0447\u0443\u0446\u0438 \u0438 \u043b\u0435\u043a \u0434\u0440\u0435\u0441\u0438\u043d\u0433."
      }
    },
    "\u0441\u0430\u043b\u0430\u0442\u0430 \u0441 \u0440\u0438\u0431\u0430 \u043c\u0438\u043a\u0441": {
      en: {
        name: "Mixed Fish Salad",
        description: "Fresh salad with a mix of fish, vegetables and a light dressing."
      },
      bg: {
        name: "\u0421\u0430\u043b\u0430\u0442\u0430 \u0441 \u0440\u0438\u0431\u0430 \u043c\u0438\u043a\u0441",
        description: "\u0421\u0432\u0435\u0436\u0430 \u0441\u0430\u043b\u0430\u0442\u0430 \u0441 \u043c\u0438\u043a\u0441 \u043e\u0442 \u0440\u0438\u0431\u0430, \u0437\u0435\u043b\u0435\u043d\u0447\u0443\u0446\u0438 \u0438 \u043b\u0435\u043a \u0434\u0440\u0435\u0441\u0438\u043d\u0433."
      }
    },
    "хлебче със сирене": {
      en: {
        name: "Cheese Bread",
        description: "Warm bread filled with fresh cheese, baked until golden and crispy."
      },
      bg: {
        name: "Хлебче със сирене",
        description: "Топло хлебче със свежо сирене, изпечено до златиста коричка."
      }
    },
    "пърленки": {
      en: {
        name: "Flatbread",
        description: "Traditional Bulgarian flatbread, baked until golden, soft inside and crispy outside — a perfect side for any dish."
      },
      bg: {
        name: "Пърленки",
        description: "Традиционни български пърленки, изпечени до златисто."
      }
    },
    "пърленка": {
      en: {
        name: "Flatbread",
        description: "Traditional Bulgarian flatbread, baked until golden, soft inside and crispy outside — a perfect side for any dish."
      },
      bg: {
        name: "Пърленка",
        description: "Традиционна българска пърленка, изпечена до златисто."
      }
    },
    "бял хляб": {
      en: {
        name: "White Bread",
        description: "Classic white bread served as a simple side to your meal."
      },
      bg: {
        name: "Бял хляб",
        description: "Класически бял хляб, поднесен като добавка към ястието."
      }
    },
    "артизански хляб": {
      en: {
        name: "Artisan Bread",
        description: "Fresh artisan bread served with strawberries and herbs."
      },
      bg: {
        name: "Артизански хляб",
        description: "Свеж артизански хляб с ягоди и подправки."
      }
    },
    "чеснова пърленка": {
      en: {
        name: "Garlic Flatbread",
        description: "Traditional flatbread baked with garlic until golden and aromatic."
      },
      bg: {
        name: "Чеснова пърленка",
        description: "Традиционна пърленка с чесън, изпечена до златисто."
      }
    },
    "пърленка с чесън": {
      en: {
        name: "Garlic Flatbread",
        description: "Traditional flatbread baked with garlic until golden and aromatic."
      },
      bg: {
        name: "Пърленка с чесън",
        description: "Традиционна пърленка с чесън, изпечена до златисто."
      }
    },
    "пърленка със сирене": {
      en: {
        name: "Cheese Flatbread",
        description: "Warm Bulgarian flatbread with fresh cheese, baked until golden."
      },
      bg: {
        name: "Пърленка със сирене",
        description: "Топла пърленка със сирене, изпечена до златисто."
      }
    },
    "пърленка с кашкавал": {
      en: {
        name: "Yellow Cheese Flatbread",
        description: "Warm Bulgarian flatbread topped with melted yellow cheese."
      },
      bg: {
        name: "Пърленка с кашкавал",
        description: "Топла пърленка с разтопен кашкавал."
      }
    },
    "хлебче с кашкавал": {
      en: {
        name: "Yellow Cheese Bread",
        description: "Warm bread with melted yellow cheese, baked until golden."
      },
      bg: {
        name: "Хлебче с кашкавал",
        description: "Топло хлебче с разтопен кашкавал."
      }
    },
    "чесново хлебче": {
      en: {
        name: "Garlic Bread",
        description: "Warm bread baked with garlic until golden and fragrant."
      },
      bg: {
        name: "Чесново хлебче",
        description: "Топло хлебче с чесън, изпечено до златисто."
      }
    },
    "средиземноморска салата": {
      en: {
        name: "Mediterranean Salad",
        description: "Fresh vegetables with hummus and tahini sauce."
      },
      bg: {
        name: "Средиземноморска салата",
        description: "Свежи зеленчуци с хумус и тахини сос."
      }
    },
    "авокадо тост": {
      en: {
        name: "Avocado Toast",
        description: "Toast with avocado and a soft-boiled egg."
      },
      bg: {
        name: "Авокадо тост",
        description: "Тост с авокадо и меко варено яйце."
      }
    },
    "пържени сирени крокети": {
      en: {
        name: "Fried Cheese Croquettes",
        description: "Golden cheese croquettes served with strawberry sauce."
      },
      bg: {
        name: "Пържени сирени крокети",
        description: "Златни крокети със сирене и ягодов сос."
      }
    },
    "пържени лукови пръстени": {
      en: {
        name: "Fried Onion Rings",
        description: "Crispy onion rings served with tartar sauce."
      },
      bg: {
        name: "Пържени лукови пръстени",
        description: "Хрупкави лукови пръстени с тартар сос."
      }
    },
    "спагети с доматен сос": {
      en: {
        name: "Spaghetti with Tomato Sauce",
        description: "Classic spaghetti with tomato sauce and basil."
      },
      bg: {
        name: "Спагети с доматен сос",
        description: "Класически спагети с доматен сос и босилек."
      }
    },
    "спагети карбонара": {
      en: {
        name: "Spaghetti Carbonara",
        description: "Classic spaghetti carbonara with creamy sauce."
      },
      bg: {
        name: "Спагети Карбонара",
        description: "Класически спагети Карбонара с кремообразен сос."
      }
    },
    spaghetti: {
      en: {
        name: "Spaghetti Carbonara",
        description: "Classic spaghetti carbonara with creamy sauce."
      },
      bg: {
        name: "Спагети Карбонара",
        description: "Класически спагети Карбонара с кремообразен сос."
      }
    },
    "пилешко с екзотични подправки": {
      en: {
        name: "Chicken with Exotic Spices",
        description: "Marinated chicken seasoned with exotic spices."
      },
      bg: {
        name: "Пилешко с екзотични подправки",
        description: "Мариновано пилешко с екзотични подправки."
      }
    },
    "глазирани свински ребра": {
      en: {
        name: "Glazed Pork Ribs",
        description: "Pork ribs with glaze and potato wedges."
      },
      bg: {
        name: "Глазирани свински ребра",
        description: "Свински ребра с глазура и картофени клинове."
      }
    },
    "грил телeшки кюфтета": {
      en: {
        name: "Grilled Veal Meatballs",
        description: "Three grilled veal meatballs served with salad and chips."
      },
      bg: {
        name: "Грил телeшки кюфтета",
        description: "Три грил телeшки кюфтета със салата и чипс."
      }
    },
    "грил телешки кюфтета": {
      en: {
        name: "Grilled Veal Meatballs",
        description: "Three grilled veal meatballs served with salad and chips."
      },
      bg: {
        name: "Грил телешки кюфтета",
        description: "Три грил телешки кюфтета със салата и чипс."
      }
    },
    "смесен сач": {
      en: {
        name: "Mixed Saj",
        description: "Slow-cooked mixed meat saj served with lemon."
      },
      bg: {
        name: "Смесен сач",
        description: "Бавен сач със смесено месо и лимон."
      }
    },
    "маргарита пица": {
      en: {
        name: "Margherita Pizza",
        description: "Classic pizza with tomato sauce, mozzarella and basil."
      },
      bg: {
        name: "Маргарита пица",
        description: "Класическа пица с доматен сос, моцарела и босилек."
      }
    },
    "пица маргарита": {
      en: {
        name: "Margherita Pizza",
        description: "Classic pizza with tomato sauce, mozzarella and basil."
      },
      bg: {
        name: "Пица Маргарита",
        description: "Класическа пица с доматен сос, моцарела и босилек."
      }
    },
    pizza_marg: {
      en: {
        name: "Margherita Pizza",
        description: "Classic pizza with tomato sauce, mozzarella and basil."
      },
      bg: {
        name: "Пица Маргарита",
        description: "Класическа пица с доматен сос, моцарела и босилек."
      }
    },
    "сигнатурен бургер": {
      en: {
        name: "Signature Burger",
        description: "Burger with chicken patty, cabbage and tomatoes, served with fries."
      },
      bg: {
        name: "Сигнатурен бургер",
        description: "Бургер с пилешка котлета, зеле и домати с пържени картофи."
      }
    },
    "шоколадов лава кейк": {
      en: {
        name: "Chocolate Lava Cake",
        description: "Decadent chocolate cake with a molten chocolate center, served warm with vanilla ice cream, fresh strawberries and raspberry coulis."
      },
      bg: {
        name: "Шоколадов лава кейк",
        description: "Декадентен шоколадов кейк с разтопен шоколадов център."
      }
    },
    "кола 330мл": {
      en: {
        name: "Cola 330 ml",
        description: "Chilled cola soft drink."
      },
      bg: {
        name: "Кола 330мл",
        description: "Охладена безалкохолна напитка кола."
      }
    },
    cola: {
      en: {
        name: "Cola 330 ml",
        description: "Chilled cola soft drink."
      },
      bg: {
        name: "Кола 330мл",
        description: "Охладена безалкохолна напитка кола."
      }
    },
    "бира": {
      en: {
        name: "Beer",
        description: "Chilled beer."
      },
      bg: {
        name: "Бира",
        description: "Охладена бира."
      }
    },
    beer: {
      en: {
        name: "Beer",
        description: "Chilled beer."
      },
      bg: {
        name: "Бира",
        description: "Охладена бира."
      }
    }
  };

  window.MENU_TRANSLATIONS = window.MENU_TRANSLATIONS || {};
  window.MENU_TRANSLATIONS.categories = {
    ...categories,
    ...(window.MENU_TRANSLATIONS.categories || {})
  };
  window.MENU_TRANSLATIONS.items = {
    ...items,
    ...(window.MENU_TRANSLATIONS.items || {})
  };
})();
