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
  let content = read(relativePath);

  // "Trang thường" is a mouse/laptop escape link, not a TV remote target.
  // If it gets remembered, /tv keeps restoring focus there and UP feels stuck.
  content = content.replace(
    `data-tv-focus-key="top:normal-home" className=`,
    `data-tv-skip tabIndex={-1} className=`
  );

  write(relativePath, content);
}

function patchTvRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  let content = read(relativePath);

  // Do not restore remembered focus to skipped/non-remote targets.
  content = content.replace(
`    if (!target || !isVisibleElement(target)) return false;
    focusElement(target, pathname);`,
`    if (
      !target ||
      !isVisibleElement(target) ||
      target.tabIndex === -1 ||
      target.hasAttribute("data-tv-skip")
    ) {
      return false;
    }

    focusElement(target, pathname);`
  );

  // Make the header search selector resilient: mobile input may not be mounted
  // until the "Tìm" button is opened, so try all visible candidates.
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

  write(relativePath, content);
}

function patchHeader() {
  const relativePath = "components/Header.tsx";
  let content = read(relativePath);

  // Search input
  content = content.replace(
    /<input\s+value=\{keyword\}/,
    `<input
          type="search"
          data-tv-header-search-input
          data-tv-focus-key="header:search-input"
          value={keyword}`
  );

  // Search submit
  content = content.replace(
    /<button\s+type="submit"\s+className=\{\[/,
    `<button
          type="submit"
          data-tv-focus-key="header:search-submit"
          className={[`
  );

  // Nav links
  content = content.replace(
    /<Link\s+href=\{item\.href\}\s+onClick=\{onClick\}\s+className=\{\[/,
    `<Link
      href={item.href}
      onClick={onClick}
      prefetch={false}
      data-tv-focus-key={\`nav:\${item.href}:\${item.label}\`}
      className={[`
  );

  // Mobile search toggle button
  content = content.replace(
    /<button\s+type="button"\s+onClick=\{\(\) => \{\s*setSearchOpen\(\(value\) => !value\);\s*setMenuOpen\(false\);\s*\}\}\s+className="rounded-2xl border border-white\/10 bg-white\/5 px-4 py-3 text-sm font-black text-white hover:bg-white\/10"\s+>/,
    `<button
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

  // Mobile menu button
  content = content.replace(
    /<button\s+type="button"\s+onClick=\{\(\) => \{\s*setMenuOpen\(\(value\) => !value\);\s*setSearchOpen\(false\);\s*\}\}\s+className="rounded-2xl border border-white\/10 bg-white\/5 px-4 py-3 text-sm font-black text-white hover:bg-white\/10"\s+>/,
    `<button
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

  // Close button inside menu modal
  content = content.replace(
    /<button\s+type="button"\s+onClick=\{closePanels\}\s+className="rounded-2xl border border-white\/10 bg-white\/5 px-4 py-3 text-sm font-black text-white"\s+>/,
    `<button
                type="button"
                data-tv-close
                data-tv-default
                data-tv-focus-key="header-menu:close"
                onClick={closePanels}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
              >`
  );

  write(relativePath, content);
}

function patchFilterPanel() {
  const relativePath = "components/FilterPanel.tsx";
  let content = read(relativePath);

  // Root markers used by TvRemoteNavigator.
  content = content.replace(
    `data-tv-autofocus="true" className=`,
    `data-tv-autofocus="true" data-tv-filter-panel data-tv-tabs-root className=`
  );

  // Default focus should be tab "Loại", not Apply.
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
patchTvRemoteNavigator();
patchHeader();
patchFilterPanel();

console.log("Done. Run: npm run lint && npm run build");