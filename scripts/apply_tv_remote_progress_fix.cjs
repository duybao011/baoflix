const fs = require("fs");
const path = require("path");

const root = process.cwd();

function file(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(file(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(file(relativePath), content, "utf8");
  console.log(`patched ${relativePath}`);
}

function patchTvRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  let content = read(relativePath);

  if (!content.includes("function isMenuKey(")) {
    content = content.replace(
`function isPlayPauseKey(event: KeyboardEvent) {
  return (
    event.key === "MediaPlayPause" ||
    event.key === "Play" ||
    event.key === "Pause" ||
    event.keyCode === 85 ||
    event.keyCode === 126 ||
    event.keyCode === 127
  );
}`,
`function isPlayPauseKey(event: KeyboardEvent) {
  return (
    event.key === "MediaPlayPause" ||
    event.key === "Play" ||
    event.key === "Pause" ||
    event.keyCode === 85 ||
    event.keyCode === 126 ||
    event.keyCode === 127
  );
}

function isMenuKey(event: KeyboardEvent) {
  return (
    event.key === "Menu" ||
    event.key === "ContextMenu" ||
    event.key === "Apps" ||
    event.keyCode === 82
  );
}

function isSearchKey(event: KeyboardEvent) {
  return (
    event.key === "Search" ||
    event.key === "Find" ||
    event.keyCode === 84
  );
}`
    );
  }

  if (!content.includes("function focusHeaderSearch(")) {
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
}

function focusHeaderSearch(pathname: string) {
  const target =
    document.querySelector<HTMLElement>("[data-tv-header-search-input]") ||
    document.querySelector<HTMLElement>("[data-tv-header-search-toggle]") ||
    document.querySelector<HTMLElement>("header input");

  if (!target || !isVisibleElement(target)) return false;
  focusElement(target, pathname);
  return true;
}

function focusHeaderMenu(pathname: string) {
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
}

function isFirstRowInScope(activeElement: Element | null, root: ParentNode) {
  if (!(activeElement instanceof HTMLElement)) return false;

  const focusableElements = getFocusableElements(root);
  const rows = buildRows(root, focusableElements);
  const { rowIndex } = findRowIndex(rows, activeElement);

  return rowIndex <= 0;
}`
    );
  }

  if (!content.includes("if (isMenuKey(event)")) {
    content = content.replace(
`      if (visibleOverlay && !isTextInput(activeElement)) dispatchOverlayActivity();

      if (isBackKey(event) && !isTextInput(activeElement)) {`,
`      if (visibleOverlay && !isTextInput(activeElement)) dispatchOverlayActivity();

      if (isMenuKey(event) && !isTextInput(activeElement) && !openModalScope && !visibleOverlay) {
        event.preventDefault();
        event.stopPropagation();

        if (focusHeaderMenu(pathname)) {
          const target = document.activeElement;
          if (target instanceof HTMLButtonElement && target.hasAttribute("data-tv-header-menu-button")) {
            target.click();
          }
        }

        return;
      }

      if (isSearchKey(event) && !isTextInput(activeElement) && !openModalScope && !visibleOverlay) {
        event.preventDefault();
        event.stopPropagation();
        focusHeaderSearch(pathname);
        return;
      }

      if (isBackKey(event) && !isTextInput(activeElement)) {`
    );
  }

  if (!content.includes("direction === \"up\" && !openModalScope && !activeIsInsideVisibleOverlay && !isInsideTvRail(activeElement)")) {
    content = content.replace(
`      if (
        direction === "left" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {`,
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
      }

      if (
        direction === "left" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {`
    );
  }

  if (!content.includes("direction === \"up\" && focusHeaderSearch(pathname)")) {
    content = content.replace(
`      if (!nextElement || nextElement === current) {
        if (
          root instanceof HTMLElement &&
          (root.dataset.tvLock === "true" || root.dataset.tvModal || root.dataset.tvOverlay === "watch")
        ) {`,
`      if (!nextElement || nextElement === current) {
        if (
          direction === "up" &&
          !openModalScope &&
          !activeIsInsideVisibleOverlay &&
          focusHeaderSearch(pathname)
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (
          root instanceof HTMLElement &&
          (root.dataset.tvLock === "true" || root.dataset.tvModal || root.dataset.tvOverlay === "watch")
        ) {`
    );
  }

  write(relativePath, content);
}

function patchHeader() {
  const relativePath = "components/Header.tsx";
  let content = read(relativePath);

  content = content.replace(
    '<form onSubmit={submit} className="flex w-full items-center gap-2">',
    '<form onSubmit={submit} data-tv-row className="flex w-full items-center gap-2">'
  );

  content = content.replace(
`          <input
          value={keyword}`,
`          <input
          type="search"
          data-tv-header-search-input
          data-tv-focus-key="header:search-input"
          value={keyword}`
  );

  content = content.replace(
`        <button
          type="submit"
          className={[`,
`        <button
          type="submit"
          data-tv-focus-key="header:search-submit"
          className={[`
  );

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

  content = content.replace(
`        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm lg:hidden">`,
`        <div
          data-tv-modal
          data-tv-scope="header-menu"
          data-tv-lock="true"
          data-tv-autofocus="true"
          className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm lg:hidden"
        >`
  );

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

  content = content.replaceAll(
    '<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">',
    '<div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3">'
  );

  write(relativePath, content);
}

function patchNativeVideoPlayer() {
  const relativePath = "components/NativeVideoPlayer.tsx";
  let content = read(relativePath);

  content = content.replace(
`type NativeVideoPlayerProps = {
  src: string;
  title: string;
  subtitle?: string;
  poster?: string;
  /**
   * true: TV remote overlay điều khiển video, không hiện browser controls.
   * false: desktop/mobile dùng browser controls bình thường.
   */
  tvMode?: boolean;
};`,
`type NativeVideoPlayerProps = {
  src: string;
  title: string;
  subtitle?: string;
  poster?: string;
  progressKey?: string;
  /**
   * true: TV remote overlay điều khiển video, không hiện browser controls.
   * false: desktop/mobile dùng browser controls bình thường.
   */
  tvMode?: boolean;
};

const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";

type StoredVideoProgress = {
  currentTime: number;
  duration: number;
  updatedAt: string;
  title?: string;
  subtitle?: string;
};

function readProgressMap() {
  try {
    const raw = localStorage.getItem(VIDEO_PROGRESS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data as Record<string, StoredVideoProgress> : {};
  } catch {
    return {};
  }
}

function readVideoProgress(progressKey?: string) {
  if (!progressKey) return null;
  return readProgressMap()[progressKey] || null;
}

function saveVideoProgress(progressKey: string | undefined, progress: StoredVideoProgress) {
  if (!progressKey) return;
  if (!Number.isFinite(progress.currentTime) || progress.currentTime < 1) return;

  try {
    const map = readProgressMap();
    map[progressKey] = progress;
    localStorage.setItem(VIDEO_PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors in restricted TV WebViews.
  }
}`
  );

  content = content.replace(
`  poster,
  tvMode = false,
}: NativeVideoPlayerProps) {`,
`  poster,
  progressKey,
  tvMode = false,
}: NativeVideoPlayerProps) {`
  );

  content = content.replace(
`  const autoplayDoneRef = useRef(false);
  const [error, setError] = useState<string>("");`,
`  const autoplayDoneRef = useRef(false);
  const restoreDoneRef = useRef(false);
  const lastProgressSaveRef = useRef(0);
  const [error, setError] = useState<string>("");`
  );

  content = content.replace(
`    userPausedRef.current = false;
    autoplayDoneRef.current = false;`,
`    userPausedRef.current = false;
    autoplayDoneRef.current = false;
    restoreDoneRef.current = false;
    lastProgressSaveRef.current = 0;`
  );

  content = content.replace(
`    function autoplayQuietly() {
      if (!tvMode) return;
      if (userPausedRef.current || autoplayDoneRef.current) return;

      void attemptPlay({ showError: false, forced: false });
    }

    video.addEventListener("loadedmetadata", autoplayQuietly);
    video.addEventListener("canplay", autoplayQuietly, { once: true });`,
`    function restoreProgressIfNeeded() {
      if (restoreDoneRef.current) return;
      restoreDoneRef.current = true;

      const saved = readVideoProgress(progressKey);
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const savedTime = Number(saved?.currentTime || 0);

      if (savedTime > 8 && (!duration || savedTime < duration - 8)) {
        try {
          video.currentTime = savedTime;
        } catch {
          // Some streams reject seek before enough data is buffered.
        }
      }
    }

    function saveProgressNow() {
      if (!progressKey) return;

      const currentTime = video.currentTime || 0;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;

      saveVideoProgress(progressKey, {
        currentTime,
        duration,
        updatedAt: new Date().toISOString(),
        title,
        subtitle,
      });
    }

    function saveProgressThrottled() {
      const now = Date.now();
      if (now - lastProgressSaveRef.current < 3000) return;
      lastProgressSaveRef.current = now;
      saveProgressNow();
    }

    function handleLoadedMetadata() {
      restoreProgressIfNeeded();
      autoplayQuietly();
    }

    function autoplayQuietly() {
      if (!tvMode) return;
      if (userPausedRef.current || autoplayDoneRef.current) return;

      void attemptPlay({ showError: false, forced: false });
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", saveProgressThrottled);
    video.addEventListener("pause", saveProgressNow);
    video.addEventListener("ended", saveProgressNow);
    video.addEventListener("canplay", autoplayQuietly, { once: true });`
  );

  content = content.replace(
`        video.removeEventListener("loadedmetadata", autoplayQuietly);
        video.removeEventListener("canplay", autoplayQuietly);
        hls.destroy();`,
`        saveProgressNow();
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("timeupdate", saveProgressThrottled);
        video.removeEventListener("pause", saveProgressNow);
        video.removeEventListener("ended", saveProgressNow);
        video.removeEventListener("canplay", autoplayQuietly);
        hls.destroy();`
  );

  content = content.replace(
`      video.removeEventListener("loadedmetadata", autoplayQuietly);
      video.removeEventListener("canplay", autoplayQuietly);
      video.removeAttribute("src");`,
`      saveProgressNow();
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", saveProgressThrottled);
      video.removeEventListener("pause", saveProgressNow);
      video.removeEventListener("ended", saveProgressNow);
      video.removeEventListener("canplay", autoplayQuietly);
      video.removeAttribute("src");`
  );

  content = content.replace(
`  }, [attemptPlay, src, tvMode]);`,
`  }, [attemptPlay, progressKey, src, subtitle, title, tvMode]);`
  );

  write(relativePath, content);
}

function patchWatchClient() {
  const relativePath = "components/WatchClient.tsx";
  let content = read(relativePath);

  content = content.replace(
`                poster={posterUrl}
                tvMode`,
`                poster={posterUrl}
                progressKey={currentWatchedKey}
                tvMode`
  );

  content = content.replace(
`                poster={posterUrl}
              />`,
`                poster={posterUrl}
                progressKey={currentWatchedKey}
              />`
  );

  write(relativePath, content);
}

patchTvRemoteNavigator();
patchHeader();
patchNativeVideoPlayer();
patchWatchClient();

console.log("Done. Run: npm run lint && npm run build");