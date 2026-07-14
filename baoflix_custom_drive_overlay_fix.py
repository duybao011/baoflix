#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# BảoFlix Custom Drive Native + TV Overlay Patcher
# Chạy: python baoflix_custom_drive_overlay_fix.py
# Script chỉ sửa file local, không commit/push GitHub.

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

CUSTOM_DRIVE_PLAYER = '"use client";\n\nimport { useEffect, useMemo, useRef, useState } from "react";\nimport NativeVideoPlayer from "@/components/NativeVideoPlayer";\nimport TvWatchOverlay from "@/components/TvWatchOverlay";\nimport type { EpisodeServer, MovieDetail } from "@/lib/kkphim";\nimport { isTvModeActive } from "@/lib/tvMode";\n\ntype CustomDrivePlayerProps = {\n  src: string;\n  title: string;\n  progressKey: string;\n  movie: MovieDetail;\n  currentSeason?: EpisodeServer;\n  seasonIndex: number;\n  episodeIndex: number;\n  watchedEpisodes: string[];\n  previousHref?: string;\n  nextHref?: string;\n  detailHref: string;\n  poster?: string;\n  onOpenEpisodes: () => void;\n};\n\ntype PlayerMode = "probing" | "native" | "iframe";\n\ntype StoredDriveEstimate = {\n  seconds: number;\n  updatedAt: string;\n};\n\nconst PROBE_TIMEOUT_MS = 8000;\nconst SAVE_INTERVAL_SECONDS = 5;\n\nfunction extractDriveFileId(url: string) {\n  const value = String(url || "").trim();\n\n  const fileMatch = value.match(/drive\\.google\\.com\\/file\\/d\\/([^/?#]+)/i);\n  if (fileMatch?.[1]) return fileMatch[1];\n\n  const idMatch = value.match(/[?&]id=([^&#]+)/i);\n  if (idMatch?.[1]) return decodeURIComponent(idMatch[1]);\n\n  return "";\n}\n\nfunction buildDirectCandidates(fileId: string) {\n  if (!fileId) return [];\n\n  return [\n    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(\n      fileId\n    )}&export=download&confirm=t`,\n    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(\n      fileId\n    )}`,\n  ];\n}\n\nfunction addAutoplayHint(url: string) {\n  try {\n    const parsed = new URL(url);\n    parsed.searchParams.set("autoplay", "1");\n    return parsed.toString();\n  } catch {\n    return url;\n  }\n}\n\nfunction formatTime(totalSeconds: number) {\n  const safe = Math.max(0, Math.floor(totalSeconds));\n  const hours = Math.floor(safe / 3600);\n  const minutes = Math.floor((safe % 3600) / 60);\n  const seconds = safe % 60;\n\n  if (hours > 0) {\n    return `${hours}:${String(minutes).padStart(2, "0")}:${String(\n      seconds\n    ).padStart(2, "0")}`;\n  }\n\n  return `${minutes}:${String(seconds).padStart(2, "0")}`;\n}\n\nfunction readEstimate(storageKey: string) {\n  try {\n    const raw = localStorage.getItem(`${storageKey}:iframe-estimate`);\n    if (!raw) return 0;\n\n    const parsed = JSON.parse(raw) as Partial<StoredDriveEstimate>;\n    const seconds = Number(parsed.seconds || 0);\n\n    return Number.isFinite(seconds) && seconds > 0\n      ? Math.floor(seconds)\n      : 0;\n  } catch {\n    return 0;\n  }\n}\n\nfunction saveEstimate(storageKey: string, seconds: number) {\n  try {\n    const payload: StoredDriveEstimate = {\n      seconds: Math.max(0, Math.floor(seconds)),\n      updatedAt: new Date().toISOString(),\n    };\n\n    localStorage.setItem(\n      `${storageKey}:iframe-estimate`,\n      JSON.stringify(payload)\n    );\n  } catch {\n    // Bỏ qua lỗi storage trên WebView hạn chế.\n  }\n}\n\nexport default function CustomDrivePlayer({\n  src,\n  title,\n  progressKey,\n  movie,\n  currentSeason,\n  seasonIndex,\n  episodeIndex,\n  watchedEpisodes,\n  previousHref = "",\n  nextHref = "",\n  detailHref,\n  poster,\n  onOpenEpisodes,\n}: CustomDrivePlayerProps) {\n  const iframeRef = useRef<HTMLIFrameElement | null>(null);\n  const estimateSecondsRef = useRef(0);\n  const estimateSaveTickRef = useRef(0);\n\n  const [tvMode, setTvMode] = useState(false);\n  const [mode, setMode] = useState<PlayerMode>("probing");\n  const [candidateIndex, setCandidateIndex] = useState(0);\n  const [nativeSrc, setNativeSrc] = useState("");\n  const [iframeSrc, setIframeSrc] = useState(src);\n  const [fallbackReason, setFallbackReason] = useState("");\n  const [estimateSeconds, setEstimateSeconds] = useState(0);\n\n  const fileId = useMemo(() => extractDriveFileId(src), [src]);\n  const directCandidates = useMemo(\n    () => buildDirectCandidates(fileId),\n    [fileId]\n  );\n  const activeCandidate = directCandidates[candidateIndex] || "";\n\n  useEffect(() => {\n    function refreshTvMode() {\n      setTvMode(isTvModeActive({ allowSessionOnDesktop: false }));\n    }\n\n    refreshTvMode();\n\n    window.addEventListener("baoflix-tv-mode-change", refreshTvMode);\n    window.addEventListener("storage", refreshTvMode);\n    window.addEventListener("focus", refreshTvMode);\n\n    return () => {\n      window.removeEventListener("baoflix-tv-mode-change", refreshTvMode);\n      window.removeEventListener("storage", refreshTvMode);\n      window.removeEventListener("focus", refreshTvMode);\n    };\n  }, []);\n\n  useEffect(() => {\n    setIframeSrc(src);\n    setCandidateIndex(0);\n    setNativeSrc("");\n    setFallbackReason("");\n\n    if (!tvMode) {\n      setMode("iframe");\n      return;\n    }\n\n    if (!fileId || directCandidates.length === 0) {\n      setMode("iframe");\n      setFallbackReason(\n        "Không lấy được file ID từ link Drive, đang dùng player Drive dự phòng."\n      );\n      return;\n    }\n\n    setMode("probing");\n  }, [directCandidates.length, fileId, src, tvMode]);\n\n  useEffect(() => {\n    if (!tvMode || mode !== "probing" || !activeCandidate) return;\n\n    const timeout = window.setTimeout(() => {\n      tryNextCandidate("Nguồn direct tải quá lâu.");\n    }, PROBE_TIMEOUT_MS);\n\n    return () => window.clearTimeout(timeout);\n  }, [activeCandidate, mode, tvMode]);\n\n  useEffect(() => {\n    const saved = readEstimate(progressKey);\n    estimateSecondsRef.current = saved;\n    estimateSaveTickRef.current = saved;\n    setEstimateSeconds(saved);\n  }, [progressKey]);\n\n  useEffect(() => {\n    if (!tvMode || mode !== "iframe") return;\n\n    const timer = window.setInterval(() => {\n      if (document.visibilityState !== "visible") return;\n\n      estimateSecondsRef.current += 1;\n      const next = estimateSecondsRef.current;\n      setEstimateSeconds(next);\n\n      if (\n        next - estimateSaveTickRef.current >= SAVE_INTERVAL_SECONDS\n      ) {\n        estimateSaveTickRef.current = next;\n        saveEstimate(progressKey, next);\n      }\n    }, 1000);\n\n    return () => window.clearInterval(timer);\n  }, [mode, progressKey, tvMode]);\n\n  useEffect(() => {\n    function flushEstimate() {\n      if (mode !== "iframe") return;\n      saveEstimate(progressKey, estimateSecondsRef.current);\n    }\n\n    window.addEventListener("pagehide", flushEstimate);\n    window.addEventListener("beforeunload", flushEstimate);\n\n    return () => {\n      flushEstimate();\n      window.removeEventListener("pagehide", flushEstimate);\n      window.removeEventListener("beforeunload", flushEstimate);\n    };\n  }, [mode, progressKey]);\n\n  useEffect(() => {\n    if (!tvMode || mode !== "iframe") return;\n\n    function handlePlayerCommand(event: Event) {\n      const detail = (\n        event as CustomEvent<{\n          action?: string;\n          handled?: boolean;\n        }>\n      ).detail;\n\n      if (!detail || detail.handled) return;\n\n      detail.handled = true;\n\n      if (\n        detail.action === "play" ||\n        detail.action === "toggle-play"\n      ) {\n        setIframeSrc(addAutoplayHint(src));\n      }\n\n      if (\n        detail.action === "play" ||\n        detail.action === "toggle-play" ||\n        detail.action === "focus-player"\n      ) {\n        window.setTimeout(() => {\n          iframeRef.current?.focus({ preventScroll: true });\n        }, 100);\n      }\n\n      window.dispatchEvent(new Event("baoflix-tv-native-missing"));\n    }\n\n    window.addEventListener(\n      "baoflix-tv-player-command",\n      handlePlayerCommand as EventListener\n    );\n\n    return () => {\n      window.removeEventListener(\n        "baoflix-tv-player-command",\n        handlePlayerCommand as EventListener\n      );\n    };\n  }, [mode, src, tvMode]);\n\n  function tryNextCandidate(reason: string) {\n    const nextIndex = candidateIndex + 1;\n\n    if (nextIndex < directCandidates.length) {\n      setCandidateIndex(nextIndex);\n      setFallbackReason(reason);\n      return;\n    }\n\n    setMode("iframe");\n    setFallbackReason(\n      "Drive không cho phát trực tiếp bằng video native. Đã chuyển sang iframe dự phòng."\n    );\n  }\n\n  function handleProbeReady() {\n    if (!activeCandidate) return;\n\n    setNativeSrc(activeCandidate);\n    setMode("native");\n    setFallbackReason("");\n  }\n\n  const serverForOverlay: EpisodeServer =\n    currentSeason || {\n      server_name: `Mùa ${seasonIndex + 1}`,\n      server_data: [],\n    };\n\n  return (\n    <div className="relative h-full w-full overflow-hidden bg-black">\n      {tvMode && mode === "probing" && activeCandidate && (\n        <video\n          key={activeCandidate}\n          src={activeCandidate}\n          muted\n          playsInline\n          preload="metadata"\n          onLoadedMetadata={handleProbeReady}\n          onCanPlay={handleProbeReady}\n          onError={() =>\n            tryNextCandidate("Nguồn direct hiện tại không phát được.")\n          }\n          className="pointer-events-none absolute h-px w-px opacity-0"\n          aria-hidden="true"\n        />\n      )}\n\n      {mode === "native" && nativeSrc ? (\n        <NativeVideoPlayer\n          src={nativeSrc}\n          title={title}\n          subtitle={serverForOverlay.server_name}\n          poster={poster}\n          progressKey={progressKey}\n          tvMode={tvMode}\n        />\n      ) : (\n        <iframe\n          ref={iframeRef}\n          src={iframeSrc}\n          allowFullScreen\n          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"\n          tabIndex={tvMode ? -1 : 0}\n          data-tv-player="drive-iframe"\n          data-tv-skip={tvMode ? true : undefined}\n          className={[\n            "h-full w-full border-0 bg-black outline-none",\n            tvMode ? "pointer-events-none" : "",\n          ].join(" ")}\n          title={title}\n        />\n      )}\n\n      {tvMode && mode === "probing" && (\n        <div className="pointer-events-none absolute left-1/2 top-[12%] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/75 px-4 py-3 text-center text-sm font-bold text-white shadow-2xl backdrop-blur">\n          Đang thử mở video Drive bằng player native...\n        </div>\n      )}\n\n      {tvMode && mode === "iframe" && (\n        <div className="pointer-events-none absolute right-4 top-4 max-w-[48vw] rounded-xl border border-yellow-300/20 bg-black/72 px-3 py-2 text-right shadow-xl backdrop-blur">\n          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">\n            Drive iframe dự phòng\n          </p>\n\n          <p className="mt-1 text-xs font-bold text-white">\n            Mốc ước tính: {formatTime(estimateSeconds)}\n          </p>\n\n          {fallbackReason && (\n            <p className="mt-1 text-[10px] leading-4 text-slate-300">\n              {fallbackReason}\n            </p>\n          )}\n        </div>\n      )}\n\n      {tvMode && (\n        <TvWatchOverlay\n          movie={movie}\n          currentServer={serverForOverlay}\n          safeServerIndex={seasonIndex}\n          safeEpisodeIndex={episodeIndex}\n          episodeName={\n            serverForOverlay.server_data?.[episodeIndex]?.name\n          }\n          previousHref={previousHref}\n          nextHref={nextHref}\n          watchedEpisodes={watchedEpisodes}\n          sameEpisodeServerLinks={[]}\n          onOpenEpisodePanel={onOpenEpisodes}\n          routeMode="custom"\n          customSeasonIndex={seasonIndex}\n          detailHref={detailHref}\n        />\n      )}\n    </div>\n  );\n}\n'


