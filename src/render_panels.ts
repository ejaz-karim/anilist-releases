import type { ReleaseData, ReleaseEntry } from "./seadex_api";
import { AnidbIdApi, type Episode } from "./anidb_id_api";
import type { NyaaMetadata, NyaaFileEntry } from "./nyaa_scraper";

export const SEADEX_PANEL_ID = "seadex-panel";
export const NYAA_PANEL_ID = "nyaa-panel";

// ==========================================
// 1. Shared Utilities (DOM, Text, Data)
// ==========================================

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

// Data Parsing
function parseFileSize(sizeStr: string | undefined): number {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/^([\d.]+)\s*(bytes|[KMGT]iB|[KMGT]B)?$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = (match[2] || "").toUpperCase();
    const multipliers: Record<string, number> = {
        "": 1, "BYTES": 1,
        "KIB": 1024, "KB": 1000,
        "MIB": 1024 ** 2, "MB": 1000 ** 2,
        "GIB": 1024 ** 3, "GB": 1000 ** 3,
        "TIB": 1024 ** 4, "TB": 1000 ** 4,
    };
    return value * (multipliers[unit] || 1);
}

// ==========================================
// 2. UI Component Helpers
// ==========================================

function createCardContainer(): HTMLElement {
    const card = document.createElement("div");
    card.className = "result-card";
    card.style.cssText = `
        border: 1px solid rgba(var(--color-foreground-rgb, 92,114,138), 0.3);
        border-radius: 6px;
        overflow: hidden;
        transition: all 0.2s ease;
    `;
    return card;
}

function createCardHeader(): HTMLElement {
    const header = document.createElement("div");
    header.className = "card-header";
    header.style.cssText = `
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        gap: 0.75rem;
        background: rgba(var(--color-foreground-rgb, 92,114,138), 0.05);
        cursor: pointer;
    `;
    return header;
}

function createTitleContainer(text: string, tooltip: string = ""): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "flex: 1; display: flex; align-items: center; overflow: hidden; gap: 0.5rem;";

    const titleSpan = document.createElement("span");
    titleSpan.style.cssText = "font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; max-width: 80%;";
    titleSpan.textContent = text;
    titleSpan.title = tooltip || text;

    container.appendChild(titleSpan);
    return container;
}

function createSimpleTitle(text: string): HTMLElement {
    const title = document.createElement("span");
    title.style.cssText = "flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    title.textContent = text;
    title.title = text;
    return title;
}

function createActionContainer(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "display: flex; align-items: center; gap: 0.75rem; margin-left: auto; flex-shrink: 0;";
    return container;
}

function createExpandButton(): HTMLElement {
    const expandBtn = document.createElement("span");
    expandBtn.className = "expand-btn";
    expandBtn.textContent = "+";
    expandBtn.style.cssText = `
        font-size: 1.4em;
        font-weight: 600;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        background: rgba(var(--color-foreground-rgb, 92,114,138), 0.1);
    `;
    return expandBtn;
}

function createActionButton(icon: string, title: string, color: string, onClick?: (ev: MouseEvent) => void): HTMLElement {
    const btn = document.createElement("button");
    btn.innerHTML = icon;
    btn.title = title;
    btn.style.cssText = `background: ${color}; border: none; cursor: pointer; font-size: 1.1em; padding: 0.35rem 0.5rem; border-radius: 4px; color: white;`;
    if (onClick) {
        btn.addEventListener("click", onClick);
    }
    return btn;
}

function createLinkButton(icon: string, title: string, url: string, color: string): HTMLElement {
    const link = document.createElement("a");
    link.innerHTML = icon;
    link.title = title;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText = `text-decoration: none; font-size: 1.1em; padding: 0.35rem 0.5rem; background: ${color}; border-radius: 4px; display: inline-block; color: white;`;
    link.addEventListener("click", (ev) => ev.stopPropagation());
    return link;
}

function createDetailsContainer(): HTMLElement {
    const details = document.createElement("div");
    details.className = "card-details";
    details.style.cssText = "display: none; padding: 0.75rem 1rem; border-top: 1px solid rgba(var(--color-foreground-rgb, 92,114,138), 0.2); font-size: 0.9em;";
    return details;
}

// ==========================================
// 3. SeaDex Panel Logic
// ==========================================

