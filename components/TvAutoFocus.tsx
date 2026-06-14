"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { restoreLastTvFocus } from "@/lib/tvFocusMemory";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[role='button']:not([aria-disabled='true'])",
  "[data-tv-focus]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const TV_SESSION_KEY = "baoflix_tv_mode";
const TV_LOCAL_KEY = "baoflix_tv_mode";

function isLikelyTvDevice() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod|android.+mobile|mobile/.test(userAgent)) {
    return false;
  }

  if (
    /android tv|google tv|googletv|smart-tv|smarttv|hbbtv|tcl|bravia|aft|shield|mitv|hisense|viera|webos|netcast|roku/.test(
      userAgent
    )
  ) {
    return true;
  }

  return (
    userAgent.includes("android") &&
    !userAgent.includes("mobile") &&
    Math.min(window.screen.width, window.screen.height) >= 720
  );
}

function isTvAutoFocusEnabled() {
  if (typeof window === "undefined") return false;

  try {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("tv") === "0") return false;
    if (searchParams.get("tv") === "1") return true;

    const sessionValue = sessionStorage.getItem(TV_SESSION_KEY);
    const localValue = localStorage.getItem(TV_LOCAL_KEY);
    const storedMode = sessionValue ?? localValue;

    if (storedMode === "0") return false;
    if (storedMode === "1") return true;

    return isLikelyTvDevice();
  } catch {
    return false;
  }
}

function isVisibleElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  if (element.closest("[inert]")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[aria-hidden='true']")) return false;
  if (element.closest("[data-tv-overlay='watch'][data-tv-overlay-visible='false']")) return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  if (rect.width < 2 || rect.height < 2) return false;

  return true;
}

function prepareTvFocusableElement(element: HTMLElement) {
  if (element.hasAttribute("data-tv-focus") && element.tabIndex < 0) {
    element.tabIndex = 0;
  }
}

function focusElement(element: HTMLElement) {
  prepareTvFocusableElement(element);

  element.focus({
    preventScroll: true,
  });

  element.scrollIntoView({
    behavior: isLikelyTvDevice() ? "auto" : "smooth",
    block: "center",
    inline: "center",
  });
}

function findFirstFocusable(scope: HTMLElement) {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => {
      prepareTvFocusableElement(element);
      return true;
    })
    .filter(isVisibleElement)
    .filter((element) => element.tabIndex !== -1)
    .filter((element) => !element.hasAttribute("data-tv-skip"))
    .filter((element) => !element.closest("[data-tv-skip]"))[0];
}

export default function TvAutoFocus() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    function refreshEnabled() {
      setEnabled(isTvAutoFocusEnabled());
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

    const timer = window.setTimeout(() => {
      const modal = document.querySelector<HTMLElement>("[data-tv-modal][data-tv-scope]");

      const scope =
        modal ||
        document.querySelector<HTMLElement>(
          "[data-tv-overlay='watch'][data-tv-overlay-visible='true']"
        ) ||
        document.querySelector<HTMLElement>(
          "main [data-tv-scope][data-tv-autofocus='true']"
        ) ||
        document.querySelector<HTMLElement>("main [data-tv-scope]");

      if (!scope) return;

      const restored = restoreLastTvFocus(scope, undefined, {
        // Modal chọn tập nên ưu tiên data-tv-default/current episode,
        // tránh fallback theo index của focus ngoài trang.
        allowIndexFallback: !modal,
      });

      if (restored) return;

      const defaultElement = scope.querySelector<HTMLElement>(
        "[data-tv-default], [data-tv-overlay-default], [data-tv-action='episode-list']"
      );

      if (defaultElement && isVisibleElement(defaultElement)) {
        focusElement(defaultElement);
        return;
      }

      const firstFocusable = findFirstFocusable(scope);

      if (firstFocusable) {
        focusElement(firstFocusable);
      }
    }, 160);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, pathname]);

  return null;
}
