import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, doc, getDoc, addDoc, updateDoc,
  collection, query, where, orderBy, onSnapshot, limit,
  serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/* ================== CONFIG ================== */
if (!window.firebaseConfig) alert("Липсва config.js (window.firebaseConfig).");
const app = initializeApp(window.firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ================== DOM ================== */
const userNameEl = document.getElementById("userName");
const exitBtn = document.getElementById("exitBtn");

const views = Array.from(document.querySelectorAll(".view"));
const topNavBtns = Array.from(document.querySelectorAll(".top-nav button[data-view]"));
const bottomNavBtns = Array.from(document.querySelectorAll(".bottom-nav button[data-view]"));
const backToTablesBtn = document.getElementById("backToTablesBtn");

const tablesGrid = document.getElementById("tablesGrid");
const tplTableChip = document.getElementById("tplTableChip");

const orderItemsEl = document.getElementById("orderItems");
const totalValueEl = document.getElementById("totalValue");
const amountValueEl = document.getElementById("amountValue");

const categoryRow = document.getElementById("categoryRow");
const menuItemsEl = document.getElementById("menuItems");
const tplMenuItem = document.getElementById("tplMenuItem");

const paymentTypes = document.getElementById("paymentTypes");
const tipBtns = Array.from(document.querySelectorAll(".tip-btn"));
const customTipEl = document.getElementById("customTip");
const commentsEl = document.getElementById("comments");
const completePaymentBtn = document.getElementById("completePayment");

const checksList = document.getElementById("checksList");

const statSales = document.getElementById("statSales");
const statAvg = document.getElementById("statAvg");
const statTables = document.getElementById("statTables");
const statTips = document.getElementById("statTips");

/* ================== STATE ================== */
let meUid = null;
let me = null;

let selectedTableId = null;
let selectedOrderId = null;

let currentOrder = null;
let currentTotal = 0;

let selectedCategory = null; // {id, name, key}
let menusCache = [];

let unsubTables = null;
let unsubOrder = null;
let unsubCategories = null;
let unsubMenus = null;
let unsubPayments = null;
let unsubStats = null;

let payMethod = "cash";
let tipPercent = 0;
let tipCustom = 0;

/* ================== HELPERS ================== */
const euro = (n) => `${(Number(n) || 0).toFixed(2)}€`;
const parseEuroInput = (s) => {
  if (!s) return 0;
  const cleaned = String(s).replace(",", ".").replace(/[^\d.]/g, "");
  return Number(cleaned) || 0;
};

function setView(viewName) {
  views.forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add("active");

  [...topNavBtns, ...bottomNavBtns].forEach(b => b.classList.remove("active"));
  topNavBtns.filter(b => b.dataset.view === viewName).forEach(b => b.classList.add("active"));
  bottomNavBtns.filter(b => b.dataset.view === viewName).forEach(b => b.classList.add("active"));
}

function ensureShiftStart() {
  const key = `shiftStart_${meUid}`;
  let v = localStorage.getItem(key);
  if (!v) {
    v = String(Date.now());
    localStorage.setItem(key, v);
  }
  return Number(v);
}

/* ================== NAV ================== */
[...topNavBtns, ...bottomNavBtns].forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});
backToTablesBtn?.addEventListener("click", () => setView("tables"));

/* ================== AUTH ================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  meUid = user.uid;

  const empSnap = await getDoc(doc(db, "employees", meUid));
  if (!empSnap.exists()) {
    alert("Нямаш employees/{uid} документ.");
    await signOut(auth);
    return;
  }

  me = empSnap.data();
  if (me.status !== "active") {
    alert("Акаунтът е inactive.");
    await signOut(auth);
    return;
  }

  userNameEl.textContent = `${me.name || "Unknown"} (${me.role || "staff"})`;

  listenTables();
  listenCategories();
  listenMenus();
  listenPaymentsHistory();
  listenStats();
});

exitBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});

/* ================== TABLES ================== */
function listenTables() {
  if (unsubTables) unsubTables();

  const qTables = query(collection(db, "tables"), orderBy("number"));
  unsubTables = onSnapshot(qTables, (snap) => {
    tablesGrid.innerHTML = "";

    if (snap.empty) {
      tablesGrid.innerHTML = `<div class="muted">No tables in Firestore.</div>`;
      return;
    }

    snap.forEach((d) => {
      const t = { id: d.id, ...d.data() };

      const node = tplTableChip.content.firstElementChild.cloneNode(true);
      node.querySelector(".name").textContent = `Table ${t.number ?? ""}`.trim() || t.id;

      const isBusy = String(t.status || "").toLowerCase() === "busy";
      node.querySelector(".status").textContent = isBusy ? "Busy" : "Free";

      node.addEventListener("click", () => openTable(t));
      tablesGrid.appendChild(node);
    });
  }, (err) => {
    tablesGrid.innerHTML = `<div class="muted">Tables load error:<br>${err.message}</div>`;
  });
}