export function renderSeadexPanel(data: ReleaseData, anilistId: number): void {
    const content = document.createElement("div");

    const header = document.createElement("h2");
    header.textContent = "Seadex Releases";
    header.className = "section-header";
    content.appendChild(header);

    const contentWrap = document.createElement("div");
    contentWrap.className = "content-wrap list";
    contentWrap.style.cssText = "display: flex; flex-direction: column; gap: 1rem;";

    // Display Meta Info as separate cards
    const metaContainer = document.createElement("div");
    metaContainer.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;";

    if (data.comparison) {
        metaContainer.appendChild(createMetaCard("Comparison", data.comparison, true));
    }
    if (data.notes) {
        metaContainer.appendChild(createMetaCard("Notes", data.notes));
    }
    if (data["theoretical best"]) {
        metaContainer.appendChild(createMetaCard("Theoretical Best", data["theoretical best"]));
    }
    contentWrap.appendChild(metaContainer);

    // Display Releases as stacked cards
    const resultsContainer = document.createElement("div");
    resultsContainer.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem;";

    data.releases.forEach((release: ReleaseEntry) => {
        resultsContainer.appendChild(createSeadexCard(release));
    });

    contentWrap.appendChild(resultsContainer);
    content.appendChild(contentWrap);

    mountSeadexPanel(content, anilistId);
}

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

function createMetaCard(title: string, contentText: string, isComparison: boolean = false): HTMLElement {
    // Reuse standardized card helpers
    const card = createCardContainer();
    card.className = "seadex-meta-card";
    // Specific meta-card overrides (darker background)
    card.style.background = "rgba(var(--color-background-rgb), 0.6)";

    const header = createCardHeader();

    // Title
    const titleSpan = document.createElement("span");
    titleSpan.style.cssText = "flex: 1; font-weight: 600;";
    titleSpan.textContent = title;

    // Toggle Button
    const expandBtn = createExpandButton();
    expandBtn.textContent = "-"; // Default expanded state

    header.appendChild(titleSpan);
    header.appendChild(expandBtn);

    const contentDiv = document.createElement("div");
    contentDiv.style.cssText = "display: block; padding: 1rem; border-top: 1px solid rgba(var(--color-foreground-rgb, 92,114,138), 0.2); font-size: 0.9em; line-height: 1.5;";

    if (isComparison) {
        appendLinkifiedComparison(contentDiv, contentText);
    } else {
        appendTextWithLineBreaks(contentDiv, contentText);
    }

    header.addEventListener("click", () => {
        const isHidden = contentDiv.style.display === "none";
        contentDiv.style.display = isHidden ? "block" : "none";
        expandBtn.textContent = isHidden ? "-" : "+";
    });

    card.appendChild(header);
    card.appendChild(contentDiv);
    return card;
}

