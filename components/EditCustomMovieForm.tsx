"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCustomMovieBySlugClient,
  upsertCustomMovie,
  type StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { slugify } from "@/lib/slugify";

type EditCustomMovieFormProps = {
  params: Promise<{ slug: string }>;
};

function joinNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value || "");
}

export default function EditCustomMovieForm({ params }: EditCustomMovieFormProps) {
  const { slug } = use(params);
  const router = useRouter();

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [name, setName] = useState("");
  const [originName, setOriginName] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [year, setYear] = useState("");
  const [countryName, setCountryName] = useState("Nhật Bản");
  const [countrySlug, setCountrySlug] = useState("nhat-ban");
  const [categories, setCategories] = useState("Phim riêng");
  const [actors, setActors] = useState("");
  const [status, setStatus] = useState("ongoing");
  const [content, setContent] = useState("");

  useEffect(() => {
    const found = getCustomMovieBySlugClient(slug) || null;
    setMovieData(found);

    if (!found) return;

    const movie = found.movie;
    const firstCountry = movie.country?.[0];

    setName(movie.name || "");
    setOriginName(movie.origin_name || "");
    setPosterUrl(movie.poster_url || "");
    setThumbUrl(movie.thumb_url || "");
    setYear(movie.year ? String(movie.year) : "");
    setCountryName(firstCountry?.name || "Nhật Bản");
    setCountrySlug(firstCountry?.slug || "nhat-ban");
    setCategories((movie.category || []).map((item) => item.name).join(", "));
    setActors(joinNames(movie.actor));
    setStatus(movie.status || "ongoing");
    setContent(movie.content || "");
  }, [slug]);

  const categoryList = useMemo(() => {
    return categories
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ({
        name: item,
        slug: slugify(item),
      }));
  }, [categories]);

  function save() {
    if (!movieData) return;

    if (!name.trim()) {
      alert("Tên phim không được trống.");
      return;
    }

    const yearNumber = year ? Number(year) : undefined;

    const updated: StoredCustomMovie = {
      ...movieData,
      updatedAt: new Date().toISOString(),
      movie: {
        ...movieData.movie,
        name: name.trim(),
        origin_name: originName.trim() || name.trim(),
        poster_url: posterUrl.trim() || "/placeholder.png",
        thumb_url: thumbUrl.trim() || posterUrl.trim() || "/placeholder.png",
        year: Number.isFinite(yearNumber) ? yearNumber : undefined,
        status: status.trim() || "ongoing",
        content: content.trim() || "Phim riêng do bạn tự thêm vào BảoFlix.",
        category:
          categoryList.length > 0
            ? categoryList
            : [
                {
                  name: "Phim riêng",
                  slug: "phim-rieng",
                },
              ],
        country: [
          {
            name: countryName.trim() || "Nhật Bản",
            slug: countrySlug.trim() || slugify(countryName || "Nhật Bản"),
          },
        ],
        actor: actors
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    };

    upsertCustomMovie(updated);

    router.push(`/ca-nhan/${updated.movie.slug}`);
  }

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tìm thấy phim riêng</h1>
        <p className="mt-2 text-slate-400">
          Phim này có thể chưa được thêm bằng giao diện hoặc đã bị xóa.
        </p>

        <Link
          href="/ca-nhan"
          className="mt-5 inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
        >
          Quay lại phim riêng
        </Link>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <Link href={`/ca-nhan/${slug}`} className="text-sm text-red-300">
        ← Quay lại chi tiết phim
      </Link>

      <h1 className="mt-4 text-3xl font-black">Sửa thông tin phim riêng</h1>

      <p className="mt-2 text-sm text-slate-400">
        Slug đang dùng: <b>{slug}</b>. Slug được giữ nguyên để không hỏng lịch sử
        và link cũ.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Tên dịch</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Tên gốc</span>
          <input
            value={originName}
            onChange={(event) => setOriginName(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Poster URL</span>
            <input
              value={posterUrl}
              onChange={(event) => setPosterUrl(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Ảnh ngang / thumb URL</span>
            <input
              value={thumbUrl}
              onChange={(event) => setThumbUrl(event.target.value)}
              placeholder="Để trống sẽ dùng poster"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Năm</span>
            <input
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Trạng thái</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            >
              <option value="ongoing">Đang cập nhật</option>
              <option value="completed">Hoàn thành</option>
              <option value="paused">Tạm dừng</option>
              <option value="waiting">Chờ tập mới</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Quốc gia</span>
            <input
              value={countryName}
              onChange={(event) => {
                setCountryName(event.target.value);
                setCountrySlug(slugify(event.target.value));
              }}
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Country slug</span>
            <input
              value={countrySlug}
              onChange={(event) => setCountrySlug(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Thể loại, cách nhau bằng dấu phẩy</span>
          <input
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Diễn viên / nhân vật, cách nhau bằng dấu phẩy</span>
          <input
            value={actors}
            onChange={(event) => setActors(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Nội dung phim</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={7}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            className="rounded-2xl bg-red-600 px-6 py-3 font-black text-white hover:bg-red-500"
          >
            Lưu thay đổi
          </button>

          <Link
            href={`/ca-nhan/${slug}`}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold hover:bg-white/10"
          >
            Hủy
          </Link>
        </div>
      </div>
    </section>
  );
}
