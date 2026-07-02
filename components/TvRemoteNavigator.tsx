"use client";

import { useEffect, useRef, useState } from "react";
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
  rowKey?: string;
};

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";
type OverlayCommandAction = "peek" | "hide" | "open-episodes" | "open-sources" | "close-panel" | "panel-back" | "confirm-exit" | "activity";

const ROW_THRESHOLD = 22;
const TV_SESSION_KEY = "baoflix_tv_mode";
const SEEK_SECONDS = 10;
const FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";
const AREA_FOCUS_PREFIX = "baoflix_tv_area_focus:";
const ROW_FOCUS_PREFIX = "baoflix_tv_row_focus:";
const ROUTE_STACK_KEY = "baoflix_tv_route_stack_v1";
const ROUTE_EVENT_NAME = "baoflix-tv-route-change";
const HISTORY_PATCH_FLAG = "__baoflixTvHistoryPatched";
const NAV_REPEAT_DEBOUNCE_MS = 42;
const DEFAULT_FOCUS_LOCK_MS = 120;
const FOCUS_LOCK_EVENT_NAME = "baoflix-tv-focus-lock";

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

function isMenuKey(event: KeyboardEvent) {
  return (
    event.key === "Menu" ||
    event.key === "ContextMenu" ||
    event.key === "Apps" ||
    event.keyCode === 82
  );
}

function isSearchKey(event: KeyboardEvent) {
  return event.key === "Search" || event.key === "Find" || event.keyCode === 84;
}

function isTextInput(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || element.isContentEditable;
}

function shouldLetInputHandleKey(element: Element | null, event: KeyboardEvent) {
  if (!isTextInput(element)) return false;
  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}

function isTextDeleteBackspace(event: KeyboardEvent) {
  return (
    event.key === "Backspace" &&
    event.keyCode !== 4 &&
    event.keyCode !== 461 &&
    event.keyCode !== 10009
  );
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
  return (
    document.querySelector<HTMLElement>("main [data-tv-scope]") ||
    document.querySelector<HTMLElement>("main")
  );
}

function getTvRail() {
  return document.querySelector<HTMLElement>("[data-tv-rail='true']");
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

function isOverlayExitConfirm(overlay: HTMLElement | null) {
  return overlay?.dataset.tvOverlayMode === "confirm-exit";
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
      ? root.querySelector<HTMLElement>("[data-tv-default], [data-tv-overlay-default], [data-tv-tab-active='true']")
      : document.querySelector<HTMLElement>("[data-tv-default], [data-tv-overlay-default], [data-tv-tab-active='true']");

  if (
    defaultElement &&
    isVisibleElement(defaultElement) &&
    defaultElement.tabIndex !== -1 &&
    !defaultElement.hasAttribute("data-tv-skip")
  ) {
    return defaultElement;
  }

  return getFocusableElements(root)[0] || null;
}

function getFirstFocusableInside(selector: string) {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root || !isVisibleElement(root)) return null;
  return getDefaultFocusable(root) || getFocusableElements(root)[0] || null;
}

function isInsideTvRail(element: Element | null) {
  return element instanceof HTMLElement && Boolean(element.closest("[data-tv-rail='true']"));
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/"/g, '\\"');
}

function getFocusMemoryValue(element: HTMLElement) {
  const dataKey = element.getAttribute("data-tv-focus-key");
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") : "";

  if (dataKey) return `data:${dataKey}`;
  if (href) return `href:${href}`;
  return "";
}

function getElementByFocusMemoryValue(value: string) {
  let target: HTMLElement | null = null;

  if (value.startsWith("href:")) {
    const href = value.slice(5);
    target = document.querySelector<HTMLElement>(`a[href="${cssEscape(href)}"]`);
  } else if (value.startsWith("data:")) {
    const key = value.slice(5);
    target = document.querySelector<HTMLElement>(`[data-tv-focus-key="${cssEscape(key)}"]`);
  }

  if (
    !target ||
    !isVisibleElement(target) ||
    target.tabIndex === -1 ||
    target.hasAttribute("data-tv-skip")
  ) {
    return null;
  }

  return target;
}

