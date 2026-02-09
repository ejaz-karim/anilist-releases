import type { ReleaseData, ReleaseEntry } from "./seadex_api";
import { AnidbIdApi, type Episode } from "./anidb_id_api";
import type { NyaaMetadata, NyaaFileEntry } from "./nyaa_scraper";

export const SEADEX_PANEL_ID = "seadex-panel";
export const NYAA_PANEL_ID = "nyaa-panel";

// Colour Palette
const COLOUR_BLUE_PRIMARY = "rgba(61, 180, 242, 1)";
const COLOUR_BLUE_SECONDARY = "rgba(61, 180, 242, 0.65)";
const COLOUR_GREEN = "rgba(76, 175, 80, 1)";
const COLOUR_RED = "rgba(236, 41, 75, 1)";
const COLOUR_BG_TRANSPARENT = "rgba(var(--color-foreground-rgb, 92,114,138), 0.05)";
const COLOUR_SURFACE_TRANSPARENT = "rgba(var(--color-foreground-rgb, 92,114,138), 0.1)";
const COLOUR_BORDER_TRANSPARENT = "rgba(var(--color-foreground-rgb, 92,114,138), 0.3)";
const COLOUR_BORDER_DETAILS = "rgba(var(--color-foreground-rgb, 92,114,138), 0.2)";
const COLOUR_BORDER_CONTROL = "rgba(var(--color-foreground-rgb, 92,114,138), 0.5)";
const COLOUR_BG_META = "rgba(var(--color-background-rgb), 0.6)";

// 1. Shared Utilities

// Anchor Finding
export function findAnchor(): HTMLElement | null {
    const mediaRoot = provisionalContainer();
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
        parent.append(line);
        if (index < lines.length - 1) parent.append(document.createElement("br"));
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
                parent.append(link);
                if (urlIndex < urls.length - 1) parent.append(document.createElement("br"));
            });
        } else {
            let lastIndex = 0;
            let match;
            const regex = new RegExp(urlRegex);
            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) parent.append(line.slice(lastIndex, match.index));
                const link = document.createElement("a");
                link.href = match[0];
                link.textContent = match[0];
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                parent.append(link);
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) parent.append(line.slice(lastIndex));
        }
        if (lineIndex < lines.length - 1) parent.append(document.createElement("br"));
    });
}

// Data Parsing
const UNIT_MULTIPLIERS: Record<string, number> = {
    "": 1, "BYTES": 1,
    "KIB": 1024, "KB": 1000,
    "MIB": 1024 ** 2, "MB": 1000 ** 2,
    "GIB": 1024 ** 3, "GB": 1000 ** 3,
    "TIB": 1024 ** 4, "TB": 1000 ** 4,
};

function parseFileSize(sizeStr: string | undefined): number {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/^([\d.]+)\s*(bytes|[KMGT]iB|[KMGT]B)?$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = (match[2] ?? "").toUpperCase();
    return value * (UNIT_MULTIPLIERS[unit] ?? 1);
}

// Copy to Clipboard helper
async function copyToClipboard(text: string, btn?: HTMLElement, successIcon: string = "✓", originalIcon?: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        if (btn && originalIcon) {
            btn.textContent = successIcon;
            setTimeout(() => { btn.textContent = originalIcon; }, 1000);
        }
    } catch {
        window.prompt("Copy", text);
    }
}

function setupAccordion(header: HTMLElement, details: HTMLElement, expandBtn: HTMLElement): void {
    header.addEventListener("click", () => {
        const isHidden = details.style.display === "none";
        details.style.display = isHidden ? "block" : "none";
        expandBtn.textContent = isHidden ? "-" : "+";
    });
}

// 2. UI Component Helpers

const BASE_BTN_STYLE = "border: 1px solid transparent; cursor: pointer; font-size: 0.9em; padding: 0.35rem 0.5rem; border-radius: 4px; color: white;";
const CONTROL_STYLE = `padding: 0.35rem 0.5rem; border: 1px solid ${COLOUR_BORDER_CONTROL}; border-radius: 4px; font-size: 0.9em; background: transparent; color: inherit;`;
const FLEX_COLUMN_GAP_HALF = "display: flex; flex-direction: column; gap: 0.5rem;";
const FLEX_COLUMN_GAP_ONE = "display: flex; flex-direction: column; gap: 1rem;";
const FLEX_ROW_WRAP = "display: flex; gap: 1.5rem; flex-wrap: wrap;";

function createCardContainer(): HTMLElement {
    const card = document.createElement("div");
    card.className = "result-card";
    card.style.cssText = `
        border: 1px solid ${COLOUR_BORDER_TRANSPARENT};
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
        background: ${COLOUR_BG_TRANSPARENT};
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
    titleSpan.title = tooltip !== "" ? tooltip : text;

    container.append(titleSpan);
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
        background: ${COLOUR_SURFACE_TRANSPARENT};
    `;
    return expandBtn;
}

