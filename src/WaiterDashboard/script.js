/* ======================= BOOT CHECK ======================= */
console.log("✅ WAITER script.js loaded");

/* ======================= FIREBASE IMPORTS (MODULE) ======================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, getDocs,
  collection, addDoc, updateDoc,
  query, where, orderBy, limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/* ======================= CONFIG ======================= */
if (!window.firebaseConfig) {
  alert("❌ Missing config.js -> window.firebaseConfig");
  throw new Error("Missing window.firebaseConfig");
}

const app = initializeApp(window.firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ======================= DOM ======================= */
const qs = (id) => document.getElementById(id);
const btnPrintOrders = document.getElementById("btnPrintOrders");

const userNameEl = qs("userName");
const exitBtn = qs("exitBtn");

const views = Array.from(document.querySelectorAll(".view"));
const topNavBtns = Array.from(document.querySelectorAll(".top-nav button[data-view]"));
const bottomNavBtns = Array.from(document.querySelectorAll(".bottom-nav button[data-view]"));
const backToTablesBtn = qs("backToTablesBtn");

const tablesGrid = qs("tablesGrid");
const tplTableChip = qs("tplTableChip");

const orderItemsEl = qs("orderItems");
const totalValueEl = qs("totalValue");
const amountValueEl = qs("amountValue");

const categoryRow = qs("categoryRow");
const menuItemsEl = qs("menuItems");
const tplMenuItem = qs("tplMenuItem");

const paymentTypes = qs("paymentTypes");
const customTipEl = qs("customTip");
const commentsEl = qs("comments");
const completePaymentBtn = qs("completePayment");

const checksList = qs("checksList");

const statSales = qs("statSales");
const statAvg = qs("statAvg");
const statTables = qs("statTables");
const statTips = qs("statTips");

/* ======================= GUARDS ======================= */
function requireEl(el, name) {
  if (!el) throw new Error(`Missing DOM element: ${name}`);
}
[
  [userNameEl, "userName"],
  [exitBtn, "exitBtn"],
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
  [commentsEl, "comments"],
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

let unsubTables = null;
let unsubOrder = null;
let unsubCats = null;
let unsubMenus = null;
let unsubPayments = null;
let unsubStats = null;

/* ======================= HELPERS ======================= */
const euro = (n) => `${(Number(n) || 0).toFixed(2)}€`;

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

/* ======================= NAV ======================= */
[...topNavBtns, ...bottomNavBtns].forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});
backToTablesBtn?.addEventListener("click", () => setView("tables"));

/* ======================= AUTH ======================= */
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      alert("Not signed in. Go to login.");
      return;
    }

    meUid = user.uid;

    const empSnap = await getDoc(doc(db, "employees", meUid));
    if (!empSnap.exists()) {
      alert("❌ Missing employees/{uid} document");
      await signOut(auth);
      return;
    }

    meEmp = empSnap.data();
    if (meEmp.status !== "active") {
      alert("❌ Your employee status is not active.");
      await signOut(auth);
      return;
    }

    userNameEl.textContent = `${meEmp.name || "User"} (${meEmp.role || "staff"})`;

    listenTables();
    listenCategories();
    listenMenus();
    listenPaymentsHistory();
    listenStats();
  } catch (e) {
    console.error(e);
    alert("Init error: " + e.message);
  }
});

exitBtn.addEventListener("click", async () => {
  await signOut(auth);
  alert("Signed out.");
});