function getFocusAreaKey(pathname: string, element: HTMLElement) {
  if (element.closest("[data-tv-modal]")) return `${pathname}:modal`;
  if (element.closest("[data-tv-overlay='watch']")) return `${pathname}:overlay`;
  if (element.closest("[data-tv-search-keyboard]")) return `${pathname}:search-keyboard`;
  if (element.closest("header")) return `${pathname}:header`;
  if (element.closest("[data-tv-rail='true']")) return `${pathname}:rail`;
  if (element.closest("[data-tv-filter-panel]")) return `${pathname}:filter`;

  const section = element.closest<HTMLElement>("[data-tv-section]");
  if (section?.dataset.tvSection) return `${pathname}:section:${section.dataset.tvSection}`;

  if (element.closest("main")) return `${pathname}:content`;
  return `${pathname}:document`;
}

function getElementRowKey(element: HTMLElement) {
  const row = element.closest<HTMLElement>("[data-tv-row]");
  if (!row) return "";

  const explicit = row.dataset.tvRowKey;
  if (explicit) return explicit;

  const panel = row.closest<HTMLElement>("[data-tv-panel]");
  const section = row.closest<HTMLElement>("[data-tv-section]");
  const scope = row.closest<HTMLElement>("[data-tv-scope]");

  const owner = panel
    ? `panel:${panel.dataset.tvPanel || panel.getAttribute("data-tv-panel") || "panel"}`
    : section?.dataset.tvSection
      ? `section:${section.dataset.tvSection}`
      : scope?.dataset.tvScope
        ? `scope:${scope.dataset.tvScope}`
        : "document";

  const root = panel || section || scope || document;
  const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-tv-row]")).filter((candidate) => {
    const parentRow = candidate.parentElement?.closest<HTMLElement>("[data-tv-row]");
    return !parentRow || !root.contains(parentRow);
  });
  const index = rows.indexOf(row);

  return `${owner}:row:${Math.max(index, 0)}`;
}