function createActionButton(icon: string, title: string, color: string, onClick?: (ev: MouseEvent) => void): HTMLElement {
    const btn = document.createElement("button");
    btn.textContent = icon;
    btn.title = title;
    btn.style.cssText = `background: ${color}; ${BASE_BTN_STYLE}`;
    if (onClick) {
        btn.addEventListener("click", onClick);
    }
    return btn;
}

function createLinkButton(icon: string, title: string, url: string, color: string): HTMLElement {
    const link = document.createElement("a");
    link.textContent = icon;
    link.title = title;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText = `background: ${color}; text-decoration: none; display: inline-block; ${BASE_BTN_STYLE}`;
    link.addEventListener("click", (ev) => ev.stopPropagation());
    return link;
}

function createDetailSpan(label: string, value: string, color?: string): HTMLElement {
    const span = document.createElement("span");
    if (color) span.style.color = color;
    const strong = document.createElement("strong");
    strong.textContent = label;
    span.append(strong, " " + value);
    return span;
}

function createDetailsContainer(): HTMLElement {
    const details = document.createElement("div");
    details.className = "card-details";
    details.style.cssText = `display: none; padding: 0.75rem 1rem; border-top: 1px solid ${COLOUR_BORDER_DETAILS}; font-size: 0.9em;`;
    return details;
}

// 3. Panel Placement

function placePanel(
    panelId: string,
    anilistId: number,
    content: HTMLElement | null,
    afterElementId?: string
): void {
    const existing = document.getElementById(panelId);
    if (!existing) {
        // Create new panel
        if (!content) return; // Should not happen if creating
        const panel = document.createElement("div");
        panel.id = panelId;
        panel.className = "grid-section-wrap";
        panel.dataset.anilistId = String(anilistId);
        panel.dataset.anchored = "false";

        const inner = document.createElement("div");
        inner.className = "section";
        inner.append(content);
        panel.append(inner);

        insertPanel(panel, afterElementId);
        return;
    }

    // Refresh existing placement
    if (existing.dataset.anilistId && existing.dataset.anilistId !== String(anilistId)) {
        return; // Don't touch if belonging to another ID (handled by tryInject)
    }

    insertPanel(existing, afterElementId);
}

function insertPanel(panel: HTMLElement, afterElementId?: string): void {
    const anchor = findAnchor();
    const provisional = provisionalContainer();

    let target: Element | null = null;
    if (afterElementId) {
        target = document.getElementById(afterElementId);
    }

    // If target exists and is attached, place after it
    if (target && target.parentElement) {
        panel.style.marginTop = "2rem";
        // Only move if not already there
        if (panel.previousElementSibling !== target) {
            target.insertAdjacentElement("afterend", panel);
        }
        panel.dataset.anchored = "true";
        return;
    }

    // Fallback to anchor
    if (anchor && anchor.parentElement) {
        panel.style.marginTop = "";
        if (panel.previousElementSibling !== anchor) {
            anchor.insertAdjacentElement("afterend", panel);
        }
        panel.dataset.anchored = "true";
        return;
    }

    // Fallback to provisional
    if (provisional && (!panel.parentElement || panel.parentElement !== provisional)) {
        provisional.append(panel);
    }
}

// 4. SeaDex Panel

export function renderSeadexPanel(data: ReleaseData, anilistId: number): void {
    const content = document.createElement("div");

    const header = document.createElement("h2");
    header.textContent = "Seadex Releases";
    header.className = "section-header";
    content.append(header);

    const contentWrap = document.createElement("div");
    contentWrap.className = "content-wrap list";
    contentWrap.style.cssText = FLEX_COLUMN_GAP_ONE;

    const metaContainer = document.createElement("div");
    metaContainer.style.cssText = `${FLEX_COLUMN_GAP_HALF} margin-bottom: 1rem;`;

    if (data.comparison) metaContainer.append(createMetaCard("Comparison", data.comparison, true));
    if (data.notes) metaContainer.append(createMetaCard("Notes", data.notes));
    if (data.theoreticalBest) metaContainer.append(createMetaCard("Theoretical Best", data.theoreticalBest));

    contentWrap.append(metaContainer);

    // Display Releases
    const resultsContainer = document.createElement("div");
    resultsContainer.style.cssText = FLEX_COLUMN_GAP_HALF;

    data.releases.forEach((release: ReleaseEntry) => {
        resultsContainer.append(createSeadexCard(release));
    });

    contentWrap.append(resultsContainer);
    content.append(contentWrap);

    // Mount
    placePanel(SEADEX_PANEL_ID, anilistId, content);
}

export function ensureSeadexPanelPlacement(currentAniId: number | null): void {
    const seadexPanel = document.getElementById(SEADEX_PANEL_ID);
    if (!seadexPanel || !currentAniId) return;
    insertPanel(seadexPanel);
}

