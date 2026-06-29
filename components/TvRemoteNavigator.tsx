"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type Direction = "up" | "down" | "left" | "right";
type SeekDirection = "backward" | "forward";

type FocusEntry = {
  element: HTMLElement;
  rect: DOMRect;
};

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";
type OverlayCommandAction = "peek" | "hide" | "open-episodes" | "open-sources" | "close-panel" | "activity";

const ROW_THRESHOLD = 22;
const TV_SESSION_KEY = "baoflix_tv_mode";
const SEEK_SECONDS = 10;
const FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";

function getUserAgent() {
  if (typeof navigator === "undefined") return "";

  return navigator.userAgent.toLowerCase();
}

function isTvUserAgent() {
  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(
    getUserAgent()
  );
}

function isTvRemoteEnabled() {
  if (typeof window === "undefined") return false;

  try {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("tv") === "0") return false;
    if (searchParams.get("tv") === "1") return true;
    if (isTvUserAgent()) return true;

    return sessionStorage.getItem(TV_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function getDirectionFromEvent(event: KeyboardEvent): Direction | null {
  if (event.key === "ArrowUp" || event.keyCode === 19) return "up";
  if (event.key === "ArrowDown" || event.keyCode === 20) return "down";
  if (event.key === "ArrowLeft" || event.keyCode === 21) return "left";
  if (event.key === "ArrowRight" || event.keyCode === 22) return "right";

  return null;
}

function isActivationKey(event: KeyboardEvent) {
  return (
    event.key === "Enter" ||
    event.key === "NumpadEnter" ||
    event.key === " " ||
    event.key === "Spacebar" ||
    event.key === "OK" ||
    event.key === "Accept" ||
    event.keyCode === 13 ||
    event.keyCode === 23 ||
    event.keyCode === 66
  );
}

function isBackKey(event: KeyboardEvent) {
  return (
    event.key === "Escape" ||
    event.key === "Backspace" ||
    event.key === "BrowserBack" ||
    event.key === "Back" ||
    event.key === "GoBack" ||
    event.key === "Cancel" ||
    event.key === "XF86Back" ||
    event.keyCode === 4 ||
    event.keyCode === 461 ||
    event.keyCode === 10009
  );
}

function isSeekBackwardKey(event: KeyboardEvent) {
  return event.key === "MediaRewind" || event.keyCode === 89;
}

function isSeekForwardKey(event: KeyboardEvent) {
  return event.key === "MediaFastForward" || event.keyCode === 90;
}

function isPlayPauseKey(event: KeyboardEvent) {
  return (
    event.key === "MediaPlayPause" ||
    event.key === "Play" ||
    event.key === "Pause" ||
    event.keyCode === 85 ||
    event.keyCode === 126 ||
    event.keyCode === 127
  );
}

function isWatchPath(path: string) {
  return /^\/xem\/[^/?#]+/.test(path) || /^\/ca-nhan\/[^/]+\/xem/.test(path);
}

function getHiddenWatchOverlay() {
  return document.querySelector<HTMLElement>(
    "[data-tv-overlay='watch'][data-tv-overlay-visible='false']"
  );
}

function getVisibleWatchOverlay() {
  return document.querySelector<HTMLElement>(
    "[data-tv-overlay='watch'][data-tv-overlay-visible='true']"
  );
}

function isOverlayPanelOpen(overlay: HTMLElement | null) {
  return overlay?.dataset.tvOverlayMode === "panel" || Boolean(overlay?.dataset.tvOverlayPanel);
}

function isTextInput(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();

  return (
    tagName === "input" || tagName === "textarea" || element.isContentEditable
  );
}

function shouldLetInputHandleKey(element: Element | null, event: KeyboardEvent) {
  if (!isTextInput(element)) return false;

  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}

function isVisibleElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  if (element.getAttribute("aria-hidden") === "true") return false;
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  if (rect.width < 2 || rect.height < 2) return false;

  return true;
}

function getFocusableElements(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(isVisibleElement)
    .filter((element) => element.tabIndex !== -1)
    .filter((element) => !element.hasAttribute("data-tv-skip"));
}

function getActiveScope(element: Element | null) {
  if (!(element instanceof HTMLElement)) return null;

  return element.closest<HTMLElement>("[data-tv-scope]");
}

function getMainScope() {
  return document.querySelector<HTMLElement>("main [data-tv-scope]");
}

function getModalScope() {
  const modals = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tv-modal][data-tv-scope]")
  ).filter(isVisibleElement);

  return modals[modals.length - 1] || null;
}

