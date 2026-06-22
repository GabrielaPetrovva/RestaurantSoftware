/* ======================= BOOT CHECK ======================= */
console.log(" WAITER script.js loaded");

/* ======================= FIREBASE IMPORTS (MODULE) ======================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, getDocs,
  collection, addDoc, updateDoc,
  query, where, orderBy, limit,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  formatWaiterNotification,
  getNotificationStatusText,
  getStationLabel,
  getWaiterNotificationStatusClass,
  getWaiterNotificationsQuery,
  mapWaiterNotificationsSnapshot,
  WAITER_NOTIFICATIONS_COLLECTION,
  WAITER_NOTIFICATIONS_LIMIT
} from "../shared/waiter-notifications.js";
import { resolveFinalStation } from "../js/station-utils.js";

/* ======================= CONFIG ======================= */
if (!window.firebaseConfig) {
  alert("вќЊ Missing config.js -> window.firebaseConfig");
  throw new Error("Missing window.firebaseConfig");
}

const app = initializeApp(window.firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ======================= DOM ======================= */
const qs = (id) => document.getElementById(id);
const btnPrintOrders = document.getElementById("btnPrintOrders");

const openProfileBtn = qs("openProfileBtn");
const modalLangBtn = qs("modalLangBtn");
const modalExitBtn = qs("modalExitBtn");
const scanBtn = qs("scanBtn");
const scanBtnMobile = qs("scanBtnMobile");

const views = Array.from(document.querySelectorAll(".view"));
const topNavBtns = Array.from(document.querySelectorAll(".top-nav button[data-view]"));
const bottomNavBtns = Array.from(document.querySelectorAll(".bottom-nav button[data-view]"));
const backToTablesBtn = qs("backToTablesBtn");

const tablesGrid = qs("tablesGrid");
const tplTableChip = qs("tplTableChip");
const waiterNotificationsList = qs("waiterNotificationsList");
const waiterNotificationsTitle = qs("waiterNotificationsTitle");
const waiterNotificationsSubtitle = qs("waiterNotificationsSubtitle");
const clearWaiterNotificationsBtn = qs("clearWaiterNotifications");

const orderItemsEl = qs("orderItems");
const totalValueEl = qs("totalValue");
const amountValueEl = qs("amountValue");

const categoryRow = qs("categoryRow");
const menuItemsEl = qs("menuItems");
const tplMenuItem = qs("tplMenuItem");

const paymentTypes = qs("paymentTypes");
const customTipEl = qs("customTip");
const completePaymentBtn = qs("completePayment");

const checksList = qs("checksList");

const statSales = qs("statSales");
const statAvg = qs("statAvg");
const statTables = qs("statTables");
const statTips = qs("statTips");
const receiptModal = qs("receiptModal");
const receiptBody = qs("receiptBody");
const closeReceipt = qs("closeReceipt");
const closeReceiptBtn = qs("closeReceiptBtn");
const printReceipt = qs("printReceipt");
const receiptTitle = qs("receiptTitle");
const onlinePaymentModal = qs("onlinePaymentModal");
const onlinePaymentTitle = qs("onlinePaymentTitle");
const onlinePaymentSummary = qs("onlinePaymentSummary");
const stripePaymentSection = qs("stripePaymentSection");
const stripePaymentElement = qs("stripePaymentElement");
const stripePaymentMessage = qs("stripePaymentMessage");
const confirmStripePaymentBtn = qs("confirmStripePayment");
const revolutPaymentSection = qs("revolutPaymentSection");
const revolutPaymentText = qs("revolutPaymentText");
const revolutCheckoutLink = qs("revolutCheckoutLink");
const checkRevolutStatusBtn = qs("checkRevolutStatus");
const bankTransferSection = qs("bankTransferSection");
const bankTransferInstructions = qs("bankTransferInstructions");
const checkBankTransferStatusBtn = qs("checkBankTransferStatus");
const onlinePaymentStatus = qs("onlinePaymentStatus");
const paymentQrModal = qs("paymentQrModal");
const paymentQrTitle = qs("paymentQrTitle");
const paymentQrSummary = qs("paymentQrSummary");
const paymentQrCanvas = qs("paymentQrCanvas");
const paymentQrFallback = qs("paymentQrFallback");
const paymentQrLink = qs("paymentQrLink");
const paymentQrStatus = qs("paymentQrStatus");
const copyPaymentQrLinkBtn = qs("copyPaymentQrLink");
const openPaymentQrLinkBtn = qs("openPaymentQrLink");
const closePaymentQrModalBtn = qs("closePaymentQrModal");

/* ======================= TRANSLATIONS ======================= */
let currentLang = localStorage.getItem('waiterDashboardLang') || 'en';
const normalizeWaiterNotifyValue = (value) => String(value ?? "").trim().toLowerCase();
const WAITER_NOTIFICATION_ALLOWED_ROLES = new Set(["waiter", "manager"]);

const translations = {
  en: {
    'Waiter Dashboard': 'Waiter Dashboard',
    'Tables': 'Tables',
    'Orders': 'Orders',
    'Payments': 'Payments',
    'Delivery': 'Delivery',
    'Statistics': 'Statistics',
    'Exit': 'Exit',
    'Tap a table to open or create an order': 'Tap a table to open or create an order',
    'Back to Tables': 'Back to Tables',
    'Order': 'Order',
    'No order selected. Tap a table to start.': 'No order selected. Tap a table to start.',
    'Total': 'Total',
    'Cash': 'Cash',
    'Card': 'Card',
    'Revolut': 'Revolut',
    'Bank Transfer': 'Bank Transfer',
    'Payment info cash': 'Cash is offline. Confirm only after receiving the money.',
    'Payment info card': 'Real card payment through Stripe. Card data is handled securely by Stripe.',
    'Payment info revolut': 'Real Revolut payment. The guest will complete checkout through Revolut.',
    'Payment info bank_transfer': 'Bank transfer payment. The order stays pending until the transfer is confirmed.',
    'Payment method info cash': 'Cash is offline. Confirm only after receiving the money.',
    'Payment method info card': 'Real card payment through Stripe. Card data is handled securely by Stripe.',
    'Payment method info revolut': 'Real Revolut payment. The guest will complete checkout through Revolut.',
    'Payment method info bank_transfer': 'Bank transfer payment. The order stays pending until the transfer is confirmed.',
    'Amount': 'Amount',
    'Tip': 'Tip',
    'Comments': 'Comments',
    'Notes to kitchen/bar': 'Notes to kitchen/bar',
    'Complete Payment': 'Complete Payment',
    'Menu': 'Menu',
    'Open checks and payment history': 'Open checks and payment history',
    'Delivery / Takeaway': 'Delivery / Takeaway',
    'Incoming Orders': 'Incoming Orders',
    'Print Orders': 'Print Orders',
    'Sales this shift': 'Sales this shift',
    'Average check': 'Average check',
    'Served tables': 'Served tables',
    'Tips (total)': 'Tips (total)',
    'Table': 'Table',
    'Free': 'Free',
    'Busy': 'Busy',
    'Occupied': 'Occupied',
    'No tables.': 'No tables.',
    'Loading...': 'Loading...',
    'Empty order. Add items from menu.': 'Empty order. Add items from menu.',
    'Order not found.': 'Order not found.',
    'No categories.': 'No categories.',
    'No payments yet.': 'No payments yet.',
    'Pay': 'Pay',
    'Stats': 'Stats',
    'Receipt': 'Receipt',
    'Table': 'Table',
    'Date': 'Date',
    'Payment Method': 'Payment Method',
    'Payment Reference': 'Payment Reference',
    'Payment Status': 'Payment Status',
    'Confirmed': 'Confirmed',
    'Online Payment': 'Online Payment',
    'Scan to pay': 'Scan to pay',
    'Copy link': 'Copy link',
    'Copied': 'Copied',
    'Open on this device': 'Open on this device',
    'Payment link': 'Payment link',
    'QR unavailable. Use the payment link instead.': 'QR unavailable. Use the payment link instead.',
    'Pay by card': 'Pay by card',
    'Open Revolut checkout': 'Open Revolut checkout',
    'Check payment status': 'Check payment status',
    'Check transfer status': 'Check transfer status',
    'Payment pending': 'Payment pending',
    'Payment successful': 'Payment successful',
    'Payment failed': 'Payment failed',
    'Payment declined': 'Payment was declined.',
    'Bank transfer instructions': 'Bank transfer instructions',
    'Reference': 'Reference',
    'IBAN': 'IBAN',
    'Beneficiary': 'Beneficiary',
    'Provider': 'Provider',
    'Status': 'Status',
    'Receipt No': 'Receipt No',
    'No selected order': 'No selected order.',
    'Order is empty': 'Order is empty.',
    'Order already paid': 'The order is already paid.',
    'Payment API not configured': 'Payment API response is missing required Stripe data.',
    'Payment backend inactive': 'Payment server is not available.',
    'Stripe publishable key missing': 'Stripe publishable key is missing.',
    'Revolut checkout link missing': 'Revolut checkout link is missing.',
    'Subtotal': 'Subtotal',
    'Tip': 'Tip',
    'Total': 'Total',
    'Print': 'Print',
    'Close': 'Close',
      'Quantity': 'Qty',
      'Price': 'Price',
      'Live Updates': 'Live Updates',
      'Latest kitchen and bar item statuses': 'Latest kitchen and bar item statuses',
      'No live notifications yet.': 'No live notifications yet.',
      'Clear': 'Clear',
      'Started': 'Started',
      'Ready': 'Ready',
      'Kitchen': 'Kitchen',
      'Bar': 'Bar'
  },

  bg: {
  'Waiter Dashboard': 'Табло на сервитьора',
  'Tables': 'Маси',
  'Orders': 'Поръчки',
  'Payments': 'Плащания',
  'Delivery': 'Доставка',
  'Statistics': 'Статистики',
  'Exit': 'Изход',
  'Tap a table to open or create an order': 'Натиснете маса, за да отворите или създадете поръчка',
  'Back to Tables': 'Назад към масите',
  'Order': 'Поръчка',
  'No order selected. Tap a table to start.': 'Няма избрана поръчка. Натиснете маса, за да започнете.',
  'Total': 'Общо',
  'Cash': 'В брой',
  'Card': 'Карта',
  'Revolut': 'Револют',
  'Bank Transfer': 'Банков превод',
  'Payment info cash': 'Плащане в брой. Потвърди само след като получиш парите.',
  'Payment info card': 'Реално плащане с карта през Stripe. Данните от картата се обработват защитено от Stripe.',
  'Payment info revolut': 'Реално плащане през Revolut. Клиентът завършва плащането в Revolut checkout.',
  'Payment info bank_transfer': 'Банков превод. Поръчката остава pending, докато преводът не бъде потвърден.',
  'Payment method info cash': 'Плащане в брой. Потвърди само след като получиш парите.',
  'Payment method info card': 'Реално плащане с карта през Stripe. Данните от картата се обработват защитено от Stripe.',
  'Payment method info revolut': 'Реално плащане през Revolut. Клиентът завършва плащането в Revolut checkout.',
  'Payment method info bank_transfer': 'Банков превод. Поръчката остава pending, докато преводът не бъде потвърден.',
  'Amount': 'Сума',
  'Tip': 'Бакшиш',
  'Comments': 'Коментари',
  'Notes to kitchen/bar': 'Бележки към кухня/бар',
  'Complete Payment': 'Завърши плащане',
  'Menu': 'Меню',
  'Open checks and payment history': 'Отворени сметки и история на плащанията',
  'Incoming Orders': 'Входящи поръчки',
  'Print Orders': 'Принтирай поръчки',
  'Sales this shift': 'Продажби тази смяна',
  'Average check': 'Среден чек',
  'Served tables': 'Обслужени маси',
  'Tips (total)': 'Бакшиши (общо)',
  'Table': 'Маса',
  'Free': 'Свободна',
  'Busy': 'Заета',
  'Occupied': 'Заета',
  'No tables.': 'Няма маси.',
  'Loading...': 'Зареждане...',
  'Empty order. Add items from menu.': 'Празна поръчка. Добавете артикули от менюто.',
  'Order not found.': 'Поръчката не е намерена.',
  'No categories.': 'Няма категории.',
  'No payments yet.': 'Все още няма плащания.',
  'Pay': 'Плащане',
  'Stats': 'Статистики',
  'Receipt': 'Разписка',
  'Date': 'Дата',
  'Payment Method': 'Метод на плащане',
  'Payment Reference': 'Референция на плащане',
  'Payment Status': 'Статус на плащане',
  'Confirmed': 'Потвърдено',
  'Online Payment': 'Онлайн плащане',
  'Scan to pay': 'Сканирай за плащане',
  'Copy link': 'Копирай линк',
  'Copied': 'Копирано',
  'Open on this device': 'Отвори на това устройство',
  'Payment link': 'Линк за плащане',
  'QR unavailable. Use the payment link instead.': 'QR кодът не е наличен. Използвай линка за плащане.',
  'Pay by card': 'Плати с карта',
  'Open Revolut checkout': 'Отвори Revolut плащане',
  'Check payment status': 'Провери статус',
  'Check transfer status': 'Провери статус',
  'Payment pending': 'Плащането чака потвърждение',
  'Payment successful': 'Плащането е успешно',
  'Payment failed': 'Плащането е неуспешно',
  'Payment declined': 'Плащането беше отказано.',
  'Bank transfer instructions': 'Инструкции за банков превод',
  'Reference': 'Референция',
  'IBAN': 'IBAN',
  'Beneficiary': 'Получател',
  'Provider': 'Доставчик',
  'Status': 'Статус',
  'Receipt No': 'Номер на бележка',
  'No selected order': 'Няма избрана поръчка.',
  'Order is empty': 'Поръчката е празна.',
  'Order already paid': 'Поръчката вече е платена.',
  'Payment API not configured': 'Payment API отговорът няма нужните Stripe данни.',
  'Payment backend inactive': 'Payment server is not available.',
  'Stripe publishable key missing': 'Stripe publishable key липсва.',
  'Revolut checkout link missing': 'Revolut checkout link липсва.',
  'Subtotal': 'Междинна сума',
  'Print': 'Принтирай',
  'Close': 'Затвори',
  'Quantity': 'Кол.',
  'Price': 'Цена',
  'Live Updates': 'Live известия',
  'Latest kitchen and bar item statuses': 'Последни статуса от кухня и бар',
  'No live notifications yet.': 'Все още няма live известия.',
  'Clear': 'Изчисти',
  'Started': 'Започнато',
  'Ready': 'Готово',
  'Kitchen': 'Кухня',
  'Bar': 'Бар'
 }
};
function t(key) {
  return translations[currentLang][key] || translations['en'][key] || key;
}

const PAYMENT_METHODS = {
  cash: {
    labelKey: "Cash",
    infoKey: "Payment info cash",
    icon: "💵"
  },
  card: {
    labelKey: "Card",
    infoKey: "Payment info card",
    icon: "💳"
  },
  revolut: {
    labelKey: "Revolut",
    infoKey: "Payment info revolut",
    icon: "🔁"
  },
  bank_transfer: {
    labelKey: "Bank Transfer",
    infoKey: "Payment info bank_transfer",
    icon: "🏦"
  }
};

function normalizePaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase();
  return PAYMENT_METHODS[method] ? method : "cash";
}

