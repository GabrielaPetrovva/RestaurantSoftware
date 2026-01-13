// src/ManagerDashboard/manage-data.js
import { watchTables, watchMenu, upsertMenuItem } from "../js/db.js";

const el = (id) => document.getElementById(id);

watchTables((tables) => {
  const box = el("mgrTables");
  if (!box) return;
  box.innerHTML = tables.map(t =>
    `• Маса ${t.number} — ${t.status || "free"} ${t.currentOrderId ? `(order: ${t.currentOrderId})` : ""}`
  ).join("<br>");
});

watchMenu((items) => {
  const box = el("mgrMenu");
  if (!box) return;
  box.innerHTML = items.map(m =>
    `• ${m.name} — ${Number(m.price).toFixed(2)} EUR — ${m.station} — ${m.active ? "ON" : "OFF"}`
  ).join("<br>");
});

// форма за добавяне/редакция на меню
window.saveMenuItem = async function (e) {
  e.preventDefault();
  const id = el("mi_id").value.trim() || crypto.randomUUID();
  const payload = {
    name: el("mi_name").value.trim(),
    price: Number(el("mi_price").value),
    category: el("mi_category").value.trim(),
    station: el("mi_station").value.trim().toLowerCase(), // kitchen|bar
    active: el("mi_active").checked
  };
  await upsertMenuItem(id, payload);
  alert("✅ Запазено меню.");
  e.target.reset();
};
// --- IGNORE ---