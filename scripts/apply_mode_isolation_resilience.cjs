const fs = require("fs");
const path = require("path");

const root = process.cwd();

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(filePath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(filePath(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.mkdirSync(path.dirname(filePath(relativePath)), { recursive: true });
  fs.writeFileSync(filePath(relativePath), content, "utf8");
  console.log(`patched ${relativePath}`);
}

function replaceStrict(content, from, to, label) {
  if (!content.includes(from)) {
    throw new Error(`Không tìm thấy đoạn cần vá: ${label}`);
  }

  return content.replace(from, to);
}

function ensureImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const lines = content.split("\n");
  const useClientIndex = lines.findIndex((line) => line.trim() === '"use client";');
  const insertAt = useClientIndex >= 0 ? useClientIndex + 1 : 0;
  lines.splice(insertAt, 0, importLine);
  return lines.join("\n");
}

function writeTvModeHelper() {
  write(
    "lib/tvMode.ts",
    `"use client";

const TV_SESSION_KEY = "baoflix_tv_mode";
const TV_LOCAL_KEY = "baoflix_tv_mode";

type TvModeOptions = {
  /**
   * Laptop/desktop chỉ được bật TV bằng sessionStorage khi option này true.
   * Dùng false cho player/watch để TV logic không rò sang laptop sau khi test.
   */
  allowSessionOnDesktop?: boolean;
};

export function getBaoflixUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent.toLowerCase();
}

export function isBaoflixTvShell() {
  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview/.test(
    getBaoflixUserAgent()
  );
}

export function isTvUserAgent() {
  return /android tv|google tv|googletv|smart-tv|smarttv|hbbtv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku|tcl|mitv/.test(
    getBaoflixUserAgent()
  );
}

export function isMobileDevice() {
  const userAgent = getBaoflixUserAgent();

  if (!userAgent) return false;
  if (isBaoflixTvShell() || isTvUserAgent()) return false;

  return /iphone|ipad|ipod|android.+mobile|mobile/.test(userAgent);
}

export function isDesktopMouseDevice() {
  if (typeof window === "undefined") return false;

  return window.matchMedia(
    "(min-width: 1024px) and (hover: hover) and (pointer: fine)"
  ).matches;
}

function getTvParam() {
  try {
    return new URLSearchParams(window.location.search).get("tv");
  } catch {
    return null;
  }
}

function readStoredTvMode() {
  try {
    return (
      sessionStorage.getItem(TV_SESSION_KEY) ||
      localStorage.getItem(TV_LOCAL_KEY) ||
      ""
    );
  } catch {
    return "";
  }
}

export function isTvModeActive(options: TvModeOptions = {}) {
  if (typeof window === "undefined") return false;

  const { allowSessionOnDesktop = true } = options;
  const tvParam = getTvParam();

  if (tvParam === "0") return false;
  if (tvParam === "1") return true;
  if (isBaoflixTvShell() || isTvUserAgent()) return true;
  if (isMobileDevice()) return false;

  const storedMode = readStoredTvMode();
  if (storedMode !== "1") return false;

  if (!allowSessionOnDesktop && isDesktopMouseDevice()) return false;

  return true;
}

export function clearTvModeForNormalDevice() {
  if (typeof window === "undefined") return;

  try {
    if (isMobileDevice()) {
      sessionStorage.removeItem(TV_SESSION_KEY);
      localStorage.removeItem(TV_LOCAL_KEY);
      document.documentElement.dataset.baoflixTvMode = "0";
    }
  } catch {
    // Ignore storage restrictions.
  }
}
`
  );
}

function patchNativeVideoPlayer() {
  write(
    "components/NativeVideoPlayer.tsx",
    `"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";

type PlayerCommandDetail = {
  action: PlayerCommandAction;
  seconds?: number;
  handled?: boolean;
};

type NativeVideoPlayerProps = {
  src: string;
  title: string;
  subtitle?: string;
  poster?: string;
  /**
   * true: TV remote overlay điều khiển video, không hiện browser controls.
   * false: desktop/mobile dùng browser controls bình thường.
   */
  tvMode?: boolean;
};

const DEFAULT_SEEK_SECONDS = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function emitHud(detail: {
  type: "seek" | "play" | "pause";
  delta?: number;
  currentTime?: number;
  duration?: number;
}) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-player-hud", {
      detail,
    })
  );
}

function focusRemoteSurface() {
  window.dispatchEvent(new Event("baoflix-focus-tv-player-surface"));
}

function safeSetMediaSessionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null
) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Một số TV WebView chỉ hỗ trợ một phần Media Session.
  }
}

export default function NativeVideoPlayer({
  src,
  title,
  subtitle,
  poster,
  tvMode = false,
}: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const autoplayDoneRef = useRef(false);
  const [error, setError] = useState<string>("");

  const attemptPlay = useCallback(
    async ({
      showError = false,
      forced = false,
    }: {
      showError?: boolean;
      forced?: boolean;
    } = {}) => {
      const video = videoRef.current;

      if (!video || !tvMode) return false;

      if (userPausedRef.current && !forced) {
        focusRemoteSurface();
        return false;
      }

      try {
        video.autoplay = true;
        await video.play();
        userPausedRef.current = false;
        autoplayDoneRef.current = true;
        setError("");
        focusRemoteSurface();
        return true;
      } catch {
        if (showError) {
          setError("TV chặn tự phát. Bấm OK một lần để phát video.");
        }

        focusRemoteSurface();
        return false;
      }
    },
    [tvMode]
  );

  const playVideo = useCallback(
    async ({ showError = true, showHud = true }: { showError?: boolean; showHud?: boolean } = {}) => {
      const played = await attemptPlay({ showError, forced: true });

      if (played && showHud) {
        emitHud({ type: "play" });
      }
    },
    [attemptPlay]
  );

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;

    if (!video || !tvMode) return;

    userPausedRef.current = true;
    video.pause();
    focusRemoteSurface();
    emitHud({ type: "pause" });
  }, [tvMode]);

  const seekVideo = useCallback((seconds: number) => {
    const video = videoRef.current;

    if (!video || !tvMode) return;

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const maxTime = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const nextTime = clamp(video.currentTime + seconds, 0, maxTime);

    video.currentTime = nextTime;
    focusRemoteSurface();

    emitHud({
      type: "seek",
      delta: seconds,
      currentTime: nextTime,
      duration,
    });
  }, [tvMode]);

  const handleCommand = useCallback(
    (detail: PlayerCommandDetail) => {
      if (!tvMode) return;

      detail.handled = true;

      if (detail.action === "focus-player") {
        // Chỉ trả focus về bề mặt remote. Không được tự play lại khi user đã pause.
        focusRemoteSurface();
        return;
      }

      if (detail.action === "seek") {
        seekVideo(detail.seconds || DEFAULT_SEEK_SECONDS);
        return;
      }

      if (detail.action === "toggle-play") {
        const video = videoRef.current;

        if (!video) return;

        if (video.paused) {
          void playVideo({ showError: true, showHud: true });
        } else {
          pauseVideo();
        }

        return;
      }

      if (detail.action === "play") {
        void playVideo({ showError: true, showHud: true });
        return;
      }

      if (detail.action === "pause") {
        pauseVideo();
      }
    },
    [pauseVideo, playVideo, seekVideo, tvMode]
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) return;

    setError("");
    userPausedRef.current = false;
    autoplayDoneRef.current = false;

    video.controls = !tvMode;
    video.autoplay = tvMode;
    video.preload = tvMode ? "auto" : "metadata";

    if (tvMode) {
      video.removeAttribute("controls");
    } else {
      video.setAttribute("controls", "");
    }

    function autoplayQuietly() {
      if (!tvMode) return;
      if (userPausedRef.current || autoplayDoneRef.current) return;

      void attemptPlay({ showError: false, forced: false });
    }

    video.addEventListener("loadedmetadata", autoplayQuietly);
    video.addEventListener("canplay", autoplayQuietly, { once: true });

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        autoplayQuietly();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("Không phát được HLS bằng player native. Hãy thử đổi nguồn.");
        }
      });

      return () => {
        video.removeEventListener("loadedmetadata", autoplayQuietly);
        video.removeEventListener("canplay", autoplayQuietly);
        hls.destroy();
      };
    }

    video.src = src;
    video.load();
    autoplayQuietly();

    return () => {
      video.removeEventListener("loadedmetadata", autoplayQuietly);
      video.removeEventListener("canplay", autoplayQuietly);
      video.removeAttribute("src");
      video.load();
    };
  }, [attemptPlay, src, tvMode]);

  useEffect(() => {
    if (!tvMode) return;

    function onPlayerCommand(event: Event) {
      const detail = (event as CustomEvent<PlayerCommandDetail>).detail;

      if (!detail || detail.handled) return;

      handleCommand(detail);
    }

    window.addEventListener("baoflix-tv-player-command", onPlayerCommand as EventListener);

    return () => {
      window.removeEventListener("baoflix-tv-player-command", onPlayerCommand as EventListener);
    };
  }, [handleCommand, tvMode]);

  useEffect(() => {
    const video = videoRef.current;

    if (!tvMode || !video || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: subtitle || "BảoFlix",
        artwork: poster
          ? [
              { src: poster, sizes: "512x512", type: "image/png" },
            ]
          : undefined,
      });
    } catch {
      // Metadata artwork có thể lỗi với URL tương đối trong vài WebView TV.
    }

    safeSetMediaSessionHandler("play", () => {
      void playVideo({ showError: true, showHud: true });
    });
    safeSetMediaSessionHandler("pause", () => {
      pauseVideo();
    });
    safeSetMediaSessionHandler("seekbackward", (details) => {
      seekVideo(-((details as MediaSessionActionDetails).seekOffset || DEFAULT_SEEK_SECONDS));
    });
    safeSetMediaSessionHandler("seekforward", (details) => {
      seekVideo((details as MediaSessionActionDetails).seekOffset || DEFAULT_SEEK_SECONDS);
    });
    safeSetMediaSessionHandler("seekto", (details) => {
      const seekTo = (details as MediaSessionActionDetails).seekTime;

      if (typeof seekTo === "number") {
        video.currentTime = seekTo;
        focusRemoteSurface();
      }
    });

    return () => {
      safeSetMediaSessionHandler("play", null);
      safeSetMediaSessionHandler("pause", null);
      safeSetMediaSessionHandler("seekbackward", null);
      safeSetMediaSessionHandler("seekforward", null);
      safeSetMediaSessionHandler("seekto", null);
    };
  }, [pauseVideo, playVideo, poster, seekVideo, subtitle, title, tvMode]);

  useEffect(() => {
    const video = videoRef.current;

    if (!tvMode || !video || !("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;

    function updatePositionState() {
      const currentVideo = videoRef.current;

      if (!currentVideo || !Number.isFinite(currentVideo.duration)) return;

      try {
        navigator.mediaSession.setPositionState({
          duration: currentVideo.duration,
          playbackRate: currentVideo.playbackRate || 1,
          position: currentVideo.currentTime,
        });
      } catch {
        // Ignore unsupported position state in older WebViews.
      }
    }

    video.addEventListener("timeupdate", updatePositionState);
    video.addEventListener("loadedmetadata", updatePositionState);

    return () => {
      video.removeEventListener("timeupdate", updatePositionState);
      video.removeEventListener("loadedmetadata", updatePositionState);
    };
  }, [tvMode]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        data-tv-player={tvMode ? "native-video" : undefined}
        data-tv-player-native={tvMode ? "true" : undefined}
        data-tv-skip={tvMode ? true : undefined}
        tabIndex={tvMode ? -1 : 0}
        autoPlay={tvMode}
        playsInline
        preload={tvMode ? "auto" : "metadata"}
        poster={poster}
        controls={!tvMode}
        controlsList={tvMode ? "nodownload nofullscreen noremoteplayback" : "nodownload"}
        className={[
          tvMode ? "pointer-events-none" : "",
          "h-full w-full bg-black object-contain outline-none",
        ].join(" ")}
        onPlay={() => {
          if (!tvMode) return;
          userPausedRef.current = false;
          autoplayDoneRef.current = true;
          setError("");
        }}
        onPause={() => {
          if (!tvMode) return;
          userPausedRef.current = true;
        }}
      />

      {error && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
`
  );
}

function patchWatchClient() {
  const relativePath = "components/WatchClient.tsx";
  let content = read(relativePath);

  content = ensureImport(content, 'import { isTvModeActive } from "@/lib/tvMode";');

  content = content.replace(
    /function getUserAgent\(\)[\s\S]*?function detectTvOverlayEnabled\(\) \{[\s\S]*?\n\}/,
    `function detectTvOverlayEnabled() {
  return isTvModeActive({ allowSessionOnDesktop: false });
}`
  );

  if (!content.includes("const useTvNativePlayer")) {
    content = content.replace(
      "  const nativeVideoUrl = episode?.link_m3u8;\n",
      `  const nativeVideoUrl = episode?.link_m3u8;
  const useTvNativePlayer = tvOverlayEnabled && Boolean(nativeVideoUrl);
  const useNormalNativePlayer =
    !tvOverlayEnabled && Boolean(nativeVideoUrl) && !episode?.link_embed;

  const playerIframeSrc = useMemo(() => {
    if (!episode?.link_embed) return "";
    if (!tvOverlayEnabled) return episode.link_embed;

    try {
      const url = new URL(episode.link_embed, window.location.origin);
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("autoPlay", "1");
      url.searchParams.set("muted", "0");
      url.searchParams.set("playsinline", "1");
      return url.toString();
    } catch {
      return episode.link_embed;
    }
  }, [episode?.link_embed, tvOverlayEnabled]);
`
    );
  }

  const oldBlock = `            {nativeVideoUrl ? (
              <NativeVideoPlayer
                src={nativeVideoUrl}
                title={\`\${movie.name} - \${episode?.name || \`Tập \${safeEpisodeIndex + 1}\`}\`}
                subtitle={normalizeServerName(currentServer?.server_name)}
                poster={posterUrl}
              />
            ) : episode?.link_embed ? (
              <iframe
                src={episode.link_embed}
                tabIndex={0}
                data-tv-player="iframe"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                className="h-full w-full bg-black outline-none"
                title={\`\${movie.name} - \${episode.name}\`}
              />
            ) : (`;

  const newBlock = `            {useTvNativePlayer && nativeVideoUrl ? (
              <NativeVideoPlayer
                src={nativeVideoUrl}
                title={\`\${movie.name} - \${episode?.name || \`Tập \${safeEpisodeIndex + 1}\`}\`}
                subtitle={normalizeServerName(currentServer?.server_name)}
                poster={posterUrl}
                tvMode
              />
            ) : episode?.link_embed ? (
              <iframe
                src={playerIframeSrc}
                tabIndex={tvOverlayEnabled ? -1 : 0}
                data-tv-player="iframe"
                data-tv-skip={tvOverlayEnabled ? true : undefined}
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                className={[
                  "h-full w-full bg-black outline-none",
                  tvOverlayEnabled ? "pointer-events-none" : "",
                ].join(" ")}
                title={\`\${movie.name} - \${episode.name}\`}
              />
            ) : useNormalNativePlayer && nativeVideoUrl ? (
              <NativeVideoPlayer
                src={nativeVideoUrl}
                title={\`\${movie.name} - \${episode?.name || \`Tập \${safeEpisodeIndex + 1}\`}\`}
                subtitle={normalizeServerName(currentServer?.server_name)}
                poster={posterUrl}
              />
            ) : (`;

  if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
  } else if (!content.includes("useTvNativePlayer && nativeVideoUrl")) {
    throw new Error("Không tìm thấy block player trong WatchClient để vá.");
  }

  write(relativePath, content);
}

