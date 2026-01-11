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

export class AnidbIdApi {
    async getAnidbId(anilistId: number): Promise<AnidbIdResult | null> {
        // Try api.ani.zip first
        try {
            const apiAniUrl = `https://api.ani.zip/mappings?anilist_id=${anilistId}`;
            const apiAniResponse = await fetch(apiAniUrl);
            if (!apiAniResponse.ok) {
                throw new Error("Request failed");
            }
            const apiAniData = await apiAniResponse.json();

            const apiAniAnidbId = apiAniData.mappings?.anidb_id;
            const apiAniEpisodes = apiAniData.episodes;

            const result: AnidbIdResult = {
                anidb_id: apiAniAnidbId,
                episodes: [],
            };

            for (const key in apiAniEpisodes) {
                const i = apiAniEpisodes[key];
                const episode: Episode = {
                    episode: i.episode,
                    anidb_episode_id: i.anidbEid,
                    title: i.title?.en || "",
                };
                result.episodes.push(episode);
            }

            return result;
        } catch {
            // Fall through to try zenshin API
        }

        // Try zenshin API as fallback
        try {
            const zenshinApiUrl = `https://zenshin-supabase-api.onrender.com/mappings?anilist_id=${anilistId}`;
            const zenshinResponse = await fetch(zenshinApiUrl);
            if (!zenshinResponse.ok) {
                throw new Error("Request failed");
            }
            const zenshinData = await zenshinResponse.json();

            const zenshinAnidbId = zenshinData.mappings?.anidb_id;
            const zenshinEpisodes = zenshinData.episodes;

            const result: AnidbIdResult = {
                anidb_id: zenshinAnidbId,
                episodes: [],
            };

            for (const key in zenshinEpisodes) {
                const i = zenshinEpisodes[key];
                const episode: Episode = {
                    episode: i.episode,
                    anidb_episode_id: i.anidbEid,
                    title: i.title?.en || "",
                };
                result.episodes.push(episode);
            }

            return result;
        } catch {
            // Both APIs failed
        }

        return null;
    }

    async getAnimetoshoMetadata(
        anidbId: string | null = null,
        anidbEpisodeId: string | null = null,
        onProgress?: (count: number) => void
    ): Promise<NyaaMetadata[] | null> {
        if (!anidbId && !anidbEpisodeId) {
            throw new Error("Missing anidb id or anidb episode id");
        }
        if (anidbId && anidbEpisodeId) {
            throw new Error("Not allowed to parse both anidb id and anidb episode id at the same time");
        }

        const results: NyaaMetadata[] = [];

        let url: string;
        if (anidbId) {
            url = `https://feed.animetosho.org/json?aid=${anidbId}`;
        } else {
            url = `https://feed.animetosho.org/json?eid=${anidbEpisodeId}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        const scraper = new NyaaScraper();

        for (const entry of data) {
            const infoHash = entry.info_hash;

            if (infoHash !== null && infoHash !== undefined) {
                const nyaaUrl = `https://nyaa.si/?q=${infoHash}`;
                const nyaaMetadata = await scraper.getMetadata(nyaaUrl);

                if (nyaaMetadata === null) {
                    continue;
                } else if (parseInt(nyaaMetadata["seeders"] || "0") > 0) {
                    nyaaMetadata["url"] = nyaaUrl;
                    results.push(nyaaMetadata);
                    if (onProgress) {
                        onProgress(results.length);
                    }
                }
            } else {
                continue;
            }
        }

        const sortedResults = results.sort(
            (a, b) => parseInt(b["seeders"] || "0") - parseInt(a["seeders"] || "0")
        );

        if (sortedResults.length === 0) {
            return null;
        } else {
            return sortedResults;
        }
    }

    async getNyaaAnidbEpisode(
        anilistId: number,
        episode: number | string,
        onProgress?: (count: number) => void
    ): Promise<NyaaMetadata[] | null> {
        const dict = await this.getAnidbId(anilistId);
        if (!dict) {
            return null;
        }
        const episodes = dict.episodes;

        for (const i of episodes) {
            if (i.episode === String(episode)) {
                const anidbEpisodeId = i.anidb_episode_id;
                const metadata = await this.getAnimetoshoMetadata(null, anidbEpisodeId, onProgress);
                return metadata;
            }
        }
        return null;
    }


    async *iterateAnimetoshoMetadata(
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

            if (parseInt(nyaaMetadata["seeders"] || "0") > 0) {
                nyaaMetadata["url"] = nyaaUrl;
                yield nyaaMetadata;
            }
        }
    }

    async *iterateNyaaAnidbEpisode(
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
                yield* this.iterateAnimetoshoMetadata(null, anidbEpisodeId, abortSignal);
                return;
            }
        }
    }
}