function createMetaCard(title: string, contentText: string, isComparison: boolean = false): HTMLElement {
    const card = createCardContainer();
    card.className = "seadex-meta-card";
    card.style.background = COLOUR_BG_META;

    const header = createCardHeader();

    const titleSpan = document.createElement("span");
    titleSpan.style.cssText = "flex: 1; font-weight: 600;";
    titleSpan.textContent = title;

    const expandBtn = createExpandButton();
    expandBtn.textContent = "-";

    header.append(titleSpan, expandBtn);

    const contentDiv = document.createElement("div");
    contentDiv.style.cssText = `display: block; padding: 1rem; border-top: 1px solid ${COLOUR_BORDER_DETAILS}; font-size: 0.9em; line-height: 1.5;`;

    if (isComparison) {
        appendLinkifiedComparison(contentDiv, contentText);
    } else {
        appendTextWithLineBreaks(contentDiv, contentText);
    }

    setupAccordion(header, contentDiv, expandBtn);
    card.append(header, contentDiv);
    return card;
}

function createSeadexCard(release: ReleaseEntry): HTMLElement {
    const { releaseGroup, dualAudio, isBest, privateTracker, tags, tracker, fileSize, url, episodeList } = release;
    const card = createCardContainer();
    card.className = "seadex-result-card";

    const header = createCardHeader();
    const titleContainer = createTitleContainer(releaseGroup ?? "Unknown Group", releaseGroup);

    const allFlags: string[] = [];
    if (dualAudio) allFlags.push("Dual Audio");
    if (isBest) allFlags.push("Best Release");
    if (privateTracker) allFlags.push("Private Tracker");
    if (tags?.length) allFlags.push(...tags);

    if (allFlags.length > 0) {
        const flagsText = allFlags.join(" • ");
        const flagsSpan = document.createElement("span");
        flagsSpan.style.cssText = `font-size: 0.85em; color: ${COLOUR_BLUE_PRIMARY}; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 0;`;
        flagsSpan.textContent = flagsText;
        flagsSpan.title = flagsText;
        titleContainer.append(flagsSpan);
    }

    const actionsContainer = createActionContainer();
    if (tracker) {
        const trackerSpan = document.createElement("span");
        trackerSpan.style.cssText = "margin-right: 0.5rem; font-weight: 600;";
        trackerSpan.textContent = tracker;
        trackerSpan.title = tracker;
        actionsContainer.append(trackerSpan);
    }

    const sizeSpan = document.createElement("span");
    sizeSpan.style.cssText = `color: ${COLOUR_GREEN}; font-weight: 600; min-width: 80px; text-align: right; margin-right: 0.5rem;`;
    sizeSpan.textContent = fileSize ?? "";
    actionsContainer.append(sizeSpan);

    if (url) {
        if (/^https?:\/\//i.test(url)) {
            actionsContainer.append(createLinkButton("🔗", "Open URL", url, COLOUR_BLUE_PRIMARY));
        } else {
            const copyBtn = createActionButton("🔒", "Copy Path", COLOUR_BLUE_PRIMARY, (ev) => {
                ev.stopPropagation();
                copyToClipboard(url, copyBtn, "✓", "🔒");
            });
            actionsContainer.append(copyBtn);
        }
    }

    const expandBtn = createExpandButton();
    actionsContainer.append(expandBtn);
    header.append(titleContainer, actionsContainer);

    const details = createDetailsContainer();
    if (episodeList?.length) {
        const episodesHeader = document.createElement("div");
        episodesHeader.textContent = "Episodes:";
        episodesHeader.style.cssText = "font-weight: 600; margin-bottom: 0.5rem; margin-top: 0.5rem;";
        details.append(episodesHeader);

        const list = document.createElement("ul");
        list.style.cssText = "list-style: none; padding-left: 0.5rem; margin: 0;";
        episodeList.forEach(({ name, size }) => {
            const li = document.createElement("li");
            li.style.cssText = `padding: 0.25rem 0; border-bottom: 1px solid ${COLOUR_SURFACE_TRANSPARENT}; display: flex; justify-content: space-between;`;
            const nSpan = document.createElement("span");
            nSpan.textContent = `📄 ${name ?? "Unknown Episode"}`;
            const sSpan = document.createElement("span");
            sSpan.textContent = size ?? "";
            sSpan.style.opacity = "0.8";
            li.append(nSpan, sSpan);
            list.append(li);
        });
        details.append(list);
    }

    card.append(header, details);
    setupAccordion(header, details, expandBtn);

    return card;
}

// 5. Nyaa Panel

type SortCriteria = 'seeders' | 'date' | 'size' | 'completed';

