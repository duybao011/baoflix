const TV_SESSION_KEY = "baoflix_tv_mode";
const TV_FOCUS_MEMORY_KEY = "baoflix_tv_focus_memory_v1";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type TvFocusMemoryRecord = {
  focusKey: string;
  index: number;
  scrollY: number;
  updatedAt: number;
};

type TvFocusMemoryMap = Record<string, TvFocusMemoryRecord>;

type RestoreOptions = {
  allowIndexFallback?: boolean;
};

export function isTvFocusMemoryEnabled() {
  if (typeof window === "undefined") return false;

  try {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("tv") === "0") return false;
    if (searchParams.get("tv") === "1") return true;

    return sessionStorage.getItem(TV_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function getTvFocusRouteKey() {
  if (typeof window === "undefined") return "";

  return `${window.location.pathname}${window.location.search}`;
}

function readMemoryMap(): TvFocusMemoryMap {
  try {
    const raw = sessionStorage.getItem(TV_FOCUS_MEMORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMemoryMap(memoryMap: TvFocusMemoryMap) {
  try {
    sessionStorage.setItem(TV_FOCUS_MEMORY_KEY, JSON.stringify(memoryMap));
  } catch {
    // Bỏ qua nếu WebView/browser chặn sessionStorage.
  }
}

function normalizeText(text?: string | null) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s/_?=&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function isVisibleTvElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  if (element.getAttribute("aria-hidden") === "true") return false;
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  if (rect.width < 2 || rect.height < 2) return false;

  return true;
}

export function getTvFocusableElements(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(isVisibleTvElement)
    .filter((element) => element.tabIndex !== -1)
    .filter((element) => !element.hasAttribute("data-tv-skip"));
}

export function findClosestTvFocusableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;

  const focusable = target.closest<HTMLElement>(FOCUSABLE_SELECTOR);

  if (!focusable) return null;
  if (focusable.tabIndex === -1) return null;
  if (focusable.hasAttribute("data-tv-skip")) return null;
  if (!isVisibleTvElement(focusable)) return null;

  return focusable;
}

function getHrefKey(element: HTMLElement) {
  if (!(element instanceof HTMLAnchorElement)) return "";

  try {
    const url = new URL(element.href, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return element.getAttribute("href") || "";
  }
}

export function getTvFocusKey(element: HTMLElement) {
  const explicitElement = element.closest<HTMLElement>("[data-tv-focus-id]");
  const explicitId = explicitElement?.dataset.tvFocusId;

  if (explicitId) return `id:${explicitId}`;

  const hrefKey = getHrefKey(element);

  if (hrefKey) return `href:${hrefKey}`;

  const ariaLabel = element.getAttribute("aria-label");

  if (ariaLabel) return `aria:${normalizeText(ariaLabel)}`;

  const text = normalizeText(element.textContent);

  if (text) {
    return `${element.tagName.toLowerCase()}:${text}`;
  }

  return "";
}

export function rememberTvFocusFromElement(
  element: HTMLElement | null | undefined,
  routeKey = getTvFocusRouteKey()
) {
  if (!element || !routeKey || !isTvFocusMemoryEnabled()) return;
  if (!isVisibleTvElement(element)) return;
  if (element.hasAttribute("data-tv-skip")) return;

  const scope =
    element.closest<HTMLElement>("[data-tv-scope]") ||
    document.querySelector<HTMLElement>("main [data-tv-scope]") ||
    document;

  const focusables = getTvFocusableElements(scope);
  const index = focusables.indexOf(element);
  const focusKey = getTvFocusKey(element);

  if (!focusKey) return;

  const memoryMap = readMemoryMap();

  memoryMap[routeKey] = {
    focusKey,
    index: index >= 0 ? index : 0,
    scrollY: window.scrollY,
    updatedAt: Date.now(),
  };

  writeMemoryMap(memoryMap);
}

function focusTvElement(element: HTMLElement) {
  element.focus({
    preventScroll: true,
  });

  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
}

export function restoreLastTvFocus(
  scope: HTMLElement,
  routeKey = getTvFocusRouteKey(),
  options: RestoreOptions = {}
) {
  if (!routeKey || !isTvFocusMemoryEnabled()) return false;

  const memoryMap = readMemoryMap();
  const record = memoryMap[routeKey];

  if (!record) return false;

  const focusables = getTvFocusableElements(scope);

  if (!focusables.length) return false;

  const byKey = focusables.find((element) => {
    return getTvFocusKey(element) === record.focusKey;
  });

  if (byKey && isVisibleTvElement(byKey)) {
    focusTvElement(byKey);
    return true;
  }

  if (options.allowIndexFallback === false) {
    return false;
  }

  const byIndex = focusables[record.index];

  if (byIndex && isVisibleTvElement(byIndex)) {
    focusTvElement(byIndex);
    return true;
  }

  return false;
}
