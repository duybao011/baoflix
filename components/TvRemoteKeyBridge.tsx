"use client";

import { useEffect } from "react";

type RemoteKeyboardEvent = KeyboardEvent & {
  __baoflixSyntheticRemoteKey?: boolean;
};

type NativeRemoteEvent = CustomEvent<{
  key?: string;
  keyCode?: number;
  repeat?: number;
  source?: string;
}>;

const ANDROID_TV_KEY_TO_WEB_KEY: Record<number, string> = {
  4: "Escape",
  19: "ArrowUp",
  20: "ArrowDown",
  21: "ArrowLeft",
  22: "ArrowRight",
  23: "Enter",
  66: "Enter",
  82: "ContextMenu",
  85: "MediaPlayPause",
  87: "MediaTrackNext",
  88: "MediaTrackPrevious",
  89: "MediaRewind",
  90: "MediaFastForward",
  96: "Enter",
  97: "Escape",
  109: "Enter",
  126: "Play",
  127: "Pause",
  160: "Enter",
};

const WEB_KEY_ALIASES: Record<string, string> = {
  Back: "Escape",
  GoBack: "Escape",
  XF86Back: "Escape",
  Select: "Enter",
  DPadCenter: "Enter",
  DPAD_CENTER: "Enter",
};

const WEB_KEYS_ALREADY_OK = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "NumpadEnter",
  " ",
  "Spacebar",
  "OK",
  "Accept",
  "Escape",
  "Backspace",
  "BrowserBack",
  "ContextMenu",
  "MediaPlayPause",
  "MediaRewind",
  "MediaFastForward",
  "Play",
  "Pause",
]);

function getAndroidKeyCode(event: KeyboardEvent) {
  const legacyEvent = event as KeyboardEvent & {
    keyCode?: number;
    which?: number;
  };

  return legacyEvent.keyCode || legacyEvent.which || 0;
}

function getActiveElementTag() {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement)) return "";

  return active.tagName.toLowerCase();
}

function shouldLetEditableHandle(event: KeyboardEvent) {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement)) return false;

  if (event.isComposing || event.key === "Process" || event.keyCode === 229) {
    return true;
  }

  if (active.isContentEditable) return true;

  if (active instanceof HTMLTextAreaElement) {
    return !active.readOnly && !active.disabled;
  }

  if (active instanceof HTMLInputElement) {
    const nonTextTypes = new Set([
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ]);

    if (nonTextTypes.has(active.type)) return false;
    return !active.readOnly && !active.disabled;
  }

  return false;
}

function dispatchSyntheticKey(key: string, keyCode = 0, repeat = 0) {
  const syntheticEvent = new KeyboardEvent("keydown", {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    repeat: repeat > 0,
  }) as RemoteKeyboardEvent;

  syntheticEvent.__baoflixSyntheticRemoteKey = true;

  if (keyCode > 0) {
    Object.defineProperty(syntheticEvent, "keyCode", {
      configurable: true,
      get: () => keyCode,
    });

    Object.defineProperty(syntheticEvent, "which", {
      configurable: true,
      get: () => keyCode,
    });
  }

  document.dispatchEvent(syntheticEvent);
}

function shouldUseLegacyAndroidKeyCode(event: KeyboardEvent) {
  const key = String(event.key || "");

  // Bàn phím máy tính có event.key rõ ràng ("b", "r", "u"...).
  // Chỉ fallback sang keyCode khi TV/WebView không cung cấp tên phím.
  return key === "" || key === "Unidentified";
}

function getMappedKeyFromKeyboardEvent(event: KeyboardEvent) {
  const alias = WEB_KEY_ALIASES[event.key];

  if (alias) {
    return {
      key: alias,
      keyCode: getAndroidKeyCode(event),
    };
  }

  if (!shouldUseLegacyAndroidKeyCode(event)) return null;

  const keyCode = getAndroidKeyCode(event);
  const mappedKey = ANDROID_TV_KEY_TO_WEB_KEY[keyCode];

  if (!mappedKey) return null;

  return {
    key: mappedKey,
    keyCode,
  };
}

function blurIframeIfNeeded() {
  if (getActiveElementTag() !== "iframe") return;

  try {
    (document.activeElement as HTMLElement | null)?.blur();
  } catch {
    // ignore
  }
}

export default function TvRemoteKeyBridge() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const remoteEvent = event as RemoteKeyboardEvent;

      if (remoteEvent.__baoflixSyntheticRemoteKey) return;
      if (shouldLetEditableHandle(event)) return;

      if (WEB_KEYS_ALREADY_OK.has(event.key)) return;

      const mapped = getMappedKeyFromKeyboardEvent(event);

      if (!mapped) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      dispatchSyntheticKey(mapped.key, mapped.keyCode, event.repeat ? 1 : 0);
    }

    function handleNativeRemoteKey(event: Event) {
      const detail = (event as NativeRemoteEvent).detail || {};
      const keyCode = Number(detail.keyCode || 0);
      const repeat = Number(detail.repeat || 0);
      const mappedKey =
        (detail.key && WEB_KEY_ALIASES[detail.key]) ||
        (detail.key && WEB_KEYS_ALREADY_OK.has(detail.key) ? detail.key : "") ||
        ANDROID_TV_KEY_TO_WEB_KEY[keyCode];

      if (!mappedKey) return;

      blurIframeIfNeeded();
      dispatchSyntheticKey(mappedKey, keyCode, repeat);
    }

    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("baoflix-native-remote-key", handleNativeRemoteKey);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("baoflix-native-remote-key", handleNativeRemoteKey);
    };
  }, []);

  return null;
}
