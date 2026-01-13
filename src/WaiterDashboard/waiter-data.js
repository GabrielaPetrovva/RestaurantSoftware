// src/WaiterDashboard/waiter-data.js
import { auth } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  watchTables, watchMenu,
  createOrder, addOrderItem, watchOrderItems,
  logAction, getEmployee
} from "../js/db.js";

const el = (id) => document.getElementById(id);
const norm = (x) => String(x ?? "").trim().toLowerCase();

let TABLES = [];
let MENU = [];
let unsubItems = null;

function mustHaveIds() {
  const required = ["tablesList", "menuList", "orderItems", "selectedTableId", "selectedOrderId", "selectedTableLabel"];
  const missing = required.filter(id => !el(id));
  if (missing.length) console.warn("Missing waiter DOM ids:", missing);
}

function renderTables() {
  const box = el("tablesList");
  if (!box) return;

  box.innerHTML = TABLES.map(t => {
    const status = t.status || "free";
    const label = `Маса ${t.number ?? t.id}`;
    const sub = status === "occupied" ? "Заета" : "Свободна";
    return `
      <button class="tableBtn"
              data-id="${t.id}"
              data-number="${t.number ?? ""}"
              data-order="${t.currentOrderId ?? ""}"
              style="margin:6px;padding:10px 12px;border-radius:10px;border:1px solid #ddd;cursor:pointer;">
        <b>${label}</b><br/>
        <small>${sub}</small>
      </button>
    `;
  }).join("");

  box.querySelectorAll(".tableBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tableId = btn.dataset.id;
      const tableNumber = btn.dataset.number || "";
      let orderId = btn.dataset.order || "";

      el("selectedTableId").value = tableId;
      el("selectedTableLabel").innerHTML = `<i>Избрана маса: ${tableNumber || tableId}</i>`;

      // ако няма order → правим нов
      if (!orderId) {
        orderId = await createOrder({ tableId, createdBy: auth.currentUser.uid });

        await logAction({
          actorUid: auth.currentUser.uid,
          actorEmail: auth.currentUser.email,
          type: "ORDER",
          message: `Създадена поръчка за маса ${tableNumber || tableId}`,
          meta: { tableId, orderId }
        });
      }

      el("selectedOrderId").value = orderId;
      startOrderItemsListener(orderId);
    });
  });
}

function renderMenu() {
  const box = el("menuList");
  if (!box) return;

  const active = MENU.filter(m => m.active !== false);

  box.innerHTML = active.map(m => `
    <div style="padding:10px;border:1px solid #ddd;border-radius:10px;margin:8px 0;display:flex;justify-content:space-between;gap:10px;align-items:center;">
      <div>
        <b>${m.name}</b><br/>
        <small>${m.category || ""} • ${Number(m.price).toFixed(2)} EUR • ${m.station}</small>
      </div>
      <button class="addItemBtn"
              data-id="${m.id}"
              data-name="${encodeURIComponent(m.name)}"
              data-price="${m.price}"
              data-station="${m.station}"
              style="padding:8px 12px;border-radius:10px;border:1px solid #ccc;cursor:pointer;">
        + Add
      </button>
    </div>
  `).join("");

  box.querySelectorAll(".addItemBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tableId = el("selectedTableId").value;
      const orderId = el("selectedOrderId").value;

      if (!tableId || !orderId) {
        alert("Избери маса първо.");
        return;
      }

      const name = decodeURIComponent(btn.dataset.name);
      const price = Number(btn.dataset.price);
      const station = norm(btn.dataset.station);

      await addOrderItem(orderId, { name, price, qty: 1, station });

      await logAction({
        actorUid: auth.currentUser.uid,
        actorEmail: auth.currentUser.email,
        type: "ORDER",
        message: `Добавен артикул: ${name}`,
        meta: { tableId, orderId, name, price, station }
      });
    });
  });
}

function startOrderItemsListener(orderId) {
  if (unsubItems) unsubItems();
  unsubItems = watchOrderItems(orderId, (items) => renderOrderItems(items));
}

function renderOrderItems(items) {
  const box = el("orderItems");
  if (!box) return;

  if (!items.length) {
    box.innerHTML = "<i>Няма артикули още.</i>";
    return;
  }

  let total = 0;
  box.innerHTML = items.map(i => {
    const line = Number(i.price) * Number(i.qty);
    total += line;
    return `
      <div style="padding:10px;border:1px solid #eee;border-radius:10px;margin:8px 0;">
        <b>${i.name}</b> × ${i.qty}
        <div><small>${Number(i.price).toFixed(2)} EUR • ${i.station} • ${i.status}</small></div>
        <div><small>Ред: ${line.toFixed(2)} EUR</small></div>
      </div>
    `;
  }).join("") + `<div style="margin-top:10px;"><b>Общо: ${total.toFixed(2)} EUR</b></div>`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  mustHaveIds();

  // guard: трябва да си active waiter/manager (ако искаш само waiter: смени проверката)
  const me = await getEmployee(user.uid);
  if (!me || norm(me.status) !== "active") {
    window.location.href = "../Login/waiting-approval.html";
    return;
  }

  // tables live
  watchTables((list) => {
    TABLES = list;
    renderTables();
  });

  // menu live
  watchMenu((list) => {
    MENU = list;
    renderMenu();
  });
});
