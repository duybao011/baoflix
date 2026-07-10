#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()
CHANGED = []

def die(msg):
    print(f"\n[ERROR] {msg}")
    sys.exit(1)

def read(path):
    p = ROOT / path
    if not p.exists():
        die(f"Không tìm thấy {path}. Chạy script ở root project BảoFlix.")
    return p.read_text(encoding="utf-8")

def write(path, content):
    p = ROOT / path
    backup = p.with_suffix(p.suffix + ".phase5b.bak")
    if not backup.exists():
        shutil.copyfile(p, backup)
    p.write_text(content, encoding="utf-8")
    CHANGED.append(path)

def replace_once(content, old, new, label, required=True):
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content
    if old not in content:
        if required:
            die(f"Không thấy block: {label}")
        print(f"[WARN] Không thấy block: {label}")
        return content
    print(f"[OK] {label}")
    return content.replace(old, new, 1)

def repair_phase5a_focus_memory():
    path = "components/TvFocusMemory.tsx"
    content = read(path)

    if "NAVIGATOR_ACTIVE_FLAG" not in content:
        content = replace_once(
            content,
            'import { usePathname } from "next/navigation";',
            '''import { usePathname } from "next/navigation";

const NAVIGATOR_ACTIVE_FLAG = "__baoflixTvNavigatorActive";

function isTvNavigatorActive() {
  if (typeof window === "undefined") return false;

  return Boolean(
    (window as unknown as Record<string, boolean | undefined>)[NAVIGATOR_ACTIVE_FLAG]
  );
}''',
            "Phase 5A repair: thêm navigator active guard",
        )

    content = replace_once(
        content,
        '''    function saveFromTarget(target: EventTarget | null) {
      if (!isTvFocusMemoryEnabled()) return;''',
        '''    function saveFromTarget(target: EventTarget | null) {
      if (isTvNavigatorActive()) return;
      if (!isTvFocusMemoryEnabled()) return;''',
        "Phase 5A repair: legacy focus memory không ghi đè navigator",
    )

    content = replace_once(
        content,
        '''    function handleKeyDown(event: KeyboardEvent) {
      if (!isMemorySaveKey(event.key)) return;''',
        '''    function handleKeyDown(event: KeyboardEvent) {
      if (isTvNavigatorActive()) return;
      if (!isMemorySaveKey(event.key)) return;''',
        "Phase 5A repair: keydown legacy không ghi đè navigator",
    )

    write(path, content)

def patch_player_bridge():
    path = "components/TvPlayerCommandBridge.tsx"
    content = read(path)

    content = replace_once(
        content,
        '''type PlayerCommand = {
  action?: PlayerCommandAction;
  seconds?: number;
};''',
        '''type PlayerCommand = {
  action?: PlayerCommandAction;
  seconds?: number;
  handled?: boolean;
};''',
        "Player bridge: command có handled flag",
    )

    content = replace_once(
        content,
        '''function handleIframeOnlyCommand(command: PlayerCommand) {
  const nativeHandled = callNativeBridge(command);

  const focused = focusIframePlayer();
  const iframe = getVisiblePlayerIframe();

  if (iframe) {
    dispatchIframeKeyboardEvent(iframe, keyForCommand(command));
    sendSafePostMessage(command);
  }

  if (!nativeHandled && command.action === "seek") {
    notifyNativeMissing(command);
  }

  const handled = nativeHandled || focused || Boolean(iframe);
  if (handled) emitBridgeHud(command);

  return handled;
}''',
        '''function handleIframeOnlyCommand(command: PlayerCommand) {
  const nativeHandled = callNativeBridge(command);

  const focused = focusIframePlayer();
  const iframe = getVisiblePlayerIframe();

  if (iframe) {
    dispatchIframeKeyboardEvent(iframe, keyForCommand(command));
    sendSafePostMessage(command);
  }

  const handled = nativeHandled || focused || Boolean(iframe);

  if (handled) {
    command.handled = true;
    emitBridgeHud(command);
  }

  if (!handled && command.action === "seek") {
    notifyNativeMissing(command);
  }

  return handled;
}''',
        "Player bridge: chỉ báo missing khi thật sự không xử lý được",
    )

    content = replace_once(
        content,
        '''    function handleCommand(event: Event) {
      if (!isTvModeActive({ allowSessionOnDesktop: false })) return;

      const command = (event as CustomEvent<PlayerCommand>).detail || {};

      handleIframeOnlyCommand(command);
    }''',
        '''    function handleCommand(event: Event) {
      if (!isTvModeActive({ allowSessionOnDesktop: false })) return;

      const command = (event as CustomEvent<PlayerCommand>).detail || {};

      window.setTimeout(() => {
        if (command.handled) return;
        handleIframeOnlyCommand(command);
      }, 0);
    }''',
        "Player bridge: defer fallback để native player xử lý trước",
    )

    write(path, content)