function getPaymentMethodLabel(method) {
  const normalized = normalizePaymentMethod(method);
  return t(PAYMENT_METHODS[normalized].labelKey);
}

function updatePaymentMethodInfo() {
  const infoEl = qs("paymentMethodInfo");
  if (!infoEl) return;
  const normalized = normalizePaymentMethod(payMethod);
  infoEl.textContent = t(PAYMENT_METHODS[normalized].infoKey);
}

function updateTranslations() {
  // Update header
  const appTitle = qs("appTitle");
  if (appTitle) appTitle.textContent = t('Waiter Dashboard');
  
  // Update navigation buttons
  document.querySelectorAll('.top-nav button[data-view="tables"]').forEach(el => el.textContent = t('Tables'));
  document.querySelectorAll('.top-nav button[data-view="orders"]').forEach(el => el.textContent = t('Orders'));
  document.querySelectorAll('.top-nav button[data-view="payments"]').forEach(el => el.textContent = t('Payments'));
  document.querySelectorAll('.top-nav button[data-view="delivery"]').forEach(el => el.textContent = t('Delivery'));
  document.querySelectorAll('.top-nav button[data-view="stats"]').forEach(el => el.textContent = t('Statistics'));
  
  document.querySelectorAll('.bottom-nav button[data-view="tables"] span:last-child').forEach(el => el.textContent = t('Tables'));
  document.querySelectorAll('.bottom-nav button[data-view="orders"] span:last-child').forEach(el => el.textContent = t('Orders'));
  document.querySelectorAll('.bottom-nav button[data-view="payments"] span:last-child').forEach(el => el.textContent = t('Pay'));
  document.querySelectorAll('.bottom-nav button[data-view="delivery"] span:last-child').forEach(el => el.textContent = t('Delivery'));
  document.querySelectorAll('.bottom-nav button[data-view="stats"] span:last-child').forEach(el => el.textContent = t('Stats'));
  
  // Update modal exit button
  if (modalExitBtn) modalExitBtn.textContent = t('Exit');
  if (modalLangBtn) modalLangBtn.textContent = currentLang === 'bg' ? 'EN' : 'BG';
  const waiterProfileRole = qs("waiterProfileRole");
  const waiterProfileHint = qs("waiterProfileHint");
  if (waiterProfileRole) {
  waiterProfileRole.textContent = currentLang === 'bg' ? 'Сервитьор' : 'Waiter';
}

if (waiterProfileHint) {
  waiterProfileHint.textContent = currentLang === 'bg'
    ? 'Табло за управление на маси и поръчки.'
    : 'The waiter dashboard for tables and orders.';
}
  
  // Update section titles
  const tablesTitle = qs("tablesTitle");
  if (tablesTitle) tablesTitle.textContent = t('Tables');
  const tablesSubtitle = qs("tablesSubtitle");
  if (tablesSubtitle) tablesSubtitle.textContent = t('Tap a table to open or create an order');
  
  const backToTablesLabel = qs("backToTablesLabel");
  if (backToTablesLabel) backToTablesLabel.textContent = t('Back to Tables');
  
  const orderTitle = qs("orderTitle");
  if (orderTitle) orderTitle.textContent = t('Order');
  
  const labelTotal = qs("labelTotal");
  if (labelTotal) labelTotal.textContent = t('Total');
  
  const paymentsBlockTitle = qs("paymentsBlockTitle");
  if (paymentsBlockTitle) paymentsBlockTitle.textContent = t('Payments');
  
  document.querySelectorAll('.pay-btn[data-type="cash"]').forEach(el => el.textContent = t('Cash'));
  document.querySelectorAll('.pay-btn[data-type="card"]').forEach(el => el.textContent = t('Card'));
  document.querySelectorAll('.pay-btn[data-type="revolut"]').forEach(el => el.textContent = t('Revolut'));
  document.querySelectorAll('.pay-btn[data-type="bank_transfer"]').forEach(el => el.textContent = t('Bank Transfer'));
  updatePaymentMethodInfo();
  
  const labelAmount = qs("labelAmount");
  if (labelAmount) labelAmount.textContent = t('Amount');
  
  const labelTip = qs("labelTip");
  if (labelTip) labelTip.textContent = t('Tip');
  
  if (completePaymentBtn) completePaymentBtn.textContent = t('Complete Payment');
  
  const menuTitle = qs("menuTitle");
  if (menuTitle) menuTitle.textContent = t('Menu');
  
  const paymentsTitle = qs("paymentsTitle");
  if (paymentsTitle) paymentsTitle.textContent = t('Payments');
  
  const deliveryTitle = qs("deliveryTitle");
  if (deliveryTitle) deliveryTitle.textContent = t('Delivery / Takeaway');
  
  const deliverySubtitle = qs("deliverySubtitle");
  if (deliverySubtitle) deliverySubtitle.textContent = t('Incoming Orders');
  
  if (btnPrintOrders) btnPrintOrders.textContent = t('Print Orders');
  
  const statsTitle = qs("statsTitle");
  if (statsTitle) statsTitle.textContent = t('Statistics');
  
  const statSalesLabel = qs("statSalesLabel");
  if (statSalesLabel) statSalesLabel.textContent = t('Sales this shift');
  
  const statAvgLabel = qs("statAvgLabel");
  if (statAvgLabel) statAvgLabel.textContent = t('Average check');
  
  const statTablesLabel = qs("statTablesLabel");
  if (statTablesLabel) statTablesLabel.textContent = t('Served tables');
  
  const statTipsLabel = qs("statTipsLabel");
  if (statTipsLabel) statTipsLabel.textContent = t('Tips (total)');
  
  // Update receipt modal translations
  if (receiptTitle) receiptTitle.textContent = t('Receipt');
  if (printReceipt) printReceipt.textContent = t('Print');
  if (closeReceiptBtn) closeReceiptBtn.textContent = t('Close');
  if (onlinePaymentTitle) onlinePaymentTitle.textContent = t('Online Payment');
  if (confirmStripePaymentBtn) confirmStripePaymentBtn.textContent = t('Pay by card');
  if (revolutCheckoutLink) revolutCheckoutLink.textContent = t('Open Revolut checkout');
  if (checkRevolutStatusBtn) checkRevolutStatusBtn.textContent = t('Check payment status');
  if (checkBankTransferStatusBtn) checkBankTransferStatusBtn.textContent = t('Check transfer status');
  if (revolutPaymentText) revolutPaymentText.textContent = t('Payment pending');
  if (paymentQrTitle) paymentQrTitle.textContent = t('Scan to pay');
  if (copyPaymentQrLinkBtn) copyPaymentQrLinkBtn.textContent = t('Copy link');
  if (openPaymentQrLinkBtn) openPaymentQrLinkBtn.textContent = t('Open on this device');
  if (closePaymentQrModalBtn) closePaymentQrModalBtn.textContent = t('Close');

  if (waiterNotificationsTitle) waiterNotificationsTitle.textContent = t('Live Updates');
  if (waiterNotificationsSubtitle) waiterNotificationsSubtitle.textContent = t('Latest kitchen and bar item statuses');
  if (clearWaiterNotificationsBtn) clearWaiterNotificationsBtn.textContent = t('Clear');
  
  // Update initial order items message if it exists
  if (orderItemsEl && orderItemsEl.textContent.includes('No order selected')) {
    orderItemsEl.innerHTML = `<div class="muted">${t('No order selected. Tap a table to start.')}</div>`;
  }
  
  // Re-render tables to update status text
  if (unsubTables) {
    listenTables();
  }

  renderWaiterNotifications();
}

/* ======================= GUARDS ======================= */
function requireEl(el, name) {
  if (!el) throw new Error(`Missing DOM element: ${name}`);
}
[
  [tablesGrid, "tablesGrid"],
  [tplTableChip, "tplTableChip"],
  [orderItemsEl, "orderItems"],
  [totalValueEl, "totalValue"],
  [amountValueEl, "amountValue"],
  [categoryRow, "categoryRow"],
  [menuItemsEl, "menuItems"],
  [tplMenuItem, "tplMenuItem"],
  [paymentTypes, "paymentTypes"],
  [customTipEl, "customTip"],
  [completePaymentBtn, "completePayment"],
  [checksList, "checksList"],
  [statSales, "statSales"],
  [statAvg, "statAvg"],
  [statTables, "statTables"],
  [statTips, "statTips"],
].forEach(([el, name]) => requireEl(el, name));

/* ======================= STATE ======================= */
let meUid = null;
let meEmp = null;

let selectedTableId = null;
let selectedOrderId = null;
let currentOrder = null;

let currentTotal = 0;

let categoriesCache = [];
let menusCache = [];
let selectedCategory = null;

let payMethod = "cash";
let tipPercent = 0;
let tipCustom = 0;
let activeOnlinePayment = null;
let stripeInstance = null;
let stripeElements = null;
let stripePaymentElementInstance = null;

let unsubTables = null;
let unsubOrder = null;
let unsubCats = null;
let unsubMenus = null;
let unsubPayments = null;
let unsubStats = null;
let unsubWaiterNotifications = null;
let waiterNotifications = [];
let clearedWaiterNotificationIds = new Set();