function createSeadexCard(release: ReleaseEntry): HTMLElement {
    const card = createCardContainer();
    card.className = "seadex-result-card";

    // Header
    const header = createCardHeader();

    // Release Group (Left aligned) + Flags
    const titleContainer = createTitleContainer(release["release group"] || "Unknown Group", release["release group"]);

    // Flags/Tags (Next to title)
    const allFlags: string[] = [];
    if (release["dual audio"]) allFlags.push("Dual Audio");
    if (release["is best"]) allFlags.push("Best Release");
    if (release["private tracker"]) allFlags.push("Private Tracker");
    if (release["tags"] && release["tags"].length > 0) {
        allFlags.push(...release["tags"]);
    }

    if (allFlags.length > 0) {
        const flagsSpan = document.createElement("span");
        flagsSpan.style.cssText = "font-size: 0.85em; color: #3fa9f5; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 0;";
        flagsSpan.textContent = allFlags.join(" • ");
        flagsSpan.title = allFlags.join(" • ");
        titleContainer.appendChild(flagsSpan);
    }

    // Right aligned container
    const actionsContainer = createActionContainer();

    const trackerSpan = document.createElement("span");
    trackerSpan.style.cssText = "margin-right: 0.5rem; font-weight: 600;";
    trackerSpan.textContent = release.tracker || "";
    trackerSpan.title = release.tracker || "";
    if (release.tracker) actionsContainer.appendChild(trackerSpan);

    // Size
    const sizeSpan = document.createElement("span");
    sizeSpan.style.cssText = "color: #68D639; font-weight: 600; min-width: 80px; text-align: right; margin-right: 0.5rem;";
    sizeSpan.textContent = release["file size"] || "";
    actionsContainer.appendChild(sizeSpan);

    // URL Button
    const rawUrl = release.url || "";
    if (rawUrl) {
        if (/^https?:\/\//i.test(rawUrl)) {
            const urlBtn = createLinkButton("🔗", "Open URL", rawUrl, "#02A9FF");
            actionsContainer.appendChild(urlBtn);
        } else {
            const copyBtn = createActionButton("📋", "Copy URL", "#02A9FF", async (ev) => {
                ev.stopPropagation();
                try {
                    await navigator.clipboard.writeText(rawUrl);
                    copyBtn.innerHTML = "✓";
                    setTimeout(() => { copyBtn.innerHTML = "📋"; }, 1000);
                } catch {
                    window.prompt("Copy URL", rawUrl);
                }
            });
            actionsContainer.appendChild(copyBtn);
        }
    }

    // Expand Button
    const expandBtn = createExpandButton();
    actionsContainer.appendChild(expandBtn);

    header.appendChild(titleContainer);
    header.appendChild(actionsContainer);

    // Details Section
    const details = createDetailsContainer();

    if (release["episode list"]?.length) {
        const episodesHeader = document.createElement("div");
        episodesHeader.textContent = "Episodes:";
        episodesHeader.style.cssText = "font-weight: 600; margin-bottom: 0.5rem; margin-top: 0.5rem;";
        details.appendChild(episodesHeader);

        const episodeList = document.createElement("ul");
        episodeList.style.cssText = "list-style: none; padding-left: 0.5rem; margin: 0;";

        release["episode list"].forEach((ep) => {
            const li = document.createElement("li");
            li.style.cssText = "padding: 0.25rem 0; border-bottom: 1px solid rgba(var(--color-foreground-rgb, 92,114,138), 0.1); display: flex; justify-content: space-between;";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = `📄 ${ep.name || "Unknown Episode"}`;

            const sizeSize = document.createElement("span");
            sizeSize.textContent = ep.size || "";
            sizeSize.style.opacity = "0.8";

            li.appendChild(nameSpan);
            li.appendChild(sizeSize);
            episodeList.appendChild(li);
        });
        details.appendChild(episodeList);
    }

    card.appendChild(header);
    card.appendChild(details);

    // Expand Logic
    header.addEventListener("click", () => {
        const isHidden = details.style.display === "none";
        details.style.display = isHidden ? "block" : "none";
        expandBtn.textContent = isHidden ? "-" : "+";
    });

    return card;
}

// ==========================================
// 4. Nyaa Panel Logic
// ==========================================

