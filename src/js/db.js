// src/js/db.js
import { db } from "./firebase.js";
import { normalizeStationValue, looksLikeDrink } from "./station-utils.js";
import {
  collection, collectionGroup, doc,
  getDoc, getDocs,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const ts = () => serverTimestamp();
const norm = (x) => String(x ?? "").trim().toLowerCase();
const DRINK_CATEGORY_HINTS = ["drink", "drinks", "beverage", "beverages", "napit", "coffee", "tea", "bar"];

function resolveStationForWrite(item) {
  const direct = normalizeStationValue(item?.station || item?.department || "");
  if (direct) return direct;

  const category = norm(item?.category || item?.type || "");
  if (category) {
    const isDrinkCategory = DRINK_CATEGORY_HINTS.some((hint) => category.includes(hint));
    return isDrinkCategory ? "bar" : "kitchen";
  }

  const name = String(item?.name || item?.itemId || item?.menuId || "").trim();
  return looksLikeDrink(name) ? "bar" : "kitchen";
}

/* ---------------- LOGS ---------------- */
export async function logAction({ actorUid, actorEmail, type, message, meta = {} }) {
  // type: "EMPLOYEE" | "MENU" | "ORDER" | "SYSTEM"
  await addDoc(collection(db, "logs"), {
    actorUid: actorUid || null,
    actorEmail: actorEmail || null,
    type: type || "SYSTEM",
    message: message || "",
    meta: meta || {},
    createdAt: ts()
  });
}

export function watchLogs(cb, limit = 50) {
  const q = query(collection(db, "logs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.slice(0, limit).map(d => ({ id: d.id, ...d.data() }));
    cb(items);
  });
}

/* ---------------- EMPLOYEES ---------------- */
export async function getEmployee(uid) {
  const snap = await getDoc(doc(db, "employees", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function watchEmployees(cb) {
  const q = query(collection(db, "employees"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function setEmployeeRole(uid, role) {
  await updateDoc(doc(db, "employees", uid), { role: norm(role), updatedAt: ts() });
}
export async function setEmployeeStatus(uid, status) {
  await updateDoc(doc(db, "employees", uid), { status: norm(status), updatedAt: ts() });
}

/* ---------------- TABLES ---------------- */
export function watchTables(cb) {
  const q = query(collection(db, "tables"), orderBy("number", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function setTable(tableId, data) {
  await setDoc(doc(db, "tables", tableId), { ...data, updatedAt: ts() }, { merge: true });
}

/* ---------------- MENU ---------------- */
export async function upsertMenuItem(id, payload) {
  await setDoc(doc(db, "menus", id), { ...payload, updatedAt: ts() }, { merge: true });
}


// ✅ LIVE MENU
export function watchMenu(cb) {
  const q = query(collection(db, "menus"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(list);
  });
}

// ✅ ADD MENU ITEM
export async function addMenuItem(data) {
  const payload = {
    name: data.name || "",
    category: data.category || "",
    price: Number(data.price || 0),
    station: (data.station || "kitchen").toLowerCase(), // kitchen / bar
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "menus"), payload);
  return ref.id;
}

// ✅ UPDATE MENU ITEM
export async function updateMenuItem(id, data) {
  const payload = {
    ...data,
    price: data.price !== undefined ? Number(data.price) : undefined,
    station: data.station ? String(data.station).toLowerCase() : undefined,
    updatedAt: serverTimestamp()
  };

  // махаме undefined полета, за да не триеш случайно
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  await updateDoc(doc(db, "menus", id), payload);
}

// ✅ DELETE MENU ITEM (по желание)
export async function deleteMenuItem(id) {
  await deleteDoc(doc(db, "menus", id));
}




/* ---------------- ORDERS ---------------- */
// orders doc:
// { tableId, createdBy(waiter uid), status, createdAt, updatedAt }
// items: { name, price, qty, station, status, createdAt }

export function watchOrdersToday(cb) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, "orders"),
    where("createdAt", ">=", start),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function createOrder({ tableId, createdBy }) {
  const ref = await addDoc(collection(db, "orders"), {
    tableId,
    createdBy,
    status: "open",
    createdAt: ts(),
    updatedAt: ts()
  });

  await setTable(tableId, { status: "occupied", currentOrderId: ref.id });
  return ref.id;
}

export async function addOrderItem(orderId, item) {
  const menuId = String(item?.menuId || item?.itemId || "").trim();
  const itemId = String(item?.itemId || item?.menuId || "").trim();
  const name = String(item?.name || itemId || menuId || "Item").trim();
  const category = String(item?.category || "").trim();
  const station = resolveStationForWrite({ ...item, name, category, menuId, itemId });

  await addDoc(collection(db, "orders", orderId, "items"), {
    menuId,
    itemId,
    category,
    name,
    price: Number(item.price),
    qty: Number(item.qty),
    station,                        // kitchen | bar
    status: "new",                  // new | preparing | ready | served
    createdAt: ts()
  });

  await updateDoc(doc(db, "orders", orderId), { updatedAt: ts() });
}

export function watchOrderItems(orderId, cb) {
  const q = query(collection(db, "orders", orderId, "items"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }))));
}

function fsErrInfo(err) {
  return {
    code: err?.code ? String(err.code) : "",
    message: err?.message ? String(err.message) : String(err || "")
  };
}

function logFsError(tag, err, extra = {}) {
  const info = fsErrInfo(err);
  console.warn(`⚠️ ${tag}`, { ...info, ...extra, raw: err });
  return info;
}

export function watchStationQueue(station, cb, onError) {
  const stationName = norm(station);
  const activeStatuses = new Set(["new", "preparing", "ready"]);
  const queryHint = `collectionGroup(items) where station=="${stationName}" orderBy(createdAt asc)`;
  const q = query(
    collectionGroup(db, "items"),
    where("station", "==", stationName),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }))
        .filter((row) => activeStatuses.has(norm(row.status)));
      cb(rows);
    },
    (err) => {
      const info = logFsError(`watchStationQueue [station=${stationName}]`, err, {
        query: queryHint,
        collectionGroup: "items"
      });
      if (String(info.code || "").replace("firestore/", "") === "failed-precondition") {
        const idx = String(info.message || "").match(/https?:\/\/\S+/)?.[0] || "";
        console.warn("create index", idx || "Firestore -> Indexes (collectionGroup: items)");
      }
      if (typeof onError === "function") onError(err, info);
    }
  );
}

export function watchStationItems(station, cb, onError) {
  const stationName = norm(station);
  const queryHint = `collectionGroup(items) where station=="${stationName}" orderBy(createdAt desc)`;
  const q = query(
    collectionGroup(db, "items"),
    where("station", "==", stationName),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }))),
    (err) => {
      const info = logFsError(`watchStationItems [station=${stationName}]`, err, {
        query: queryHint,
        collectionGroup: "items"
      });
      if (String(info.code || "").replace("firestore/", "") === "failed-precondition") {
        const idx = String(info.message || "").match(/https?:\/\/\S+/)?.[0] || "";
        console.warn("create index", idx || "Firestore -> Indexes (collectionGroup: items)");
      }
      if (typeof onError === "function") onError(err, info);
    }
  );
}

export async function setItemStatusByPath(itemPath, status) {
  const st = norm(status);
  const payload = {
    status: st,
    updatedAt: ts()
  };

  if (st === "preparing") payload.startedAt = ts();
  if (st === "ready") payload.readyAt = ts();
  if (st === "served") payload.servedAt = ts();

  await updateDoc(doc(db, itemPath), payload);
}

/* --------- helper: compute totals by reading items (realtime by listeners in Manager) --------- */
export function sumItems(items) {
  return items.reduce((s, i) => s + (Number(i.price) * Number(i.qty)), 0);
}
export function countItemsByStatus(items, status) {
  return items.filter(i => norm(i.status) === norm(status)).length;
}
