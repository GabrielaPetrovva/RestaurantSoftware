// src/js/db.js
import { db } from "./firebase.js";
import {
  collection, collectionGroup, doc,
  getDoc, getDocs,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ts = () => serverTimestamp();
const norm = (x) => String(x ?? "").trim().toLowerCase();

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
  await addDoc(collection(db, "orders", orderId, "items"), {
    name: item.name,
    price: Number(item.price),
    qty: Number(item.qty),
    station: norm(item.station),    // kitchen | bar
    status: "new",                  // new | preparing | ready | served
    createdAt: ts()
  });

  await updateDoc(doc(db, "orders", orderId), { updatedAt: ts() });
}

export function watchOrderItems(orderId, cb) {
  const q = query(collection(db, "orders", orderId, "items"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }))));
}

export function watchStationQueue(station, cb) {
  const q = query(
    collectionGroup(db, "items"),
    where("station", "==", norm(station)),
    where("status", "in", ["new", "preparing", "ready"]),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }))));
}

export async function setItemStatusByPath(itemPath, status) {
  await updateDoc(doc(db, itemPath), { status: norm(status) });
}

/* --------- helper: compute totals by reading items (realtime by listeners in Manager) --------- */
export function sumItems(items) {
  return items.reduce((s, i) => s + (Number(i.price) * Number(i.qty)), 0);
}
export function countItemsByStatus(items, status) {
  return items.filter(i => norm(i.status) === norm(status)).length;
}