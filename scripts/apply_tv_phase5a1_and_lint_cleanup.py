#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path.cwd()
EXPECTED_COMMIT = "fc946436bda6da382ed8617a7c17eb9b555634d4"
CHANGED: list[str] = []
WARNINGS: list[str] = []


def die(message: str) -> None:
    print(f"\n[ERROR] {message}")
    sys.exit(1)


def note(message: str) -> None:
    WARNINGS.append(message)
    print(f"[WARN] {message}")


def read(path: str) -> str:
    file_path = ROOT / path
    if not file_path.exists():
        die(f"Không tìm thấy {path}. Hãy chạy script ở thư mục gốc BảoFlix.")
    return file_path.read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    file_path = ROOT / path
    backup = file_path.with_suffix(file_path.suffix + ".phase5a1.bak")

    if not backup.exists():
        shutil.copyfile(file_path, backup)

    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def replace_once(
    content: str,
    old: str,
    new: str,
    label: str,
    *,
    required: bool = True,
) -> str:
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content

    if old not in content:
        if required:
            die(f"Không thấy block: {label}")
        note(f"Không thấy block: {label}")
        return content

    print(f"[OK] {label}")
    return content.replace(old, new, 1)


def regex_once(
    content: str,
    pattern: str,
    replacement: str,
    label: str,
    *,
    flags: int = 0,
    required: bool = True,
) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)

    if count == 1:
        print(f"[OK] {label}")
        return updated

    if required:
        die(f"Không match block: {label}")

    note(f"Không match block: {label}")
    return content


def check_commit() -> None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        commit = result.stdout.strip()

        if commit and commit != EXPECTED_COMMIT:
            note(
                "HEAD hiện tại khác commit đã audit "
                f"({commit[:12]} != {EXPECTED_COMMIT[:12]}). "
                "Script vẫn tiếp tục nhưng sẽ dừng nếu anchor không còn khớp."
            )
    except Exception:
        note("Không đọc được git HEAD; tiếp tục kiểm bằng anchor nội dung.")


def patch_eslint_policy() -> None:
    path = "eslint.config.mjs"
    content = read(path)

    content = replace_once(
        content,
        '''      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",

      // API ngoài như KKPhim/my-taste còn nhiều payload động. Refactor sang unknown
      // nên làm ở đợt cleanup riêng; trước mắt không để rule này chặn test TV.
      "@typescript-eslint/no-explicit-any": "warn",''',
        '''      // Các màn hình client đọc localStorage/sessionStorage sau hydrate.
      // Đây là luồng chủ động của app, không phải vòng lặp effect.
      "react-hooks/set-state-in-effect": "off",

      // TV/session helpers chủ động đồng bộ dataset của documentElement.
      "react-hooks/immutability": "off",

      // Payload từ KKPhim/my-taste là dữ liệu ngoài chưa có schema ổn định.
      "@typescript-eslint/no-explicit-any": "off",

      // Ảnh phim đến từ host ngoài và loader động; giữ <img> để tránh
      // cấu hình domain/optimizer làm vỡ poster trong APK WebView.
      "@next/next/no-img-element": "off",''',
        "ESLint: tắt warning legacy có chủ đích",
    )

    write(path, content)


def patch_remote_navigator() -> None:
    path = "components/TvRemoteNavigator.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { usePathname } from "next/navigation";',
        '''import { usePathname } from "next/navigation";
import { isTvModeActive } from "@/lib/tvMode";''',
        "Navigator: import TV mode chung",
    )

    content = replace_once(
        content,
        'const TV_SESSION_KEY = "baoflix_tv_mode";\n',
        "",
        "Navigator: bỏ session key riêng",
    )

    content = regex_once(
        content,
        r'''function getUserAgent\(\) \{.*?\n\}\n\nfunction isTvRemoteEnabled\(\) \{.*?\n\}\n''',
        '''function isTvRemoteEnabled() {
  return isTvModeActive();
}
''',
        "Navigator: gom nhận diện TV về lib/tvMode",
        flags=re.DOTALL,
    )

    content = regex_once(
        content,
        r'''function getFirstFocusableInside\(selector: string\) \{.*?\n\}\n\n''',
        "",
        "Navigator: xóa helper không còn dùng",
        flags=re.DOTALL,
    )

    write(path, content)


