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

function patchTvDashboard() {
  const relativePath = "components/TvDashboard.tsx";
  if (!fs.existsSync(target(relativePath))) return;

  let content = read(relativePath);

  // "Trang thường" is a mouse escape hatch. Do not let TV remote restore/focus it.
  content = content.replace(
    `data-tv-focus-key="top:normal-home" className=`,
    `data-tv-skip tabIndex={-1} className=`
  );

  write(relativePath, content);
}

function patchHeader() {
  const relativePath = "components/Header.tsx";
  let content = read(relativePath);

  if (!content.includes("TV_KEYBOARD_ROWS")) {
    content = content.replace(
      `const SEARCH_HISTORY_KEY = "baoflix_search_history";`,
      `const SEARCH_HISTORY_KEY = "baoflix_search_history";
const TV_SESSION_KEY = "baoflix_tv_mode";

const TV_KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
  ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
] as const;

function isTvSearchKeyboardEnabled() {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "0") return false;
    if (params.get("tv") === "1") return true;

    const ua = navigator.userAgent.toLowerCase();
    if (/baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(ua)) {
      return true;
    }

    return sessionStorage.getItem(TV_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}`
    );
  }

  if (!content.includes("const [tvKeyboardEnabled, setTvKeyboardEnabled]")) {
    content = content.replace(
      `  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);`,
      `  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [tvKeyboardEnabled, setTvKeyboardEnabled] = useState(false);`
    );
  }

  if (!content.includes("refreshKeyboardEnabled")) {
    content = content.replace(
      `  useEffect(() => {
    setKeyword(initialKeyword || "");
  }, [initialKeyword]);`,
      `  useEffect(() => {
    setKeyword(initialKeyword || "");
  }, [initialKeyword]);

  useEffect(() => {
    setTvKeyboardEnabled(isTvSearchKeyboardEnabled());

    function refreshKeyboardEnabled() {
      setTvKeyboardEnabled(isTvSearchKeyboardEnabled());
    }

    window.addEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);
    window.addEventListener("storage", refreshKeyboardEnabled);
    window.addEventListener("focus", refreshKeyboardEnabled);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);
      window.removeEventListener("storage", refreshKeyboardEnabled);
      window.removeEventListener("focus", refreshKeyboardEnabled);
    };
  }, []);`
    );
  }

  if (!content.includes("function appendKeyboardValue(")) {
    content = content.replace(
      `  function clearAllHistory() {
    clearSearchHistory();
    setHistory([]);
  }

  function handleSearchBlur() {`,
      `  function clearAllHistory() {
    clearSearchHistory();
    setHistory([]);
  }

  function appendKeyboardValue(value: string) {
    setKeyword((old) => \`\${old}\${value}\`);
    setFocused(true);
  }

  function backspaceKeyboardValue() {
    setKeyword((old) => old.slice(0, -1));
    setFocused(true);
  }

  function clearKeyboardValue() {
    setKeyword("");
    setFocused(true);
  }

  function handleSearchBlur() {`
    );
  }

  if (!content.includes("data-tv-search-keyboard")) {
    content = content.replace(
      `      </form>

      {showDropdown && (`,
      `      </form>

      {tvKeyboardEnabled && focused && (
        <div
          data-tv-search-keyboard
          data-tv-row
          data-tv-row-wrap="true"
          className="mt-2 rounded-2xl border border-white/10 bg-black/35 p-2"
        >
          <div className="grid gap-1.5">
            {TV_KEYBOARD_ROWS.map((row, rowIndex) => (
              <div
                key={row.join("")}
                data-tv-row
                data-tv-row-wrap="true"
                className="flex flex-wrap justify-center gap-1.5"
              >
                {row.map((keyValue) => (
                  <button
                    key={keyValue}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => appendKeyboardValue(keyValue)}
                    data-tv-focus-key={\`tv-keyboard:\${rowIndex}:\${keyValue}\`}
                    className="min-h-9 min-w-9 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                  >
                    {keyValue.toUpperCase()}
                  </button>
                ))}
              </div>
            ))}

            <div data-tv-row data-tv-row-wrap="true" className="mt-1 grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => appendKeyboardValue(" ")}
                data-tv-focus-key="tv-keyboard:space"
                className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Space
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={backspaceKeyboardValue}
                data-tv-focus-key="tv-keyboard:backspace"
                className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Xóa ký tự
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearKeyboardValue}
                data-tv-focus-key="tv-keyboard:clear"
                className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Xóa hết
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => goSearch(keyword)}
                data-tv-focus-key="tv-keyboard:submit"
                className="min-h-10 rounded-xl bg-red-600 px-2 text-sm font-black text-white hover:bg-red-500 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Tìm
              </button>
            </div>
          </div>
        </div>
      )}

      {showDropdown && (`
    );
  }

  // Give dropdown rows stable TV focus targets and skip destructive history delete buttons.
  content = content.replace(
    `className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-[70dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0f19] shadow-2xl"`,
    `data-tv-row data-tv-row-wrap="true" className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-[70dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0f19] shadow-2xl"`
  );
  content = content.replace(
    `onClick={() => goSearch(keyword)}
              className="block w-full border-b`,
    `onClick={() => goSearch(keyword)}
              data-tv-focus-key="header-search:submit-keyword"
              className="block w-full border-b`
  );
  content = content.replace(
    `onClick={() => goMovie(movie)}
                      className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"`,
    `onClick={() => goMovie(movie)}
                      data-tv-focus-key={\`header-search:suggest:\${movie.slug}\`}
                      className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"`
  );
  content = content.replace(
    `onClick={() => goSearch(item)}
                      className="min-w-0 truncate px-3 py-1.5"`,
    `onClick={() => goSearch(item)}
                      data-tv-focus-key={\`header-search:history:\${item}\`}
                      className="min-w-0 truncate px-3 py-1.5"`
  );
  content = content.replace(
    `onClick={() => deleteHistoryItem(item)}
                      className="border-l border-white/10 px-2 py-1.5 text-slate-500 hover:bg-red-600 hover:text-white"`,
    `onClick={() => deleteHistoryItem(item)}
                      data-tv-skip
                      tabIndex={-1}
                      className="border-l border-white/10 px-2 py-1.5 text-slate-500 hover:bg-red-600 hover:text-white"`
  );

  if (!content.includes("data-tv-header-desktop-menu-button")) {
    content = content.replace(
      `              <SearchForm initialKeyword={currentKeyword} />
            </div>`,
      `              <SearchForm initialKeyword={currentKeyword} />

              <button
                type="button"
                data-tv-header-menu-button
                data-tv-header-desktop-menu-button
                data-tv-focus-key="header:menu-desktop"
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setSearchOpen(false);
                }}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                ☰
              </button>
            </div>`
    );
  }

  content = content.replace(
    `className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm lg:hidden"`,
    `className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm"`
  );

  write(relativePath, content);
}

function patchTvRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  let content = read(relativePath);

  // Restore should never land on skipped/non-TV targets.
  content = content.replace(
    `if (!target || !isVisibleElement(target)) return false;
    focusElement(target, pathname);`,
    `if (
      !target ||
      !isVisibleElement(target) ||
      target.tabIndex === -1 ||
      target.hasAttribute("data-tv-skip")
    ) {
      return false;
    }

    focusElement(target, pathname);`
  );

  // Header search must pick the visible candidate.
  content = content.replace(
    `function focusHeaderSearch(pathname: string) {
  const candidates = [
    document.querySelector<HTMLElement>("[data-tv-header-search-input]"),
    document.querySelector<HTMLElement>("[data-tv-header-search-toggle]"),
    document.querySelector<HTMLElement>("header input"),
  ].filter(Boolean) as HTMLElement[];

  const target = candidates.find(isVisibleElement);
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}`,
    `function focusHeaderSearch(pathname: string) {
  const candidates = [
    document.querySelector<HTMLElement>("[data-tv-header-search-input]"),
    document.querySelector<HTMLElement>("[data-tv-header-search-toggle]"),
    document.querySelector<HTMLElement>("header input"),
  ].filter(Boolean) as HTMLElement[];

  const target = candidates.find(isVisibleElement);
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}`
  );

  // Menu must try every visible menu button, not just the first hidden mobile one.
  content = content.replace(
    `function focusHeaderMenu(pathname: string) {
  const menuButton = document.querySelector<HTMLElement>("[data-tv-header-menu-button]");
  if (menuButton && isVisibleElement(menuButton)) {
    focusElement(menuButton, pathname);
    return true;
  }

  const settingsCandidates = [
    document.querySelector<HTMLElement>("[data-tv-focus-key='nav:/cai-dat:Cài đặt']"),
    document.querySelector<HTMLElement>("header a[href='/cai-dat']"),
  ].filter(Boolean) as HTMLElement[];

  const settingsLink = settingsCandidates.find(isVisibleElement);
  if (!settingsLink) return false;

  focusElement(settingsLink, pathname);
  return true;
}`,
    `function focusHeaderMenu(pathname: string) {
  const menuCandidates = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tv-header-menu-button]")
  );
  const menuButton = menuCandidates.find(isVisibleElement);

  if (menuButton) {
    focusElement(menuButton, pathname);
    return true;
  }

  const settingsCandidates = [
    document.querySelector<HTMLElement>("[data-tv-focus-key='nav:/cai-dat:Cài đặt']"),
    document.querySelector<HTMLElement>("header a[href='/cai-dat']"),
  ].filter(Boolean) as HTMLElement[];

  const settingsLink = settingsCandidates.find(isVisibleElement);
  if (!settingsLink) return false;

  focusElement(settingsLink, pathname);
  return true;
}`
  );

  // Move keyboard/down handling before text input bailout.
  const oldInputBlock = `      if (shouldLetInputHandleKey(activeElement, event)) return;

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
          focusElement(firstMainElement, pathname);
        }
        return;
      }`;
  const newInputBlock = `      if (
        direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")
      ) {
        const keyboard = document.querySelector<HTMLElement>("[data-tv-search-keyboard]");
        const keyboardTarget = keyboard ? getFocusableElements(keyboard)[0] : null;

        if (keyboardTarget) {
          event.preventDefault();
          event.stopPropagation();
          focusElement(keyboardTarget, pathname);
          return;
        }

        const firstMainElement = getFirstMainFocusableElement();
        if (firstMainElement) {
          event.preventDefault();
          event.stopPropagation();
          focusElement(firstMainElement, pathname);
        }
        return;
      }

      if (shouldLetInputHandleKey(activeElement, event)) return;`;
  content = content.replace(oldInputBlock, newInputBlock);

  // If focus is inside header/keyboard/dropdown, navigation root is header, not main.
  content = content.replace(
    `      const modalScope = getModalScope();
      const activeScope = getActiveScope(activeElement);
      const root = modalScope || activeScope || visibleOverlay || getMainScope() || document;`,
    `      const modalScope = getModalScope();
      const activeScope = getActiveScope(activeElement);
      const activeHeader =
        activeElement instanceof HTMLElement ? activeElement.closest<HTMLElement>("header") : null;
      const root = modalScope || activeScope || activeHeader || visibleOverlay || getMainScope() || document;`
  );

  write(relativePath, content);
}

