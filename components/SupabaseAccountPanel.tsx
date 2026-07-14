"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { readCustomMovies } from "@/lib/customMoviesClient";
import { syncCustomMoviesBidirectional } from "@/lib/customMoviesRemote";

export default function SupabaseAccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localCount, setLocalCount] = useState(0);

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    function refreshLocalCount() {
      if (!active) return;
      setLocalCount(readCustomMovies().length);
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setStatus(`Không đọc được phiên đăng nhập: ${error.message}`);
      }

      setUser(data.session?.user ?? null);
      setCheckingSession(false);
      refreshLocalCount();
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setUser(session?.user ?? null);
      setCheckingSession(false);
      refreshLocalCount();
    });

    window.addEventListener("baoflix-custom-movies-synced", refreshLocalCount);
    window.addEventListener("baoflix-custom-movies-change", refreshLocalCount);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener(
        "baoflix-custom-movies-synced",
        refreshLocalCount
      );
      window.removeEventListener(
        "baoflix-custom-movies-change",
        refreshLocalCount
      );
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setStatus("Nhập đầy đủ email và mật khẩu.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setStatus(`Đăng nhập thất bại: ${error.message}`);
        return;
      }

      setUser(data.user);
      setPassword("");

      const result = await syncCustomMoviesBidirectional();

      if (result) {
        setLocalCount(result.finalCount);
      }

      setStatus(
        result
          ? `Đăng nhập và đồng bộ thành công: ${result.finalCount} phim.`
          : "Đăng nhập Supabase thành công."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Không thể kết nối tới Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    setStatus("");

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setStatus(`Không đăng xuất được: ${error.message}`);
        return;
      }

      setUser(null);
      setEmail("");
      setPassword("");
      setStatus("Đã đăng xuất khỏi Supabase.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Không thể đăng xuất."
      );
    } finally {
      setLoading(false);
    }
  }

  async function testDatabase() {
    setLoading(true);
    setStatus("");

    try {
      const supabase = getSupabaseClient();

      const { count, error } = await supabase
        .from("custom_movies")
        .select("slug", {
          count: "exact",
          head: true,
        });

      if (error) {
        setStatus(`Kết nối database thất bại: ${error.message}`);
        return;
      }

      setStatus(
        `Kết nối database thành công. Tài khoản hiện có ${count ?? 0} phim trên Supabase.`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Không thể kiểm tra database."
      );
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setLoading(true);
    setStatus("");

    try {
      const result = await syncCustomMoviesBidirectional();

      if (!result) {
        setStatus("Bạn cần đăng nhập Supabase trước.");
        return;
      }

      setLocalCount(result.finalCount);

      setStatus(
        [
          `Đồng bộ xong ${result.finalCount} phim.`,
          result.uploadedCount > 0
            ? `Đẩy lên: ${result.uploadedCount}.`
            : "",
          result.downloadedCount > 0
            ? `Tải về: ${result.downloadedCount}.`
            : "",
          result.deletedCount > 0
            ? `Đã xóa trên cloud: ${result.deletedCount}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Đồng bộ thất bại."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-2xl font-black">Tài khoản đồng bộ</h2>

        <p className="mt-3 text-sm text-slate-400">
          Đang kiểm tra phiên đăng nhập Supabase...
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-2xl font-black">Tài khoản đồng bộ</h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Máy tính thêm hoặc sửa phim sẽ tự đẩy lên Supabase. TV đăng nhập cùng
          tài khoản sẽ tự tải thư viện về thiết bị.
        </p>
      </div>

      {user ? (
        <div className="mt-5">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              Đã đăng nhập
            </p>

            <p className="mt-2 break-all font-bold text-white">
              {user.email || "Tài khoản Supabase"}
            </p>

            <p className="mt-2 text-sm font-bold text-slate-300">
              Thiết bị hiện có {localCount} phim riêng.
            </p>

            <p className="mt-2 break-all text-xs text-slate-500">
              User ID: {user.id}
            </p>
          </div>

          <div
            data-tv-row
            data-tv-row-wrap="true"
            className="mt-4 flex flex-wrap gap-3"
          >
            <button
              type="button"
              onClick={syncNow}
              disabled={loading}
              className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black hover:bg-yellow-200 disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "↻ Đồng bộ thư viện ngay"}
            </button>

            <button
              type="button"
              onClick={testDatabase}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black hover:bg-white/10 disabled:opacity-50"
            >
              Kiểm tra database
            </button>

            <button
              type="button"
              onClick={signOut}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black hover:bg-white/10 disabled:opacity-50"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={signIn} className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Email</span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="Email tài khoản BảoFlix"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none focus:border-yellow-300"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Mật khẩu</span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Mật khẩu Supabase"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none focus:border-yellow-300"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black hover:bg-yellow-200 disabled:opacity-50"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập đồng bộ"}
          </button>
        </form>
      )}

      {status && (
        <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-semibold text-yellow-100">
          {status}
        </div>
      )}
    </section>
  );
}
