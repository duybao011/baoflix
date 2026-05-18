export const localCastBySlug: Record<string, string[]> = {
  // Ví dụ:
  // "moving": ["Go Yoon Jung", "Ryu Seung Ryong", "Han Hyo Joo", "Zo In Sung"],
  // "night-has-come": ["Lee Jae In", "Kim Woo Seok", "Choi Ye Bin", "Cha Woo Min"],
};

export function getLocalCast(slug: string) {
  return localCastBySlug[slug] || [];
}