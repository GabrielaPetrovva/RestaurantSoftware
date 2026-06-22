import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

if (!window.firebaseConfig) {
  throw new Error("Missing window.firebaseConfig");
}

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const qs = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const currentLang = localStorage.getItem("waiterDashboardLang") || "en";
const pageType = document.body.dataset.resultPage || "success";
const PAYMENT_API_BASE_URL = String(window.PAYMENT_API_BASE_URL || "").replace(/\/$/, "");
const isClientMode = params.get("client") === "1";

function apiUrl(path) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return PAYMENT_API_BASE_URL ? `${PAYMENT_API_BASE_URL}${cleanPath}` : cleanPath;
}

function paymentApiPath(path) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  if (!isClientMode) return cleanPath;
  if (cleanPath === "/api/payments/check") {
    return "/api/public/payments/check";
  }
  return cleanPath;
}

const text = {
  en: {
    "Payment successful": "Payment successful",
    "Payment cancelled": "Payment cancelled",
    "Payment failed": "Payment failed",
    "Payment pending": "Payment is being confirmed",
    "Order is still open.": "Order is still open.",
    "Back to dashboard": "Back to dashboard",
    "Check again": "Check again",
    "Check payment status": "Check payment status",
    "Print receipt": "Print receipt",
    "Payment server is not available.": "Payment server is not available.",
    "Not signed in.": "Not signed in.",
    "Missing payment details.": "Missing payment details.",
    "Confirmed by payment provider.": "Confirmed by payment provider.",
    "No paid confirmation yet.": "No paid confirmation yet."
  },
  bg: {
    "Payment successful": "Плащането е успешно",
    "Payment cancelled": "Плащането е отказано",
    "Payment failed": "Плащането е неуспешно",
    "Payment pending": "Плащането се потвърждава",
    "Order is still open.": "Поръчката остава отворена.",
    "Back to dashboard": "Назад към таблото",
    "Check again": "Провери отново",
    "Check payment status": "Провери статус",
    "Print receipt": "Принтирай бележка",
    "Payment server is not available.": "Payment server is not available.",
    "Not signed in.": "Не сте влезли в профил.",
    "Missing payment details.": "Липсват данни за плащане.",
    "Confirmed by payment provider.": "Потвърдено от payment provider.",
    "No paid confirmation yet.": "Още няма paid потвърждение."
  }
};

const resultTitle = qs("resultTitle");
const resultSubtitle = qs("resultSubtitle");
const resultStatus = qs("resultStatus");
const checkAgainBtn = qs("checkAgain");
const backToDashboardBtn = qs("backToDashboard");
const printReceiptBtn = qs("printReceipt");
const receiptMount = qs("receiptMount");

const provider = String(params.get("provider") || "").trim();
const orderId = String(params.get("orderId") || "").trim();
const tableId = String(params.get("tableId") || "").trim();
const stripeSessionId = String(params.get("session_id") || params.get("sessionId") || "").trim();
let paymentId = String(params.get("paymentId") || "").trim();

document.documentElement.lang = currentLang === "bg" ? "bg" : "en";

