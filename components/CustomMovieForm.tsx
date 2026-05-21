"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomMovieFromForm,
  upsertCustomMovie,
} from "@/lib/customMoviesClient";
import { slugify } from "@/lib/slugify";

export default function CustomMovieForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [originName, setOriginName] = useState("");
  const [slug, setSlug] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [year, setYear] = useState("");
  const [countryName, setCountryName] = useState("Nhật Bản");
  const [countrySlug, setCountrySlug] = useState("nhat-ban");
  const [categories, setCategories] = useState("Phim riêng, Chính kịch");
  const [actors, setActors] = useState("");
  const [content, setContent] = useState("");
  const [episodesText, setEpisodesText] = useState("");

  const autoSlug = useMemo(() => slugify(name), [name]);
  const finalSlug = slug.trim() || autoSlug;

  function submit() {
    if (!name.trim()) {
      alert("Nhập tên phim đã fen.");
      return;
    }

    if (!episodesText.trim()) {
      alert("Nhập ít nhất 1 tập phim.");
      return;
    }

    const movie = createCustomMovieFromForm({
      name,
      originName,
      slug: finalSlug,
      posterUrl,
      thumbUrl,
      year,
      countryName,
      countrySlug,
      categories,
      actors,
      content,
      episodesText,
    });

    upsertCustomMovie(movie);

    router.push(`/ca-nhan/${movie.movie.slug}`);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h1 className="text-3xl font-black">Thêm phim riêng</h1>

      <p className="mt-2 text-sm text-slate-400">
        Có thể chia nhiều mùa bằng dòng bắt đầu với dấu <b>#</b>, ví dụ{" "}
        <b># Mùa 1</b>, <b># Season 2024</b>.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Tên dịch</span>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Formula 1: Cuộc Đua Sống Còn"
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Tên gốc</span>

          <input
            value={originName}
            onChange={(event) => setOriginName(event.target.value)}
            placeholder="Formula 1: Drive To Survive"
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Slug tự tạo</span>

          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={autoSlug || "tu-dong-tao-tu-ten-phim"}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />

          <span className="text-xs text-slate-400">
            Slug sẽ dùng: <b>{finalSlug || "chua-co-slug"}</b>
          </span>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Poster URL</span>

            <input
              value={posterUrl}
              onChange={(event) => setPosterUrl(event.target.value)}
              placeholder="/custom-posters/f1.jpg hoặc link ảnh"
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

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Năm</span>

            <input
              value={year}
              onChange={(event) => setYear(event.target.value)}
              placeholder="2024"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />
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
          <span className="text-sm font-bold">
            Thể loại, cách nhau bằng dấu phẩy
          </span>

          <input
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            placeholder="Tài liệu, Thể thao, Phim riêng"
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">
            Diễn viên / nhân vật, cách nhau bằng dấu phẩy
          </span>

          <input
            value={actors}
            onChange={(event) => setActors(event.target.value)}
            placeholder="Max Verstappen, Lewis Hamilton, Charles Leclerc"
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Nội dung phim</span>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            placeholder="Nhập mô tả phim..."
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Danh sách mùa / tập</span>

          <textarea
            value={episodesText}
            onChange={(event) => setEpisodesText(event.target.value)}
            rows={12}
            placeholder={`# Mùa 1
Tập 01 | https://drive.google.com/file/d/xxx/view
Tập 02 | https://drive.google.com/file/d/yyy/view

# Mùa 2
Tập 01 | https://drive.google.com/file/d/zzz/view
Tập 02 | https://drive.google.com/file/d/abc/view`}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />

          <span className="text-xs text-slate-400">
            Mỗi mùa bắt đầu bằng <b># Tên mùa</b>. Mỗi tập nhập dạng{" "}
            <b>Tên tập | Link video</b>. Nếu chỉ dán link, app tự đặt Tập 01,
            Tập 02...
          </span>
        </label>

        <button
          type="button"
          onClick={submit}
          className="rounded-2xl bg-red-600 px-6 py-3 font-black text-white hover:bg-red-500"
        >
          Lưu phim riêng
        </button>
      </div>
    </section>
  );
}