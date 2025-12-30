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
    "release name": string;
    "magnet": string;
    "url"?: string;
    "category"?: string;
    "date"?: string;
    "submitter"?: string;
    "seeders"?: string;
    "leechers"?: string;
    "file size"?: string;
    "completed"?: string;
    "files": NyaaFileEntry[];
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

            metadata["release name"] = releaseName;
            metadata["magnet"] = magnet;

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
                switch (element) {
                    case "Category:":
                        if (i + 1 < rowsList.length) {
                            metadata["category"] = rowsList[i + 1];
                        }
                        break;
                    case "Date:":
                        if (i + 1 < rowsList.length) {
                            metadata["date"] = rowsList[i + 1];
                        }
                        break;
                    case "Submitter:":
                        if (i + 1 < rowsList.length) {
                            metadata["submitter"] = rowsList[i + 1];
                        }
                        break;
                    case "Seeders:":
                        if (i + 1 < rowsList.length) {
                            metadata["seeders"] = rowsList[i + 1];
                        }
                        break;
                    case "Leechers:":
                        if (i + 1 < rowsList.length) {
                            metadata["leechers"] = rowsList[i + 1];
                        }
                        break;
                    case "File size:":
                        if (i + 1 < rowsList.length) {
                            metadata["file size"] = rowsList[i + 1];
                        }
                        break;
                    case "Completed:":
                        if (i + 1 < rowsList.length) {
                            metadata["completed"] = rowsList[i + 1];
                        }
                        break;
                }
            }

            const filesDiv = soup.querySelector("div.torrent-file-list.panel-body");
            metadata["files"] = filesDiv ? this.formatFiles(filesDiv) : [];

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
