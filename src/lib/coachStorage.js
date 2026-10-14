/**
 * Coach profile and client storage.
 * Uses localforage (IndexedDB) for on-device persistence.
 */

import localforage from 'localforage';

const coachStore = localforage.createInstance({ name: 'workoutVision', storeName: 'coach' });
const clientWorkoutStore = localforage.createInstance({ name: 'workoutVision', storeName: 'coachClientWorkouts' });

/**
 * @typedef {Object} CoachProfile
 * @property {string} name - Coach's full name
 * @property {string} [credentials] - Certifications, qualifications
 * @property {string} [email] - Contact email
 * @property {string} [phone] - Contact phone
 * @property {string} [gym] - Gym or studio name
 * @property {string} [logoDataUrl] - Base64 logo image (small, < 100KB)
 */

/**
 * @typedef {Object} ClientProfile
 * @property {string} id - Unique client ID
 * @property {string} name - Client's full name
 * @property {string} [email] - Client email
 * @property {string} [age] - Age or date of birth
 * @property {string} [sex] - male / female / other
 * @property {string} [weight] - Body weight with unit
 * @property {string} [height] - Height with unit
 * @property {string} [level] - beginner / intermediate / advanced
 * @property {string} [goals] - Training goals
 * @property {string} [notes] - Coach's notes about this client
 * @property {number} createdAt - Timestamp
 */

/** Save coach profile. */
export async function saveCoachProfile(profile) {
  await coachStore.setItem('coachProfile', profile);
}

/** Load coach profile. */
export async function getCoachProfile() {
  return coachStore.getItem('coachProfile');
}

/** Save a client. */
export async function saveClient(client) {
  if (!client.id) client.id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!client.createdAt) client.createdAt = Date.now();
  await coachStore.setItem(client.id, client);
  return client;
}

/** Get a single client by ID. */
export async function getClient(id) {
  return coachStore.getItem(id);
}

