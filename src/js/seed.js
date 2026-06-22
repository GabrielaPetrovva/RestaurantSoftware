// src/js/seed.js
import { db } from "./firebase.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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
    { id: "pizza_marg", name: "Пица Маргарита", nameEn: "Margherita Pizza", descriptionEn: "Classic pizza with tomato sauce, mozzarella and basil.", price: 12.00, category: "Храна", station: "kitchen", active: true },
    { id: "spaghetti", name: "Спагети Карбонара", nameEn: "Spaghetti Carbonara", descriptionEn: "Classic spaghetti carbonara with creamy sauce.", price: 13.50, category: "Храна", station: "kitchen", active: true },
    { id: "cola", name: "Кола 330мл", nameEn: "Cola 330 ml", descriptionEn: "Chilled cola soft drink.", price: 3.50, category: "Напитки", station: "bar", active: true },
    { id: "beer", name: "Бира", nameEn: "Beer", descriptionEn: "Chilled beer.", price: 4.00, category: "Напитки", station: "bar", active: true },
  ];

  for (const m of menu) {
    await setDoc(doc(db, "menu", m.id), m, { merge: true });
  }

  alert("✅ Seed готов: tables + menu");
}
// --- IGNORE ---
