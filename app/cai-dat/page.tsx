"use client";

import Link from "next/link";
import { useState } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);

  async function reloadApp() {
    setLoading(true);

    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.allSettled(
          registrations.map((registration) => registration.update())
        );
      }
    } catch {
      // Ignore and reload normally.
    }

    const url = new URL(window.location.href);
    url.searchParams.set("_reload", String(Date.now()));
    window.location.href = url.toString();
  }

  function turnOffTvMode() {
    sessionStorage.removeItem(TV_SESSION_KEY);
    window.dispatchEvent(new Event("baoflix-tv-mode-change"));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="mb-2 text-sm font-black uppercase tracking-[0.24em] text-red-300">
          BảoFlix
        </p>

        <h1 className="text-3xl font-black md:text-5xl">Cài đặt</h1>

        <p className="mt-3 max-w-2xl text-slate-400">
          Các nút cần cho PWA/APK WebView được gom về đây để TV Mode gọn hơn.
        </p>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-2xl font-black">Ứng dụng</h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reloadApp}
            disabled={loading}
            className="rounded-2xl bg-yellow-300 px-5 py-4 text-left font-black text-black hover:bg-yellow-200 disabled:opacity-60"
          >
            {loading ? "Đang tải lại..." : "↻ Tải lại app"}
            <span className="mt-1 block text-xs font-bold text-black/70">
              Dùng khi Vercel vừa deploy bản mới.
            </span>
          </button>

          <Link
            href="/tv"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white hover:bg-white/10"
          >
            Mở TV Mode
            <span className="mt-1 block text-xs font-bold text-slate-400">
              Giao diện lớn cho TCL/remote.
            </span>
          </Link>

          <button
            type="button"
            onClick={turnOffTvMode}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left font-black text-white hover:bg-white/10"
          >
            Tắt trạng thái TV Mode
            <span className="mt-1 block text-xs font-bold text-slate-400">
              Dùng khi lỡ bật TV Mode trên điện thoại/laptop.
            </span>
          </button>

          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white hover:bg-white/10"
          >
            Về trang chủ
            <span className="mt-1 block text-xs font-bold text-slate-400">
              Quay lại giao diện thường.
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