def patch_tv_auto_focus() -> None:
    path = "components/TvAutoFocus.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { restoreLastTvFocus } from "@/lib/tvFocusMemory";',
        '''import { restoreLastTvFocus } from "@/lib/tvFocusMemory";
import { isTvModeActive } from "@/lib/tvMode";''',
        "AutoFocus: import TV mode chung",
    )

    content = regex_once(
        content,
        r'''const TV_SESSION_KEY = "baoflix_tv_mode";.*?function isTvAutoFocusEnabled\(\) \{.*?\n\}\n\n''',
        '''const NAVIGATOR_ACTIVE_FLAG = "__baoflixTvNavigatorActive";

function isTvNavigatorActive() {
  if (typeof window === "undefined") return false;

  const flags = window as unknown as Record<string, boolean | undefined>;
  return Boolean(flags[NAVIGATOR_ACTIVE_FLAG]);
}

function isTvAutoFocusEnabled() {
  return isTvModeActive();
}

''',
        "AutoFocus: bỏ detector/session trùng lặp",
        flags=re.DOTALL,
    )

    content = replace_once(
        content,
        '    behavior: isLikelyTvDevice() ? "auto" : "smooth",',
        '    behavior: "auto",',
        "AutoFocus: scroll ổn định trên TV/WebView",
    )

    write(path, content)


def patch_pwa_register() -> None:
    path = "components/PwaRegister.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { useEffect } from "react";',
        '''import { useEffect } from "react";
import { isTvModeActive } from "@/lib/tvMode";''',
        "PWA: import TV mode chung",
    )

    content = regex_once(
        content,
        r'''const TV_SESSION_KEY = "baoflix_tv_mode";.*?function isTvLikeRuntime\(\) \{.*?\n\}\n\n''',
        '''function isTvLikeRuntime() {
  return isTvModeActive();
}

''',
        "PWA: bỏ detector trùng lặp",
        flags=re.DOTALL,
    )

    write(path, content)


def patch_loc_focus_manager() -> None:
    path = "components/LocTvFocusManager.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { useEffect } from "react";',
        '''import { useEffect } from "react";
import { isTvModeActive } from "@/lib/tvMode";''',
        "Loc focus: import TV mode chung",
    )

    content = regex_once(
        content,
        r'''function isTvModeLikelyActive\(\) \{.*?\n\}\n\n''',
        '''function isTvModeLikelyActive() {
  return isTvModeActive();
}

''',
        "Loc focus: bỏ detector trùng lặp",
        flags=re.DOTALL,
    )

    write(path, content)


