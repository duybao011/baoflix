from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


PATCH_ID = "BAOFLIX_SUBTITLE_FONTS_V2"
V1_PATCH_ID = "BAOFLIX_SUBTITLE_APPEARANCE_V1"
GOOGLE_FONTS_REVISION = "5e35378e6bda803962ee6fd257e444a7d459660d"
DOWNLOAD_BASE = (
    "https://raw.githubusercontent.com/google/fonts/"
    f"{GOOGLE_FONTS_REVISION}/"
)


@dataclass(frozen=True)
class DownloadAsset:
    relative_path: str
    source_path: str
    sha256: str
    size: int
    kind: str

    @property
    def url(self) -> str:
        return DOWNLOAD_BASE + self.source_path


ASSETS = (
    DownloadAsset(
        "BeVietnamPro-ExtraBold.ttf",
        "ofl/bevietnampro/BeVietnamPro-ExtraBold.ttf",
        "44dbfa01553d227bec76ba6446c5618870a76a4a3297f41630dde859d0650d02",
        139680,
        "font",
    ),
    DownloadAsset(
        "Arimo-Variable.ttf",
        "ofl/arimo/Arimo%5Bwght%5D.ttf",
        "e43898b143ec826ac8cb4034816458a7047fbe0836558de2a1f8c6223ae3e0ca",
        496268,
        "font",
    ),
    DownloadAsset(
        "OpenSans-Variable.ttf",
        "ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf",
        "36643644f318a812aab2d2ed3bb98f8cf0872527f835fe9398d95fe6b9adb878",
        532636,
        "font",
    ),
    DownloadAsset(
        "NunitoSans-Variable.ttf",
        "ofl/nunitosans/NunitoSans%5BYTLC%2Copsz%2Cwdth%2Cwght%5D.ttf",
        "f934d7142fb4784bf828da485b7dcbd90c0c80d514e9d49a5da0ed3a1ae2491d",
        571240,
        "font",
    ),
    DownloadAsset(
        "Lato-ExtraBold.ttf",
        "ofl/lato/Lato-ExtraBold.ttf",
        "61018de62bdaf90d4ac80b1d53c5c130756c8e9219aea3d2773fc9bd5869af97",
        613920,
        "font",
    ),
    DownloadAsset(
        "licenses/BeVietnamPro-OFL.txt",
        "ofl/bevietnampro/OFL.txt",
        "6b7f8f73609a25ea78c891e34cf37b06f8a676b7ea986e941e43b009110f2a85",
        4397,
        "license",
    ),
    DownloadAsset(
        "licenses/Arimo-OFL.txt",
        "ofl/arimo/OFL.txt",
        "11cce536cd2f3864d767003af5dcd739e2e15818cf2279b6175edeadd3960992",
        4384,
        "license",
    ),
    DownloadAsset(
        "licenses/OpenSans-OFL.txt",
        "ofl/opensans/OFL.txt",
        "fbbbcfef55318de350562559b671360de6d597112ecc5c73881b05092db89602",
        4389,
        "license",
    ),
    DownloadAsset(
        "licenses/NunitoSans-OFL.txt",
        "ofl/nunitosans/OFL.txt",
        "efbb0c9e864cef973982d9a17567e6be5c3d1759695574586f3f18c7ecca064b",
        4393,
        "license",
    ),
    DownloadAsset(
        "licenses/Lato-OFL.txt",
        "ofl/lato/OFL.txt",
        "74ba064d03f1f1c4a952da936c3eb71866c34404916734de3cae73b34357e59e",
        4407,
        "license",
    ),
)


FONT_CSS = r'''/* BAOFLIX_SUBTITLE_FONTS_V2
 * Font được tự lưu trong app, không phụ thuộc font cài trên máy người xem.
 * Giấy phép đi kèm tại /public/fonts/subtitles/licenses/.
 */

@font-face {
  font-family: "BaoFlix Be Vietnam Pro";
  src: url("/fonts/subtitles/BeVietnamPro-ExtraBold.ttf") format("truetype");
  font-style: normal;
  font-weight: 800;
  font-display: swap;
}

@font-face {
  font-family: "BaoFlix Arimo";
  src: url("/fonts/subtitles/Arimo-Variable.ttf") format("truetype");
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
}

@font-face {
  font-family: "BaoFlix Open Sans";
  src: url("/fonts/subtitles/OpenSans-Variable.ttf") format("truetype");
  font-style: normal;
  font-weight: 300 800;
  font-stretch: 75% 100%;
  font-display: swap;
}

@font-face {
  font-family: "BaoFlix Nunito Sans";
  src: url("/fonts/subtitles/NunitoSans-Variable.ttf") format("truetype");
  font-style: normal;
  font-weight: 200 1000;
  font-stretch: 75% 125%;
  font-display: swap;
}

@font-face {
  font-family: "BaoFlix Lato";
  src: url("/fonts/subtitles/Lato-ExtraBold.ttf") format("truetype");
  font-style: normal;
  font-weight: 800;
  font-display: swap;
}
'''


