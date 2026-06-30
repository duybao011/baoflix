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

  // Make search dropdown items navigable by TV remote and skip destructive delete button.
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
    `<div className="flex flex-wrap gap-2">`,
    `<div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-2">`
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
  } else {
    console.warn("Không thấy block input/down cũ; có thể đã được sửa rồi.");
  }

  write(relativePath, content);
}

patchHeader();
patchTvRemoteNavigator();

console.log("Done. Run: npm run lint && npm run build");