async function openTable(t) {
  selectedTableId = t.id;

  const activeOrders = Array.isArray(t.activeOrders) ? t.activeOrders : [];
  const lastOrderId = activeOrders.length ? activeOrders[activeOrders.length - 1] : null;

  if (lastOrderId) {
    selectedOrderId = lastOrderId;
    setView("orders");
    listenOrder(selectedOrderId);
    return;
  }

  const orderRef = await addDoc(collection(db, "orders"), {
    tableId: t.id,
    status: "created",
    items: [],
    waiterId: meUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  selectedOrderId = orderRef.id;

  await updateDoc(doc(db, "tables", t.id), {
    status: "busy",
    activeOrders: arrayUnion(selectedOrderId),
    updatedAt: serverTimestamp()
  });

  setView("orders");
  listenOrder(selectedOrderId);
}

/* ================== ORDER ================== */
function listenOrder(orderId) {
  if (unsubOrder) unsubOrder();

  orderItemsEl.innerHTML = `<div class="muted">Loading...</div>`;
  totalValueEl.textContent = euro(0);
  amountValueEl.textContent = euro(0);
  currentTotal = 0;

  unsubOrder = onSnapshot(doc(db, "orders", orderId), (snap) => {
    if (!snap.exists()) {
      orderItemsEl.innerHTML = `<div class="muted">Order not found.</div>`;
      return;
    }

    currentOrder = { id: snap.id, ...snap.data() };
    const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];

    orderItemsEl.innerHTML = "";
    if (!items.length) {
      orderItemsEl.innerHTML = `<div class="muted">Empty order. Add items from menu.</div>`;
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
    orderItemsEl.innerHTML = `<div class="muted">Order error: ${err.message}</div>`;
  });
}

async function changeQty(index, delta) {
  if (!selectedOrderId || !currentOrder) return;

  const items = Array.isArray(currentOrder.items) ? [...currentOrder.items] : [];
  if (!items[index]) return;

  const newQty = (Number(items[index].qty) || 0) + delta;
  if (newQty <= 0) items.splice(index, 1);
  else items[index].qty = newQty;

  await updateDoc(doc(db, "orders", selectedOrderId), { items, updatedAt: serverTimestamp() });
}

async function removeItem(index) {
  if (!selectedOrderId || !currentOrder) return;

  const items = Array.isArray(currentOrder.items) ? [...currentOrder.items] : [];
  items.splice(index, 1);

  await updateDoc(doc(db, "orders", selectedOrderId), { items, updatedAt: serverTimestamp() });
}

/* ================== CATEGORIES ================== */
function listenCategories() {
  if (unsubCategories) unsubCategories();

  // без index: само where
  const qCats = query(collection(db, "menu_categories"), where("status", "==", "active"));

  unsubCategories = onSnapshot(qCats, (snap) => {
    categoryRow.innerHTML = "";

    const cats = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      const key = data.key || data.slug || data.code || d.id; // ✅ това е важно
      cats.push({ id: d.id, key, ...data });
    });

    cats.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));

    if (!cats.length) {
      categoryRow.innerHTML = `<div class="muted">No categories.</div>`;
      return;
    }

    if (selectedCategory && !cats.some(c => c.id === selectedCategory.id)) selectedCategory = null;

    cats.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn";
      btn.textContent = c.name || c.title || c.key || "Category";

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
    categoryRow.innerHTML = `<div class="muted">Categories error: ${err.message}</div>`;
  });
}

/* ================== MENUS ================== */
function listenMenus() {
  if (unsubMenus) unsubMenus();

  // при теб е active: true
  const qMenus = query(collection(db, "menus"));
  unsubMenus = onSnapshot(qMenus, (snap) => {
    menusCache = [];
    snap.forEach((d) => menusCache.push({ id: d.id, ...d.data() }));
    renderMenusForCategory();
  }, (err) => {
    menuItemsEl.innerHTML = `<div class="muted">Menus error: ${err.message}</div>`;
  });
}