function t(key) {
  return text[currentLang]?.[key] || text.en[key] || key;
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

function setResult(title, subtitle, message, type = "") {
  if (resultTitle) resultTitle.textContent = title;
  if (resultSubtitle) resultSubtitle.textContent = subtitle;
  if (resultStatus) {
    resultStatus.textContent = message || "";
    resultStatus.classList.remove("ok", "err", "pending");
    if (type) resultStatus.classList.add(type);
  }
}

function setBusy(isBusy) {
  if (checkAgainBtn) checkAgainBtn.disabled = isBusy;
  if (backToDashboardBtn) backToDashboardBtn.disabled = isBusy;
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

function money(value, currency = "EUR") {
  return `${(Number(value) || 0).toFixed(2)} ${String(currency || "EUR").toUpperCase()}`;
}

function formatReceiptDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function itemName(item) {
  return String(item?.name || item?.title || item?.label || item?.itemName || "Item");
}

function itemQty(item) {
  return Math.max(0, Number(item?.qty ?? item?.quantity ?? 0) || 0);
}

function itemPrice(item) {
  return Number(item?.price || item?.unitPrice || 0) || 0;
}

function calculateSubtotal(items) {
  return Math.round(items.reduce((sum, item) => sum + itemQty(item) * itemPrice(item), 0) * 100) / 100;
}

async function loadOrderForReceipt(resolvedOrderId) {
  if (!resolvedOrderId) return null;
  try {
    const snap = await getDoc(doc(db, "orders", resolvedOrderId));
    return snap.exists() ? (snap.data() || {}) : null;
  } catch (err) {
    console.warn("Could not load order for receipt:", err);
    return null;
  }
}

function renderElectronicReceipt(checkData, orderData) {
  if (!receiptMount) return;
  const payment = checkData?.payment || checkData || {};
  const resolvedOrderId = payment.orderId || checkData?.orderId || orderId || "-";
  const resolvedPaymentId = payment.paymentId || payment.id || checkData?.paymentId || paymentId || "-";
  const resolvedTableId = payment.tableId || checkData?.tableId || orderData?.tableId || tableId || "-";
  const resolvedSessionId = stripeSessionId || payment.stripeSessionId || payment.stripeCheckoutSessionId || checkData?.sessionId || "";
  const currency = String(payment.currency || checkData?.currency || "EUR").toUpperCase();
  const items = Array.isArray(orderData?.items) ? orderData.items : [];
  const subtotal = Number(payment.amount ?? checkData?.amount ?? calculateSubtotal(items)) || 0;
  const tip = Number(payment.tipAmount ?? checkData?.tipAmount ?? 0) || 0;
  const total = Number(payment.totalAmount ?? checkData?.totalAmount ?? (subtotal + tip)) || 0;
  const providerLabel = String(payment.provider || checkData?.provider || provider || "stripe").toLowerCase();
  const methodLabel = providerLabel === "stripe"
    ? "Card / Stripe Sandbox"
    : `${payment.method || checkData?.method || "card"} / ${payment.provider || checkData?.provider || provider || "payment provider"}`;
  const receiptNumberSuffix = String(resolvedPaymentId || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-8)
    .toUpperCase() || "PAYMENT";
  const receiptNumber = `DEMO-${receiptNumberSuffix}`;

  receiptMount.hidden = false;
  receiptMount.innerHTML = `
    <section class="electronic-receipt">
      <div class="electronic-receipt-brand">Restaurant / Serve Software</div>
      <h2>Demo Electronic Receipt</h2>
      <div class="electronic-receipt-subtitle">School project payment receipt</div>
      <div class="electronic-receipt-status">Status: Paid</div>

      <div class="electronic-receipt-meta">
        <div><span>Receipt number</span><strong>${escapeHtml(receiptNumber)}</strong></div>
        <div><span>Date/time</span><strong>${escapeHtml(formatReceiptDate())}</strong></div>
        <div><span>Order ID</span><strong>${escapeHtml(resolvedOrderId)}</strong></div>
        <div><span>Payment ID</span><strong>${escapeHtml(resolvedPaymentId)}</strong></div>
        ${resolvedSessionId ? `<div><span>Stripe session ID</span><strong>${escapeHtml(resolvedSessionId)}</strong></div>` : ""}
        <div><span>Table ID</span><strong>${escapeHtml(resolvedTableId)}</strong></div>
        <div><span>Method</span><strong>${escapeHtml(methodLabel)}</strong></div>
        <div><span>Currency</span><strong>${escapeHtml(currency || "EUR")}</strong></div>
      </div>

      <div class="electronic-receipt-items">
        ${items.length ? items.map((item) => {
          const qty = itemQty(item);
          const price = itemPrice(item);
          const lineTotal = qty * price;
          return `
            <div class="electronic-receipt-item">
              <div>
                <strong>${escapeHtml(itemName(item))}</strong>
                <span>${escapeHtml(qty)} x ${escapeHtml(money(price, currency))}</span>
              </div>
              <strong>${escapeHtml(money(lineTotal, currency))}</strong>
            </div>
          `;
        }).join("") : `<div class="electronic-receipt-empty">Order items could not be loaded.</div>`}
      </div>

      <div class="electronic-receipt-totals">
        <div><span>Subtotal</span><strong>${escapeHtml(money(subtotal, currency))}</strong></div>
        <div><span>Tip</span><strong>${escapeHtml(money(tip, currency))}</strong></div>
        <div class="electronic-receipt-total"><span>Total</span><strong>${escapeHtml(money(total, currency))}</strong></div>
      </div>

      <p class="electronic-receipt-note">This is not a fiscal receipt.</p>
    </section>
  `;
}

function dashboardUrl() {
  try {
    const requested = params.get("returnTo") || "./index.html";
    const url = new URL(requested, window.location.href);
    return url.origin === window.location.origin ? url.toString() : new URL("./index.html", window.location.href).toString();
  } catch {
    return "./index.html";
  }
}

async function checkStatus() {
  if (!paymentId && !stripeSessionId && !orderId) {
    throw new Error(t("Missing payment details."));
  }

  const data = await apiPost(
    "/api/payments/check",
    paymentId
      ? { paymentId, sessionId: stripeSessionId || undefined }
      : (stripeSessionId ? { sessionId: stripeSessionId, orderId: orderId || undefined } : { orderId })
  );
  paymentId = data.paymentId || data.payment?.paymentId || paymentId;
  const status = String(data.status || data.paymentStatus || data.payment?.status || "").toLowerCase();

  if (status === "paid" || status === "succeeded") {
    const resolvedOrderId = data.orderId || data.payment?.orderId || orderId;
    const orderData = await loadOrderForReceipt(resolvedOrderId) || data.order || null;
    renderElectronicReceipt(data, orderData);
    const paidPayment = data.payment || {};
    const paidTotal = data.totalAmount ?? paidPayment.totalAmount;
    const paidCurrency = data.currency || paidPayment.currency || "";
    setResult(
      t("Payment successful"),
      t("Confirmed by payment provider."),
      `${provider || data.provider || paidPayment.provider || ""} ${paidTotal ? Number(paidTotal).toFixed(2) : ""} ${paidCurrency}`.trim(),
      "ok"
    );
    if (printReceiptBtn) printReceiptBtn.hidden = false;
    return;
  }

  if (receiptMount) {
    receiptMount.hidden = true;
    receiptMount.innerHTML = "";
  }

  if (status === "failed" || status === "cancelled" || status === "canceled") {
    setResult(t("Payment failed"), t("Order is still open."), t("No paid confirmation yet."), "err");
    return;
  }

  setResult(t("Payment pending"), t("No paid confirmation yet."), t("Payment pending"), "pending");
}

async function init() {
  if (checkAgainBtn) {
    checkAgainBtn.textContent = pageType === "cancel" ? t("Check payment status") : t("Check again");
  }
  if (backToDashboardBtn) backToDashboardBtn.textContent = t("Back to dashboard");
  if (printReceiptBtn) printReceiptBtn.textContent = t("Print receipt");

  if (pageType === "cancel") {
    setResult(t("Payment cancelled"), t("Order is still open."), t("Order is still open."), "pending");
  } else {
    setResult(t("Payment pending"), t("No paid confirmation yet."), t("Payment pending"), "pending");
  }

  try {
    const user = await waitForAuthUser();
    if (!user && !isClientMode) throw new Error(t("Not signed in."));

    const healthy = await checkApiHealth();
    if (!healthy) throw new Error(t("Payment server is not available."));

    if (pageType !== "cancel") {
      setBusy(true);
      await checkStatus();
    }
  } catch (err) {
    setResult(
      pageType === "cancel" ? t("Payment cancelled") : t("Payment pending"),
      pageType === "cancel" ? t("Order is still open.") : t("No paid confirmation yet."),
      err.message || t("Payment server is not available."),
      "err"
    );
  } finally {
    setBusy(false);
  }
}

checkAgainBtn?.addEventListener("click", async () => {
  setBusy(true);
  try {
    await checkStatus();
  } catch (err) {
    setResult(
      pageType === "cancel" ? t("Payment cancelled") : t("Payment pending"),
      pageType === "cancel" ? t("Order is still open.") : t("No paid confirmation yet."),
      err.message || t("Payment server is not available."),
      "err"
    );
  } finally {
    setBusy(false);
  }
});

backToDashboardBtn?.addEventListener("click", () => {
  window.location.href = dashboardUrl();
});

printReceiptBtn?.addEventListener("click", () => {
  window.print();
});

init();