function rememberRowFocus(pathname: string, element: HTMLElement, value = getFocusMemoryValue(element)) {
  if (!value) return;

  const rowKey = getElementRowKey(element);
  if (!rowKey) return;

  try {
    sessionStorage.setItem(`${ROW_FOCUS_PREFIX}${pathname}:${rowKey}`, value);
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function getRememberedRowFocusable(pathname: string, rowKey?: string) {
  if (!rowKey) return null;

  try {
    const value = sessionStorage.getItem(`${ROW_FOCUS_PREFIX}${pathname}:${rowKey}`);
    if (!value) return null;
    return getElementByFocusMemoryValue(value);
  } catch {
    return null;
  }
}

function rememberAreaFocus(pathname: string, element: HTMLElement, value = getFocusMemoryValue(element)) {
  if (!value) return;

  try {
    const areaKey = getFocusAreaKey(pathname, element);
    sessionStorage.setItem(`${AREA_FOCUS_PREFIX}${areaKey}`, value);

    if (
      element.closest("main") &&
      !element.closest("[data-tv-rail='true']") &&
      !element.closest("[data-tv-modal]") &&
      !element.closest("[data-tv-overlay='watch']") &&
      !element.closest("[data-tv-search-keyboard]")
    ) {
      sessionStorage.setItem(`${AREA_FOCUS_PREFIX}${pathname}:content`, value);
    }
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function getRememberedFocusable(areaKey: string) {
  try {
    const value = sessionStorage.getItem(`${AREA_FOCUS_PREFIX}${areaKey}`);
    if (!value) return null;
    return getElementByFocusMemoryValue(value);
  } catch {
    return null;
  }
}

function rememberFocus(pathname: string, element: HTMLElement) {
  const value = getFocusMemoryValue(element);
  if (!value) return;

  try {
    sessionStorage.setItem(`${FOCUS_MEMORY_PREFIX}${pathname}`, value);
    rememberAreaFocus(pathname, element, value);
    rememberRowFocus(pathname, element, value);
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function restoreFocus(pathname: string) {
  try {
    const value = sessionStorage.getItem(`${FOCUS_MEMORY_PREFIX}${pathname}`);
    if (!value) return false;

    const target = getElementByFocusMemoryValue(value);
    if (!target) return false;

    focusElement(target, pathname);
    return true;
  } catch {
    return false;
  }
}

function getScrollAlignment(element: HTMLElement) {
  return element.closest<HTMLElement>("[data-tv-scroll-align]")?.dataset.tvScrollAlign || "nearest";
}

function focusElement(element: HTMLElement, pathname?: string) {
  element.focus({ preventScroll: true });

  const align = getScrollAlignment(element);
  element.scrollIntoView({
    behavior: "auto",
    block: align === "center" ? "center" : "nearest",
    inline: align === "center" ? "center" : "nearest",
  });

  if (pathname) rememberFocus(pathname, element);
}

function focusRailFromContent(pathname: string) {
  const rail = getTvRail();
  if (!rail || !isVisibleElement(rail)) return false;

  const rememberedRail = getRememberedFocusable(`${pathname}:rail`);
  const target =
    rememberedRail ||
    rail.querySelector<HTMLElement>("[data-tv-focus-key='rail:home']") ||
    getDefaultFocusable(rail) ||
    getFocusableElements(rail)[0];

  if (!target) return false;
  focusElement(target, pathname);
  return true;
}

function focusContentFromRail(pathname: string) {
  const rememberedContent = getRememberedFocusable(`${pathname}:content`);
  const target =
    rememberedContent ||
    getFirstFocusableInside("main [data-tv-scope]") ||
    getFirstFocusableInside("main");

  if (!target) return false;
  focusElement(target, pathname);
  return true;
}

function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");
  return getDefaultFocusable(scope || main || document);
}

function getVisibleSearchKeyboard() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-tv-search-keyboard]")).find(isVisibleElement) ||
    null
  );
}

function focusSearchKeyboard(pathname: string) {
  const keyboard = getVisibleSearchKeyboard();
  const target = keyboard ? getFocusableElements(keyboard)[0] : null;
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}

function focusInputFromKeyboard(activeElement: Element | null, pathname: string) {
  if (!(activeElement instanceof HTMLElement)) return false;

  const keyboard = activeElement.closest<HTMLElement>("[data-tv-search-keyboard]");
  if (!keyboard) return false;

  const wrapper = keyboard.parentElement;
  const input = wrapper?.querySelector<HTMLElement>(
    "[data-tv-keyboard-input], [data-tv-header-search-input], input[type='search']"
  );

  if (!input || !isVisibleElement(input)) return false;

  focusElement(input, pathname);
  return true;
}

function focusPageContentFromTransientUi(pathname: string) {
  const remembered = getRememberedFocusable(`${pathname}:content`);
  if (remembered) {
    focusElement(remembered, pathname);
    return true;
  }

  const selectors = [
    "[data-tv-section='top-actions'] [data-tv-default]",
    "[data-tv-section='top-actions'] a[href]:not([data-tv-skip])",
    "[data-tv-section='continue'] a[href]:not([data-tv-skip])",
    "[data-tv-section='china-series'] a[href]:not([data-tv-skip])",
    "[data-tv-section='custom'] a[href]:not([data-tv-skip])",
    "[data-tv-section='favorites'] a[href]:not([data-tv-skip])",
    "main [data-tv-scope] [data-tv-default]",
    "main [data-tv-scope] a[href]:not([data-tv-skip])",
    "main [data-tv-scope] button:not([disabled]):not([data-tv-skip])",
    "main a[href]:not([data-tv-skip])",
    "main button:not([disabled]):not([data-tv-skip])",
  ];

  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const target = candidates.find((element) => element.tabIndex !== -1 && isVisibleElement(element));

    if (target) {
      focusElement(target, pathname);
      return true;
    }
  }

  return false;
}

function focusHeaderSearch(pathname: string) {
  const candidates = [
    document.querySelector<HTMLElement>("[data-tv-header-search-input]"),
    document.querySelector<HTMLElement>("[data-tv-header-search-toggle]"),
    document.querySelector<HTMLElement>("header input"),
  ].filter(Boolean) as HTMLElement[];

  const target = candidates.find(isVisibleElement);
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}

function focusHeaderMenu(pathname: string) {
  const menuCandidates = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tv-header-menu-button]")
  );
  const menuButton = menuCandidates.find(isVisibleElement);

  if (menuButton) {
    focusElement(menuButton, pathname);
    return true;
  }

  const settingsCandidates = [
    document.querySelector<HTMLElement>("[data-tv-focus-key='nav:/cai-dat:Cài đặt']"),
    document.querySelector<HTMLElement>("header a[href='/cai-dat']"),
  ].filter(Boolean) as HTMLElement[];

  const settingsLink = settingsCandidates.find(isVisibleElement);
  if (!settingsLink) return false;

  focusElement(settingsLink, pathname);
  return true;
}

function toFocusEntry(element: HTMLElement): FocusEntry {
  return {
    element,
    rect: element.getBoundingClientRect(),
    rowKey: getElementRowKey(element),
  };
}