function patchFilterPanel() {
  const relativePath = "components/FilterPanel.tsx";
  if (!fs.existsSync(target(relativePath))) return;

  let content = read(relativePath);

  content = content.replace(
    `data-tv-autofocus="true" className=`,
    `data-tv-autofocus="true" data-tv-filter-panel data-tv-tabs-root className=`
  );
  content = content.replace(
    `onClick={apply} data-tv-default data-tv-focus-key="filter:apply-top"`,
    `onClick={apply} data-tv-focus-key="filter:apply-top"`
  );
  content = content.replace(
    `<div data-tv-row data-tv-row-wrap="true" className="mb-3 flex flex-wrap gap-2">`,
    `<div data-tv-row data-tv-row-wrap="true" data-tv-tab-list className="mb-3 flex flex-wrap gap-2">`
  );
  content = content.replace(
    `data-tv-focus-key={\`filter-tab:\${t.id}\`}`,
    `data-tv-default={t.id==="type"?true:undefined} data-tv-tab-active={tab===t.id?"true":undefined} data-tv-focus-key={\`filter-tab:\${t.id}\`}`
  );
  content = content.replace(
    `<div className="min-h-[220px] rounded-2xl border border-white/10 bg-black/20 p-3">`,
    `<div data-tv-tab-panel data-tv-tab-panel-active="true" className="min-h-[220px] rounded-2xl border border-white/10 bg-black/20 p-3">`
  );
  content = content.replace(
    `onClick={apply} data-tv-focus-key="filter:apply-bottom"`,
    `onClick={apply} data-tv-jump-results="true" data-tv-focus-key="filter:apply-bottom"`
  );

  write(relativePath, content);
}

patchTvDashboard();
patchHeader();
patchTvRemoteNavigator();
patchFilterPanel();

console.log("Done. Run: npm run lint && npm run build");