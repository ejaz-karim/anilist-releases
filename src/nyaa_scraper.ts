// nyaa_scraper.ts

export type NyaaFile = {
  type: "file";
  name?: string | null;
  size?: string | null;
};

export type NyaaFolder = {
  type: "folder";
  name?: string | null;
  contents?: NyaaEntry[] | null;
};

export type NyaaEntry = NyaaFile | NyaaFolder;

export type NyaaMetadata = {
  "release name"?: string | null;
  magnet?: string | null;
  category?: string | null;
  date?: string | null;
  submitter?: string | null;
  seeders?: string | null;
  leechers?: string | null;
  "file size"?: string | null;
  completed?: string | null;
  files?: NyaaEntry[] | null;
};

export class NyaaScraper {
  async getMetadata(url: string): Promise<NyaaMetadata | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch page");
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const magnet = doc.querySelector("div.panel-footer.clearfix a[href^='magnet']")?.getAttribute("href");
      if (!magnet) return null;

      const title = doc.querySelector("title")?.textContent?.replace(":: Nyaa", "").trim() ?? null;
      const metadata: NyaaMetadata = {
        "release name": title,
        magnet,
      };

      // Parse metadata rows
      const rows = Array.from(doc.querySelectorAll("div.panel-body .row"))
        .flatMap((row) =>
          row.textContent?.trim().split("\n").map((t) => t.trim()).filter(Boolean) ?? []
        );

      for (let i = 0; i < rows.length; i++) {
        const key = rows[i];
        const value = rows[i + 1] || null;
        switch (key) {
          case "Category:":
            metadata.category = value;
            break;
          case "Date:":
            metadata.date = value;
            break;
          case "Submitter:":
            metadata.submitter = value;
            break;
          case "Seeders:":
            metadata.seeders = value;
            break;
          case "Leechers:":
            metadata.leechers = value;
            break;
          case "File size:":
            metadata["file size"] = value;
            break;
          case "Completed:":
            metadata.completed = value;
            break;
        }
      }

      const filesDiv = doc.querySelector("div.torrent-file-list.panel-body");
      metadata.files = filesDiv ? this.formatFiles(filesDiv) : [];

      return metadata;
    } catch (err) {
      console.error("Error scraping Nyaa:", err);
      return null;
    }
  }

  private formatFiles(element: Element): NyaaEntry[] {
    const results: NyaaEntry[] = [];

    const ul = element.tagName === "DIV" ? element.querySelector("ul") : element;
    if (!ul) return results;

    const liElements = Array.from(ul.children).filter((el) => el.tagName === "LI");

    for (const li of liElements) {
      const folderLink = li.querySelector("a.folder");
      if (folderLink) {
        const name = folderLink.textContent?.trim() || null;
        const nestedUl = li.querySelector(":scope > ul");
        const contents = nestedUl ? this.formatFiles(nestedUl) : [];
        results.push({ type: "folder", name, contents });
        continue;
      }

      const fileIcon = li.querySelector("i.fa-file");
      if (fileIcon) {
        const size = li.querySelector(".file-size")?.textContent?.trim() || null;
        // Sometimes file name is text right after the icon
        const nameNode = fileIcon.nextSibling;
        const name = nameNode && nameNode.nodeType === Node.TEXT_NODE ? nameNode.textContent?.trim() : null;
        results.push({ type: "file", name, size });
      }
    }

    return results;
  }
}
