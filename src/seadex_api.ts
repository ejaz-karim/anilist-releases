export interface EpisodeEntry {
    name: string;
    size: string;
}

export interface ReleaseEntry {
    tracker: string;
    releaseGroup: string;
    url: string;
    dualAudio: boolean;
    isBest: boolean;
    privateTracker: boolean;
    fileSize: string;
    tags: string[];
    episodeList: EpisodeEntry[];
}

export interface ReleaseData {
    comparison: string;
    notes: string;
    theoreticalBest: string;
    releases: ReleaseEntry[];
}

export class SeadexApi {
    async getReleaseData(anilistId: number): Promise<ReleaseData | null> {
        const baseUrl = "https://releases.moe/api/collections/entries/records";
        const trsUrl = `${baseUrl}?filter=alID=${anilistId}&expand=trs`;

        const response = await fetch(trsUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        const items = data.items;
        const item = items && items[0] ? items[0] : null;

        if (!item) {
            return null;
        }

        const comparison = item.comparison || "";
        const notes = item.notes || "";
        const theoreticalBest = item.theoreticalBest || "";

        const releaseDict: ReleaseData = {
            comparison: comparison,
            notes: notes,
            theoreticalBest: theoreticalBest,
            releases: [],
        };

        const trs = item.expand?.trs || [];

        for (const entry of trs) {
            const tracker = entry.tracker || "";
            const releaseGroup = entry.releaseGroup || "";
            const url = entry.url || "";
            const dualAudio = entry.dualAudio || false;
            const isBest = entry.isBest || false;
            const tags = entry.tags || [];

            const files = entry.files || [];
            let totalFileSize = 0;

            const episodeList: EpisodeEntry[] = [];

            for (const file of files) {
                const name = file.name || "";
                const length = file.length || 0;
                totalFileSize += length;
                episodeList.push({ name: name, size: this.formatFileSize(length) });
            }

            const totalFileSizeFormat = this.formatFileSize(totalFileSize);
            const privateTracker = entry.infoHash === "<redacted>";

            const entryDict: ReleaseEntry = {
                tracker: tracker,
                releaseGroup: releaseGroup,
                url: url,
                dualAudio: dualAudio,
                isBest: isBest,
                privateTracker: privateTracker,
                tags: tags,
                fileSize: totalFileSizeFormat,
                episodeList: episodeList
            };

            releaseDict.releases.push(entryDict);
        }

        return releaseDict;
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 B";
        const units = ["B", "KiB", "MiB", "GiB", "TiB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        // Clamp to max unit
        const index = Math.min(i, units.length - 1);
        return `${(bytes / (1024 ** index)).toFixed(1)} ${units[index]}`;
    }
}