SOURCES_TEXT = f'''BẢOFLIX SUBTITLE FONTS V2

Các font trong thư mục này được tải từ kho chính thức google/fonts tại revision:
{GOOGLE_FONTS_REVISION}

Tất cả đều dùng SIL Open Font License 1.1 và có bộ chữ Vietnamese:

1. Be Vietnam Pro ExtraBold
   Source: https://github.com/google/fonts/tree/{GOOGLE_FONTS_REVISION}/ofl/bevietnampro
   File: BeVietnamPro-ExtraBold.ttf
   SHA-256: 44dbfa01553d227bec76ba6446c5618870a76a4a3297f41630dde859d0650d02
   License: licenses/BeVietnamPro-OFL.txt

2. Arimo Variable (400-700)
   Source: https://github.com/google/fonts/tree/{GOOGLE_FONTS_REVISION}/ofl/arimo
   File: Arimo-Variable.ttf
   SHA-256: e43898b143ec826ac8cb4034816458a7047fbe0836558de2a1f8c6223ae3e0ca
   License: licenses/Arimo-OFL.txt

3. Open Sans Variable (300-800)
   Source: https://github.com/google/fonts/tree/{GOOGLE_FONTS_REVISION}/ofl/opensans
   File: OpenSans-Variable.ttf
   SHA-256: 36643644f318a812aab2d2ed3bb98f8cf0872527f835fe9398d95fe6b9adb878
   License: licenses/OpenSans-OFL.txt

4. Nunito Sans Variable (200-1000)
   Source: https://github.com/google/fonts/tree/{GOOGLE_FONTS_REVISION}/ofl/nunitosans
   File: NunitoSans-Variable.ttf
   SHA-256: f934d7142fb4784bf828da485b7dcbd90c0c80d514e9d49a5da0ed3a1ae2491d
   License: licenses/NunitoSans-OFL.txt

5. Lato ExtraBold
   Source: https://github.com/google/fonts/tree/{GOOGLE_FONTS_REVISION}/ofl/lato
   File: Lato-ExtraBold.ttf
   SHA-256: 61018de62bdaf90d4ac80b1d53c5c130756c8e9219aea3d2773fc9bd5869af97
   License: licenses/Lato-OFL.txt

Font được self-host trong BảoFlix. Sau khi patch xong, trình xem phim không cần
Internet để tải font và cũng không phụ thuộc font cài trên Windows/TV.
'''


def detect_newline(raw: bytes) -> str:
    return "\r\n" if b"\r\n" in raw else "\n"