/* ======================= HELPERS ======================= */
const euro = (n) => `${(Number(n) || 0).toFixed(2)} €`;

function buildPaymentApiUrl(path) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  const base = String(window.PAYMENT_API_BASE_URL || "").replace(/\/$/, "");
  return base ? `${base}${cleanPath}` : cleanPath;
}

async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  return user.getIdToken();
}

async function apiPost(path, body) {
  const token = await getAuthToken();
  const url = buildPaymentApiUrl(path);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body || {})
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    console.error("Payment API error:", {
      url,
      status: res.status,
      statusText: res.statusText,
      data
    });
    if (res.status === 404 || res.status === 405) {
      throw new Error(
        "Payment API route is missing. The app must be deployed as a Node web service, not as static HTML."
      );
    }
    throw new Error(data.error || data.message || `API error ${res.status}`);
  }
  return data;
}

async function checkPaymentBackendHealth() {
  try {
    const res = await fetch(buildPaymentApiUrl("/api/health"));
    const data = await res.json().catch(() => ({}));

    return {
      ok: res.ok && data.ok === true,
      status: res.status,
      data
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || String(err)
    };
  }
}

async function ensurePaymentBackendActive() {
  const health = await checkPaymentBackendHealth();
  if (!health.ok) {
    console.error("Payment backend health check failed:", health);
    throw new Error("Payment server is not available.");
  }
  return health;
}

async function testPaymentApi() {
  const health = await checkPaymentBackendHealth();
  console.log("Payment API health:", health);
  return health;
}

if (typeof window !== "undefined") {
  window.checkPaymentBackendHealth = checkPaymentBackendHealth;
  window.testPaymentApi = testPaymentApi;
}

function setPaymentMessage(el, message, type = "") {
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("ok", "err");
  if (type) el.classList.add(type);
}

function getStatusClass(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "paid" || normalized === "succeeded" || normalized === "confirmed") return "paid";
  if (["failed", "cancelled", "canceled"].includes(normalized)) return "failed";
  return normalized || "pending";
}

