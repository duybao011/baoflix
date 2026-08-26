"use client";

const ACTIVE_USER_KEY = "baoflix_active_sync_user_v1";
const SNAPSHOT_PREFIX = "baoflix_account_snapshot_v1:";
const ANONYMOUS_SCOPE = "anonymous";

const PERSONAL_KEYS = [
  "baoflix_history",
  "baoflix_history_tombstones_v1",
  "baoflix_watched_episodes",
  "baoflix_video_progress_v1",
  "baoflix_custom_movies",
  "baoflix_custom_movies_pending_deletes",
] as const;

type Snapshot = Record<string, string>;

function snapshotKey(scopeId: string) {
  return `${SNAPSHOT_PREFIX}${scopeId}`;
}

function readSnapshot(scopeId: string): Snapshot {
  try {
    const raw = localStorage.getItem(snapshotKey(scopeId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Snapshot)
      : {};
  } catch {
    return {};
  }
}

function isPersonalKey(key: string) {
  return (
    (PERSONAL_KEYS as readonly string[]).includes(key) ||
    key.startsWith("baoflix_custom_watch_time_") ||
    key.endsWith(":subtitle-choice") ||
    key.endsWith(":iframe-estimate")
  );
}

function getPersonalKeysInStorage() {
  const keys = new Set<string>(PERSONAL_KEYS as readonly string[]);

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && isPersonalKey(key)) keys.add(key);
  }

  return Array.from(keys);
}

function saveCurrentScope(scopeId: string) {
  const snapshot: Snapshot = {};

  getPersonalKeysInStorage().forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) snapshot[key] = value;
  });

  localStorage.setItem(snapshotKey(scopeId), JSON.stringify(snapshot));
}

function clearPersonalKeys() {
  getPersonalKeysInStorage().forEach((key) => localStorage.removeItem(key));
}

function restoreScope(scopeId: string) {
  const snapshot = readSnapshot(scopeId);
  clearPersonalKeys();

  Object.entries(snapshot).forEach(([key, value]) => {
    if (isPersonalKey(key)) localStorage.setItem(key, value);
  });
}

function notifyScopeChanged() {
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event("baoflix-watch-store-change"));
  window.dispatchEvent(new Event("baoflix-custom-movies-synced"));
}

export function ensureLocalStateForUser(userId: string) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return false;

  const activeUser = localStorage.getItem(ACTIVE_USER_KEY);

  // Lần đầu sau khi nâng cấp: giữ nguyên dữ liệu local hiện tại và gán cho user đang đăng nhập.
  if (!activeUser) {
    localStorage.setItem(ACTIVE_USER_KEY, cleanUserId);
    saveCurrentScope(cleanUserId);
    return false;
  }

  if (activeUser === cleanUserId) return false;

  saveCurrentScope(activeUser);
  restoreScope(cleanUserId);
  localStorage.setItem(ACTIVE_USER_KEY, cleanUserId);
  notifyScopeChanged();
  return true;
}

export function switchLocalStateToAnonymous() {
  const activeUser = localStorage.getItem(ACTIVE_USER_KEY);
  if (!activeUser) return false;

  saveCurrentScope(activeUser);
  restoreScope(ANONYMOUS_SCOPE);
  localStorage.setItem(ACTIVE_USER_KEY, ANONYMOUS_SCOPE);
  notifyScopeChanged();
  return true;
}