function renderMenusForCategory() {
  if (!selectedCategory) return;

  menuItemsEl.innerHTML = "";

  // ✅ твоите активни артикули са active:true (не status:"active")
  let items = menusCache.filter(m => m.active === true || m.status === "active");

  // ✅ category в menus е "burger" (ключ), не бг име
  const catKey = String(selectedCategory.key || selectedCategory.slug || selectedCategory.code || selectedCategory.id).trim().toLowerCase();

  let filtered = items.filter(m =>
    String(m.category || m.categoryKey || m.categorySlug || "").trim().toLowerCase() === catKey
  );

  // fallback ако някой ползва categoryId
  if (!filtered.length) {
    filtered = items.filter(m => String(m.categoryId || "").trim() === String(selectedCategory.id));
  }

  if (!filtered.length) {
    menuItemsEl.innerHTML = `<div class="muted" style="padding:10px 0;">
      Няма items за категория "${selectedCategory.name || selectedCategory.key}".<br>
      Очаквам menus.category == "${catKey}" (пример: burger).
    </div>`;
    return;
  }

  filtered.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  filtered.forEach((m) => {
    const node = tplMenuItem.content.firstElementChild.cloneNode(true);

    const price = (m.price != null) ? Number(m.price) : Number(m.cost); // ✅ price или cost
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
  const price = (m.price != null) ? Number(m.price) : Number(m.cost);

  const items = Array.isArray(currentOrder.items) ? [...currentOrder.items] : [];
  const idx = items.findIndex(x => x.itemId === name);

  if (idx === -1) items.push({ itemId: name, price, qty: 1 });
  else items[idx].qty = (Number(items[idx].qty) || 0) + 1;

  await updateDoc(doc(db, "orders", selectedOrderId), { items, updatedAt: serverTimestamp() });
}

/* ================== PAY UI ================== */
paymentTypes?.addEventListener("click", (e) => {
  const btn = e.target.closest(".pay-btn");
  if (!btn) return;

  payMethod = btn.dataset.type;
  Array.from(paymentTypes.querySelectorAll(".pay-btn")).forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
});

tipBtns.forEach((b) => {
  b.addEventListener("click", () => {
    tipPercent = Number(b.dataset.tip) || 0;
    tipCustom = 0;
    customTipEl.value = "";
    tipBtns.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
  });
});

customTipEl?.addEventListener("input", () => {
  tipCustom = parseEuroInput(customTipEl.value);
  tipPercent = 0;
  tipBtns.forEach(x => x.classList.remove("active"));
});

/* ================== COMPLETE PAYMENT ================== */
completePaymentBtn?.addEventListener("click", async () => {
  try {
    if (!selectedOrderId || !selectedTableId || !currentOrder) return alert("Няма избрана маса/поръчка.");

    const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];
    if (!items.length) return alert("Поръчката е празна.");

    const baseAmount = currentTotal;
    const tipAmount = tipPercent > 0 ? baseAmount * tipPercent : tipCustom;
    const comment = commentsEl?.value || "";

    await addDoc(collection(db, "payments"), {
      orderId: selectedOrderId,
      tableId: selectedTableId,
      waiterId: meUid,
      method: payMethod,
      amount: baseAmount,
      tipAmount: Number(tipAmount) || 0,
      comment,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "orders", selectedOrderId), { status: "paid", updatedAt: serverTimestamp() });

    const tableRef = doc(db, "tables", selectedTableId);
    await updateDoc(tableRef, { activeOrders: arrayRemove(selectedOrderId), updatedAt: serverTimestamp() });

    const tSnap = await getDoc(tableRef);
    const t = tSnap.exists() ? tSnap.data() : {};
    const stillActive = Array.isArray(t.activeOrders) && t.activeOrders.length > 0;

    await updateDoc(tableRef, { status: stillActive ? "busy" : "free", updatedAt: serverTimestamp() });

    selectedTableId = null;
    selectedOrderId = null;
    currentOrder = null;
    currentTotal = 0;

    orderItemsEl.innerHTML = `<div class="muted">No order selected. Tap a table to start.</div>`;
    totalValueEl.textContent = euro(0);
    amountValueEl.textContent = euro(0);

    commentsEl.value = "";
    customTipEl.value = "";
    tipPercent = 0;
    tipCustom = 0;
    tipBtns.forEach(x => x.classList.remove("active"));

    alert("Payment completed ✅");
    setView("tables");
  } catch (err) {
    alert(`Payment failed: ${err.message}`);
  }
});

/* ================== PAYMENTS HISTORY ================== */
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
    if (snap.empty) return checksList.innerHTML = `<div class="muted">No payments yet.</div>`;

    snap.forEach((d) => {
      const p = { id: d.id, ...d.data() };
      const total = (Number(p.amount) || 0) + (Number(p.tipAmount) || 0);

      const row = document.createElement("div");
      row.style.padding = "10px";
      row.style.border = "1px solid rgba(0,0,0,0.06)";
      row.style.borderRadius = "12px";
      row.style.marginBottom = "8px";
      row.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <strong>${euro(total)}</strong>
          <span class="muted">${String(p.method || "").toUpperCase()}</span>
        </div>
        <div class="muted" style="font-size:12px; margin-top:4px;">
          Table: ${p.tableId || "-"} • Order: ${(p.orderId || "").slice(0,6)}
        </div>
      `;
      checksList.appendChild(row);
    });
  }, (err) => {
    checksList.innerHTML = `<div class="muted">Payments error: ${err.message}</div>`;
  });
}

/* ================== STATS ================== */
function listenStats() {
  if (unsubStats) unsubStats();

  const startDate = new Date(ensureShiftStart());

  const qPay = query(
    collection(db, "payments"),
    where("waiterId", "==", meUid),
    where("createdAt", ">=", startDate),
    orderBy("createdAt", "desc")
  );

  unsubStats = onSnapshot(qPay, (snap) => {
    let sales = 0, tips = 0, count = 0;
    snap.forEach((d) => {
      const p = d.data();
      const t = Number(p.tipAmount) || 0;
      tips += t;
      sales += (Number(p.amount) || 0) + t;
      count += 1;
    });

    statSales.textContent = euro(sales);
    statAvg.textContent = euro(count ? sales / count : 0);
    statTips.textContent = euro(tips);
    statTables.textContent = String(count);
  }, () => {
    statSales.textContent = "—";
    statAvg.textContent = "—";
    statTips.textContent = "—";
    statTables.textContent = "—";
  });
}
