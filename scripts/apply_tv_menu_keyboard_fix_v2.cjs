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

  content = content.replace(
    `        const firstMainElement = getFirstMainFocusableElement();
        if (firstMainElement) {
          event.preventDefault();
          event.stopPropagation();
          focusElement(firstMainElement, pathname);
        }
        return;`,
    `        const keyboard = document.querySelector<HTMLElement>("[data-tv-search-keyboard]");
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
        return;`
  );

  write(relativePath, content);
}

patchHeader();
patchTvRemoteNavigator();

console.log("Done. Run: npm run lint && npm run build");