def parse_args():
    parser = argparse.ArgumentParser(
        description="Sửa Drive player phim riêng và dùng TV overlay như phim thường."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Đường dẫn repo. Mặc định tự dò từ thư mục hiện tại.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Không chạy npm run build.",
    )
    return parser.parse_args()


def find_repo_root(start: Path) -> Path:
    start = start.resolve()

    for candidate in [start, *start.parents]:
        custom_page = (
            candidate
            / "app"
            / "ca-nhan"
            / "[slug]"
            / "xem"
            / "page.tsx"
        )

        if (
            (candidate / "package.json").is_file()
            and (candidate / "components" / "TvWatchOverlay.tsx").is_file()
            and (candidate / "components" / "NativeVideoPlayer.tsx").is_file()
            and custom_page.is_file()
        ):
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Đặt file Python cạnh package.json "
        "hoặc dùng --repo DUONG_DAN."
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        content.replace("\r\n", "\n").rstrip() + "\n",
        encoding="utf-8",
    )


def backup_file(path: Path, repo_root: Path, backup_root: Path) -> None:
    if not path.exists():
        return

    destination = backup_root / path.relative_to(repo_root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Không tìm thấy đoạn cần sửa: {label}")

    return text.replace(old, new, 1)


def patch_overlay(text: str) -> str:
    if 'routeMode?: "normal" | "custom";' not in text:
        text = replace_once(
            text,
            """  sameEpisodeServerLinks: SameEpisodeServerLink[];
  onOpenEpisodePanel: () => void;
};""",
            """  sameEpisodeServerLinks: SameEpisodeServerLink[];
  onOpenEpisodePanel: () => void;
  routeMode?: "normal" | "custom";
  customSeasonIndex?: number;
  detailHref?: string;
};""",
            "thêm props route phim riêng cho TvWatchOverlay",
        )

    if 'routeMode = "normal"' not in text:
        text = replace_once(
            text,
            """  watchedEpisodes,
  sameEpisodeServerLinks,
  onOpenEpisodePanel,
}: TvWatchOverlayProps) {""",
            """  watchedEpisodes,
  sameEpisodeServerLinks,
  onOpenEpisodePanel,
  routeMode = "normal",
  customSeasonIndex,
  detailHref,
}: TvWatchOverlayProps) {""",
            "destructure props mới của TvWatchOverlay",
        )

    if "resolvedDetailHref" not in text:
        text = replace_once(
            text,
            """  const currentEpisodes = currentServer?.server_data ?? [];
  const hasMultipleServers = sameEpisodeServerLinks.length > 1;""",
            """  const currentEpisodes = currentServer?.server_data ?? [];
  const resolvedSeasonIndex = customSeasonIndex ?? safeServerIndex;
  const resolvedDetailHref =
    detailHref ||
    (routeMode === "custom"
      ? `/ca-nhan/${movie.slug}`
      : `/phim/${movie.slug}`);
  const hasMultipleServers = sameEpisodeServerLinks.length > 1;""",
            "tạo route đã resolve trong overlay",
        )

    old_href = """        href: getEpisodeUrl(movie.slug, safeServerIndex, episodeIndex),"""
    new_href = """        href:
          routeMode === "custom"
            ? `/ca-nhan/${movie.slug}/xem?season=${resolvedSeasonIndex}&tap=${episodeIndex}`
            : getEpisodeUrl(movie.slug, safeServerIndex, episodeIndex),"""

    if old_href in text:
        text = text.replace(old_href, new_href, 1)

    old_deps = """  }, [activeChunk, currentEpisodes, movie.slug, safeServerIndex]);"""
    new_deps = """  }, [
    activeChunk,
    currentEpisodes,
    movie.slug,
    resolvedSeasonIndex,
    routeMode,
    safeServerIndex,
  ]);"""

    if old_deps in text:
        text = text.replace(old_deps, new_deps, 1)

    old_watched = """                    const watchedKey = getWatchedKey(movie.slug, safeServerIndex, episodeIndex);"""
    new_watched = """                    const watchedKey =
                      routeMode === "custom"
                        ? `custom:${movie.slug}|season:${resolvedSeasonIndex}|episode:${episodeIndex}`
                        : getWatchedKey(
                            movie.slug,
                            safeServerIndex,
                            episodeIndex
                          );"""

    if old_watched in text:
        text = text.replace(old_watched, new_watched, 1)

    old_exit = """                onClick={() => exitWatchToDetail(`/phim/${movie.slug}`)}"""
    new_exit = """                onClick={() => exitWatchToDetail(resolvedDetailHref)}"""

    if old_exit in text:
        text = text.replace(old_exit, new_exit, 1)

    required = [
        'routeMode?: "normal" | "custom";',
        "resolvedDetailHref",
        'routeMode === "custom"',
        "resolvedSeasonIndex",
        "exitWatchToDetail(resolvedDetailHref)",
    ]

    missing = [item for item in required if item not in text]
    if missing:
        raise RuntimeError(
            "TvWatchOverlay patch chưa đủ:\n- " + "\n- ".join(missing)
        )

    return text


def patch_native_player(text: str) -> str:
    if "const isHlsSource" not in text:
        text = replace_once(
            text,
            """    if (Hls.isSupported()) {""",
            """    const isHlsSource = /\.m3u8(?:$|[?#])/i.test(src);

    if (isHlsSource && Hls.isSupported()) {""",
            "không dùng hls.js cho MP4/direct video",
        )

    return text


def patch_custom_page(text: str) -> str:
    if "data-tv-watch-immersive" not in text:
        text = replace_once(
            text,
            """      data-tv-autofocus="true"
    >""",
            """      data-tv-autofocus="true"
      data-tv-watch-immersive={tvDriveMode ? "true" : "false"}
    >""",
            "bật immersive remote bridge cho phim riêng",
        )

    if 'progressKey={`${watchTimeKey}_drive_native`}' not in text:
        text = replace_once(
            text,
            """            <CustomDrivePlayer
              src={episode.link_embed}
              title={`${movie.name} - ${episode.name}`}
              storageKey={`${watchTimeKey}_drive_estimate`}
              previousHref={previousHref}
              nextHref={nextHref}
              detailHref={`/ca-nhan/${movie.slug}`}
              onOpenEpisodes={() => setEpisodePanelOpen(true)}
            />""",
            """            <CustomDrivePlayer
              src={episode.link_embed}
              title={`${movie.name} - ${episode.name}`}
              progressKey={`${watchTimeKey}_drive_native`}
              movie={movie}
              currentSeason={currentSeason}
              seasonIndex={safeSeasonIndex}
              episodeIndex={safeIndex}
              watchedEpisodes={watchedEpisodes}
              previousHref={previousHref}
              nextHref={nextHref}
              detailHref={`/ca-nhan/${movie.slug}`}
              poster={movie.thumb_url || movie.poster_url}
              onOpenEpisodes={() => setEpisodePanelOpen(true)}
            />""",
            "nâng props CustomDrivePlayer",
        )

    required = [
        "data-tv-watch-immersive",
        'progressKey={`${watchTimeKey}_drive_native`}',
        "watchedEpisodes={watchedEpisodes}",
        "currentSeason={currentSeason}",
    ]

    missing = [item for item in required if item not in text]
    if missing:
        raise RuntimeError(
            "Trang phim riêng patch chưa đủ:\n- " + "\n- ".join(missing)
        )

    return text


def get_npm_command() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def run_build(repo_root: Path) -> None:
    command = [get_npm_command(), "run", "build"]
    print("\n> " + " ".join(command))

    result = subprocess.run(command, cwd=repo_root)

    if result.returncode != 0:
        raise RuntimeError(
            f"Build thất bại với mã {result.returncode}."
        )


def main() -> int:
    args = parse_args()

    try:
        repo_root = find_repo_root(args.repo or Path.cwd())
    except Exception as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

    custom_player = repo_root / "components" / "CustomDrivePlayer.tsx"
    overlay = repo_root / "components" / "TvWatchOverlay.tsx"
    native_player = repo_root / "components" / "NativeVideoPlayer.tsx"
    custom_page = (
        repo_root
        / "app"
        / "ca-nhan"
        / "[slug]"
        / "xem"
        / "page.tsx"
    )

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = (
        repo_root
        / "backup"
        / f"custom-drive-overlay-fix-{timestamp}"
    )

    try:
        for path in [
            custom_player,
            overlay,
            native_player,
            custom_page,
        ]:
            backup_file(path, repo_root, backup_root)

        write_text(custom_player, CUSTOM_DRIVE_PLAYER)
        print("✓ Đã thay components/CustomDrivePlayer.tsx")

        write_text(overlay, patch_overlay(read_text(overlay)))
        print("✓ Đã cho TvWatchOverlay hỗ trợ route phim riêng")

        write_text(
            native_player,
            patch_native_player(read_text(native_player)),
        )
        print("✓ Đã cho NativeVideoPlayer phát direct MP4/video")

        write_text(
            custom_page,
            patch_custom_page(read_text(custom_page)),
        )
        print("✓ Đã gắn overlay immersive vào trang phim riêng")

        print(f"✓ Backup: {backup_root}")

        if not args.skip_build:
            run_build(repo_root)
            print("✓ Build thành công")
        else:
            print("! Đã bỏ qua build")

        print(
            "\nHOÀN TẤT.\n"
            "Test:\n"
            "1. npm run dev\n"
            "2. Mở phim riêng Drive trong TV Mode.\n"
            "3. Chờ tối đa 8-16 giây trong lần dò nguồn đầu.\n"
            "4. Nếu native chạy: overlay và remote hoạt động như phim thường.\n"
            "5. Nếu hiện 'Drive iframe dự phòng': file đó chặn direct stream.\n\n"
            "Script không commit hoặc push GitHub."
        )
        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        print(f"Backup: {backup_root}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
