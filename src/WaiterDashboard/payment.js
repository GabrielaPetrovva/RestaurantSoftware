import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

if (!window.firebaseConfig) {
  throw new Error("Missing window.firebaseConfig");
}

const app = initializeApp(window.firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const qs = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const currentLang = localStorage.getItem("waiterDashboardLang") || "en";
const PAYMENT_API_BASE_URL = String(window.PAYMENT_API_BASE_URL || "").replace(/\/$/, "");
const isClientMode = params.get("client") === "1";
const autoStartCheckout = params.get("autoStart") === "1";

function apiUrl(path) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return PAYMENT_API_BASE_URL ? `${PAYMENT_API_BASE_URL}${cleanPath}` : cleanPath;
}

function paymentApiPath(path) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  if (!isClientMode) return cleanPath;
  if (cleanPath === "/api/payments/stripe/create-checkout-session") {
    return "/api/public/payments/stripe/create-checkout-session";
  }
  if (cleanPath === "/api/payments/check") {
    return "/api/public/payments/check";
  }
  return cleanPath;
}

const text = {
  en: {
    Payment: "Payment",
    "Secure payment page": "Secure payment page",
    Back: "Back",
    Amount: "Amount",
    Tip: "Tip",
    Total: "Total",
    Method: "Method",
    Table: "Table",
    Order: "Order",
    Card: "Card",
    Revolut: "Revolut",
    "Bank Transfer": "Bank Transfer",
    "Card Payment": "Card Payment",
    "Revolut Payment": "Revolut Payment",
    "Bank Transfer Payment": "Bank Transfer",
    "You will be redirected to secure Stripe Checkout.": "You will be redirected to secure Stripe Checkout.",
    "You will be redirected to Revolut Checkout.": "You will be redirected to Revolut Checkout.",
    "Generate a reference and make the transfer from your bank app.": "Generate a reference and make the transfer from your bank app.",
    "Continue to card payment": "Continue to card payment",
    "Continue to Revolut": "Continue to Revolut",
    "Generate bank transfer reference": "Generate bank transfer reference",
    "Check payment status": "Check payment status",
    "Check transfer status": "Check transfer status",
    "Payment pending": "Payment pending",
    "Payment successful": "Payment successful",
    "Payment failed": "Payment failed",
    "Payment server is not available.": "Payment server is not available.",
    "Not signed in.": "Not signed in.",
    "Order not found.": "Order not found.",
    "Missing payment details.": "Missing payment details.",
    "Stripe checkout URL missing.": "Stripe checkout URL missing.",
    "Revolut checkout link missing.": "Revolut checkout link missing.",
    "Bank transfer instructions": "Bank transfer instructions",
    Beneficiary: "Beneficiary",
    IBAN: "IBAN",
    Reference: "Reference",
    Status: "Status",
    Pending: "Pending"
  },
  bg: {
    Payment: "Плащане",
    "Secure payment page": "Сигурна страница за плащане",
    Back: "Назад",
    Amount: "Сума",
    Tip: "Бакшиш",
    Total: "Общо",
    Method: "Метод",
    Table: "Маса",
    Order: "Поръчка",
    Card: "Карта",
    Revolut: "Револют",
    "Bank Transfer": "Банков превод",
    "Card Payment": "Плащане с карта",
    "Revolut Payment": "Плащане с Revolut",
    "Bank Transfer Payment": "Банков превод",
    "You will be redirected to secure Stripe Checkout.": "Ще бъдете пренасочени към защитена Stripe страница.",
    "You will be redirected to Revolut Checkout.": "Ще бъдете пренасочени към Revolut Checkout.",
    "Generate a reference and make the transfer from your bank app.": "Генерирай референция и плати през банковото приложение.",
    "Continue to card payment": "Продължи към плащане с карта",
    "Continue to Revolut": "Продължи към Revolut",
    "Generate bank transfer reference": "Генерирай референция",
    "Check payment status": "Провери статус",
    "Check transfer status": "Провери превода",
    "Payment pending": "Плащането чака потвърждение",
    "Payment successful": "Плащането е успешно",
    "Payment failed": "Плащането е неуспешно",
    "Payment server is not available.": "Payment server is not available.",
    "Not signed in.": "Не сте влезли в профил.",
    "Order not found.": "Поръчката не е намерена.",
    "Missing payment details.": "Липсват данни за плащане.",
    "Stripe checkout URL missing.": "Липсва Stripe checkout URL.",
    "Revolut checkout link missing.": "Липсва Revolut checkout линк.",
    "Bank transfer instructions": "Инструкции за банков превод",
    Beneficiary: "Получател",
    IBAN: "IBAN",
    Reference: "Референция",
    Status: "Статус",
    Pending: "Pending"
  }
};

