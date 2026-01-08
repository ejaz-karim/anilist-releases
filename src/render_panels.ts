import type { ReleaseData, ReleaseEntry } from "./seadex_api";
import { AnidbIdApi, type Episode } from "./anidb_id_api";
import type { NyaaMetadata, NyaaFileEntry } from "./nyaa_scraper";

export const SEADEX_PANEL_ID = "seadex-panel";
export const NYAA_PANEL_ID = "nyaa-panel";

let cachedEpisodes: Episode[] | null = null;
let cachedAnilistId: number | null = null;

// Anchor Finding
export function findAnchor(): HTMLElement | null {
    const mediaRoot = document.querySelector<HTMLElement>(".page-content .media.media-anime");
    if (!mediaRoot) return null;

    const reviews = mediaRoot.querySelector(".reviews");
    if (reviews) {
        const wrapper = reviews.closest<HTMLElement>(".grid-section-wrap");
        if (wrapper) return wrapper;
    }

    const threads = mediaRoot.querySelector(".threads");
    if (threads) {
        const wrapper = threads.closest<HTMLElement>(".grid-section-wrap");
        if (wrapper) return wrapper;
    }

    return null;
}

export function provisionalContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".page-content .media.media-anime");
}

function appendTextWithLineBreaks(parent: HTMLElement, text: string): void {
    const lines = text.split(/\n+/);
    lines.forEach((line, index) => {
        parent.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
            parent.appendChild(document.createElement("br"));
        }
    });
}

function appendLinkifiedComparison(parent: HTMLElement, text: string): void {
    const lines = text.split(/\n+/);
    const urlRegex = /(https?:\/\/[^\s,]+)/g;

    lines.forEach((line, lineIndex) => {
        const urls = line.match(urlRegex);
        if (urls && urls.length > 1) {
            urls.forEach((url, urlIndex) => {
                const link = document.createElement("a");
                link.href = url;
                link.textContent = url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                parent.appendChild(link);
                if (urlIndex < urls.length - 1) {
                    parent.appendChild(document.createElement("br"));
                }
            });
        } else {
            let lastIndex = 0;
            let match;
            const regex = new RegExp(urlRegex);
            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    parent.appendChild(document.createTextNode(line.slice(lastIndex, match.index)));
                }
                const link = document.createElement("a");
                link.href = match[0];
                link.textContent = match[0];
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                parent.appendChild(link);
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) {
                parent.appendChild(document.createTextNode(line.slice(lastIndex)));
            }
        }
        if (lineIndex < lines.length - 1) {
            parent.appendChild(document.createElement("br"));
        }
    });
}

// Seadex Injection
function mountSeadexPanel(content: HTMLElement, anilistId: number): void {
    document.querySelectorAll(`#${SEADEX_PANEL_ID}`).forEach((node) => node.remove());

    const seadexPanel = document.createElement("div");
    seadexPanel.id = SEADEX_PANEL_ID;
    seadexPanel.className = "grid-section-wrap";
    seadexPanel.dataset.anilistId = String(anilistId);
    seadexPanel.dataset.anchored = "false";

    const inner = document.createElement("div");
    inner.className = "section";
    inner.appendChild(content);
    seadexPanel.appendChild(inner);

    const anchor = findAnchor();
    if (anchor && anchor.parentElement) {
        anchor.insertAdjacentElement("afterend", seadexPanel);
        seadexPanel.dataset.anchored = "true";
    } else {
        const provisional = provisionalContainer();
        if (provisional) provisional.appendChild(seadexPanel);
    }
}

// Placement Enforcement
export function ensureSeadexPanelPlacement(currentAniId: number | null): void {
    const seadexPanel = document.getElementById(SEADEX_PANEL_ID) as HTMLElement | null;
    if (!seadexPanel) return;

    if (currentAniId && seadexPanel.dataset.anilistId && seadexPanel.dataset.anilistId !== String(currentAniId)) {
        return;
    }

    const anchor = findAnchor();
    if (!anchor || !anchor.parentElement) return;

    if (seadexPanel.previousElementSibling === anchor) {
        seadexPanel.dataset.anchored = "true";
        return;
    }

    anchor.insertAdjacentElement("afterend", seadexPanel);
    seadexPanel.dataset.anchored = "true";
}