function openOnlinePaymentModal() {
  if (!onlinePaymentModal) return;
  onlinePaymentModal.style.display = "block";
  onlinePaymentModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeOnlinePaymentModal() {
  if (!onlinePaymentModal) return;
  if (document.activeElement && onlinePaymentModal.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  completePaymentBtn?.focus();
  onlinePaymentModal.style.display = "none";
  onlinePaymentModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function resetOnlinePaymentSections() {
  [stripePaymentSection, revolutPaymentSection, bankTransferSection].forEach((section) => {
    if (section) section.hidden = true;
  });
  setPaymentMessage(stripePaymentMessage, "");
  setPaymentMessage(onlinePaymentStatus, "");
  if (stripePaymentElement) stripePaymentElement.innerHTML = "";
  if (bankTransferInstructions) bankTransferInstructions.innerHTML = "";
  stripeElements = null;
  stripePaymentElementInstance = null;
}

function renderOnlinePaymentSummary(context, method) {
  if (!onlinePaymentSummary) return;
  onlinePaymentSummary.innerHTML = `
    <div>${getPaymentMethodLabel(method)}</div>
    <div class="muted" style="font-size:12px; margin-top:4px;">
      ${t('Amount')}: ${euro(context.baseAmount)}
      ${context.tipAmount ? ` · ${t('Tip')}: ${euro(context.tipAmount)}` : ""}
    </div>
    <div style="margin-top:6px;">${t('Total')}: ${euro(context.finalTotal)}</div>
  `;
}

function renderBankTransferInstructions(data) {
  const instructions = data?.bankTransferInstructions || data?.instructions || {};
  const reference = data?.bankTransferReference || instructions.reference || data?.reference || "—";
  const iban = data?.bankIban || instructions.iban || instructions.account_number || "—";
  const beneficiary = data?.beneficiary || instructions.beneficiary || instructions.account_holder_name || "—";
  const hostedUrl = instructions.hosted_instructions_url || data?.hostedInstructionsUrl || "";

  if (!bankTransferInstructions) return;
  bankTransferInstructions.innerHTML = `
    <div><strong>${t('Bank transfer instructions')}</strong></div>
    <div><strong>${t('Reference')}:</strong> ${escapeReceiptText(reference)}</div>
    <div><strong>${t('IBAN')}:</strong> ${escapeReceiptText(iban)}</div>
    <div><strong>${t('Beneficiary')}:</strong> ${escapeReceiptText(beneficiary)}</div>
    <div><strong>${t('Amount')}:</strong> ${euro(data?.totalAmount || 0)}</div>
    ${hostedUrl ? `<div><a href="${escapeReceiptText(hostedUrl)}" target="_blank" rel="noopener">${escapeReceiptText(hostedUrl)}</a></div>` : ""}
  `;
}

function buildPaymentContext() {
  if (!selectedOrderId || !selectedTableId || !currentOrder) {
    throw new Error(t('No selected order'));
  }
  if (isClosedOrderRecord(currentOrder)) {
    throw new Error(t('Order already paid'));
  }

  const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];
  if (!items.length) {
    throw new Error(t('Order is empty'));
  }

  const baseAmount = Number(currentTotal || 0);
  const tipAmount = tipPercent > 0
    ? baseAmount * tipPercent
    : parseEuroInput(customTipEl?.value || String(tipCustom || ""));

  return {
    orderId: selectedOrderId,
    tableId: selectedTableId,
    receiptOrder: { ...currentOrder },
    receiptItems: items.map((item) => ({ ...item })),
    baseAmount,
    tipAmount,
    finalTotal: baseAmount + tipAmount
  };
}

function getPublicPaymentBaseUrl() {
  return String(window.PUBLIC_PAYMENT_BASE_URL || window.location.origin).replace(/\/$/, "");
}

function buildPublicPaymentUrl(method, context) {
  const normalizedMethod = normalizePaymentMethod(method);
  if (!["card", "revolut", "bank_transfer"].includes(normalizedMethod)) return "";

  const orderId = context?.orderId || selectedOrderId;
  const tableId = context?.tableId || selectedTableId;
  if (!orderId || !tableId) {
    throw new Error(t('No selected order'));
  }

  const tipAmount = Number.isFinite(Number(context?.tipAmount))
    ? Number(context.tipAmount)
    : parseEuroInput(customTipEl?.value || "0");
  const url = new URL("./payment.html", window.location.href);

  url.searchParams.set("method", normalizedMethod);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("tableId", tableId);
  url.searchParams.set("tip", String(Math.round((tipAmount || 0) * 100) / 100));
  url.searchParams.set("returnTo", "./index.html");
  url.searchParams.set("client", "1");

  if (Number.isFinite(Number(context?.baseAmount))) {
    url.searchParams.set("amount", String(Math.round(Number(context.baseAmount) * 100) / 100));
  }
  if (Number.isFinite(Number(context?.finalTotal))) {
    url.searchParams.set("total", String(Math.round(Number(context.finalTotal) * 100) / 100));
  }

  return url.toString();
}

function setPaymentQrStatus(message, type = "") {
  setPaymentMessage(paymentQrStatus, message, type);
}

function renderPaymentQrCode(paymentUrl) {
  if (!paymentQrCanvas || !paymentQrFallback) return;
  paymentQrCanvas.hidden = false;
  paymentQrFallback.hidden = true;
  paymentQrFallback.textContent = "";

  if (!window.QRCode || typeof window.QRCode.toCanvas !== "function") {
    paymentQrCanvas.hidden = true;
    paymentQrFallback.hidden = false;
    paymentQrFallback.textContent = `${t('QR unavailable. Use the payment link instead.')} ${paymentUrl}`;
    return;
  }

  window.QRCode.toCanvas(paymentQrCanvas, paymentUrl, {
    width: 252,
    margin: 2,
    color: {
      dark: "#111111",
      light: "#ffffff"
    }
  }, (err) => {
    if (!err) return;
    console.error("QR render failed:", err);
    paymentQrCanvas.hidden = true;
    paymentQrFallback.hidden = false;
    paymentQrFallback.textContent = `${t('QR unavailable. Use the payment link instead.')} ${paymentUrl}`;
  });
}

function openPaymentQrModal(method, context) {
  if (!paymentQrModal) return;
  const normalizedMethod = normalizePaymentMethod(method);
  const paymentUrl = buildPublicPaymentUrl(normalizedMethod, context);
  const paymentTotal = Number(context?.finalTotal || 0);

  if (paymentQrTitle) paymentQrTitle.textContent = t('Scan to pay');
  if (paymentQrSummary) {
    paymentQrSummary.innerHTML = `
      <div class="payment-qr-summary-row"><span>${escapeReceiptText(t('Amount'))}</span><strong>${escapeReceiptText(euro(paymentTotal))}</strong></div>
      <div class="payment-qr-summary-row"><span>${escapeReceiptText(t('Table'))}</span><strong>${escapeReceiptText(context?.tableId || selectedTableId || "—")}</strong></div>
      <div class="payment-qr-summary-row"><span>${escapeReceiptText(t('Order'))}</span><strong>${escapeReceiptText(context?.orderId || selectedOrderId || "—")}</strong></div>
      <div class="payment-qr-summary-row"><span>${escapeReceiptText(t('Payment Method'))}</span><strong>${escapeReceiptText(getPaymentMethodLabel(normalizedMethod))}</strong></div>
    `;
  }
  if (paymentQrLink) paymentQrLink.value = paymentUrl;
  if (copyPaymentQrLinkBtn) copyPaymentQrLinkBtn.textContent = t('Copy link');
  if (openPaymentQrLinkBtn) openPaymentQrLinkBtn.textContent = t('Open on this device');
  if (closePaymentQrModalBtn) closePaymentQrModalBtn.textContent = t('Close');
  setPaymentQrStatus("");

  paymentQrModal.style.display = "block";
  paymentQrModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderPaymentQrCode(paymentUrl);
}

function closePaymentQrModal() {
  if (!paymentQrModal) return;
  if (document.activeElement && paymentQrModal.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  completePaymentBtn?.focus();
  paymentQrModal.style.display = "none";
  paymentQrModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setPaymentQrStatus("");
}

async function copyPaymentQrLink() {
  const paymentUrl = paymentQrLink?.value || "";
  if (!paymentUrl) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(paymentUrl);
    } else {
      paymentQrLink.focus();
      paymentQrLink.select();
      document.execCommand("copy");
    }
    if (copyPaymentQrLinkBtn) copyPaymentQrLinkBtn.textContent = t('Copied');
    setPaymentQrStatus(t('Copied'), "ok");
  } catch (err) {
    console.error(err);
    setPaymentQrStatus(paymentUrl, "err");
  }
}

function openPaymentQrLinkOnDevice() {
  const paymentUrl = paymentQrLink?.value || "";
  if (!paymentUrl) return;
  window.open(paymentUrl, "_blank", "noopener");
}

function goToPaymentPage(method, context) {
  const normalizedMethod = normalizePaymentMethod(method);
  if (!["card", "revolut", "bank_transfer"].includes(normalizedMethod)) return;
  openPaymentQrModal(normalizedMethod, context);
}

function resetPaidOrderUi() {
  selectedTableId = null;
  selectedOrderId = null;
  currentOrder = null;
  currentTotal = 0;

  orderItemsEl.innerHTML = `<div class="muted">${t('No order selected. Tap a table to start.')}</div>`;
  totalValueEl.textContent = euro(0);
  amountValueEl.textContent = euro(0);

  customTipEl.value = "";
  tipCustom = 0;
  tipPercent = 0;

  setView("tables");
}

function showPaidReceiptFromContext(context, paymentData, method) {
  const receiptHtml = buildFiscalReceiptHtml({
    order: context.receiptOrder,
    items: context.receiptItems,
    subtotal: Number(paymentData?.amount ?? context.baseAmount),
    tip: Number(paymentData?.tipAmount ?? context.tipAmount),
    total: Number(paymentData?.totalAmount ?? context.finalTotal),
    paymentMethod: normalizePaymentMethod(method || paymentData?.method),
    tableId: context.tableId,
    waiter: meEmp,
    receiptNo: paymentData?.receiptNo || generateReceiptNumber()
  });
  showFiscalReceipt(receiptHtml);
}

async function handlePaidOnlinePayment(statusData, context, method) {
  const payment = statusData?.payment || statusData || {};
  showPaidReceiptFromContext(context, payment, method);
  closeOnlinePaymentModal();
  resetPaidOrderUi();
}

function buildWaiterNotificationItem(notification) {
  const row = document.createElement("div");
  row.className = "waiter-live-item";

  const top = document.createElement("div");
  top.className = "waiter-live-top";

  const stationBadge = document.createElement("span");
  stationBadge.className = `waiter-live-station ${String(notification?.station || "").trim().toLowerCase() === "bar" ? "bar" : "kitchen"}`;
  stationBadge.textContent = getStationLabel(notification?.station, currentLang);

  const statusBadge = document.createElement("span");
  statusBadge.className = `waiter-live-status ${getWaiterNotificationStatusClass(notification)}`;
  statusBadge.textContent = getNotificationStatusText(notification?.type, currentLang);

  const text = document.createElement("div");
  text.className = "waiter-live-text";
  text.textContent = formatWaiterNotification(notification, { lang: currentLang });

  top.appendChild(stationBadge);
  top.appendChild(statusBadge);
  row.appendChild(top);
  row.appendChild(text);
  return row;
}

function renderWaiterNotifications() {
  if (!waiterNotificationsList) return;

  waiterNotificationsList.innerHTML = "";
  const visibleNotifications = waiterNotifications.filter(
    (notification) => !clearedWaiterNotificationIds.has(notification.id)
  );

  if (!visibleNotifications.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.id = "waiterNotificationsEmpty";
    empty.textContent = t("No live notifications yet.");
    waiterNotificationsList.appendChild(empty);
    return;
  }

  visibleNotifications.forEach((notification) => {
    waiterNotificationsList.appendChild(buildWaiterNotificationItem(notification));
  });
}

function clearWaiterNotificationsState({ preserveCleared = false } = {}) {
  waiterNotifications = [];
  if (!preserveCleared) clearedWaiterNotificationIds = new Set();
  renderWaiterNotifications();
}

function stopWaiterNotificationsListener() {
  if (unsubWaiterNotifications) {
    unsubWaiterNotifications();
    unsubWaiterNotifications = null;
  }
}

function listenWaiterNotifications(user, employee) {
  stopWaiterNotificationsListener();

  const uid = String(user?.uid || auth.currentUser?.uid || "").trim();
  const email = String(user?.email || auth.currentUser?.email || "").trim();
  const role = normalizeWaiterNotifyValue(employee?.role);
  const status = normalizeWaiterNotifyValue(employee?.status);

  if (!uid) {
    console.warn("[WaiterNotify] listener skipped: missing auth user");
    clearWaiterNotificationsState();
    return;
  }
  if (!employee) {
    console.warn("[WaiterNotify] listener skipped: missing employee doc");
    clearWaiterNotificationsState();
    return;
  }
  if (status !== "active") {
    console.warn(`[WaiterNotify] listener skipped: inactive employee status (${status || "-"})`);
    clearWaiterNotificationsState();
    return;
  }
  if (!WAITER_NOTIFICATION_ALLOWED_ROLES.has(role)) {
    console.warn(`[WaiterNotify] listener skipped: unsupported role (${role || "-"})`);
    clearWaiterNotificationsState();
    return;
  }

  console.log(`[WaiterNotify] listening collection: ${WAITER_NOTIFICATIONS_COLLECTION}`);
  console.log(`[WaiterNotify] query: orderBy(createdAt desc) limit(${WAITER_NOTIFICATIONS_LIMIT})`);

  unsubWaiterNotifications = onSnapshot(
    getWaiterNotificationsQuery(db),
    (snap) => {
      waiterNotifications = mapWaiterNotificationsSnapshot(snap);
      console.log(`[WaiterNotify] received notifications: ${waiterNotifications.length}`);
      renderWaiterNotifications();
    },
    (err) => {
      console.error("[WaiterNotify] listener failed:", err);
      console.error("[WaiterNotify] current uid:", uid || "-");
      console.error("[WaiterNotify] current email:", email || "-");
      console.error("[WaiterNotify] current role:", role || "-");
      console.error("[WaiterNotify] current status:", status || "-");
      waiterNotifications = [];
      renderWaiterNotifications();
    }
  );

  console.log("[WaiterNotify] listener started successfully");
}

function setView(name) {
  views.forEach(v => v.classList.remove("active"));
  const t = qs(`view-${name}`);
  if (t) t.classList.add("active");

  [...topNavBtns, ...bottomNavBtns].forEach(b => b.classList.remove("active"));
  topNavBtns.filter(b => b.dataset.view === name).forEach(b => b.classList.add("active"));
  bottomNavBtns.filter(b => b.dataset.view === name).forEach(b => b.classList.add("active"));
}

function ensureShiftStart() {
  const k = `shiftStart_${meUid}`;
  let v = localStorage.getItem(k);
  if (!v) {
    v = String(Date.now());
    localStorage.setItem(k, v);
  }
  return Number(v);
}

function parseEuroInput(s) {
  if (!s) return 0;
  const cleaned = String(s).replace(",", ".").replace(/[^\d.]/g, "");
  return Number(cleaned) || 0;
}

const BG_DRINK_WORDS = [
  "напитка", "напитки", "drink", "drinks", "beverage", "beverages",
  "вода", "water", "минерална", "минерал", "газирана", "газира", "сода", "soda", "тоник",
  "cola", "кола", "coke", "pepsi", "пепси", "fanta", "фанта", "sprite", "спрайт",
  "сок", "juice", "фреш", "fresh", "лимонада", "lemonade", "айрян", "ayran",
  "кафе", "coffee", "еспресо", "espresso", "капучино", "cappuccino",
  "лате", "латте", "latte", "макиато", "macchiato", "американо", "americano",
  "фрапе", "frappe", "мока", "mocha", "чай", "tea",
  "бира", "beer", "вино", "wine", "бяло вино", "white wine", "червено вино", "red wine",
  "розе", "rose", "rosé", "просеко", "prosecco", "шампанско", "champagne",
  "уиски", "whisky", "whiskey", "водка", "vodka", "ракия", "rakia",
  "ром", "rum", "джин", "gin", "текила", "tequila", "коняк", "cognac",
  "бренди", "brandy", "ликьор", "liqueur", "коктейл", "cocktail",
  "мохито", "mojito", "маргарита", "margarita", "джин тоник", "gin tonic",
  "аперол", "aperol", "сприц", "spritz", "ред бул", "red bull",
  "редбул", "monster", "монстър", "енергийна", "energy", "енерг"
];
const CAKE_WORDS = ["торта", "торти", "cake", "cakes", "cheesecake", "чийзкейк", "tiramisu", "тирамису"];

function looksLikeCakeNameCategory(name, category = "") {
  const text = `${name || ""} ${category || ""}`.toLowerCase();
  return CAKE_WORDS.some((word) => text.includes(word));
}

function resolveStationFallbackByName(name) {
  const n = String(name || "").toLowerCase();
  if (looksLikeCakeNameCategory(n)) return "bar";
  return BG_DRINK_WORDS.some((w) => n.includes(w)) ? "bar" : "kitchen";
}

async function resolveStation(dbInstance, item) {
  const itemName = String(item?.name || item?.itemId || item?.menuId || "").trim();
  const itemCategory = String(item?.category || item?.categoryKey || item?.categorySlug || item?.type || "").trim();
  let menuData = null;
  const menuId = String(item?.menuId || "").trim();
  if (menuId) {
    try {
      const snap = await getDoc(doc(dbInstance, "menus", menuId));
      if (snap.exists()) {
        menuData = { id: snap.id, ...(snap.data() || {}) };
      }
    } catch (err) {
      console.warn("resolveStation menu lookup failed:", { menuId, err });
    }
  }

  return resolveFinalStation(
    { ...item, name: itemName, category: itemCategory },
    menuData
  );
}

function summarizeOrderItems(items) {
  const list = Array.isArray(items) ? items : [];
  let total = 0;
  let count = 0;
  list.forEach((item) => {
    const qty = Math.max(0, Number(item?.qty || 0));
    const price = Number(item?.price || 0);
    total += qty * (Number.isFinite(price) ? price : 0);
    count += qty;
  });
  return { total, count };
}

function mergeOrderSummaryItems(existingItems, incomingItem) {
  const out = Array.isArray(existingItems) ? existingItems.map((it) => ({ ...it })) : [];
  const resolvedStation = resolveFinalStation(incomingItem);
  const next = {
    itemId: String(incomingItem?.itemId || incomingItem?.menuId || incomingItem?.name || "Item").trim(),
    menuId: String(incomingItem?.menuId || "").trim(),
    name: String(incomingItem?.name || incomingItem?.itemId || "Item").trim(),
    category: String(incomingItem?.category || "").trim(),
    station: resolvedStation,
    price: Number(incomingItem?.price || 0) || 0,
    qty: Math.max(1, Number(incomingItem?.qty || 1) || 1)
  };

  const idx = out.findIndex((it) => {
    const leftId = String(it?.menuId || it?.itemId || "").trim().toLowerCase();
    const rightId = String(next.menuId || next.itemId || "").trim().toLowerCase();
    const leftName = String(it?.name || it?.itemId || "").trim().toLowerCase();
    const rightName = String(next.name || next.itemId || "").trim().toLowerCase();
    const leftStation = resolveFinalStation(it);
    const rightStation = String(next.station || "").trim().toLowerCase();
    return (leftId && rightId ? leftId === rightId : leftName === rightName) && leftStation === rightStation;
  });

  if (idx < 0) {
    out.push(next);
    return out;
  }

  out[idx].qty = (Number(out[idx].qty) || 0) + next.qty;
  if (!out[idx].menuId && next.menuId) out[idx].menuId = next.menuId;
  if (!out[idx].category && next.category) out[idx].category = next.category;
  if (!out[idx].name && next.name) out[idx].name = next.name;
  if (!Number.isFinite(Number(out[idx].price))) out[idx].price = next.price;
  out[idx].station = next.station;
  return out;
}

function normalizeOrderId(value) {
  return String(value || "").trim();
}

function normalizeOrderState(value) {
  return String(value || "").trim().toLowerCase();
}

function isClosedOrderRecord(orderData) {
  const status = normalizeOrderState(orderData?.status);
  const paymentStatus = normalizeOrderState(orderData?.paymentStatus);
  const orderStatus = normalizeOrderState(orderData?.orderStatus);
  return (
    paymentStatus === "paid" ||
    orderStatus === "closed" ||
    status === "paid" ||
    status === "closed" ||
    status === "cancelled" ||
    orderData?.closedAt != null
  );
}

function isReusableOpenOrder(orderData, tableId) {
  if (normalizeOrderId(orderData?.tableId) !== tableId) return false;
  if (isClosedOrderRecord(orderData)) return false;

  const status = normalizeOrderState(orderData?.status);
  const orderStatus = normalizeOrderState(orderData?.orderStatus);

  if (orderStatus && orderStatus !== "open") return false;
  if (status && !["open", "created"].includes(status)) return false;
  return true;
}

function getTableOrderCandidateIds(tableData) {
  const ids = [];
  const pushId = (value) => {
    const id = normalizeOrderId(value);
    if (!id || ids.includes(id)) return;
    ids.push(id);
  };

  pushId(tableData?.currentOrderId);
  const activeOrders = Array.isArray(tableData?.activeOrders) ? tableData.activeOrders : [];
  for (let i = activeOrders.length - 1; i >= 0; i -= 1) {
    pushId(activeOrders[i]);
  }
  return ids;
}

async function ensureOpenOrderForTable(tableId) {
  return runTransaction(db, async (tx) => {
    const resolvedTableId = normalizeOrderId(tableId);
    if (!resolvedTableId) throw new Error("Missing tableId");

    const nowTs = serverTimestamp();
    const tableRef = doc(db, "tables", resolvedTableId);
    const tableSnap = await tx.get(tableRef);
    const tableData = tableSnap.exists() ? (tableSnap.data() || {}) : {};
    const candidateIds = getTableOrderCandidateIds(tableData);

    let selected = null;

    for (const candidateId of candidateIds) {
      const orderRef = doc(db, "orders", candidateId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) continue;

      const orderData = orderSnap.data() || {};
      if (!isReusableOpenOrder(orderData, resolvedTableId)) continue;

      selected = {
        id: candidateId,
        ref: orderRef,
        data: orderData
      };
      break;
    }

    if (!selected) {
      const orderRef = doc(collection(db, "orders"));
      tx.set(orderRef, {
        orderId: orderRef.id,
        tableId: resolvedTableId,
        waiterId: meUid || null,
        createdBy: meUid || null,
        source: "waiter_dashboard",
        type: "dine-in",
        status: "open",
        orderStatus: "open",
        paymentStatus: "unpaid",
        closedAt: null,
        items: [],
        activeItemCount: 0,
        total: 0,
        createdAt: nowTs,
        updatedAt: nowTs
      });
      selected = {
        id: orderRef.id,
        ref: orderRef,
        data: null
      };
    } else {
      tx.set(selected.ref, {
        orderId: selected.id,
        tableId: resolvedTableId,
        waiterId: normalizeOrderId(selected.data?.waiterId) || meUid || null,
        createdBy: selected.data?.createdBy || meUid || null,
        source: selected.data?.source || "waiter_dashboard",
        type: selected.data?.type || "dine-in",
        status: "open",
        orderStatus: "open",
        paymentStatus: "unpaid",
        closedAt: null,
        updatedAt: nowTs
      }, { merge: true });
    }

    tx.set(tableRef, {
      status: "busy",
      currentOrderId: selected.id,
      activeOrders: [selected.id],
      updatedAt: nowTs
    }, { merge: true });

    return selected.id;
  });
}

async function getRemainingActiveOrdersForTableTx(tx, tableId, tableData, excludedOrderId) {
  const remaining = [];
  const candidateIds = getTableOrderCandidateIds(tableData);

  for (const candidateId of candidateIds) {
    if (!candidateId || candidateId === excludedOrderId || remaining.includes(candidateId)) continue;

    const orderRef = doc(db, "orders", candidateId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) continue;

    const orderData = orderSnap.data() || {};
    if (!isReusableOpenOrder(orderData, tableId)) continue;
    remaining.push(candidateId);
  }

  return remaining;
}

/* ======================= NAV ======================= */
[...topNavBtns, ...bottomNavBtns].forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});
backToTablesBtn?.addEventListener("click", () => setView("tables"));
function goToQR() {
  window.location.href = "./waiterQR.html";
}
scanBtn?.addEventListener("click", goToQR);
scanBtnMobile?.addEventListener("click", goToQR);
clearWaiterNotificationsBtn?.addEventListener("click", () => {
  clearedWaiterNotificationIds = new Set(waiterNotifications.map((notification) => notification.id));
  renderWaiterNotifications();
});

