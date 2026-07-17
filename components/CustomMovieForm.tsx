"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomMovieFromForm,
  upsertCustomMovie,
} from "@/lib/customMoviesClient";
import { slugify } from "@/lib/slugify";

const CUSTOM_POSTER_DIR = "/custom-posters";

type CopyStatus = {
  key: string;
  label: string;
} | null;

function getPosterFileName(slug: string) {
  return `${slug || "ten-phim"}.jpg`;
}

function getThumbFileName(slug: string) {
  return `${slug || "ten-phim"}-thumb.jpg`;
}

function getPosterPath(slug: string) {
  return `${CUSTOM_POSTER_DIR}/${getPosterFileName(slug)}`;
}

function getThumbPath(slug: string) {
  return `${CUSTOM_POSTER_DIR}/${getThumbFileName(slug)}`;
}

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
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);

  const autoSlug = useMemo(() => slugify(name), [name]);
  const finalSlug = slug.trim() || autoSlug;
  const posterFileName = getPosterFileName(finalSlug);
  const thumbFileName = getThumbFileName(finalSlug);
  const posterPath = getPosterPath(finalSlug);
  const thumbPath = getThumbPath(finalSlug);

  async function copyText(value: string, key: string, label: string) {
    const text = value.trim();

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus({ key, label });

      window.setTimeout(() => {
        setCopyStatus((old) => (old?.key === key ? null : old));
      }, 1800);
    } catch {
      window.prompt("Copy thủ công đoạn này:", text);
    }
  }

  function useSlugPoster() {
    setPosterUrl(posterPath);
  }

  function useSlugPosterForBoth() {
    setPosterUrl(posterPath);
    setThumbUrl(posterPath);
  }

  function useSlugThumb() {
    setThumbUrl(thumbPath);
  }

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

        <section className="rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-yellow-200">
                Đổi tên poster theo slug
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-300">
                Đổi tên file poster trong <b>public/custom-posters</b> theo slug
                bên dưới, rồi bấm dùng đường dẫn. App web không thể tự đổi tên
                file trên máy, nhưng có thể copy tên file và tự điền URL cho fen.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Tên file poster
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-xl bg-black/35 px-3 py-2 text-sm font-bold text-yellow-200">
                  {posterFileName}
                </code>

                <button
                  type="button"
                  onClick={() => copyText(posterFileName, "poster-file", "Đã copy tên poster")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"
                >
                  {copyStatus?.key === "poster-file" ? copyStatus.label : "Copy"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Đường dẫn poster
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-xl bg-black/35 px-3 py-2 text-sm font-bold text-yellow-200">
                  {posterPath}
                </code>

                <button
                  type="button"
                  onClick={() => copyText(posterPath, "poster-path", "Đã copy URL")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"
                >
                  {copyStatus?.key === "poster-path" ? copyStatus.label : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useSlugPoster}
              className="rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black text-black hover:bg-yellow-200"
            >
              Dùng làm Poster URL
            </button>

            <button
              type="button"
              onClick={useSlugPosterForBoth}
              className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-4 py-3 text-sm font-black text-yellow-100 hover:bg-yellow-300/20"
            >
              Dùng poster cho cả ảnh ngang
            </button>

            <button
              type="button"
              onClick={() => copyText(finalSlug, "slug", "Đã copy slug")}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black hover:bg-white/10"
            >
              {copyStatus?.key === "slug" ? copyStatus.label : "Copy slug"}
            </button>
          </div>
        </section>

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

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useSlugThumb}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"
              >
                Dùng {thumbFileName}
              </button>

              <button
                type="button"
                onClick={() => copyText(thumbFileName, "thumb-file", "Đã copy tên ảnh ngang")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"
              >
                {copyStatus?.key === "thumb-file" ? copyStatus.label : "Copy tên ảnh ngang"}
              </button>
            </div>
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
Tập 01 | https://drive.google.com/file/d/video01/view | https://drive.google.com/file/d/sub01/view
Tập 02 | https://drive.google.com/file/d/video02/view | https://drive.google.com/file/d/sub02/view

# Mùa 2
Tập 01 | https://drive.google.com/file/d/video03/view | https://drive.google.com/file/d/sub03/view
Tập 02 | https://drive.google.com/file/d/video04/view`}
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
          />

          <span className="text-xs text-slate-400">
            Mỗi mùa bắt đầu bằng <b># Tên mùa</b>. Mỗi tập nhập dạng{" "}
            <b>Tên tập | Link video | Link phụ đề</b>. Phụ đề hỗ trợ link
            Drive chứa ASS, SRT hoặc VTT. Có thể bỏ trống cột phụ đề. Nếu chỉ
            dán link video, app tự đặt Tập 01, Tập 02...
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