/** Get all clients. */
export async function getAllClients() {
  const clients = [];
  await coachStore.iterate((value, key) => {
    if (key.startsWith('client_')) clients.push(value);
  });
  return clients.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Delete a client and everything kept for them on this phone: the delivered sessions, the meals, the pack and the
 * links to sets (honesty pass of 14 October 2026, CLI-3: only the profile went, the health notes' sessions stayed).
 * The issued invoices stay: an invoice, once issued, is kept (its number is never reused).
 */
export async function deleteClient(id) {
  const drop = async (store, match) => {
    const keys = [];
    await store.iterate((value, key) => { if (match(value, key)) keys.push(key); });
    for (const k of keys) await store.removeItem(k);
  };
  await drop(clientSessionStore, v => v?.clientId === id);
  await drop(clientMealStore, v => v?.clientId === id);
  await drop(clientWorkoutStore, v => v?.clientId === id);
  await coachStore.removeItem(`carnet_${id}`);
  await coachStore.removeItem(id);
}

// ---------------------------------------------------------------------------
// Client-workout associations
// ---------------------------------------------------------------------------

/**
 * Associate a workout with a client.
 * @param {string} clientId
 * @param {string} workoutId
 */
export async function saveClientWorkout(clientId, workoutId) {
  const key = `${clientId}__${workoutId}`;
  await clientWorkoutStore.setItem(key, { clientId, workoutId, addedAt: Date.now() });
}

/**
 * Get all workout IDs associated with a client.
 * @param {string} clientId
 * @returns {Promise<string[]>} workout IDs
 */
export async function getClientWorkouts(clientId) {
  const workoutIds = [];
  await clientWorkoutStore.iterate((value) => {
    if (value.clientId === clientId) {
      workoutIds.push(value.workoutId);
    }
  });
  return workoutIds;
}

/**
 * Remove a client-workout association.
 * @param {string} clientId
 * @param {string} workoutId
 */
export async function removeClientWorkout(clientId, workoutId) {
  const key = `${clientId}__${workoutId}`;
  await clientWorkoutStore.removeItem(key);
}

// ---------------------------------------------------------------------------
// Client Session Tracking & Carnet (10-Pack) Credits
// ---------------------------------------------------------------------------
const clientSessionStore = localforage.createInstance({ name: 'workoutVision', storeName: 'coachClientSessions' });
const clientMealStore = localforage.createInstance({ name: 'workoutVision', storeName: 'coachClientMeals' });
const livreRecettesStore = localforage.createInstance({ name: 'workoutVision', storeName: 'coachLivreRecettes' });

/**
 * Log a personal training session for a client.
 * @param {string} clientId
 * @param {{ date: string, type: string, durationMin: number, notes?: string, coachRating?: number }} session
 */
export async function logClientSession(clientId, session) {
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item = { id, clientId, timestamp: Date.now(), ...session };
  await clientSessionStore.setItem(id, item);
  return item;
}

/**
 * Get all sessions delivered to a client, sorted chronologically descending.
 * @param {string} clientId
 */
export async function getClientSessions(clientId) {
  const sessions = [];
  await clientSessionStore.iterate((value) => {
    if (value.clientId === clientId) {
      sessions.push(value);
    }
  });
  return sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Save client carnet (session pack credits).
 * @param {string} clientId
 * @param {{ totalPurchased: number, completedCount: number, pricePerPack: number }} carnet
 */
export async function saveClientCarnet(clientId, carnet) {
  await coachStore.setItem(`carnet_${clientId}`, carnet);
}

/**
 * Get client carnet, or null when the coach has recorded no purchase: no pack is assumed (CLI-1: every client was
 * given a pack of 10 sessions at 500 € that no one bought).
 * @param {string} clientId
 * @returns {Promise<null | { totalPurchased: number, completedCount: number, pricePerPack?: number, boughtOn?: string }>}
 */
export async function getClientCarnet(clientId) {
  const c = await coachStore.getItem(`carnet_${clientId}`);
  return c && Number(c.totalPurchased) > 0 ? c : null;
}

// ---------------------------------------------------------------------------
// Client Nutrition & Meal Logging
// ---------------------------------------------------------------------------

/**
 * Log a meal entry (Vision Plate or Barcode) for a client.
 * @param {string} clientId
 * @param {object} mealEntry
 */
export async function logClientMeal(clientId, mealEntry) {
  const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item = { id, clientId, timestamp: Date.now(), ...mealEntry };
  await clientMealStore.setItem(id, item);
  return item;
}

/**
 * Get all logged meals for a client.
 * @param {string} clientId
 */
export async function getClientMeals(clientId) {
  const meals = [];
  await clientMealStore.iterate((value) => {
    if (value.clientId === clientId) {
      meals.push(value);
    }
  });
  return meals.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// ---------------------------------------------------------------------------
// Invoices and the receipts book (honesty pass of 14 October 2026, INV-3 and INV-6)
// ---------------------------------------------------------------------------

const invoiceStore = localforage.createInstance({ name: 'workoutVision', storeName: 'coachInvoices' });

/**
 * The next invoice number of the year, F-2026-0001, F-2026-0002…: a counter kept on this phone, taken once and never
 * given again, even if the invoice is later cancelled. The old number was the year and four letters of the client's ID:
 * the same for every invoice to that client.
 */
export async function issueInvoiceNumber(year = new Date().getFullYear()) {
  const key = `invoiceCounter_${year}`;
  const n = (Number(await coachStore.getItem(key)) || 0) + 1;
  await coachStore.setItem(key, n);
  return `F-${year}-${String(n).padStart(4, '0')}`;
}

/** Keep an issued invoice, under its number (unique by issueInvoiceNumber). */
export async function saveIssuedInvoice(invoice) {
  await invoiceStore.setItem(invoice.number, { ...invoice, savedAt: Date.now() });
  return invoice;
}

/** The issued invoices, the latest first. */
export async function getIssuedInvoices() {
  const out = [];
  await invoiceStore.iterate(v => { out.push(v); });
  return out.sort((a, b) => String(b.number).localeCompare(String(a.number)));
}

/** Record that an issued invoice was paid: the day and the way. Only then does it enter the receipts book. */
export async function markInvoicePaid(number, { paidOn, mode }) {
  const inv = await invoiceStore.getItem(number);
  if (!inv) return null;
  const next = { ...inv, paid: { paidOn, mode } };
  await invoiceStore.setItem(number, next);
  return next;
}

/**
 * The rows written by the first version of the receipts book (before 14 October 2026), when an invoice was created
 * rather than paid, under numbers that could repeat: read only, so the coach can check them; never exported.
 */
export async function getLegacyReceiptRows() {
  const entries = [];
  await livreRecettesStore.iterate((value) => {
    entries.push(value);
  });
  return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
