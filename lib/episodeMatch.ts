import type { Episode } from "@/lib/kkphim";

export type EpisodeMatchReason = "slug" | "name" | "number" | "fallback" | "none";
export type EpisodeMatch = { index: number; matched: boolean; reason: EpisodeMatchReason };
type EpisodeIdentity = Pick<Episode, "name" | "slug">;

export function normalizeEpisodeIdentity(value?: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getEpisodeNumber(value?: string) {
  const match = normalizeEpisodeIdentity(value).match(/\d+(?:\.\d+)?/);
  return match?.[0] || "";
}

export function findEpisodeMatch(
  currentEpisode: EpisodeIdentity | undefined,
  targetEpisodes: EpisodeIdentity[],
  fallbackIndex: number
): EpisodeMatch {
  if (!targetEpisodes.length) return { index: -1, matched: false, reason: "none" };

  const safeFallbackIndex = Math.min(
    Math.max(Number.isFinite(fallbackIndex) ? fallbackIndex : 0, 0),
    targetEpisodes.length - 1
  );

  if (!currentEpisode) {
    return { index: safeFallbackIndex, matched: false, reason: "fallback" };
  }

  const currentSlug = normalizeEpisodeIdentity(currentEpisode.slug);
  const currentName = normalizeEpisodeIdentity(currentEpisode.name);
  const currentNumber = getEpisodeNumber(currentEpisode.name || currentEpisode.slug);

  const bySlug = currentSlug
    ? targetEpisodes.findIndex((item) => normalizeEpisodeIdentity(item.slug) === currentSlug)
    : -1;
  if (bySlug >= 0) return { index: bySlug, matched: true, reason: "slug" };

  const byName = currentName
    ? targetEpisodes.findIndex((item) => normalizeEpisodeIdentity(item.name) === currentName)
    : -1;
  if (byName >= 0) return { index: byName, matched: true, reason: "name" };

  const byNumber = currentNumber
    ? targetEpisodes.findIndex((item) => getEpisodeNumber(item.name || item.slug) === currentNumber)
    : -1;
  if (byNumber >= 0) return { index: byNumber, matched: true, reason: "number" };

  return { index: safeFallbackIndex, matched: false, reason: "fallback" };
}

export function findMatchingEpisodeIndex(
  currentEpisode: EpisodeIdentity | undefined,
  targetEpisodes: EpisodeIdentity[],
  fallbackIndex: number
) {
  return findEpisodeMatch(currentEpisode, targetEpisodes, fallbackIndex).index;
}
