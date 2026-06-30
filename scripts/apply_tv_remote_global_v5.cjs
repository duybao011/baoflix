const fs = require("fs");
const path = require("path");

const root = process.cwd();

function target(relativePath) {
  return path.join(root, relativePath);
}

function write(relativePath, content) {
  fs.mkdirSync(path.dirname(target(relativePath)), { recursive: true });
  fs.writeFileSync(target(relativePath), content, "utf8");
  console.log(`patched ${relativePath}`);
}

function readScriptFile(name) {
  return fs.readFileSync(path.join(__dirname, name), "utf8");
}

function patchRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  const fullPath = target(relativePath);
  let content = fs.readFileSync(fullPath, "utf8");

  if (!content.includes("function getTvRail()")) {
    content = content.replace(
`function getMainScope() {
  return document.querySelector<HTMLElement>("main [data-tv-scope]");
}`,
`function getMainScope() {
  return (
    document.querySelector<HTMLElement>("main [data-tv-scope]") ||
    document.querySelector<HTMLElement>("main")
  );
}

function getTvRail() {
  return document.querySelector<HTMLElement>("[data-tv-rail='true']");
}

function getFirstFocusableInside(selector: string) {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root || !isVisibleElement(root)) return null;
  return getDefaultFocusable(root) || getFocusableElements(root)[0] || null;
}

function isInsideTvRail(element: Element | null) {
  return element instanceof HTMLElement && Boolean(element.closest("[data-tv-rail='true']"));
}

function focusRailFromContent(pathname: string) {
  const rail = getTvRail();
  if (!rail || !isVisibleElement(rail)) return false;

  const target =
    rail.querySelector<HTMLElement>("[data-tv-focus-key='rail:home']") ||
    getDefaultFocusable(rail) ||
    getFocusableElements(rail)[0];

  if (!target) return false;
  focusElement(target, pathname);
  return true;
}

function focusContentFromRail(pathname: string) {
  const target =
    getFirstFocusableInside("main [data-tv-scope]") ||
    getFirstFocusableInside("main");

  if (!target) return false;
  focusElement(target, pathname);
  return true;
}`
    );
  }

  if (!content.includes("focusRailFromContent(pathname)")) {
    content = content.replace(
`      if (!direction) return;
      if (shouldLetInputHandleKey(activeElement, event)) return;`,
`      if (!direction) return;

      if (
        direction === "left" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {
        const currentRow = activeElement.closest<HTMLElement>("[data-tv-row]");
        const rowFocusables = currentRow ? getFocusableElements(currentRow) : [];
        const firstInRow = rowFocusables[0];

        if (firstInRow === activeElement && focusRailFromContent(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (
        direction === "right" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        isInsideTvRail(activeElement) &&
        focusContentFromRail(pathname)
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (shouldLetInputHandleKey(activeElement, event)) return;`
    );
  }

  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`patched ${relativePath}`);
}

function patchMovieGrid() {
  const relativePath = "components/MovieGrid.tsx";
  const fullPath = target(relativePath);
  let content = fs.readFileSync(fullPath, "utf8");

  content = content.replace(
    '<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">',
    '<div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">'
  );

  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`patched ${relativePath}`);
}

function patchLocPage() {
  const relativePath = "app/loc/page.tsx";
  const fullPath = target(relativePath);
  let content = fs.readFileSync(fullPath, "utf8");

  content = content.replace(
    '<div data-tv-scope="loc-page" data-tv-lock="true">',
    '<div data-tv-scope="loc-page" data-tv-lock="true" data-tv-autofocus="true" className="baoflix-tv-page">'
  );

  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`patched ${relativePath}`);
}

function patchSearchPage() {
  const relativePath = "app/tim-kiem/page.tsx";
  const fullPath = target(relativePath);
  let content = fs.readFileSync(fullPath, "utf8");

  content = content.replace(
    "return <SearchEmptyState />;",
    'return <div data-tv-scope="search-page-empty" data-tv-lock="true" data-tv-autofocus="true" className="baoflix-tv-page"><SearchEmptyState /></div>;'
  );

  content = content.replace(
    "return (\n    <div>",
    'return (\n    <div data-tv-scope="search-page" data-tv-lock="true" data-tv-autofocus="true" className="baoflix-tv-page">'
  );

  content = content.replace(
    'href="/tim-kiem"\n          className=',
    'href="/tim-kiem"\n          data-tv-default\n          data-tv-focus-key="search:new-keyword"\n          className='
  );

  content = content.replaceAll(
    '<div className="flex flex-wrap gap-2">',
    '<div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-2">'
  );

  // Add generic focus keys for search filter links if the current code has none.
  content = content.replaceAll(
    'className={[\n                  "rounded-xl border px-4 py-2 text-sm font-bold"',
    'data-tv-focus-key={`search-filter:${country}:${sortLang}:${category}:${year}`}\n                className={[\n                  "rounded-xl border px-4 py-2 text-sm font-bold"'
  );

  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`patched ${relativePath}`);
}

patchRemoteNavigator();
write("components/CompactMovieCard.tsx", readScriptFile("CompactMovieCard.tsx.txt"));
write("app/lich-su/page.tsx", readScriptFile("history-page.tsx.txt"));
write("app/yeu-thich/page.tsx", readScriptFile("favorites-page.tsx.txt"));
write("app/ca-nhan/page.tsx", readScriptFile("custom-page.tsx.txt"));
patchMovieGrid();
patchLocPage();
patchSearchPage();

console.log("Done. Run: npm run lint && npm run build");