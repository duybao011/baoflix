"use client";

import { useEffect } from "react";

type PlayerCommand = {
  action?: "seek" | "toggle-play" | "play" | "pause" | "focus-player";
  seconds?: number;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function focusPlayerSurface() {
  window.dispatchEvent(new Event("baoflix-focus-tv-player"));
}

function showPlayerHud(detail: {
  type: "seek" | "play" | "pause";
  delta?: number;
  currentTime?: number;
  duration?: number;
}) {
  window.dispatchEvent(new CustomEvent("baoflix-tv-player-hud", { detail }));
}

function focusIframePlayer({ hideOverlay = false }: { hideOverlay?: boolean } = {}) {
  const iframe = getVisiblePlayerIframe();

  if (!iframe) return false;

  try {
    iframe.focus({ preventScroll: true });
  } catch {
    focusPlayerSurface();
  }

  if (hideOverlay) {
    window.dispatchEvent(new Event("baoflix-hide-tv-overlay"));
  }

  return true;
}

function keyForCommand(command: PlayerCommand) {
  if (command.action === "seek") {
    return Number(command.seconds || 0) < 0 ? "ArrowLeft" : "ArrowRight";
  }

  if (
    command.action === "play" ||
    command.action === "pause" ||
    command.action === "toggle-play"
  ) {
    return " ";
  }

  return "Enter";
}

function dispatchIframeKeyboardEvent(target: EventTarget, key: string) {
  const keyboardEvent = new KeyboardEvent("keydown", {
    key,
    code: key === " " ? "Space" : key,
    bubbles: true,
    cancelable: true,
  });

  target.dispatchEvent(keyboardEvent);
}

function sendIframeRemoteKey(command: PlayerCommand) {
  const iframe = getVisiblePlayerIframe();

  if (!iframe) return false;

  const key = keyForCommand(command);

  try {
    iframe.focus({ preventScroll: true });
    dispatchIframeKeyboardEvent(iframe, key);
  } catch {
    return focusIframePlayer({ hideOverlay: false });
  }

  // Nếu iframe cùng origin hoặc WebView cho phép, thử gửi thêm vào contentWindow.
  // Với cross-origin player, trình duyệt có thể chặn phần này; khi đó app vẫn giữ overlay để user điều khiển thủ công.
  try {
    iframe.contentWindow?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        code: key === " " ? "Space" : key,
        bubbles: true,
        cancelable: true,
      })
    );
  } catch {
    // Cross-origin iframe không cho điều khiển trực tiếp.
  }

  return true;
}

function seekVideo(video: HTMLVideoElement, delta: number) {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const maxTime = duration > 0 ? Math.max(duration - 1, 0) : Number.MAX_SAFE_INTEGER;
  const nextTime = clamp(video.currentTime + delta, 0, maxTime);

  video.currentTime = nextTime;
  focusPlayerSurface();

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
      window.dispatchEvent(new Event("baoflix-hide-tv-overlay"));
      focusPlayerSurface();
    })
    .catch(() => {
      // WebView có thể chặn play nếu player không xem đây là user gesture.
    });
}

function pauseVideo(video: HTMLVideoElement) {
  video.pause();
  showPlayerHud({ type: "pause" });
  window.dispatchEvent(new Event("baoflix-tv-player-paused"));
  window.dispatchEvent(
    new CustomEvent("baoflix-show-tv-overlay", {
      detail: {
        pinned: true,
        focus: false,
      },
    })
  );
}

function handleVideoCommand(video: HTMLVideoElement, command: PlayerCommand) {
  if (command.action === "seek") {
    seekVideo(video, Number(command.seconds || 0));
    return true;
  }

  if (command.action === "play") {
    playVideo(video);
    return true;
  }

  if (command.action === "pause") {
    pauseVideo(video);
    return true;
  }

  if (command.action === "toggle-play") {
    if (video.paused) {
      playVideo(video);
    } else {
      pauseVideo(video);
    }

    return true;
  }

  if (command.action === "focus-player") {
    focusPlayerSurface();
    return true;
  }

  return false;
}

export default function TvPlayerCommandBridge() {
  useEffect(() => {
    function handleCommand(event: Event) {
      const command = (event as CustomEvent<PlayerCommand>).detail || {};

      const video = getVisibleVideo();

      if (video && handleVideoCommand(video, command)) {
        return;
      }

      // Iframe server ngoài thường cross-origin nên không đảm bảo tua/play trực tiếp.
      // Fallback tốt nhất: focus iframe và thử gửi phím, overlay vẫn được giữ để user thấy nút đang bấm.
      if (
        command.action === "seek" ||
        command.action === "toggle-play" ||
        command.action === "play" ||
        command.action === "pause"
      ) {
        if (sendIframeRemoteKey(command)) {
          return;
        }
      }

      focusIframePlayer({ hideOverlay: false });
    }

    window.addEventListener("baoflix-tv-player-command", handleCommand);

    return () => {
      window.removeEventListener("baoflix-tv-player-command", handleCommand);
    };
  }, []);

  return null;
}
