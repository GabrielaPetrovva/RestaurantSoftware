/* ---------- Translation dictionary ---------- */
const i18n = {
    en: {
      Tables: 'Tables',
      Orders: 'Orders',
      Payments: 'Payments',
      'Delivery/Takeaway': 'Delivery/Takeaway',
      Statistics: 'Statistics',
      'Tap a table to open or create an order': 'Tap a table to open or create an order',
      'Quick Actions': 'Quick Actions',
      'Open Orders': 'Open Orders',
      'Delivery': 'Delivery',
      'Total': 'Total',
      'Amount': 'Amount',
      'Tip': 'TIP',
      'Comments': 'Comments',
      'Complete Payment': 'Complete Payment',
      'Menu': 'Menu',
      'Incoming Orders': 'Incoming Orders',
      'Print Orders': 'Print Orders',
      'Preparing': 'Preparing',
      'Ready': 'Ready',
      'Picked up': 'Picked up',
      'Waiter Dashboard': 'Waiter Dashboard',
      'Exit': 'Exit',
      'Pay': 'Pay',
      'Pizzas': 'Pizzas',
      'Drinks': 'Drinks',
      'Sides': 'Sides',
      'Sales this shift': 'Sales this shift',
      'Average check': 'Average check',
      'Served tables': 'Served tables',
      'Tips (total)': 'Tips (total)',
      'Margherita': 'Margherita',
      'Pepperoni': 'Pepperoni',
      'Quattro Formaggi': 'Quattro Formaggi',
      'Coca-Cola': 'Coca-Cola',
      'Water': 'Water',
      'Orange Juice': 'Orange Juice',
      'Fries': 'Fries',
      'Green Salad': 'Green Salad',
      'Garlic Bread': 'Garlic Bread',
      'Open checks and payment history': 'Open checks and payment history',
      'Add': 'Add',
      'Notes to kitchen/bar': 'Notes to kitchen/bar',
      'Back to Tables': 'Back to Tables'
    },
    bg: {
      Tables: 'Маси',
      Orders: 'Поръчки',
      Payments: 'Плащания',
      'Delivery/Takeaway': 'Доставка/Вземане',
      Statistics: 'Статистика',
      'Tap a table to open or create an order': 'Натиснете маса за нова поръчка',
      'Open Orders': 'Отворени поръчки',
      'Delivery': 'Доставка',
      'Total': 'Общо',
      'Amount': 'Сума',
      'Tip': 'БАКШИШ',
      'Comments': 'Бележки',
      'Complete Payment': 'Завърши плащане',
      'Menu': 'Меню',
      'Incoming Orders': 'Входящи поръчки',
      'Print Orders': 'Принтирай поръчки',
      'Preparing': 'В процес',
      'Ready': 'Готово',
      'Picked up': 'Взето',
      'Waiter Dashboard': 'Табло на сервитьор',
      'Exit': 'Изход',
      'Pay': 'Плащане',
      'Pizzas': 'Пици',
      'Drinks': 'Напитки',
      'Sides': 'Гарнитури',
      'Sales this shift': 'Продажби тази смяна',
      'Average check': 'Средна сметка',
      'Served tables': 'Обслужени маси',
      'Tips (total)': 'Бакшиш (общо)',
      'Margherita': 'Маргарита',
      'Pepperoni': 'Пеперони',
      'Quattro Formaggi': 'Кватро Формаджи',
      'Coca-Cola': 'Кока-Кола',
      'Water': 'Вода',
      'Orange Juice': 'Портокалов сок',
      'Fries': 'Пържени картофи',
      'Green Salad': 'Зелена салата',
      'Garlic Bread': 'Чеснов хляб',
      'Open checks and payment history': 'Отворени сметки и история на плащанията',
      'Add': 'Добави',
      'Notes to kitchen/bar': 'Бележки към кухнята/бара',
      'Back to Tables': 'Обратно към масите'
    }
  };
  
  // Translation additions for alerts, toggles and small UI texts
  Object.assign(i18n.en, {
    'No free table available. Select a table first.': 'No free table available. Select a table first.',
    'Select a table/order first': 'Select a table/order first',
    'Table not found': 'Table not found',
    'Item moved to': 'Item moved to',
    'Select an order first': 'Select an order first',
    'Payment completed:': 'Payment completed:',
    'sent to kitchen/bar.': 'sent to kitchen/bar.',
    'Print job sent (simulated).': 'Print job sent (simulated).',
    'Logged out successfully': 'Logged out successfully',
    'Are you sure you want to exit?': 'Are you sure you want to exit?',
    'Cash': 'Cash',
    'Card': 'Card',
    'Vouchers': 'Vouchers',
    'Online': 'Online',
    'No order selected': 'No order selected',
  });
  Object.assign(i18n.bg, {
    'No free table available. Select a table first.': 'Няма свободна маса. Изберете маса първо.',
    'Select a table/order first': 'Изберете маса/поръчка първо',
    'Table not found': 'Маса не е намерена',
    'Item moved to': 'Артикулът е преместен в',
    'Select an order first': 'Изберете поръчка първо',
    'Payment completed:': 'Плащането е завършено:',
    'sent to kitchen/bar.': 'изпратено към кухнята/бара.',
    'Print job sent (simulated).': 'Задачата за печат е изпратена (симулирано).',
    'Logged out successfully': 'Успешно излязохте от системата',
    'Are you sure you want to exit?': 'Сигурни ли сте, че искате да излезете?',
    'Cash': 'В брой',
    'Card': 'Карта',
    'Vouchers': 'Ваучери',
    'Online': 'Онлайн',
    'No order selected': 'Няма избрана поръчка',
  });
  // Add missing translation keys for UI texts
  // Ensure English translations are present too for completeness
  Object.assign(i18n, {});
  if (!i18n.en['Free']) i18n.en['Free'] = 'Free';
  if (!i18n.bg['Free']) i18n.bg['Free'] = 'Свободна';
  if (!i18n.en['Busy']) i18n.en['Busy'] = 'Busy';
  if (!i18n.bg['Busy']) i18n.bg['Busy'] = 'Заета';
  if (!i18n.en['Table']) i18n.en['Table'] = 'Table';
  if (!i18n.bg['Table']) i18n.bg['Table'] = 'Маса';
  if (!i18n.en['Order']) i18n.en['Order'] = 'Order';
  if (!i18n.bg['Order']) i18n.bg['Order'] = 'Поръчка';
  if (!i18n.en['No order selected. Tap a table to start.']) i18n.en['No order selected. Tap a table to start.'] = 'No order selected. Tap a table to start.';
  if (!i18n.bg['No order selected. Tap a table to start.']) i18n.bg['No order selected. Tap a table to start.'] = 'Няма избрана поръчка. Натиснете маса, за да започнете.';
  if (!i18n.en['Send']) i18n.en['Send'] = 'Send';
  if (!i18n.bg['Send']) i18n.bg['Send'] = 'Изпрати';
  if (!i18n.en['Move']) i18n.en['Move'] = 'Move';
  if (!i18n.bg['Move']) i18n.bg['Move'] = 'Премести';
  if (!i18n.en['Unknown']) i18n.en['Unknown'] = 'Unknown';
  if (!i18n.bg['Unknown']) i18n.bg['Unknown'] = 'Неизвестно';
  if (!i18n.en['No free table available. Select a table first.']) i18n.en['No free table available. Select a table first.'] = 'No free table available. Select a table first.';
  if (!i18n.bg['No free table available. Select a table first.']) i18n.bg['No free table available. Select a table first.'] = 'Няма свободна маса. Изберете маса първо.';
  if (!i18n.en['sent to kitchen/bar.']) i18n.en['sent to kitchen/bar.'] = 'sent to kitchen/bar.';
  if (!i18n.bg['sent to kitchen/bar.']) i18n.bg['sent to kitchen/bar.'] = 'изпратено към кухнята/бара.';
  if (!i18n.en['Select a table/order first']) i18n.en['Select a table/order first'] = 'Select a table/order first';
  if (!i18n.bg['Select a table/order first']) i18n.bg['Select a table/order first'] = 'Изберете маса/поръчка първо';
  if (!i18n.en['Table not found']) i18n.en['Table not found'] = 'Table not found';
  if (!i18n.bg['Table not found']) i18n.bg['Table not found'] = 'Маса не е намерена';
  if (!i18n.en['Item moved to']) i18n.en['Item moved to'] = 'Item moved to';
  if (!i18n.bg['Item moved to']) i18n.bg['Item moved to'] = 'Артикулът е преместен в';
  if (!i18n.en['Payment completed:']) i18n.en['Payment completed:'] = 'Payment completed:';
  if (!i18n.bg['Payment completed:']) i18n.bg['Payment completed:'] = 'Плащането е завършено:';
  if (!i18n.en['Print job sent (simulated).']) i18n.en['Print job sent (simulated).'] = 'Print job sent (simulated).';
  if (!i18n.bg['Print job sent (simulated).']) i18n.bg['Print job sent (simulated).'] = 'Задачата за печат е изпратена (симулирано).';
  if (!i18n.en['Logged out successfully']) i18n.en['Logged out successfully'] = 'Logged out successfully';
  if (!i18n.bg['Logged out successfully']) i18n.bg['Logged out successfully'] = 'Успешно излязохте от системата';
  
  /* ---------- State (in-memory, mock data) ---------- */
  let lang = 'en';
  
  // Simple tables dataset
  const tables = [
    { id: 1, name: 'Table 1', status: 'free', orderId: null },
    { id: 2, name: 'Table 2', status: 'busy', orderId: 101 },
    { id: 3, name: 'Table 3', status: 'ready', orderId: 102 },
    { id: 4, name: 'Table 4', status: 'busy', orderId: 103 },
    { id: 5, name: 'Table 5', status: 'free', orderId: null },
    { id: 6, name: 'Table 6', status: 'free', orderId: null }
  ];
  
  // Orders map (id -> order)
  const orders = {
    101: { id: 101, table: 2, items: [{ name: 'Margherita', meta: 'Tomato, mozzarella', price: 11.5 }], payments: [], tip: 0, comments: '' },
    102: { id: 102, table: 3, items: [{ name: 'Coca-Cola', meta: '330 ml', price: 3.0 }], payments: [], tip: 0, comments: '' },
    103: { id: 103, table: 4, items: [{ name: 'Burger', meta: 'Medium', price: 12.0 }], payments: [], tip: 0, comments: '' }
  };
  
  let nextOrderId = 200;
  let currentOrder = null; // pointer to currently open order (object in orders) or null
  
  // Menu items by category
  const menu = {
    pizzas: [
      { name: 'Margherita', price: 11.5 }, 
      { name: 'Pepperoni', price: 12.5 },
      { name: 'Quattro Formaggi', price: 13.0 }
    ],
    drinks: [
      { name: 'Coca-Cola', price: 3.0 }, 
      { name: 'Water', price: 1.5 },
      { name: 'Orange Juice', price: 4.0 }
    ],
    sides: [
      { name: 'Fries', price: 4.0 }, 
      { name: 'Green Salad', price: 4.5 },
      { name: 'Garlic Bread', price: 3.5 }
    ]
  };
  
  // Delivery mock
  const deliveries = [
    { id: 1234, status: 'preparing' },
    { id: 1235, status: 'ready' },
    { id: 1236, status: 'picked' }
  ];
  
  /* ---------- DOM references ---------- */
  const langSelect = document.getElementById('langSelect');
  const bottomNavButtons = document.querySelectorAll('nav.bottom-nav button'); // FIXED: Changed from nav.sidebar li
  const topNavButtons = document.querySelectorAll('nav.top-nav button');
  const views = document.querySelectorAll('.view');
  const tablesGrid = document.getElementById('tablesGrid');
  const tplTable = document.getElementById('tplTableChip');
  const tplMenuItem = document.getElementById('tplMenuItem');
  
  const orderTitle = document.getElementById('orderTitle');
  const orderItemsEl = document.getElementById('orderItems');
  const totalValueEl = document.getElementById('totalValue');
  const amountValueEl = document.getElementById('amountValue');
  
  const paymentTypeButtons = document.querySelectorAll('.pay-btn');
  const tipButtons = document.querySelectorAll('.tip-btn');
  const customTipInput = document.getElementById('customTip');
  const commentsInput = document.getElementById('comments');
  const completePaymentBtn = document.getElementById('completePayment');
  
  const menuItemsEl = document.getElementById('menuItems');
  const categoryButtons = document.querySelectorAll('.cat-btn');
  
  const checksList = document.getElementById('checksList');
  const deliveryList = document.getElementById('deliveryList');
  
  /* ---------- Utility functions ---------- */
  function t(key) {
    return (i18n[lang] && i18n[lang][key]) ? i18n[lang][key] : key;
  }
  
  function changeView(name) {
    // mark nav buttons as active
    const allNavButtons = [...bottomNavButtons, ...topNavButtons];
    allNavButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
    // show view
    views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  }
  
  /* ---------- Rendering ---------- */
  function renderNavLabels() {
    // update navigation labels based on language
    function updateNavButtons(buttons) {
      buttons.forEach(btn => {
        const map = { 
          tables: 'Tables', 
          orders: 'Orders', 
          payments: 'Payments', 
          delivery: 'Delivery/Takeaway', 
          stats: 'Statistics' 
        };
        const key = map[btn.dataset.view];
        const labelEl = btn.querySelector('span:last-child') || btn;
        if (labelEl && key) labelEl.textContent = t(key);
      });
    }
  
    updateNavButtons(bottomNavButtons);
    updateNavButtons(topNavButtons);
    
    // Header title
    const appTitle = document.getElementById('appTitle');
    if (appTitle) appTitle.textContent = t('Waiter Dashboard');
    
    // Exit button
    const exitBtn = document.getElementById('exitBtn');
    if (exitBtn) exitBtn.textContent = t('Exit');
    
    // Pay button in navigation
    const navPay = document.getElementById('navPay');
    if (navPay) navPay.textContent = t('Pay');
    
    document.getElementById('tablesTitle').textContent = t('Tables');
    document.getElementById('tablesSubtitle').textContent = t('Tap a table to open or create an order');
    const backToTablesLabel = document.getElementById('backToTablesLabel');
    if (backToTablesLabel) backToTablesLabel.textContent = t('Back to Tables');
    document.getElementById('labelTotal').textContent = t('Total');
    document.getElementById('labelAmount').textContent = t('Amount');
    document.getElementById('labelTip').textContent = t('Tip');
    document.getElementById('labelComments').textContent = t('Comments');
    document.getElementById('completePayment').textContent = t('Complete Payment');
    document.getElementById('menuTitle').textContent = t('Menu');
    
    // Category buttons
    const catPizzas = document.getElementById('catPizzas');
    if (catPizzas) catPizzas.textContent = t('Pizzas');
    const catDrinks = document.getElementById('catDrinks');
    if (catDrinks) catDrinks.textContent = t('Drinks');
    const catSides = document.getElementById('catSides');
    if (catSides) catSides.textContent = t('Sides');
    
    const deliverySubtitle = document.querySelector('#view-delivery .muted');
    if (deliverySubtitle) deliverySubtitle.textContent = t('Incoming Orders');
    
    document.getElementById('btnPrintOrders').textContent = t('Print Orders');
    
    // section titles
    const paymentsTitle = document.getElementById('paymentsTitle');
    if (paymentsTitle) paymentsTitle.textContent = t('Payments');
    const paymentsSubtitle = document.querySelector('#view-payments .muted');
    if (paymentsSubtitle) paymentsSubtitle.textContent = t('Open checks and payment history');
    
    const deliveryTitle = document.getElementById('deliveryTitle');
    if (deliveryTitle) deliveryTitle.textContent = t('Delivery/Takeaway');
    const statsTitle = document.getElementById('statsTitle');
    if (statsTitle) statsTitle.textContent = t('Statistics');
    
    // Statistics labels
    const statSalesLabel = document.getElementById('statSalesLabel');
    if (statSalesLabel) statSalesLabel.textContent = t('Sales this shift');
    const statAvgLabel = document.getElementById('statAvgLabel');
    if (statAvgLabel) statAvgLabel.textContent = t('Average check');
    const statTablesLabel = document.getElementById('statTablesLabel');
    if (statTablesLabel) statTablesLabel.textContent = t('Served tables');
    const statTipsLabel = document.getElementById('statTipsLabel');
    if (statTipsLabel) statTipsLabel.textContent = t('Tips (total)');
  
    // payment type buttons
    document.querySelectorAll('.pay-btn').forEach(btn => {
      const type = btn.dataset.type;
      // translate using i18n with capitalized key (e.g., 'cash' => 'Cash')
      const labelKey = type ? type.charAt(0).toUpperCase() + type.slice(1) : '';
      if (labelKey) btn.textContent = t(labelKey);
    });
    
    // Payments block title
    const paymentsBlockTitle = document.getElementById('paymentsBlockTitle');
    if (paymentsBlockTitle) paymentsBlockTitle.textContent = t('Payments');
    
    // Comments textarea placeholder
    const commentsInput = document.getElementById('comments');
    if (commentsInput) {
      commentsInput.placeholder = t('Notes to kitchen/bar');
    }
    
    // Custom tip input placeholder
    const customTipInput = document.getElementById('customTip');
    if (customTipInput) {
      customTipInput.placeholder = lang === 'bg' ? '€ 0,00' : '€ 0.00';
    }
  
    // ensure language select matches the current lang
    if (langSelect) langSelect.value = lang;
  }
  
  function renderTables() {
    tablesGrid.innerHTML = '';
    tables.forEach(tb => {
      const chip = tplTable.content.firstElementChild.cloneNode(true);
      let chipName = tb.name;
      if (chipName && chipName.startsWith('Table ')) {
        const parts = chipName.split(' ');
        chipName = `${t('Table')} ${parts.slice(1).join(' ')}`;
      }
      chip.querySelector('.name').textContent = chipName;
      // Translate status label
      let statusKey = '';
      if (tb.status === 'free') statusKey = 'Free';
      else if (tb.status === 'busy') statusKey = 'Busy';
      else if (tb.status === 'ready') statusKey = 'Ready';
      chip.querySelector('.status').textContent = t(statusKey);
      chip.classList.remove('free', 'busy', 'ready');
      
      if (tb.status === 'free') chip.classList.add('free');
      if (tb.status === 'busy') chip.classList.add('busy');
      if (tb.status === 'ready') chip.classList.add('ready');
  
      chip.addEventListener('click', () => {
        onTableClick(tb.id);
      });
      
      tablesGrid.appendChild(chip);
    });
  }
  
  function renderMenu(cat = 'pizzas') {
    menuItemsEl.innerHTML = '';
    menu[cat].forEach(mi => {
      const el = tplMenuItem.content.firstElementChild.cloneNode(true);
      // Translate menu item name
      const translatedName = t(mi.name) || mi.name;
      el.querySelector('.mname').textContent = translatedName;
      el.querySelector('.mprice').textContent = mi.price.toFixed(2) + '€';
      const addBtn = el.querySelector('button.add');
      
      // Translate "Add" button
      const addBtnText = lang === 'bg' ? '+ ' + t('Add') : '+ ' + t('Add');
      addBtn.textContent = addBtnText;
      
      addBtn.addEventListener('click', () => {
        if (!currentOrder) {
          // open new order at first free table
          const freeTable = tables.find(t => t.status === 'free');
          if (freeTable) {
            createOrderForTable(freeTable.id);
          } else {
            alert(t('No free table available. Select a table first.'));
            return;
          }
        }
        // Store original name for data consistency, but display translated name
        addItemToOrder(currentOrder.id, { name: mi.name, meta: '', price: mi.price, translatedName: translatedName });
      });
      
      menuItemsEl.appendChild(el);
    });
  }
  
  function renderOrderPanel() {
    if (!currentOrder) {
      orderTitle.textContent = t('Orders');
      orderItemsEl.innerHTML = '<div class="muted">' + t('No order selected. Tap a table to start.') + '</div>';
      totalValueEl.textContent = '0.00€';
      amountValueEl.textContent = '0.00€';
      commentsInput.value = '';
      return;
    }
  
    const table = tables.find(t => t.id === currentOrder.table);
    const tableLabel = table ? (table.name && table.name.startsWith('Table ') ? `${t('Table')} ${table.name.split(' ')[1]}` : table.name) : t('Unknown');
    orderTitle.textContent = `${t('Order')} #${currentOrder.id} — ${tableLabel}`;
    orderItemsEl.innerHTML = '';
    let total = 0;
    
    currentOrder.items.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'order-item';
      // Use translated name if available, otherwise translate the original name
      const displayName = it.translatedName || t(it.name) || it.name;
      row.innerHTML = `
        <div class="left">
          <div class="name">${displayName}</div>
          <div class="meta">${it.meta || ''}</div>
        </div>
        <div class="right">
          <div class="price">${it.price.toFixed(2)}€</div>
          <div style="margin-top:8px; text-align:right;">
            <button data-idx="${idx}" class="small send-btn" style="margin-right:8px; padding:6px 10px; border-radius:8px; border:1px solid var(--border); background:#fff; font-size:12px; font-weight:600;">${t('Send')}</button>
            <button data-idx="${idx}" class="small move-btn" style="padding:6px 10px; border-radius:8px; border:1px solid var(--border); background:#fff; font-size:12px; font-weight:600;">${t('Move')}</button>
          </div>
        </div>
      `;
      orderItemsEl.appendChild(row);
      total += it.price;
    });
  
    totalValueEl.textContent = total.toFixed(2) + '€';
    amountValueEl.textContent = (total + (currentOrder.tip || 0)).toFixed(2) + '€';
    commentsInput.value = currentOrder.comments || '';
  
    // wire send/move
    orderItemsEl.querySelectorAll('.send-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = +e.target.dataset.idx;
        const item = currentOrder.items[idx];
        const itemName = item.translatedName || t(item.name) || item.name;
        alert(`${itemName} ${t('sent to kitchen/bar.')}`);
      });
    });
    
    orderItemsEl.querySelectorAll('.move-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = +e.target.dataset.idx;
        transferItemToTable(idx);
      });
    });
  }
  
  function renderChecksList() {
    checksList.innerHTML = '';
    Object.values(orders).forEach(o => {
      const row = document.createElement('div');
      row.className = 'menu-item';
      const price = o.items.reduce((s, i) => s + i.price, 0);
      row.innerHTML = `
        <div>
          <strong>${t('Order')} #${o.id}</strong>
          <div class="muted">${t('Table')} ${o.table}</div>
        </div>
        <div>${price.toFixed(2)}€</div>
      `;
      checksList.appendChild(row);
    });
  }
  
  function renderDeliveries() {
    deliveryList.innerHTML = '';
    deliveries.forEach(d => {
      const row = document.createElement('div');
      row.className = 'delivery-row';
      const label = document.createElement('div');
      label.textContent = `${t('Order')} #${d.id}`;
      const btn = document.createElement('button');
      btn.className = 'status';
      
      if (d.status === 'preparing') { 
        btn.textContent = t('Preparing'); 
        btn.style.background = 'var(--accent-orange)'; 
      } else if (d.status === 'ready') { 
        btn.textContent = t('Ready'); 
        btn.style.background = 'var(--accent-green)'; 
        btn.style.color = '#063b12'; 
      } else { 
        btn.textContent = t('Picked up'); 
        btn.style.background = 'var(--accent-darkgreen)'; 
      }
      
      btn.addEventListener('click', () => {
        if (d.status === 'preparing') d.status = 'ready';
        else if (d.status === 'ready') d.status = 'picked';
        renderDeliveries();
      });
      
      row.appendChild(label);
      row.appendChild(btn);
      deliveryList.appendChild(row);
    });
  }
  
  function renderStats() {
    const served = Object.values(orders).length;
    const sales = Object.values(orders).reduce((s, o) => s + o.items.reduce((a, i) => a + i.price, 0), 0);
    const tips = Object.values(orders).reduce((s, o) => s + (o.tip || 0), 0);
    
    document.getElementById('statSales').textContent = sales.toFixed(2) + '€';
    document.getElementById('statAvg').textContent = (served ? (sales / served).toFixed(2) + '€' : '0.00€');
    document.getElementById('statTables').textContent = served;
    document.getElementById('statTips').textContent = `${tips.toFixed(2)}€ / ${served ? (tips / served).toFixed(2) + '€' : '0.00€'}`;
  }
  
  /* ---------- Actions ---------- */
  
  function onTableClick(tableId) {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
  
    if (!table.orderId) {
      // create new order
      createOrderForTable(tableId);
    } else {
      // open existing order
      currentOrder = orders[table.orderId];
    }
  
    // switch to orders view and render
    changeView('orders');
    renderOrderPanel();
    renderMenu('pizzas');
  }
  
  function createOrderForTable(tableId) {
    const oid = nextOrderId++;
    orders[oid] = { id: oid, table: tableId, items: [], payments: [], tip: 0, comments: '' };
    const tb = tables.find(t => t.id === tableId);
    tb.orderId = oid;
    tb.status = 'busy';
    currentOrder = orders[oid];
    renderTables();
  }
  
  function addItemToOrder(orderId, item) {
    if (!orders[orderId]) return;
    orders[orderId].items.push(item);
    renderOrderPanel();
    renderChecksList();
  }
  
  function transferItemToTable(idx) {
    if (!currentOrder) return alert(t('Select a table/order first'));
    const dest = prompt('Enter destination table id:');
    const tid = parseInt(dest);
    if (isNaN(tid)) return;
    const ttable = tables.find(t => t.id === tid);
    if (!ttable) return alert(t('Table not found'));
    
    const it = currentOrder.items.splice(idx, 1)[0];
    if (!ttable.orderId) {
      const oid = nextOrderId++;
      orders[oid] = { id: oid, table: tid, items: [], payments: [], tip: 0, comments: '' };
      ttable.orderId = oid;
      ttable.status = 'busy';
    }
    
    orders[ttable.orderId].items.push(it);
    renderOrderPanel();
    renderTables();
    renderChecksList();
    let tableLabel = ttable.name;
    if (tableLabel && tableLabel.startsWith('Table ')) {
      const parts = tableLabel.split(' ');
      tableLabel = `${t('Table')} ${parts.slice(1).join(' ')}`;
    }
    alert(`${t('Item moved to')} ${tableLabel}`);
  }
  
  // Payment logic (simulated)
  function completePayment() {
    if (!currentOrder) return alert(t('Select an order first'));
    
    // choose selected payment type
    const selectedPay = Array.from(paymentTypeButtons).find(btn => btn.classList.contains('active'));
    const payType = selectedPay ? selectedPay.dataset.type : 'cash';
    const subtotal = currentOrder.items.reduce((s, i) => s + i.price, 0);
    const tip = parseFloat(currentOrder.tip || 0);
    const total = +(subtotal + tip).toFixed(2);
  
    currentOrder.payments.push({ type: payType, amount: total });
    
    // free table
    const tb = tables.find(t => t.id === currentOrder.table);
    if (tb) { 
      tb.orderId = null; 
      tb.status = 'free'; 
    }
    
    // remove order from active orders (simulate closing)
    delete orders[currentOrder.id];
  
    currentOrder = null;
    const payLabel = (payType ? t(payType.charAt(0).toUpperCase() + payType.slice(1)) : payType);
    alert(`${t('Payment completed:')} ${total.toFixed(2)}€ (${payLabel})`);
    renderTables();
    renderOrderPanel();
    renderChecksList();
    renderStats();
  }
  
  /* ---------- Wire UI events ---------- */
  
  // Navigation clicks (bottom + top)
  [...bottomNavButtons, ...topNavButtons].forEach(btn => {
    btn.addEventListener('click', () => {
      changeView(btn.dataset.view);
    });
  });
  
  // language switch
    langSelect.addEventListener('change', (e) => {
    lang = e.target.value;
    renderAll();
  });
  
  // Back to tables button
  document.getElementById('backToTablesBtn')?.addEventListener('click', () => {
    changeView('tables');
  });
  
  // payment type toggle
  paymentTypeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      paymentTypeButtons.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // default selection
  if (paymentTypeButtons.length > 0) {
    paymentTypeButtons[0].classList.add('active');
  }
  
  // tip buttons
  tipButtons.forEach(b => {
    b.addEventListener('click', () => {
      if (!currentOrder) return alert(t('Select an order first'));
      const rate = parseFloat(b.dataset.tip);
      const subtotal = currentOrder.items.reduce((s, i) => s + i.price, 0);
      currentOrder.tip = +(subtotal * rate).toFixed(2);
      customTipInput.value = currentOrder.tip ? currentOrder.tip.toFixed(2) : '';
      renderOrderPanel();
    });
  });
  
  // custom tip input
  customTipInput.addEventListener('input', () => {
    if (!currentOrder) return;
    const val = parseFloat(customTipInput.value) || 0;
    currentOrder.tip = +val;
    renderOrderPanel();
  });
  
  // complete payment
  completePaymentBtn.addEventListener('click', () => {
    if (!currentOrder) return alert(t('No order selected'));
    currentOrder.comments = commentsInput.value;
    completePayment();
  });
  
  // menu categories
  categoryButtons.forEach(cb => {
    cb.addEventListener('click', () => {
      categoryButtons.forEach(x => x.classList.remove('active'));
      cb.classList.add('active');
      renderMenu(cb.dataset.cat);
    });
  });
  
  // print orders (simulated)
  document.getElementById('btnPrintOrders')?.addEventListener('click', () => {
    alert(t('Print job sent (simulated).'));
  });
  
  // Exit button
  document.getElementById('exitBtn')?.addEventListener('click', () => {
    if (confirm(t('Are you sure you want to exit?'))) {
      alert(t('Logged out successfully'));
      // In a real app, would redirect to login
    }
  });
  
  /* ---------- Initial render ---------- */
  function renderAll() {
    renderNavLabels();
    renderTables();
    renderMenu('pizzas');
    renderOrderPanel();
    renderChecksList();
    renderDeliveries();
    renderStats();
  }
  
  // Initialize on load
  renderAll();
  