// Augmented metadata for sorting performance
interface NyaaMetadataEnhanced extends NyaaMetadata {
    _parsedSize?: number;
    _parsedDate?: number;
    _parsedSeeders?: number;
    _parsedCompleted?: number;
}

const nyaaState = {
    sortCriteria: 'seeders' as SortCriteria,
    abortController: null as AbortController | null,
    results: [] as NyaaMetadataEnhanced[],
    cachedEpisodes: null as Episode[] | null,
    cachedAnilistId: null as number | null,
    filterText: '' as string,
    filterMode: 'include' as 'include' | 'exclude',
};

function injectPanelStyles() {
    if (document.getElementById("nyaa-panel-styles")) return;
    const style = document.createElement("style");
    style.id = "nyaa-panel-styles";
    style.textContent = `
        .nyaa-panel-row {
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .nyaa-radio-group {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .nyaa-rss-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-left: auto;
        }
        .nyaa-sort-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        .nyaa-filter-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-left: auto;
        }
        .nyaa-panel-row input,
        .nyaa-panel-row button,
        .nyaa-panel-row select {
            box-sizing: border-box;
            vertical-align: middle;
            font-family: inherit;
            height: 2.0em;
            margin: 0;
            line-height: normal;
        }
        @media (max-width: 1000px) {
            .nyaa-rss-group, .nyaa-filter-group {
                margin-left: 0;
                width: 100%;
                margin-top: 0.25rem;
                justify-content: flex-end;
            }
            .nyaa-rss-group .nyaa-rss-controls {
                width: 100%;
                flex-grow: 1;
            }
            .nyaa-rss-group input, .nyaa-filter-group input {
                flex-grow: 1;
                width: auto !important;
                max-width: none !important;
                min-width: 0 !important;
            }
             /* Ensure Radio buttons don't get squished too much, but allow wrapping */
            .nyaa-radio-group {
                flex-wrap: wrap;
            }
        }
    `;
    document.head.append(style);
}

