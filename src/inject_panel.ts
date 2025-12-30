import type { ReleaseData, ReleaseEntry } from "./seadex_api";
import { AnidbIdApi, type Episode } from "./anidb_id_api";
import type { NyaaMetadata, NyaaFileEntry } from "./nyaa_scraper";

const PANEL_ID = "anilist-releases-panel";
const NYAA_PANEL_ID = "anilist-nyaa-panel";

let cachedEpisodes: Episode[] | null = null;
let cachedAnilistId: number | null = null;

// Anchor Finding
function findAnchor(): HTMLElement | null {
    const mediaRoot = document.querySelector<HTMLElement>(".page-content .media.media-anime");
    if (!mediaRoot) return null;

    const reviews = mediaRoot.querySelector(".reviews");
    if (reviews) {
        const wrap = reviews.closest<HTMLElement>(".grid-section-wrap");
        if (wrap) return wrap;
    }

    const threads = mediaRoot.querySelector(".threads");
    if (threads) {
        const wrap = threads.closest<HTMLElement>(".grid-section-wrap");
        if (wrap) return wrap;
    }

    return null;
}

function provisionalContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".page-content .media.media-anime");
}

function linkifyAndSplitComparison(text: string): string {
    const lines = text.split(/\n+/);
    const urlRegex = /(https?:\/\/[^\s,]+)/g;

    const out: string[] = [];
    for (const line of lines) {
        const urls = line.match(urlRegex);
        if (urls && urls.length > 1) {
            urls.forEach((u) => {
                out.push(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
            });
        } else {
            const replaced = line.replace(
                urlRegex,
                (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
            );
            out.push(replaced);
        }
    }
    return out.join("<br>");
}

// Seadex Injection
function placeSeadexPanel(panelContent: HTMLElement, anilistId: number): void {
    document.querySelectorAll(`#${PANEL_ID}`).forEach((n) => n.remove());

    const wrap = document.createElement("div");
    wrap.id = PANEL_ID;
    wrap.className = "grid-section-wrap";
    wrap.dataset.anilistId = String(anilistId);
    wrap.dataset.anchored = "false";

    const inner = document.createElement("div");
    inner.className = "section";
    inner.appendChild(panelContent);
    wrap.appendChild(inner);

    const anchor = findAnchor();
    if (anchor && anchor.parentElement) {
        anchor.insertAdjacentElement("afterend", wrap);
        wrap.dataset.anchored = "true";
    } else {
        const provisional = provisionalContainer();
        if (provisional) provisional.appendChild(wrap);
    }
}

// Placement Enforcement
export function ensureSeadexPanelPlacement(currentAniId: number | null): void {
    const panel = document.getElementById(PANEL_ID) as HTMLElement | null;
    if (!panel) return;

    if (currentAniId && panel.dataset.anilistId && panel.dataset.anilistId !== String(currentAniId)) {
        return;
    }

    const anchor = findAnchor();
    if (!anchor || !anchor.parentElement) return;

    if (panel.previousElementSibling === anchor) {
        panel.dataset.anchored = "true";
        return;
    }

    anchor.insertAdjacentElement("afterend", panel);
    panel.dataset.anchored = "true";
}

export function injectSeadexPanel(data: ReleaseData, anilistId: number): void {
    const container = document.createElement("div");

    const header = document.createElement("h2");
    header.textContent = "Seadex Releases";
    header.className = "section-header";
    container.appendChild(header);

    const contentWrap = document.createElement("div");
    contentWrap.className = "content-wrap list";
    contentWrap.style.display = "flex";
    contentWrap.style.flexWrap = "wrap";
    contentWrap.style.gap = "1rem";

    if (data.comparison || data.notes || data["theoretical best"]) {
        const meta = document.createElement("div");
        meta.className = "wrap entry";
        meta.style.padding = "1rem";
        meta.style.marginBottom = "1rem";
        meta.style.flex = "1 1 100%";

        if (data.comparison) {
            const cmp = document.createElement("div");
            cmp.innerHTML = `<strong>Comparison:</strong><br>${linkifyAndSplitComparison(data.comparison)}`;
            cmp.style.marginBottom = "0.75rem";
            meta.appendChild(cmp);
        }
        if (data.notes) {
            const notes = document.createElement("div");
            notes.innerHTML = `<strong>Notes:</strong> ${data.notes.replace(/\n/g, "<br>")}`;
            notes.style.marginBottom = "0.75rem";
            meta.appendChild(notes);
        }
        if (data["theoretical best"]) {
            const best = document.createElement("div");
            best.innerHTML = `<strong>Theoretical Best:</strong> ${data["theoretical best"]}`;
            meta.appendChild(best);
        }

        contentWrap.appendChild(meta);
    }

    data.releases.forEach((release: ReleaseEntry) => {
        const wrap = document.createElement("div");
        wrap.className = "wrap";
        wrap.style.flex = "1 1 300px";
        wrap.style.minWidth = "300px";
        wrap.style.maxWidth = "48%";

        const card = document.createElement("div");
        card.className = "entry";
        card.style.padding = "1rem";

        const allFlags: string[] = [];
        if (release["dual audio"]) allFlags.push("Dual Audio");
        if (release["is best"]) allFlags.push("Best Release");
        if (release["private tracker"]) allFlags.push("Private Tracker");

        const flagsLine = allFlags.length
            ? `<div style="color:#3fa9f5; margin-bottom:8px;">${allFlags.join(" • ")}</div>`
            : "";

        const rawUrl = release.url ?? "";

        card.innerHTML = `
            <div style="font-weight:600; margin-bottom:4px;">
                ${release["release group"] ?? ""}
            </div>
            <div>${release.tracker ?? ""}</div>
            <div><em>${release["file size"] ?? ""}</em></div>
            ${flagsLine}
        `;

        if (rawUrl) {
            const row = document.createElement("div");
            row.style.marginTop = "0.4rem";

            if (/^https?:\/\//i.test(rawUrl)) {
                const link = document.createElement("a");
                link.href = rawUrl;
                link.textContent = "Url";
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.className = "link";
                row.appendChild(link);
            } else {
                const copyBtn = document.createElement("a");
                copyBtn.textContent = "Copy";
                copyBtn.className = "link";
                copyBtn.href = "javascript:void(0)";
                copyBtn.addEventListener("click", async (ev) => {
                    ev.preventDefault();
                    try {
                        await navigator.clipboard.writeText(rawUrl);
                        const prev = copyBtn.textContent;
                        copyBtn.textContent = "Copied!";
                        setTimeout(() => {
                            copyBtn.textContent = prev;
                        }, 1000);
                    } catch {
                        window.prompt("Copy URL", rawUrl);
                    }
                });
                row.appendChild(copyBtn);
            }

            card.appendChild(row);
        }

        if (release["episode list"]?.length) {
            const toggle = document.createElement("a");
            toggle.textContent = "Show Episodes";
            toggle.className = "link";
            toggle.style.cssText = "display: block; margin-top: 0.75rem;";

            const epContainer = document.createElement("ul");
            epContainer.style.cssText = "display: none; margin-top: 0.5rem; padding-left: 1.2rem; font-size: 0.85em;";

            release["episode list"].forEach((ep) => {
                const li = document.createElement("li");
                li.style.cssText = "margin: 0.25rem 0;";
                li.textContent = `${ep.name ?? ""} — ${ep.size ?? ""}`;
                epContainer.appendChild(li);
            });

            toggle.addEventListener("click", () => {
                const isHidden = epContainer.style.display === "none";
                epContainer.style.display = isHidden ? "block" : "none";
                toggle.textContent = isHidden ? "Hide Episodes" : "Show Episodes";
            });

            card.appendChild(toggle);
            card.appendChild(epContainer);
        }

        wrap.appendChild(card);
        contentWrap.appendChild(wrap);
    });

    container.appendChild(contentWrap);
    placeSeadexPanel(container, anilistId);
}

// Nyaa Injection
function placeNyaaPanel(panel: HTMLElement, _anilistId: number): void {
    const seadexPanel = document.getElementById(PANEL_ID);
    if (seadexPanel && seadexPanel.parentElement) {
        panel.style.marginTop = "2rem";
        seadexPanel.insertAdjacentElement("afterend", panel);
        return;
    }

    const anchor = findAnchor();
    if (anchor && anchor.parentElement) {
        anchor.insertAdjacentElement("afterend", panel);
        return;
    }

    const provisional = provisionalContainer();
    if (provisional) {
        provisional.appendChild(panel);
    }
}

export function ensureNyaaPanelPlacement(currentAniId: number | null): void {
    const panel = document.getElementById(NYAA_PANEL_ID);
    if (!panel) return;

    if (currentAniId && panel.dataset.anilistId && panel.dataset.anilistId !== String(currentAniId)) {
        return;
    }

    const seadexPanel = document.getElementById(PANEL_ID);
    if (seadexPanel && seadexPanel.parentElement) {
        if (panel.previousElementSibling !== seadexPanel) {
            panel.style.marginTop = "2rem";
            seadexPanel.insertAdjacentElement("afterend", panel);
        }
        return;
    }

    const anchor = findAnchor();
    if (anchor && anchor.parentElement) {
        if (panel.previousElementSibling !== anchor) {
            anchor.insertAdjacentElement("afterend", panel);
        }
    }
}

// Episode Caching
async function loadEpisodeData(anilistId: number): Promise<Episode[]> {
    if (cachedEpisodes && cachedAnilistId === anilistId) {
        return cachedEpisodes;
    }

    const api = new AnidbIdApi();
    const result = await api.getAnidbId(anilistId);

    if (result && result.episodes) {
        const regularEpisodes = result.episodes.filter((ep) => {
            const epNum = parseInt(ep.episode, 10);
            return !isNaN(epNum) && epNum > 0;
        });

        regularEpisodes.sort((a, b) => parseInt(a.episode, 10) - parseInt(b.episode, 10));

        cachedEpisodes = regularEpisodes;
        cachedAnilistId = anilistId;
        return regularEpisodes;
    }

    cachedEpisodes = [];
    cachedAnilistId = anilistId;
    return [];
}

function populateEpisodeDropdown(select: HTMLSelectElement, episodes: Episode[]): void {
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Episode...";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    for (const ep of episodes) {
        const option = document.createElement("option");
        option.value = ep.episode;
        const title = ep.title ? ` - ${ep.title}` : "";
        option.textContent = `Episode ${ep.episode}${title}`;
        select.appendChild(option);
    }
}

export async function injectNyaaPanel(anilistId: number): Promise<void> {
    const existingPanel = document.getElementById(NYAA_PANEL_ID);
    if (existingPanel && existingPanel.dataset.anilistId !== String(anilistId)) {
        existingPanel.remove();
    }
    if (existingPanel) return;

    const panel = document.createElement("div");
    panel.id = NYAA_PANEL_ID;
    panel.className = "grid-section-wrap";
    panel.dataset.anilistId = String(anilistId);

    const section = document.createElement("div");
    section.className = "section";

    const header = document.createElement("h2");
    header.textContent = "Nyaa Releases";
    header.className = "section-header";
    section.appendChild(header);

    const content = document.createElement("div");
    content.className = "content-wrap";

    const controls = document.createElement("div");
    controls.style.cssText = "display: flex; gap: 1rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap;";

    const fullRadio = document.createElement("input");
    fullRadio.type = "radio";
    fullRadio.id = "nyaa-full-release";
    fullRadio.name = "nyaa-release-type";
    fullRadio.value = "full";
    fullRadio.checked = true;

    const fullLabel = document.createElement("label");
    fullLabel.htmlFor = "nyaa-full-release";
    fullLabel.textContent = "Full Release";
    fullLabel.style.cssText = "display: inline-flex; align-items: center; gap: 0.25rem;";

    const episodeRadio = document.createElement("input");
    episodeRadio.type = "radio";
    episodeRadio.id = "nyaa-episodic";
    episodeRadio.name = "nyaa-release-type";
    episodeRadio.value = "episodic";

    const episodeLabel = document.createElement("label");
    episodeLabel.htmlFor = "nyaa-episodic";
    episodeLabel.textContent = "Episodic";
    episodeLabel.style.cssText = "display: inline-flex; align-items: center; gap: 0.25rem;";

    const episodeSelect = document.createElement("select");
    episodeSelect.id = "nyaa-episode-select";
    episodeSelect.style.cssText = "padding: 0.25rem 0.5rem; display: none; min-width: 200px;";

    const searchBtn = document.createElement("button");
    searchBtn.id = "search-nyaa-btn";
    searchBtn.textContent = "Start Search";
    searchBtn.className = "button";
    searchBtn.style.cssText = "padding: 0.5rem 1rem; cursor: pointer;";

    const updateEpisodeSelectVisibility = async () => {
        if (episodeRadio.checked) {
            episodeSelect.style.display = "block";
            if (!cachedEpisodes || cachedAnilistId !== anilistId) {
                episodeSelect.innerHTML = "<option>Loading...</option>";
                const episodes = await loadEpisodeData(anilistId);
                populateEpisodeDropdown(episodeSelect, episodes);
            }
        } else {
            episodeSelect.style.display = "none";
        }
    };

    episodeRadio.addEventListener("change", updateEpisodeSelectVisibility);
    fullRadio.addEventListener("change", updateEpisodeSelectVisibility);

    searchBtn.addEventListener("click", () => handleNyaaSearch(anilistId));

    controls.appendChild(fullRadio);
    controls.appendChild(fullLabel);
    controls.appendChild(episodeRadio);
    controls.appendChild(episodeLabel);
    controls.appendChild(episodeSelect);
    controls.appendChild(searchBtn);

    content.appendChild(controls);

    const resultsArea = document.createElement("div");
    resultsArea.id = "nyaa-results";
    content.appendChild(resultsArea);

    section.appendChild(content);
    panel.appendChild(section);

    placeNyaaPanel(panel, anilistId);
}

async function handleNyaaSearch(anilistId: number): Promise<void> {
    const resultsArea = document.getElementById("nyaa-results");
    const searchBtn = document.getElementById("search-nyaa-btn") as HTMLButtonElement;
    if (!resultsArea || !searchBtn) return;

    searchBtn.disabled = true;
    searchBtn.textContent = "Searching...";

    const fullRelease =
        (document.querySelector('input[name="nyaa-release-type"]:checked') as HTMLInputElement)?.value === "full";
    const episodeSelect = document.getElementById("nyaa-episode-select") as HTMLSelectElement;
    const selectedEpisode = episodeSelect?.value;

    if (!fullRelease && !selectedEpisode) {
        resultsArea.innerHTML = '<p style="color: #ff6b6b; margin-top: 1rem;">Please select an episode</p>';
        searchBtn.disabled = false;
        searchBtn.textContent = "Start Search";
        return;
    }

    const statusText = document.createElement("p");
    statusText.style.marginTop = "1rem";
    statusText.textContent = "Searching Nyaa... Found 0 sources";
    resultsArea.innerHTML = "";
    resultsArea.appendChild(statusText);

    const updateProgress = (count: number) => {
        statusText.textContent = `Searching Nyaa... Found ${count} sources`;
    };

    try {
        const anidbApi = new AnidbIdApi();

        let results: NyaaMetadata[] | null;
        if (fullRelease) {
            const mapping = await anidbApi.getAnidbId(anilistId);
            if (!mapping) {
                resultsArea.innerHTML = '<p style="color: #ff6b6b; margin-top: 1rem;">Failed to get AniDB mapping</p>';
                return;
            }
            results = await anidbApi.getAnimetoshoMetadata(mapping.anidb_id, null, updateProgress);
        } else {
            results = await anidbApi.getNyaaAnidbEpisode(anilistId, selectedEpisode!, updateProgress);
        }

        if (!results || results.length === 0) {
            resultsArea.innerHTML = '<p style="margin-top: 1rem;">No releases found with active seeders</p>';
            return;
        }

        displayNyaaResults(results, resultsArea);
    } catch (error) {
        console.error("Nyaa search error:", error);
        resultsArea.innerHTML = '<p style="color: #ff6b6b; margin-top: 1rem;">Error searching Nyaa</p>';
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = "Start Search";
    }
}

function renderFileTree(entries: NyaaFileEntry[], depth: number = 0): HTMLUListElement {
    const ul = document.createElement("ul");
    ul.style.cssText = `padding-left: ${depth === 0 ? "1rem" : "1.5rem"}; margin: 0; list-style: none;`;

    for (const entry of entries) {
        const li = document.createElement("li");
        li.style.cssText = "margin: 0.25rem 0;";

        if (entry.type === "folder") {
            li.textContent = `📁 ${entry.name || "Unnamed Folder"}`;
            if (entry.contents && entry.contents.length > 0) {
                li.appendChild(renderFileTree(entry.contents, depth + 1));
            }
        } else {
            li.textContent = `📄 ${entry.name || "Unnamed File"}${entry.size ? ` (${entry.size})` : ""}`;
        }

        ul.appendChild(li);
    }

    return ul;
}

function displayNyaaResults(results: NyaaMetadata[], container: HTMLElement): void {
    const contentWrap = document.createElement("div");
    contentWrap.className = "content-wrap";
    contentWrap.style.cssText = "display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;";

    results.forEach((release) => {
        const wrap = document.createElement("div");
        wrap.className = "wrap";
        wrap.style.cssText = "flex: 1 1 300px; min-width: 300px; max-width: 48%;";

        const card = document.createElement("div");
        card.className = "entry";
        card.style.cssText = "padding: 1rem;";

        const title = document.createElement("div");
        title.style.cssText = "font-weight: 600; margin-bottom: 4px; color: #3fa9f5;";
        title.textContent = release["release name"] || "Unknown Release";
        card.appendChild(title);

        const meta = document.createElement("div");
        meta.style.cssText = "font-size: 0.9em; line-height: 1.4;";

        const seeders = document.createElement("div");
        seeders.textContent = `Seeders: ${release.seeders || "0"}`;

        const size = document.createElement("div");
        size.textContent = `Size: ${release["file size"] || "Unknown"}`;

        const submitter = document.createElement("div");
        submitter.textContent = `Submitter: ${release.submitter || "Unknown"}`;

        meta.appendChild(seeders);
        meta.appendChild(size);
        meta.appendChild(submitter);
        card.appendChild(meta);

        if (release.magnet || release.url) {
            const linksRow = document.createElement("div");
            linksRow.style.cssText = "margin-top: 0.75rem;";

            if (release.magnet) {
                const copyBtn = document.createElement("a");
                copyBtn.textContent = "Copy";
                copyBtn.className = "link";
                copyBtn.href = "javascript:void(0)";
                copyBtn.addEventListener("click", async (ev) => {
                    ev.preventDefault();
                    try {
                        await navigator.clipboard.writeText(release.magnet!);
                        const prev = copyBtn.textContent;
                        copyBtn.textContent = "Copied!";
                        setTimeout(() => {
                            copyBtn.textContent = prev;
                        }, 1000);
                    } catch {
                        window.prompt("Copy Magnet Link", release.magnet!);
                    }
                });
                linksRow.appendChild(copyBtn);
            }

            if (release.url) {
                const urlLink = document.createElement("a");
                urlLink.href = release.url;
                urlLink.textContent = "Url";
                urlLink.className = "link";
                urlLink.target = "_blank";
                urlLink.rel = "noopener noreferrer";
                urlLink.style.cssText = release.magnet ? "margin-left: 0.75rem;" : "";
                linksRow.appendChild(urlLink);
            }

            card.appendChild(linksRow);
        }

        if (release.files && release.files.length > 0) {
            const toggle = document.createElement("a");
            toggle.textContent = "Show Files";
            toggle.className = "link";
            toggle.style.cssText = "display: block; margin-top: 0.75rem;";

            const fileContainer = document.createElement("div");
            fileContainer.style.cssText = "display: none; margin-top: 0.5rem; font-size: 0.85em;";

            toggle.addEventListener("click", () => {
                const isHidden = fileContainer.style.display === "none";
                fileContainer.style.display = isHidden ? "block" : "none";
                toggle.textContent = isHidden ? "Hide Files" : "Show Files";
            });

            const fileTree = renderFileTree(release.files);
            fileContainer.appendChild(fileTree);

            card.appendChild(toggle);
            card.appendChild(fileContainer);
        }

        wrap.appendChild(card);
        contentWrap.appendChild(wrap);
    });

    container.innerHTML = "";
    container.appendChild(contentWrap);
}
