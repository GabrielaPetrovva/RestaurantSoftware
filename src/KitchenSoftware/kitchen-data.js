// src/KitchenSoftware/kitchen-data.js
import { auth } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { watchStationQueue, setItemStatusByPath, logAction, getEmployee } from "../js/db.js";

const el = (id) => document.getElementById(id);
const norm = (x) => String(x ?? "").trim().toLowerCase();

function render(list) {
  const box = el("kitchenQueue");
  if (!box) return;

  if (!list.length) {
    box.innerHTML = "<i>Няма кухня поръчки.</i>";
    return;
  }

  box.innerHTML = list.map(i => `
    <div style="padding:12px;border:1px solid #ddd;border-radius:12px;margin:10px 0;">
      <div><b>${i.name}</b> × ${i.qty}</div>
      <div><small>${Number(i.price).toFixed(2)} EUR • status: ${i.status}</small></div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="stBtn" data-path="${i.path}" data-st="preparing">Preparing</button>
        <button class="stBtn" data-path="${i.path}" data-st="ready">Ready</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll(".stBtn").forEach(b => {
    b.addEventListener("click", async () => {
      const path = b.dataset.path;
      const st = b.dataset.st;
      await setItemStatusByPath(path, st);

      await logAction({
        actorUid: auth.currentUser.uid,
        actorEmail: auth.currentUser.email,
        type: "ORDER",
        message: `Kitchen status -> ${st}`,
        meta: { path, st }
      });
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const me = await getEmployee(user.uid);
  if (!me || norm(me.status) !== "active") {
    window.location.href = "../Login/waiting-approval.html";
    return;
  }

  watchStationQueue("kitchen", render);
});