function getDefaultFocusable(root: ParentNode) {
  const defaultElement =
    root instanceof HTMLElement
      ? root.querySelector<HTMLElement>("[data-tv-default], [data-tv-overlay-default]")
      : document.querySelector<HTMLElement>("[data-tv-default], [data-tv-overlay-default]");

  if (defaultElement && isVisibleElement(defaultElement)) {
    return defaultElement;
  }

  return getFocusableElements(root)[0] || null;
}

function getOverlayDefaultFocusable(overlay: HTMLElement) {
  return (
    overlay.querySelector<HTMLElement>("[data-tv-overlay-default]") ||
    overlay.querySelector<HTMLElement>("a[href], button:not([disabled])")
  );
}

function getOverlaySeekFocusable(
  overlay: HTMLElement,
  direction: SeekDirection
) {
  return (
    overlay.querySelector<HTMLElement>(`[data-tv-seek='${direction}']`) ||
    getOverlayDefaultFocusable(overlay)
  );
}

function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");

  return getDefaultFocusable(scope || main || document);
}

function buildRectRows(elements: HTMLElement[]) {
  const entries: FocusEntry[] = elements
    .map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
    }))
    .sort((a, b) => {
      if (Math.abs(a.rect.top - b.rect.top) > ROW_THRESHOLD) {
        return a.rect.top - b.rect.top;
      }

      return a.rect.left - b.rect.left;
    });

  const rows: FocusEntry[][] = [];

  entries.forEach((entry) => {
    const lastRow = rows[rows.length - 1];

    if (!lastRow) {
      rows.push([entry]);
      return;
    }

    const rowTop = lastRow[0].rect.top;

    if (Math.abs(entry.rect.top - rowTop) <= ROW_THRESHOLD) {
      lastRow.push(entry);
    } else {
      rows.push([entry]);
    }
  });

  rows.forEach((row) => {
    row.sort((a, b) => a.rect.left - b.rect.left);
  });

  return rows;
}

function buildRows(root: ParentNode, elements: HTMLElement[]) {
  const explicitRowElements =
    root instanceof HTMLElement
      ? Array.from(root.querySelectorAll<HTMLElement>("[data-tv-row]")).filter(
          isVisibleElement
        )
      : [];

  if (!explicitRowElements.length) {
    return buildRectRows(elements);
  }

  const explicitRows = explicitRowElements
    .map((rowElement) =>
      getFocusableElements(rowElement).map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
      }))
    )
    .filter((row) => row.length > 0);

  const elementsInsideExplicitRows = new Set<HTMLElement>();

  explicitRows.forEach((row) => {
    row.forEach((entry) => {
      elementsInsideExplicitRows.add(entry.element);
    });
  });

  const outsideElements = elements.filter(
    (element) => !elementsInsideExplicitRows.has(element)
  );

  return [...explicitRows, ...buildRectRows(outsideElements)];
}

function getClosestByHorizontalCenter(row: FocusEntry[], currentRect: DOMRect) {
  const currentCenter = currentRect.left + currentRect.width / 2;

  return row.reduce<FocusEntry | null>((best, entry) => {
    if (!best) return entry;

    const bestCenter = best.rect.left + best.rect.width / 2;
    const entryCenter = entry.rect.left + entry.rect.width / 2;

    return Math.abs(entryCenter - currentCenter) <
      Math.abs(bestCenter - currentCenter)
      ? entry
      : best;
  }, null)?.element || null;
}