export async function renderNyaaPanel(anilistId: number): Promise<void> {
    const existingPanel = document.getElementById(NYAA_PANEL_ID);
    if (existingPanel && existingPanel.dataset.anilistId !== String(anilistId)) {
        existingPanel.remove();
    }
    if (existingPanel) return;

    injectPanelStyles();

    const content = document.createElement("div");
    const header = document.createElement("h2");
    header.textContent = "Nyaa Releases";
    header.className = "section-header";
    content.append(header);

    const contentWrap = document.createElement("div");
    contentWrap.className = "content-wrap";

    const headerRow = document.createElement("div");
    headerRow.className = "nyaa-panel-row";

    const radioGroup = document.createElement("div");
    radioGroup.className = "nyaa-radio-group";

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
        label.append(input, text);
        return [label, input];
    };

    const [fullReleaseLabel, fullReleasesRadio] = createRadioLabel("nyaa-full-releases", "full-releases", "Full Releases", true);
    const [episodeReleaseLabel, episodeReleasesRadio] = createRadioLabel("nyaa-episode-releases", "episode-releases", "Episode Releases");

    radioGroup.append(fullReleaseLabel, episodeReleaseLabel);

    const handleRadioChange = () => {
        if (nyaaState.abortController) handleNyaaSearchStreaming(anilistId);
    };
    fullReleasesRadio.addEventListener("change", handleRadioChange);
    episodeReleasesRadio.addEventListener("change", handleRadioChange);

    // Filter Controls
    const filterGroup = document.createElement("div");
    filterGroup.className = "nyaa-filter-group";

    const filterInput = document.createElement("input");
    filterInput.type = "text";
    filterInput.placeholder = "Filter...";
    filterInput.style.cssText = `${CONTROL_STYLE} min-width: 180px; flex-grow: 1;`;
    filterInput.addEventListener("input", () => {
        nyaaState.filterText = filterInput.value;
        applyFilter();
    });

    const filterToggleBtn = document.createElement("button");
    filterToggleBtn.textContent = "Include";
    filterToggleBtn.title = "Toggle Filter Mode";
    filterToggleBtn.style.cssText = `padding: 0.35rem 0.5rem; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9em; min-width: 80px; text-align: center; background: ${COLOUR_BLUE_PRIMARY};`;

    filterToggleBtn.addEventListener("click", () => {
        nyaaState.filterMode = nyaaState.filterMode === 'include' ? 'exclude' : 'include';
        updateFilterToggleBtn();
        applyFilter();
    });

    function updateFilterToggleBtn() {
        const isInclude = nyaaState.filterMode === 'include';
        filterToggleBtn.textContent = isInclude ? "Include" : "Exclude";
        filterToggleBtn.style.background = isInclude ? COLOUR_BLUE_PRIMARY : COLOUR_RED;
    }

    updateFilterToggleBtn();
    filterGroup.append(filterInput, filterToggleBtn);

    const dropdownRow = document.createElement("div");
    dropdownRow.style.cssText = "display: none; margin-bottom: 2rem; margin-top: 2rem;";

    const episodeSelect = document.createElement("select");
    episodeSelect.id = "nyaa-episode-select";
    episodeSelect.style.cssText = "padding: 0.25rem 0.5rem; max-width: 100%; box-sizing: border-box;";
    dropdownRow.append(episodeSelect);

    const controlsRow = document.createElement("div");
    controlsRow.className = "nyaa-panel-row";

    const sortGroup = document.createElement("div");
    sortGroup.className = "nyaa-sort-group";

    const searchBtn = document.createElement("button");
    searchBtn.id = "search-nyaa-btn";
    searchBtn.textContent = "Start Search";
    searchBtn.className = "button";
    searchBtn.style.cssText = "padding: 0.35rem 1rem; cursor: pointer; flex-shrink: 0; font-size: 0.9em;";
    searchBtn.addEventListener("click", () => handleNyaaSearchStreaming(anilistId));

    const sortLabel = document.createElement("span");
    sortLabel.textContent = "Sort:";
    sortLabel.style.cssText = "margin-left: 1rem; font-size: 0.9em;";

    const createSortBtn = (label: string, criteria: SortCriteria): HTMLButtonElement => {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.className = "button";
        btn.dataset.sortCriteria = criteria;
        const isActive = criteria === nyaaState.sortCriteria;
        btn.style.cssText = `padding: 0.35rem 0.5rem; cursor: pointer; font-size: 0.9em; border-radius: 4px; border: none; background: ${isActive ? COLOUR_BLUE_PRIMARY : COLOUR_BLUE_SECONDARY}; color: white; flex-shrink: 0;`;
        btn.addEventListener("click", () => handleSortChange(criteria));
        return btn;
    };

    sortGroup.append(
        searchBtn,
        sortLabel,
        createSortBtn("Seeders", "seeders"),
        createSortBtn("Date", "date"),
        createSortBtn("Size", "size"),
        createSortBtn("Completed", "completed")
    );

    // RSS Feed Controls
    const rssGroup = document.createElement("div");
    rssGroup.className = "nyaa-rss-group";

    const rssControls = document.createElement("div");
    rssControls.className = "nyaa-rss-controls";
    rssControls.style.cssText = "display: none; align-items: center; gap: 0.5rem; flex-shrink: 1; min-width: 0;";

    const submitterInput = document.createElement("input");
    submitterInput.type = "text";
    submitterInput.placeholder = "Submitter (e.g. SubsPlease)";
    submitterInput.title = submitterInput.placeholder;
    submitterInput.style.cssText = `${CONTROL_STYLE} width: 180px; min-width: 80px; flex-shrink: 1; flex-grow: 1;`;

    const queryInput = document.createElement("input");
    queryInput.type = "text";
    queryInput.placeholder = "Query (e.g. One Piece 1080p)";
    queryInput.title = queryInput.placeholder;
    queryInput.style.cssText = `${CONTROL_STYLE} width: 180px; min-width: 80px; flex-shrink: 1; flex-grow: 1;`;

    const rssActionBtn = document.createElement("button");
    rssActionBtn.textContent = "Setup RSS";
    rssActionBtn.style.cssText = `padding: 0.35rem 0.5rem; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9em; background: ${COLOUR_BLUE_PRIMARY}; min-width: 80px; text-align: center;`;

    rssActionBtn.addEventListener("click", async () => {
        const isHidden = rssControls.style.display === "none";
        if (isHidden) {
            rssControls.style.display = "flex";
            rssActionBtn.textContent = "Copy RSS";
        } else {
            const u = submitterInput.value.trim().replace(/\s+/g, "+");
            const q = queryInput.value.trim().replace(/\s+/g, "+");
            let url = "https://nyaa.si/?page=rss" + (u ? `&u=${u}` : "") + (q ? `&q=${q}` : "");

            try {
                await navigator.clipboard.writeText(url);
                rssActionBtn.textContent = "✓";
                setTimeout(() => { rssActionBtn.textContent = "Copy RSS"; }, 1000);
            } catch {
                window.prompt("Copy RSS", url);
            }
        }
    });

    rssControls.append(submitterInput, queryInput);
    rssGroup.append(rssControls, rssActionBtn);

    // Assemble Rows
    headerRow.append(radioGroup, rssGroup);
    controlsRow.append(sortGroup, filterGroup);

    const updateEpisodeSelectVisibility = async () => {
        if (episodeReleasesRadio.checked) {
            dropdownRow.style.display = "block";
            if (!nyaaState.cachedEpisodes || nyaaState.cachedAnilistId !== anilistId) {
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

    const resultsArea = document.createElement("div");
    resultsArea.id = "nyaa-results";

    contentWrap.append(headerRow, dropdownRow, controlsRow, resultsArea);
    content.append(contentWrap);

    // Mount logic: After Seadex if possible
    placePanel(NYAA_PANEL_ID, anilistId, content, SEADEX_PANEL_ID);
}

export function ensureNyaaPanelPlacement(currentAniId: number | null): void {
    const nyaaPanel = document.getElementById(NYAA_PANEL_ID);
    if (!nyaaPanel || !currentAniId) return;
    insertPanel(nyaaPanel, SEADEX_PANEL_ID);
}

// Nyaa Search Logic

async function handleNyaaSearchStreaming(anilistId: number): Promise<void> {
    const resultsArea = document.getElementById("nyaa-results");
    const searchBtn = document.getElementById("search-nyaa-btn") as HTMLButtonElement;
    if (!resultsArea || !searchBtn) return;

    if (nyaaState.abortController) {
        nyaaState.abortController.abort();
        nyaaState.abortController = null;
        searchBtn.textContent = "Start Search";
        const statusText = document.getElementById("nyaa-search-status");
        if (statusText) {
            statusText.textContent = `Search stopped. Found ${nyaaState.results.length} sources`;
            statusText.style.color = COLOUR_RED;
        }
        return;
    }

    nyaaState.results = [];


    const currentController = new AbortController();
    nyaaState.abortController = currentController;
    searchBtn.textContent = "Stop Search";

    const fullRelease =
        (document.querySelector('input[name="nyaa-release-type"]:checked') as HTMLInputElement)?.value === "full-releases";
    const episodeSelect = document.getElementById("nyaa-episode-select") as HTMLSelectElement;
    const selectedEpisode = episodeSelect?.value;

    if (!fullRelease && !selectedEpisode) {
        resultsArea.textContent = "";
        const errorMsg = document.createElement("p");
        errorMsg.style.cssText = `color: ${COLOUR_RED}; margin-top: 1rem;`;
        errorMsg.textContent = "Please select an episode";
        resultsArea.append(errorMsg);
        nyaaState.abortController = null;
        searchBtn.textContent = "Start Search";
        return;
    }

    resultsArea.textContent = "";

    const statusText = document.createElement("p");
    statusText.id = "nyaa-search-status";
    statusText.style.marginTop = "0.5rem";
    statusText.style.color = COLOUR_GREEN;
    statusText.textContent = "Searching Nyaa... Found 0 sources";

    const resultsContainer = document.createElement("div");
    resultsContainer.id = "nyaa-results-list";
    resultsContainer.style.cssText = `${FLEX_COLUMN_GAP_HALF} margin-top: 1rem;`;

    resultsArea.append(statusText, resultsContainer);

    try {
        const anidbApi = new AnidbIdApi();
        let generator: AsyncGenerator<NyaaMetadata, void, unknown>;

        if (fullRelease) {
            const mapping = await anidbApi.getAnidbId(anilistId);
            if (!mapping) {
                resultsArea.textContent = "";
                const errorP = document.createElement("p");
                errorP.style.cssText = `color: ${COLOUR_RED}; margin-top: 1rem;`;
                errorP.textContent = "Failed to get AniDB mapping";
                resultsArea.append(errorP);
                nyaaState.abortController = null;
                searchBtn.textContent = "Start Search";
                return;
            }
            generator = anidbApi.streamAnimetoshoMetadata(mapping.anidb_id, null, nyaaState.abortController.signal);
        } else {
            generator = anidbApi.streamNyaaAnidbEpisodeMetadata(anilistId, selectedEpisode!, nyaaState.abortController.signal);
        }

        for await (const result of generator) {
            if (currentController.signal.aborted) break;

            const enhancedResult = result as NyaaMetadataEnhanced;
            const { fileSize, date, seeders, completed } = enhancedResult;

            enhancedResult._parsedSize = parseFileSize(fileSize);
            enhancedResult._parsedDate = new Date(date ?? "1970-01-01").getTime();
            enhancedResult._parsedSeeders = parseInt(seeders ?? "0");
            enhancedResult._parsedCompleted = parseInt(completed ?? "0");

            const idx = nyaaState.results.length;
            nyaaState.results.push(enhancedResult);

            const card = createNyaaCard(enhancedResult, idx);
            const pos = getInsertPosition(resultsContainer, enhancedResult, nyaaState.sortCriteria);

            if (pos >= resultsContainer.children.length) resultsContainer.append(card);
            else resultsContainer.insertBefore(card, resultsContainer.children[pos]);

            applyFilter();
            if (!currentController.signal.aborted) {
                statusText.textContent = `Searching Nyaa... Found ${nyaaState.results.length} sources`;
            }
        }

        if (nyaaState.abortController === currentController) {
            statusText.style.color = COLOUR_BLUE_PRIMARY;
            const count = nyaaState.results.length;
            statusText.textContent = count === 0 ? "No releases found with active seeders" : `Search complete. Found ${count} sources`;
        }
    } catch (e) {
        if ((e as Error).name !== "AbortError" && nyaaState.abortController === currentController) {
            resultsArea.textContent = "";
            const p = document.createElement("p");
            p.style.cssText = `color: ${COLOUR_RED}; margin-top: 1rem;`;
            p.textContent = "Error searching Nyaa (Animetosho.org may not have indexed any releases)";
            resultsArea.append(p);
        }
    } finally {
        if (nyaaState.abortController === currentController) {
            nyaaState.abortController = null;
            searchBtn.textContent = "Start Search";
        }
    }
}

function createNyaaCard(release: NyaaMetadata, index: number): HTMLElement {
    const { releaseName, seeders, magnet, url, category, leechers, date, fileSize, completed, files } = release;
    const card = createCardContainer();
    card.className = "nyaa-result-card";
    card.dataset.resultIndex = String(index);

    const header = createCardHeader();
    const title = createSimpleTitle(releaseName ?? "Unknown Release");
    const actionsContainer = createActionContainer();

    const sSpan = document.createElement("span");
    sSpan.style.cssText = `color: ${COLOUR_GREEN}; font-weight: 600; min-width: 90px; text-align: right; margin-right: 0.5rem;`;
    sSpan.textContent = `${seeders ?? "0"} Seeders`;
    actionsContainer.append(sSpan);

    actionsContainer.append(createActionButton("🧲", "Open Magnet", COLOUR_BLUE_PRIMARY, (ev) => {
        ev.stopPropagation();
        window.location.href = magnet;
    }));

    const copyBtn = createActionButton("📋", "Copy Magnet", COLOUR_BLUE_PRIMARY, (ev) => {
        ev.stopPropagation();
        copyToClipboard(magnet, copyBtn, "✓", "📋");
    });
    actionsContainer.append(copyBtn);

    if (url) actionsContainer.append(createLinkButton("🔗", "Open URL", url, COLOUR_BLUE_PRIMARY));

    const expandBtn = createExpandButton();
    actionsContainer.append(expandBtn);
    header.append(title, actionsContainer);

    const details = createDetailsContainer();
    const fullTitle = document.createElement("div");
    fullTitle.style.cssText = "font-weight: 600; margin-bottom: 0.75rem; word-break: break-word;";
    fullTitle.textContent = releaseName ?? "Unknown Release";
    details.append(fullTitle);

    const createRow = () => {
        const row = document.createElement("div");
        row.style.cssText = `${FLEX_ROW_WRAP} margin-bottom: 0.5rem;`;
        return row;
    };

    const row1 = createRow();
    row1.append(
        createDetailSpan("Category:", category ?? "Unknown"),
        createDetailSpan("Seeders:", seeders ?? "0", COLOUR_GREEN),
        createDetailSpan("Leechers:", leechers ?? "0", COLOUR_RED)
    );

    const row2 = createRow();
    row2.append(
        createDetailSpan("Date:", date ?? "Unknown"),
        createDetailSpan("Size:", fileSize ?? "Unknown"),
        createDetailSpan("Completed:", completed ?? "0")
    );

    details.append(row1, row2, createDetailSpan("Submitter:", release.submitter ?? "Unknown"));

    if (files?.length) {
        details.append(createFileSection(files));
    }

    card.append(header, details);
    setupAccordion(header, details, expandBtn);

    return card;
}

function createFileSection(files: NyaaFileEntry[]): HTMLElement {
    const section = document.createElement("div");
    section.style.cssText = "margin-top: 0.75rem;";

    const toggle = document.createElement("a");
    toggle.textContent = "📁 Show Files";
    toggle.className = "link";
    toggle.style.cursor = "pointer";

    const container = document.createElement("div");
    container.style.cssText = "display: none; margin-top: 0.5rem;";

    toggle.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const isHidden = container.style.display === "none";
        container.style.display = isHidden ? "block" : "none";
        toggle.textContent = isHidden ? "📁 Hide Files" : "📁 Show Files";
    });

    container.append(renderFileTree(files));
    section.append(toggle, container);
    return section;
}

