"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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

function findFirstFocusable(scope: HTMLElement) {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(isVisibleElement)
    .filter((element) => element.tabIndex !== -1)
    .filter((element) => !element.hasAttribute("data-tv-skip"))[0];
}

export default function TvAutoFocus() {
  const pathname = usePathname();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const modal = document.querySelector<HTMLElement>(
        "[data-tv-modal][data-tv-scope]"
      );

      const scope =
        modal ||
        document.querySelector<HTMLElement>(
          "main [data-tv-scope][data-tv-autofocus='true']"
        );

      if (!scope) return;

      const defaultElement =
        scope.querySelector<HTMLElement>("[data-tv-default]");

      if (defaultElement && isVisibleElement(defaultElement)) {
        focusElement(defaultElement);
        return;
      }

      const firstFocusable = findFirstFocusable(scope);

      if (firstFocusable) {
        focusElement(firstFocusable);
      }
    }, 140);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}