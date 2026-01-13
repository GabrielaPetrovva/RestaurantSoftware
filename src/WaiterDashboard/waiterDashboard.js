// waiterDashboard.js (Firebase v9 modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/* ================== CONFIG ================== */
const firebaseConfig = window.firebaseConfig; // сложи го в отделен config.js или window
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ================== STATE ================== */
let me = null;                 // employees/{uid}
let meUid = null;              // auth uid
let selectedTableId = null;
let selectedOrderId = null;
let selectedCategoryId = null;

let unsubTables = null;
let unsubOrderItems = null;
let unsubCategories = null;
let unsubMenuItems = null;
let unsubDelivery = null;
let unsubStats = null;

let paymentMethod = "cash";
let tipMode = "percent";       // percent | custom
let tipPercent = 0;
let tipCustom = 0;

/* ================== DOM ================== */
const elUser = document.getElementById("topUser");                 // top bar user info
const btnExit = document.getElementById("btnExit");

const elTables = document.getElementById("tablesGrid");            // tables cards container
const elOrdersBox = document.getElementById("ordersBox");          // orders panel container
const elOrderItems = document.getElementById("orderItems");        // UL/DIV list
const elOrderTotal = document.getElementById("orderTotal");        // total label

const elMenuTabs = document.getElementById("menuTabs");            // categories tabs container
const elMenuList = document.getElementById("menuList");            // menu items container

const elPayMethodBtns = document.querySelectorAll("[data-pay-method]");
const elTipBtns = document.querySelectorAll("[data-tip-percent]");
const elTipCustom = document.getElementById("tipCustom");          // input
const elPayComment = document.getElementById("payComment");        // textarea
const elPayAmount = document.getElementById("payAmount");          // label
const btnCompletePayment = document.getElementById("btnCompletePayment");

const elDeliveryList = document.getElementById("deliveryList");    // container
const elSalesShift = document.getElementById("salesShift");        // label
const elAvgCheck = document.getElementById("avgCheck");            // label

/* ================== HELPERS ================== */
const euro = (n) => `${(Number(n) || 0).toFixed(2)}€`;

function ensureShiftStart() {
  const key = `shiftStart_${meUid}`;
  let v = localStorage.getItem(key);
  if (!v) {
    v = String(Date.now());
    localStorage.setItem(key, v);
  }
  return Number(v);
}

function cleanupSubs() {
  if (unsubTables) unsubTables();
  if (unsubOrderItems) unsubOrderItems();
  if (unsubCategories) unsubCategories();
  if (unsubMenuItems) unsubMenuItems();
  if (unsubDelivery) unsubDelivery();
  if (unsubStats) unsubStats();
}

/* ================== AUTH / ME ================== */
onAuthStateChanged(auth, async (user) => {
  cleanupSubs();

  if (!user) {
    // ако имаш login page:
    window.location.href = "/login.html";
    return;
  }

  meUid = user.uid;

  // employees/{uid}
  const empRef = doc(db, "employees", meUid);
  const empSnap = await getDoc(empRef);
  if (!empSnap.exists()) {
    alert("Нямаш employee профил в базата (employees/{uid}).");
    return;
  }

  me = empSnap.data();

  if (me.status !== "active") {
    alert("Акаунтът ти е inactive. Нямаш достъп.");
    await signOut(auth);
    return;
  }

  // show top user
  elUser.textContent = `Logged in: ${me.name || "Unknown"} (${me.role}) • ${me.email || user.email}`;

  // start realtime
  listenTables();
  listenCategories();
  listenDelivery();
  listenStats();
});

btnExit?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});

/* ================== TABLES ================== */
function listenTables() {
  const qTables = query(collection(db, "tables"), orderBy("name"));
  unsubTables = onSnapshot(qTables, (snap) => {
    elTables.innerHTML = "";
    snap.forEach((d) => {
      const t = { id: d.id, ...d.data() };

      const card = document.createElement("button");
      card.className = "table-card";
      card.dataset.id = t.id;

      const statusTxt = (t.status || "free").toLowerCase() === "occupied" ? "Occupied" : "Free";
      card.innerHTML = `
        <div class="table-title">${t.name || "Table"}</div>
        <div class="table-status">${statusTxt}</div>
      `;

      card.addEventListener("click", () => openTable(t.id, t));
      elTables.appendChild(card);
    });
  });
}