/* ======================= PROFILE MODAL ======================= */
function openWaiterProfileModal() {
  const modal = qs("waiterProfileModal");
  const nameEl = qs("waiterUserName");
  const profileName = qs("waiterProfileName");
  const profileEmail = qs("waiterProfileEmail");
  if (modal) {
    if (profileName && nameEl) profileName.textContent = nameEl?.textContent || "eur”";
    if (profileEmail) profileEmail.textContent = (typeof window !== "undefined" && window.__waiterEmail) ? window.__waiterEmail : "eur”";
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}

function closeWaiterProfileModal() {
  const modal = qs("waiterProfileModal");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
}

if (openProfileBtn) {
  openProfileBtn.addEventListener("click", openWaiterProfileModal);
}
document.querySelectorAll("[data-close-waiter-profile]").forEach((node) => {
  node.addEventListener("click", closeWaiterProfileModal);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = qs("waiterProfileModal");
    if (modal && modal.getAttribute("aria-hidden") === "false") closeWaiterProfileModal();
    if (paymentQrModal && paymentQrModal.getAttribute("aria-hidden") === "false") closePaymentQrModal();
  }
});

if (modalLangBtn) {
  modalLangBtn.addEventListener("click", () => {
    currentLang = currentLang === "bg" ? "en" : "bg";
    localStorage.setItem("waiterDashboardLang", currentLang);
    updateTranslations();
  });
}

if (modalExitBtn) {
  modalExitBtn.addEventListener("click", () => {
    closeWaiterProfileModal();
    if (typeof window.logout === "function") window.logout();
  });
}

/* ======================= AUTH ======================= */
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      stopWaiterNotificationsListener();
      clearWaiterNotificationsState();
      console.warn("[WaiterNotify] auth user: - -");
      alert("Not signed in. Go to login.");
      return;
    }

    console.log(`[WaiterNotify] auth user: ${user.uid} ${user.email || "-"}`);
    meUid = user.uid;
    clearedWaiterNotificationIds = new Set();

    const empSnap = await getDoc(doc(db, "employees", meUid));
    console.log(`[WaiterNotify] employee doc exists: ${empSnap.exists()}`);
    if (!empSnap.exists()) {
      stopWaiterNotificationsListener();
      clearWaiterNotificationsState();
      alert("вќЊ Missing employees/{uid} document");
      await signOut(auth);
      return;
    }

    meEmp = empSnap.data();
    const employeeRole = normalizeWaiterNotifyValue(meEmp?.role);
    const employeeStatus = normalizeWaiterNotifyValue(meEmp?.status);
    console.log(`[WaiterNotify] employee role: ${employeeRole || "-"}`);
    console.log(`[WaiterNotify] employee status: ${employeeStatus || "-"}`);

    if (employeeStatus !== "active") {
      stopWaiterNotificationsListener();
      clearWaiterNotificationsState();
      alert("вќЊ Your employee status is not active.");
      await signOut(auth);
      return;
    }

    if (typeof window !== "undefined") window.__waiterEmail = user.email || null;
    /* waiterUserName is updated by waiter-name-live.js */

    // Initialize translations
    updateTranslations();

    listenTables();
    listenCategories();
    listenMenus();
    listenPaymentsHistory();
    listenStats();
    listenWaiterNotifications(user, meEmp);
  } catch (e) {
    console.error(e);
    alert("Init error: " + e.message);
  }
});

/* Exit moved to profile modal */

/* ======================= TABLES ======================= */
function listenTables() {
  if (unsubTables) unsubTables();

  const qTables = query(collection(db, "tables"), orderBy("number"));
  unsubTables = onSnapshot(qTables, (snap) => {
    tablesGrid.innerHTML = "";

    if (snap.empty) {
      tablesGrid.innerHTML = `<div class="muted">${t('No tables.')}</div>`;
      return;
    }

    snap.forEach((d) => {
      const table = { id: d.id, ...d.data() };
      const node = tplTableChip.content.firstElementChild.cloneNode(true);

      node.querySelector(".name").textContent =
        (table.number != null) ? `${t('Table')} ${table.number}` : table.id;

      const status = String(table.status || "").toLowerCase();
      const isBusy = status === "busy" || status === "occupied";
      const isFree = status === "free" || !status;
      
      // Remove all status classes first
      node.classList.remove("free", "busy", "occupied", "ready");
      
      // Add appropriate class based on status
      if (isFree) {
        node.classList.add("free");
        node.querySelector(".status").textContent = t('Free');
      } else if (isBusy) {
        node.classList.add("busy");
        node.querySelector(".status").textContent = t('Busy');
      } else if (status === "ready") {
        node.classList.add("ready");
        node.querySelector(".status").textContent = t('Ready');
      } else {
        // Default to free if unknown status
        node.classList.add("free");
        node.querySelector(".status").textContent = t('Free');
      }

      node.addEventListener("click", () => openTable(table));
      tablesGrid.appendChild(node);
    });
  }, (err) => {
    console.error(err);
    tablesGrid.innerHTML = `<div class="muted">Tables error: ${err.message}</div>`;
  });
}

async function openTable(t) {
  try {
    selectedTableId = normalizeOrderId(t?.id);
    selectedOrderId = await ensureOpenOrderForTable(selectedTableId);
    currentOrder = null;
    completePaymentBtn.disabled = false;
    setView("orders");
    listenOrder(selectedOrderId);
  } catch (err) {
    console.error(err);
    alert("Open table failed: " + err.message);
  }
}

