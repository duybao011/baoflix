#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import datetime as dt
import shutil
import subprocess
import sys
from pathlib import Path

TARGET_REL = Path("components") / "WatchHistoryCloudSync.tsx"

MARKER = "// BAOFLIX_JWT_FUTURE_RETRY"
HELPERS = "// BAOFLIX_JWT_FUTURE_RETRY\nconst JWT_FUTURE_RETRY_DELAYS_MS = [1500, 5000] as const;\nconst JWT_FUTURE_FINAL_RETRY_MS = 15000;\n\nfunction isJwtIssuedAtFutureError(error: unknown) {\n  if (!error || typeof error !== \"object\") return false;\n\n  const candidate = error as {\n    code?: unknown;\n    message?: unknown;\n  };\n\n  return (\n    String(candidate.code || \"\") === \"PGRST303\" &&\n    String(candidate.message || \"\")\n      .toLowerCase()\n      .includes(\"jwt issued at future\")\n  );\n}\n\nfunction waitForJwtClockSkew(delayMs: number) {\n  return new Promise<void>((resolve) => {\n    window.setTimeout(resolve, delayMs);\n  });\n}\n\nasync function withJwtFutureRetry<\n  T extends { error: unknown }\n>(\n  operation: () => PromiseLike<T>,\n  label: string\n): Promise<T> {\n  let result = await operation();\n\n  for (\n    let attempt = 0;\n    attempt < JWT_FUTURE_RETRY_DELAYS_MS.length;\n    attempt += 1\n  ) {\n    if (!isJwtIssuedAtFutureError(result.error)) {\n      return result;\n    }\n\n    const delayMs =\n      JWT_FUTURE_RETRY_DELAYS_MS[attempt];\n\n    console.info(\n      `[BảoFlix] Supabase JWT clock-skew tạm thời (${label}); ` +\n        `thử lại sau ${delayMs}ms.`\n    );\n\n    await waitForJwtClockSkew(delayMs);\n    result = await operation();\n  }\n\n  return result;\n}"
OLD_SELECT = "        const { data, error } = await supabase\n          .from(TABLE)\n          .select(\n            \"history,watched_episodes,playback_progress\"\n          )\n          .eq(\"user_id\", user.id)\n          .eq(\"sync_group\", SYNC_GROUP)\n          .maybeSingle();\n\n        if (error) throw error;"
NEW_SELECT = "        const { data, error } = await withJwtFutureRetry(\n          () =>\n            supabase\n              .from(TABLE)\n              .select(\n                \"history,watched_episodes,playback_progress\"\n              )\n              .eq(\"user_id\", user.id)\n              .eq(\"sync_group\", SYNC_GROUP)\n              .maybeSingle(),\n          \"history/progress select\"\n        );\n\n        if (error) throw error;"
OLD_UPSERT = "          const { error: upsertError } = await supabase\n            .from(TABLE)\n            .upsert(\n              {\n                user_id: user.id,\n                sync_group: SYNC_GROUP,\n                history: mergedHistory,\n                watched_episodes: mergedWatched,\n                playback_progress: mergedProgress,\n                updated_at: new Date().toISOString(),\n              },\n              { onConflict: \"user_id,sync_group\" }\n            );\n\n          if (upsertError) throw upsertError;"
NEW_UPSERT = "          const { error: upsertError } =\n            await withJwtFutureRetry(\n              () =>\n                supabase\n                  .from(TABLE)\n                  .upsert(\n                    {\n                      user_id: user.id,\n                      sync_group: SYNC_GROUP,\n                      history: mergedHistory,\n                      watched_episodes: mergedWatched,\n                      playback_progress: mergedProgress,\n                      updated_at: new Date().toISOString(),\n                    },\n                    { onConflict: \"user_id,sync_group\" }\n                  ),\n              \"history/progress upsert\"\n            );\n\n          if (upsertError) throw upsertError;"
OLD_CATCH = "      } catch (error) {\n        console.warn(\n          \"[BảoFlix] History/progress sync thất bại:\",\n          error\n        );\n      } finally {"
NEW_CATCH = "      } catch (error) {\n        if (isJwtIssuedAtFutureError(error)) {\n          queuedRef.current = false;\n          lastCompletedRef.current = Date.now();\n\n          console.info(\n            \"[BảoFlix] Supabase JWT vẫn lệch clock sau retry; \" +\n              \"hoãn cloud sync 15 giây. Local history/progress vẫn được giữ.\"\n          );\n\n          schedule(JWT_FUTURE_FINAL_RETRY_MS, true);\n        } else {\n          console.warn(\n            \"[BảoFlix] History/progress sync thất bại:\",\n            error\n          );\n        }\n      } finally {"
OLD_TOKEN_REFRESH = "      } else if (event === \"TOKEN_REFRESHED\") {\n        schedule(500, false);\n      }"
NEW_TOKEN_REFRESH = "      } else if (event === \"TOKEN_REFRESHED\") {\n        // Tránh chọc Data API ngay sát thời điểm Auth vừa phát JWT mới.\n        schedule(1800, false);\n      }"

