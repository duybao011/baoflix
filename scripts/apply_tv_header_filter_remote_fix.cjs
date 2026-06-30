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

  if (!content.includes("data-tv-header-search-input")) {
    content = content.replace(
`        <input
          value={keyword}`,
`        <input
          type="search"
          data-tv-header-search-input
          data-tv-focus-key="header:search-input"
          value={keyword}`
    );
  }

  if (!content.includes('data-tv-focus-key="header:search-submit"')) {
    content = content.replace(
`        <button
          type="submit"
          className={[`,
`        <button
          type="submit"
          data-tv-focus-key="header:search-submit"
          className={[`
    );
  }

  if (!content.includes("data-tv-focus-key={`nav:${item.href}:${item.label}`}")) {
    content = content.replace(
`      href={item.href}
      onClick={onClick}
      className={[`,
`      href={item.href}
      onClick={onClick}
      prefetch={false}
      data-tv-focus-key={\`nav:\${item.href}:\${item.label}\`}
      className={[`
    );
  }

  if (!content.includes("data-tv-header-search-toggle")) {
    content = content.replace(
`                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen((value) => !value);
                    setMenuOpen(false);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
                >`,
`                <button
                  type="button"
                  data-tv-header-search-toggle
                  data-tv-focus-key="header:search-toggle"
                  onClick={() => {
                    setSearchOpen((value) => !value);
                    setMenuOpen(false);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
                >`
    );
  }

  if (!content.includes("data-tv-header-menu-button")) {
    content = content.replace(
`              <button
                type="button"
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setSearchOpen(false);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
              >`,
`              <button
                type="button"
                data-tv-header-menu-button
                data-tv-focus-key="header:menu"
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setSearchOpen(false);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
              >`
    );
  }

  if (!content.includes("data-tv-close")) {
    content = content.replace(
`              <button
                type="button"
                onClick={closePanels}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
              >`,
`              <button
                type="button"
                data-tv-close
                data-tv-default
                data-tv-focus-key="header-menu:close"
                onClick={closePanels}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
              >`
    );
  }

  write(relativePath, content);
}

function patchTvRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  let content = read(relativePath);

  // Make header search jump work even when the mobile search field is not mounted yet.
  content = content.replace(
`function focusHeaderSearch(pathname: string) {
  const target =
    document.querySelector<HTMLElement>("[data-tv-header-search-input]") ||
    document.querySelector<HTMLElement>("[data-tv-header-search-toggle]") ||
    document.querySelector<HTMLElement>("header input");

  if (!target || !isVisibleElement(target)) return false;
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

  content = content.replace(
`function focusHeaderMenu(pathname: string) {
  const menuButton = document.querySelector<HTMLElement>("[data-tv-header-menu-button]");
  if (menuButton && isVisibleElement(menuButton)) {
    focusElement(menuButton, pathname);
    return true;
  }

  const settingsLink =
    document.querySelector<HTMLElement>("[data-tv-focus-key='nav:/cai-dat:Cài đặt']") ||
    document.querySelector<HTMLElement>("header a[href='/cai-dat']");

  if (!settingsLink || !isVisibleElement(settingsLink)) return false;
  focusElement(settingsLink, pathname);
  return true;
}`,
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
}`
  );

  // If current focus is the first row, UP should always try header first.
  // The old code depended on isFirstRowInScope(), which can be false when nested scopes/rows exist.
  content = content.replace(
`      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {
        const rootForHeaderJump = getActiveScope(activeElement) || getMainScope() || document;
        if (isFirstRowInScope(activeElement, rootForHeaderJump) && focusHeaderSearch(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }`,
`      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {
        const rootForHeaderJump = getActiveScope(activeElement) || getMainScope() || document;
        if (isFirstRowInScope(activeElement, rootForHeaderJump) && focusHeaderSearch(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }`
  );

  write(relativePath, content);
}

function replaceFilterPanel() {
  const relativePath = "components/FilterPanel.tsx";
  const content = fs.readFileSync(path.join(__dirname, "FilterPanel.tsx.txt"), "utf8");
  write(relativePath, content);
}

patchHeader();
patchTvRemoteNavigator();
replaceFilterPanel();

console.log("Done. Run: npm run lint && npm run build");