// Sort state for live insertion
type SortCriteria = 'seeders' | 'date' | 'size' | 'completed';
let currentSortCriteria: SortCriteria = 'seeders';
let currentAbortController: AbortController | null = null;
let allResults: NyaaMetadata[] = [];
let cachedEpisodes: Episode[] | null = null;
let cachedAnilistId: number | null = null;

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

    // Row 1: Radio buttons
    const radioRow = document.createElement("div");
    radioRow.style.cssText = "display: flex; gap: 1rem; margin-bottom: 1.25rem; align-items: center; flex-wrap: wrap;";

    const createRadioLabel = (id: string, value: string, text: string, checked: boolean = false): [HTMLLabelElement, HTMLInputElement] => {
        const input = document.createElement("input");
        input.type = "radio";
        input.id = id;
        input.name = "nyaa-release-type";
        input.value = value;
        input.checked = checked;
        input.style.cursor = "pointer";

        const label = document.createElement("label");
        label.htmlFor = id;
        label.style.cssText = "display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;";
        label.appendChild(input);
        label.appendChild(document.createTextNode(text));

        return [label, input];
    };

    const [fullReleaseLabel, fullReleasesRadio] = createRadioLabel("nyaa-full-releases", "full-releases", "Full Releases", true);
    const [episodeReleaseLabel, episodeReleasesRadio] = createRadioLabel("nyaa-episode-releases", "episode-releases", "Episode Releases");

    radioRow.appendChild(fullReleaseLabel);
    radioRow.appendChild(episodeReleaseLabel);

    // Row 1.5: Episode dropdown (Always on new line)
    const dropdownRow = document.createElement("div");
    dropdownRow.style.cssText = "display: none; margin-bottom: 2rem; margin-top: 2rem;"; // Hidden by default

    const episodeSelect = document.createElement("select");
    episodeSelect.id = "nyaa-episode-select";
    episodeSelect.style.cssText = "padding: 0.25rem 0.5rem; max-width: 100%; box-sizing: border-box;";

    dropdownRow.appendChild(episodeSelect);

    // Row 2: Search button + Sort buttons
    const row2 = document.createElement("div");
    row2.style.cssText = "display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap;";

    const searchBtn = document.createElement("button");
    searchBtn.id = "search-nyaa-btn";
    searchBtn.textContent = "Start Search";
    searchBtn.className = "button";
    searchBtn.style.cssText = "padding: 0.5rem 1rem; cursor: pointer;";

    const sortLabel = document.createElement("span");
    sortLabel.textContent = "Sort:";
    sortLabel.style.cssText = "margin-left: 1rem; font-size: 0.9em;";

    const createSortBtn = (label: string, criteria: SortCriteria): HTMLButtonElement => {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.className = "button";
        btn.dataset.sortCriteria = criteria;
        const isActive = criteria === currentSortCriteria;
        btn.style.cssText = `padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.85em; border-radius: 4px; border: none; background: ${isActive ? "#02A9FF" : "#58BFF4"}; color: white;`;
        btn.addEventListener("click", () => handleSortChange(criteria));
        return btn;
    };

    const sortSeedersBtn = createSortBtn("Seeders", "seeders");
    const sortDateBtn = createSortBtn("Date", "date");
    const sortSizeBtn = createSortBtn("Size", "size");
    const sortCompletedBtn = createSortBtn("Completed", "completed");

    row2.appendChild(searchBtn);
    row2.appendChild(sortLabel);
    row2.appendChild(sortSeedersBtn);
    row2.appendChild(sortDateBtn);
    row2.appendChild(sortSizeBtn);
    row2.appendChild(sortCompletedBtn);

    const updateEpisodeSelectVisibility = async () => {
        if (episodeReleasesRadio.checked) {
            dropdownRow.style.display = "block";
            if (!cachedEpisodes || cachedAnilistId !== anilistId) {
                const loadingOption = document.createElement("option");
                loadingOption.textContent = "Loading...";
                episodeSelect.replaceChildren(loadingOption);
                const episodes = await loadEpisodeData(anilistId);
                populateEpisodeDropdown(episodeSelect, episodes);
            }
        } else {
            dropdownRow.style.display = "none";
        }
    };

    episodeReleasesRadio.addEventListener("change", updateEpisodeSelectVisibility);
    fullReleasesRadio.addEventListener("change", updateEpisodeSelectVisibility);

    searchBtn.addEventListener("click", () => handleNyaaSearchStreaming(anilistId));

    contentWrap.appendChild(radioRow);
    contentWrap.appendChild(dropdownRow);
    contentWrap.appendChild(row2);

    const resultsArea = document.createElement("div");
    resultsArea.id = "nyaa-results";
    contentWrap.appendChild(resultsArea);

    content.appendChild(contentWrap);

    mountNyaaPanel(content, anilistId);
}

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

// Nyaa Search Logic