def patch_native_player():
    path = "components/NativeVideoPlayer.tsx"
    content = read(path)

    content = replace_once(
        content,
        '''    map[progressKey] = progress;
    localStorage.setItem(VIDEO_PROGRESS_KEY, JSON.stringify(map));''',
        '''    map[progressKey] = progress;

    const trimmedEntries = Object.entries(map)
      .sort(([, a], [, b]) => {
        return Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || "");
      })
      .slice(0, 120);

    localStorage.setItem(
      VIDEO_PROGRESS_KEY,
      JSON.stringify(Object.fromEntries(trimmedEntries))
    );''',
        "Native player: giới hạn progress map 120 mục",
    )

    content = replace_once(
        content,
        '''      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("Không phát được HLS bằng player native. Hãy thử đổi nguồn.");
        }
      });''',
        '''      let networkRecoveryCount = 0;
      let mediaRecoveryCount = 0;

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveryCount < 2) {
          networkRecoveryCount += 1;
          setError("Mạng chập chờn, đang thử tải lại nguồn...");
          window.setTimeout(() => {
            try {
              hls.startLoad();
            } catch {}
          }, 900 * networkRecoveryCount);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryCount < 2) {
          mediaRecoveryCount += 1;
          setError("Luồng phát gặp lỗi, đang phục hồi player...");
          window.setTimeout(() => {
            try {
              hls.recoverMediaError();
            } catch {}
          }, 500 * mediaRecoveryCount);
          return;
        }

        setError("Không phát được HLS bằng player native. Hãy thử đổi nguồn.");
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        networkRecoveryCount = 0;
        mediaRecoveryCount = 0;
        setError("");
      });''',
        "Native HLS: retry network và recover media",
    )

    write(path, content)

def patch_watch_client_episode_matching():
    path = "components/WatchClient.tsx"
    content = read(path)

    old = '''function normalizeServerName(name?: string) {
  const text = String(name || "").toLowerCase();

  if (text.includes("lồng") || text.includes("long")) return "Lồng tiếng";
  if (text.includes("thuyết") || text.includes("thuyet")) return "Thuyết minh";
  if (text.includes("vietsub") || text.includes("sub")) return "Vietsub";

  return name || "Server";
}'''

    new = old + '''

function normalizeEpisodeIdentity(value?: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getEpisodeNumber(value?: string) {
  const match = normalizeEpisodeIdentity(value).match(/\d+(?:\.\d+)?/);
  return match?.[0] || "";
}

function findMatchingEpisodeIndex(
  currentEpisode: { name?: string; slug?: string } | undefined,
  targetEpisodes: { name?: string; slug?: string }[],
  fallbackIndex: number
) {
  if (!targetEpisodes.length) return -1;
  if (!currentEpisode) {
    return Math.min(fallbackIndex, targetEpisodes.length - 1);
  }

  const currentSlug = normalizeEpisodeIdentity(currentEpisode.slug);
  const currentName = normalizeEpisodeIdentity(currentEpisode.name);
  const currentNumber = getEpisodeNumber(currentEpisode.name || currentEpisode.slug);

  const bySlug = currentSlug
    ? targetEpisodes.findIndex(
        (item) => normalizeEpisodeIdentity(item.slug) === currentSlug
      )
    : -1;
  if (bySlug >= 0) return bySlug;

  const byName = currentName
    ? targetEpisodes.findIndex(
        (item) => normalizeEpisodeIdentity(item.name) === currentName
      )
    : -1;
  if (byName >= 0) return byName;

  const byNumber = currentNumber
    ? targetEpisodes.findIndex(
        (item) => getEpisodeNumber(item.name || item.slug) === currentNumber
      )
    : -1;
  if (byNumber >= 0) return byNumber;

  return Math.min(fallbackIndex, targetEpisodes.length - 1);
}'''

    content = replace_once(content, old, new, "WatchClient: thêm match tập theo slug/tên/số")

    content = replace_once(
        content,
        '''        const targetEpisodeIndex = Math.min(
          safeEpisodeIndex,
          Math.max(serverEpisodes.length - 1, 0)
        );''',
        '''        const targetEpisodeIndex = findMatchingEpisodeIndex(
          episode,
          serverEpisodes,
          safeEpisodeIndex
        );''',
        "WatchClient: đổi server không chỉ match theo index",
    )

    content = replace_once(
        content,
        '''  }, [servers, safeEpisodeIndex, movie.slug]);''',
        '''  }, [servers, safeEpisodeIndex, movie.slug, episode]);''',
        "WatchClient: cập nhật dependency match tập",
    )

    write(path, content)

def patch_overlay():
    path = "components/TvWatchOverlay.tsx"
    content = read(path)

    content = replace_once(
        content,
        '''  function openEpisodePanelFromOverlay() {
    clearHideTimer();
    setActiveChunkIndex(currentChunkIndex);
    setOverlayMode("panel");
    window.setTimeout(onOpenEpisodePanel, 0);
  }''',
        '''  function openEpisodePanelFromOverlay() {
    clearHideTimer();
    hideOverlay({ focusPlayer: false });
    window.setTimeout(onOpenEpisodePanel, 0);
  }''',
        "Overlay: ẩn lớp trong trước khi mở modal ngoài",
    )

    write(path, content)

