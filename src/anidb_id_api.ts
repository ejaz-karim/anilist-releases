// anidb_id_api.ts
import { NyaaScraper, NyaaMetadata } from "./nyaa_scraper";

export type AniEpisode = {
  episode: string;
  anidb_episode_id: string;
  title: string;
};

export type AniDbResult = {
  anidb_id: string;
  episodes: AniEpisode[];
};

export class AnidbIdApi {
  private async fetchMapping(url: string): Promise<AniDbResult | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();

      const anidb_id = data?.mappings?.anidb_id;
      const episodesData = data?.episodes;
      if (!anidb_id || !episodesData) return null;

      const episodes: AniEpisode[] = Object.values(episodesData).map((ep: any) => ({
        episode: ep?.episode,
        anidb_episode_id: ep?.anidbEid,
        title: ep?.title?.en || "",
      }));

      return { anidb_id, episodes };
    } catch {
      return null;
    }
  }

  async getAnidbId(anilist_id: number): Promise<AniDbResult | null> {
    const aniZipUrl = `https://api.ani.zip/mappings?anilist_id=${anilist_id}`;
    const zenshinUrl = `https://zenshin-supabase-api.onrender.com/mappings?anilist_id=${anilist_id}`;

    const result1 = await this.fetchMapping(aniZipUrl);
    if (result1) return result1;

    const result2 = await this.fetchMapping(zenshinUrl);
    if (result2) return result2;

    return null;
  }

  async getAnimetoshoMetadata(
    anidb_id?: string,
    anidb_episode_id?: string
  ): Promise<NyaaMetadata[] | null> {
    if (!anidb_id && !anidb_episode_id)
      throw new Error("Missing anidb id or anidb episode id");
    if (anidb_id && anidb_episode_id)
      throw new Error("Cannot parse both anidb id and anidb episode id at once");

    const url = anidb_episode_id
      ? `https://feed.animetosho.org/json?eid=${anidb_episode_id}`
      : `https://feed.animetosho.org/json?aid=${anidb_id}`;

    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;

    const scraper = new NyaaScraper();
    const results: NyaaMetadata[] = [];

    for (const entry of data) {
      const infoHash = entry?.info_hash;
      if (!infoHash) continue;

      const nyaaUrl = `https://nyaa.si/?q=${infoHash}`;
      const nyaaMetadata = await scraper.getMetadata(nyaaUrl);

      if (nyaaMetadata && parseInt(nyaaMetadata.seeders || "0") > 0) {
        results.push(nyaaMetadata);
      }
    }

    const sorted = results.sort(
      (a, b) => parseInt(b.seeders || "0") - parseInt(a.seeders || "0")
    );

    return sorted.length > 0 ? sorted : null;
  }

  async getNyaaAnidbEpisode(
    anilist_id: number,
    episode: string
  ): Promise<NyaaMetadata[] | null> {
    const mapping = await this.getAnidbId(anilist_id);
    if (!mapping) return null;

    const match = mapping.episodes.find((ep) => ep.episode === String(episode));
    if (!match) return null;

    return this.getAnimetoshoMetadata(undefined, match.anidb_episode_id);
  }
}
