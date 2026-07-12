#!/usr/bin/env python3
from pathlib import Path
import re, shutil, sys

ROOT = Path.cwd()
CHANGED = []

def die(msg):
    print(f"\n[ERROR] {msg}")
    sys.exit(1)

def read(path):
    p = ROOT / path
    if not p.exists():
        die(f"Không tìm thấy {path}. Chạy script ở thư mục gốc BảoFlix.")
    return p.read_text(encoding="utf-8")

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        bak = p.with_suffix(p.suffix + ".phase5b1.bak")
        if not bak.exists():
            shutil.copyfile(p, bak)
    p.write_text(text, encoding="utf-8")
    CHANGED.append(path)

def rep(text, old, new, label):
    if new and new in text:
        print(f"[SKIP] {label}")
        return text
    if old not in text:
        die(f"Không thấy block: {label}")
    print(f"[OK] {label}")
    return text.replace(old, new, 1)

def sub(text, pattern, new, label):
    updated, count = re.subn(pattern, new, text, count=1, flags=re.S)
    if count != 1:
        die(f"Không thấy block: {label}")
    print(f"[OK] {label}")
    return updated

def add_helper():
    path = "lib/episodeMatch.ts"
    p = ROOT / path
    if p.exists():
        current = p.read_text(encoding="utf-8")
        if "export function findEpisodeMatch" in current:
            print("[SKIP] Helper match tập đã có")
            return
        die(f"{path} đã tồn tại nhưng không phải helper Phase 5B.1")
    helper = '''import type { Episode } from "@/lib/kkphim";

export type EpisodeMatchReason = "slug" | "name" | "number" | "fallback" | "none";
export type EpisodeMatch = { index: number; matched: boolean; reason: EpisodeMatchReason };
type EpisodeIdentity = Pick<Episode, "name" | "slug">;

export function normalizeEpisodeIdentity(value?: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getEpisodeNumber(value?: string) {
  const match = normalizeEpisodeIdentity(value).match(/\\d+(?:\\.\\d+)?/);
  return match?.[0] || "";
}

export function findEpisodeMatch(
  currentEpisode: EpisodeIdentity | undefined,
  targetEpisodes: EpisodeIdentity[],
  fallbackIndex: number
): EpisodeMatch {
  if (!targetEpisodes.length) return { index: -1, matched: false, reason: "none" };

  const safeFallbackIndex = Math.min(
    Math.max(Number.isFinite(fallbackIndex) ? fallbackIndex : 0, 0),
    targetEpisodes.length - 1
  );

  if (!currentEpisode) {
    return { index: safeFallbackIndex, matched: false, reason: "fallback" };
  }

  const currentSlug = normalizeEpisodeIdentity(currentEpisode.slug);
  const currentName = normalizeEpisodeIdentity(currentEpisode.name);
  const currentNumber = getEpisodeNumber(currentEpisode.name || currentEpisode.slug);

  const bySlug = currentSlug
    ? targetEpisodes.findIndex((item) => normalizeEpisodeIdentity(item.slug) === currentSlug)
    : -1;
  if (bySlug >= 0) return { index: bySlug, matched: true, reason: "slug" };

  const byName = currentName
    ? targetEpisodes.findIndex((item) => normalizeEpisodeIdentity(item.name) === currentName)
    : -1;
  if (byName >= 0) return { index: byName, matched: true, reason: "name" };

  const byNumber = currentNumber
    ? targetEpisodes.findIndex((item) => getEpisodeNumber(item.name || item.slug) === currentNumber)
    : -1;
  if (byNumber >= 0) return { index: byNumber, matched: true, reason: "number" };

  return { index: safeFallbackIndex, matched: false, reason: "fallback" };
}

export function findMatchingEpisodeIndex(
  currentEpisode: EpisodeIdentity | undefined,
  targetEpisodes: EpisodeIdentity[],
  fallbackIndex: number
) {
  return findEpisodeMatch(currentEpisode, targetEpisodes, fallbackIndex).index;
}
'''
    write(path, helper)
    print("[OK] Tạo helper match tập dùng chung")