async function handleNyaaSearchStreaming(anilistId: number): Promise<void> {
    const resultsArea = document.getElementById("nyaa-results");
    const searchBtn = document.getElementById("search-nyaa-btn") as HTMLButtonElement;
    if (!resultsArea || !searchBtn) return;

    // Handle stop search
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        searchBtn.textContent = "Start Search";
        return;
    }

    // Reset state
    allResults = [];
    currentAbortController = new AbortController();
    searchBtn.textContent = "Stop Search";

    const fullRelease =
        (document.querySelector('input[name="nyaa-release-type"]:checked') as HTMLInputElement)?.value === "full-releases";
    const episodeSelect = document.getElementById("nyaa-episode-select") as HTMLSelectElement;
    const selectedEpisode = episodeSelect?.value;

    if (!fullRelease && !selectedEpisode) {
        resultsArea.textContent = "";
        const errorMsg = document.createElement("p");
        errorMsg.style.cssText = "color: #E85D75; margin-top: 1rem;";
        errorMsg.textContent = "Please select an episode";
        resultsArea.appendChild(errorMsg);
        currentAbortController = null;
        searchBtn.textContent = "Start Search";
        return;
    }

    // Setup results container
    resultsArea.textContent = "";

    const statusText = document.createElement("p");
    statusText.id = "nyaa-search-status";
    statusText.style.marginTop = "0.5rem";
    statusText.textContent = "Searching Nyaa... Found 0 sources";
    resultsArea.appendChild(statusText);

    const resultsContainer = document.createElement("div");
    resultsContainer.id = "nyaa-results-list";
    resultsContainer.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;";
    resultsArea.appendChild(resultsContainer);

    try {
        const anidbApi = new AnidbIdApi();

        let generator: AsyncGenerator<NyaaMetadata, void, unknown>;
        if (fullRelease) {
            const mapping = await anidbApi.getAnidbId(anilistId);
            if (!mapping) {
                resultsArea.textContent = "";
                const errorP = document.createElement("p");
                errorP.style.cssText = "color: #E85D75; margin-top: 1rem;";
                errorP.textContent = "Failed to get AniDB mapping";
                resultsArea.appendChild(errorP);
                currentAbortController = null;
                searchBtn.textContent = "Start Search";
                return;
            }
            generator = anidbApi.iterateAnimetoshoMetadata(mapping.anidb_id, null, currentAbortController.signal);
        } else {
            generator = anidbApi.iterateNyaaAnidbEpisode(anilistId, selectedEpisode!, currentAbortController.signal);
        }

        for await (const result of generator) {
            if (currentAbortController?.signal.aborted) break;

            const resultIndex = allResults.length;
            allResults.push(result);

            const card = createNyaaCard(result, resultIndex);
            const insertPos = getInsertPosition(resultsContainer, result, currentSortCriteria);

            if (insertPos >= resultsContainer.children.length) {
                resultsContainer.appendChild(card);
            } else {
                resultsContainer.insertBefore(card, resultsContainer.children[insertPos]);
            }

            statusText.textContent = `Searching Nyaa... Found ${allResults.length} sources`;
        }

        if (allResults.length === 0) {
            statusText.textContent = "No releases found with active seeders";
        } else {
            statusText.textContent = `Search complete. Found ${allResults.length} sources`;
        }
    } catch (error) {
        if ((error as Error).name !== "AbortError") {
            console.error("Nyaa search error:", error);
            resultsArea.textContent = "";
            const errorP = document.createElement("p");
            errorP.style.cssText = "color: #E85D75; margin-top: 1rem;";
            errorP.textContent = "Error searching Nyaa (Animetosho.org most likely hasn't indexed any releases)";
            resultsArea.appendChild(errorP);
        }
    } finally {
        currentAbortController = null;
        searchBtn.textContent = "Start Search";
    }
}

function createNyaaCard(release: NyaaMetadata, index: number): HTMLElement {
    const card = createCardContainer();
    card.className = "nyaa-result-card";
    card.dataset.resultIndex = String(index);

    // Header
    const header = createCardHeader();

    // Release name
    const title = createSimpleTitle(release["release name"] || "Unknown Release");

    // Actions
    const actionsContainer = createActionContainer();

    // Seeders (Nyaa specific: left of buttons)
    const seedersSpan = document.createElement("span");
    seedersSpan.style.cssText = "color: #68D639; font-weight: 600; min-width: 90px; text-align: right; margin-right: 0.5rem;";
    seedersSpan.textContent = `${release.seeders || "0"} Seeders`;
    actionsContainer.appendChild(seedersSpan);

    // Magnet Button
    const magnetBtn = createActionButton("🧲", "Copy Magnet Link", "#02A9FF", async (ev) => {
        ev.stopPropagation();
        try {
            await navigator.clipboard.writeText(release.magnet);
            magnetBtn.innerHTML = "✓";
            setTimeout(() => { magnetBtn.innerHTML = "🧲"; }, 1000);
        } catch {
            window.prompt("Copy Magnet Link", release.magnet);
        }
    });
    actionsContainer.appendChild(magnetBtn);

    // URL Button
    const urlBtn = createLinkButton("🔗", "Open on Nyaa", release.url || "#", "#02A9FF");
    actionsContainer.appendChild(urlBtn);

    // Expand Button
    const expandBtn = createExpandButton();
    actionsContainer.appendChild(expandBtn);

    header.appendChild(title);
    header.appendChild(actionsContainer);

    // Details section
    const details = createDetailsContainer();

    // Full title at top of expanded view
    const fullTitleDiv = document.createElement("div");
    fullTitleDiv.style.cssText = "font-weight: 600; margin-bottom: 0.75rem; word-break: break-word;";
    fullTitleDiv.textContent = release["release name"] || "Unknown Release";
    details.appendChild(fullTitleDiv);

    const detailsRow1 = document.createElement("div");
    detailsRow1.style.cssText = "display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;";
    detailsRow1.innerHTML = `
        <span><strong>Category:</strong> ${release.category || "Unknown"}</span>
        <span style="color: #68D639;"><strong>Seeders:</strong> ${release.seeders || "0"}</span>
        <span style="color: #E85D75;"><strong>Leechers:</strong> ${release.leechers || "0"}</span>
    `;

    const detailsRow2 = document.createElement("div");
    detailsRow2.style.cssText = "display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;";
    detailsRow2.innerHTML = `
        <span><strong>Date:</strong> ${release.date || "Unknown"}</span>
        <span><strong>Size:</strong> ${release["file size"] || "Unknown"}</span>
        <span><strong>Completed:</strong> ${release.completed || "0"}</span>
    `;

    const detailsRow3 = document.createElement("div");
    detailsRow3.innerHTML = `<span><strong>Submitter:</strong> ${release.submitter || "Unknown"}</span>`;

    details.appendChild(detailsRow1);
    details.appendChild(detailsRow2);
    details.appendChild(detailsRow3);

    // Files section
    if (release.files && release.files.length > 0) {
        const filesSection = document.createElement("div");
        filesSection.style.cssText = "margin-top: 0.75rem;";

        const filesToggle = document.createElement("a");
        filesToggle.textContent = "📁 Show Files";
        filesToggle.className = "link";
        filesToggle.style.cursor = "pointer";

        const filesContainer = document.createElement("div");
        filesContainer.style.cssText = "display: none; margin-top: 0.5rem;";

        filesToggle.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const isHidden = filesContainer.style.display === "none";
            filesContainer.style.display = isHidden ? "block" : "none";
            filesToggle.textContent = isHidden ? "📁 Hide Files" : "📁 Show Files";
        });

        filesContainer.appendChild(renderFileTree(release.files));
        filesSection.appendChild(filesToggle);
        filesSection.appendChild(filesContainer);
        details.appendChild(filesSection);
    }

    card.appendChild(header);
    card.appendChild(details);

    // Click header to expand/collapse
    header.addEventListener("click", () => {
        const isHidden = details.style.display === "none";
        details.style.display = isHidden ? "block" : "none";
        expandBtn.textContent = isHidden ? "−" : "+";
    });

    return card;
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