function findRowIndex(rows: FocusEntry[][], current: HTMLElement) {
  let rowIndex = -1;
  let itemIndex = -1;

  rows.some((row, currentRowIndex) => {
    const foundIndex = row.findIndex((entry) => entry.element === current);

    if (foundIndex >= 0) {
      rowIndex = currentRowIndex;
      itemIndex = foundIndex;
      return true;
    }

    return false;
  });

  return { rowIndex, itemIndex };
}

function getLinearCandidate(
  current: HTMLElement,
  root: ParentNode,
  elements: HTMLElement[],
  direction: Direction
) {
  const rows = buildRows(root, elements);
  const { rowIndex, itemIndex } = findRowIndex(rows, current);

  if (rowIndex < 0 || itemIndex < 0) {
    return elements[0] || null;
  }

  const currentRow = rows[rowIndex];
  const previousRow = rows[rowIndex - 1];
  const nextRow = rows[rowIndex + 1];
  const currentEntry = currentRow[itemIndex];
  const rowContainer = current.closest<HTMLElement>("[data-tv-row]");
  const shouldWrap = rowContainer?.dataset.tvRowWrap === "true";

  if (direction === "right") {
    return currentRow[itemIndex + 1]?.element || (shouldWrap ? currentRow[0]?.element : current);
  }

  if (direction === "left") {
    return currentRow[itemIndex - 1]?.element || (shouldWrap ? currentRow[currentRow.length - 1]?.element : current);
  }

  if (direction === "down") {
    return nextRow ? getClosestByHorizontalCenter(nextRow, currentEntry.rect) : current;
  }

  if (direction === "up") {
    return previousRow
      ? getClosestByHorizontalCenter(previousRow, currentEntry.rect)
      : current;
  }

  return null;
}

function getFocusMemoryValue(element: HTMLElement) {
  const dataKey = element.getAttribute("data-tv-focus-key");
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") : "";

  if (dataKey) return `data:${dataKey}`;
  if (href) return `href:${href}`;

  return "";
}

function rememberFocus(pathname: string, element: HTMLElement) {
  const value = getFocusMemoryValue(element);

  if (!value) return;

  try {
    sessionStorage.setItem(`${FOCUS_MEMORY_PREFIX}${pathname}`, value);
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }

  return value.replace(/"/g, '\\"');
}

function restoreFocus(pathname: string) {
  try {
    const value = sessionStorage.getItem(`${FOCUS_MEMORY_PREFIX}${pathname}`);

    if (!value) return false;

    let target: HTMLElement | null = null;

    if (value.startsWith("href:")) {
      const href = value.slice(5);
      target = document.querySelector<HTMLElement>(`a[href="${cssEscape(href)}"]`);
    } else if (value.startsWith("data:")) {
      const key = value.slice(5);
      target = document.querySelector<HTMLElement>(`[data-tv-focus-key="${cssEscape(key)}"]`);
    }

    if (!target || !isVisibleElement(target)) return false;

    focusElement(target, pathname);
    return true;
  } catch {
    return false;
  }
}

function focusElement(element: HTMLElement, pathname?: string) {
  element.focus({
    preventScroll: true,
  });

  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });

  if (pathname) {
    rememberFocus(pathname, element);
  }
}

function dispatchOverlayCommand(action: OverlayCommandAction, options?: { focus?: boolean }) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-overlay-command", {
      detail: {
        action,
        focus: options?.focus,
      },
    })
  );
}

function dispatchOverlayActivity() {
  dispatchOverlayCommand("activity");
}

function dispatchPlayerCommand(action: PlayerCommandAction, seconds?: number) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-player-command", {
      detail: {
        action,
        seconds,
        handled: false,
      },
    })
  );
}

function focusOverlaySeekButton(direction: SeekDirection, pathname: string) {
  window.setTimeout(() => {
    const overlay = getVisibleWatchOverlay();

    if (!overlay) return;

    const target = getOverlaySeekFocusable(overlay, direction);

    if (!target) return;

    focusElement(target, pathname);
  }, 60);
}

