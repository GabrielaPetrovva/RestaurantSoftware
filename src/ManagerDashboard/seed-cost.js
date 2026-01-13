import { db } from "../js/firebase.js";
import {
  collection,
  getDocs,
  doc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Масово попълване на cost:
 * - за документи в "menus" без валиден cost
 * - cost = price * ratio (по default 0.6)
 */
export async function seedCosts({ ratio = 0.6, force = false } = {}) {
  const snap = await getDocs(collection(db, "menus"));

  const batch = writeBatch(db);
  let updated = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    const data = d.data();

    const price = Number(data.price);
    const currentCost = Number(data.cost);

    const hasValidCost = Number.isFinite(currentCost) && currentCost >= 0;
    const hasValidPrice = Number.isFinite(price) && price > 0;

    // ако няма цена - пропускаме
    if (!hasValidPrice) {
      skipped++;
      continue;
    }

    // ако има cost и не force - пропускаме
    if (hasValidCost && !force) {
      skipped++;
      continue;
    }

    const cost = Number((price * ratio).toFixed(2));

    batch.update(doc(db, "menus", d.id), {
      cost,
      costAuto: true,
      costAutoRatio: ratio
    });

    updated++;
  }

  if (updated === 0) {
    console.log("✅ Няма какво да се обновява. skipped:", skipped);
    return { updated, skipped };
  }

  // Firestore batch limit = 500. Ти имаш ~112 → ок.
  await batch.commit();

  console.log(`✅ Готово! updated: ${updated}, skipped: ${skipped}, ratio: ${ratio}`);
  return { updated, skipped };
}