function renderFileTree(entries: NyaaFileEntry[], depth: number = 0): HTMLUListElement {
    const ul = document.createElement("ul");
    ul.style.cssText = `padding-left: ${depth === 0 ? "1rem" : "1.5rem"}; margin: 0; list-style: none;`;

    entries.forEach(entry => {
        const li = document.createElement("li");
        li.style.cssText = "margin: 0.25rem 0;";

        if (entry.type === "folder") {
            li.textContent = `📁 ${entry.name ?? "Unnamed Folder"}`;
            if (entry.contents?.length) {
                li.append(renderFileTree(entry.contents, depth + 1));
            }
        } else {
            li.textContent = `📄 ${entry.name ?? "Unnamed File"}${entry.size ? ` (${entry.size})` : ""}`;
        }
        ul.append(li);
    });

    return ul;
}

// Sort logic
function compareBySort(a: NyaaMetadataEnhanced, b: NyaaMetadataEnhanced, criteria: SortCriteria): number {
    const map: Record<SortCriteria, keyof NyaaMetadataEnhanced> = {
        seeders: '_parsedSeeders',
        date: '_parsedDate',
        size: '_parsedSize',
        completed: '_parsedCompleted'
    };
    const key = map[criteria];
    return (Number(b[key] ?? 0)) - (Number(a[key] ?? 0));
}