function clickActiveElement(event: KeyboardEvent) {
  const active = document.activeElement;

  if (
    active instanceof HTMLAnchorElement ||
    active instanceof HTMLButtonElement
  ) {
    event.preventDefault();
    active.click();
  }
}

function closeModalIfNeeded(event: KeyboardEvent) {
  const modalScope = getModalScope();

  if (!modalScope) return false;

  const closeButton = modalScope.querySelector<HTMLElement>("[data-tv-close]");

  if (!closeButton) return false;

  event.preventDefault();
  event.stopPropagation();
  closeButton.click();
  return true;
}

function getFallbackBackHref(path = window.location.pathname) {
  const normalWatchMatch = path.match(/^\/xem\/([^/?#]+)/);
  const customWatchMatch = path.match(/^\/ca-nhan\/([^/]+)\/xem/);

  if (normalWatchMatch?.[1]) {
    return `/phim/${normalWatchMatch[1]}`;
  }

  if (customWatchMatch?.[1]) {
    return `/ca-nhan/${customWatchMatch[1]}`;
  }

  if (isTvRemoteEnabled()) {
    return path === "/tv" ? "/" : "/tv";
  }

  if (path !== "/") {
    return "/";
  }

  return "/tv";
}

function goBack(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  const path = window.location.pathname;

  if (isTvRemoteEnabled()) {
    window.location.href = getFallbackBackHref(path);
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = getFallbackBackHref(path);
}

function handlePlaybackShortcut(event: KeyboardEvent, direction: Direction | null) {
  const wantsBackward = isSeekBackwardKey(event) || direction === "left";
  const wantsForward = isSeekForwardKey(event) || direction === "right";
  const wantsPlayPause = isPlayPauseKey(event) || isActivationKey(event);

  if (!wantsBackward && !wantsForward && !wantsPlayPause) return false;

  event.preventDefault();
  event.stopPropagation();

  if (wantsPlayPause) {
    dispatchPlayerCommand("toggle-play");
    dispatchOverlayCommand("peek", { focus: false });
    return true;
  }

  dispatchPlayerCommand("seek", wantsForward ? SEEK_SECONDS : -SEEK_SECONDS);
  dispatchOverlayCommand("peek", { focus: false });
  return true;
}

function jumpToPageSection(selector: string, pathname: string) {
  const target = document.querySelector<HTMLElement>(selector);

  if (!target || !isVisibleElement(target)) return false;

  focusElement(target, pathname);
  return true;
}

export default function TvRemoteNavigator() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    function refreshEnabled() {
      setEnabled(isTvRemoteEnabled());
    }

    refreshEnabled();

    window.addEventListener("baoflix-tv-mode-change", refreshEnabled);
    window.addEventListener("storage", refreshEnabled);
    window.addEventListener("focus", refreshEnabled);
    window.addEventListener("resize", refreshEnabled);
    window.addEventListener("orientationchange", refreshEnabled);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshEnabled);
      window.removeEventListener("storage", refreshEnabled);
      window.removeEventListener("focus", refreshEnabled);
      window.removeEventListener("resize", refreshEnabled);
      window.removeEventListener("orientationchange", refreshEnabled);
    };
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;

    window.setTimeout(() => {
      if (restoreFocus(pathname)) return;

      const modalScope = getModalScope();
      const main = getMainScope();
      const target = getDefaultFocusable(modalScope || main || document);

      if (target) {
        focusElement(target, pathname);
      }
    }, 120);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const activeElement = document.activeElement;
      const openModalScope = getModalScope();
      const hiddenOverlay = getHiddenWatchOverlay();
      const visibleOverlay = getVisibleWatchOverlay();
      const overlayHasPanel = isOverlayPanelOpen(visibleOverlay);
      const direction = getDirectionFromEvent(event);
      const activeIsInsideVisibleOverlay =
        visibleOverlay &&
        activeElement instanceof HTMLElement &&
        visibleOverlay.contains(activeElement);

      if (visibleOverlay && !isTextInput(activeElement)) {
        dispatchOverlayActivity();
      }

      if (isBackKey(event) && !isTextInput(activeElement)) {
        if (closeModalIfNeeded(event)) return;

        if (visibleOverlay) {
          event.preventDefault();
          event.stopPropagation();

          if (overlayHasPanel) {
            dispatchOverlayCommand("close-panel", { focus: true });
          } else {
            dispatchOverlayCommand("hide");
          }

          return;
        }

        goBack(event);
        return;
      }

      if (!openModalScope && !isTextInput(activeElement) && hiddenOverlay) {
        if (direction === "up" || direction === "down") {
          event.preventDefault();
          event.stopPropagation();
          dispatchOverlayCommand("peek", { focus: true });
          return;
        }

        if (handlePlaybackShortcut(event, direction)) {
          return;
        }
      }

      if (
        !openModalScope &&
        !isTextInput(activeElement) &&
        !activeIsInsideVisibleOverlay &&
        visibleOverlay &&
        !overlayHasPanel
      ) {
        if (direction === "left" || direction === "right") {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlayerCommand("seek", direction === "right" ? SEEK_SECONDS : -SEEK_SECONDS);
          dispatchOverlayCommand("peek", { focus: false });
          focusOverlaySeekButton(direction === "left" ? "backward" : "forward", pathname);
          return;
        }

        if (direction === "up" || direction === "down") {
          event.preventDefault();
          event.stopPropagation();
          dispatchOverlayCommand("peek", { focus: true });
          return;
        }

        if (isActivationKey(event) || isPlayPauseKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          dispatchPlayerCommand("toggle-play");
          dispatchOverlayCommand("peek", { focus: false });
          return;
        }
      }

      if (
        !openModalScope &&
        !isTextInput(activeElement) &&
        !activeIsInsideVisibleOverlay &&
        (isPlayPauseKey(event) || isSeekBackwardKey(event) || isSeekForwardKey(event))
      ) {
        if (handlePlaybackShortcut(event, direction)) return;
      }

      if (isActivationKey(event) && !isTextInput(activeElement)) {
        clickActiveElement(event);
        return;
      }

      if (!direction) return;

      if (shouldLetInputHandleKey(activeElement, event)) return;

      if (
        direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")
      ) {
        const firstMainElement = getFirstMainFocusableElement();

        if (firstMainElement) {
          event.preventDefault();
          event.stopPropagation();
          focusElement(firstMainElement, pathname);
        }

        return;
      }

      if (
        pathname === "/tv" &&
        direction === "up" &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("[data-tv-section='shortcuts']")
      ) {
        if (jumpToPageSection("[data-tv-section='hero'] [data-tv-default], [data-tv-section='hero'] a[href]", pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (
        pathname === "/loc" &&
        direction === "down" &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("[data-tv-filter-panel]") &&
        activeElement.getAttribute("data-tv-jump-results") === "true"
      ) {
        if (jumpToPageSection("[data-tv-section='filter-results'] a[href], [data-tv-section='filter-results'] button:not([disabled])", pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      const modalScope = getModalScope();
      const activeScope = getActiveScope(activeElement);
      const root = modalScope || activeScope || visibleOverlay || getMainScope() || document;
      const focusableElements = getFocusableElements(root);

      if (!focusableElements.length) return;

      const current =
        activeElement instanceof HTMLElement &&
        focusableElements.includes(activeElement)
          ? activeElement
          : null;

      if (!current) {
        event.preventDefault();
        event.stopPropagation();

        const defaultElement = getDefaultFocusable(root);

        if (defaultElement) {
          focusElement(defaultElement, pathname);
        }

        return;
      }

      const nextElement = getLinearCandidate(
        current,
        root,
        focusableElements,
        direction
      );

      if (!nextElement || nextElement === current) {
        if (
          root instanceof HTMLElement &&
          (root.dataset.tvLock === "true" || root.dataset.tvModal || root.dataset.tvOverlay === "watch")
        ) {
          event.preventDefault();
          event.stopPropagation();
        }

        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusElement(nextElement, pathname);
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, pathname]);

  return null;
}
