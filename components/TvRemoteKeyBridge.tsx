"use client";

import { useEffect } from "react";

type RemoteKeyboardEvent = KeyboardEvent & {
  __baoflixSyntheticRemoteKey?: boolean;
};

type NativeRemoteEvent = CustomEvent<{
  keyCode?: number;
  repeat?: number;
  source?: string;
}>;

const ANDROID_TV_KEY_TO_WEB_KEY: Record<number, string> = {
  4: "Escape", // KEYCODE_BACK
  19: "ArrowUp", // KEYCODE_DPAD_UP
  20: "ArrowDown", // KEYCODE_DPAD_DOWN
  21: "ArrowLeft", // KEYCODE_DPAD_LEFT
  22: "ArrowRight", // KEYCODE_DPAD_RIGHT
  23: "Enter", // KEYCODE_DPAD_CENTER
  66: "Enter", // KEYCODE_ENTER
  82: "Enter", // KEYCODE_MENU: dùng như mở menu/overlay
  85: "MediaPlayPause", // KEYCODE_MEDIA_PLAY_PAUSE
  87: "MediaTrackNext", // KEYCODE_MEDIA_NEXT
  88: "MediaTrackPrevious", // KEYCODE_MEDIA_PREVIOUS
  89: "MediaRewind", // KEYCODE_MEDIA_REWIND
  90: "MediaFastForward", // KEYCODE_MEDIA_FAST_FORWARD
  96: "Enter", // KEYCODE_BUTTON_A
  97: "Escape", // KEYCODE_BUTTON_B
  109: "Enter", // KEYCODE_BUTTON_SELECT
  126: "Play", // KEYCODE_MEDIA_PLAY
  127: "Pause", // KEYCODE_MEDIA_PAUSE
  160: "Enter", // KEYCODE_NUMPAD_ENTER
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

function shouldLetTextInputHandle(event: KeyboardEvent) {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement)) return false;

  const tagName = active.tagName.toLowerCase();
  const isTextInput =
    tagName === "input" || tagName === "textarea" || active.isContentEditable;

  if (!isTextInput) return false;

  // Khi đang nhập tìm kiếm, cho text input giữ trái/phải để sửa chữ.
  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}

function dispatchSyntheticKey(key: string, keyCode: number, repeat = 0) {
  const syntheticEvent = new KeyboardEvent("keydown", {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    repeat: repeat > 0,
  }) as RemoteKeyboardEvent;

  syntheticEvent.__baoflixSyntheticRemoteKey = true;

  Object.defineProperty(syntheticEvent, "keyCode", {
    configurable: true,
    get: () => keyCode,
  });

  Object.defineProperty(syntheticEvent, "which", {
    configurable: true,
    get: () => keyCode,
  });

  document.dispatchEvent(syntheticEvent);
}

function mapAndDispatchAndroidKey(keyCode: number, repeat = 0) {
  const mappedKey = ANDROID_TV_KEY_TO_WEB_KEY[keyCode];

  if (!mappedKey) return false;

  dispatchSyntheticKey(mappedKey, keyCode, repeat);
  return true;
}

export default function TvRemoteKeyBridge() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const remoteEvent = event as RemoteKeyboardEvent;

      if (remoteEvent.__baoflixSyntheticRemoteKey) return;
      if (shouldLetTextInputHandle(event)) return;

      // Nếu browser/WebView đã trả key chuẩn, để TvRemoteNavigator xử lý như cũ.
      if (WEB_KEYS_ALREADY_OK.has(event.key)) return;

      const keyCode = getAndroidKeyCode(event);
      const mapped = ANDROID_TV_KEY_TO_WEB_KEY[keyCode];

      if (!mapped) return;

      // TCL/Google TV WebView đôi khi trả event.key = "Unidentified" nhưng keyCode vẫn đúng.
      // Chặn event gốc rồi phát lại event chuẩn để navigator nghe được.
      event.preventDefault();
      event.stopImmediatePropagation();

      mapAndDispatchAndroidKey(keyCode, event.repeat ? 1 : 0);
    }

    function handleNativeRemoteKey(event: Event) {
      const detail = (event as NativeRemoteEvent).detail || {};
      const keyCode = Number(detail.keyCode || 0);
      const repeat = Number(detail.repeat || 0);

      if (!keyCode) return;

      // Nếu iframe/embed đang có focus, native bridge vẫn bơm event về app shell được.
      // Đây là đường cứu TCL WebView khi keydown không nổi lên document.
      const activeTag = getActiveElementTag();

      if (activeTag === "iframe") {
        try {
          (document.activeElement as HTMLElement | null)?.blur();
        } catch {
          // ignore
        }
      }

      mapAndDispatchAndroidKey(keyCode, repeat);
    }

    // capture=true để bridge chạy trước navigator.
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("baoflix-native-remote-key", handleNativeRemoteKey);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("baoflix-native-remote-key", handleNativeRemoteKey);
    };
  }, []);

  return null;
}
