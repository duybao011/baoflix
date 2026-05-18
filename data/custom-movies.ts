export const customMovieResponses = [
  {
    movie: {
      _id: "custom-sabakan-uchuu-e-iku",
      name: "Cá thu đóng hộp, bay vào vũ trụ",
      slug: "sabakan-uchuu-e-iku",
      origin_name: "Sabakan, Uchuu e Iku",
      poster_url: "/custom-posters/ca-thu-dong-hop-bay-vao-vu-tru.jpg",
      thumb_url: "/custom-posters/ca-thu-dong-hop-bay-vao-vu-tru-thumb.jpg",
      episode_current: "3 tập",
      episode_total: "3",
      quality: "HD",
      lang: "Phim riêng",
      type: "series",
      status: "ongoing",
      content: `👧 Profile nhân vật của Natchan:
Cô nàng sẽ hóa thân thành Sugawara Nami (17 tuổi) - nữ sinh khóa đầu tiên của trường Trung học Thủy sản Wakasa. Nami mang nguồn năng lượng tươi sáng, bộc trực và luôn là chị đại tiên phong trong lớp.

Cuộc sống của cô nữ sinh 17 tuổi rẽ hướng khi hợp tác cùng người thầy Asano (Kitamura Takumi thủ vai) lao vào một dự án tưởng chừng điên rồ: Chế tạo cá thu đóng hộp thành... thức ăn vũ trụ!

Một cốt truyện thanh xuân nhiệt huyết được lấy cảm hứng từ câu chuyện có thật!`,
      category: [
        {
          name: "Phim riêng",
          slug: "phim-rieng",
        },
        {
          name: "Thanh xuân",
          slug: "thanh-xuan",
        },
        {
          name: "Chính kịch",
          slug: "chinh-kich",
        },
      ],
      country: [
        {
          name: "Nhật Bản",
          slug: "nhat-ban",
        },
      ],
      actor: ["Deguchi Natsuki", "Kitamura Takumi"],
      director: [],
    },
    episodes: [
      {
        server_name: "Google Drive",
        server_data: [
          {
            name: "Tập 1",
            slug: "tap-1",
            filename: "Cá thu đóng hộp, bay vào vũ trụ - Tập 1",
            link_embed:
              "https://drive.google.com/file/d/1rtqqqkAwSp3UxrH_u6k-YqtFf1Cck2AH/preview",
            link_m3u8: "",
          },
          {
            name: "Tập 2",
            slug: "tap-2",
            filename: "Cá thu đóng hộp, bay vào vũ trụ - Tập 2",
            link_embed:
              "https://drive.google.com/file/d/1ltnUNeG0N9DED82RO_Tz55VBeSInu09P/preview",
            link_m3u8: "",
          },
          {
            name: "Tập 3",
            slug: "tap-3",
            filename: "Cá thu đóng hộp, bay vào vũ trụ - Tập 3",
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