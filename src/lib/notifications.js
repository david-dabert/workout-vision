/**
 * Push notification permission and weekly reminder scheduling.
 * Only shown after a user's FIRST successful analysis result — never at onboarding.
 */

const STORAGE_KEY = 'wv-notifications';
const SHOWN_KEY = 'wv-notif-prompt-shown';

/**
 * Request browser notification permission.
 * @returns {Promise<boolean>} true if permission granted
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Store the user's opt-in preference and mark the service worker as ready
 * to send weekly reminders. The actual scheduling is handled by the SW
 * (which can use periodic-background-sync or a push subscription if
 * a push server is wired up later). For now we persist the preference
 * so the SW can read it on activation.
 * @returns {Promise<void>}
 */
export async function scheduleWeeklyReminder() {
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  // Store preference in localStorage so the SW and future sessions can read it
  localStorage.setItem(STORAGE_KEY, 'enabled');
  // If Periodic Background Sync is available, register a weekly tag
  if (reg.periodicSync) {
    try {
      await reg.periodicSync.register('wv-weekly-reminder', {
        minInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    } catch {
      // periodicSync.register can throw if permission is denied or not supported
    }
  }
}

/**
 * Check whether the user has opted into notifications.
 * @returns {boolean}
 */
export function isNotificationEnabled() {
  return localStorage.getItem(STORAGE_KEY) === 'enabled';
}

/**
 * Check whether we have already shown the notification prompt to this user.
 * We show it exactly once, after their first successful analysis result.
 * @returns {boolean}
 */
export function hasShownNotificationPrompt() {
  return localStorage.getItem(SHOWN_KEY) === 'true';
}

/**
 * Mark the prompt as shown so it is never displayed again.
 */
export function markNotificationPromptShown() {
  localStorage.setItem(SHOWN_KEY, 'true');
}