def read_source(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    newline = detect_newline(raw)
    return raw.decode("utf-8").replace("\r\n", "\n"), newline


def encode_source(text: str, newline: str) -> bytes:
    normalized = text.replace("\r\n", "\n")
    if newline == "\r\n":
        normalized = normalized.replace("\n", "\r\n")
    return normalized.encode("utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Không tìm thấy đúng 1 điểm vá cho {label} (tìm thấy {count}). "
            "Có thể source V1 đã được chỉnh khác bản được hỗ trợ."
        )
    return text.replace(old, new, 1)


def validate_asset_bytes(asset: DownloadAsset, data: bytes) -> None:
    if len(data) != asset.size:
        raise RuntimeError(
            f"{asset.relative_path}: sai kích thước "
            f"({len(data)} thay vì {asset.size} byte)."
        )

    digest = hashlib.sha256(data).hexdigest()
    if digest != asset.sha256:
        raise RuntimeError(
            f"{asset.relative_path}: SHA-256 không khớp. "
            "File tải về không đúng bản đã khóa."
        )

    if asset.kind == "font" and data[:4] not in (b"\x00\x01\x00\x00", b"OTTO"):
        raise RuntimeError(f"{asset.relative_path}: không có chữ ký TTF/OTF hợp lệ.")

    if asset.kind == "license" and b"SIL OPEN FONT LICENSE Version 1.1" not in data:
        raise RuntimeError(f"{asset.relative_path}: nội dung giấy phép OFL không hợp lệ.")


def download_asset(asset: DownloadAsset, target: Path) -> None:
    last_error: Exception | None = None

    for attempt in range(1, 4):
        try:
            request = urllib.request.Request(
                asset.url,
                headers={
                    "User-Agent": "BaoFlix-Subtitle-Fonts-V2/1.0",
                    "Accept": "application/octet-stream,text/plain;q=0.9,*/*;q=0.8",
                },
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read(asset.size + 1)

            validate_asset_bytes(asset, data)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            return
        except (OSError, RuntimeError, urllib.error.URLError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(float(attempt))

    raise RuntimeError(
        f"Không tải hoặc xác minh được {asset.relative_path}: {last_error}"
    )


def validate_installed_assets(font_root: Path) -> list[str]:
    problems: list[str] = []
    for asset in ASSETS:
        path = font_root / asset.relative_path
        if not path.is_file():
            problems.append(f"Thiếu {path.name}")
            continue
        try:
            validate_asset_bytes(asset, path.read_bytes())
        except RuntimeError as error:
            problems.append(str(error))
    return problems


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.baoflix-v2-tmp")
    try:
        temporary.write_bytes(content)
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def patch_appearance(text: str) -> str:
    text = replace_once(
        text,
        "// BAOFLIX_SUBTITLE_APPEARANCE_V1\n",
        "// BAOFLIX_SUBTITLE_APPEARANCE_V1\n"
        "// BAOFLIX_SUBTITLE_FONTS_V2\n",
        "marker font V2",
    )
    text = replace_once(
        text,
        'export type SubtitleFont = "sans" | "rounded" | "serif" | "mono";\n',
        'export type SubtitleFont =\n'
        '  | "be-vietnam-pro"\n'
        '  | "arimo"\n'
        '  | "open-sans"\n'
        '  | "nunito-sans"\n'
        '  | "lato";\n',
        "kiểu SubtitleFont",
    )
    text = replace_once(
        text,
        '  font: "rounded",\n',
        '  font: "be-vietnam-pro",\n',
        "font mặc định",
    )
    text = replace_once(
        text,
        '''export const SUBTITLE_FONT_OPTIONS: ReadonlyArray<{
  value: SubtitleFont;
  label: string;
}> = [
  { value: "sans", label: "Gọn" },
  { value: "rounded", label: "Bo tròn" },
  { value: "serif", label: "Có chân" },
  { value: "mono", label: "Mono" },
];
''',
        '''export const SUBTITLE_FONT_OPTIONS: ReadonlyArray<{
  value: SubtitleFont;
  label: string;
}> = [
  { value: "be-vietnam-pro", label: "Be Vietnam Pro" },
  { value: "arimo", label: "Arimo" },
  { value: "open-sans", label: "Open Sans" },
  { value: "nunito-sans", label: "Nunito Sans" },
  { value: "lato", label: "Lato" },
];
''',
        "danh sách font",
    )
    text = replace_once(
        text,
        '    font: isOneOf(raw.font, ["sans", "rounded", "serif", "mono"])\n'
        '      ? raw.font\n'
        '      : DEFAULT_SUBTITLE_APPEARANCE.font,\n',
        '    font: isOneOf(raw.font, [\n'
        '      "be-vietnam-pro",\n'
        '      "arimo",\n'
        '      "open-sans",\n'
        '      "nunito-sans",\n'
        '      "lato",\n'
        '    ])\n'
        '      ? raw.font\n'
        '      : DEFAULT_SUBTITLE_APPEARANCE.font,\n',
        "kiểm tra font đã lưu",
    )
    text = replace_once(
        text,
        '''const FONT_MAP: Record<SubtitleFont, string> = {
  sans: "Arial, Helvetica, sans-serif",
  rounded: '"Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Consolas, monospace',
};
''',
        '''const FONT_MAP: Record<SubtitleFont, string> = {
  "be-vietnam-pro": '"BaoFlix Be Vietnam Pro", Arial, Helvetica, sans-serif',
  arimo: '"BaoFlix Arimo", Arial, Helvetica, sans-serif',
  "open-sans": '"BaoFlix Open Sans", Arial, Helvetica, sans-serif',
  "nunito-sans": '"BaoFlix Nunito Sans", Arial, Helvetica, sans-serif',
  lato: '"BaoFlix Lato", Arial, Helvetica, sans-serif',
};

const FONT_WEIGHT_MAP: Record<SubtitleFont, number> = {
  "be-vietnam-pro": 800,
  arimo: 700,
  "open-sans": 700,
  "nunito-sans": 800,
  lato: 800,
};

export function getSubtitleFontFamily(font: SubtitleFont): string {
  return FONT_MAP[font];
}
''',
        "ánh xạ font local",
    )
    text = replace_once(
        text,
        '''    fontFamily: FONT_MAP[normalized.font],
    fontSize: SIZE_MAP[normalized.size],
    fontWeight: 800,
''',
        '''    fontFamily: getSubtitleFontFamily(normalized.font),
    fontSize: SIZE_MAP[normalized.size],
    fontWeight: FONT_WEIGHT_MAP[normalized.font],
''',
        "style chữ phụ đề",
    )
    return text


def patch_settings_component(text: str) -> str:
    text = replace_once(
        text,
        "  DEFAULT_SUBTITLE_APPEARANCE,\n  getSubtitleTextStyle,\n",
        "  DEFAULT_SUBTITLE_APPEARANCE,\n"
        "  getSubtitleFontFamily,\n"
        "  getSubtitleTextStyle,\n",
        "import helper font",
    )
    text = replace_once(
        text,
        '''        <div>
          <p className="mb-2 text-sm font-black text-white">Font chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUBTITLE_FONT_OPTIONS.map((option) => (
''',
        '''        <div>
          <p className="mb-2 text-sm font-black text-white">Font chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUBTITLE_FONT_OPTIONS.map((option) => (
''',
        "lưới chọn font",
    )
    text = replace_once(
        text,
        '''                onClick={() => update({ font: option.value })}
                className={optionClass(appearance.font === option.value)}
              >
''',
        '''                onClick={() => update({ font: option.value })}
                className={optionClass(appearance.font === option.value)}
                style={{ fontFamily: getSubtitleFontFamily(option.value) }}
              >
''',
        "preview từng font trong nút",
    )
    return text


def patch_layout(text: str) -> str:
    return replace_once(
        text,
        'import "./globals.css";\n',
        'import "./globals.css";\nimport "./subtitle-fonts.css";\n',
        "layout import font CSS",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Nâng Giao diện phụ đề BảoFlix V1 lên bộ 5 font Việt hóa self-host V2."
        )
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Thư mục gốc BảoFlix (mặc định: thư mục hiện tại).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chỉ kiểm tra khả năng vá, không tải và không ghi file.",
    )
    args = parser.parse_args()

    root = args.root.resolve()
    if not (root / "package.json").is_file():
        print(f"[LỖI] Không thấy package.json tại: {root}")
        print("Hãy đặt patcher trong C:\\Local\\baoflix rồi chạy lại.")
        return 2

    appearance_path = root / "lib" / "subtitleAppearance.ts"
    settings_component_path = (
        root / "components" / "SubtitleAppearanceSettings.tsx"
    )
    layout_path = root / "app" / "layout.tsx"
    css_path = root / "app" / "subtitle-fonts.css"
    font_root = root / "public" / "fonts" / "subtitles"
    sources_path = font_root / "SOURCES.txt"

    required = (appearance_path, settings_component_path, layout_path)
    missing = [str(path.relative_to(root)) for path in required if not path.is_file()]
    if missing:
        print("[LỖI] Thiếu file của Giao diện phụ đề V1:")
        for item in missing:
            print(f"  - {item}")
        print("Hãy chạy baoflix_subtitle_appearance_v1_patch.py trước, rồi chạy V2.")
        return 2

    try:
        appearance_text, appearance_newline = read_source(appearance_path)
        settings_text, settings_newline = read_source(settings_component_path)
        layout_text, layout_newline = read_source(layout_path)
    except (OSError, UnicodeError) as error:
        print(f"[LỖI] Không đọc được source: {error}")
        return 2

    if PATCH_ID in appearance_text:
        problems: list[str] = []
        if not css_path.is_file():
            problems.append("Thiếu app/subtitle-fonts.css")
        else:
            try:
                css_text, _ = read_source(css_path)
                if PATCH_ID not in css_text:
                    problems.append("app/subtitle-fonts.css không có marker V2")
            except (OSError, UnicodeError) as error:
                problems.append(f"Không đọc được app/subtitle-fonts.css: {error}")

        if 'import "./subtitle-fonts.css";' not in layout_text:
            problems.append("app/layout.tsx chưa import subtitle-fonts.css")
        if not sources_path.is_file():
            problems.append("Thiếu public/fonts/subtitles/SOURCES.txt")
        problems.extend(validate_installed_assets(font_root))

        if problems:
            print("[LỖI] Patch V2 đang ở trạng thái thiếu hoặc sai file:")
            for problem in problems:
                print(f"  - {problem}")
            print("Không tự ghi đè để tránh làm hỏng source hiện có.")
            return 2

        print("[OK] Bộ font phụ đề V2 đã có đủ và đúng mã kiểm tra.")
        print("Không thay đổi file nào. Không commit và không push GitHub.")
        return 0

    if V1_PATCH_ID not in appearance_text:
        print("[LỖI] lib/subtitleAppearance.ts không phải bản do patch V1 tạo.")
        print("Không tự sửa để tránh ghi đè code phụ đề khác của bạn.")
        return 2

    partial_items: list[str] = []
    if css_path.exists():
        partial_items.append("app/subtitle-fonts.css đã tồn tại")
    if font_root.exists():
        partial_items.append("public/fonts/subtitles đã tồn tại")
    if 'import "./subtitle-fonts.css";' in layout_text:
        partial_items.append("app/layout.tsx đã có import subtitle-fonts.css")
    if partial_items:
        print("[LỖI] Phát hiện file/đoạn code có thể trùng với patch V2:")
        for item in partial_items:
            print(f"  - {item}")
        print("Không tự ghi đè. Hãy kiểm tra thủ công trước khi chạy lại.")
        return 2

    try:
        patched_appearance = patch_appearance(appearance_text)
        patched_settings = patch_settings_component(settings_text)
        patched_layout = patch_layout(layout_text)
    except RuntimeError as error:
        print(f"[LỖI] {error}")
        return 2

    total_font_bytes = sum(asset.size for asset in ASSETS if asset.kind == "font")
    planned = (
        "Đổi menu font cũ thành Be Vietnam Pro, Arimo, Open Sans, Nunito Sans, Lato",
        "Đặt Be Vietnam Pro ExtraBold làm font mặc định",
        "Hiển thị tên từng lựa chọn bằng đúng font của nó",
        f"Tải và self-host 5 font Unicode Việt ({total_font_bytes / 1024 / 1024:.2f} MB)",
        "Kèm giấy phép OFL và mã SHA-256 của từng font",
        "Sửa app/layout.tsx để nạp app/subtitle-fonts.css",
    )

    print("[KIỂM TRA] Patch V2 tương thích với Giao diện phụ đề V1 hiện tại.")
    for item in planned:
        print(f"  - {item}")

    if args.dry_run:
        print("[DRY-RUN] Chưa tải và chưa thay đổi file nào.")
        print("Patch này không có lệnh GitHub, commit hoặc push.")
        return 0

    try:
        with tempfile.TemporaryDirectory(
            prefix=".baoflix-subtitle-fonts-v2-", dir=root
        ) as temporary_dir:
            staged_font_root = Path(temporary_dir) / "subtitles"
            for index, asset in enumerate(ASSETS, start=1):
                label = "font" if asset.kind == "font" else "license"
                print(
                    f"[TẢI {index}/{len(ASSETS)}] {label}: "
                    f"{Path(asset.relative_path).name}"
                )
                download_asset(asset, staged_font_root / asset.relative_path)

            (staged_font_root / "SOURCES.txt").write_text(
                SOURCES_TEXT,
                encoding="utf-8",
                newline="\n",
            )

            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_root = (
                root
                / ".baoflix_patch_backups"
                / f"subtitle-fonts-v2-{timestamp}"
            )
            for source in required:
                target = backup_root / source.relative_to(root)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)

            original_bytes = {path: path.read_bytes() for path in required}
            writes = {
                appearance_path: encode_source(
                    patched_appearance, appearance_newline
                ),
                settings_component_path: encode_source(
                    patched_settings, settings_newline
                ),
                layout_path: encode_source(patched_layout, layout_newline),
                css_path: encode_source(FONT_CSS, layout_newline),
            }

            font_root.parent.mkdir(parents=True, exist_ok=True)
            font_installed = False
            try:
                shutil.move(str(staged_font_root), str(font_root))
                font_installed = True
                for path, content in writes.items():
                    atomic_write(path, content)
            except Exception:
                for path, content in original_bytes.items():
                    atomic_write(path, content)
                if css_path.exists():
                    css_path.unlink()
                if font_installed and font_root.exists():
                    shutil.rmtree(font_root)
                raise

    except Exception as error:
        print(f"[LỖI] Patch V2 thất bại: {error}")
        print("Source chưa đổi hoặc đã được khôi phục từ bản gốc trong bộ nhớ.")
        print("Nếu lỗi mạng, kiểm tra Internet rồi chạy lại file này.")
        return 3

    print("[XONG] Đã đóng 5 font Việt hóa vào Giao diện phụ đề BảoFlix V2.")
    print(f"[BACKUP] {backup_root}")
    print("Mặc định mới: Be Vietnam Pro ExtraBold.")
    print("Bước tiếp theo: chạy npm run lint, sau đó npm run build.")
    print("Patcher chỉ sửa local; không commit và không push GitHub.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
