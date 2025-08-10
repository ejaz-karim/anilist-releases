
type FileEntry = {
    name: string;
    length: number;
};

type TRSEntry = {
    tracker: string;
    releaseGroup: string;
    url: string;
    dualAudio: boolean;
    isBest: boolean;
    infoHash: string;
    files: FileEntry[];
};

type ReleaseData = {
    comparison: string | null;
    notes: string | null;
    "theoretical best": string | null;
    releases: {
        tracker: string;
        "release group": string;
        url: string;
        "dual audio": boolean;
        "is best": boolean;
        "private tracker": boolean;
        "file size": string;
        "episode list": {
            name: string;
            size: string;
        }[];
    }[];
};

export class SeadexApi {
    private formatFileSize(bytes: number): string {
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
        let items = data?.items?.[0] || null;
        if (!items) return null;

        const releaseDict: ReleaseData = {
            comparison: items.comparison || null,
            notes: items.notes || null,
            "theoretical best": items.theoreticalBest || null,
            releases: []
        };

        const trs = items.expand?.trs || [];
        for (const entry of trs as TRSEntry[]) {
            let totalFileSize = 0;
            const episodeList = entry.files.map(file => {
                totalFileSize += file.length || 0;
                return {
                    name: file.name,
                    size: this.formatFileSize(file.length)
                };
            });

            const totalFileSizeFormat = this.formatFileSize(totalFileSize);
            const privateTracker = entry.infoHash === "<redacted>";

            releaseDict.releases.push({
                tracker: entry.tracker,
                "release group": entry.releaseGroup,
                url: entry.url,
                "dual audio": entry.dualAudio,
                "is best": entry.isBest,
                "private tracker": privateTracker,
                "file size": totalFileSizeFormat,
                "episode list": episodeList
            });
        }

        return releaseDict;
    }
}

const api = new SeadexApi();
api.getReleaseData(18897)
    .then(data => {
        console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => console.error(err));