const methodConfig = {
  card: {
    labelKey: "Card",
    titleKey: "Card Payment",
    subtitleKey: "You will be redirected to secure Stripe Checkout.",
    sectionId: "cardSection"
  },
  revolut: {
    labelKey: "Revolut",
    titleKey: "Revolut Payment",
    subtitleKey: "You will be redirected to Revolut Checkout.",
    sectionId: "revolutSection"
  },
  bank_transfer: {
    labelKey: "Bank Transfer",
    titleKey: "Bank Transfer Payment",
    subtitleKey: "Generate a reference and make the transfer from your bank app.",
    sectionId: "bankTransferSection"
  }
};

const backToDashboardBtn = qs("backToDashboard");
const paymentTitle = qs("paymentTitle");
const paymentSubtitle = qs("paymentSubtitle");
const paymentSummary = qs("paymentSummary");
const cardSection = qs("cardSection");
const revolutSection = qs("revolutSection");
const bankTransferSection = qs("bankTransferSection");
const cardPaymentText = qs("cardPaymentText");
const revolutPaymentText = qs("revolutPaymentText");
const bankTransferText = qs("bankTransferText");
const startCardCheckoutBtn = qs("startCardCheckout");
const startRevolutCheckoutBtn = qs("startRevolutCheckout");
const revolutCheckoutLink = qs("revolutCheckoutLink");
const createBankTransferBtn = qs("createBankTransfer");
const checkBankStatusBtn = qs("checkBankStatus");
const checkPaymentStatusBtn = qs("checkPaymentStatus");
const bankInstructions = qs("bankInstructions");
const paymentStatus = qs("paymentStatus");

let method = normalizePaymentMethod(params.get("method"));
let orderId = String(params.get("orderId") || "").trim();
let tableId = String(params.get("tableId") || "").trim();
let tipAmount = parseAmount(params.get("tip") || "0");
let activePaymentId = String(params.get("paymentId") || "").trim();
let orderData = null;
let amount = 0;
let totalAmount = 0;
let autoStartAttempted = false;

document.documentElement.lang = currentLang === "bg" ? "bg" : "en";

function t(key) {
  return text[currentLang]?.[key] || text.en[key] || key;
}

function normalizePaymentMethod(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return methodConfig[normalized] ? normalized : "";
}