def patch_navigator():
    path = "components/TvRemoteNavigator.tsx"
    text = read(path)
    text = rep(text,
'''function focusSearchKeyboard(pathname: string) {
  const keyboard = getVisibleSearchKeyboard();
  const target = keyboard ? getFocusableElements(keyboard)[0] : null;
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}''',
'''function focusSearchKeyboard(pathname: string) {
  const keyboard = getVisibleSearchKeyboard();
  const target = keyboard
    ? getDefaultFocusable(keyboard) || getFocusableElements(keyboard)[0]
    : null;

  if (!target) return false;

  focusElement(target, pathname);
  return true;
}''', "Bàn phím: Down ưu tiên phím Q")
    write(path, text)

def patch_watch_client():
    path = "components/WatchClient.tsx"
    text = read(path)
    text = rep(text,
'import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";',
'import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";\nimport { findMatchingEpisodeIndex } from "@/lib/episodeMatch";',
"WatchClient import helper")
    text = sub(text,
r'function normalizeEpisodeIdentity\(value\?: string\) \{.*?\n\}\n\nfunction detectTvOverlayEnabled\(\) \{',
'function detectTvOverlayEnabled() {',
"WatchClient bỏ helper trùng")
    text = rep(text,
'''  }, [episode?.link_embed, tvOverlayEnabled]);

  return (''',
'''  }, [episode?.link_embed, tvOverlayEnabled]);

  function closeEpisodePanel() {
    setEpisodePanelOpen(false);

    if (!tvOverlayEnabled) return;

    window.setTimeout(() => {
      window.dispatchEvent(new Event("baoflix-focus-tv-player-surface"));
    }, 0);
  }

  return (''',
"WatchClient restore focus sau modal")
    text = rep(text,
'          onClose={() => setEpisodePanelOpen(false)}',
'          onClose={closeEpisodePanel}',
"WatchClient dùng close handler")
    write(path, text)