def find_repo_root(start: Path) -> Path:
    start = start.resolve()
    for candidate in [start, *start.parents]:
        if (
            (candidate / "package.json").exists()
            and (candidate / TARGET_REL).exists()
        ):
            return candidate
    raise RuntimeError(
        "Không tìm thấy repo BảoFlix. "
        "Hãy đặt patcher cạnh package.json hoặc chạy với --root."
    )

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Không thể patch {label}: cần đúng 1 marker, tìm thấy {count}."
        )
    return text.replace(old, new, 1)

def build_patched(current: str) -> str:
    if MARKER in current:
        return current

    anchor = 'const PROGRESS_SYNC_DELAY_MS = 12000;'
    if anchor not in current:
        raise RuntimeError(
            "Không tìm thấy PROGRESS_SYNC_DELAY_MS; source có thể đã đổi."
        )

    patched = current.replace(
        anchor,
        anchor + "\n\n" + HELPERS,
        1,
    )

    patched = replace_once(
        patched, OLD_SELECT, NEW_SELECT, "Supabase SELECT"
    )
    patched = replace_once(
        patched, OLD_UPSERT, NEW_UPSERT, "Supabase UPSERT"
    )
    patched = replace_once(
        patched, OLD_CATCH, NEW_CATCH, "catch handler"
    )
    patched = replace_once(
        patched,
        OLD_TOKEN_REFRESH,
        NEW_TOKEN_REFRESH,
        "TOKEN_REFRESHED delay",
    )

    return patched

def run_check(root: Path) -> None:
    npm = "npm.cmd" if sys.platform.startswith("win") else "npm"
    print("$ npm run build")
    result = subprocess.run(
        [npm, "run", "build"],
        cwd=root,
    )
    if result.returncode != 0:
        raise RuntimeError("npm run build thất bại.")

def main() -> int:
    parser = argparse.ArgumentParser(
        description="BảoFlix Supabase PGRST303 JWT-future retry patch"
    )
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = find_repo_root(args.root)
    target = root / TARGET_REL
    current = target.read_text(encoding="utf-8")

    print("Repo  :", root)
    print("Target:", target)

    if MARKER in current:
        print("Patch JWT-future retry đã có sẵn.")
        if args.check:
            run_check(root)
        return 0

    patched = build_patched(current)

    print()
    print("Sẽ áp dụng:")
    print(" - retry CHỈ PGRST303 + 'JWT issued at future'")
    print(" - backoff 1.5s -> 5s")
    print(" - nếu vẫn lỗi: hoãn sync 15s, không spam warning")
    print(" - TOKEN_REFRESHED: 500ms -> 1800ms")
    print(" - không refreshSession thủ công")
    print(" - không retry lỗi RLS/401 khác")
    print(" - local history/progress không bị xoá")

    if args.dry_run:
        print()
        print("Dry-run OK.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = (
        root
        / ".baoflix_patch_backups"
        / f"jwt_future_retry_{stamp}"
        / TARGET_REL
    )

    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, backup)
    print("Backup:", backup)

    try:
        target.write_text(
            patched,
            encoding="utf-8",
            newline="\n",
        )

        print("Đã patch WatchHistoryCloudSync.tsx.")

        if args.check:
            run_check(root)
            print("Build check OK.")

        print()
        print("Patch hoàn tất.")
        return 0

    except Exception:
        shutil.copy2(backup, target)
        print(
            "Có lỗi; đã rollback file gốc.",
            file=sys.stderr,
        )
        raise

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            f"PATCH ABORTED: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(2)
