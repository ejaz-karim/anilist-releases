export type FileEntry = {
    name?: string | null;
    length?: number | null;
};

export type TRSEntry = {
    tracker?: string | null;
    releaseGroup?: string | null;
    url?: string | null;
    dualAudio?: boolean | null;
    isBest?: boolean | null;
    infoHash?: string | null;
    files?: FileEntry[] | null;
};

export type ReleaseData = {
    comparison?: string | null;
    notes?: string | null;
    "theoretical best"?: string | null;
    releases: {
        tracker?: string | null;
        "release group"?: string | null;
        url?: string | null;
        "dual audio"?: boolean | null;
        "is best"?: boolean | null;
        "private tracker"?: boolean | null;
        "file size"?: string | null;
        "episode list"?: {
            name?: string | null;
            size?: string | null;
        }[];
    }[];
};

export class SeadexApi {
    private formatFileSize(bytes: number | null | undefined): string {
        if (bytes == null || isNaN(bytes)) {
            return "Unknown size";
        }

        const megabytes = bytes / (1024 ** 2);
        const gigabytes = bytes / (1024 ** 3);

        if (gigabytes >= 1) {
            return `${gigabytes.toFixed(1)} GiB`;
        } else {
            return `${megabytes.toFixed(1)} MiB`;
        }
    }

    async getReleaseData(anilistId: number): Promise<ReleaseData | null> {
        const baseUrl = "https://releases.moe/api/collections/entries/records";
        const trsUrl = `${baseUrl}?filter=alID=${anilistId}&expand=trs`;

        const response = await fetch(trsUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const items = data?.items?.[0] || null;
        if (!items) return null;

        const releaseDict: ReleaseData = {
            comparison: items.comparison ?? null,
            notes: items.notes ?? null,
            "theoretical best": items.theoreticalBest ?? null,
            releases: []
        };

        const trs = items.expand?.trs || [];
        for (const entry of trs as TRSEntry[]) {
            let totalFileSize = 0;

            const episodeList =
                entry.files?.map(file => {
                    const size = this.formatFileSize(file.length);
                    if (file.length) totalFileSize += file.length;
                    return {
                        name: file.name ?? "Unknown",
                        size
                    };
                }) ?? [];

            const totalFileSizeFormat = this.formatFileSize(totalFileSize);
            const privateTracker = entry.infoHash === "<redacted>";

            releaseDict.releases.push({
                tracker: entry.tracker ?? "Unknown",
                "release group": entry.releaseGroup ?? "Unknown",
                url: entry.url ?? "",
                "dual audio": entry.dualAudio ?? false,
                "is best": entry.isBest ?? false,
                "private tracker": privateTracker,
                "file size": totalFileSizeFormat,
                "episode list": episodeList
            });
        }

        return releaseDict;
    }
}

// const api = new SeadexApi();
// api.getReleaseData(104276)
//     .then(data => {
//         console.log(JSON.stringify(data, null, 2));
//     })
//     .catch(err => console.error(err));