// Apply filter to results
function applyFilter(): void {
    const resultsContainer = document.getElementById("nyaa-results-list");
    if (!resultsContainer) return;

    const filterText = nyaaState.filterText.toLowerCase().trim();
    const tokens = filterText.split(/\s+/).filter(t => t.length > 0);
    const cards = resultsContainer.querySelectorAll<HTMLElement>("[data-result-index]");

    cards.forEach(card => {
        const idx = parseInt(card.dataset.resultIndex ?? "0");
        const result = nyaaState.results[idx];
        if (!result) return;

        const name = (result.releaseName ?? "").toLowerCase();

        // If filter is empty, show everything (unless it's include mode, but empty tokens handle that)
        if (tokens.length === 0) {
            card.style.display = "";
            return;
        }

        let shouldShow = false;
        if (nyaaState.filterMode === 'include') {
            // Include mode: ALL tokens must be present
            const matchesAll = tokens.every(token => name.includes(token));
            shouldShow = matchesAll;
        } else {
            // Exclude mode: Hide if ANY token matches
            const matchesAny = tokens.some(token => name.includes(token));
            shouldShow = !matchesAny;
        }

        card.style.display = shouldShow ? "" : "none";
    });
}

// Find insertion point for sorted streaming
function getInsertPosition(resultsContainer: HTMLElement, newResult: NyaaMetadataEnhanced, criteria: SortCriteria): number {
    const cards = resultsContainer.querySelectorAll<HTMLElement>("[data-result-index]");
    for (let i = 0; i < cards.length; i++) {
        const idx = parseInt(cards[i].dataset.resultIndex ?? "0");
        if (compareBySort(newResult, nyaaState.results[idx], criteria) < 0) {
            return i;
        }
    }
    return cards.length;
}

