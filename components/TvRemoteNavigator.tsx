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

const ROW_THRESHOLD = 22;
const TV_SESSION_KEY = "baoflix_tv_mode";
const SEEK_SECONDS = 10;

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

function isBackKey(key: string) {
  return key === "Escape" || key === "Backspace" || key === "BrowserBack";
}

function isSeekBackwardKey(key: string) {
  return key === "ArrowLeft" || key === "MediaRewind";
}

function isSeekForwardKey(key: string) {
  return key === "ArrowRight" || key === "MediaFastForward";
}

function isPlayPauseKey(key: string) {
  return key === "MediaPlayPause" || key === "Play" || key === "Pause";
}

function shouldWakeHiddenWatchOverlay(key: string) {
  const direction = getDirectionFromKey(key);

  // Khi overlay ẩn:
  // - Left/Right được xử lý riêng: HLS tua trực tiếp, iframe thì bật nút tua kiểu bắc cầu.
  // - Up/Down/OK gọi overlay giống TV player.
  return direction === "up" || direction === "down" || isActivationKey(key);
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

function isTextInput(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();

  return (
    tagName === "input" || tagName === "textarea" || element.isContentEditable
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
  const currentEntry = currentRow[itemIndex];

  // TV app style:
  // - Left/Right chỉ đi trong hàng hiện tại, tới mép thì đứng lại.
  // - Up/Down mới đổi hàng, ưu tiên item gần cùng trục ngang nhất.
  if (direction === "right") {
    return currentRow[itemIndex + 1]?.element || current;
  }

  if (direction === "left") {
    return currentRow[itemIndex - 1]?.element || current;
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

function focusOverlaySeekButton(direction: SeekDirection) {
  window.setTimeout(() => {
    const overlay = getVisibleWatchOverlay();

    if (!overlay) return;

    const target = getOverlaySeekFocusable(overlay, direction);

    if (!target) return;

    focusElement(target);
  }, 80);
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

function getFallbackBackHref() {
  const path = window.location.pathname;
  const normalWatchMatch = path.match(/^\/xem\/([^/?#]+)/);
  const customWatchMatch = path.match(/^\/ca-nhan\/([^/]+)\/xem/);

  if (normalWatchMatch?.[1]) {
    return `/phim/${normalWatchMatch[1]}`;
  }

  if (customWatchMatch?.[1]) {
    return `/ca-nhan/${customWatchMatch[1]}`;
  }

  if (isTvRemoteEnabled() && path !== "/tv") {
    return "/tv";
  }

  if (path !== "/") {
    return "/";
  }

  return "/tv";
}

function goBack(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = getFallbackBackHref();
}

function dispatchShowOverlay(options?: { pinned?: boolean; focus?: boolean }) {
  window.dispatchEvent(
    new CustomEvent("baoflix-show-tv-overlay", {
      detail: {
        pinned: Boolean(options?.pinned),
        focus: options?.focus ?? true,
      },
    })
  );
}

function dispatchHideOverlay() {
  window.dispatchEvent(new Event("baoflix-hide-tv-overlay"));
}

function dispatchPlayerCommand(action: PlayerCommandAction, seconds?: number) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-player-command", {
      detail: {
        action,
        seconds,
      },
    })
  );
}

function focusPlayer() {
  window.dispatchEvent(new Event("baoflix-focus-tv-player"));
}

function getVisibleVideo() {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));

  return videos.find((video) => isVisibleElement(video)) || null;
}

function getVisiblePlayerIframe() {
  const iframes = Array.from(
    document.querySelectorAll<HTMLIFrameElement>(
      "iframe[data-tv-player='iframe'], iframe"
    )
  );

  return iframes.find((iframe) => isVisibleElement(iframe)) || null;
}

function focusIframePlayer() {
  const iframe = getVisiblePlayerIframe();

  if (!iframe) return false;

  try {
    iframe.focus({ preventScroll: true });
  } catch {
    focusPlayer();
  }

  return true;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function showPlayerHud(detail: {
  type: "seek" | "play" | "pause";
  delta?: number;
  currentTime?: number;
  duration?: number;
}) {
  window.dispatchEvent(new CustomEvent("baoflix-tv-player-hud", { detail }));
}

function seekVideo(video: HTMLVideoElement, delta: number) {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const maxTime = duration > 0 ? Math.max(duration - 1, 0) : Number.MAX_SAFE_INTEGER;
  const nextTime = clamp(video.currentTime + delta, 0, maxTime);

  video.currentTime = nextTime;

  focusPlayer();

  showPlayerHud({
    type: "seek",
    delta,
    currentTime: nextTime,
    duration: duration > 0 ? duration : undefined,
  });
}

function playVideo(video: HTMLVideoElement) {
  void video
    .play()
    .then(() => {
      showPlayerHud({ type: "play" });
      window.dispatchEvent(new Event("baoflix-tv-player-playing"));
      dispatchHideOverlay();
      focusPlayer();
    })
    .catch(() => {
      // Một số browser/WebView chặn play nếu không xem là user gesture.
    });
}

function pauseVideo(video: HTMLVideoElement) {
  video.pause();
  showPlayerHud({ type: "pause" });
  window.dispatchEvent(new Event("baoflix-tv-player-paused"));
  dispatchShowOverlay({ pinned: true, focus: false });
}

function handlePlayPauseVideo(video: HTMLVideoElement, key: string) {
  if (key === "Play") {
    if (video.paused) {
      playVideo(video);
    }

    return;
  }

  if (key === "Pause") {
    if (!video.paused) {
      pauseVideo(video);
    }

    return;
  }

  if (video.paused) {
    playVideo(video);
  } else {
    pauseVideo(video);
  }
}

function handleHiddenWatchOverlayKey(event: KeyboardEvent) {
  const isBackward = isSeekBackwardKey(event.key);
  const isForward = isSeekForwardKey(event.key);
  const wantsPlayPause = isPlayPauseKey(event.key);

  if (!isBackward && !isForward && !wantsPlayPause) return false;

  const video = getVisibleVideo();

  if (video) {
    event.preventDefault();
    event.stopPropagation();

    if (wantsPlayPause) {
      handlePlayPauseVideo(video, event.key);
    } else {
      seekVideo(video, isForward ? SEEK_SECONDS : -SEEK_SECONDS);
    }

    return true;
  }

  if (wantsPlayPause) {
    event.preventDefault();
    event.stopPropagation();
    dispatchPlayerCommand("toggle-play");
    return true;
  }

  // Iframe server ngoài không tua/play trực tiếp chắc chắn được.
  // Thay vì thả focus vào iframe, bật overlay và trỏ đúng nút tua 10s để user OK kiểu bắc cầu.
  event.preventDefault();
  event.stopPropagation();

  dispatchShowOverlay({ pinned: true, focus: false });
  focusOverlaySeekButton(isForward ? "forward" : "backward");

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const activeElement = document.activeElement;
      const openModalScope = getModalScope();
      const hiddenOverlay = getHiddenWatchOverlay();
      const visibleOverlay = getVisibleWatchOverlay();
      const activeIsInsideVisibleOverlay =
        visibleOverlay &&
        activeElement instanceof HTMLElement &&
        visibleOverlay.contains(activeElement);

      if (isBackKey(event.key) && !isTextInput(activeElement)) {
        if (closeModalIfNeeded(event)) return;

        if (visibleOverlay) {
          event.preventDefault();
          event.stopPropagation();
          dispatchHideOverlay();
          return;
        }

        goBack(event);
        return;
      }

      // Media key riêng của một số remote: xử lý HLS video trực tiếp.
      // Nếu là iframe, gửi lệnh fallback sang bridge.
      if (
        !openModalScope &&
        !isTextInput(activeElement) &&
        (event.key === "MediaRewind" ||
          event.key === "MediaFastForward" ||
          isPlayPauseKey(event.key))
      ) {
        if (hiddenOverlay && handleHiddenWatchOverlayKey(event)) {
          return;
        }

        const video = getVisibleVideo();

        if (video) {
          event.preventDefault();
          event.stopPropagation();

          if (isPlayPauseKey(event.key)) {
            handlePlayPauseVideo(video, event.key);
          } else {
            seekVideo(
              video,
              event.key === "MediaFastForward" ? SEEK_SECONDS : -SEEK_SECONDS
            );
          }

          return;
        }

        if (isPlayPauseKey(event.key) || event.key === "MediaRewind" || event.key === "MediaFastForward") {
          event.preventDefault();
          event.stopPropagation();

          dispatchPlayerCommand(
            isPlayPauseKey(event.key) ? "toggle-play" : "seek",
            event.key === "MediaRewind" ? -SEEK_SECONDS : SEEK_SECONDS
          );

          return;
        }

        if (focusIframePlayer()) {
          return;
        }
      }

      // Khi đang xem TV immersive và overlay đang ẩn:
      // - Left/Right: HLS seek trực tiếp, iframe thì bật overlay và focus nút tua.
      // - Up/Down/OK: gọi overlay.
      if (!openModalScope && !isTextInput(activeElement) && hiddenOverlay) {
        if (handleHiddenWatchOverlayKey(event)) {
          return;
        }

        if (shouldWakeHiddenWatchOverlay(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          dispatchShowOverlay({ pinned: false, focus: true });
          return;
        }
      }

      const direction = getDirectionFromKey(event.key);

      // Overlay đang hiện nhưng focus còn nằm ngoài overlay:
      // - Left/Right nhảy thẳng vào nút tua tương ứng.
      // - Up/Down/OK nhảy vào nút mặc định.
      if (
        visibleOverlay &&
        !activeIsInsideVisibleOverlay &&
        !openModalScope &&
        !isTextInput(activeElement) &&
        (direction || isActivationKey(event.key))
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (direction === "left" || direction === "right") {
          focusOverlaySeekButton(direction === "left" ? "backward" : "forward");
          return;
        }

        const target = getOverlayDefaultFocusable(visibleOverlay);

        if (target) {
          focusElement(target);
        }

        return;
      }

      if (isActivationKey(event.key) && !isTextInput(activeElement)) {
        clickActiveElement(event);
        return;
      }

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
          event.stopPropagation();
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
        event.stopPropagation();

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

      if (!nextElement || nextElement === current) {
        if (
          root instanceof HTMLElement &&
          (root.dataset.tvLock === "true" || root.dataset.tvModal)
        ) {
          event.preventDefault();
          event.stopPropagation();
        }

        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusElement(nextElement);
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, pathname]);

  return null;
}
