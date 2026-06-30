
const fs = require("fs");
const path = require("path");

const root = process.cwd();
function target(relativePath) { return path.join(root, relativePath); }
function read(relativePath) { return fs.readFileSync(target(relativePath), "utf8"); }
function write(relativePath, content) { fs.writeFileSync(target(relativePath), content, "utf8"); console.log(`patched ${relativePath}`); }
function fail(message) { throw new Error(message); }
function assertIncludes(content, needle, label) { if (!content.includes(needle)) fail(`Patch chưa ăn: thiếu ${label}`); }
function replaceOnce(content, needle, replacement, label) {
  if (!content.includes(needle)) fail(`Không tìm thấy block để sửa: ${label}`);
  return content.replace(needle, replacement);
}

function patchHeader() {
  const relativePath = "components/Header.tsx";
  let content = read(relativePath);

  if (!content.includes('window.location.pathname === "/tv"')) {
    content = replaceOnce(
      content,
      'if (params.get("tv") === "1") return true;',
      'if (params.get("tv") === "1") return true;\n    if (window.location.pathname === "/tv") return true;',
      'bật keyboard trực tiếp ở /tv'
    );
  }

  if (!content.includes('const [tvKeyboardEnabled, setTvKeyboardEnabled]')) {
    content = replaceOnce(
      content,
      '  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);\n  const [loadingSuggest, setLoadingSuggest] = useState(false);',
      '  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);\n  const [loadingSuggest, setLoadingSuggest] = useState(false);\n  const [tvKeyboardEnabled, setTvKeyboardEnabled] = useState(false);',
      'state tvKeyboardEnabled'
    );
  }

  if (!content.includes('function refreshKeyboardEnabled()')) {
    content = replaceOnce(
      content,
      '  useEffect(() => {\n    setKeyword(initialKeyword || "");\n  }, [initialKeyword]);',
      '  useEffect(() => {\n    setKeyword(initialKeyword || "");\n  }, [initialKeyword]);\n\n  useEffect(() => {\n    setTvKeyboardEnabled(isTvSearchKeyboardEnabled());\n\n    function refreshKeyboardEnabled() {\n      setTvKeyboardEnabled(isTvSearchKeyboardEnabled());\n    }\n\n    window.addEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);\n    window.addEventListener("storage", refreshKeyboardEnabled);\n    window.addEventListener("focus", refreshKeyboardEnabled);\n\n    return () => {\n      window.removeEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);\n      window.removeEventListener("storage", refreshKeyboardEnabled);\n      window.removeEventListener("focus", refreshKeyboardEnabled);\n    };\n  }, []);',
      'effect refreshKeyboardEnabled'
    );
  }

  if (!content.includes('function appendKeyboardValue(')) {
    content = replaceOnce(
      content,
      '  function clearAllHistory() {\n    clearSearchHistory();\n    setHistory([]);\n  }\n\n  function handleSearchBlur() {',
      '  function clearAllHistory() {\n    clearSearchHistory();\n    setHistory([]);\n  }\n\n  function appendKeyboardValue(value: string) {\n    setKeyword((old) => `${old}${value}`);\n    setFocused(true);\n  }\n\n  function backspaceKeyboardValue() {\n    setKeyword((old) => old.slice(0, -1));\n    setFocused(true);\n  }\n\n  function clearKeyboardValue() {\n    setKeyword("");\n    setFocused(true);\n  }\n\n  function handleSearchBlur() {',
      'hàm nhập keyboard'
    );
  }

  if (!content.includes('data-tv-search-keyboard')) {
    const keyboardJsx = String.raw`      </form>

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
                    data-tv-focus-key={\`tv-keyboard:${rowIndex}:${keyValue}\`}
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

      {showDropdown && (`;
    content = replaceOnce(content, '      </form>\n\n      {showDropdown && (', keyboardJsx, 'JSX keyboard');
  }

  if (!content.includes('data-tv-header-desktop-menu-button')) {
    const desktopButton = String.raw`              <SearchForm initialKeyword={currentKeyword} />

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
            </div>`;
    content = replaceOnce(content, '              <SearchForm initialKeyword={currentKeyword} />\n            </div>', desktopButton, 'nút ☰ desktop/TV');
  }

  if (!content.includes('data-tv-focus-key="header-search:submit-keyword"')) {
    content = content.replace('onClick={() => goSearch(keyword)}\n              className="block w-full border-b', 'onClick={() => goSearch(keyword)}\n              data-tv-focus-key="header-search:submit-keyword"\n              className="block w-full border-b');
  }
  if (!content.includes('header-search:suggest')) {
    content = content.replace('onClick={() => goMovie(movie)}\n                      className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"', 'onClick={() => goMovie(movie)}\n                      data-tv-focus-key={`header-search:suggest:${movie.slug}`}\n                      className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"');
  }
  if (!content.includes('header-search:history')) {
    content = content.replace('onClick={() => goSearch(item)}\n                      className="min-w-0 truncate px-3 py-1.5"', 'onClick={() => goSearch(item)}\n                      data-tv-focus-key={`header-search:history:${item}`}\n                      className="min-w-0 truncate px-3 py-1.5"');
  }
  if (!content.includes('data-tv-skip\n                      tabIndex={-1}')) {
    content = content.replace('onClick={() => deleteHistoryItem(item)}\n                      className="border-l border-white/10 px-2 py-1.5 text-slate-500 hover:bg-red-600 hover:text-white"', 'onClick={() => deleteHistoryItem(item)}\n                      data-tv-skip\n                      tabIndex={-1}\n                      className="border-l border-white/10 px-2 py-1.5 text-slate-500 hover:bg-red-600 hover:text-white"');
  }

  assertIncludes(content, 'const [tvKeyboardEnabled, setTvKeyboardEnabled]', 'state tvKeyboardEnabled');
  assertIncludes(content, 'function refreshKeyboardEnabled()', 'effect refreshKeyboardEnabled');
  assertIncludes(content, 'function appendKeyboardValue(', 'appendKeyboardValue');
  assertIncludes(content, 'data-tv-search-keyboard', 'keyboard JSX');
  assertIncludes(content, 'data-tv-header-desktop-menu-button', 'nút menu desktop/TV');

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

  if (content.includes(oldBlock)) content = content.replace(oldBlock, newBlock);

  const keyboardIndex = content.indexOf('document.querySelector<HTMLElement>("[data-tv-search-keyboard]")');
  const inputLetIndex = content.indexOf('if (shouldLetInputHandleKey(activeElement, event)) return;');
  if (keyboardIndex < 0) fail('Patch chưa ăn: thiếu xử lý keyboard trong TvRemoteNavigator');
  if (inputLetIndex < 0) fail('Patch chưa ăn: thiếu shouldLetInputHandleKey trong TvRemoteNavigator');
  if (keyboardIndex > inputLetIndex) fail('Patch chưa ăn: block keyboard/down vẫn nằm sau shouldLetInputHandleKey');

  write(relativePath, content);
}

patchHeader();
patchTvRemoteNavigator();
console.log("Done. Run: npm run lint && npm run build");
