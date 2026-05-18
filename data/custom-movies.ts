export const customMovieResponses = [
  {
    movie: {
      _id: "custom-sabakan-uchuu-e-iku",
      name: "Sabakan, Uchuu e Iku",
      slug: "sabakan-uchuu-e-iku",
      origin_name: "Sabakan, Uchuu e Iku",
      poster_url:
        "https://placehold.co/600x900/070a12/ffffff?text=Sabakan%0AUchuu+e+Iku",
      thumb_url:
        "https://placehold.co/800x450/070a12/ffffff?text=Sabakan%2C+Uchuu+e+Iku",
      episode_current: "3 tập",
      episode_total: "3",
      quality: "HD",
      lang: "Phim riêng",
      type: "series",
      status: "ongoing",
      content:
        "Phim riêng do bạn tự thêm vào BảoFlix. Nguồn phát từ Google Drive.",
      category: [
        {
          name: "Phim riêng",
          slug: "phim-rieng",
        },
      ],
      country: [
        {
          name: "Nhật Bản",
          slug: "nhat-ban",
        },
      ],
      actor: ["Deguchi Natsuki"],
      director: [],
    },
    episodes: [
      {
        server_name: "Google Drive",
        server_data: [
          {
            name: "Tập 1",
            slug: "tap-1",
            filename: "Sabakan, Uchuu e Iku - Tập 1",
            link_embed:
              "https://drive.google.com/file/d/1rtqqqkAwSp3UxrH_u6k-YqtFf1Cck2AH/preview",
            link_m3u8: "",
          },
          {
            name: "Tập 2",
            slug: "tap-2",
            filename: "Sabakan, Uchuu e Iku - Tập 2",
            link_embed:
              "https://drive.google.com/file/d/1ltnUNeG0N9DED82RO_Tz55VBeSInu09P/preview",
            link_m3u8: "",
          },
          {
            name: "Tập 3",
            slug: "tap-3",
            filename: "Sabakan, Uchuu e Iku - Tập 3",
            link_embed:
              "https://drive.google.com/file/d/1vdT4oiCbGsliuWC3adlriuu9CG_Q2rHg/preview",
            link_m3u8: "",
          },
        ],
      },
    ],
  },
];

export function getCustomMovieBySlug(slug: string) {
  return customMovieResponses.find((item) => item.movie.slug === slug);
}

export function getCustomMovieItems() {
  return customMovieResponses.map((item) => item.movie);
}