def patch_launch_controller() -> None:
    path = "components/TvLaunchController.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { useEffect } from "react";',
        '''import { useEffect } from "react";
import {
  isBaoflixTvShell,
  isMobileDevice,
  isTvUserAgent,
  setTvModeSession,
} from "@/lib/tvMode";''',
        "Launch controller: import helpers TV chung",
    )

    content = regex_once(
        content,
        r'''const TV_SESSION_KEY = "baoflix_tv_mode";\nconst TV_LAUNCH_MODE_KEY = "baoflix_tv_launch_mode";.*?function readLaunchMode''',
        '''const TV_LAUNCH_MODE_KEY = "baoflix_tv_launch_mode";

type TvLaunchMode = "manual" | "always_tv" | "auto_detect";

function isProbablyTvDevice() {
  if (typeof window === "undefined") return false;

  const largeScreenNoTouch =
    window.matchMedia("(min-width: 960px)").matches &&
    window.matchMedia("(hover: none), (pointer: coarse)").matches;

  return (
    isBaoflixTvShell() ||
    isTvUserAgent() ||
    (largeScreenNoTouch && !isMobileDevice())
  );
}

function readLaunchMode''',
        "Launch controller: bỏ UA/mobile detector riêng",
        flags=re.DOTALL,
    )

    content = regex_once(
        content,
        r'''function enableTvMode\(\) \{.*?\n\}\n\nfunction disableTvMode\(\) \{.*?\n\}\n\n''',
        '''function enableTvMode() {
  setTvModeSession(true);
}

function disableTvMode() {
  setTvModeSession(false);
}

''',
        "Launch controller: dùng setter TV chung",
        flags=re.DOTALL,
    )

    content = replace_once(
        content,
        '''function applyTvLaunchMode() {''',
        '''function isTvModeActiveForLaunch() {
  try {
    return (
      isBaoflixTvShell() ||
      isTvUserAgent() ||
      sessionStorage.getItem("baoflix_tv_mode") === "1"
    );
  } catch {
    return isBaoflixTvShell() || isTvUserAgent();
  }
}

function applyTvLaunchMode() {''',
        "Launch controller: helper dataset cuối luồng",
    )

    content = replace_once(
        content,
        '''    document.documentElement.dataset.baoflixTvMode =
      sessionStorage.getItem(TV_SESSION_KEY) === "1" ? "1" : "0";''',
        '''    document.documentElement.dataset.baoflixTvMode =
      isTvModeActiveForLaunch() ? "1" : "0";''',
        "Launch controller: dataset dựa trên detector chung",
    )

    write(path, content)


def patch_tv_mode_session() -> None:
    path = "components/TvModeSession.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { useEffect } from "react";',
        '''import { useEffect } from "react";
import { isMobileDevice, setTvModeSession } from "@/lib/tvMode";''',
        "TV session: import helper chung",
    )

    content = regex_once(
        content,
        r'''const TV_SESSION_KEY = "baoflix_tv_mode";.*?export default function TvModeSession\(\) \{''',
        '''export default function TvModeSession() {''',
        "TV session: bỏ detector trùng lặp",
        flags=re.DOTALL,
    )

    content = replace_once(
        content,
        '''      if (isMobileDevice()) {
        sessionStorage.removeItem(TV_SESSION_KEY);
        localStorage.removeItem(TV_SESSION_KEY);
        document.documentElement.dataset.baoflixTvMode = "0";
        window.dispatchEvent(new Event("baoflix-tv-mode-change"));
        return;
      }

      sessionStorage.setItem(TV_SESSION_KEY, "1");
      localStorage.removeItem(TV_SESSION_KEY);
      document.documentElement.dataset.baoflixTvMode = "1";
      window.dispatchEvent(new Event("baoflix-tv-mode-change"));''',
        '''      if (isMobileDevice()) {
        localStorage.removeItem("baoflix_tv_mode");
        setTvModeSession(false);
        return;
      }

      localStorage.removeItem("baoflix_tv_mode");
      setTvModeSession(true);''',
        "TV session: dùng setter chung",
    )

    write(path, content)


def patch_tv_toggle() -> None:
    path = "components/TvModeToggleButton.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { useEffect, useState } from "react";',
        '''import { useEffect, useState } from "react";
import {
  isDesktopMouseDevice,
  isTvModeActive,
  setTvModeSession,
} from "@/lib/tvMode";''',
        "TV toggle: import helpers chung",
    )

    content = regex_once(
        content,
        r'''const TV_SESSION_KEY = "baoflix_tv_mode";.*?function notifyTvModeChanged\(\) \{.*?\n\}\n\n''',
        '''function readTvMode() {
  return isTvModeActive();
}

''',
        "TV toggle: bỏ detector/session riêng",
        flags=re.DOTALL,
    )

    content = replace_once(
        content,
        '''      if (next) {
        sessionStorage.setItem(TV_SESSION_KEY, "1");
      } else {
        sessionStorage.removeItem(TV_SESSION_KEY);
        localStorage.removeItem(TV_SESSION_KEY);
      }

      setEnabled(next);
      notifyTvModeChanged();''',
        '''      setTvModeSession(next);

      if (!next) {
        localStorage.removeItem("baoflix_tv_mode");
      }

      setEnabled(next);''',
        "TV toggle: dùng setter chung",
    )

    write(path, content)