def patch_episode_picker():
    path = "components/EpisodePickerModal.tsx"
    text = read(path)
    text = rep(text,
'import { getNormalWatchedKey } from "@/lib/watchStore";',
'import { getNormalWatchedKey } from "@/lib/watchStore";\nimport { findEpisodeMatch } from "@/lib/episodeMatch";',
"EpisodePicker import helper")
    text = rep(text,
'''  const selectedServer = servers[selectedServerIndex];
  const selectedEpisodes = selectedServer?.server_data ?? [];

  const groups = useMemo(() => {
    return buildEpisodeGroups(selectedEpisodes);
  }, [selectedEpisodes]);''',
'''  const selectedServer = servers[selectedServerIndex];
  const selectedEpisodes = selectedServer?.server_data ?? [];
  const currentEpisode =
    servers[safeServerIndex]?.server_data?.[safeEpisodeIndex];

  const selectedEpisodeMatch = useMemo(() => {
    return findEpisodeMatch(currentEpisode, selectedEpisodes, safeEpisodeIndex);
  }, [currentEpisode, selectedEpisodes, safeEpisodeIndex]);

  const selectedMatchingEpisodeIndex = selectedEpisodeMatch.index;

  const groups = useMemo(() => {
    return buildEpisodeGroups(selectedEpisodes);
  }, [selectedEpisodes]);''',
"EpisodePicker xác định tập tương ứng")
    text = rep(text,
'''  const activeGroup = groups[activeGroupIndex];
  const currentEpisodeExistsInSelectedServer = Boolean(
    selectedEpisodes[safeEpisodeIndex]
  );''',
'''  const activeGroup = groups[activeGroupIndex];
  const currentEpisodeExistsInSelectedServer =
    selectedEpisodeMatch.matched &&
    selectedMatchingEpisodeIndex >= 0 &&
    Boolean(selectedEpisodes[selectedMatchingEpisodeIndex]);''',
"EpisodePicker chỉ báo match thật")
    text = rep(text,
'''  function selectServer(serverIndex: number) {
    setSelectedServerIndex(serverIndex);

    setActiveGroupByServer((old) => {
      if (old[serverIndex] !== undefined) return old;

      const initialGroup =
        serverIndex === safeServerIndex ? getInitialGroupIndex(safeEpisodeIndex) : 0;

      return {
        ...old,
        [serverIndex]: initialGroup,
      };
    });
  }''',
'''  function selectServer(serverIndex: number) {
    setSelectedServerIndex(serverIndex);

    setActiveGroupByServer((old) => {
      if (old[serverIndex] !== undefined) return old;

      const targetEpisodes = servers[serverIndex]?.server_data ?? [];
      const targetMatch = findEpisodeMatch(
        currentEpisode,
        targetEpisodes,
        safeEpisodeIndex
      );
      const initialGroup = getInitialGroupIndex(Math.max(targetMatch.index, 0));

      return {
        ...old,
        [serverIndex]: initialGroup,
      };
    });
  }''',
"EpisodePicker mở đúng nhóm khi đổi server")
    text = rep(text,
'''                const watchedCurrent = watchedEpisodes.includes(
                  getNormalWatchedKey(
                    movie.slug,
                    item.serverIndex,
                    Math.min(safeEpisodeIndex, Math.max(serverEpisodes.length - 1, 0))
                  )
                );''',
'''                const serverEpisodeMatch = findEpisodeMatch(
                  currentEpisode,
                  serverEpisodes,
                  safeEpisodeIndex
                );
                const watchedCurrent =
                  serverEpisodeMatch.matched &&
                  watchedEpisodes.includes(
                    getNormalWatchedKey(
                      movie.slug,
                      item.serverIndex,
                      serverEpisodeMatch.index
                    )
                  );''',
"EpisodePicker trạng thái đã xem đúng tập")
    text = rep(text,
'                    {selectedEpisodes[safeEpisodeIndex]?.name || `Tập ${safeEpisodeIndex + 1}`}',
'''                    {selectedEpisodes[selectedMatchingEpisodeIndex]?.name ||
                      `Tập ${selectedMatchingEpisodeIndex + 1}`}''',
"EpisodePicker tên tập tương ứng")
    text = rep(text,
'                  href={getEpisodeUrl(movie.slug, selectedServerIndex, safeEpisodeIndex)}',
'''                  href={getEpisodeUrl(
                    movie.slug,
                    selectedServerIndex,
                    selectedMatchingEpisodeIndex
                  )}''',
"EpisodePicker URL đúng tập")
    text = rep(text,
'''                    const active =
                      selectedServerIndex === safeServerIndex &&
                      episodeIndex === safeEpisodeIndex;''',
'''                    const active =
                      selectedEpisodeMatch.matched &&
                      episodeIndex === selectedMatchingEpisodeIndex;''',
"EpisodePicker highlight đúng tập")
    write(path, text)

def patch_player_bridge():
    path = "components/TvPlayerCommandBridge.tsx"
    text = read(path)
    text = rep(text,
'''  seekBackward?: () => void;
  togglePlay?: () => void;
};''',
'''  seekBackward?: () => void;
  togglePlay?: () => void;
  play?: () => void;
  pause?: () => void;
};''',
"Bridge khai báo play/pause")
    text = rep(text,
'''        : command.action === "toggle-play" ||
            command.action === "play" ||
            command.action === "pause"
          ? "toggle-play"
          : "focus-player";''',
'''        : command.action === "toggle-play"
          ? "toggle-play"
          : command.action === "play"
            ? "play"
            : command.action === "pause"
              ? "pause"
              : "focus-player";''',
"Bridge không map play/pause thành toggle")
    text = rep(text,
'''    if (nativeCommand === "toggle-play" && bridge.togglePlay) {
      bridge.togglePlay();
      return true;
    }''',
'''    if (nativeCommand === "toggle-play" && bridge.togglePlay) {
      bridge.togglePlay();
      return true;
    }

    if (nativeCommand === "play" && bridge.play) {
      bridge.play();
      return true;
    }

    if (nativeCommand === "pause" && bridge.pause) {
      bridge.pause();
      return true;
    }''',
"Bridge gọi play/pause đúng nghĩa")
    text = rep(text,
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
'''function handleIframeOnlyCommand(command: PlayerCommand) {
  const nativeHandled = callNativeBridge(command);
  const iframe = getVisiblePlayerIframe();
  const focused = iframe ? focusIframePlayer() : false;

  if (iframe && command.action !== "focus-player") {
    dispatchIframeKeyboardEvent(iframe, keyForCommand(command));
    sendSafePostMessage(command);
  }

  const handled =
    nativeHandled ||
    (command.action === "focus-player" && focused);

  if (handled) {
    command.handled = true;
    emitBridgeHud(command);
    return true;
  }

  if (command.action !== "focus-player") {
    command.handled = true;
    notifyNativeMissing(command);
  }

  return false;
}''',
"Bridge không báo iframe xử lý thành công giả")
    write(path, text)

