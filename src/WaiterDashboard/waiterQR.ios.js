(function () {
    if (!window.firebase) {
      const dbg = document.getElementById("debugBox");
      if (dbg) {
        dbg.style.display = "block";
        dbg.textContent = "❌ Firebase compat SDK not loaded";
      }
      return;
    }
  
    const db = window.db || firebase.firestore();
    const auth = firebase.auth();
  
    const scanStatusEl = document.getElementById("scanStatus");
    const decodedBox = document.getElementById("decodedBox");
    const tablesStatusEl = document.getElementById("tablesStatus");
    const tableSelect = document.getElementById("tableSelect");
  
    const metaEl = document.getElementById("meta");
    const itemsEl = document.getElementById("items");
    const totalEl = document.getElementById("total");
    const msgEl = document.getElementById("msg");
  
    const btnStart = document.getElementById("btnStart");
    const btnStop = document.getElementById("btnStop");
    const btnSend = document.getElementById("btnSend");
    const btnBack = document.getElementById("btnBack");
  
    const appBox = document.getElementById("appBox");
    const loginEmail = document.getElementById("loginEmail");
    const loginPass = document.getElementById("loginPass");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogout = document.getElementById("btnLogout");
    const authStatus = document.getElementById("authStatus");
  
    let scanner = null;
    let scannedOrder = null;
  
    function bindTap(el, fn) {
      if (!el) return;
      el.addEventListener("click", fn);
      el.addEventListener(
        "touchstart",
        function (e) {
          e.preventDefault();
          fn(e);
        },
        { passive: false }
      );
    }
  
    function esc(s) {
      return String(s ?? "").replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m]));
    }
  
    function fmtMoney(n) {
      const x = Number(n);
      return Number.isFinite(x) ? x.toFixed(2) : "0.00";
    }
  
    function safeTotal(x) {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    }
  
    function setStatus(text, cls) {
      scanStatusEl.textContent = text;
      scanStatusEl.className = cls || "muted";
    }
  
    function canSend() {
      return !!scannedOrder && !!tableSelect.value;
    }
  
    function updateSendButton() {
      btnSend.disabled = !canSend();
    }
  
    function renderOrder() {
      if (!scannedOrder) {
        metaEl.textContent = "Няма заредена поръчка.";
        itemsEl.innerHTML = "";
        totalEl.textContent = "";
        updateSendButton();
        return;
      }
  
      metaEl.innerHTML = `
        <div class="badge">Сканирана поръчка ✅</div>
        <div class="muted" style="margin-top:6px;">
          Бележка: ${esc(scannedOrder.note || "—")}
        </div>
      `;
  
      const items = Array.isArray(scannedOrder.items) ? scannedOrder.items : [];
  
      itemsEl.innerHTML = items.length
        ? items
            .map(
              (it) => `
            <div class="itemRow">
              <div>${esc(it.name)} × ${esc(it.qty)}</div>
              <div>${fmtMoney(it.price)} €</div>
            </div>
          `
            )
            .join("")
        : `<div class="muted">Няма items.</div>`;
  
      totalEl.textContent = `Общо (сканирано): ${fmtMoney(scannedOrder.total)} €`;
      updateSendButton();
    }
  
    async function loadTables() {
      try {
        tablesStatusEl.textContent = "Зареждам маси…";
  
        const snap = await db.collection("tables").get();
        const tables = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
        tableSelect.innerHTML = `<option value="">— избери маса —</option>`;
  
        tables.forEach((t) => {
          const opt = document.createElement("option");
          const n = t.number;
          const label = Number.isFinite(Number(n)) ? `Маса ${n}` : t.id;
          opt.value = String(t.id);
          opt.textContent = label;
          tableSelect.appendChild(opt);
        });
  
        tablesStatusEl.textContent = `(${tables.length}) ✅`;
      } catch (e) {
        console.error("loadTables error:", e);
        tablesStatusEl.textContent = "❌ tables не се заредиха";
        msgEl.textContent = "❌ tables error: " + (e?.message || e);
      }
    }
  
    function parseOrderFromQR(decodedText) {
      try {
        const obj = JSON.parse(decodedText);
        if (!obj || !obj.items) return null;
  
        return {
          note: obj.note || "",
          items: Array.isArray(obj.items) ? obj.items : [],
          total: safeTotal(obj.total),
          createdAtLocal: obj.createdAtLocal || new Date().toISOString(),
        };
      } catch {
        return null;
      }
    }
  
    function iosInlineVideoFix() {
      setTimeout(() => {
        document.querySelectorAll("video").forEach((v) => {
          v.setAttribute("playsinline", "true");
          v.setAttribute("webkit-playsinline", "true");
          v.muted = true;
        });
      }, 350);
    }
  
    async function startScanner() {
      msgEl.textContent = "";
      setStatus("Стартирам камера…", "muted");
  
      if (!window.Html5Qrcode) {
        setStatus("❌ Html5Qrcode липсва", "err");
        return;
      }
  
      try {
        if (scanner) {
          await scanner.stop().catch(() => {});
          await scanner.clear().catch(() => {});
          scanner = null;
        }
      } catch {}
  
      scanner = new Html5Qrcode("reader");
  
      btnStart.disabled = true;
      btnStop.disabled = false;
  
      const config = { fps: 10, qrbox: { width: 260, height: 260 } };
  
      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            decodedBox.textContent = decodedText || "(empty)";
            const parsed = parseOrderFromQR(decodedText);
  
            if (!parsed) {
              setStatus("❌ QR не е поръчка (JSON)", "err");
              return;
            }
  
            scannedOrder = parsed;
            setStatus("✅ Успешно сканирано!", "ok");
            renderOrder();
          },
          () => {}
        );
  
        iosInlineVideoFix();
      } catch (e) {
        console.error("camera error:", e);
        setStatus("❌ Камера: " + (e?.message || e), "err");
        btnStart.disabled = false;
        btnStop.disabled = true;
      }
    }
  
    async function stopScanner() {
      try {
        if (scanner) {
          await scanner.stop();
          await scanner.clear();
          scanner = null;
        }
      } catch {}
  
      btnStart.disabled = false;
      btnStop.disabled = true;
      setStatus("Спряна камера.", "muted");
    }
  
    // ✅ items нормализация
    function normalizeItems(arr) {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((x) => ({
          // ако имаш menuId в QR payload -> ще го ползва
          menuId: x?.menuId ? String(x.menuId) : "",
          name: String(x?.name ?? "").trim(),
          qty: Number(x?.qty ?? 1),
          price: Number(x?.price ?? 0),
        }))
        .filter((x) => x.name && Number.isFinite(x.qty) && x.qty > 0);
    }
  
    // ✅ merge ако има същото ястие -> qty++
    function mergeItems(existingItems, newItems) {
      const map = new Map();
  
      const makeKey = (it) => {
        // първо menuId (най-добре)
        if (it.menuId) return `id:${it.menuId}`;
        // fallback по име + цена
        return `name:${(it.name || "").toLowerCase()}|p:${Number(it.price || 0).toFixed(2)}`;
      };
  
      const pushItem = (it) => {
        const key = makeKey(it);
        if (!map.has(key)) {
          map.set(key, { ...it });
        } else {
          const old = map.get(key);
          old.qty = Number(old.qty || 0) + Number(it.qty || 0);
          map.set(key, old);
        }
      };
  
      normalizeItems(existingItems).forEach(pushItem);
      normalizeItems(newItems).forEach(pushItem);
  
      return Array.from(map.values());
    }
  
    function calcTotalFromItems(items) {
      return normalizeItems(items).reduce((sum, it) => {
        return sum + Number(it.qty || 0) * Number(it.price || 0);
      }, 0);
    }
  
    async function sendOrder() {
      try {
        if (!scannedOrder) {
          msgEl.textContent = "❌ Няма сканирана поръчка.";
          return;
        }
        if (!tableSelect.value) {
          msgEl.textContent = "❌ Избери маса.";
          return;
        }
  
        btnSend.disabled = true;
        msgEl.textContent = "Записвам поръчката…";
  
        const tableId = tableSelect.value;
        const scannedItems = normalizeItems(scannedOrder.items);
  
        const tableRef = db.collection("tables").doc(tableId);
        const tableSnap = await tableRef.get();
  
        if (!tableSnap.exists) {
          msgEl.textContent = "❌ Тази маса не съществува в базата.";
          btnSend.disabled = false;
          return;
        }
  
        const tableData = tableSnap.data() || {};
        const activeOrders = Array.isArray(tableData.activeOrders) ? tableData.activeOrders : [];
        const currentActiveOrderId = activeOrders.length ? String(activeOrders[0]) : "";
  
        // ✅ CASE A: има активна поръчка -> merge към нея
        if (currentActiveOrderId) {
          const orderRef = db.collection("orders").doc(currentActiveOrderId);
          const orderSnap = await orderRef.get();
  
          if (!orderSnap.exists) {
            // fallback: правим нова поръчка ако ID е счупен
            const newRef = await db.collection("orders").add({
              tableId,
              items: scannedItems,
              total: calcTotalFromItems(scannedItems),
              note: scannedOrder.note || "",
              status: "pending",
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdBy: auth.currentUser?.uid || "waiter_qr_scan",
            });
  
            await tableRef.update({
              status: "busy",
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              activeOrders: [newRef.id],
            });
  
            msgEl.textContent = "✅ Нямаше валиден активен order → създадох нов.";
            return;
          }
  
          const orderData = orderSnap.data() || {};
          const oldItems = Array.isArray(orderData.items) ? orderData.items : [];
  
          const mergedItems = mergeItems(oldItems, scannedItems);
          const newTotal = calcTotalFromItems(mergedItems);
  
          await orderRef.update({
            items: mergedItems,
            total: newTotal,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastScanAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
  
          await tableRef.update({
            status: "busy",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
  
          msgEl.textContent = `✅ Добавено към активната поръчка. Общо: ${fmtMoney(newTotal)} €`;
          return;
        }
  
        // ✅ CASE B: няма активна -> нов order
        const newOrderRef = await db.collection("orders").add({
          tableId,
          items: scannedItems,
          total: calcTotalFromItems(scannedItems),
          note: scannedOrder.note || "",
          status: "pending",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: auth.currentUser?.uid || "waiter_qr_scan",
        });
  
        await tableRef.update({
          status: "busy",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          activeOrders: [newOrderRef.id],
        });
  
        msgEl.textContent = `✅ Нова поръчка създадена: ${newOrderRef.id}`;
      } catch (e) {
        console.error("send order error:", e);
        msgEl.textContent = "❌ Грешка: " + (e?.message || e);
        btnSend.disabled = false;
      }
    }
  
    // events
    bindTap(btnStart, startScanner);
    bindTap(btnStop, stopScanner);
    bindTap(btnSend, sendOrder);
  
    btnBack?.addEventListener("click", () => history.back());
    tableSelect?.addEventListener("change", updateSendButton);
  
    // auth
    bindTap(btnLogin, async () => {
      try {
        msgEl.textContent = "";
        const email = (loginEmail.value || "").trim();
        const pass = (loginPass.value || "").trim();
  
        if (!email || !pass) {
          authStatus.textContent = "❌ Въведи email + password.";
          return;
        }
  
        authStatus.textContent = "Влизам…";
        await auth.signInWithEmailAndPassword(email, pass);
      } catch (e) {
        console.error("login error:", e);
        authStatus.textContent = "❌ Грешка вход: " + (e?.message || e);
      }
    });
  
    bindTap(btnLogout, async () => {
      try {
        await auth.signOut();
      } catch (e) {}
    });
  
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        authStatus.textContent = `✅ Логнат: ${user.email || user.uid}`;
        btnLogout.disabled = false;
        if (appBox) appBox.classList.remove("hide");
        await loadTables();
      } else {
        authStatus.textContent = "Не си логнат.";
        btnLogout.disabled = true;
        if (appBox) appBox.classList.add("hide");
  
        await stopScanner();
  
        scannedOrder = null;
        decodedBox.textContent = "(empty)";
        setStatus("Чакаме сканиране…", "muted");
        renderOrder();
  
        tableSelect.innerHTML = `<option value="">— избери маса —</option>`;
        tablesStatusEl.textContent = "";
      }
    });
  })();