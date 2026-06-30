const fs = require("fs");
const path = require("path");

const root = process.cwd();

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content, "utf8");
  console.log(`patched ${relativePath}`);
}

function patchRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  const fullPath = path.join(root, relativePath);
  let content = fs.readFileSync(fullPath, "utf8");

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

  content = content.replace(
`function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");
  return getDefaultFocusable(scope || main || document);
}`,
`function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");
  return getDefaultFocusable(scope || main || document);
}`
  );

  content = content.replace(
`      if (isActivationKey(event) && !isTextInput(activeElement)) {
        clickActiveElement(event);
        return;
      }

      if (!direction) return;`,
`      if (isActivationKey(event) && !isTextInput(activeElement)) {
        clickActiveElement(event);
        return;
      }

      if (!direction) return;

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
      }`
  );

  content = content.replace(
`      const root = modalScope || activeScope || visibleOverlay || getMainScope() || document;`,
`      const root = modalScope || activeScope || visibleOverlay || getMainScope() || document;`
  );

  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`patched ${relativePath}`);
}

patchRemoteNavigator();
write("components/CompactMovieCard.tsx", fs.readFileSync(path.join(__dirname, "CompactMovieCard.tsx.txt"), "utf8"));
write("app/lich-su/page.tsx", fs.readFileSync(path.join(__dirname, "history-page.tsx.txt"), "utf8"));
write("app/yeu-thich/page.tsx", fs.readFileSync(path.join(__dirname, "favorites-page.tsx.txt"), "utf8"));
write("app/ca-nhan/page.tsx", fs.readFileSync(path.join(__dirname, "custom-page.tsx.txt"), "utf8"));

console.log("Done. Run: npm run lint && npm run build");