export function renderSeadexPanel(data: ReleaseData, anilistId: number): void {
    const content = document.createElement("div");

    const header = document.createElement("h2");
    header.textContent = "Seadex Releases";
    header.className = "section-header";
    content.appendChild(header);

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
            const comparisonContainer = document.createElement("div");
            const compLabel = document.createElement("strong");
            compLabel.textContent = "Comparison:";
            comparisonContainer.appendChild(compLabel);
            comparisonContainer.appendChild(document.createElement("br"));
            appendLinkifiedComparison(comparisonContainer, data.comparison);
            comparisonContainer.style.marginBottom = "0.75rem";
            meta.appendChild(comparisonContainer);
        }
        if (data.notes) {
            const notes = document.createElement("div");
            const notesLabel = document.createElement("strong");
            notesLabel.textContent = "Notes:";
            notes.appendChild(notesLabel);
            notes.appendChild(document.createTextNode(" "));
            appendTextWithLineBreaks(notes, data.notes);
            notes.style.marginBottom = "0.75rem";
            meta.appendChild(notes);
        }
        if (data["theoretical best"]) {
            const best = document.createElement("div");
            const bestLabel = document.createElement("strong");
            bestLabel.textContent = "Theoretical Best:";
            best.appendChild(bestLabel);
            best.appendChild(document.createTextNode(` ${data["theoretical best"]}`));
            meta.appendChild(best);
        }

        contentWrap.appendChild(meta);
    }

    data.releases.forEach((release: ReleaseEntry) => {
        const wrapper = document.createElement("div");
        wrapper.className = "wrap";
        wrapper.style.flex = "1 1 300px";
        wrapper.style.minWidth = "300px";
        wrapper.style.maxWidth = "48%";

        const card = document.createElement("div");
        card.className = "entry";
        card.style.padding = "1rem";

        const allFlags: string[] = [];
        if (release["dual audio"]) allFlags.push("Dual Audio");
        if (release["is best"]) allFlags.push("Best Release");
        if (release["private tracker"]) allFlags.push("Private Tracker");

        const rawUrl = release.url ?? "";

        const groupDiv = document.createElement("div");
        groupDiv.style.cssText = "font-weight:600; margin-bottom:4px;";
        groupDiv.textContent = release["release group"] ?? "";
        card.appendChild(groupDiv);

        const trackerDiv = document.createElement("div");
        trackerDiv.textContent = release.tracker ?? "";
        card.appendChild(trackerDiv);

        const sizeDiv = document.createElement("div");
        const sizeEm = document.createElement("em");
        sizeEm.textContent = release["file size"] ?? "";
        sizeDiv.appendChild(sizeEm);
        card.appendChild(sizeDiv);

        if (allFlags.length) {
            const flagsDiv = document.createElement("div");
            flagsDiv.style.cssText = "color:#3fa9f5; margin-bottom:8px;";
            flagsDiv.textContent = allFlags.join(" • ");
            card.appendChild(flagsDiv);
        }

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

            const episodeContainer = document.createElement("ul");
            episodeContainer.style.cssText = "display: none; margin-top: 0.5rem; padding-left: 1.2rem; font-size: 0.85em;";

            release["episode list"].forEach((episode) => {
                const li = document.createElement("li");
                li.style.cssText = "margin: 0.25rem 0;";
                li.textContent = `${episode.name ?? ""} — ${episode.size ?? ""}`;
                episodeContainer.appendChild(li);
            });

            toggle.addEventListener("click", () => {
                const isHidden = episodeContainer.style.display === "none";
                episodeContainer.style.display = isHidden ? "block" : "none";
                toggle.textContent = isHidden ? "Hide Episodes" : "Show Episodes";
            });

            card.appendChild(toggle);
            card.appendChild(episodeContainer);
        }

        wrapper.appendChild(card);
        contentWrap.appendChild(wrapper);
    });

    content.appendChild(contentWrap);
    mountSeadexPanel(content, anilistId);
}

// Nyaa Injection
function mountNyaaPanel(content: HTMLElement, anilistId: number): void {
    document.querySelectorAll(`#${NYAA_PANEL_ID}`).forEach((node) => node.remove());

    const nyaaPanel = document.createElement("div");
    nyaaPanel.id = NYAA_PANEL_ID;
    nyaaPanel.className = "grid-section-wrap";
    nyaaPanel.dataset.anilistId = String(anilistId);

    const inner = document.createElement("div");
    inner.className = "section";
    inner.appendChild(content);
    nyaaPanel.appendChild(inner);

    const seadexPanel = document.getElementById(SEADEX_PANEL_ID);
    if (seadexPanel && seadexPanel.parentElement) {
        nyaaPanel.style.marginTop = "2rem";
        seadexPanel.insertAdjacentElement("afterend", nyaaPanel);
        return;
    }

    const anchor = findAnchor();
    if (anchor && anchor.parentElement) {
        anchor.insertAdjacentElement("afterend", nyaaPanel);
        return;
    }

    const provisional = provisionalContainer();
    if (provisional) {
        provisional.appendChild(nyaaPanel);
    }
}

