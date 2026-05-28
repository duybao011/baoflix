"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  findClosestTvFocusableElement,
  isTvFocusMemoryEnabled,
  rememberTvFocusFromElement,
} from "@/lib/tvFocusMemory";

function isMemorySaveKey(key: string) {
  return (
    key === "Enter" ||
    key === "NumpadEnter" ||
    key === " " ||
    key === "Spacebar" ||
    key === "OK" ||
    key === "Accept" ||
    key === "Escape" ||
    key === "Backspace" ||
    key === "BrowserBack"
  );
}

export default function TvFocusMemory() {
  const pathname = usePathname();

  useEffect(() => {
    function saveFromTarget(target: EventTarget | null) {
      if (!isTvFocusMemoryEnabled()) return;

      const focusable = findClosestTvFocusableElement(target);

      if (focusable) {
        rememberTvFocusFromElement(focusable);
      }
    }

    function handleFocusIn(event: FocusEvent) {
      saveFromTarget(event.target);
    }

    function handlePointerDown(event: PointerEvent) {
      saveFromTarget(event.target);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isMemorySaveKey(event.key)) return;

      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLElement) {
        rememberTvFocusFromElement(activeElement);
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [pathname]);

  return null;
}