function handleSortChange(criteria: SortCriteria): void {
    nyaaState.sortCriteria = criteria;

    document.querySelectorAll<HTMLButtonElement>("[data-sort-criteria]").forEach(btn => {
        if (btn.dataset.sortCriteria === criteria) {
            btn.style.background = COLOUR_BLUE_PRIMARY;
        } else {
            btn.style.background = COLOUR_BLUE_SECONDARY;
        }
    });

    const resultsContainer = document.getElementById("nyaa-results-list");
    if (!resultsContainer || nyaaState.results.length === 0) return;

    const sortedIndices = nyaaState.results
        .map((_: NyaaMetadataEnhanced, idx: number) => idx)
        .sort((a: number, b: number) => compareBySort(nyaaState.results[a], nyaaState.results[b], criteria));

    const cards = Array.from(resultsContainer.querySelectorAll<HTMLElement>("[data-result-index]"));
    const fragment = document.createDocumentFragment();

    sortedIndices.forEach((idx: number) => {
        const card = cards.find(c => c.dataset.resultIndex === String(idx));
        if (card) fragment.append(card);
    });

    resultsContainer.replaceChildren(fragment);
}

// Load AniDB titles/episodes
async function loadEpisodeData(anilistId: number): Promise<Episode[]> {
    if (nyaaState.cachedEpisodes && nyaaState.cachedAnilistId === anilistId) {
        return nyaaState.cachedEpisodes;
    }

    const api = new AnidbIdApi();
    const result = await api.getAnidbId(anilistId);

    if (result?.episodes) {
        const regularEpisodes = result.episodes.filter((episode) => {
            const epNum = parseInt(episode.episode, 10);
            return !isNaN(epNum) && epNum > 0;
        });

        regularEpisodes.sort((a, b) => parseInt(a.episode, 10) - parseInt(b.episode, 10));

        nyaaState.cachedEpisodes = regularEpisodes;
        nyaaState.cachedAnilistId = anilistId;
        return regularEpisodes;
    }

    nyaaState.cachedEpisodes = [];
    nyaaState.cachedAnilistId = anilistId;
    return [];
}

// Update dropdown options
function populateEpisodeDropdown(select: HTMLSelectElement, episodes: Episode[]): void {
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Episode...";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.append(placeholder);

    episodes.forEach(({ episode, title }) => {
        const option = document.createElement("option");
        option.value = episode;
        option.textContent = `Episode ${episode}${title ? ` - ${title}` : ""}`;
        select.append(option);
    });
}
