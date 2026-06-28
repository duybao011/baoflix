"use client";

import { useEffect } from "react";

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

function isTextInput(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();

  return tagName === "input" || tagName === "textarea" || element.isContentEditable;
}

function getHiddenWatchOverlay() {
  return document.querySelector<HTMLElement>(
    "[data-tv-overlay='watch'][data-tv-overlay-visible='false']"
  );
}

function hasOpenTvModal() {
  return Boolean(document.querySelector("[data-tv-modal][data-tv-scope]"));
}

function focusSeekButton(direction: "backward" | "forward") {
  window.setTimeout(() => {
    const overlay = document.querySelector<HTMLElement>(
      "[data-tv-overlay='watch'][data-tv-overlay-visible='true']"
    );

    if (!overlay) return;

    const explicit = overlay.querySelector<HTMLElement>(
      `[data-tv-seek='${direction}']`
    );

    const target =
      explicit ||
      Array.from(overlay.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => {
          const text = button.textContent || "";
          return direction === "backward" ? text.includes("↶") : text.includes("↷");
        }
      );

    if (!target) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, 90);
}

function showOverlayForSeek(direction: "backward" | "forward") {
  window.dispatchEvent(
    new CustomEvent("baoflix-show-tv-overlay", {
      detail: {
        pinned: true,
        focus: false,
      },
    })
  );

  focusSeekButton(direction);
}

export default function TvSeekFocusBridge() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!isTvRemoteEnabled()) return;
      if (!getHiddenWatchOverlay()) return;
      if (hasOpenTvModal()) return;
      if (isTextInput(document.activeElement)) return;

      const wantsBackward = event.key === "ArrowLeft" || event.key === "MediaRewind";
      const wantsForward =
        event.key === "ArrowRight" || event.key === "MediaFastForward";

      if (!wantsBackward && !wantsForward) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      showOverlayForSeek(wantsBackward ? "backward" : "forward");
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return null;
}
