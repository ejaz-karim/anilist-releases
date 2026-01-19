import browser from "webextension-polyfill";

export interface FileItem {
    type: "file";
    name: string;
    size: string | null;
}

export interface FolderItem {
    type: "folder";
    name: string;
    contents: (FileItem | FolderItem)[];
}

export type NyaaFileEntry = FileItem | FolderItem;

export interface NyaaMetadata {
    releaseName: string;
    magnet: string;
    url?: string;
    category?: string;
    date?: string;
    submitter?: string;
    seeders?: string;
    leechers?: string;
    fileSize?: string;
    completed?: string;
    files: NyaaFileEntry[];
}

interface FetchResponse {
    ok: boolean;
    text: string | null;
}

// Bypasses CORS by delegating fetch to background script
async function backgroundFetch(url: string): Promise<FetchResponse> {
    try {
        const response = await browser.runtime.sendMessage({ type: "fetch", url });
        return response as FetchResponse || { ok: false, text: null };
    } catch (error) {
        console.error("[NyaaScraper] Message error:", error);
        return { ok: false, text: null };
    }
}

const METADATA_FIELDS: Record<string, keyof NyaaMetadata> = {
    "Category:": "category",
    "Date:": "date",
    "Submitter:": "submitter",
    "Seeders:": "seeders",
    "Leechers:": "leechers",
    "File size:": "fileSize",
    "Completed:": "completed",
};

export class NyaaScraper {
    async getMetadata(url: string): Promise<NyaaMetadata | null> {
        const metadata: Partial<NyaaMetadata> = {};

        try {
            const response = await backgroundFetch(url);
            if (!response.ok || !response.text) {
                return null;
            }
            const html = response.text;

            const parser = new DOMParser();
            const soup = parser.parseFromString(html, "text/html");

            const magnetElement = soup.querySelector("div.panel-footer.clearfix a[href^='magnet']");
            if (!magnetElement) {
                return null;
            }
            const magnet = magnetElement.getAttribute("href");
            if (!magnet) {
                return null;
            }

            const titleElement = soup.querySelector("title");
            const title = titleElement?.textContent || "";
            const releaseName = title.replace(":: Nyaa", "").trim();

            metadata.releaseName = releaseName;
            metadata.magnet = magnet;

            const rowsList: string[] = [];
            const rows = soup.querySelectorAll("div.panel-body .row");
            for (const row of rows) {
                const lines = (row.textContent || "").trim().split("\n");
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) {
                        rowsList.push(trimmed);
                    }
                }
            }



            for (let i = 0; i < rowsList.length; i++) {
                const element = rowsList[i];
                const key = METADATA_FIELDS[element];
                if (key && i + 1 < rowsList.length) {
                    // Type assertion needed because metadata is Partial<NyaaMetadata> 
                    // and values are strictly strings, but NyaaMetadata has non-string 'files'
                    (metadata as any)[key] = rowsList[i + 1];
                }
            }

            const filesDiv = soup.querySelector("div.torrent-file-list.panel-body");
            metadata.files = filesDiv ? this.formatFiles(filesDiv) : [];

            return metadata as NyaaMetadata;
        } catch {
            return null;
        }
    }

    formatFiles(files: Element): NyaaFileEntry[] {
        const items: NyaaFileEntry[] = [];

        let ul: Element | null = files;
        if (files.tagName === "DIV") {
            ul = files.querySelector("ul");
            if (!ul) {
                return items;
            }
        }

        const listItems = ul.querySelectorAll(":scope > li");
        for (const listItem of listItems) {
            const folder = listItem.querySelector("a.folder");
            if (folder) {
                const folderName = folder.textContent?.trim() || "";
                const nestedUl = listItem.querySelector("ul");
                const contents = nestedUl ? this.formatFiles(nestedUl) : [];
                items.push({
                    type: "folder",
                    name: folderName,
                    contents: contents,
                });
            } else {
                const fileIcon = listItem.querySelector("i.fa-file");
                const sizeSpan = listItem.querySelector("span.file-size");
                if (fileIcon) {
                    const nextSibling = fileIcon.nextSibling;
                    const fileName = nextSibling && nextSibling.nodeType === Node.TEXT_NODE
                        ? nextSibling.textContent?.trim() || ""
                        : "";
                    const fileSize = sizeSpan?.textContent?.trim() || null;
                    items.push({
                        type: "file",
                        name: fileName,
                        size: fileSize,
                    });
                }
            }
        }

        return items;
    }
}
