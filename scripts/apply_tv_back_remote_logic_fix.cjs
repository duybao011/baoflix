const fs = require("fs");
const path = require("path");

const root = process.cwd();

function target(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(target(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(target(relativePath), content, "utf8");
  console.log(`patched ${relativePath}`);
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Không tìm thấy block để sửa: ${label}`);
  }
  return content.replace(search, replacement);
}

function patchTvRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  let content = read(relativePath);

  if (!content.includes('const ROUTE_STACK_KEY = "baoflix_tv_route_stack_v1";')) {
    content = content.replace(
      `const FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";`,
      `const FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";
const ROUTE_STACK_KEY = "baoflix_tv_route_stack_v1";`
    );
  }

  if (!content.includes("function isTextDeleteBackspace(")) {
    content = content.replace(
      `function shouldLetInputHandleKey(element: Element | null, event: KeyboardEvent) {
  if (!isTextInput(element)) return false;
  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}`,
      `function shouldLetInputHandleKey(element: Element | null, event: KeyboardEvent) {
  if (!isTextInput(element)) return false;
  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}

function isTextDeleteBackspace(event: KeyboardEvent) {
  return (
    event.key === "Backspace" &&
    event.keyCode !== 4 &&
    event.keyCode !== 461 &&
    event.keyCode !== 10009
  );
}`
    );
  }

  if (!content.includes("function getVisibleSearchKeyboard()")) {
    content = replaceRequired(
      content,
      `function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");
  return getDefaultFocusable(scope || main || document);
}`,
      `function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");
  return getDefaultFocusable(scope || main || document);
}

function getVisibleSearchKeyboard() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-tv-search-keyboard]")).find(isVisibleElement) ||
    null
  );
}

function focusSearchKeyboard(pathname: string) {
  const keyboard = getVisibleSearchKeyboard();
  const target = keyboard ? getFocusableElements(keyboard)[0] : null;
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}

function focusInputFromKeyboard(activeElement: Element | null, pathname: string) {
  if (!(activeElement instanceof HTMLElement)) return false;

  const keyboard = activeElement.closest<HTMLElement>("[data-tv-search-keyboard]");
  if (!keyboard) return false;

  const wrapper = keyboard.parentElement;
  const input = wrapper?.querySelector<HTMLElement>(
    "[data-tv-keyboard-input], [data-tv-header-search-input], input[type='search']"
  );

  if (!input || !isVisibleElement(input)) return false;

  focusElement(input, pathname);
  return true;
}

function focusPageContentFromTransientUi(pathname: string) {
  const selectors = [
    "[data-tv-section='top-actions'] [data-tv-default]",
    "[data-tv-section='top-actions'] a[href]:not([data-tv-skip])",
    "[data-tv-section='continue'] a[href]:not([data-tv-skip])",
    "[data-tv-section='china-series'] a[href]:not([data-tv-skip])",
    "[data-tv-section='custom'] a[href]:not([data-tv-skip])",
    "[data-tv-section='favorites'] a[href]:not([data-tv-skip])",
    "main [data-tv-scope] [data-tv-default]",
    "main [data-tv-scope] a[href]:not([data-tv-skip])",
    "main [data-tv-scope] button:not([disabled]):not([data-tv-skip])",
    "main a[href]:not([data-tv-skip])",
    "main button:not([disabled]):not([data-tv-skip])",
  ];

  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const target = candidates.find((element) => element.tabIndex !== -1 && isVisibleElement(element));

    if (target) {
      focusElement(target, pathname);
      return true;
    }
  }

  return false;
}`,
      "helpers cho keyboard/header/search transient UI"
    );
  }

  if (!content.includes("function handleTransientUiBack(")) {
    content = replaceRequired(
      content,
      `function handleScopedBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;

  if (focusActiveTabButtonFromPanel(activeElement, pathname)) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (activeElement instanceof HTMLElement && activeElement.closest("[data-tv-filter-panel]")) {
    const topAction = document.querySelector<HTMLElement>("[data-tv-focus-key='filter:apply-top']");
    if (topAction && activeElement !== topAction && isVisibleElement(topAction)) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(topAction, pathname);
      return true;
    }
  }

  return false;
}`,
      `function handleTransientUiBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return false;

  const isSearchKeyboard = Boolean(activeElement.closest("[data-tv-search-keyboard]"));
  const isSearchInput =
    isTextInput(activeElement) &&
    Boolean(
      activeElement.closest("header") ||
        activeElement.closest("[data-tv-section='search-strip']") ||
        activeElement.hasAttribute("data-tv-keyboard-input")
    );

  if (!isSearchKeyboard && !isSearchInput) return false;

  event.preventDefault();
  event.stopPropagation();

  if (isSearchKeyboard && focusInputFromKeyboard(activeElement, pathname)) return true;
  if (focusPageContentFromTransientUi(pathname)) return true;

  activeElement.blur();
  return true;
}

function handleScopedBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;

  if (handleTransientUiBack(event, pathname)) return true;

  if (focusActiveTabButtonFromPanel(activeElement, pathname)) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (activeElement instanceof HTMLElement && activeElement.closest("[data-tv-filter-panel]")) {
    const activeTab = activeElement
      .closest<HTMLElement>("[data-tv-tabs-root]")
      ?.querySelector<HTMLElement>("[data-tv-tab-active='true']");

    if (activeTab && activeElement !== activeTab && isVisibleElement(activeTab)) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(activeTab, pathname);
      return true;
    }
  }

  if (
    pathname === "/tv" &&
    activeElement instanceof HTMLElement &&
    !isInsideTvRail(activeElement) &&
    activeElement.closest("main") &&
    focusRailFromContent(pathname)
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (
    activeElement instanceof HTMLElement &&
    activeElement.closest("header") &&
    focusPageContentFromTransientUi(pathname)
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return false;
}`,
      "scoped back logic"
    );
  }

  if (!content.includes("function getCurrentRoute()")) {
    content = replaceRequired(
      content,
      `function getFallbackBackHref(path = window.location.pathname) {
  const normalWatchMatch = path.match(/^\\/xem\\/([^/?#]+)/);
  const customWatchMatch = path.match(/^\\/ca-nhan\\/([^/]+)\\/xem/);

  if (normalWatchMatch?.[1]) return \`/phim/\${normalWatchMatch[1]}\`;
  if (customWatchMatch?.[1]) return \`/ca-nhan/\${customWatchMatch[1]}\`;
  if (isTvRemoteEnabled()) return path === "/tv" ? "/" : "/tv";
  if (path !== "/") return "/";
  return "/tv";
}

function goBack(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  const path = window.location.pathname;
  if (isTvRemoteEnabled()) {
    window.location.href = getFallbackBackHref(path);
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = getFallbackBackHref(path);
}`,
      `function getCurrentRoute() {
  return \`\${window.location.pathname}\${window.location.search || ""}\`;
}

function readRouteStack() {
  try {
    const raw = sessionStorage.getItem(ROUTE_STACK_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeRouteStack(stack: string[]) {
  try {
    sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify(stack.slice(-30)));
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function rememberRoute(route = getCurrentRoute()) {
  const stack = readRouteStack();
  const last = stack[stack.length - 1];

  if (last === route) return;

  stack.push(route);
  writeRouteStack(stack);
}

function popRouteTarget(current = getCurrentRoute()) {
  const stack = readRouteStack().filter(Boolean);

  while (stack.length && stack[stack.length - 1] === current) {
    stack.pop();
  }

  const target = stack.pop() || "";
  writeRouteStack(stack);

  if (!target || target === current) return "";
  return target;
}

function getFallbackBackHref(path = window.location.pathname) {
  const normalWatchMatch = path.match(/^\\/xem\\/([^/?#]+)/);
  const customWatchMatch = path.match(/^\\/ca-nhan\\/([^/]+)\\/xem/);

  if (normalWatchMatch?.[1]) return \`/phim/\${normalWatchMatch[1]}\`;
  if (customWatchMatch?.[1]) return \`/ca-nhan/\${customWatchMatch[1]}\`;
  if (path !== "/tv") return "/tv";
  return "/";
}

function goBack(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  const current = getCurrentRoute();
  const stackedTarget = popRouteTarget(current);

  if (stackedTarget) {
    window.location.href = stackedTarget;
    return;
  }

  if (!isTvRemoteEnabled() && window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = getFallbackBackHref(window.location.pathname);
}`,
      "route stack back logic"
    );
  }

  if (!content.includes("rememberRoute(getCurrentRoute());")) {
    content = replaceRequired(
      content,
      `  useEffect(() => {
    if (!enabled) return;

    window.setTimeout(() => {`,
      `  useEffect(() => {
    if (!enabled) return;

    rememberRoute(getCurrentRoute());
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;

    window.setTimeout(() => {`,
      "remember route effect"
    );
  }

  content = content.replace(
    `if (isBackKey(event) && !isTextInput(activeElement)) {`,
    `if (isBackKey(event) && !(isTextInput(activeElement) && isTextDeleteBackspace(event))) {`
  );

  if (!content.includes("focusInputFromKeyboard(activeElement, pathname)")) {
    content = replaceRequired(
      content,
      `      if (!direction) return;

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {`,
      `      if (!direction) return;

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        focusInputFromKeyboard(activeElement, pathname)
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        direction === "down" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (isTextInput(activeElement) && focusSearchKeyboard(pathname)) return;
        if (focusPageContentFromTransientUi(pathname)) return;
        return;
      }

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {`,
      "keyboard up + header down blocks"
    );
  }

  content = content.replace(
    `direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")`,
    `direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        (activeElement.closest("header") || activeElement.hasAttribute("data-tv-keyboard-input"))`
  );

  content = content.replace(
    `const keyboard = document.querySelector<HTMLElement>("[data-tv-search-keyboard]");
        const keyboardTarget = keyboard ? getFocusableElements(keyboard)[0] : null;

        if (keyboardTarget) {
          event.preventDefault();
          event.stopPropagation();
          focusElement(keyboardTarget, pathname);
          return;
        }`,
    `if (focusSearchKeyboard(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }`
  );

  write(relativePath, content);
}

patchTvRemoteNavigator();

console.log("Done. Run: npm run lint && npm run build");