function patchMobileBackButton() {
  const relativePath = "components/MobileBackButton.tsx";
  let content = read(relativePath);

  content = content.replace(
    `function shouldHideBackButton(pathname: string) {
  return pathname === "/" || pathname.startsWith("/xem");
}`,
    `function shouldHideBackButton(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/xem") ||
    /^\\/ca-nhan\\/[^/]+\\/xem/.test(pathname)
  );
}`
  );

  write(relativePath, content);
}

function patchTvPlayerCommandBridge() {
  const relativePath = "components/TvPlayerCommandBridge.tsx";
  let content = read(relativePath);

  content = ensureImport(content, 'import { isTvModeActive } from "@/lib/tvMode";');

  content = content.replace(
    `    function handleCommand(event: Event) {
      const command = (event as CustomEvent<PlayerCommand>).detail || {};

      handleIframeOnlyCommand(command);
    }`,
    `    function handleCommand(event: Event) {
      if (!isTvModeActive({ allowSessionOnDesktop: false })) return;

      const command = (event as CustomEvent<PlayerCommand>).detail || {};

      handleIframeOnlyCommand(command);
    }`
  );

  content = content.replace(
    `    window.__baoflixFocusWebPlayer = focusIframePlayer;
    window.BaoFlixTVWeb = {`,
    `    window.__baoflixFocusWebPlayer = () => {
      if (!isTvModeActive({ allowSessionOnDesktop: false })) return false;
      return focusIframePlayer();
    };
    window.BaoFlixTVWeb = {`
  );

  content = content.replace(
    `      focusPlayer: focusIframePlayer,
      onNativeSeekKey(direction) {
        handleIframeOnlyCommand({`,
    `      focusPlayer() {
        if (!isTvModeActive({ allowSessionOnDesktop: false })) return false;
        return focusIframePlayer();
      },
      onNativeSeekKey(direction) {
        if (!isTvModeActive({ allowSessionOnDesktop: false })) return;
        handleIframeOnlyCommand({`
  );

  write(relativePath, content);
}