function buildRectRows(elements: HTMLElement[]) {
  const entries = elements
    .map(toFocusEntry)
    .sort((a, b) => {
      if (Math.abs(a.rect.top - b.rect.top) > ROW_THRESHOLD) return a.rect.top - b.rect.top;
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

  rows.forEach((row) => row.sort((a, b) => a.rect.left - b.rect.left));
  return rows;
}

function rowShouldUseVisualGrid(rowElement: HTMLElement) {
  if (rowElement.dataset.tvRowGrid === "true") return true;
  if (rowElement.dataset.tvRowWrap === "true") return true;

  const style = window.getComputedStyle(rowElement);
  return style.display.includes("grid") || style.flexWrap === "wrap" || style.flexWrap === "wrap-reverse";
}

function getExplicitRowElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-tv-row]")).filter((row) => {
    if (!isVisibleElement(row)) return false;
    const parentRow = row.parentElement?.closest<HTMLElement>("[data-tv-row]");
    return !parentRow || !root.contains(parentRow);
  });
}

function buildRows(root: ParentNode, elements: HTMLElement[]) {
  if (!(root instanceof HTMLElement)) return buildRectRows(elements);

  const explicitRowElements = getExplicitRowElements(root);
  if (!explicitRowElements.length) return buildRectRows(elements);

  const rows: FocusEntry[][] = [];
  const elementsInsideExplicitRows = new Set<HTMLElement>();

  explicitRowElements.forEach((rowElement) => {
    const rowElements = getFocusableElements(rowElement);
    rowElements.forEach((element) => elementsInsideExplicitRows.add(element));
    if (!rowElements.length) return;

    if (rowShouldUseVisualGrid(rowElement)) {
      rows.push(...buildRectRows(rowElements));
    } else {
      rows.push(rowElements.map(toFocusEntry).sort((a, b) => a.rect.left - b.rect.left));
    }
  });

  const outsideElements = elements.filter((element) => !elementsInsideExplicitRows.has(element));

  return [...rows, ...buildRectRows(outsideElements)].sort((a, b) => {
    const aTop = a[0]?.rect.top ?? 0;
    const bTop = b[0]?.rect.top ?? 0;
    if (Math.abs(aTop - bTop) > ROW_THRESHOLD) return aTop - bTop;
    return (a[0]?.rect.left ?? 0) - (b[0]?.rect.left ?? 0);
  });
}

function getClosestByHorizontalCenter(row: FocusEntry[], currentRect: DOMRect, pathname?: string) {
  const rowKey = row[0]?.rowKey;

  if (pathname && rowKey) {
    const remembered = getRememberedRowFocusable(pathname, rowKey);
    if (remembered && row.some((entry) => entry.element === remembered)) return remembered;
  }

  const currentCenter = currentRect.left + currentRect.width / 2;

  return (
    row.reduce<FocusEntry | null>((best, entry) => {
      if (!best) return entry;

      const bestCenter = best.rect.left + best.rect.width / 2;
      const entryCenter = entry.rect.left + entry.rect.width / 2;

      return Math.abs(entryCenter - currentCenter) < Math.abs(bestCenter - currentCenter)
        ? entry
        : best;
    }, null)?.element || null
  );
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
  direction: Direction,
  pathname?: string
) {
  const rows = buildRows(root, elements);
  const { rowIndex, itemIndex } = findRowIndex(rows, current);

  if (rowIndex < 0 || itemIndex < 0) return elements[0] || null;

  const currentRow = rows[rowIndex];
  const previousRow = rows[rowIndex - 1];
  const nextRow = rows[rowIndex + 1];
  const currentEntry = currentRow[itemIndex];
  const rowContainer = current.closest<HTMLElement>("[data-tv-row]");
  const shouldLoop = rowContainer?.dataset.tvRowLoop === "true";

  if (direction === "right") {
    return currentRow[itemIndex + 1]?.element || (shouldLoop ? currentRow[0]?.element : current);
  }

  if (direction === "left") {
    return currentRow[itemIndex - 1]?.element || (shouldLoop ? currentRow[currentRow.length - 1]?.element : current);
  }

  if (direction === "down") {
    return nextRow ? getClosestByHorizontalCenter(nextRow, currentEntry.rect, pathname) : current;
  }

  if (direction === "up") {
    return previousRow ? getClosestByHorizontalCenter(previousRow, currentEntry.rect, pathname) : current;
  }

  return null;
}

function getOverlayDefaultFocusable(overlay: HTMLElement) {
  return (
    overlay.querySelector<HTMLElement>("[data-tv-overlay-default]") ||
    overlay.querySelector<HTMLElement>("a[href], button:not([disabled])")
  );
}

