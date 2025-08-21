// nyaa_scraper.ts (Browser-only, strongly typed and null-safe)

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

export async function getMetadata(html: string): Promise<NyaaMetadata> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const releaseNameEl = doc.querySelector("h3.title");
  const magnetEl = doc.querySelector("a[href^='magnet:?']");
  const categoryEl = doc.querySelector("a.category");
  const dateEl = doc.querySelector("time");
  const submitterEl = doc.querySelector("a.username");
  const seedersEl = doc.querySelector(".seeders");
  const leechersEl = doc.querySelector(".leechers");
  const fileSizeEl = doc.querySelector(".filesize");
  const completedEl = doc.querySelector(".completed");
  const fileTreeUl = doc.querySelector(".filetree > ul");

  const files: NyaaEntry[] | null = fileTreeUl ? await formatFiles(fileTreeUl) : null;

  return {
    "release name": releaseNameEl?.textContent?.trim() || null,
    magnet: magnetEl?.getAttribute("href") || null,
    category: categoryEl?.textContent?.trim() || null,
    date: dateEl?.getAttribute("datetime") || null,
    submitter: submitterEl?.textContent?.trim() || null,
    seeders: seedersEl?.textContent?.trim() || null,
    leechers: leechersEl?.textContent?.trim() || null,
    "file size": fileSizeEl?.textContent?.trim() || null,
    completed: completedEl?.textContent?.trim() || null,
    files,
  };
}

async function formatFiles(ulEl: Element): Promise<NyaaEntry[] | null> {
  if (!ulEl) return null;
  const results: NyaaEntry[] = [];
  const children = Array.from(ulEl.querySelectorAll(":scope > li"));

  for (const li of children) {
    const folderLink = li.querySelector("a.folder");
    const fileLink = li.querySelector("a:not(.folder)");
    const nestedUl = li.querySelector(":scope > ul");

    if (folderLink) {
      // Folder
      const folderName = folderLink.textContent?.trim() || null;
      const folderContents: NyaaEntry[] | null = nestedUl ? await formatFiles(nestedUl) : null;
      results.push({
        type: "folder",
        name: folderName,
        contents: folderContents,
      });
    } else if (fileLink) {
      // File
      const fileName = fileLink.textContent?.trim() || null;
      const sizeEl = li.querySelector(".file-size");
      const size = sizeEl?.textContent?.trim() || null;
      results.push({
        type: "file",
        name: fileName,
        size,
      });
    }
  }

  return results.length > 0 ? results : null;
}

// ----------------------
// Browser test example with webextension-polyfill
import browser from "webextension-polyfill";

(async () => {
  const response = await browser.runtime.sendMessage({
    url: "https://nyaa.si/view/1992716",
  });

  if (response.html) {
    const data = await getMetadata(response.html);
    console.log(data);
  } else {
    console.error("Failed to fetch:", response.error);
  }
})();