function patchKkphim() {
  const relativePath = "lib/kkphim.ts";
  let content = read(relativePath);

  if (!content.includes("const KKPHIM_FETCH_TIMEOUT_MS")) {
    content = content.replace(
      'const PLACEHOLDER_IMAGE = "/placeholder.svg";',
      `const PLACEHOLDER_IMAGE = "/placeholder.svg";
const KKPHIM_FETCH_TIMEOUT_MS = 8000;`
    );
  }

  const oldFetchJson = `async function fetchJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : \`\${API_BASE}\${path}\`;

  const res = await fetch(url, {
    next: {
      revalidate: 1800,
    },
  });

  if (!res.ok) {
    throw new Error(\`KKPhim API error: \${res.status}\`);
  }

  return res.json();
}`;

  const newFetchJson = `async function fetchJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : \`\${API_BASE}\${path}\`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KKPHIM_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      next: {
        revalidate: 1800,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(\`KKPhim API error: \${res.status}\`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(\`KKPhim API timeout after \${KKPHIM_FETCH_TIMEOUT_MS}ms\`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}`;

  if (content.includes(oldFetchJson)) {
    content = content.replace(oldFetchJson, newFetchJson);
  }

  const replacements = [
    {
      label: "getMoviesByList",
      from: `export async function getMoviesByList(
  typeList: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, filters);

  const data = await fetchJson<any>(\`/v1/api/danh-sach/\${typeList}?\${params}\`);

  return buildListResult(data, \`Danh sách: \${typeList}\`);
}`,
      to: `export async function getMoviesByList(
  typeList: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, filters);

  try {
    const data = await fetchJson<any>(\`/v1/api/danh-sach/\${typeList}?\${params}\`);
    return buildListResult(data, \`Danh sách: \${typeList}\`);
  } catch (error) {
    console.warn("Lỗi lấy danh sách phim:", typeList, error);
    return emptyMovieResult(\`Danh sách: \${typeList}\`, page);
  }
}`,
    },
    {
      label: "getMoviesByGenre",
      from: `export async function getMoviesByGenre(
  genreSlug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, {
    ...filters,
    category: undefined,
  });

  const data = await fetchJson<any>(\`/v1/api/the-loai/\${genreSlug}?\${params}\`);

  return buildListResult(data, \`Thể loại: \${genreSlug}\`);
}`,
      to: `export async function getMoviesByGenre(
  genreSlug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, {
    ...filters,
    category: undefined,
  });

  try {
    const data = await fetchJson<any>(\`/v1/api/the-loai/\${genreSlug}?\${params}\`);
    return buildListResult(data, \`Thể loại: \${genreSlug}\`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo thể loại:", genreSlug, error);
    return emptyMovieResult(\`Thể loại: \${genreSlug}\`, page);
  }
}`,
    },
    {
      label: "getMoviesByCountry",
      from: `export async function getMoviesByCountry(
  countrySlug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, {
    ...filters,
    country: undefined,
  });

  const data = await fetchJson<any>(\`/v1/api/quoc-gia/\${countrySlug}?\${params}\`);

  return buildListResult(data, \`Quốc gia: \${countrySlug}\`);
}`,
      to: `export async function getMoviesByCountry(
  countrySlug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, {
    ...filters,
    country: undefined,
  });

  try {
    const data = await fetchJson<any>(\`/v1/api/quoc-gia/\${countrySlug}?\${params}\`);
    return buildListResult(data, \`Quốc gia: \${countrySlug}\`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo quốc gia:", countrySlug, error);
    return emptyMovieResult(\`Quốc gia: \${countrySlug}\`, page);
  }
}`,
    },
    {
      label: "getMoviesByYear",
      from: `export async function getMoviesByYear(
  year: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, {
    ...filters,
    year: undefined,
  });

  const data = await fetchJson<any>(\`/v1/api/nam/\${year}?\${params}\`);

  return buildListResult(data, \`Năm: \${year}\`);
}`,
      to: `export async function getMoviesByYear(
  year: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, {
    ...filters,
    year: undefined,
  });

  try {
    const data = await fetchJson<any>(\`/v1/api/nam/\${year}?\${params}\`);
    return buildListResult(data, \`Năm: \${year}\`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo năm:", year, error);
    return emptyMovieResult(\`Năm: \${year}\`, page);
  }
}`,
    },
  ];

  replacements.forEach(({ from, to }) => {
    if (content.includes(from)) {
      content = content.replace(from, to);
    }
  });

  write(relativePath, content);
}

