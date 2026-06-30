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

function patchGlobalsCss() {
  const relativePath = "app/globals.css";
  let content = read(relativePath);

  const oldBlock = `/* TV mode: dễ nhìn hơn khi ngồi xa màn hình */
@media (min-width: 1024px) {
  .baoflix-tv-page {
    font-size: 1.08rem;
  }

  .baoflix-tv-page a,
  .baoflix-tv-page button {
    scroll-margin: 7rem;
  }

  .baoflix-tv-page a:focus-visible,
  .baoflix-tv-page button:focus-visible,
  .baoflix-tv-page input:focus-visible {
    transform: translateY(-3px) scale(1.03);
    border-color: #facc15;
    box-shadow:
      0 0 0 4px rgba(250, 204, 21, 0.22),
      0 18px 45px rgba(0, 0, 0, 0.45);
  }

  .baoflix-tv-page input {
    min-height: 4.25rem;
    font-size: 1.25rem;
  }

  .baoflix-tv-page h1 {
    letter-spacing: -0.04em;
  }

  .baoflix-tv-page h2 {
    letter-spacing: -0.03em;
  }
}`;

  const newBlock = `/* TV mode density: gọn hơn, không phóng UI quá to */
@media (min-width: 1024px) {
  .baoflix-tv-page {
    font-size: 0.95rem;
    zoom: 0.72;
    width: 138.8889%;
    max-width: 138.8889%;
    transform-origin: top left;
  }

  @supports not (zoom: 1) {
    .baoflix-tv-page {
      transform: scale(0.72);
    }
  }

  .baoflix-tv-page a,
  .baoflix-tv-page button {
    scroll-margin: 5rem;
  }

  .baoflix-tv-page a:focus-visible,
  .baoflix-tv-page button:focus-visible,
  .baoflix-tv-page input:focus-visible {
    transform: translateY(-1px) scale(1.018);
    border-color: #facc15;
    box-shadow:
      0 0 0 3px rgba(250, 204, 21, 0.18),
      0 10px 28px rgba(0, 0, 0, 0.38);
  }

  .baoflix-tv-page input {
    min-height: 3rem;
    font-size: 0.95rem;
  }

  .baoflix-tv-page h1 {
    letter-spacing: -0.03em;
  }

  .baoflix-tv-page h2 {
    letter-spacing: -0.02em;
  }
}`;

  if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
  } else if (!content.includes("TV mode density: gọn hơn")) {
    content += `\n\n${newBlock}\n`;
  }

  write(relativePath, content);
}

function patchHeader() {
  const relativePath = "components/Header.tsx";
  let content = read(relativePath);

  // TV keyboard should also be enabled directly on /tv, not only via session flag.
  content = content.replace(
`    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "0") return false;
    if (params.get("tv") === "1") return true;`,
`    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "0") return false;
    if (params.get("tv") === "1") return true;
    if (window.location.pathname === "/tv") return true;`
  );

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

  if (!content.includes("function refreshKeyboardEnabled()")) {
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
    setKeyword((old) => `${old}${value}`);
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

  write(relativePath, content);
}

function patchTvRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  let content = read(relativePath);

  const oldBlock = `      if (shouldLetInputHandleKey(activeElement, event)) return;

      if (
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
      }`;

  const newBlock = `      if (
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

  if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
  } else if (!content.includes("if (shouldLetInputHandleKey(activeElement, event)) return;")) {
    console.warn("Input/down block looks already modified.");
  } else {
    console.warn("Could not find exact input/down block. No risky rewrite applied.");
  }

  write(relativePath, content);
}

patchGlobalsCss();
patchHeader();
patchTvRemoteNavigator();

console.log("Done. Run: npm run lint && npm run build");