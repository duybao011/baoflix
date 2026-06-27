"use client";

import { useEffect } from "react";

const ANDROID_KEY_TO_WEB_KEY: Record<number, string> = {
  4: "Escape", // KEYCODE_BACK
  19: "ArrowUp", // KEYCODE_DPAD_UP
  20: "ArrowDown", // KEYCODE_DPAD_DOWN
  21: "ArrowLeft", // KEYCODE_DPAD_LEFT
  22: "ArrowRight", // KEYCODE_DPAD_RIGHT
  23: "Enter", // KEYCODE_DPAD_CENTER
  66: "Enter", // KEYCODE_ENTER
  85: "MediaPlayPause", // KEYCODE_MEDIA_PLAY_PAUSE
  89: "MediaRewind", // KEYCODE_MEDIA_REWIND
  90: "MediaFastForward", // KEYCODE_MEDIA_FAST_FORWARD
  126: "Play", // KEYCODE_MEDIA_PLAY
  127: "Pause", // KEYCODE_MEDIA_PAUSE
};

const ANDROID_KEY_NAME_TO_WEB_KEY: Record<string, string> = {
  BACK: "Escape",
  KEYCODE_BACK: "Escape",
  DPAD_UP: "ArrowUp",
  KEYCODE_DPAD_UP: "ArrowUp",
  DPAD_DOWN: "ArrowDown",
  KEYCODE_DPAD_DOWN: "ArrowDown",
  DPAD_LEFT: "ArrowLeft",
  KEYCODE_DPAD_LEFT: "ArrowLeft",
  DPAD_RIGHT: "ArrowRight",
  KEYCODE_DPAD_RIGHT: "ArrowRight",
  DPAD_CENTER: "Enter",
  KEYCODE_DPAD_CENTER: "Enter",
  ENTER: "Enter",
  KEYCODE_ENTER: "Enter",
  MEDIA_PLAY_PAUSE: "MediaPlayPause",
  KEYCODE_MEDIA_PLAY_PAUSE: "MediaPlayPause",
  MEDIA_REWIND: "MediaRewind",
  KEYCODE_MEDIA_REWIND: "MediaRewind",
  MEDIA_FAST_FORWARD: "MediaFastForward",
  KEYCODE_MEDIA_FAST_FORWARD: "MediaFastForward",
  MEDIA_PLAY: "Play",
  KEYCODE_MEDIA_PLAY: "Play",
  MEDIA_PAUSE: "Pause",
  KEYCODE_MEDIA_PAUSE: "Pause",
};

type NativeRemoteDetail = {
  key?: string;
  code?: string;
  keyCode?: number | string;
  which?: number | string;
};

const normalizedEvents = new WeakSet<Event>();

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeKeyName(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().toUpperCase().replace(/^KEYCODE_/, "KEYCODE_");
}

function getWebKeyFromNativeDetail(detail: NativeRemoteDetail) {
  const keyCode = toNumber(detail.keyCode || detail.which || detail.code);

  if (keyCode && ANDROID_KEY_TO_WEB_KEY[keyCode]) {
    return ANDROID_KEY_TO_WEB_KEY[keyCode];
  }

  const keyName = normalizeKeyName(detail.key || detail.code);

  if (keyName && ANDROID_KEY_NAME_TO_WEB_KEY[keyName]) {
    return ANDROID_KEY_NAME_TO_WEB_KEY[keyName];
  }

  return "";
}

function getWebKeyFromKeyboardEvent(event: KeyboardEvent) {
  if (
    event.key === "ArrowUp" ||
    event.key === "ArrowDown" ||
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "Enter" ||
    event.key === "Escape" ||
    event.key === "Backspace" ||
    event.key === "BrowserBack" ||
    event.key === "MediaPlayPause" ||
    event.key === "MediaRewind" ||
    event.key === "MediaFastForward" ||
    event.key === "Play" ||
    event.key === "Pause"
  ) {
    return "";
  }

  const keyCode = event.keyCode || event.which;

  return ANDROID_KEY_TO_WEB_KEY[keyCode] || "";
}

function getCodeForKey(key: string) {
  if (key === "ArrowUp") return "ArrowUp";
  if (key === "ArrowDown") return "ArrowDown";
  if (key === "ArrowLeft") return "ArrowLeft";
  if (key === "ArrowRight") return "ArrowRight";
  if (key === "Enter") return "Enter";
  if (key === "Escape") return "Escape";
  return key;
}

function dispatchNormalizedKey(key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    code: getCodeForKey(key),
    bubbles: true,
    cancelable: true,
  });

  normalizedEvents.add(event);
  document.dispatchEvent(event);
}

export default function TvRemoteKeyBridge() {
  useEffect(() => {
    function handleRawKeyDown(event: KeyboardEvent) {
      if (normalizedEvents.has(event)) return;

      const key = getWebKeyFromKeyboardEvent(event);

      if (!key) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      dispatchNormalizedKey(key);
    }

    function handleNativeRemote(event: Event) {
      const detail = (event as CustomEvent<NativeRemoteDetail>).detail || {};
      const key = getWebKeyFromNativeDetail(detail);

      if (!key) return;

      dispatchNormalizedKey(key);
    }

    document.addEventListener("keydown", handleRawKeyDown, true);
    window.addEventListener(
      "baoflix-tv-remote-key",
      handleNativeRemote as EventListener
    );

    return () => {
      document.removeEventListener("keydown", handleRawKeyDown, true);
      window.removeEventListener(
        "baoflix-tv-remote-key",
        handleNativeRemote as EventListener
      );
    };
  }, []);

  return null;
}
