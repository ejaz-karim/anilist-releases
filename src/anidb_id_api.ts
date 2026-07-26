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

// Convert animetosho ISO 8601 date (already UTC) to nyaa display format "YYYY-MM-DD HH:mm UTC"
function formatCachedDate(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
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
    private static readonly PAGE_LIMIT = 100;
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
    ): AsyncGenerator<NyaaMetadata, void, unknown> {
        if (!anidbId && !anidbEpisodeId) {
            throw new Error("Missing anidb id or anidb episode id");
        }
        if (anidbId && anidbEpisodeId) {
            throw new Error("Not allowed to parse both anidb id and anidb episode id at the same time");
        }

        let url: string;
        if (anidbId) {
            url = `${AnidbIdApi.ANIMETOSHO_BASE}/json/v1/series/anidb/${anidbId}`;
        } else {
            url = `${AnidbIdApi.ANIMETOSHO_BASE}/json/v1/episodes/${anidbEpisodeId}`;
        }

        const scraper = new NyaaScraper();
        let offset = 0;

        // Paginate
        while (true) {
            if (abortSignal?.aborted) {
                return;
            }

            const response = await fetch(
                `${url}?limit=${AnidbIdApi.PAGE_LIMIT}&offset=${offset}`,
                { signal: abortSignal }
            );
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();

            const releases = data?.data?.releases ?? [];
            const meta = data?.meta ?? { count: 0, limit: AnidbIdApi.PAGE_LIMIT, offset, total: 0 };

            for (const entry of releases) {
                if (abortSignal?.aborted) {
                    return;
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

            offset += meta.count ?? 0;
            if (meta.count === 0 || offset >= (meta.total ?? 0)) {
                return;
            }
        }
    }

    /**
     * Build a NyaaMetadata object from an animetosho release entry (cached mode).
     * Source-agnostic: works for nyaa, nekobt, tokyotosho, and any future source.
     * Returns null if critical fields (info_hash, magnet, urls.source) are missing.
     */
    private static buildCachedMetadata(entry: any): NyaaMetadata | null {
        const infoHash = entry?.info_hash;
        const magnet = entry?.magnet;
        const sourceUrl = entry?.urls?.source;

        // Critical fields — skip release if any missing
        if (!infoHash || !magnet || !sourceUrl) {
            return null;
        }

        const sizeBytes = entry.size_bytes ?? 0;
        const seeders = entry.seeders ?? 0;
        const leechers = entry.leechers ?? 0;
        const downloads = entry.downloads ?? 0;

        return {
            releaseName: entry.title || "N/A (Cached)",
            magnet: magnet,
            url: sourceUrl,
            category: "N/A (Cached)",
            date: formatCachedDate(entry.date_added) || "N/A (Cached)",
            submitter: entry.release_group || "N/A (Cached)",
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
