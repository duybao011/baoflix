from pathlib import Path

ROOT = Path.cwd()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Không tìm thấy đoạn cần thay: {label}")
    return text.replace(old, new, 1)


def patch_watch_client() -> None:
    path = ROOT / "components" / "WatchClient.tsx"
    text = path.read_text(encoding="utf-8")

    helper = '''
function withTvAutoplayParams(url?: string) {
  const raw = String(url || "").trim();

  if (!raw) return raw;

  const [withoutHash, hash = ""] = raw.split("#");
  const separator = withoutHash.includes("?") ? "&" : "?";
  const params = "autoplay=1&autoPlay=1&muted=0&playsinline=1";

  return `${withoutHash}${separator}${params}${hash ? `#${hash}` : ""}`;
}
'''

    if "function withTvAutoplayParams" not in text:
        marker = '''function detectTvOverlayEnabled() {
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
'''
        text = replace_once(text, marker, marker + helper, "insert withTvAutoplayParams")

    text = replace_once(
        text,
        '''                src={episode.link_embed}
                tabIndex={0}
                data-tv-player="iframe"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                className="h-full w-full bg-black outline-none"
                title={`${movie.name} - ${episode.name}`}
''',
        '''                src={tvOverlayEnabled ? withTvAutoplayParams(episode.link_embed) : episode.link_embed}
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
''',
        "iframe tv autoplay/no focus"
    )

    path.write_text(text, encoding="utf-8")


def patch_overlay_text() -> None:
    path = ROOT / "components" / "TvWatchOverlay.tsx"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "Nguồn này là iframe, remote đã chuyển focus vào player.",
        "Nguồn iframe: giữ remote ở ngoài để thanh player gốc tự ẩn."
    )
    text = text.replace(
        "Vào player",
        "Ẩn overlay"
    )
    path.write_text(text, encoding="utf-8")


patch_watch_client()
patch_overlay_text()
print("Đã vá WatchClient + TvWatchOverlay cho TV player overlay final fix.")