def patch_episode_modal():
    path = "components/EpisodePickerModal.tsx"
    content = read(path)

    content = replace_once(
        content,
        'className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6"',
        'className="fixed inset-0 z-[120] flex items-end justify-center overflow-hidden bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6"',
        "Episode modal: nổi trên player immersive",
    )

    content = replace_once(
        content,
        '''function focusModalDefault() {
  window.setTimeout(() => {
    const modal = document.querySelector<HTMLElement>(
      "[data-tv-modal='episode-picker']"
    );

    if (!modal) return;

    const target =
      modal.querySelector<HTMLElement>("[data-tv-default]") ||
      modal.querySelector<HTMLElement>("a[href], button:not([disabled])");

    if (!target) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, 80);
}''',
        '''function focusModalDefault(serverIndex: number, episodeIndex: number) {
  window.setTimeout(() => {
    const modal = document.querySelector<HTMLElement>(
      "[data-tv-modal='episode-picker']"
    );

    if (!modal) return;

    const target =
      modal.querySelector<HTMLElement>(
        `[data-tv-focus-key="episode-picker:episode:${serverIndex}:${episodeIndex}"]`
      ) ||
      modal.querySelector<HTMLElement>(
        `[data-tv-focus-key="episode-picker:server:${serverIndex}"]`
      ) ||
      modal.querySelector<HTMLElement>("[data-tv-default]") ||
      modal.querySelector<HTMLElement>("a[href], button:not([disabled])");

    if (!target) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "center",
    });
  }, 80);
}''',
        "Episode modal: focus đúng tập hiện tại",
    )

    content = replace_once(
        content,
        '''  useEffect(() => {
    focusModalDefault();
  }, []);

  useEffect(() => {
    focusModalDefault();
  }, [selectedServerIndex, activeGroupIndex]);''',
        '''  useEffect(() => {
    focusModalDefault(safeServerIndex, safeEpisodeIndex);
  }, [safeServerIndex, safeEpisodeIndex]);''',
        "Episode modal: bỏ autofocus giành focus sau mỗi thao tác",
    )

    content = replace_once(
        content,
        '''                    onClick={() => selectServer(item.serverIndex)}
                    data-tv-default={active ? true : undefined}''',
        '''                    onClick={() => selectServer(item.serverIndex)}
                    data-tv-focus-key={`episode-picker:server:${item.serverIndex}`}
                    data-tv-default={active ? true : undefined}''',
        "Episode modal: focus key cho server",
    )

    content = replace_once(
        content,
        '''                        href={getEpisodeUrl(movie.slug, selectedServerIndex, episodeIndex)}
                        data-tv-default={active ? true : undefined}''',
        '''                        href={getEpisodeUrl(movie.slug, selectedServerIndex, episodeIndex)}
                        data-tv-focus-key={`episode-picker:episode:${selectedServerIndex}:${episodeIndex}`}
                        data-tv-episode-current={active ? "true" : undefined}
                        data-tv-default={active ? true : undefined}''',
        "Episode modal: focus key cho tập",
    )

    write(path, content)

def patch_fullscreen_hud():
    path = "components/FullscreenPlayerBox.tsx"
    content = read(path)

    content = replace_once(
        content,
        '''      {tvImmersive && playerHud && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/60 px-4 py-2 text-center text-white shadow-xl backdrop-blur">
          <div className="text-xl font-black">
            {playerHud.type === "seek"
              ? `${playerHud.delta && playerHud.delta > 0 ? "+" : ""}${playerHud.delta || 0}s`
              : playerHud.type === "play"
                ? "▶"
                : "Ⅱ"}
          </div>

          {playerHud.type === "seek" && (
            <p className="mt-0.5 text-[11px] text-slate-300">
              {formatTime(playerHud.currentTime)}
              {playerHud.duration ? ` / ${formatTime(playerHud.duration)}` : ""}
            </p>
          )}
        </div>
      )}''',
        '''      {false && tvImmersive && playerHud && (
        <div aria-hidden="true" />
      )}''',
        "Fullscreen box: bỏ HUD hình ảnh trùng với TvWatchOverlay",
    )

    write(path, content)

def main():
    repair_phase5a_focus_memory()
    patch_player_bridge()
    patch_native_player()
    patch_watch_client_episode_matching()
    patch_overlay()
    patch_episode_modal()
    patch_fullscreen_hud()

    print("\n[OK] Phase 5B + repair 5A hoàn tất.")
    print("Đã sửa:")
    for path in CHANGED:
        print(f"- {path}")
    print("\nBackup: *.phase5b.bak")
    print("Chạy tiếp:")
    print("  npm run lint")
    print("  npm run build")

if __name__ == "__main__":
    main()