async function openTable(tableId, tableDoc) {
  selectedTableId = tableId;

  // if already has open order
  if (tableDoc.currentOrderId) {
    selectedOrderId = tableDoc.currentOrderId;
    listenOrderItems(selectedOrderId);
    return;
  }

  // create new open order
  const orderRef = await addDoc(collection(db, "orders"), {
    tableId,
    waiterId: meUid,
    type: "dine-in",
    status: "open",
    comment: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  selectedOrderId = orderRef.id;

  // mark table occupied + set currentOrderId
  await updateDoc(doc(db, "tables", tableId), {
    status: "occupied",
    currentOrderId: selectedOrderId
  });

  listenOrderItems(selectedOrderId);
}

/* ================== ORDER ITEMS ================== */
function listenOrderItems(orderId) {
  // cleanup previous
  if (unsubOrderItems) unsubOrderItems();
  elOrderItems.innerHTML = "";
  elOrderTotal.textContent = euro(0);
  elPayAmount.textContent = euro(0);

  const qItems = query(collection(db, "orders", orderId, "items"));
  unsubOrderItems = onSnapshot(qItems, (snap) => {
    let total = 0;
    elOrderItems.innerHTML = "";

    if (snap.empty) {
      elOrderItems.innerHTML = `<div class="muted">No order selected. Tap a table to start.</div>`;
    }

    snap.forEach((d) => {
      const it = d.data();
      const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
      total += line;

      const row = document.createElement("div");
      row.className = "order-row";
      row.innerHTML = `
        <div class="order-name">${it.name}</div>
        <div class="order-qty">
          <button class="qty-btn" data-dec>-</button>
          <span>${it.qty}</span>
          <button class="qty-btn" data-inc>+</button>
        </div>
        <div class="order-line">${euro(line)}</div>
        <button class="qty-btn" data-del>✕</button>
      `;

      row.querySelector("[data-inc]").addEventListener("click", () => changeQty(d.id, +1));
      row.querySelector("[data-dec]").addEventListener("click", () => changeQty(d.id, -1));
      row.querySelector("[data-del]").addEventListener("click", () => removeItem(d.id));

      elOrderItems.appendChild(row);
    });

    elOrderTotal.textContent = euro(total);
    elPayAmount.textContent = euro(total);

    // tip recalculation (visual only)
    refreshTipUI(total);
  });
}

async function changeQty(menuItemId, delta) {
  if (!selectedOrderId) return;

  const ref = doc(db, "orders", selectedOrderId, "items", menuItemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const cur = snap.data();
  const newQty = (Number(cur.qty) || 0) + delta;

  if (newQty <= 0) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, { qty: newQty });
  }
}

async function removeItem(menuItemId) {
  if (!selectedOrderId) return;
  await deleteDoc(doc(db, "orders", selectedOrderId, "items", menuItemId));
}

/* ================== MENU (CATEGORIES + ITEMS) ================== */
function listenCategories() {
  const qCats = query(collection(db, "menu_categories"), where("status", "==", "active"), orderBy("sort"));
  unsubCategories = onSnapshot(qCats, (snap) => {
    elMenuTabs.innerHTML = "";
    let firstId = null;

    snap.forEach((d) => {
      const c = { id: d.id, ...d.data() };
      if (!firstId) firstId = c.id;

      const btn = document.createElement("button");
      btn.className = "menu-tab";
      btn.textContent = c.name || "Category";
      btn.addEventListener("click", () => selectCategory(c.id));
      elMenuTabs.appendChild(btn);
    });

    // auto select first
    if (!selectedCategoryId && firstId) selectCategory(firstId);
  });
}

function selectCategory(categoryId) {
  selectedCategoryId = categoryId;
  listenMenuItems(categoryId);
}

function listenMenuItems(categoryId) {
  if (unsubMenuItems) unsubMenuItems();

  const qItems = query(
    collection(db, "menu_items"),
    where("status", "==", "active"),
    where("categoryId", "==", categoryId),
    orderBy("name")
  );

  unsubMenuItems = onSnapshot(qItems, (snap) => {
    elMenuList.innerHTML = "";

    snap.forEach((d) => {
      const m = { id: d.id, ...d.data() };

      const card = document.createElement("button");
      card.className = "menu-item";
      card.innerHTML = `
        <div class="mi-left">
          <div class="mi-name">${m.name}</div>
          <div class="mi-price">${euro(m.price)}</div>
        </div>
        ${m.imageUrl ? `<img class="mi-img" src="${m.imageUrl}" alt="">` : ""}
      `;

      card.addEventListener("click", () => addMenuItemToOrder(m));
      elMenuList.appendChild(card);
    });
  });
}

async function addMenuItemToOrder(m) {
  if (!selectedOrderId) {
    alert("Първо избери маса.");
    return;
  }

  const ref = doc(db, "orders", selectedOrderId, "items", m.id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      name: m.name,
      price: Number(m.price) || 0,
      qty: 1
    });
  } else {
    await updateDoc(ref, { qty: increment(1) });
  }

  // touch order updatedAt
  await updateDoc(doc(db, "orders", selectedOrderId), { updatedAt: serverTimestamp() });
}

