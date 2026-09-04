/**
 * Logger — Structured logging with 200-event ring buffer.
 *
 * Stores the last 200 log events in memory and periodically flushes
 * to IndexedDB via localforage for post-session debugging.
 *
 * Levels: debug, info, warn, error.
 * Each entry: { ts, level, module, message, data? }
 */

import localforage from 'localforage';

const MAX_RING_SIZE = 200;
const FLUSH_INTERVAL_MS = 30_000; // flush to IndexedDB every 30s
const STORAGE_KEY = 'wv_log_ring';

class LoggerImpl {
  constructor() {
    this._ring = [];
    this._flushTimer = null;
    this._flushing = false;
  }

  _push(level, module, message, data) {
    const entry = {
      ts: Date.now(),
      level,
      module,
      message,
      ...(data !== undefined && { data }),
    };

    this._ring.push(entry);
    if (this._ring.length > MAX_RING_SIZE) {
      this._ring.shift();
    }

    // Start periodic flush on first log
    if (!this._flushTimer) {
      this._flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  debug(module, message, data) { this._push('debug', module, message, data); }
  info(module, message, data)  { this._push('info', module, message, data); }
  warn(module, message, data)  { this._push('warn', module, message, data); }
  error(module, message, data) { this._push('error', module, message, data); }

  /**
   * Get the current ring buffer contents.
   * @param {string} [level] - Optional filter by level
   * @returns {Array} Log entries
   */
  getEntries(level) {
    if (level) return this._ring.filter(e => e.level === level);
    return [...this._ring];
  }

  /**
   * Flush current ring buffer to IndexedDB.
   */
  async flush() {
    if (this._flushing || this._ring.length === 0) return;
    this._flushing = true;
    try {
      const snapshot = [...this._ring];
      await localforage.setItem(STORAGE_KEY, snapshot);
    } catch (_) {
      // IndexedDB may be unavailable; ring buffer still works in-memory
    } finally {
      this._flushing = false;
    }
  }

  /**
   * Load previously persisted log entries from IndexedDB.
   * @returns {Promise<Array>}
   */
  async loadPersisted() {
    try {
      return (await localforage.getItem(STORAGE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Clear the ring buffer and persisted storage.
   */
  async clear() {
    this._ring = [];
    try {
      await localforage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  /**
   * Stop the flush timer (call on app unmount).
   */
  dispose() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    this.flush(); // final flush
  }
}

/** Singleton logger instance */
export const Logger = new LoggerImpl();
