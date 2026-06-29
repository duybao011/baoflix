const fs = require("fs");
const path = require("path");

const root = process.cwd();
const watchPath = path.join(root, "components", "WatchClient.tsx");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) return text;
  if (!text.includes(oldText)) {
    throw new Error(`Không tìm thấy đoạn cần vá: ${label}`);
  }
  return text.replace(oldText, newText);
}

function ensureWithTvAutoplayParams(text) {
  if (text.includes("function withTvAutoplayParams")) return text;

  const marker = `function detectTvOverlayEnabled() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const forceTv = searchParams.get("tv") === "1";
    const forceNormal = searchParams.get("tv") === "0";

    if (forceNormal) return false;
    if (forceTv || isBaoflixTvShell() || isTvUserAgent()) return true;

    if (isMobileDevice()) {
      sessionStorage.removeItem("baoflix_tv_mode");
      localStorage.removeItem("baoflix_tv_mode");
      return false;
    }

    return sessionStorage.getItem("baoflix_tv_mode") === "1";
  } catch {
    return false;
  }
}
`;

  const helper = `
function withTvAutoplayParams(url?: string) {
  const raw = String(url || "").trim();

  if (!raw) return raw;

  const [withoutHash, hash = ""] = raw.split("#");
  const separator = withoutHash.includes("?") ? "&" : "?";
  const params = "autoplay=1&autoPlay=1&muted=0&playsinline=1";

  return `${withoutHash}${separator}${params}${hash ? `#${hash}` : ""}`;
}
`;

  return replaceOnce(text, marker, marker + helper, "insert withTvAutoplayParams");
}

function patchWatchClient() {
  let text = read(watchPath);

  text = ensureWithTvAutoplayParams(text);

  if (!text.includes("const shouldUseNativeVideo")) {
    text = replaceOnce(
      text,
      `  const posterUrl = movie.thumb_url || movie.poster_url;
  const nativeVideoUrl = episode?.link_m3u8;
`,
      `  const posterUrl = movie.thumb_url || movie.poster_url;
  const nativeVideoUrl = episode?.link_m3u8;
  const shouldUseNativeVideo = Boolean(
    nativeVideoUrl && (tvOverlayEnabled || !episode?.link_embed)
  );
`,
      "add shouldUseNativeVideo"
    );
  }

  text = text.replace("{nativeVideoUrl ? (", "{shouldUseNativeVideo ? (");

  if (!text.includes("tvMode={tvOverlayEnabled}")) {
    text = replaceOnce(
      text,
      `              <NativeVideoPlayer
                src={nativeVideoUrl}
`,
      `              <NativeVideoPlayer
                tvMode={tvOverlayEnabled}
                src={nativeVideoUrl}
`,
      "pass tvMode to NativeVideoPlayer"
    );
  }

  // Nếu bản TV overlay final fix đã áp dụng rồi thì giữ nguyên. Nếu chưa, vá iframe chỉ khi TV mode bật.
  if (!text.includes("src={tvOverlayEnabled ? withTvAutoplayParams(episode.link_embed) : episode.link_embed}")) {
    text = text.replace(
      `                src={episode.link_embed}
                tabIndex={0}
                data-tv-player="iframe"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                className="h-full w-full bg-black outline-none"
                title={`${movie.name} - ${episode.name}`}
`,
      `                src={tvOverlayEnabled ? withTvAutoplayParams(episode.link_embed) : episode.link_embed}
                tabIndex={tvOverlayEnabled ? -1 : 0}
                data-tv-player="iframe"
                data-tv-skip={tvOverlayEnabled ? true : undefined}
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                className={[
                  "h-full w-full bg-black outline-none",
                  tvOverlayEnabled ? "pointer-events-none" : "",
                ].join(" ")}
                title={`${movie.name} - ${episode.name}`}
`
    );
  }

  write(watchPath, text);
}

patchWatchClient();
console.log("Applied TV sandbox restore: desktop/mobile player restored, TV behavior kept isolated.");