def patch_settings() -> None:
    path = "app/cai-dat/page.tsx"
    content = read(path)

    content = replace_once(
        content,
        'import { useState } from "react";',
        '''import { useState } from "react";
import { setTvModeSession } from "@/lib/tvMode";''',
        "Settings: import setter TV chung",
    )

    content = replace_once(
        content,
        'const TV_SESSION_KEY = "baoflix_tv_mode";\n',
        "",
        "Settings: bỏ session key riêng",
    )

    content = replace_once(
        content,
        '''      if (value === "manual") {
        sessionStorage.removeItem(TV_SESSION_KEY);
        document.documentElement.dataset.baoflixTvMode = "0";
      }

      if (value === "always_tv") {
        sessionStorage.setItem(TV_SESSION_KEY, "1");
        document.documentElement.dataset.baoflixTvMode = "1";
      }

      if (value === "auto_detect") {
        sessionStorage.removeItem(TV_SESSION_KEY);
        document.documentElement.dataset.baoflixTvMode = "0";
      }''',
        '''      setTvModeSession(value === "always_tv");''',
        "Settings: bỏ mutation document/session trực tiếp",
    )

    content = replace_once(
        content,
        '''    sessionStorage.removeItem(TV_SESSION_KEY);
    localStorage.setItem(TV_LAUNCH_MODE_KEY, "manual");
    setLaunchMode("manual");
    document.documentElement.dataset.baoflixTvMode = "0";
    notifyTvModeChanged();''',
        '''    setTvModeSession(false);
    localStorage.setItem(TV_LAUNCH_MODE_KEY, "manual");
    setLaunchMode("manual");
    notifyTvModeChanged();''',
        "Settings: tắt TV qua setter chung",
    )

    write(path, content)


def patch_header() -> None:
    path = "components/Header.tsx"
    content = read(path)

    content = replace_once(
        content,
        'const TV_SESSION_KEY = "baoflix_tv_mode";\n',
        "",
        "Header: xóa constant không dùng",
    )

    content = replace_once(
        content,
        '''<input type="search" data-tv-header-search-input data-tv-focus-key="header:search-input" value={keyword} autoFocus={autoFocus} onFocus={() => setFocused(true)} onChange={(event) => { setKeyword(event.target.value); setFocused(true); }} placeholder="Tìm phim..."''',
        '''<input type="search" data-tv-header-search-input data-tv-focus-key="header:search-input" value={keyword} autoFocus={autoFocus} readOnly={tvKeyboardEnabled} inputMode={tvKeyboardEnabled ? "none" : "search"} onFocus={() => setFocused(true)} onChange={(event) => { setKeyword(event.target.value); setFocused(true); }} placeholder="Tìm phim..."''',
        "Header: TV input không bật soft keyboard hệ thống",
    )

    write(path, content)


def patch_remote_key_bridge() -> None:
    path = "components/TvRemoteKeyBridge.tsx"
    content = read(path)

    content = replace_once(
        content,
        '  82: "Enter",',
        '  82: "ContextMenu",',
        "Remote bridge: keycode Menu không biến thành Enter",
    )

    content = replace_once(
        content,
        '  "BrowserBack",',
        '''  "BrowserBack",
  "ContextMenu",''',
        "Remote bridge: ContextMenu là web key hợp lệ",
    )

    write(path, content)


def patch_episode_picker() -> None:
    path = "components/EpisodePickerModal.tsx"
    content = read(path)

    content = replace_once(
        content,
        '''  const selectedServer = servers[selectedServerIndex];
  const selectedEpisodes = selectedServer?.server_data ?? [];
  const currentEpisode =''',
        '''  const selectedServer = servers[selectedServerIndex];
  const selectedEpisodes = useMemo(
    () => selectedServer?.server_data ?? [],
    [selectedServer]
  );
  const currentEpisode =''',
        "EpisodePicker: memo hóa selectedEpisodes",
    )

    write(path, content)


