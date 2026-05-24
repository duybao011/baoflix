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

type FocusEntry = {
  element: HTMLElement;
  rect: DOMRect;
};

const ROW_THRESHOLD = 22;
const TV_SESSION_KEY = "baoflix_tv_mode";

function isTvRemoteEnabled() {
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

function getDirectionFromKey(key: string): Direction | null {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";

  return null;
}

function isActivationKey(key: string) {
  return (
    key === "Enter" ||
    key === "NumpadEnter" ||
    key === " " ||
    key === "Spacebar" ||
    key === "OK" ||
    key === "Accept"
  );
}

function shouldWakeHiddenWatchOverlay(key: string) {
  return (
    getDirectionFromKey(key) !== null ||
    isActivationKey(key)
  );
}

function getHiddenWatchOverlay() {
  return document.querySelector<HTMLElement>(
    "[data-tv-overlay='watch'][data-tv-overlay-visible='false']"
  );
}

function isBackKey(key: string) {
  return key === "Escape" || key === "Backspace" || key === "BrowserBack";
}

function isTextInput(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    element.isContentEditable
  );
}

function shouldLetInputHandleKey(element: Element | null, key: string) {
  if (!isTextInput(element)) return false;

  return key === "ArrowLeft" || key === "ArrowRight";
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
      ? root.querySelector<HTMLElement>("[data-tv-default]")
      : document.querySelector<HTMLElement>("[data-tv-default]");

  if (defaultElement && isVisibleElement(defaultElement)) {
    return defaultElement;
  }

  return getFocusableElements(root)[0] || null;
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

function getLinearCandidate(
  current: HTMLElement,
  root: ParentNode,
  elements: HTMLElement[],
  direction: Direction
) {
  const rows = buildRows(root, elements);

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

  if (rowIndex < 0 || itemIndex < 0) {
    return elements[0] || null;
  }

  const currentRow = rows[rowIndex];
  const previousRow = rows[rowIndex - 1];
  const nextRow = rows[rowIndex + 1];

  if (direction === "right") {
    return currentRow[itemIndex + 1]?.element || nextRow?.[0]?.element || null;
  }

  if (direction === "left") {
    return (
      currentRow[itemIndex - 1]?.element ||
      previousRow?.[previousRow.length - 1]?.element ||
      null
    );
  }

  if (direction === "down") {
    return nextRow?.[0]?.element || null;
  }

  if (direction === "up") {
    return previousRow?.[0]?.element || null;
  }

  return null;
}

function focusElement(element: HTMLElement) {
  element.focus({
    preventScroll: true,
  });

  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
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

function handleBack(event: KeyboardEvent) {
  const modalScope = getModalScope();

  if (modalScope) {
    const closeButton = modalScope.querySelector<HTMLElement>("[data-tv-close]");

    if (closeButton) {
      event.preventDefault();
      closeButton.click();
      return;
    }
  }

  if (window.history.length > 1) {
    event.preventDefault();
    window.history.back();
  }
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

const activeElement = document.activeElement;

// Giống TV app:
// overlay đang ẩn thì phím đầu tiên chỉ đánh thức overlay,
// chưa điều hướng / chưa bấm nút.
if (
  !isTextInput(activeElement) &&
  shouldWakeHiddenWatchOverlay(event.key)
) {
  const hiddenOverlay = getHiddenWatchOverlay();

  if (hiddenOverlay) {
    event.preventDefault();
    window.dispatchEvent(new Event("baoflix-show-tv-overlay"));
    return;
  }
}

if (isBackKey(event.key) && !isTextInput(activeElement)) {
  handleBack(event);
  return;
}

      if (isActivationKey(event.key) && !isTextInput(activeElement)) {
        clickActiveElement(event);
        return;
      }

      const direction = getDirectionFromKey(event.key);
      if (!direction) return;

      if (shouldLetInputHandleKey(activeElement, event.key)) return;

      if (
        direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")
      ) {
        const firstMainElement = getFirstMainFocusableElement();

        if (firstMainElement) {
          event.preventDefault();
          focusElement(firstMainElement);
        }

        return;
      }

      const modalScope = getModalScope();
      const activeScope = getActiveScope(activeElement);

      const root = modalScope || activeScope || getMainScope() || document;
      const focusableElements = getFocusableElements(root);

      if (!focusableElements.length) return;

      const current =
        activeElement instanceof HTMLElement &&
        focusableElements.includes(activeElement)
          ? activeElement
          : null;

      if (!current) {
        event.preventDefault();

        const defaultElement = getDefaultFocusable(root);

        if (defaultElement) {
          focusElement(defaultElement);
        }

        return;
      }

      const nextElement = getLinearCandidate(
        current,
        root,
        focusableElements,
        direction
      );

      if (!nextElement) {
        if (
          root instanceof HTMLElement &&
          (root.dataset.tvLock === "true" || root.dataset.tvModal)
        ) {
          event.preventDefault();
        }

        return;
      }

      event.preventDefault();
      focusElement(nextElement);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, pathname]);

  return null;
}