// Nyaa Specific Helpers (Sorting, Episodes)

function compareBySort(a: NyaaMetadata, b: NyaaMetadata, criteria: SortCriteria): number {
    switch (criteria) {
        case 'seeders':
            return parseInt(b.seeders || "0") - parseInt(a.seeders || "0");
        case 'date':
            // Parse date strings for comparison (newer first)
            const dateA = new Date(a.date || "1970-01-01").getTime();
            const dateB = new Date(b.date || "1970-01-01").getTime();
            return dateB - dateA;
        case 'size':
            // Parse file size (larger first)
            return parseFileSize(b["file size"]) - parseFileSize(a["file size"]);
        case 'completed':
            return parseInt(b.completed || "0") - parseInt(a.completed || "0");
        default:
            return 0;
    }
}

function getInsertPosition(resultsContainer: HTMLElement, newResult: NyaaMetadata, criteria: SortCriteria): number {
    const cards = resultsContainer.querySelectorAll<HTMLElement>("[data-result-index]");
    for (let i = 0; i < cards.length; i++) {
        const idx = parseInt(cards[i].dataset.resultIndex || "0");
        if (compareBySort(newResult, allResults[idx], criteria) < 0) {
            return i;
        }
    }
    return cards.length;
}

function handleSortChange(criteria: SortCriteria): void {
    currentSortCriteria = criteria;

    // Update button styles
    document.querySelectorAll<HTMLButtonElement>("[data-sort-criteria]").forEach(btn => {
        if (btn.dataset.sortCriteria === criteria) {
            btn.style.background = "#02A9FF";
        } else {
            btn.style.background = "#58BFF4";
        }
    });

    // Re-sort existing results
    const resultsContainer = document.getElementById("nyaa-results-list");
    if (!resultsContainer || allResults.length === 0) return;

    const sortedIndices = allResults
        .map((_, idx) => idx)
        .sort((a, b) => compareBySort(allResults[a], allResults[b], criteria));

    const cards = Array.from(resultsContainer.querySelectorAll<HTMLElement>("[data-result-index]"));
    const fragment = document.createDocumentFragment();

    sortedIndices.forEach(idx => {
        const card = cards.find(c => c.dataset.resultIndex === String(idx));
        if (card) fragment.appendChild(card);
    });

    resultsContainer.replaceChildren(fragment);
}

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
