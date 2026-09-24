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

/** Delete a client. */
export async function deleteClient(id) {
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