/* ======================= ORDER ======================= */
function listenOrder(orderId) {
  if (unsubOrder) unsubOrder();

  orderItemsEl.innerHTML = `<div class="muted">${t('Loading...')}</div>`;
  totalValueEl.textContent = euro(0);
  amountValueEl.textContent = euro(0);
  currentTotal = 0;

  unsubOrder = onSnapshot(doc(db, "orders", orderId), (snap) => {
    if (!snap.exists()) {
      orderItemsEl.innerHTML = `<div class="muted">${t('Order not found.')}</div>`;
      return;
    }

    currentOrder = { id: snap.id, ...snap.data() };
    completePaymentBtn.disabled = isClosedOrderRecord(currentOrder);
    const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];

    orderItemsEl.innerHTML = "";
    if (!items.length) {
      orderItemsEl.innerHTML = `<div class="muted">${t('Empty order. Add items from menu.')}</div>`;
      currentTotal = 0;
      totalValueEl.textContent = euro(0);
      amountValueEl.textContent = euro(0);
      return;
    }

    let total = 0;
    items.forEach((it, idx) => {
      const name = it.name || it.itemId || "Item";
      const price = Number(it.price) || 0;
      const qty = Number(it.qty) || 0;
      const line = price * qty;
      total += line;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.padding = "10px 0";
      row.style.borderBottom = "1px solid rgba(0,0,0,0.06)";

      row.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
          <div class="muted" style="font-size:12px;">${euro(price)} x ${qty}</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button data-dec style="width:34px; height:34px; border-radius:10px;">-</button>
          <span style="min-width:18px; text-align:center; font-weight:700;">${qty}</span>
          <button data-inc style="width:34px; height:34px; border-radius:10px;">+</button>
        </div>
        <div style="min-width:70px; text-align:right; font-weight:700;">${euro(line)}</div>
    <button data-del style="width:34px; height:34px; border-radius:10px;">✕</button>
      `;

      row.querySelector("[data-inc]").addEventListener("click", () => changeQty(idx, +1));
      row.querySelector("[data-dec]").addEventListener("click", () => changeQty(idx, -1));
      row.querySelector("[data-del]").addEventListener("click", () => removeItem(idx));

      orderItemsEl.appendChild(row);
    });

    currentTotal = total;
    totalValueEl.textContent = euro(total);
    amountValueEl.textContent = euro(total);
  }, (err) => {
    console.error(err);
    orderItemsEl.innerHTML = `<div class="muted">Order error: ${err.message}</div>`;
  });
}

async function changeQty(index, delta) {
  if (!selectedOrderId || !currentOrder) return;

  const items = Array.isArray(currentOrder.items) ? [...currentOrder.items] : [];
  if (!items[index]) return;

  const q = (Number(items[index].qty) || 0) + delta;
  if (q <= 0) items.splice(index, 1);
  else items[index].qty = q;
  const summary = summarizeOrderItems(items);

  await updateDoc(doc(db, "orders", selectedOrderId), {
    items,
    total: summary.total,
    activeItemCount: summary.count,
    updatedAt: serverTimestamp()
  });
}

async function removeItem(index) {
  if (!selectedOrderId || !currentOrder) return;

  const items = Array.isArray(currentOrder.items) ? [...currentOrder.items] : [];
  items.splice(index, 1);
  const summary = summarizeOrderItems(items);

  await updateDoc(doc(db, "orders", selectedOrderId), {
    items,
    total: summary.total,
    activeItemCount: summary.count,
    updatedAt: serverTimestamp()
  });
}

/* ======================= CATEGORIES (YOUR DB) ======================= */
function listenCategories() {
  if (unsubCats) unsubCats();

  const qCats = query(collection(db, "menu_categories"));
  unsubCats = onSnapshot(qCats, (snap) => {
    categoriesCache = [];
    categoryRow.innerHTML = "";

    snap.forEach((d) => {
      const data = d.data() || {};
      const key = String(data.category || d.id).trim().toLowerCase();

      categoriesCache.push({
        id: d.id,
        key,
        name: data.name || key,
        order: Number(data.order) || 0,
        ...data
      });
    });

    categoriesCache.sort((a, b) => a.order - b.order);

    if (!categoriesCache.length) {
      categoryRow.innerHTML = `<div class="muted">${t('No categories.')}</div>`;
      menuItemsEl.innerHTML = `<div class="muted" style="padding:10px 0;">${t('No categories.')}</div>`;
      selectedCategory = null;
      return;
    }

    if (selectedCategory && !categoriesCache.some(c => c.id === selectedCategory.id)) {
      selectedCategory = null;
    }

    categoriesCache.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn";
      btn.textContent = c.name;

      if (selectedCategory?.id === c.id) btn.classList.add("active");

      btn.addEventListener("click", () => {
        Array.from(categoryRow.querySelectorAll(".cat-btn")).forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedCategory = c;
        renderMenusForCategory();
      });

      categoryRow.appendChild(btn);

      if (!selectedCategory && i === 0) {
        selectedCategory = c;
        btn.classList.add("active");
      }
    });

    renderMenusForCategory();
  }, (err) => {
    console.error(err);
    categoryRow.innerHTML = `<div class="muted">Categories error: ${err.message}</div>`;
  });
}

/* ======================= MENUS (YOUR DB) ======================= */
function listenMenus() {
  if (unsubMenus) unsubMenus();

  const qMenus = query(collection(db, "menus"));
  unsubMenus = onSnapshot(qMenus, (snap) => {
    menusCache = [];
    snap.forEach((d) => menusCache.push({ id: d.id, ...d.data() }));
    renderMenusForCategory();
  }, (err) => {
    console.error(err);
    menuItemsEl.innerHTML = `<div class="muted">Menus error: ${err.message}</div>`;
  });
}

function renderMenusForCategory() {
  if (!selectedCategory) return;

  menuItemsEl.innerHTML = "";
  const catKey = String(selectedCategory.key).trim().toLowerCase();

  const activeMenus = menusCache.filter(m => m.active === true || m.active === undefined);

  const filtered = activeMenus.filter(m =>
    String(m.category || "").trim().toLowerCase() === catKey
  );

  if (!filtered.length) {
    menuItemsEl.innerHTML = `<div class="muted" style="padding:10px 0;">
      РќСЏРјР° items Р·Р° "${selectedCategory.name}" (menus.category == "${catKey}")
    </div>`;
    return;
  }

  filtered.sort((a, b) => String(a.name || a.id || "").localeCompare(String(b.name || b.id || "")));

  filtered.forEach((m) => {
    const node = tplMenuItem.content.firstElementChild.cloneNode(true);
    const price = (m.price != null) ? Number(m.price) : (Number(m.cost) || 0);

    node.querySelector(".mname").textContent = m.name || m.id;
    node.querySelector(".mprice").textContent = euro(price);

    node.querySelector(".add").addEventListener("click", () => addMenuToOrder(m));
    menuItemsEl.appendChild(node);
  });
}

async function addMenuToOrder(m) {
  if (!selectedOrderId || !currentOrder) {
    alert("Първо избери маса.");
    setView("tables");
    return;
  }

  const name = m.name || m.id;
  const price = (m.price != null) ? Number(m.price) : (Number(m.cost) || 0);
  const plainItem = {
    itemId: String(m.id || name).trim(),
    menuId: String(m.id || "").trim(),
    name: String(name || "").trim(),
    qty: 1,
    price: Number(price || 0) || 0,
    category: String(m.category || "").trim(),
    station: String(m.station || "").trim().toLowerCase()
  };

  console.table([
    {
      name: plainItem.name,
      menuId: plainItem.menuId || "",
      category: plainItem.category || "",
      station: plainItem.station || ""
    }
  ]);

  const resolvedItem = {
    ...plainItem,
    station: await resolveStation(db, plainItem)
  };
  const resolvedItems = [
    {
      name: resolvedItem.name,
      qty: Number(resolvedItem.qty || 1),
      price: Number(resolvedItem.price || 0),
      menuId: resolvedItem.menuId || "",
      category: resolvedItem.category || "",
      station: resolvedItem.station
    }
  ];
  console.table(resolvedItems);

  await addDoc(collection(db, "orders", selectedOrderId, "items"), {
    orderId: selectedOrderId,
    tableId: selectedTableId || currentOrder?.tableId || "",
    name: resolvedItem.name,
    qty: Number(resolvedItem.qty || 1),
    price: Number(resolvedItem.price || 0),
    menuId: resolvedItem.menuId || "",
    category: resolvedItem.category || "",
    station: resolvedItem.station,
    status: "new",
    createdAt: serverTimestamp()
  });

  const items = mergeOrderSummaryItems(currentOrder?.items, resolvedItem);
  const summary = summarizeOrderItems(items);
  await updateDoc(doc(db, "orders", selectedOrderId), {
    items,
    total: summary.total,
    activeItemCount: summary.count,
    status: "open",
    orderStatus: "open",
    paymentStatus: "unpaid",
    closedAt: null,
    updatedAt: serverTimestamp()
  });
}

/* ======================= PAY UI ======================= */
paymentTypes.addEventListener("click", (e) => {
  const btn = e.target.closest(".pay-btn[data-type]");
  if (!btn) return;

  payMethod = normalizePaymentMethod(btn.dataset.type);
  paymentTypes.querySelectorAll(".pay-btn").forEach((node) => {
    node.classList.toggle("active", node === btn);
  });
  updatePaymentMethodInfo();
});

customTipEl.addEventListener("input", () => {
  tipCustom = parseEuroInput(customTipEl.value);
  tipPercent = 0;
});

/* ======================= RECEIPT ======================= */
let lastReceiptHtml = "";

function escapeReceiptText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function formatReceiptMoney(value) {
  return `${(Number(value) || 0).toFixed(2)} €`;
}

function formatReceiptDate(date = new Date()) {
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function generateReceiptNumber() {
  return String(Date.now()).slice(-8).padStart(8, "0");
}

function getReceiptTableLabel(order, selectedTableId) {
  return order?.tableNumber || order?.tableName || order?.tableLabel || order?.tableId || selectedTableId || "—";
}

function getReceiptWaiterLabel(employee, fallbackUid) {
  return employee?.name || employee?.firstName || employee?.email || fallbackUid || "—";
}

function buildFiscalReceiptHtml({
  order,
  items,
  subtotal,
  tip,
  total,
  paymentMethod,
  tableId,
  waiter,
  receiptNo
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const nowText = formatReceiptDate(new Date());
  const tableText = getReceiptTableLabel(order, tableId);
  const waiterText = getReceiptWaiterLabel(waiter, order?.waiterId);
  const paymentLabel = getPaymentMethodLabel(paymentMethod);
  const finalReceiptNo = receiptNo || generateReceiptNumber();

  const subtotalNumber = Number(subtotal) || 0;
  const tipNumber = Number(tip) || 0;
  const totalNumber = Number(total) || subtotalNumber + tipNumber;

  const vatBase = totalNumber / 1.2;
  const vatAmount = totalNumber - vatBase;

  const rowsHtml = safeItems.map((item, index) => {
    const name = escapeReceiptText(item?.name || item?.itemId || `Артикул ${index + 1}`);
    const qty = Number(item?.qty ?? item?.quantity ?? 1) || 1;
    const price = Number(item?.price || 0) || 0;
    const lineTotal = Number.isFinite(Number(item?.totalPrice))
      ? Number(item.totalPrice)
      : qty * price;

    return `
      <div class="fiscal-item">
        <div class="fiscal-item-name">${index + 1}. ${name}</div>
        <div class="fiscal-item-line">
          <span>${qty.toFixed(qty % 1 === 0 ? 0 : 3)} x ${price.toFixed(2)}</span>
          <span>${lineTotal.toFixed(2)}</span>
        </div>
        <div class="fiscal-tax-line">
          <span>ДДС група Б 20%</span>
          <span>${lineTotal.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="fiscal-receipt">
      <div class="fiscal-center fiscal-strong">РЕСТОРАНТ “DEMO RESTAURANT”</div>
      <div class="fiscal-center">гр. София, бул. “Витоша” № 100</div>
      <div class="fiscal-center">ЕИК: 123456789</div>
      <div class="fiscal-center">ДДС №: BG123456789</div>
      <div class="fiscal-center">Тел: 0888 123 456</div>
      <div class="fiscal-center">Обект: 001 &nbsp;&nbsp; Каса: 01</div>

      <div class="fiscal-separator"></div>

      <div class="fiscal-center fiscal-title">ФИСКАЛЕН БОН</div>
      <div class="fiscal-center fiscal-subtitle">КАСОВА БЕЛЕЖКА</div>

      <div class="fiscal-separator"></div>

      <div class="fiscal-row">
        <span>Бон №:</span>
        <span>${escapeReceiptText(finalReceiptNo)}</span>
      </div>
      <div class="fiscal-row">
        <span>Дата:</span>
        <span>${escapeReceiptText(nowText)}</span>
      </div>
      <div class="fiscal-row">
        <span>Маса:</span>
        <span>${escapeReceiptText(tableText)}</span>
      </div>
      <div class="fiscal-row">
        <span>Оператор:</span>
        <span>${escapeReceiptText(waiterText)}</span>
      </div>

      <div class="fiscal-double-separator"></div>

      ${rowsHtml || `<div class="fiscal-center">НЯМА АРТИКУЛИ</div>`}

      <div class="fiscal-double-separator"></div>

      <div class="fiscal-row">
        <span>Междинна сума:</span>
        <span>${subtotalNumber.toFixed(2)} €</span>
      </div>
      <div class="fiscal-row">
        <span>Бакшиш:</span>
        <span>${tipNumber.toFixed(2)} €</span>
      </div>

      <div class="fiscal-row fiscal-total">
        <span>ОБЩО:</span>
        <span>${totalNumber.toFixed(2)} €</span>
      </div>

      <div class="fiscal-row">
        <span>${escapeReceiptText(t('Payment Method'))}:</span>
        <span>${escapeReceiptText(paymentLabel)}</span>
      </div>
      <div class="fiscal-row">
        <span>${escapeReceiptText(paymentLabel)}:</span>
        <span>${totalNumber.toFixed(2)} €</span>
      </div>

      <div class="fiscal-separator"></div>

      <div class="fiscal-row">
        <span>Данъчна основа Б:</span>
        <span>${vatBase.toFixed(2)} €</span>
      </div>
      <div class="fiscal-row">
        <span>ДДС Б 20%:</span>
        <span>${vatAmount.toFixed(2)} €</span>
      </div>

      <div class="fiscal-separator"></div>

      <div class="fiscal-row">
        <span>ФП №:</span>
        <span>DT123456</span>
      </div>
      <div class="fiscal-row">
        <span>ФМ №:</span>
        <span>12345678</span>
      </div>
      <div class="fiscal-row">
        <span>КЛЕН №:</span>
        <span>00001234</span>
      </div>

      <div class="fiscal-barcode">|||| ||| |||| || |||||</div>

      <div class="fiscal-qr-box" aria-hidden="true">
        <span></span><span></span><span></span><span class="empty"></span><span></span>
        <span></span><span class="empty"></span><span></span><span></span><span class="empty"></span>
        <span></span><span></span><span class="empty"></span><span></span><span></span>
        <span class="empty"></span><span></span><span></span><span class="empty"></span><span></span>
        <span></span><span class="empty"></span><span></span><span></span><span></span>
      </div>

      <div class="fiscal-center fiscal-small">Проверка на бележката: demo.local/receipt/${escapeReceiptText(finalReceiptNo)}</div>

      <div class="fiscal-separator"></div>

      <div class="fiscal-center">БЛАГОДАРИМ ВИ!</div>
      <div class="fiscal-center fiscal-small">Заповядайте отново</div>

      <div class="fiscal-separator"></div>
      <div class="fiscal-center fiscal-small">Визуална бележка за целите на софтуера</div>
    </div>
  `;
}

function buildReceiptPrintDocument(receiptInnerHtml, title = "Demo Electronic Receipt") {
  return `
    <!DOCTYPE html>
    <html lang="bg">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeReceiptText(title)}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          width: 80mm;
          min-width: 80mm;
          max-width: 80mm;
          background: #fff;
          color: #000;
          font-family: "Courier New", "Consolas", monospace;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          padding: 0;
        }

        .print-shell {
          width: 80mm;
          min-width: 80mm;
          max-width: 80mm;
          margin: 0;
          padding: 0;
          background: #fff;
        }

        .fiscal-receipt {
          width: 76mm;
          min-width: 76mm;
          max-width: 76mm;
          margin: 0 auto;
          padding: 3mm 2mm 5mm;
          background: #fff;
          color: #000;
          font-family: "Courier New", "Consolas", monospace;
          font-size: 11px;
          line-height: 1.25;
        }

        .fiscal-center {
          text-align: center;
        }

        .fiscal-left {
          text-align: left;
        }

        .fiscal-right {
          text-align: right;
        }

        .fiscal-strong {
          font-weight: 900;
        }

        .fiscal-title {
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .fiscal-subtitle {
          font-weight: 700;
          font-size: 11px;
        }

        .fiscal-small {
          font-size: 9px;
          line-height: 1.2;
        }

        .fiscal-separator {
          border-top: 1px dashed #000;
          margin: 6px 0;
          height: 0;
        }

        .fiscal-double-separator {
          border-top: 2px solid #000;
          margin: 7px 0;
          height: 0;
        }

        .fiscal-row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          width: 100%;
        }

        .fiscal-row span:first-child {
          flex: 0 0 auto;
        }

        .fiscal-row span:last-child {
          flex: 1 1 auto;
          text-align: right;
          word-break: break-word;
        }

        .fiscal-item {
          margin-bottom: 6px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .fiscal-item-name {
          font-weight: 800;
          word-break: break-word;
          text-transform: uppercase;
        }

        .fiscal-item-line {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          width: 100%;
        }

        .fiscal-item-line span:last-child {
          text-align: right;
          font-weight: 700;
        }

        .fiscal-tax-line {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          font-size: 10px;
        }

        .fiscal-total {
          font-weight: 900;
          font-size: 14px;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 4px 0;
          margin-top: 4px;
        }

        .fiscal-barcode {
          margin-top: 8px;
          text-align: center;
          font-family: "Courier New", monospace;
          font-size: 18px;
          letter-spacing: -1px;
          line-height: 1;
        }

        .fiscal-qr-box {
          width: 24mm;
          height: 24mm;
          margin: 8px auto 4px;
          border: 2px solid #000;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          grid-template-rows: repeat(5, 1fr);
          gap: 1px;
          padding: 2px;
        }

        .fiscal-qr-box span {
          background: #000;
        }

        .fiscal-qr-box span.empty {
          background: #fff;
        }

        @media screen {
          html,
          body {
            width: 100%;
            max-width: none;
            background: #e5e5e5;
          }

          body {
            padding: 18px 0;
          }

          .print-shell {
            width: 80mm;
            margin: 0 auto;
            background: #fff;
            box-shadow: 0 10px 35px rgba(0,0,0,0.22);
          }
        }

        @media print {
          html,
          body {
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }

          .print-shell {
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }

          .fiscal-receipt {
            width: 76mm !important;
            min-width: 76mm !important;
            max-width: 76mm !important;
            margin: 0 auto !important;
            padding: 3mm 2mm 5mm !important;
            background: #fff !important;
            color: #000 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-shell">
        ${receiptInnerHtml}
      </div>

      <script>
        window.addEventListener("load", () => {
          setTimeout(() => {
            window.focus();
            window.print();
          }, 200);
        });

        window.addEventListener("afterprint", () => {
          setTimeout(() => {
            window.close();
          }, 200);
        });
      <\/script>
    </body>
    </html>
  `;
}

function showFiscalReceipt(receiptHtml) {
  if (!receiptModal || !receiptBody) return;
  lastReceiptHtml = receiptHtml || "";
  if (receiptTitle) receiptTitle.textContent = "Demo Electronic Receipt";
  receiptBody.innerHTML = lastReceiptHtml;
  receiptModal.style.display = "block";
  receiptModal.classList.add("show");
  receiptModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("receipt-open");
}

function hideFiscalReceipt() {
  if (!receiptModal) return;
  receiptModal.style.display = "none";
  receiptModal.classList.remove("show");
  receiptModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("receipt-open");
}

function printFiscalReceiptFromNewWindow(receiptHtml) {
  const printWindow = window.open("", "receiptPrintWindow", "width=420,height=900");

  if (!printWindow) {
    alert("Браузърът блокира прозореца за печат. Позволи pop-up и опитай пак.");
    return;
  }

  const docHtml = buildReceiptPrintDocument(receiptHtml, "Demo Electronic Receipt");
  printWindow.document.open();
  printWindow.document.write(docHtml);
  printWindow.document.close();

  console.info("[receipt-print] Ако preview пак е A4, избери Paper size 80mm/Receipt в настройките на принтера. За Microsoft Print to PDF браузърът може да показва A4, но документът е 80mm layout.");
}

function showReceipt(orderData, items, baseAmount, tipAmount, payMethod, tableNumber) {
  const normalizedPayMethod = normalizePaymentMethod(payMethod);
  const receiptHtml = buildFiscalReceiptHtml({
    order: orderData,
    items,
    subtotal: baseAmount,
    tip: tipAmount,
    total: Number(baseAmount || 0) + Number(tipAmount || 0),
    paymentMethod: normalizedPayMethod,
    tableId: tableNumber,
    waiter: meEmp,
    receiptNo: generateReceiptNumber()
  });
  showFiscalReceipt(receiptHtml);
}

function hideReceipt() {
  hideFiscalReceipt();
}

if (closeReceipt) {
  closeReceipt.addEventListener("click", hideReceipt);
}

if (closeReceiptBtn) {
  closeReceiptBtn.addEventListener("click", hideReceipt);
}

if (receiptModal) {
  receiptModal.addEventListener("click", (e) => {
    if (e.target === receiptModal) {
      hideReceipt();
    }
  });
}

document.querySelectorAll("[data-close-online-payment]").forEach((node) => {
  node.addEventListener("click", closeOnlinePaymentModal);
});

if (onlinePaymentModal) {
  onlinePaymentModal.addEventListener("click", (e) => {
    if (e.target === onlinePaymentModal) {
      closeOnlinePaymentModal();
    }
  });
}

document.querySelectorAll("[data-close-payment-qr]").forEach((node) => {
  node.addEventListener("click", closePaymentQrModal);
});

if (paymentQrModal) {
  paymentQrModal.addEventListener("click", (e) => {
    if (e.target === paymentQrModal) {
      closePaymentQrModal();
    }
  });
}

copyPaymentQrLinkBtn?.addEventListener("click", copyPaymentQrLink);
openPaymentQrLinkBtn?.addEventListener("click", openPaymentQrLinkOnDevice);
closePaymentQrModalBtn?.addEventListener("click", closePaymentQrModal);

if (printReceipt) {
  printReceipt.addEventListener("click", () => {
    if (!lastReceiptHtml) {
      alert("Няма генерирана касова бележка.");
      return;
    }

    printFiscalReceiptFromNewWindow(lastReceiptHtml);
  });
}

async function completeCashPayment(context) {
  const receiptNo = generateReceiptNumber();
  const paymentRef = doc(collection(db, "payments"));
  const method = "cash";
  const methodLabel = getPaymentMethodLabel(method);
  let resolvedPaymentTableId = context.tableId;

  await runTransaction(db, async (tx) => {
    const orderRef = doc(db, "orders", context.orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Order not found.");
    }

    const orderData = orderSnap.data() || {};
    if (isClosedOrderRecord(orderData)) {
      throw new Error(t('Order already paid'));
    }

    const resolvedTableId = normalizeOrderId(orderData.tableId) || normalizeOrderId(context.tableId);
    resolvedPaymentTableId = resolvedTableId;
    const resolvedTableRef = doc(db, "tables", resolvedTableId);
    const resolvedTableSnap = await tx.get(resolvedTableRef);
    const resolvedTableData = resolvedTableSnap.exists() ? (resolvedTableSnap.data() || {}) : {};
    const nowTs = serverTimestamp();
    const remainingActiveOrders = await getRemainingActiveOrdersForTableTx(
      tx,
      resolvedTableId,
      resolvedTableData,
      context.orderId
    );

    tx.set(paymentRef, {
      orderId: context.orderId,
      tableId: resolvedTableId,
      waiterId: meUid,
      provider: "cash",
      method,
      paymentMethod: method,
      methodLabel,
      status: "paid",
      paymentStatus: "paid",
      amount: context.baseAmount,
      tipAmount: context.tipAmount,
      totalAmount: context.finalTotal,
      currency: "EUR",
      receiptNo,
      isOffline: true,
      source: "waiter_dashboard",
      confirmedBy: meUid,
      confirmedAt: nowTs,
      paidAt: nowTs,
      createdAt: nowTs,
      updatedAt: nowTs
    });

    tx.set(orderRef, {
      orderId: normalizeOrderId(orderData.orderId) || context.orderId,
      tableId: resolvedTableId,
      status: "paid",
      paymentStatus: "paid",
      paymentMethod: method,
      paidAt: nowTs,
      paymentPending: false,
      pendingPaymentId: null,
      pendingPaymentMethod: null,
      payment: {
        paymentId: paymentRef.id,
        provider: "cash",
        method,
        methodLabel,
        status: "paid",
        amount: context.baseAmount,
        tipAmount: context.tipAmount,
        totalAmount: context.finalTotal,
        currency: "EUR",
        receiptNo
      },
      orderStatus: "closed",
      closedAt: nowTs,
      updatedAt: nowTs
    }, { merge: true });

    tx.set(resolvedTableRef, {
      activeOrders: remainingActiveOrders,
      currentOrderId: remainingActiveOrders.length ? remainingActiveOrders[0] : null,
      status: remainingActiveOrders.length ? "busy" : "free",
      updatedAt: nowTs
    }, { merge: true });
  });

  try {
    await addDoc(collection(db, "logs"), {
      actorUid: meUid || null,
      actorEmail: auth.currentUser?.email || meEmp?.email || null,
      type: "PAYMENT",
      message: `Payment completed: ${methodLabel} • ${context.finalTotal.toFixed(2)} EUR`,
      meta: {
        orderId: context.orderId,
        tableId: resolvedPaymentTableId,
        paymentId: paymentRef.id,
        method,
        provider: "cash",
        amount: context.baseAmount,
        tipAmount: context.tipAmount,
        totalAmount: context.finalTotal,
        receiptNo
      },
      createdAt: serverTimestamp()
    });
  } catch (logErr) {
    console.warn("Payment log failed:", logErr);
  }

  showPaidReceiptFromContext(context, {
    method,
    amount: context.baseAmount,
    tipAmount: context.tipAmount,
    totalAmount: context.finalTotal,
    receiptNo
  }, method);
  resetPaidOrderUi();
}

async function checkOnlinePaymentStatus(endpoint, paymentId, context, method) {
  const statusData = await apiPost(endpoint, { paymentId });
  const status = String(statusData.status || statusData.payment?.status || "").toLowerCase();
  if (status === "paid" || status === "succeeded") {
    await handlePaidOnlinePayment(statusData, context, method);
    return true;
  }
  if (status === "failed" || status === "cancelled" || status === "canceled") {
    setPaymentMessage(onlinePaymentStatus, t('Payment failed'), "err");
    return false;
  }
  setPaymentMessage(onlinePaymentStatus, t('Payment pending'), "");
  return false;
}

async function startStripeCardPayment(context) {
  await ensurePaymentBackendActive();
  resetOnlinePaymentSections();
  renderOnlinePaymentSummary(context, "card");
  openOnlinePaymentModal();
  setPaymentMessage(onlinePaymentStatus, t('Payment pending'));

  const data = await apiPost("/api/payments/stripe/create-intent", {
    orderId: context.orderId,
    tableId: context.tableId,
    tipAmount: context.tipAmount
  });

  if (!window.Stripe) throw new Error("Stripe.js is not loaded.");
  if (!data.publishableKey) throw new Error(t('Stripe publishable key missing'));
  if (!data.clientSecret) throw new Error(t('Payment API not configured'));

  activeOnlinePayment = {
    paymentId: data.paymentId,
    method: "card",
    context
  };

  stripePaymentSection.hidden = false;
  stripeInstance = window.Stripe(data.publishableKey);
  stripeElements = stripeInstance.elements({ clientSecret: data.clientSecret });
  stripePaymentElementInstance = stripeElements.create("payment");
  stripePaymentElementInstance.mount("#stripePaymentElement");

  confirmStripePaymentBtn.disabled = false;
  confirmStripePaymentBtn.onclick = async () => {
    confirmStripePaymentBtn.disabled = true;
    setPaymentMessage(stripePaymentMessage, "");
    setPaymentMessage(onlinePaymentStatus, t('Payment pending'));

    try {
      const result = await stripeInstance.confirmPayment({
        elements: stripeElements,
        confirmParams: {},
        redirect: "if_required"
      });

      if (result.error) {
        setPaymentMessage(stripePaymentMessage, result.error.message || t('Payment declined'), "err");
        return;
      }

      const paid = await checkOnlinePaymentStatus(
        "/api/payments/stripe/check-status",
        data.paymentId,
        context,
        "card"
      );
      if (paid) setPaymentMessage(stripePaymentMessage, t('Payment successful'), "ok");
    } catch (err) {
      console.error(err);
      setPaymentMessage(stripePaymentMessage, err.message || t('Payment failed'), "err");
    } finally {
      confirmStripePaymentBtn.disabled = false;
    }
  };
}

async function startRevolutPayment(context) {
  await ensurePaymentBackendActive();
  resetOnlinePaymentSections();
  renderOnlinePaymentSummary(context, "revolut");
  openOnlinePaymentModal();
  setPaymentMessage(onlinePaymentStatus, t('Payment pending'));

  const data = await apiPost("/api/payments/revolut/create-order", {
    orderId: context.orderId,
    tableId: context.tableId,
    tipAmount: context.tipAmount
  });

  if (!data.checkoutUrl) throw new Error(t('Revolut checkout link missing'));

  activeOnlinePayment = {
    paymentId: data.paymentId,
    method: "revolut",
    context
  };

  revolutPaymentSection.hidden = false;
  revolutPaymentText.textContent = t('Payment pending');
  revolutCheckoutLink.href = data.checkoutUrl;
  checkRevolutStatusBtn.disabled = false;
  checkRevolutStatusBtn.onclick = async () => {
    checkRevolutStatusBtn.disabled = true;
    try {
      await checkOnlinePaymentStatus(
        "/api/payments/revolut/check-status",
        data.paymentId,
        context,
        "revolut"
      );
    } catch (err) {
      console.error(err);
      setPaymentMessage(onlinePaymentStatus, err.message || t('Payment failed'), "err");
    } finally {
      checkRevolutStatusBtn.disabled = false;
    }
  };
}

async function startBankTransferPayment(context) {
  await ensurePaymentBackendActive();
  resetOnlinePaymentSections();
  renderOnlinePaymentSummary(context, "bank_transfer");
  openOnlinePaymentModal();
  setPaymentMessage(onlinePaymentStatus, t('Payment pending'));

  const data = await apiPost("/api/payments/bank-transfer/create", {
    orderId: context.orderId,
    tableId: context.tableId,
    tipAmount: context.tipAmount
  });

  activeOnlinePayment = {
    paymentId: data.paymentId,
    method: "bank_transfer",
    context
  };

  bankTransferSection.hidden = false;
  renderBankTransferInstructions(data);

  if (String(data.status || "").toLowerCase() === "paid") {
    await handlePaidOnlinePayment(data, context, "bank_transfer");
    return;
  }

  checkBankTransferStatusBtn.disabled = false;
  checkBankTransferStatusBtn.onclick = async () => {
    checkBankTransferStatusBtn.disabled = true;
    try {
      await checkOnlinePaymentStatus(
        "/api/payments/check",
        data.paymentId,
        context,
        "bank_transfer"
      );
    } catch (err) {
      console.error(err);
      setPaymentMessage(onlinePaymentStatus, err.message || t('Payment failed'), "err");
    } finally {
      checkBankTransferStatusBtn.disabled = false;
    }
  };
}

/* ======================= COMPLETE PAYMENT ======================= */
completePaymentBtn.addEventListener("click", async () => {
  if (completePaymentBtn.disabled) return;
  completePaymentBtn.disabled = true;

  try {
    const context = buildPaymentContext();
    const method = normalizePaymentMethod(payMethod);

    if (method === "cash") {
      await completeCashPayment(context);
      return;
    }

    if (["card", "revolut", "bank_transfer"].includes(method)) {
      goToPaymentPage(method, context);
      return;
    }
  } catch (err) {
    console.error(err);
    alert(err.message || t('Payment failed'));
  } finally {
    completePaymentBtn.disabled = false;
  }
});

/* ======================= PAYMENTS HISTORY ======================= */
function listenPaymentsHistory() {
  if (unsubPayments) unsubPayments();

  const qPay = query(
    collection(db, "payments"),
    where("waiterId", "==", meUid),
    orderBy("createdAt", "desc"),
    limit(30)
  );

  unsubPayments = onSnapshot(qPay, (snap) => {
    checksList.innerHTML = "";

    if (snap.empty) {
      checksList.innerHTML = `<div class="muted">${t('No payments yet.')}</div>`;
      return;
    }

    snap.forEach((d) => {
      const p = d.data();
      const methodKey = p.paymentMethod || p.method;
      const methodLabel = p.methodLabel || (methodKey ? getPaymentMethodLabel(methodKey) : "—");
      const rawStatus = String(p.status || p.paymentStatus || "").toLowerCase();
      const statusLabel = rawStatus === "paid"
        ? t('Payment successful')
        : rawStatus === "confirmed"
          ? t('Confirmed')
        : rawStatus === "pending"
          ? t('Payment pending')
          : rawStatus === "failed" || rawStatus === "cancelled"
            ? t('Payment failed')
            : (p.status || p.paymentStatus || "—");
      const total = Number.isFinite(Number(p.totalAmount))
        ? Number(p.totalAmount)
        : (Number(p.amount) || 0) + (Number(p.tipAmount) || 0);
      const reference = p.receiptNo || p.bankTransferReference || p.stripePaymentIntentId || p.revolutOrderId || "";
      const failureText = p.failureMessage || p.providerFailureMessage || "";

      const row = document.createElement("div");
      row.style.padding = "10px";
      row.style.border = "1px solid rgba(0,0,0,0.06)";
      row.style.borderRadius = "12px";
      row.style.marginBottom = "8px";

      row.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <strong>${euro(total)}</strong>
          <span class="payment-method-badge">${escapeReceiptText(methodLabel)}</span>
        </div>
        <div class="muted" style="font-size:12px; margin-top:4px;">
          Table: ${escapeReceiptText(p.tableId || "-")} Order: ${escapeReceiptText(String(p.orderId || "").slice(0, 6))}
          ${p.provider ? ` · ${t('Provider')}: ${escapeReceiptText(p.provider)}` : ""}
        </div>
        <div class="muted" style="font-size:12px; margin-top:4px;">
          <span class="payment-status-badge ${escapeReceiptText(getStatusClass(rawStatus))}">${escapeReceiptText(statusLabel)}</span>
          ${reference ? ` · ${t('Payment Reference')}: ${escapeReceiptText(reference)}` : ""}
        </div>
        <div class="muted" style="font-size:12px; margin-top:4px; ${failureText ? "" : "display:none;"}">
          ${escapeReceiptText(failureText)}
        </div>
      `;

      checksList.appendChild(row);
    });
  }, (err) => {
    console.error(err);
    checksList.innerHTML = `<div class="muted">Payments error: ${err.message}</div>`;
  });
}

/* ======================= STATS ======================= */
function listenStats() {
  if (unsubStats) unsubStats();

  const start = new Date(ensureShiftStart());

  const qPay = query(
    collection(db, "payments"),
    where("waiterId", "==", meUid),
    where("createdAt", ">=", start),
    orderBy("createdAt", "desc")
  );

  unsubStats = onSnapshot(qPay, (snap) => {
    let sales = 0, tips = 0, count = 0;

    snap.forEach((d) => {
      const p = d.data();
      const status = normalizeOrderState(p.status || p.paymentStatus);
      if (status && !["paid", "confirmed"].includes(status)) return;
      const t = Number(p.tipAmount) || 0;
      tips += t;
      sales += (Number(p.amount) || 0) + t;
      count += 1;
    });

    statSales.textContent = euro(sales);
    statAvg.textContent = euro(count ? sales / count : 0);
    statTips.textContent = euro(tips);
    statTables.textContent = String(count);
  }, (err) => {
    console.error(err);
    statSales.textContent = "”";
    statAvg.textContent = "”";
    statTips.textContent = "”";
    statTables.textContent = "”";
  });
}
/* ======================= PRINT ORDERS ======================= */
/* ======================= PRINT ORDERS (NO INDEX) ======================= */


/* ======================= PRINT ORDERS (WINDOWS PRINT DIALOG) ======================= */



if (btnPrintOrders) {
  btnPrintOrders.addEventListener("click", async () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return alert(" Print.");

    // РџРёС€РµРј template
    w.document.open();
    w.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Print Orders</title>
        <style>
          body{font-family:Arial,sans-serif;padding:18px;}
          h2{margin:0 0 6px;}
          .muted{color:#666;font-size:12px;margin-bottom:12px;}
          .card{border:1px solid #ddd;border-radius:12px;padding:12px;margin:10px 0; page-break-inside: avoid;}
          .row{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;}
          .badge{font-size:12px;padding:4px 10px;border:1px solid #ccc;border-radius:999px;}
          table{width:100%;border-collapse:collapse;margin-top:8px;}
          td{padding:6px 0;border-bottom:1px solid #eee;}
          .r{text-align:right;}
          .total{font-weight:700;}
          @media print { button { display:none; } }
        </style>
      </head>
      <body>
        <h2>Active Orders</h2>
        <div class="muted">${new Date().toLocaleString()}</div>
        <div id="root" class="muted">Loading...</div>
      </body>
      </html>
    `);
    w.document.close();

    try {
      // вќ— Р‘РµР· index: СЃР°РјРѕ orderBy createdAt
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
      const snap = await getDocs(q);

      const root = w.document.getElementById("root");
      root.innerHTML = "";

      let printedCount = 0;

      snap.forEach((d) => {
        const o = d.data() || {};
        if (o.status === "paid") return;

        const items = Array.isArray(o.items) ? o.items : [];
        let total = 0;
        for (const it of items) {
          total += (Number(it.price) || 0) * (Number(it.qty) || 0);
        }

        const card = w.document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="row">
            <div>
              <div><strong>Order:</strong> ${d.id}</div>
              <div><strong>Table:</strong> ${o.tableId || "Delivery"}</div>
              <div style="margin-top:4px;" class="badge">${String(o.status || "eur").toUpperCase()}</div>
            </div>
            <div class="total">${(typeof euro === "function") ? euro(total) : (total.toFixed(2)+" €")}</div>
          </div>

          <table>
            ${
              items.length
                ? items.map(it => `
                  <tr>
                    <td>${it.itemId || it.name || "Item"} x ${Number(it.qty)||0}</td>
                    <td class="r">${(typeof euro === "function") ? euro((Number(it.price)||0) * (Number(it.qty)||0)) : (((Number(it.price)||0)*(Number(it.qty)||0)).toFixed(2)+" €")}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="2" class="muted">Empty</td></tr>`
            }
            <tr>
              <td class="total">TOTAL</td>
              <td class="total r">${(typeof euro === "function") ? euro(total) : (total.toFixed(2)+" €")}</td>
            </tr>
          </table>
        `;
        root.appendChild(card);
        printedCount++;
      });

      if (printedCount === 0) {
        root.innerHTML = `<div class="muted">Няма активни поръчки.</div>`;
      }

      // вњ… РўРѕРІР° РѕС‚РІР°СЂСЏ Windows print РґРёР°Р»РѕРіР°
      setTimeout(() => {
        w.focus();
        w.print();      // <--  print:
        // setTimeout(() => w.close(), 300);
      }, 400);

    } catch (err) {
      const root = w.document.getElementById("root");
      root.className = "muted";
      root.textContent = "Print error: " + err.message;
    }
  });
}
/* ======================= END ======================= */

/* ======================= UNUSED FROM OLD ======================= */
let unsubItems = null;
