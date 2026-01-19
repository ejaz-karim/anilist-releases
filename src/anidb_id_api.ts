import { NyaaScraper, NyaaMetadata } from "./nyaa_scraper";

export interface Episode {
    episode: string;
    anidb_episode_id: string;
    title: string;
}

export interface AnidbIdResult {
    anidb_id: string;
    episodes: Episode[];
}

// Helper to parse episode data from API response
function parseEpisodes(episodesData: Record<string, { episode: string; anidbEid: string; title?: { en?: string } }>): Episode[] {
    return Object.values(episodesData).map((ep) => ({
        episode: ep.episode,
        anidb_episode_id: ep.anidbEid,
        title: ep.title?.en || "",
    }));
}

export class AnidbIdApi {
    private static readonly API_URLS = [
        "https://api.ani.zip/mappings",
        "https://zenshin-supabase-api.onrender.com/mappings",
    ];

    async getAnidbId(anilistId: number): Promise<AnidbIdResult | null> {
        for (const baseUrl of AnidbIdApi.API_URLS) {
            try {
                const response = await fetch(`${baseUrl}?anilist_id=${anilistId}`);
                if (!response.ok) continue;

                const data = await response.json();
                const anidbId = data.mappings?.anidb_id;
                if (!anidbId) continue;

                return {
                    anidb_id: anidbId,
                    episodes: parseEpisodes(data.episodes || {}),
                };
            } catch {
                continue;
            }
        }
        return null;
    }

    async *streamAnimetoshoMetadata(
        anidbId: string | null = null,
        anidbEpisodeId: string | null = null,
        abortSignal?: AbortSignal
    ): AsyncGenerator<NyaaMetadata, void, unknown> {
        if (!anidbId && !anidbEpisodeId) {
            throw new Error("Missing anidb id or anidb episode id");
        }
        if (anidbId && anidbEpisodeId) {
            throw new Error("Not allowed to parse both anidb id and anidb episode id at the same time");
        }

        let url: string;
        if (anidbId) {
            url = `https://feed.animetosho.org/json?aid=${anidbId}`;
        } else {
            url = `https://feed.animetosho.org/json?eid=${anidbEpisodeId}`;
        }

        const response = await fetch(url, { signal: abortSignal });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        const scraper = new NyaaScraper();

        for (const entry of data) {
            if (abortSignal?.aborted) {
                return;
            }

            const infoHash = entry.info_hash;
            if (infoHash === null || infoHash === undefined) {
                continue;
            }

            const nyaaUrl = `https://nyaa.si/?q=${infoHash}`;
            const nyaaMetadata = await scraper.getMetadata(nyaaUrl);

            if (nyaaMetadata === null) {
                continue;
            }

            if (parseInt(nyaaMetadata.seeders || "0") > 0) {
                nyaaMetadata.url = nyaaUrl;
                yield nyaaMetadata;
            }
        }
    }

    async *streamNyaaAnidbEpisodeMetadata(
        anilistId: number,
        episode: number | string,
        abortSignal?: AbortSignal
    ): AsyncGenerator<NyaaMetadata, void, unknown> {
        const dict = await this.getAnidbId(anilistId);
        if (!dict) {
            return;
        }

        for (const i of dict.episodes) {
            if (i.episode === String(episode)) {
                const anidbEpisodeId = i.anidb_episode_id;
                yield* this.streamAnimetoshoMetadata(null, anidbEpisodeId, abortSignal);
                return;
            }
        }
    }
}
