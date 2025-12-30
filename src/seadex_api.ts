export interface EpisodeEntry {
    name: string;
    size: string;
}

export interface ReleaseEntry {
    "tracker": string;
    "release group": string;
    "url": string;
    "dual audio": boolean;
    "is best": boolean;
    "private tracker": boolean;
    "file size": string;
    "episode list": EpisodeEntry[];
}

export interface ReleaseData {
    "comparison": string;
    "notes": string;
    "theoretical best": string;
    "releases": ReleaseEntry[];
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
            "comparison": comparison,
            "notes": notes,
            "theoretical best": theoreticalBest,
            "releases": [],
        };

        const trs = item.expand?.trs || [];

        for (const entry of trs) {
            const tracker = entry.tracker || "";
            const releaseGroup = entry.releaseGroup || "";
            const url = entry.url || "";
            const dualAudio = entry.dualAudio || false;
            const isBest = entry.isBest || false;

            const files = entry.files || [];
            let totalFileSize = 0;

            const episodeList: EpisodeEntry[] = [];

            for (const file of files) {
                const name = file.name || "";
                const fileSizeFormat = this.formatFileSize(file.length || 0);
                totalFileSize += file.length || 0;

                episodeList.push({ name: name, size: fileSizeFormat });
            }

            const totalFileSizeFormat = this.formatFileSize(totalFileSize);

            const privateTracker = entry.infoHash === "<redacted>";

            const entryDict: ReleaseEntry = {
                "tracker": tracker,
                "release group": releaseGroup,
                "url": url,
                "dual audio": dualAudio,
                "is best": isBest,
                "private tracker": privateTracker,
                "file size": totalFileSizeFormat,
                "episode list": episodeList,
            };

            releaseDict["releases"].push(entryDict);
        }

        return releaseDict;
    }

    formatFileSize(bytes: number): string {
        const megabytes = bytes / (1024 ** 2);
        const gigabytes = bytes / (1024 ** 3);

        if (gigabytes >= 1) {
            return `${gigabytes.toFixed(1)} GiB`;
        } else {
            return `${megabytes.toFixed(1)} MiB`;
        }
    }
}
