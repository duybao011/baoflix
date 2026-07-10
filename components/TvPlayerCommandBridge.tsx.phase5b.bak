"use client";
import { isTvModeActive } from "@/lib/tvMode";

import { useEffect } from "react";

type PlayerCommandAction =
  | "seek"
  | "toggle-play"
  | "play"
  | "pause"
  | "focus-player";

type PlayerCommand = {
  action?: PlayerCommandAction;
  seconds?: number;
};

type NativeBridge = {
  sendCommand?: (command: string) => void;
  focusPlayer?: () => void;
  seekForward?: () => void;
  seekBackward?: () => void;
  togglePlay?: () => void;
};

type NativeSeekDirection = "backward" | "forward";

declare global {
  interface Window {
    BaoFlixTVNative?: NativeBridge;
    BaoFlixTVWeb?: {
      onNativeSeekKey?: (direction: NativeSeekDirection) => void;
      focusPlayer?: () => boolean;
    };
    __baoflixFocusWebPlayer?: () => boolean;
  }
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
    iframe.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  } catch {
    return false;
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

function dispatchIframeKeyboardEvent(target: HTMLElement, key: string) {
  const code = key === " " ? "Space" : key;

  ["keydown", "keypress", "keyup"].forEach((type) => {
    target.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

function sendSafePostMessage(command: PlayerCommand) {
  const iframe = getVisiblePlayerIframe();

  if (!iframe) return false;

  try {
    iframe.contentWindow?.postMessage(
      {
        source: "baoflix-tv",
        type: "baoflix-player-command",
        action: command.action,
        seconds: command.seconds,
      },
      "*"
    );

    return true;
  } catch {
    return false;
  }
}

function callNativeBridge(command: PlayerCommand) {
  const bridge = window.BaoFlixTVNative;

  if (!bridge) return false;

  const nativeCommand =
    command.action === "focus-player"
      ? "focus-player"
      : command.action === "seek"
        ? Number(command.seconds || 0) < 0
          ? "seek-backward"
          : "seek-forward"
        : command.action === "toggle-play" ||
            command.action === "play" ||
            command.action === "pause"
          ? "toggle-play"
          : "focus-player";

  try {
    if (typeof bridge.sendCommand === "function") {
      bridge.sendCommand(nativeCommand);
      return true;
    }

    if (nativeCommand === "focus-player" && bridge.focusPlayer) {
      bridge.focusPlayer();
      return true;
    }

    if (nativeCommand === "seek-forward" && bridge.seekForward) {
      bridge.seekForward();
      return true;
    }

    if (nativeCommand === "seek-backward" && bridge.seekBackward) {
      bridge.seekBackward();
      return true;
    }

    if (nativeCommand === "toggle-play" && bridge.togglePlay) {
      bridge.togglePlay();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function notifyNativeMissing(command: PlayerCommand) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-native-missing", {
      detail: command,
    })
  );
}

function emitBridgeHud(command: PlayerCommand) {
  if (command.action === "seek") {
    window.dispatchEvent(
      new CustomEvent("baoflix-tv-player-hud", {
        detail: {
          type: "seek",
          delta: command.seconds || 10,
        },
      })
    );
    return;
  }

  if (command.action === "play") {
    window.dispatchEvent(new CustomEvent("baoflix-tv-player-hud", { detail: { type: "play" } }));
    return;
  }

  if (command.action === "pause") {
    window.dispatchEvent(new CustomEvent("baoflix-tv-player-hud", { detail: { type: "pause" } }));
    return;
  }

  if (command.action === "toggle-play") {
    window.dispatchEvent(new CustomEvent("baoflix-tv-player-hud", { detail: { type: "toggle" } }));
  }
}

function handleIframeOnlyCommand(command: PlayerCommand) {
  const nativeHandled = callNativeBridge(command);

  const focused = focusIframePlayer();
  const iframe = getVisiblePlayerIframe();

  if (iframe) {
    dispatchIframeKeyboardEvent(iframe, keyForCommand(command));
    sendSafePostMessage(command);
  }

  if (!nativeHandled && command.action === "seek") {
    notifyNativeMissing(command);
  }

  const handled = nativeHandled || focused || Boolean(iframe);
  if (handled) emitBridgeHud(command);

  return handled;
}

export default function TvPlayerCommandBridge() {
  useEffect(() => {
    function handleCommand(event: Event) {
      if (!isTvModeActive({ allowSessionOnDesktop: false })) return;

      const command = (event as CustomEvent<PlayerCommand>).detail || {};

      handleIframeOnlyCommand(command);
    }

    window.__baoflixFocusWebPlayer = () => {
      if (!isTvModeActive({ allowSessionOnDesktop: false })) return false;
      return focusIframePlayer();
    };
    window.BaoFlixTVWeb = {
      focusPlayer() {
        if (!isTvModeActive({ allowSessionOnDesktop: false })) return false;
        return focusIframePlayer();
      },
      onNativeSeekKey(direction) {
        if (!isTvModeActive({ allowSessionOnDesktop: false })) return;
        handleIframeOnlyCommand({
          action: "seek",
          seconds: direction === "forward" ? 10 : -10,
        });
      },
    };

    window.addEventListener("baoflix-tv-player-command", handleCommand);

    return () => {
      window.removeEventListener("baoflix-tv-player-command", handleCommand);
      delete window.__baoflixFocusWebPlayer;
      delete window.BaoFlixTVWeb;
    };
  }, []);

  return null;
}
