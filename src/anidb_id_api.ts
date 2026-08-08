import { NyaaScraper, NyaaMetadata } from "./nyaa_scraper";
import { SeadexApi } from "./seadex_api";

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

// Convert animetosho unix timestamp (seconds) to nyaa display format "YYYY-MM-DD HH:mm UTC"
function formatCachedDate(unixSeconds: number | null | undefined): string {
    if (!unixSeconds) return "";
    const d = new Date(unixSeconds * 1000);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export class AnidbIdApi {
    private static readonly API_URLS = [
        "https://api.ani.zip/mappings",
        "https://zenshin-supabase-api.onrender.com/mappings",
    ];

    private static readonly ANIMETOSHO_BASE = "https://feed.animetosho.xyz";
    private static readonly PAGE_LIMIT = 200;
    private static readonly seadex = new SeadexApi();

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
        abortSignal?: AbortSignal,
        useCache: boolean = false,
        onlyFullReleases: boolean = true,
    ): AsyncGenerator<NyaaMetadata, void, unknown> {
        if (!anidbId && !anidbEpisodeId) {
            throw new Error("Missing anidb id or anidb episode id");
        }
        if (anidbId && anidbEpisodeId) {
            throw new Error("Not allowed to parse both anidb id and anidb episode id at the same time");
        }

        let url: string;
        if (anidbId) {
            url = `${AnidbIdApi.ANIMETOSHO_BASE}/feed/json?aid=${anidbId}`;
        } else {
            url = `${AnidbIdApi.ANIMETOSHO_BASE}/feed/json?eid=${anidbEpisodeId}`;
        }

        const scraper = new NyaaScraper();
        let page = 1;

        // Full-release searches (aid) should only return full releases, which are
        // identified by a null anidb_eid. Hoist the condition out of the hot loop.
        const filterFullReleases = anidbId !== null && onlyFullReleases;

        // Paginate. The new API returns a plain array with no total count, so
        // keep requesting pages until one returns fewer than PAGE_LIMIT results.
        while (true) {
            if (abortSignal?.aborted) {
                return;
            }

            const response = await fetch(
                `${url}&limit=${AnidbIdApi.PAGE_LIMIT}&page=${page}`,
                { signal: abortSignal }
            );
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const releases = await response.json();

            for (const entry of releases) {
                if (abortSignal?.aborted) {
                    return;
                }

                // Skip episodic entries when filtering for full releases.
                if (filterFullReleases && entry.anidb_eid !== null) {
                    continue;
                }

                if (useCache) {
                    const metadata = AnidbIdApi.buildCachedMetadata(entry);
                    if (metadata === null) continue;
                    if (parseInt(metadata.seeders || "0") <= 0) continue;
                    yield metadata;
                } else {
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

            // Stop when the last page returned fewer results than the page limit
            // (or was empty), meaning there are no more releases to fetch.
            if (releases.length < AnidbIdApi.PAGE_LIMIT) {
                return;
            }
            page++;
        }
    }

    /**
     * Build a NyaaMetadata object from an animetosho release entry (cached mode).
     * Source-agnostic: works for nyaa, nekobt, tokyotosho, and any future source.
     * Returns null if critical fields (info_hash, magnet_uri, article_url) are missing.
     */
    private static buildCachedMetadata(entry: any): NyaaMetadata | null {
        const infoHash = entry?.info_hash;
        const magnet = entry?.magnet_uri;
        const sourceUrl = entry?.article_url;

        // Critical fields — skip release if any missing
        if (!infoHash || !magnet || !sourceUrl) {
            return null;
        }

        const sizeBytes = entry.total_size ?? 0;
        const seeders = entry.seeders ?? 0;
        const leechers = entry.leechers ?? 0;
        const downloads = entry.torrent_downloaded_count ?? 0;

        return {
            releaseName: entry.title || "N/A (Cached)",
            magnet: magnet,
            url: sourceUrl,
            category: "N/A (Cached)",
            date: formatCachedDate(entry.timestamp) || "N/A (Cached)",
            submitter: "N/A (Cached)",
            seeders: String(seeders),
            leechers: String(leechers),
            fileSize: AnidbIdApi.seadex.formatFileSize(sizeBytes) || "N/A (Cached)",
            completed: String(downloads),
            files: [],
            cached: true,
        };
    }

    async *streamEpisodeMetadata(
        anilistId: number,
        episode: number | string,
        abortSignal?: AbortSignal,
        useCache: boolean = false,
    ): AsyncGenerator<NyaaMetadata, void, unknown> {
        const dict = await this.getAnidbId(anilistId);
        if (!dict) {
            return;
        }

        for (const i of dict.episodes) {
            if (i.episode === String(episode)) {
                const anidbEpisodeId = i.anidb_episode_id;
                yield* this.streamAnimetoshoMetadata(null, anidbEpisodeId, abortSignal, useCache);
                return;
            }
        }
    }
}