def patch_fullscreen():
    path = "components/FullscreenPlayerBox.tsx"
    text = read(path)
    text = sub(text, r'type PlayerHudDetail = \{.*?\n\};\n\n', '', "Fullscreen bỏ type HUD")
    text = sub(text, r'function formatTime\(value\?: number\) \{.*?\n\}\n\n', '', "Fullscreen bỏ formatter HUD")
    text = sub(text, r'function emitHud\(detail: PlayerHudDetail\) \{.*?\n\}\n\n', '', "Fullscreen bỏ emitter HUD")
    text = rep(text,
'''  const boxRef = useRef<FullscreenDivElement | null>(null);
  const hudTimerRef = useRef<number | null>(null);

  const [cinemaMode, setCinemaMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerHud, setPlayerHud] = useState<PlayerHudDetail | null>(null);''',
'''  const boxRef = useRef<FullscreenDivElement | null>(null);

  const [cinemaMode, setCinemaMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);''',
"Fullscreen bỏ state HUD")
    text = sub(text,
r'''  useEffect\(\(\) => \{\n    function handlePlayerHud\(event: Event\) \{.*?\n  \}, \[focusPlayerSurface\]\);''',
'''  useEffect(() => {
    function handleFocusPlayer() {
      focusPlayerSurface();
    }

    function handlePlayerCommand(event: Event) {
      const detail = (event as CustomEvent<PlayerCommandDetail>).detail;

      if (!detail) return;

      window.setTimeout(() => {
        if (detail.handled) return;

        detail.handled = true;
        focusPlayerSurface();

        if (detail.action !== "focus-player") {
          emitNativeMissing();
        }
      }, 0);
    }

    window.addEventListener("baoflix-focus-tv-player", handleFocusPlayer);
    window.addEventListener("baoflix-focus-tv-player-surface", handleFocusPlayer);
    window.addEventListener(
      "baoflix-tv-player-command",
      handlePlayerCommand as EventListener
    );

    return () => {
      window.removeEventListener("baoflix-focus-tv-player", handleFocusPlayer);
      window.removeEventListener(
        "baoflix-focus-tv-player-surface",
        handleFocusPlayer
      );
      window.removeEventListener(
        "baoflix-tv-player-command",
        handlePlayerCommand as EventListener
      );
    };
  }, [focusPlayerSurface]);''',
"Fullscreen giữ fallback, bỏ listener HUD")
    text = rep(text,
'''      {false && tvImmersive && playerHud && (
        <div aria-hidden="true" />
      )}

''', '', "Fullscreen xóa JSX HUD chết")
    write(path, text)

def main():
    add_helper()
    patch_navigator()
    patch_watch_client()
    patch_episode_picker()
    patch_player_bridge()
    patch_fullscreen()
    print("\n[OK] Phase 5B.1 hoàn tất")
    for path in CHANGED:
        print(f"- {path}")
    print("\nChạy tiếp: npm run lint && npm run build")

if __name__ == "__main__":
    main()
