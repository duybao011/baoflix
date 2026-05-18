export type ActorWork = {
  title: string;
  year?: number;
  keywords: string[];
};

export type ActorProfile = {
  slug: string;
  name: string;
  koreanName?: string;
  aliases: string[];
  description: string;
  works: ActorWork[];
};

export const actors: ActorProfile[] = [
  {
    slug: "go-yoon-jung",
    name: "Go Yoon Jung",
    koreanName: "고윤정",
    aliases: ["Go Youn-jung", "Go Youn Jung", "Go Yoon Jeong"],
    description:
      "Diễn viên Hàn Quốc. Trang này dùng tìm kiếm theo tên tác phẩm, không dùng slug đoán tay.",
    works: [
      {
        title: "Moving",
        year: 2023,
        keywords: ["Moving", "Đội Thiếu Niên Siêu Đẳng"],
      },
      {
        title: "Alchemy of Souls",
        year: 2022,
        keywords: ["Alchemy of Souls", "Hoàn Hồn"],
      },
      {
        title: "Death's Game",
        year: 2023,
        keywords: ["Death's Game", "Trò Chơi Tử Thần"],
      },
      {
        title: "Law School",
        year: 2021,
        keywords: ["Law School", "Trường Luật"],
      },
      {
        title: "Sweet Home",
        year: 2020,
        keywords: ["Sweet Home", "Thế Giới Ma Quái"],
      },
      {
        title: "Hunt",
        year: 2022,
        keywords: ["Hunt", "Săn Lùng"],
      },
    ],
  },
  {
    slug: "lee-jae-in",
    name: "Lee Jae In",
    koreanName: "이재인",
    aliases: ["Lee Jae-in"],
    description:
      "Diễn viên Hàn Quốc. Trang này dùng tìm kiếm theo tên tác phẩm, không dùng slug đoán tay.",
    works: [
      {
        title: "Night Has Come",
        year: 2023,
        keywords: ["Night Has Come", "Đêm Đã Đến"],
      },
      {
        title: "Hierarchy",
        year: 2024,
        keywords: ["Hierarchy", "Thứ Bậc"],
      },
      {
        title: "Racket Boys",
        year: 2021,
        keywords: ["Racket Boys", "Đội Cầu Lông Thiếu Niên"],
      },
      {
        title: "Svaha: The Sixth Finger",
        year: 2019,
        keywords: ["Svaha", "The Sixth Finger", "Ngón Tay Thứ Sáu"],
      },
      {
        title: "Concrete Utopia",
        year: 2023,
        keywords: ["Concrete Utopia", "Địa Đàng Sụp Đổ"],
      },
    ],
  },
];

export function getActorBySlug(slug: string) {
  return actors.find((actor) => actor.slug === slug);
}