function getOverlaySeekFocusable(overlay: HTMLElement, direction: SeekDirection) {
  return (
    overlay.querySelector<HTMLElement>(`[data-tv-seek='${direction}']`) ||
    getOverlayDefaultFocusable(overlay)
  );
}

function dispatchOverlayCommand(action: OverlayCommandAction, options?: { focus?: boolean }) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-overlay-command", {
      detail: { action, focus: options?.focus },
    })
  );
}

function dispatchOverlayActivity() {
  dispatchOverlayCommand("activity");
}

function dispatchPlayerCommand(action: PlayerCommandAction, seconds?: number) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-player-command", {
      detail: { action, seconds, handled: false },
    })
  );
}

function focusOverlaySeekButton(direction: SeekDirection, pathname: string) {
  window.setTimeout(() => {
    const overlay = getVisibleWatchOverlay();
    if (!overlay) return;

    const target = getOverlaySeekFocusable(overlay, direction);
    if (target) focusElement(target, pathname);
  }, 60);
}

function clickActiveElement(event: KeyboardEvent) {
  const active = document.activeElement;
  if (active instanceof HTMLAnchorElement || active instanceof HTMLButtonElement) {
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

function focusActiveTabButtonFromPanel(activeElement: Element | null, pathname: string) {
  if (!(activeElement instanceof HTMLElement)) return false;

  const panel = activeElement.closest<HTMLElement>("[data-tv-tab-panel]");
  if (!panel) return false;

  const root = panel.closest<HTMLElement>("[data-tv-tabs-root]");
  const activeTab = root?.querySelector<HTMLElement>("[data-tv-tab-active='true']");
  if (!activeTab) return false;

  const panelElements = getFocusableElements(panel);
  const rows = buildRows(panel, panelElements);
  const { rowIndex } = findRowIndex(rows, activeElement);

  if (rowIndex > 0) return false;

  focusElement(activeTab, pathname);
  return true;
}

function focusActiveTabPanel(activeElement: Element | null, pathname: string) {
  if (!(activeElement instanceof HTMLElement)) return false;

  const tabList = activeElement.closest<HTMLElement>("[data-tv-tab-list]");
  if (!tabList) return false;

  const root = tabList.closest<HTMLElement>("[data-tv-tabs-root]");
  const panel = root?.querySelector<HTMLElement>("[data-tv-tab-panel-active='true']");
  if (!panel) return false;

  const target = getDefaultFocusable(panel) || getFocusableElements(panel)[0];
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}

function handleTransientUiBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return false;

  const isSearchKeyboard = Boolean(activeElement.closest("[data-tv-search-keyboard]"));
  const isSearchInput =
    isTextInput(activeElement) &&
    Boolean(
      activeElement.closest("header") ||
        activeElement.closest("[data-tv-section='search-strip']") ||
        activeElement.hasAttribute("data-tv-keyboard-input")
    );

  if (!isSearchKeyboard && !isSearchInput) return false;

  event.preventDefault();
  event.stopPropagation();

  if (isSearchKeyboard && focusInputFromKeyboard(activeElement, pathname)) return true;
  if (focusPageContentFromTransientUi(pathname)) return true;

  activeElement.blur();
  return true;
}

function handleScopedBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;

  if (handleTransientUiBack(event, pathname)) return true;

  if (focusActiveTabButtonFromPanel(activeElement, pathname)) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (activeElement instanceof HTMLElement && activeElement.closest("[data-tv-filter-panel]")) {
    const activeTab = activeElement
      .closest<HTMLElement>("[data-tv-tabs-root]")
      ?.querySelector<HTMLElement>("[data-tv-tab-active='true']");

    if (activeTab && activeElement !== activeTab && isVisibleElement(activeTab)) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(activeTab, pathname);
      return true;
    }
  }

  if (
    pathname === "/tv" &&
    activeElement instanceof HTMLElement &&
    !isInsideTvRail(activeElement) &&
    activeElement.closest("main") &&
    focusRailFromContent(pathname)
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (
    activeElement instanceof HTMLElement &&
    activeElement.closest("header") &&
    focusPageContentFromTransientUi(pathname)
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return false;
}

function getCurrentRoute() {
  return `${window.location.pathname}${window.location.search || ""}`;
}

function readRouteStack() {
  try {
    const raw = sessionStorage.getItem(ROUTE_STACK_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeRouteStack(stack: string[]) {
  try {
    sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify(stack.slice(-30)));
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function rememberRoute(route = getCurrentRoute()) {
  const stack = readRouteStack();
  const last = stack[stack.length - 1];

  if (last === route) return;

  stack.push(route);
  writeRouteStack(stack);
}

function popRouteTarget(current = getCurrentRoute()) {
  const stack = readRouteStack().filter(Boolean);

  while (stack.length && stack[stack.length - 1] === current) stack.pop();

  const target = stack.pop() || "";
  writeRouteStack(stack);

  if (!target || target === current) return "";
  return target;
}

function installRouteWatcher() {
  const w = window as Window & { [HISTORY_PATCH_FLAG]?: boolean };
  if (w[HISTORY_PATCH_FLAG]) return;
  w[HISTORY_PATCH_FLAG] = true;

  const notify = () => {
    window.setTimeout(() => {
      window.dispatchEvent(new Event(ROUTE_EVENT_NAME));
    }, 0);
  };

  const oldPushState = window.history.pushState;
  const oldReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(...args) {
    const result = oldPushState.apply(this, args);
    notify();
    return result;
  };

  window.history.replaceState = function replaceState(...args) {
    const result = oldReplaceState.apply(this, args);
    notify();
    return result;
  };
}

function getFallbackBackHref(path = window.location.pathname) {
  const normalWatchMatch = path.match(/^\/xem\/([^/?#]+)/);
  const customWatchMatch = path.match(/^\/ca-nhan\/([^/]+)\/xem/);

  if (normalWatchMatch?.[1]) return `/phim/${normalWatchMatch[1]}`;
  if (customWatchMatch?.[1]) return `/ca-nhan/${customWatchMatch[1]}`;
  if (path !== "/tv") return "/tv";
  return "/";
}

function normalizeRoutePath(route: string) {
  try {
    return new URL(route, window.location.origin).pathname;
  } catch {
    return route.split("?")[0].split("#")[0] || "/";
  }
}

function isSameRoutePath(a: string, b: string) {
  return normalizeRoutePath(a) === normalizeRoutePath(b);
}

function isWatchRoute(route = getCurrentRoute()) {
  const path = normalizeRoutePath(route);
  return /^\/xem\/[^/]+/.test(path) || /^\/ca-nhan\/[^/]+\/xem/.test(path);
}

function sanitizeStackForWatchExit(current: string, detailHref: string) {
  const detailPath = normalizeRoutePath(detailHref);
  const nextStack = readRouteStack().filter(Boolean);

  while (nextStack.length) {
    const last = nextStack[nextStack.length - 1];

    if (last === current || isWatchRoute(last) || isSameRoutePath(last, detailPath)) {
      nextStack.pop();
      continue;
    }

    break;
  }

  writeRouteStack(nextStack);
}

function exitWatch(event?: KeyboardEvent, href = getFallbackBackHref(window.location.pathname)) {
  event?.preventDefault();
  event?.stopPropagation();

  const current = getCurrentRoute();
  sanitizeStackForWatchExit(current, href);

  window.location.href = href;
}

function goBack(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  const current = getCurrentRoute();
  const stackedTarget = popRouteTarget(current);

  if (stackedTarget) {
    if (isWatchRoute(current) && isSameRoutePath(stackedTarget, getFallbackBackHref(window.location.pathname))) {
      sanitizeStackForWatchExit(current, stackedTarget);
    }

    window.location.href = stackedTarget;
    return;
  }

  if (!isTvRemoteEnabled() && window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = getFallbackBackHref(window.location.pathname);
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

function isFirstRowInScope(activeElement: Element | null, root: ParentNode) {
  if (!(activeElement instanceof HTMLElement)) return false;

  const focusableElements = getFocusableElements(root);
  const rows = buildRows(root, focusableElements);
  const { rowIndex } = findRowIndex(rows, activeElement);

  return rowIndex <= 0;
}

function getFocusOutRule(element: HTMLElement, direction: Direction) {
  const attr = `data-tv-focus-out-${direction}`;
  let current: HTMLElement | null = element;

  while (current) {
    const rule = current.getAttribute(attr);
    if (rule) return rule;
    current = current.parentElement;
  }

  return "";
}

function focusByFocusKey(focusKey: string, pathname: string) {
  const target = document.querySelector<HTMLElement>(
    `[data-tv-focus-key="${cssEscape(focusKey)}"]`
  );

  if (!target || !isVisibleElement(target)) return false;
  focusElement(target, pathname);
  return true;
}

function focusBySelector(selector: string, pathname: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target || !isVisibleElement(target)) return false;
  focusElement(target, pathname);
  return true;
}

function handleFocusOutRule(current: HTMLElement, direction: Direction, pathname: string) {
  const rule = getFocusOutRule(current, direction);
  if (!rule) return false;

  if (rule === "stay" || rule === "none") return true;
  if (rule === "rail") return focusRailFromContent(pathname);
  if (rule === "content") return focusContentFromRail(pathname);
  if (rule === "header" || rule === "search") return focusHeaderSearch(pathname);

  if (rule.startsWith("focus-key:")) {
    return focusByFocusKey(rule.slice("focus-key:".length), pathname);
  }

  if (rule.startsWith("selector:")) {
    return focusBySelector(rule.slice("selector:".length), pathname);
  }

  if (rule.startsWith("#") || rule.startsWith("[") || rule.startsWith(".")) {
    return focusBySelector(rule, pathname);
  }

  return false;
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
export default function TvRemoteNavigator() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const lastGridMoveRef = useRef(0);
  const focusLockUntilRef = useRef(0);

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
    function handleFocusLock(event: Event) {
      const detail = (event as CustomEvent<{ ms?: number }>).detail || {};
      const ms = Number.isFinite(Number(detail.ms)) ? Number(detail.ms) : DEFAULT_FOCUS_LOCK_MS;
      focusLockUntilRef.current = Math.max(focusLockUntilRef.current, nowMs() + Math.max(0, ms));
    }

    window.addEventListener(FOCUS_LOCK_EVENT_NAME, handleFocusLock as EventListener);

    return () => {
      window.removeEventListener(FOCUS_LOCK_EVENT_NAME, handleFocusLock as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    installRouteWatcher();
    focusLockUntilRef.current = nowMs() + DEFAULT_FOCUS_LOCK_MS;
    rememberRoute(getCurrentRoute());

    function rememberCurrentRoute() {
      focusLockUntilRef.current = nowMs() + DEFAULT_FOCUS_LOCK_MS;
      rememberRoute(getCurrentRoute());
    }

    window.addEventListener(ROUTE_EVENT_NAME, rememberCurrentRoute);
    window.addEventListener("popstate", rememberCurrentRoute);
    window.addEventListener("hashchange", rememberCurrentRoute);

    return () => {
      window.removeEventListener(ROUTE_EVENT_NAME, rememberCurrentRoute);
      window.removeEventListener("popstate", rememberCurrentRoute);
      window.removeEventListener("hashchange", rememberCurrentRoute);
    };
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;

    focusLockUntilRef.current = nowMs() + DEFAULT_FOCUS_LOCK_MS;

    window.setTimeout(() => {
      if (restoreFocus(pathname)) return;

      const modalScope = getModalScope();
      const main = getMainScope();
      const target = getDefaultFocusable(modalScope || main || document);
      if (target) focusElement(target, pathname);
    }, 120);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;

    function handleExitWatch(event: Event) {
      const detail = (event as CustomEvent<{ href?: string }>).detail || {};
      exitWatch(undefined, detail.href || getFallbackBackHref(window.location.pathname));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const activeElement = document.activeElement;
      const openModalScope = getModalScope();
      const hiddenOverlay = getHiddenWatchOverlay();
      const visibleOverlay = getVisibleWatchOverlay();
      const overlayHasPanel = isOverlayPanelOpen(visibleOverlay);
      const overlayIsExitConfirm = isOverlayExitConfirm(visibleOverlay);
      const direction = getDirectionFromEvent(event);
      const activeIsInsideVisibleOverlay =
        visibleOverlay && activeElement instanceof HTMLElement && visibleOverlay.contains(activeElement);

      if (
        !isBackKey(event) &&
        !isSeekBackwardKey(event) &&
        !isSeekForwardKey(event) &&
        !isPlayPauseKey(event) &&
        !isTextInput(activeElement) &&
        (direction || isActivationKey(event)) &&
        nowMs() < focusLockUntilRef.current
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (visibleOverlay && !isTextInput(activeElement)) dispatchOverlayActivity();

      if (isMenuKey(event) && !isTextInput(activeElement) && !openModalScope && !visibleOverlay) {
        event.preventDefault();
        event.stopPropagation();

        if (focusHeaderMenu(pathname)) {
          const target = document.activeElement;
          if (target instanceof HTMLButtonElement && target.hasAttribute("data-tv-header-menu-button")) {
            target.click();
          }
        }

        return;
      }

      if (isSearchKey(event) && !isTextInput(activeElement) && !openModalScope && !visibleOverlay) {
        event.preventDefault();
        event.stopPropagation();
        focusHeaderSearch(pathname);
        return;
      }

      if (isBackKey(event) && !(isTextInput(activeElement) && isTextDeleteBackspace(event))) {
        if (closeModalIfNeeded(event)) return;

        if (visibleOverlay) {
          event.preventDefault();
          event.stopPropagation();

          if (overlayIsExitConfirm) {
            exitWatch(event);
            return;
          }

          if (overlayHasPanel) dispatchOverlayCommand("panel-back", { focus: true });
          else dispatchOverlayCommand("hide");

          return;
        }

        if (hiddenOverlay) {
          event.preventDefault();
          event.stopPropagation();
          dispatchOverlayCommand("confirm-exit", { focus: true });
          return;
        }

        if (handleScopedBack(event, pathname)) return;
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

        if (handlePlaybackShortcut(event, direction)) return;
      }

      if (
        !openModalScope &&
        !isTextInput(activeElement) &&
        !activeIsInsideVisibleOverlay &&
        visibleOverlay &&
        !overlayHasPanel &&
        !overlayIsExitConfirm
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

      if (
        event.repeat &&
        !hiddenOverlay &&
        !visibleOverlay &&
        !(activeElement instanceof HTMLElement && activeElement.closest("[data-tv-search-keyboard]"))
      ) {
        const now = performance.now();
        if (now - lastGridMoveRef.current < NAV_REPEAT_DEBOUNCE_MS) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        lastGridMoveRef.current = now;
      }

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        focusInputFromKeyboard(activeElement, pathname)
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        direction === "down" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (isTextInput(activeElement) && focusSearchKeyboard(pathname)) return;
        if (focusPageContentFromTransientUi(pathname)) return;
        return;
      }

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {
        const rootForHeaderJump = getActiveScope(activeElement) || getMainScope() || document;
        if (isFirstRowInScope(activeElement, rootForHeaderJump) && focusHeaderSearch(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (
        direction === "left" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {
        const currentRow = activeElement.closest<HTMLElement>("[data-tv-row]");
        const rowFocusables = currentRow ? getFocusableElements(currentRow) : [];
        const firstInRow = rowFocusables[0];

        if (firstInRow === activeElement && focusRailFromContent(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (
        direction === "right" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        isInsideTvRail(activeElement) &&
        focusContentFromRail(pathname)
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        (activeElement.closest("header") || activeElement.hasAttribute("data-tv-keyboard-input"))
      ) {
        if (focusSearchKeyboard(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const firstMainElement = getFirstMainFocusableElement();
        if (firstMainElement) {
          event.preventDefault();
          event.stopPropagation();
          focusElement(firstMainElement, pathname);
        }
        return;
      }

      if (shouldLetInputHandleKey(activeElement, event)) return;

      if (direction === "down" && focusActiveTabPanel(activeElement, pathname)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (direction === "up" && focusActiveTabButtonFromPanel(activeElement, pathname)) {
        event.preventDefault();
        event.stopPropagation();
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
      const activeHeader = activeElement instanceof HTMLElement ? activeElement.closest<HTMLElement>("header") : null;
      const root = modalScope || activeScope || activeHeader || visibleOverlay || getMainScope() || document;
      const focusableElements = getFocusableElements(root);

      if (!focusableElements.length) return;

      const current =
        activeElement instanceof HTMLElement && focusableElements.includes(activeElement)
          ? activeElement
          : null;

      if (!current) {
        event.preventDefault();
        event.stopPropagation();
        const defaultElement = getDefaultFocusable(root);
        if (defaultElement) focusElement(defaultElement, pathname);
        return;
      }

      const nextElement = getLinearCandidate(current, root, focusableElements, direction, pathname);

      if (!nextElement || nextElement === current) {
        if (handleFocusOutRule(current, direction, pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (
          direction === "up" &&
          !openModalScope &&
          !activeIsInsideVisibleOverlay &&
          focusHeaderSearch(pathname)
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (
          root instanceof HTMLElement &&
          direction === "down" &&
          root.closest("header") &&
          focusPageContentFromTransientUi(pathname)
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusElement(nextElement, pathname);
    }

    window.addEventListener("baoflix-tv-exit-watch", handleExitWatch as EventListener);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("baoflix-tv-exit-watch", handleExitWatch as EventListener);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, pathname]);

  return null;
}
