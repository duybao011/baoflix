"use client";

import { useEffect } from "react";

const LOC_FOCUS_KEY = "baoflix_tv_loc_focus_after_nav";
const ROUTE_EVENT_NAME = "baoflix-tv-route-change";

type FocusMode = "results" | "filter";

function isTvModeLikelyActive() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "1") return true;
    if (sessionStorage.getItem("baoflix_tv_mode") === "1") return true;
    return /baoflixtv|baoflix tv|android tv|google tv|smart-tv|smarttv|tizen|webos|bravia|shield|roku/i.test(
      navigator.userAgent
    );
  } catch {
    return false;
  }
}

function requestFocusLock(ms = 180) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-focus-lock", {
      detail: { ms },
    })
  );
}

function getVisibleTarget(selectors: string[]) {
  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const target = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      if (element.tabIndex === -1) return false;
      if (element.hasAttribute("data-tv-skip")) return false;
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      if (rect.width < 2 || rect.height < 2) return false;

      return true;
    });

    if (target) return target;
  }

  return null;
}

function focusElement(target: HTMLElement) {
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
}

function focusFilter() {
  const target = getVisibleTarget([
    "[data-tv-filter-panel] [data-tv-default]",
    "[data-tv-filter-panel] [data-tv-tab-active='true']",
    "[data-tv-filter-panel] button:not([disabled])",
  ]);

  if (!target) return false;

  focusElement(target);
  return true;
}

function focusResults() {
  const target = getVisibleTarget([
    "[data-tv-section='filter-results'] [data-tv-default]",
    "[data-tv-section='filter-results'] a[href]:not([data-tv-skip])",
    "[data-tv-section='filter-pagination'] [data-tv-page-current='true']",
    "[data-tv-section='filter-pagination'] a[href]:not([data-tv-skip])",
  ]);

  if (!target) return false;

  focusElement(target);
  return true;
}

function runFocusIntent(mode?: string | null) {
  const focusMode = mode === "filter" ? "filter" : "results";

  requestFocusLock(180);

  const delays = [80, 180, 320, 520, 760];

  delays.forEach((delay) => {
    window.setTimeout(() => {
      const done = focusMode === "filter" ? focusFilter() : focusResults();

      if (done) {
        try {
          sessionStorage.removeItem(LOC_FOCUS_KEY);
        } catch {
          // Ignore storage errors.
        }
      }
    }, delay);
  });
}

function readRequestedMode(): FocusMode | "" {
  try {
    const stored = sessionStorage.getItem(LOC_FOCUS_KEY);
    if (stored === "filter" || stored === "results") return stored;
  } catch {
    // Ignore storage errors.
  }

  if (window.location.hash === "#filter-results") return "results";
  return "";
}

export default function LocTvFocusManager() {
  useEffect(() => {
    if (!isTvModeLikelyActive()) return;

    function handleNavigationRequest(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest("[data-tv-loc-page-nav]")) {
        try {
          sessionStorage.setItem(LOC_FOCUS_KEY, "results");
        } catch {
          // Ignore storage errors.
        }
      }
    }

    function handleRouteSettled() {
      const mode = readRequestedMode();
      if (!mode) return;
      runFocusIntent(mode);
    }

    function handleManualFocus(event: Event) {
      const detail = (event as CustomEvent<{ mode?: FocusMode }>).detail || {};
      runFocusIntent(detail.mode || readRequestedMode() || "results");
    }

    document.addEventListener("click", handleNavigationRequest, true);
    window.addEventListener(ROUTE_EVENT_NAME, handleRouteSettled);
    window.addEventListener("popstate", handleRouteSettled);
    window.addEventListener("hashchange", handleRouteSettled);
    window.addEventListener("baoflix-tv-loc-focus", handleManualFocus as EventListener);

    handleRouteSettled();

    return () => {
      document.removeEventListener("click", handleNavigationRequest, true);
      window.removeEventListener(ROUTE_EVENT_NAME, handleRouteSettled);
      window.removeEventListener("popstate", handleRouteSettled);
      window.removeEventListener("hashchange", handleRouteSettled);
      window.removeEventListener("baoflix-tv-loc-focus", handleManualFocus as EventListener);
    };
  }, []);

  return null;
}