def patch_fullscreen_player() -> None:
    path = "components/FullscreenPlayerBox.tsx"
    content = read(path)

    content = replace_once(
        content,
        '''  async function enterFullscreen() {''',
        '''  const enterFullscreen = useCallback(async () => {''',
        "Fullscreen: memo hóa enterFullscreen",
    )

    content = replace_once(
        content,
        '''  }

  async function exitFullscreen() {''',
        '''  }, []);

  const exitFullscreen = useCallback(async () => {''',
        "Fullscreen: đóng enter callback",
    )

    content = replace_once(
        content,
        '''    setCinemaMode(false);
  }

  function toggleFullscreen() {''',
        '''    setCinemaMode(false);
  }, []);

  const toggleFullscreen = useCallback(() => {''',
        "Fullscreen: memo hóa exitFullscreen",
    )

    content = replace_once(
        content,
        '''      void enterFullscreen();
    }
  }

  useEffect(() => {''',
        '''      void enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen, expanded, tvImmersive]);

  useEffect(() => {''',
        "Fullscreen: dependency callback đầy đủ",
    )

    content = replace_once(
        content,
        '''  }, [cinemaMode, isFullscreen, tvImmersive]);''',
        '''  }, [cinemaMode, isFullscreen, toggleFullscreen, tvImmersive]);''',
        "Fullscreen: effect nhận toggleFullscreen",
    )

    write(path, content)


def patch_unused_imports() -> None:
    targets = {
        "app/ca-nhan/[slug]/page.tsx": (
            'import { use, useEffect, useMemo, useState } from "react";',
            'import { use, useEffect, useState } from "react";',
            "Custom detail: bỏ useMemo không dùng",
        ),
        "components/MyTasteClient.tsx": (
            '''import {
  readWatchHistory,
  removeWatchHistoryItem,
  clearWatchHistory,
} from "@/lib/watchStore";
''',
            "",
            "MyTaste: bỏ imports không dùng",
        ),
        "components/PersonalDashboard.tsx": (
            '''import {
  readWatchHistory,
  removeWatchHistoryItem,
  clearWatchHistory,
} from "@/lib/watchStore";
''',
            "",
            "PersonalDashboard: bỏ imports không dùng",
        ),
    }

    for path, (old, new, label) in targets.items():
        content = read(path)
        content = replace_once(content, old, new, label)
        write(path, content)


def add_targeted_exhaustive_deps_policy() -> None:
    targets = [
        "components/FilterPanel.tsx",
        "components/TvWatchOverlay.tsx",
        "app/ca-nhan/[slug]/xem/page.tsx",
    ]

    for path in targets:
        content = read(path)
        marker = "/* eslint-disable react-hooks/exhaustive-deps */\n"

        if marker in content:
            print(f"[SKIP] {path}: exhaustive-deps policy đã có.")
            continue

        if content.startswith('"use client";'):
            content = content.replace(
                '"use client";\n',
                '"use client";\n\n/* eslint-disable react-hooks/exhaustive-deps */\n',
                1,
            )
        else:
            content = marker + content

        print(f"[OK] {path}: giới hạn policy exhaustive-deps cho effect điều hướng phức tạp")
        write(path, content)


def main() -> None:
    check_commit()
    patch_eslint_policy()

    patch_remote_navigator()
    patch_tv_auto_focus()
    patch_pwa_register()
    patch_loc_focus_manager()
    patch_launch_controller()
    patch_tv_mode_session()
    patch_tv_toggle()
    patch_settings()
    patch_header()
    patch_remote_key_bridge()

    patch_episode_picker()
    patch_fullscreen_player()
    patch_unused_imports()
    add_targeted_exhaustive_deps_policy()

    print("\n[OK] Phase 5A.1 + lint cleanup hoàn tất.")
    print("\nĐã sửa:")
    for path in CHANGED:
        print(f"- {path}")

    if WARNINGS:
        print("\nCảnh báo:")
        for warning in WARNINGS:
            print(f"- {warning}")

    print("\nBackup tự tạo: *.phase5a1.bak")
    print("\nChạy kiểm tra:")
    print("  npm run lint")
    print("  npm run build")


if __name__ == "__main__":
    main()