function parseAmount(value) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function money(value) {
  return `${(Number(value) || 0).toFixed(2)} EUR`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function safeReturnUrl() {
  const requested = params.get("returnTo") || "./index.html";
  try {
    const url = new URL(requested, window.location.href);
    return url.origin === window.location.origin ? url.href : "./index.html";
  } catch {
    return "./index.html";
  }
}

function setStatus(message, type = "") {
  if (!paymentStatus) return;
  paymentStatus.textContent = message || "";
  paymentStatus.classList.remove("ok", "err", "pending");
  if (type) paymentStatus.classList.add(type);
}

function setButtonsDisabled(disabled) {
  [
    startCardCheckoutBtn,
    startRevolutCheckoutBtn,
    createBankTransferBtn,
    checkBankStatusBtn,
    checkPaymentStatusBtn
  ].forEach((button) => {
    if (button) button.disabled = disabled;
  });
}

function calculateOrderAmount(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const result = items.reduce((sum, item) => {
    const qty = Math.max(0, Number(item?.qty ?? item?.quantity ?? 0) || 0);
    const price = Number(item?.price || 0) || 0;
    return sum + qty * price;
  }, 0);
  return Math.round(result * 100) / 100;
}

function waitForAuthUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

async function getAuthToken() {
  if (isClientMode) return "";
  const user = auth.currentUser;
  if (!user) {
    throw new Error(t("Not signed in."));
  }
  return user.getIdToken();
}

async function apiPost(path, body) {
  const token = await getAuthToken();
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  const requestPath = paymentApiPath(cleanPath);
  const headers = {
    "Content-Type": "application/json"
  };
  const payload = { ...(body || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (isClientMode) payload.client = true;

  const res = await fetch(apiUrl(requestPath), {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const textBody = await res.text();
  let data = {};
  try {
    data = textBody ? JSON.parse(textBody) : {};
  } catch {
    data = { raw: textBody };
  }

  if (!res.ok) {
    if (res.status === 404 || res.status === 405) {
      throw new Error(t("Payment server is not available."));
    }
    throw new Error(data.error || data.message || `API error ${res.status}`);
  }

  return data;
}

async function checkApiHealth() {
  try {
    const res = await fetch(apiUrl("/api/health"));
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

async function ensurePaymentServer() {
  const ok = await checkApiHealth();
  if (!ok) throw new Error(t("Payment server is not available."));
}

function buildResultUrl(fileName, provider) {
  const url = new URL(`./${fileName}`, window.location.href);
  url.searchParams.set("provider", provider);
  url.searchParams.set("orderId", orderId);
  if (tableId) url.searchParams.set("tableId", tableId);
  if (tipAmount) url.searchParams.set("tip", String(tipAmount));
  if (isClientMode) url.searchParams.set("client", "1");
  const returnTo = params.get("returnTo");
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  if (activePaymentId) url.searchParams.set("paymentId", activePaymentId);
  return url.toString();
}

function renderSummary() {
  const config = methodConfig[method];
  totalAmount = Math.round((amount + tipAmount) * 100) / 100;

  paymentTitle.textContent = t(config.titleKey);
  paymentSubtitle.textContent = t(config.subtitleKey);
  if (cardPaymentText) cardPaymentText.textContent = t("You will be redirected to secure Stripe Checkout.");
  if (revolutPaymentText) revolutPaymentText.textContent = t("You will be redirected to Revolut Checkout.");
  if (bankTransferText) bankTransferText.textContent = t("Generate a reference and make the transfer from your bank app.");
  if (startCardCheckoutBtn) startCardCheckoutBtn.textContent = t("Continue to card payment");
  if (startRevolutCheckoutBtn) startRevolutCheckoutBtn.textContent = t("Continue to Revolut");
  if (createBankTransferBtn) createBankTransferBtn.textContent = t("Generate bank transfer reference");
  if (checkBankStatusBtn) checkBankStatusBtn.textContent = t("Check transfer status");
  if (checkPaymentStatusBtn) checkPaymentStatusBtn.textContent = t("Check payment status");
  if (backToDashboardBtn) backToDashboardBtn.innerHTML = `&larr; ${escapeHtml(t("Back"))}`;

  paymentSummary.innerHTML = `
    <div class="payment-summary-row"><span>${escapeHtml(t("Order"))}</span><strong>${escapeHtml(orderId.slice(0, 10))}</strong></div>
    <div class="payment-summary-row"><span>${escapeHtml(t("Table"))}</span><strong>${escapeHtml(tableId || "-")}</strong></div>
    <div class="payment-summary-row"><span>${escapeHtml(t("Method"))}</span><strong>${escapeHtml(t(config.labelKey))}</strong></div>
    <div class="payment-summary-row"><span>${escapeHtml(t("Amount"))}</span><strong>${escapeHtml(money(amount))}</strong></div>
    <div class="payment-summary-row"><span>${escapeHtml(t("Tip"))}</span><strong>${escapeHtml(money(tipAmount))}</strong></div>
    <div class="payment-summary-row payment-summary-total"><span>${escapeHtml(t("Total"))}</span><strong>${escapeHtml(money(totalAmount))}</strong></div>
  `;
}

function showMethodSection() {
  [cardSection, revolutSection, bankTransferSection].forEach((section) => {
    if (section) section.hidden = true;
  });

  const section = qs(methodConfig[method].sectionId);
  if (section) section.hidden = false;

  if (method !== "bank_transfer" && bankInstructions) {
    bankInstructions.innerHTML = "";
  }
}

function renderBankInstructions(data) {
  const instructions = data?.bankTransferInstructions || {};
  const reference = data?.bankTransferReference || instructions.reference || "-";
  const iban = data?.bankIban || instructions.iban || "-";
  const beneficiary = data?.beneficiary || instructions.beneficiary || "-";
  const paymentTotal = Number(data?.totalAmount || instructions.amount || totalAmount) || 0;

  bankInstructions.innerHTML = `
    <div class="bank-transfer-title">${escapeHtml(t("Bank transfer instructions"))}</div>
    <div><strong>${escapeHtml(t("Beneficiary"))}:</strong> ${escapeHtml(beneficiary)}</div>
    <div><strong>${escapeHtml(t("IBAN"))}:</strong> ${escapeHtml(iban)}</div>
    <div><strong>${escapeHtml(t("Amount"))}:</strong> ${escapeHtml(money(paymentTotal))}</div>
    <div><strong>${escapeHtml(t("Reference"))}:</strong> ${escapeHtml(reference)}</div>
    <div><strong>${escapeHtml(t("Status"))}:</strong> ${escapeHtml(t("Pending"))}</div>
  `;
}

async function startCardCheckout() {
  setButtonsDisabled(true);
  setStatus(t("Payment pending"), "pending");
  try {
    await ensurePaymentServer();
    const data = await apiPost("/api/payments/stripe/create-checkout-session", {
      orderId,
      tableId,
      tipAmount,
      successUrl: buildResultUrl("payment-success.html", "stripe"),
      cancelUrl: buildResultUrl("payment-cancel.html", "stripe")
    });

    if (!data.checkoutUrl) throw new Error(t("Stripe checkout URL missing."));
    activePaymentId = data.paymentId || activePaymentId;
    window.location.href = data.checkoutUrl;
  } catch (err) {
    setStatus(err.message || t("Payment failed"), "err");
    setButtonsDisabled(false);
  }
}

async function startRevolutCheckout() {
  setButtonsDisabled(true);
  setStatus(t("Payment pending"), "pending");
  try {
    await ensurePaymentServer();
    const data = await apiPost("/api/payments/revolut/create-order", {
      orderId,
      tableId,
      tipAmount,
      successUrl: buildResultUrl("payment-success.html", "revolut"),
      cancelUrl: buildResultUrl("payment-cancel.html", "revolut")
    });

    if (!data.checkoutUrl) throw new Error(t("Revolut checkout link missing."));
    activePaymentId = data.paymentId || activePaymentId;
    if (revolutCheckoutLink) {
      revolutCheckoutLink.href = data.checkoutUrl;
      revolutCheckoutLink.hidden = false;
    }
    window.location.href = data.checkoutUrl;
  } catch (err) {
    setStatus(err.message || t("Payment failed"), "err");
    setButtonsDisabled(false);
  }
}

async function createBankTransfer() {
  setButtonsDisabled(true);
  setStatus(t("Payment pending"), "pending");
  try {
    await ensurePaymentServer();
    const data = await apiPost("/api/payments/bank-transfer/create", {
      orderId,
      tableId,
      tipAmount
    });
    activePaymentId = data.paymentId || activePaymentId;
    renderBankInstructions(data);
    setStatus(t("Payment pending"), "pending");
  } catch (err) {
    setStatus(err.message || t("Payment failed"), "err");
  } finally {
    setButtonsDisabled(false);
  }
}

async function checkPaymentStatus() {
  setButtonsDisabled(true);
  try {
    await ensurePaymentServer();
    const data = await apiPost("/api/payments/check", activePaymentId ? { paymentId: activePaymentId } : { orderId });
    activePaymentId = data.paymentId || data.payment?.paymentId || activePaymentId;
    const status = String(data.status || data.paymentStatus || data.payment?.status || "").toLowerCase();
    if (status === "paid" || status === "succeeded") {
      setStatus(t("Payment successful"), "ok");
    } else if (status === "failed" || status === "cancelled" || status === "canceled") {
      setStatus(t("Payment failed"), "err");
    } else {
      setStatus(t("Payment pending"), "pending");
    }
  } catch (err) {
    setStatus(err.message || t("Payment failed"), "err");
  } finally {
    setButtonsDisabled(false);
  }
}

async function init() {
  try {
    if (!method || !orderId) throw new Error(t("Missing payment details."));
    const user = await waitForAuthUser();
    if (!user && !isClientMode) throw new Error(t("Not signed in."));

    try {
      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) throw new Error(t("Order not found."));
      orderData = orderSnap.data() || {};
      tableId = tableId || String(orderData.tableId || "").trim();
      amount = calculateOrderAmount(orderData);
    } catch (err) {
      if (!isClientMode) throw err;
      const fallbackTotal = parseAmount(params.get("total") || "0");
      const fallbackAmount = parseAmount(params.get("amount") || "0");
      amount = fallbackAmount || Math.max(0, fallbackTotal - tipAmount);
    }

    renderSummary();
    showMethodSection();

    const healthy = await checkApiHealth();
    if (!healthy) {
      setStatus(t("Payment server is not available."), "err");
      setButtonsDisabled(true);
      return;
    }
    setButtonsDisabled(false);
    setStatus("");
    if (isClientMode && autoStartCheckout && method === "card" && !autoStartAttempted) {
      autoStartAttempted = true;
      window.setTimeout(startCardCheckout, 250);
    }
  } catch (err) {
    setStatus(err.message || t("Payment failed"), "err");
    setButtonsDisabled(true);
  }
}

backToDashboardBtn?.addEventListener("click", () => {
  window.location.href = safeReturnUrl();
});
startCardCheckoutBtn?.addEventListener("click", startCardCheckout);
startRevolutCheckoutBtn?.addEventListener("click", startRevolutCheckout);
createBankTransferBtn?.addEventListener("click", createBankTransfer);
checkBankStatusBtn?.addEventListener("click", checkPaymentStatus);
checkPaymentStatusBtn?.addEventListener("click", checkPaymentStatus);

init();
