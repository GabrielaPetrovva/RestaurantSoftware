// src/js/seed.js
import { db } from "./firebase.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function seedTablesAndMenu() {
  // Tables 1..10
  for (let i = 1; i <= 10; i++) {
    await setDoc(doc(db, "tables", String(i)), {
      number: i,
      status: "free",
      currentOrderId: null
    }, { merge: true });
  }

  // Menu пример
  const menu = [
    { id: "pizza_marg", name: "Пица Маргарита", price: 12.00, category: "Храна", station: "kitchen", active: true },
    { id: "spaghetti", name: "Спагети Карбонара", price: 13.50, category: "Храна", station: "kitchen", active: true },
    { id: "cola", name: "Кола 330мл", price: 3.50, category: "Напитки", station: "bar", active: true },
    { id: "beer", name: "Бира", price: 4.00, category: "Напитки", station: "bar", active: true },
  ];

  for (const m of menu) {
    await setDoc(doc(db, "menu", m.id), m, { merge: true });
  }

  alert("✅ Seed готов: tables + menu");
}
// --- IGNORE ---