function patchRelatedMovies() {
  const relativePath = "components/RelatedMovies.tsx";
  let content = read(relativePath);

  const next = `import MovieGrid from "@/components/MovieGrid";
import {
  getMoviesByCountry,
  getMoviesByGenre,
  getMoviesByYear,
  MovieDetail,
  MovieItem,
  MovieListResult,
} from "@/lib/kkphim";

function addUniqueMovies(
  target: MovieItem[],
  source: MovieItem[],
  currentSlug: string
) {
  const existingSlugs = new Set(target.map((movie) => movie.slug));

  source.forEach((movie) => {
    if (!movie?.slug) return;
    if (movie.slug === currentSlug) return;
    if (existingSlugs.has(movie.slug)) return;

    target.push(movie);
    existingSlugs.add(movie.slug);
  });
}

async function safeRelatedResult(
  label: string,
  loader: () => Promise<MovieListResult>
) {
  try {
    return await loader();
  } catch (error) {
    console.warn("Lỗi lấy phim liên quan:", label, error);
    return null;
  }
}

export default async function RelatedMovies({ movie }: { movie: MovieDetail }) {
  const countrySlug = movie.country?.[0]?.slug;
  const categorySlug = movie.category?.[0]?.slug;
  const year = movie.year ? String(movie.year) : "";

  const relatedMovies: MovieItem[] = [];

  // Ưu tiên 1: cùng quốc gia
  if (countrySlug) {
    const countryResult = await safeRelatedResult(countrySlug, () =>
      getMoviesByCountry(countrySlug, 1, 24)
    );
    addUniqueMovies(relatedMovies, countryResult?.items || [], movie.slug);
  }

  // Ưu tiên 2: cùng thể loại
  if (categorySlug && relatedMovies.length < 18) {
    const categoryResult = await safeRelatedResult(categorySlug, () =>
      getMoviesByGenre(categorySlug, 1, 24)
    );
    addUniqueMovies(relatedMovies, categoryResult?.items || [], movie.slug);
  }

  // Ưu tiên 3: cùng năm, chỉ để bù thêm nếu chưa đủ
  if (year && relatedMovies.length < 18) {
    const yearResult = await safeRelatedResult(year, () =>
      getMoviesByYear(year, 1, 24)
    );
    addUniqueMovies(relatedMovies, yearResult?.items || [], movie.slug);
  }

  const movies = relatedMovies.slice(0, 18);

  if (movies.length === 0) {
    return null;
  }

  return (
    <section>
      <MovieGrid title="Có thể fen sẽ thích" movies={movies} />
    </section>
  );
}
`;

  write(relativePath, next);
}

function addConnection(relativePath) {
  if (!exists(relativePath)) return;

  let content = read(relativePath);

  if (!content.includes('import { connection } from "next/server";')) {
    content = `import { connection } from "next/server";\n${content}`;
  }

  if (!content.includes("await connection();")) {
    content = content.replace(
      /(export default async function\s+[^{]+\{\n)/,
      `$1  await connection();\n`
    );
  }

  write(relativePath, content);
}

writeTvModeHelper();
patchNativeVideoPlayer();
patchWatchClient();
patchMobileBackButton();
patchTvPlayerCommandBridge();
patchKkphim();
patchRelatedMovies();

[
  "app/page.tsx",
  "app/tv/page.tsx",
  "app/the-loai/page.tsx",
  "app/quoc-gia/page.tsx",
  "app/loc/page.tsx",
  "app/tim-kiem/page.tsx",
  "app/danh-sach/[slug]/page.tsx",
  "app/the-loai/[slug]/page.tsx",
  "app/quoc-gia/[slug]/page.tsx",
  "app/nam/[year]/page.tsx",
].forEach(addConnection);

console.log("Done. Run: npm run lint && npm run build");