export function ensureNyaaPanelPlacement(currentAniId: number | null): void {
    const nyaaPanel = document.getElementById(NYAA_PANEL_ID);
    if (!nyaaPanel) return;

    if (currentAniId && nyaaPanel.dataset.anilistId && nyaaPanel.dataset.anilistId !== String(currentAniId)) {
        return;
    }

    const seadexPanel = document.getElementById(SEADEX_PANEL_ID);
    if (seadexPanel && seadexPanel.parentElement) {
        if (nyaaPanel.previousElementSibling !== seadexPanel) {
            nyaaPanel.style.marginTop = "2rem";
            seadexPanel.insertAdjacentElement("afterend", nyaaPanel);
        }
        return;
    }

    const anchor = findAnchor();
    if (anchor && anchor.parentElement) {
        if (nyaaPanel.previousElementSibling !== anchor) {
            anchor.insertAdjacentElement("afterend", nyaaPanel);
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
        const regularEpisodes = result.episodes.filter((episode) => {
            const epNum = parseInt(episode.episode, 10);
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
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Episode...";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    for (const episode of episodes) {
        const option = document.createElement("option");
        option.value = episode.episode;
        const title = episode.title ? ` - ${episode.title}` : "";
        option.textContent = `Episode ${episode.episode}${title}`;
        select.appendChild(option);
    }
}

export async function renderNyaaPanel(anilistId: number): Promise<void> {
    const existingPanel = document.getElementById(NYAA_PANEL_ID);
    if (existingPanel && existingPanel.dataset.anilistId !== String(anilistId)) {
        existingPanel.remove();
    }
    if (existingPanel) return;

    const content = document.createElement("div");

    const header = document.createElement("h2");
    header.textContent = "Nyaa Releases";
    header.className = "section-header";
    content.appendChild(header);

    const contentWrap = document.createElement("div");
    contentWrap.className = "content-wrap";

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
                const loadingOption = document.createElement("option");
                loadingOption.textContent = "Loading...";
                episodeSelect.replaceChildren(loadingOption);
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

    contentWrap.appendChild(controls);

    const resultsArea = document.createElement("div");
    resultsArea.id = "nyaa-results";
    contentWrap.appendChild(resultsArea);

    content.appendChild(contentWrap);

    mountNyaaPanel(content, anilistId);
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
        resultsArea.textContent = "";
        const errorMsg = document.createElement("p");
        errorMsg.style.cssText = "color: #ff6b6b; margin-top: 1rem;";
        errorMsg.textContent = "Please select an episode";
        resultsArea.appendChild(errorMsg);
        searchBtn.disabled = false;
        searchBtn.textContent = "Start Search";
        return;
    }

    const statusText = document.createElement("p");
    statusText.style.marginTop = "1rem";
    statusText.textContent = "Searching Nyaa... Found 0 sources";
    resultsArea.textContent = "";
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
                resultsArea.textContent = "";
                const errorP = document.createElement("p");
                errorP.style.cssText = "color: #ff6b6b; margin-top: 1rem;";
                errorP.textContent = "Failed to get AniDB mapping";
                resultsArea.appendChild(errorP);
                return;
            }
            results = await anidbApi.getAnimetoshoMetadata(mapping.anidb_id, null, updateProgress);
        } else {
            results = await anidbApi.getNyaaAnidbEpisode(anilistId, selectedEpisode!, updateProgress);
        }

        if (!results || results.length === 0) {
            resultsArea.textContent = "";
            const noResultsP = document.createElement("p");
            noResultsP.style.marginTop = "1rem";
            noResultsP.textContent = "No releases found with active seeders";
            resultsArea.appendChild(noResultsP);
            return;
        }

        displayNyaaResults(results, resultsArea);
    } catch (error) {
        console.error("Nyaa search error:", error);
        resultsArea.textContent = "";
        const errorP = document.createElement("p");
        errorP.style.cssText = "color: #ff6b6b; margin-top: 1rem;";
        errorP.textContent = "Error searching Nyaa";
        resultsArea.appendChild(errorP);
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

function displayNyaaResults(results: NyaaMetadata[], content: HTMLElement): void {
    const contentWrap = document.createElement("div");
    contentWrap.className = "content-wrap";
    contentWrap.style.cssText = "display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;";

    results.forEach((release) => {
        const wrapper = document.createElement("div");
        wrapper.className = "wrap";
        wrapper.style.cssText = "flex: 1 1 300px; min-width: 300px; max-width: 48%;";

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

        wrapper.appendChild(card);
        contentWrap.appendChild(wrapper);
    });

    content.textContent = "";
    content.appendChild(contentWrap);
}

