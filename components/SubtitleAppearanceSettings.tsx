"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SUBTITLE_APPEARANCE,
  getSubtitleFontFamily,
  getSubtitleTextStyle,
  readSubtitleAppearance,
  saveSubtitleAppearance,
  SUBTITLE_APPEARANCE_CHANGE_EVENT,
  SUBTITLE_APPEARANCE_KEY,
  SUBTITLE_BACKGROUND_OPTIONS,
  SUBTITLE_COLOR_OPTIONS,
  SUBTITLE_FONT_OPTIONS,
  SUBTITLE_OUTLINE_OPTIONS,
  SUBTITLE_POSITION_OPTIONS,
  SUBTITLE_SIZE_OPTIONS,
  type SubtitleAppearance,
} from "@/lib/subtitleAppearance";

type SubtitleAppearanceSettingsProps = {
  embedded?: boolean;
  onClose?: () => void;
};

function optionClass(active: boolean) {
  return [
    "min-h-11 rounded-2xl border px-3 py-2 text-sm font-black transition",
    active
      ? "border-yellow-300 bg-yellow-300 text-black"
      : "border-white/10 bg-white/[0.06] text-white hover:bg-white/10",
  ].join(" ");
}

export default function SubtitleAppearanceSettings({
  embedded = false,
  onClose,
}: SubtitleAppearanceSettingsProps) {
  // BAOFLIX_SUBTITLE_APPEARANCE_V1
  const [appearance, setAppearance] = useState<SubtitleAppearance>(
    DEFAULT_SUBTITLE_APPEARANCE
  );

  useEffect(() => {
    const sync = () => setAppearance(readSubtitleAppearance());
    sync();

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === SUBTITLE_APPEARANCE_KEY) sync();
    }

    window.addEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, sync);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function update(patch: Partial<SubtitleAppearance>) {
    const next = saveSubtitleAppearance({ ...appearance, ...patch });
    setAppearance(next);
  }

  function reset() {
    const next = saveSubtitleAppearance(DEFAULT_SUBTITLE_APPEARANCE);
    setAppearance(next);
  }

  return (
    <section
      id="subtitle-appearance"
      className={
        embedded
          ? "rounded-3xl border border-white/15 bg-[#080c14]/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
          : "mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
            Netflix-style
          </p>
          <h2 className="mt-1 text-2xl font-black">Giao diện phụ đề</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Tùy chỉnh áp dụng ngay cho native player và được nhớ trên thiết bị này.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            data-tv-default
            data-tv-focus-key="subtitle-style:close"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white hover:bg-white/10"
          >
            Đóng
          </button>
        )}
      </div>

      <div className="relative mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-700 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.14),transparent_52%)]" />
        <div className="absolute inset-x-3 bottom-[18%] text-center">
          <span style={getSubtitleTextStyle(appearance)}>
            Phụ đề mẫu hiển thị như thế này
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5">
        <div>
          <p className="mb-2 text-sm font-black text-white">Cỡ chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUBTITLE_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:size:${option.value}`}
                onClick={() => update({ size: option.value })}
                className={optionClass(appearance.size === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Font chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUBTITLE_FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:font:${option.value}`}
                onClick={() => update({ font: option.value })}
                className={optionClass(appearance.font === option.value)}
                style={{ fontFamily: getSubtitleFontFamily(option.value) }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Màu chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUBTITLE_COLOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:color:${option.value}`}
                onClick={() => update({ color: option.value })}
                className={optionClass(appearance.color === option.value)}
              >
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-full border border-black/40"
                  style={{ backgroundColor: option.swatch }}
                />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Nền chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-3 gap-2">
            {SUBTITLE_BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:background:${option.value}`}
                onClick={() => update({ background: option.value })}
                className={optionClass(appearance.background === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Viền chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-3 gap-2">
            {SUBTITLE_OUTLINE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:outline:${option.value}`}
                onClick={() => update({ outline: option.value })}
                className={optionClass(appearance.outline === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Vị trí</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-3 gap-2">
            {SUBTITLE_POSITION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:position:${option.value}`}
                onClick={() => update({ position: option.value })}
                className={optionClass(appearance.position === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="max-w-xl text-xs leading-5 text-slate-400">
          Google Drive iframe dự phòng không cho BảoFlix vẽ phụ đề. Hãy dùng Drive Relay/native player để có giao diện này.
        </p>
        <button
          type="button"
          data-tv-focus-key="subtitle-style:reset"
          onClick={reset}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
        >
          Khôi phục mặc định
        </button>
      </div>
    </section>
  );
}