/* ================== PAYMENTS UI ================== */
elPayMethodBtns.forEach((b) => {
  b.addEventListener("click", () => {
    paymentMethod = b.dataset.payMethod;
    elPayMethodBtns.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
  });
});

elTipBtns.forEach((b) => {
  b.addEventListener("click", () => {
    tipMode = "percent";
    tipPercent = Number(b.dataset.tipPercent) || 0;
    tipCustom = 0;
    if (elTipCustom) elTipCustom.value = "";
  });
});

elTipCustom?.addEventListener("input", () => {
  tipMode = "custom";
  tipCustom = Number(elTipCustom.value) || 0;
  tipPercent = 0;
});

function refreshTipUI(baseAmount) {
  // не пипаме дизайна – само смятаме при Complete Payment
  // ако искаш да показва total-with-tip на екрана – кажи, ще го вържа към label.
}

btnCompletePayment?.addEventListener("click", async () => {
  if (!selectedOrderId || !selectedTableId) {
    alert("Няма избрана маса/поръчка.");
    return;
  }

  // calculate amount from current displayed total
  const baseAmount = Number(String(elPayAmount.textContent || "0").replace("€","")) || 0;

  let tipAmount = 0;
  if (tipMode === "percent") {
    tipAmount = baseAmount * (tipPercent / 100);
  } else {
    tipAmount = tipCustom;
  }

  const comment = elPayComment?.value || "";

  // create payment
  await addDoc(collection(db, "payments"), {
    orderId: selectedOrderId,
    tableId: selectedTableId,
    waiterId: meUid,
    method: paymentMethod,
    amount: baseAmount,
    tipAmount,
    comment,
    createdAt: serverTimestamp()
  });

  // close order
  await updateDoc(doc(db, "orders", selectedOrderId), {
    status: "paid",
    updatedAt: serverTimestamp()
  });

  // free table
  await updateDoc(doc(db, "tables", selectedTableId), {
    status: "free",
    currentOrderId: null
  });

  // reset UI state
  selectedOrderId = null;
  selectedTableId = null;
  if (unsubOrderItems) unsubOrderItems();
  elOrderItems.innerHTML = `<div class="muted">No order selected. Tap a table to start.</div>`;
  elOrderTotal.textContent = euro(0);
  elPayAmount.textContent = euro(0);
  if (elPayComment) elPayComment.value = "";
  if (elTipCustom) elTipCustom.value = "";
  tipPercent = 0;
  tipCustom = 0;

  alert("Payment completed ✅");
});

/* ================== DELIVERY / TAKEAWAY ================== */
function listenDelivery() {
  const qDel = query(
    collection(db, "orders"),
    where("type", "==", "delivery"),
    where("status", "in", ["open", "sent", "preparing", "ready"]),
    orderBy("updatedAt", "desc"),
    limit(10)
  );

  unsubDelivery = onSnapshot(qDel, (snap) => {
    elDeliveryList.innerHTML = "";
    snap.forEach((d) => {
      const o = { id: d.id, ...d.data() };
      const row = document.createElement("div");
      row.className = "delivery-row";
      row.innerHTML = `
        <div>Order #${o.shortId || o.id.slice(0,6)}</div>
        <div class="pill">${o.status}</div>
      `;
      elDeliveryList.appendChild(row);
    });
  });
}

/* ================== STATS (THIS SHIFT) ================== */
function listenStats() {
  const startMs = ensureShiftStart();
  const startDate = new Date(startMs);

  // payments for this waiter since shift start
  const qPay = query(
    collection(db, "payments"),
    where("waiterId", "==", meUid),
    where("createdAt", ">=", startDate),
    orderBy("createdAt", "desc")
  );

  unsubStats = onSnapshot(qPay, (snap) => {
    let sales = 0;
    let count = 0;

    snap.forEach((d) => {
      const p = d.data();
      const amount = (Number(p.amount) || 0) + (Number(p.tipAmount) || 0);
      sales += amount;
      count += 1;
    });

    elSalesShift.textContent = euro(sales);
    elAvgCheck.textContent = euro(count ? sales / count : 0);
  });
}
/* ================== LOGGING ACTIONS ================== */
async function logAction({ actorUid, actorEmail, type, message, meta }) {
  await addDoc(collection(db, "logs"), {
    actorUid,
    actorEmail,
    type,
    message,
    meta,
    createdAt: serverTimestamp()
  });
}