/* ======================= TABLES ======================= */
function listenTables() {
  if (unsubTables) unsubTables();

  const qTables = query(collection(db, "tables"), orderBy("number"));
  unsubTables = onSnapshot(qTables, (snap) => {
    tablesGrid.innerHTML = "";

    if (snap.empty) {
      tablesGrid.innerHTML = `<div class="muted">No tables.</div>`;
      return;
    }

    snap.forEach((d) => {
      const t = { id: d.id, ...d.data() };
      const node = tplTableChip.content.firstElementChild.cloneNode(true);

      node.querySelector(".name").textContent =
        (t.number != null) ? `Table ${t.number}` : t.id;

      const isBusy = String(t.status || "").toLowerCase() === "busy";
      node.querySelector(".status").textContent = isBusy ? "Busy" : "Free";

      node.addEventListener("click", () => openTable(t));
      tablesGrid.appendChild(node);
    });
  }, (err) => {
    console.error(err);
    tablesGrid.innerHTML = `<div class="muted">Tables error: ${err.message}</div>`;
  });
}

async function openTable(t) {
  selectedTableId = t.id;

  const activeOrders = Array.isArray(t.activeOrders) ? t.activeOrders : [];
  const existing = activeOrders.length ? activeOrders[activeOrders.length - 1] : null;

  if (existing) {
    selectedOrderId = existing;
    setView("orders");
    listenOrder(selectedOrderId);
    return;
  }

  const orderRef = await addDoc(collection(db, "orders"), {
    tableId: t.id,
    waiterId: meUid,
    status: "created",
    items: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  selectedOrderId = orderRef.id;

  await updateDoc(doc(db, "tables", t.id), {
    status: "busy",
    activeOrders: arrayUnion(selectedOrderId),
    updatedAt: serverTimestamp(),
  });

  setView("orders");
  listenOrder(selectedOrderId);
}

/* ======================= ORDER ======================= */
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

  await updateDoc(doc(db, "orders", selectedOrderId), {
    items,
    updatedAt: serverTimestamp()
  });
}

async function removeItem(index) {
  if (!selectedOrderId || !currentOrder) return;

  const items = Array.isArray(currentOrder.items) ? [...currentOrder.items] : [];
  items.splice(index, 1);

  await updateDoc(doc(db, "orders", selectedOrderId), {
    items,
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
      categoryRow.innerHTML = `<div class="muted">No categories.</div>`;
      menuItemsEl.innerHTML = `<div class="muted" style="padding:10px 0;">No categories.</div>`;
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
      Няма items за "${selectedCategory.name}" (menus.category == "${catKey}")
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

  const items = Array.isArray(currentOrder.items) ? [...currentOrder.items] : [];
  const idx = items.findIndex(x => x.itemId === name);

  if (idx === -1) items.push({ itemId: name, price, qty: 1 });
  else items[idx].qty = (Number(items[idx].qty) || 0) + 1;

  await updateDoc(doc(db, "orders", selectedOrderId), {
    items,
    updatedAt: serverTimestamp()
  });
}

/* ======================= PAY UI ======================= */
paymentTypes.addEventListener("click", (e) => {
  const btn = e.target.closest(".pay-btn");
  if (!btn) return;

  payMethod = btn.dataset.type || "cash";
  Array.from(paymentTypes.querySelectorAll(".pay-btn")).forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
});

customTipEl.addEventListener("input", () => {
  tipCustom = parseEuroInput(customTipEl.value);
  tipPercent = 0;
});

/* ======================= COMPLETE PAYMENT ======================= */
completePaymentBtn.addEventListener("click", async () => {
  try {
    if (!selectedOrderId || !selectedTableId || !currentOrder) return alert("Няма избрана маса/поръчка.");
    const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];
    if (!items.length) return alert("Поръчката е празна.");

    const baseAmount = currentTotal;
    const tipAmount = tipPercent > 0 ? baseAmount * tipPercent : (Number(tipCustom) || 0);

    await addDoc(collection(db, "payments"), {
      orderId: selectedOrderId,
      tableId: selectedTableId,
      waiterId: meUid,
      method: payMethod,
      amount: baseAmount,
      tipAmount,
      comment: commentsEl.value || "",
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "orders", selectedOrderId), {
      status: "paid",
      updatedAt: serverTimestamp()
    });

    const tableRef = doc(db, "tables", selectedTableId);
    await updateDoc(tableRef, {
      activeOrders: arrayRemove(selectedOrderId),
      updatedAt: serverTimestamp()
    });

    const tSnap = await getDoc(tableRef);
    const t = tSnap.exists() ? tSnap.data() : {};
    const stillActive = Array.isArray(t.activeOrders) && t.activeOrders.length > 0;

    await updateDoc(tableRef, {
      status: stillActive ? "busy" : "free",
      updatedAt: serverTimestamp()
    });

    selectedTableId = null;
    selectedOrderId = null;
    currentOrder = null;
    currentTotal = 0;

    orderItemsEl.innerHTML = `<div class="muted">No order selected. Tap a table to start.</div>`;
    totalValueEl.textContent = euro(0);
    amountValueEl.textContent = euro(0);

    commentsEl.value = "";
    customTipEl.value = "";
    tipCustom = 0;
    tipPercent = 0;

    alert("Payment completed ✅");
    setView("tables");
  } catch (err) {
    console.error(err);
    alert("Payment failed: " + err.message);
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
      checksList.innerHTML = `<div class="muted">No payments yet.</div>`;
      return;
    }

    snap.forEach((d) => {
      const p = d.data();
      const total = (Number(p.amount) || 0) + (Number(p.tipAmount) || 0);

      const row = document.createElement("div");
      row.style.padding = "10px";
      row.style.border = "1px solid rgba(0,0,0,0.06)";
      row.style.borderRadius = "12px";
      row.style.marginBottom = "8px";

      row.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <strong>${euro(total)}</strong>
          <span class="muted">${String(p.method || "").toUpperCase()}</span>
        </div>
        <div class="muted" style="font-size:12px; margin-top:4px;">
          Table: ${p.tableId || "-"} • Order: ${(p.orderId || "").slice(0, 6)}
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
    statSales.textContent = "—";
    statAvg.textContent = "—";
    statTips.textContent = "—";
    statTables.textContent = "—";
  });
}
/* ======================= PRINT ORDERS ======================= */
/* ======================= PRINT ORDERS (NO INDEX) ======================= */


/* ======================= PRINT ORDERS (WINDOWS PRINT DIALOG) ======================= */



if (btnPrintOrders) {
  btnPrintOrders.addEventListener("click", async () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return alert("Разреши popups за Print.");

    // Пишем template
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
      // ❗ Без index: само orderBy createdAt
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
      const snap = await getDocs(q);

      const root = w.document.getElementById("root");
      root.innerHTML = "";

      let printedCount = 0;

      snap.forEach((d) => {
        const o = d.data() || {};
        if (o.status === "paid") return; // филтър в JS

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
              <div style="margin-top:4px;" class="badge">${String(o.status || "—").toUpperCase()}</div>
            </div>
            <div class="total">${(typeof euro === "function") ? euro(total) : (total.toFixed(2)+"€")}</div>
          </div>

          <table>
            ${
              items.length
                ? items.map(it => `
                  <tr>
                    <td>${it.itemId || it.name || "Item"} x ${Number(it.qty)||0}</td>
                    <td class="r">${(typeof euro === "function") ? euro((Number(it.price)||0) * (Number(it.qty)||0)) : (((Number(it.price)||0)*(Number(it.qty)||0)).toFixed(2)+"€")}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="2" class="muted">Empty</td></tr>`
            }
            <tr>
              <td class="total">TOTAL</td>
              <td class="total r">${(typeof euro === "function") ? euro(total) : (total.toFixed(2)+"€")}</td>
            </tr>
          </table>
        `;
        root.appendChild(card);
        printedCount++;
      });

      if (printedCount === 0) {
        root.innerHTML = `<div class="muted">Няма активни поръчки.</div>`;
      }

      // ✅ Това отваря Windows print диалога
      setTimeout(() => {
        w.focus();
        w.print();      // <-- ТОВА е “windows print”
        // ако искаш да се затвори след print:
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