import type { ReleaseData, ReleaseEntry } from "./seadex_api";
import { AnidbIdApi, type Episode } from "./anidb_id_api";
import type { NyaaMetadata, NyaaFileEntry } from "./nyaa_scraper";

// Constants

export const SEADEX_PANEL_ID = "seadex-panel";
export const NYAA_PANEL_ID = "nyaa-panel";

const COLOURS = {
    BLUE_PRIMARY: "rgba(61, 180, 242, 1)",
    BLUE_SECONDARY: "rgba(61, 180, 242, 0.65)",
    GREEN: "rgba(104, 214, 57, 1)",
    RED: "rgba(236, 41, 75, 1)",
    BG_TRANSPARENT: "rgba(var(--color-foreground-rgb, 92,114,138), 0.05)",
    SURFACE_TRANSPARENT: "rgba(var(--color-foreground-rgb, 92,114,138), 0.1)",
    BORDER_TRANSPARENT: "rgba(var(--color-foreground-rgb, 92,114,138), 0.3)",
    BORDER_DETAILS: "rgba(var(--color-foreground-rgb, 92,114,138), 0.2)",
    BORDER_CONTROL: "rgba(var(--color-foreground-rgb, 92,114,138), 0.5)",
    BG_META: "rgba(var(--color-background-rgb), 0.6)",
} as const;

const STYLES = {
    BASE_BTN: "border: 1px solid transparent; cursor: pointer; font-size: 0.9em; padding: 0.35rem 0.5rem; border-radius: 4px; color: white; min-width: 2.6em; text-align: center; box-sizing: border-box;",
    CONTROL: `padding: 0.35rem 0.5rem; border: 1px solid ${COLOURS.BORDER_CONTROL}; border-radius: 4px; font-size: 0.9em; background: transparent; color: inherit; box-sizing: border-box; vertical-align: middle; line-height: normal;`,
    FLEX_COL_GAP_HALF: "display: flex; flex-direction: column; gap: 0.5rem;",
    FLEX_COL_GAP_ONE: "display: flex; flex-direction: column; gap: 1rem;",
    CARD_BASE: `border: 1px solid ${COLOURS.BORDER_TRANSPARENT}; border-radius: 6px; overflow: hidden; transition: all 0.2s ease; contain: content;`,
    CARD_HEADER: `display: flex; align-items: center; padding: 0.75rem 1rem; gap: 0.75rem; background: ${COLOURS.BG_TRANSPARENT}; cursor: pointer;`,
    EXPAND_BTN: `font-size: 1.4em; font-weight: 600; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 4px; background: ${COLOURS.SURFACE_TRANSPARENT};`,
} as const;

const REGEX = {
    URL: /(https?:\/\/[^\s,]+)/g,
    LINE_BREAKS: /\n+/,
    FILE_SIZE: /^([\d.]+)\s*(bytes|[KMGT]iB|[KMGT]B)?$/i,
} as const;

const UNIT_MULTIPLIERS: Readonly<Record<string, number>> = {
    "": 1, "BYTES": 1,
    "KIB": 1024, "KB": 1000,
    "MIB": 1024 ** 2, "MB": 1000 ** 2,
    "GIB": 1024 ** 3, "GB": 1000 ** 3,
    "TIB": 1024 ** 4, "TB": 1000 ** 4,
};

// Types

type SortCriteria = "seeders" | "date" | "size" | "completed";
type FilterMode = "include" | "exclude";

interface MakeProps {
    className?: string;
    id?: string;
    style?: string | Partial<CSSStyleDeclaration>;
    text?: string;
    attrs?: Record<string, string>;
    events?: Partial<Record<keyof HTMLElementEventMap, EventListener>>;
    dataset?: Record<string, string>;
    [key: string]: unknown;
}

interface ListItemOptions {
    valueColour?: string;
    aligned?: boolean;
    bold?: boolean;
    boldValue?: boolean;
}

interface NyaaMetadataEnhanced extends NyaaMetadata {
    _parsedSize?: number;
    _parsedDate?: number;
    _parsedSeeders?: number;
    _parsedCompleted?: number;
    _card?: HTMLElement;
}

interface NyaaState {
    sortCriteria: SortCriteria;
    abortController: AbortController | null;
    results: NyaaMetadataEnhanced[];
    cardMap: Map<number, HTMLElement>;
    cachedEpisodes: Episode[] | null;
    cachedAnilistId: number | null;
    filterText: string;
    filterMode: FilterMode;
}

// State

const nyaaState: NyaaState = {
    sortCriteria: "seeders",
    abortController: null,
    results: [],
    cardMap: new Map(),
    cachedEpisodes: null,
    cachedAnilistId: null,
    filterText: "",
    filterMode: "include",
};

const fileSizeCache = new Map<string, number>();

// DOM Utilities
function make<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    props: MakeProps = {},
    children: (Node | string | null | undefined | false)[] = [],
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tagName);

    const { className, id, style, text, attrs, events, dataset, ...rest } = props;

    if (className) el.className = className;
    if (id) el.id = id;
    if (text) el.textContent = text;

    // Apply styles
    if (typeof style === "string") {
        el.style.cssText = style;
    } else if (style) {
        Object.assign(el.style, style);
    }

    // Apply HTML attributes
    if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            el.setAttribute(key, value);
        }
    }

    // Apply dataset
    if (dataset) {
        Object.assign(el.dataset, dataset);
    }

    // Apply event listeners
    if (events) {
        for (const [eventName, handler] of Object.entries(events)) {
            el.addEventListener(eventName, handler as EventListener);
        }
    }

    // Apply remaining standard DOM properties (href, type, value, etc.)
    Object.assign(el, rest);

    // Append children
    for (const child of children) {
        if (!child) continue;
        el.append(typeof child === "string" ? document.createTextNode(child) : child);
    }

    return el;
}

function createList(items: HTMLElement[]): HTMLUListElement {
    const list = make("ul", { style: "list-style: none; padding: 0; margin: 0;" });
    const fragment = document.createDocumentFragment();
    for (const item of items) fragment.append(item);
    list.append(fragment);
    return list;
}

function createListItem(
    label: string,
    value: string,
    opts: ListItemOptions = {},
): HTMLLIElement {
    const { valueColour, aligned = true, bold = true, boldValue = false } = opts;

    const containerStyle = aligned
        ? `padding: 0.35rem 0; border-bottom: 1px solid ${COLOURS.SURFACE_TRANSPARENT}; display: grid; grid-template-columns: 1fr 80px; gap: 6em; align-items: baseline;`
        : `padding: 0.35rem 0; border-bottom: 1px solid ${COLOURS.SURFACE_TRANSPARENT}; display: flex; justify-content: flex-start; align-items: baseline; gap: 0.75rem;`;

    const labelStyle = `font-weight: ${bold ? "600" : "400"}; overflow-wrap: anywhere; word-break: break-all; min-width: 0;`;

    const valueStyleParts: string[] = [
        `font-weight: ${boldValue ? "600" : "400"}`,
        "white-space: nowrap",
        "flex-shrink: 0",
    ];
    if (aligned) valueStyleParts.push("text-align: right");
    if (valueColour) valueStyleParts.push(`color: ${valueColour}`);

    return make("li", { style: containerStyle }, [
        make("span", { style: labelStyle, text: label }),
        make("span", { style: `${valueStyleParts.join("; ")};`, text: value }),
    ]);
}

function createDetailRow(items: HTMLElement[]): HTMLElement {
    for (const item of items) {
        item.style.borderBottom = "none";
        item.style.padding = "0";
    }

    return make("div", {
        style: `display: flex; flex-wrap: wrap; gap: 1.5rem; border-bottom: 1px solid ${COLOURS.SURFACE_TRANSPARENT}; padding: 0.35rem 0;`,
    }, items);
}

function createLinkifiedText(text: string): (string | Node)[] {
    const nodes: (string | Node)[] = [];
    const lines = text.split(REGEX.LINE_BREAKS);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        let lastIndex = 0;

        // Reset regex state for each line
        REGEX.URL.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = REGEX.URL.exec(line)) !== null) {
            if (match.index > lastIndex) {
                nodes.push(line.slice(lastIndex, match.index));
            }
            nodes.push(make("a", {
                href: match[0],
                text: match[0],
                target: "_blank",
                rel: "noopener noreferrer",
            }));
            lastIndex = REGEX.URL.lastIndex;
        }

        if (lastIndex < line.length) {
            nodes.push(line.slice(lastIndex));
        }

        if (lineIdx < lines.length - 1) {
            nodes.push(make("br"));
        }
    }

    return nodes;
}

// Global Utilities

export function findAnchor(): HTMLElement | null {
    const mediaRoot = provisionalContainer();
    if (!mediaRoot) return null;

    const reviews = mediaRoot.querySelector(".reviews");
    if (reviews) return reviews.closest<HTMLElement>(".grid-section-wrap");

    const threads = mediaRoot.querySelector(".threads");
    if (threads) return threads.closest<HTMLElement>(".grid-section-wrap");

    return null;
}

export function provisionalContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".page-content .media.media-anime");
}

async function copyToClipboard(
    text: string,
    btn?: HTMLElement,
    successIcon = "✓",
    originalIcon?: string,
): Promise<void> {
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

function parseFileSize(sizeStr: string | undefined): number {
    if (!sizeStr) return 0;

    const cached = fileSizeCache.get(sizeStr);
    if (cached !== undefined) return cached;

    const match = sizeStr.match(REGEX.FILE_SIZE);
    if (!match) {
        fileSizeCache.set(sizeStr, 0);
        return 0;
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] ?? "").toUpperCase();
    const result = value * (UNIT_MULTIPLIERS[unit] ?? 1);

    fileSizeCache.set(sizeStr, result);
    return result;
}

// Panel Placement

function placePanel(
    panelId: string,
    anilistId: number,
    content: HTMLElement | null,
    afterElementId?: string,
): void {
    let panel = document.getElementById(panelId);

    if (!panel) {
        if (!content) return;

        const inner = make("div", { className: "section" }, [content]);
        panel = make("div", {
            id: panelId,
            className: "grid-section-wrap",
            dataset: { anilistId: String(anilistId), anchored: "false" },
        }, [inner]);

        insertPanel(panel, afterElementId);
        return;
    }

    // Stale ID guard — wait for cleanup/re-inject
    if (panel.dataset.anilistId && panel.dataset.anilistId !== String(anilistId)) {
        return;
    }

    insertPanel(panel, afterElementId);
}

function insertPanel(panel: HTMLElement, afterElementId?: string): void {
    const anchor = findAnchor();
    const provisional = provisionalContainer();
    const target = afterElementId ? document.getElementById(afterElementId) : null;

    // Priority 1: Place after a specific element (e.g. Nyaa after Seadex)
    if (target?.parentElement) {
        panel.style.marginTop = "2rem";
        if (panel.previousElementSibling !== target) {
            target.insertAdjacentElement("afterend", panel);
        }
        panel.dataset.anchored = "true";
        return;
    }

    // Priority 2: Place after the anchor (Reviews/Threads section)
    if (anchor?.parentElement) {
        panel.style.marginTop = "";
        if (panel.previousElementSibling !== anchor) {
            anchor.insertAdjacentElement("afterend", panel);
        }
        panel.dataset.anchored = "true";
        return;
    }

    // Priority 3: Append to provisional container
    if (provisional && panel.parentElement !== provisional) {
        provisional.append(panel);
    }
}

// Seadex Panel

export function renderSeadexPanel(data: ReleaseData, anilistId: number): void {
    const content = make("div", {}, [
        make("h2", { className: "section-header", text: "Seadex Releases" }),
        make("div", { className: "content-wrap list", style: STYLES.FLEX_COL_GAP_ONE }, [
            make("div", { style: `${STYLES.FLEX_COL_GAP_HALF} margin-bottom: 1rem;` }, [
                data.comparison ? createSeadexMetaCard("Comparison", data.comparison) : null,
                data.notes ? createSeadexMetaCard("Notes", data.notes) : null,
                data.theoreticalBest ? createSeadexMetaCard("Theoretical Best", data.theoreticalBest) : null,
            ]),
            make("div", { style: STYLES.FLEX_COL_GAP_HALF },
                data.releases.map(r => createSeadexCard(r)),
            ),
        ]),
    ]);

    placePanel(SEADEX_PANEL_ID, anilistId, content);
}

export function ensureSeadexPanelPlacement(currentAniId: number | null): void {
    const seadexPanel = document.getElementById(SEADEX_PANEL_ID);
    if (!seadexPanel || !currentAniId) return;
    insertPanel(seadexPanel);
}

function createSeadexMetaCard(title: string, contentText: string): HTMLElement {
    const contentNodes = createLinkifiedText(contentText);

    const expandBtn = make("span", { className: "expand-btn", text: "-", style: STYLES.EXPAND_BTN });
    const header = make("div", { className: "card-header", style: STYLES.CARD_HEADER }, [
        make("span", { style: "flex: 1; font-weight: 600;", text: title }),
        expandBtn,
    ]);

    const details = make("div", {
        className: "card-details",
        style: `display: block; padding: 1rem; border-top: 1px solid ${COLOURS.BORDER_DETAILS}; font-size: 0.9em; line-height: 1.5;`,
    }, contentNodes);

    const card = make("div", {
        className: "seadex-meta-card seadex-result-card",
        style: `${STYLES.CARD_BASE} background: ${COLOURS.BG_META};`,
    }, [header, details]);

    header.addEventListener("click", () => {
        const isHidden = details.style.display === "none";
        details.style.display = isHidden ? "block" : "none";
        expandBtn.textContent = isHidden ? "-" : "+";
    });

    return card;
}

function createSeadexCard(release: ReleaseEntry): HTMLElement {
    const { releaseGroup, dualAudio, isBest, privateTracker, tags, tracker, fileSize, url, episodeList } = release;

    // Title with badges
    const titleContainer = make("div", {
        style: "flex: 1; display: flex; align-items: center; overflow: hidden; gap: 0.5rem;",
    }, [
        make("span", {
            style: "font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; max-width: 80%;",
            text: releaseGroup ?? "Unknown Group",
            title: releaseGroup,
        }),
    ]);

    const allFlags: string[] = [];
    if (dualAudio) allFlags.push("Dual Audio");
    if (isBest) allFlags.push("Best Release");
    if (privateTracker) allFlags.push("Private Tracker");
    if (tags?.length) allFlags.push(...tags);

    if (allFlags.length > 0) {
        const flagsText = allFlags.join(" • ");
        titleContainer.append(make("span", {
            style: `font-size: 0.85em; color: ${COLOURS.BLUE_PRIMARY}; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 0;`,
            text: flagsText,
            title: flagsText,
        }));
    }

    // Action buttons
    const actionsContainer = make("div", {
        style: "display: flex; align-items: center; gap: 0.75rem; margin-left: auto; flex-shrink: 0;",
    });

    if (tracker) {
        actionsContainer.append(make("span", {
            style: "margin-right: 0.5rem; font-weight: 600;",
            text: tracker,
            title: tracker,
        }));
    }

    actionsContainer.append(make("span", {
        style: `color: ${COLOURS.GREEN}; font-weight: 600; min-width: 80px; text-align: right; margin-right: 0.5rem;`,
        text: fileSize ?? "",
    }));

    if (url) {
        if (/^https?:\/\//i.test(url)) {
            const linkBtn = make("a", {
                text: "🔗",
                title: "Open URL",
                href: url,
                target: "_blank",
                rel: "noopener noreferrer",
                style: `background: ${COLOURS.BLUE_PRIMARY}; text-decoration: none; display: inline-block; ${STYLES.BASE_BTN}`,
            });
            linkBtn.addEventListener("click", (ev) => ev.stopPropagation());
            actionsContainer.append(linkBtn);
        } else {
            const copyBtn = make("button", {
                text: "🔒",
                title: "Copy Path",
                style: `background: ${COLOURS.BLUE_PRIMARY}; ${STYLES.BASE_BTN}`,
                events: {
                    click: ((ev: Event) => {
                        ev.stopPropagation();
                        copyToClipboard(url, copyBtn, "✓", "🔒");
                    }) as EventListener,
                },
            });
            actionsContainer.append(copyBtn);
        }
    }

    const expandBtn = make("span", { className: "expand-btn", text: "+", style: STYLES.EXPAND_BTN });
    actionsContainer.append(expandBtn);

    // Collapsible details
    const details = make("div", {
        className: "card-details",
        style: `display: none; padding: 0.75rem 1rem; border-top: 1px solid ${COLOURS.BORDER_DETAILS}; font-size: 0.9em;`,
    });

    if (episodeList?.length) {
        details.append(
            make("div", { text: "Episodes:", style: "font-weight: 600; margin-bottom: 0.5rem; margin-top: 0.5rem;" }),
            createList(episodeList.map(({ name, size }) =>
                createListItem(`📄 ${name ?? "Unknown Episode"}`, size ?? "", { bold: false }),
            )),
        );
    }

    // Compose card
    const header = make("div", { className: "card-header", style: STYLES.CARD_HEADER }, [titleContainer, actionsContainer]);
    const card = make("div", { className: "seadex-result-card", style: STYLES.CARD_BASE }, [header, details]);

    header.addEventListener("click", () => {
        const isHidden = details.style.display === "none";
        details.style.display = isHidden ? "block" : "none";
        expandBtn.textContent = isHidden ? "-" : "+";
    });

    return card;
}

// Nyaa Panel

export async function renderNyaaPanel(anilistId: number): Promise<void> {
    const existing = document.getElementById(NYAA_PANEL_ID);
    if (existing && existing.dataset.anilistId !== String(anilistId)) existing.remove();
    if (document.getElementById(NYAA_PANEL_ID)) return;

    injectNyaaStyles();

    // Radio group
    const createRadio = (id: string, value: string, text: string, checked: boolean) => {
        const input = make("input", { type: "radio", id, name: "nyaa-release-type", value, checked: checked as unknown, style: "cursor: pointer;" });
        const label = make("label", { htmlFor: id, style: "display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;" }, [input, text]);
        return { input, label };
    };

    const fullRelease = createRadio("nyaa-full-releases", "full-releases", "Full Releases", true);
    const epRelease = createRadio("nyaa-episode-releases", "episode-releases", "Episode Releases", false);

    const handleTypeChange = () => {
        if (nyaaState.abortController) handleNyaaSearchStreaming(anilistId);
    };
    fullRelease.input.addEventListener("change", handleTypeChange);
    epRelease.input.addEventListener("change", handleTypeChange);

    // RSS controls
    const submitterInput = make("input", {
        type: "text",
        placeholder: "Submitter (e.g. SubsPlease)",
        title: "Submitter",
        style: `${STYLES.CONTROL} width: 180px; min-width: 80px; flex-shrink: 1; flex-grow: 1;`,
    });
    const queryInput = make("input", {
        type: "text",
        placeholder: "Query (e.g. One Piece 1080p)",
        title: "Query",
        style: `${STYLES.CONTROL} width: 180px; min-width: 80px; flex-shrink: 1; flex-grow: 1;`,
    });
    const rssControls = make("div", {
        className: "nyaa-rss-controls",
        style: "display: none; align-items: center; gap: 0.5rem; flex-shrink: 1; min-width: 0;",
    }, [submitterInput, queryInput]);

    const rssBtn = make("button", {
        text: "Setup RSS",
        style: `padding: 0.35rem 0.5rem; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9em; background: ${COLOURS.BLUE_PRIMARY}; min-width: 80px; text-align: center;`,
        events: {
            click: (async () => {
                if (rssControls.style.display === "none") {
                    rssControls.style.display = "flex";
                    rssBtn.textContent = "Copy RSS";
                } else {
                    const user = submitterInput.value.trim().replace(/\s+/g, "+");
                    const query = queryInput.value.trim().replace(/\s+/g, "+");
                    const rssUrl = "https://nyaa.si/?page=rss" + (user ? `&u=${user}` : "") + (query ? `&q=${query}` : "");
                    await copyToClipboard(rssUrl);
                    const original = rssBtn.textContent;
                    rssBtn.textContent = "✓";
                    setTimeout(() => { rssBtn.textContent = original; }, 1000);
                }
            }) as unknown as EventListener,
        },
    });

    // Sort & search controls
    const searchBtn = make("button", {
        id: "search-nyaa-btn",
        text: "Start Search",
        className: "button",
        style: "padding: 0.35rem 1rem; cursor: pointer; flex-shrink: 0; font-size: 0.9em;",
    });
    searchBtn.addEventListener("click", () => handleNyaaSearchStreaming(anilistId));

    const sortGroup = make("div", { className: "nyaa-sort-group" }, [
        searchBtn,
        make("span", { text: "Sort:", style: "margin-left: 1rem; font-size: 0.9em;" }),
        ...(["Seeders", "Date", "Size", "Completed"] as const).map(label => {
            const criteria = label.toLowerCase() as SortCriteria;
            return make("button", {
                text: label,
                className: "button",
                dataset: { sortCriteria: criteria },
                style: `padding: 0.35rem 0.5rem; cursor: pointer; font-size: 0.9em; border-radius: 4px; border: none; background: ${criteria === "seeders" ? COLOURS.BLUE_PRIMARY : COLOURS.BLUE_SECONDARY}; color: white; flex-shrink: 0;`,
                events: {
                    click: (() => handleSortChange(criteria)) as unknown as EventListener,
                },
            });
        }),
    ]);

    // Filter controls
    const filterInput = make("input", {
        type: "text",
        placeholder: "Filter...",
        style: `${STYLES.CONTROL} min-width: 180px; flex-grow: 1;`,
        events: {
            input: ((e: Event) => {
                nyaaState.filterText = (e.target as HTMLInputElement).value;
                applyFilter();
            }) as EventListener,
        },
    });

    const filterToggleBtn = make("button", {
        title: "Toggle Filter Mode",
        text: "Include",
        style: `padding: 0.35rem 0.5rem; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9em; min-width: 80px; text-align: center; background: ${COLOURS.BLUE_PRIMARY};`,
        events: {
            click: (() => {
                nyaaState.filterMode = nyaaState.filterMode === "include" ? "exclude" : "include";
                const isInc = nyaaState.filterMode === "include";
                filterToggleBtn.textContent = isInc ? "Include" : "Exclude";
                filterToggleBtn.style.background = isInc ? COLOURS.BLUE_PRIMARY : COLOURS.RED;
                applyFilter();
            }) as unknown as EventListener,
        },
    });

    // Episode dropdown
    const episodeSelect = make("select", {
        id: "nyaa-episode-select",
        style: "padding: 0.25rem 0.5rem; max-width: 100%; box-sizing: border-box;",
    });
    const dropdownRow = make("div", {
        style: "display: none; margin-bottom: 2rem; margin-top: 2rem;",
    }, [episodeSelect]);

    const updateDropdown = async () => {
        if (epRelease.input.checked) {
            dropdownRow.style.display = "block";
            if (!nyaaState.cachedEpisodes || nyaaState.cachedAnilistId !== anilistId) {
                episodeSelect.replaceChildren(make("option", { text: "Loading..." }));
                const eps = await loadEpisodeData(anilistId);
                episodeSelect.replaceChildren(
                    make("option", { value: "", text: "Select Episode...", disabled: "true", selected: "true" }),
                    ...eps.map(e => make("option", {
                        value: e.episode,
                        text: `Episode ${e.episode}${e.title ? ` - ${e.title}` : ""}`,
                    })),
                );
            }
        } else {
            dropdownRow.style.display = "none";
        }
    };
    fullRelease.input.addEventListener("change", updateDropdown);
    epRelease.input.addEventListener("change", updateDropdown);

    // Results area
    const resultsArea = make("div", { id: "nyaa-results" });
    setupResultsDelegation(resultsArea);

    // Assemble layout
    const content = make("div", {}, [
        make("h2", { className: "section-header", text: "Nyaa Releases" }),
        make("div", { className: "content-wrap" }, [
            make("div", { className: "nyaa-panel-row" }, [
                make("div", { className: "nyaa-radio-group" }, [fullRelease.label, epRelease.label]),
                make("div", { className: "nyaa-rss-group" }, [rssControls, rssBtn]),
            ]),
            dropdownRow,
            make("div", { className: "nyaa-panel-row" }, [
                sortGroup,
                make("div", { className: "nyaa-filter-group" }, [filterInput, filterToggleBtn]),
            ]),
            resultsArea,
        ]),
    ]);

    placePanel(NYAA_PANEL_ID, anilistId, content, SEADEX_PANEL_ID);
}

export function ensureNyaaPanelPlacement(currentAniId: number | null): void {
    const nyaaPanel = document.getElementById(NYAA_PANEL_ID);
    if (!nyaaPanel || !currentAniId) return;
    insertPanel(nyaaPanel, SEADEX_PANEL_ID);
}

function injectNyaaStyles(): void {
    if (document.getElementById("nyaa-panel-styles")) return;
    document.head.append(make("style", {
        id: "nyaa-panel-styles",
        text: `
        .nyaa-panel-row { display: flex; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
        .nyaa-radio-group { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .nyaa-rss-group { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
        .nyaa-sort-group { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .nyaa-filter-group { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
        .nyaa-panel-row input, .nyaa-panel-row button, .nyaa-panel-row select { height: 2.0em; margin: 0; }
        @media (max-width: 1000px) {
            .nyaa-rss-group, .nyaa-filter-group { margin-left: 0; width: 100%; margin-top: 0.25rem; justify-content: flex-end; }
            .nyaa-rss-group .nyaa-rss-controls { width: 100%; flex-grow: 1; }
            .nyaa-rss-group input, .nyaa-filter-group input { flex-grow: 1; width: auto !important; max-width: none !important; min-width: 0 !important; }
        }
        `,
    }));
}

// Nyaa Search & Streaming

async function handleNyaaSearchStreaming(anilistId: number): Promise<void> {
    const resultsArea = document.getElementById("nyaa-results");
    const searchBtn = document.getElementById("search-nyaa-btn") as HTMLButtonElement | null;
    if (!resultsArea || !searchBtn) return;

    // Handle stop
    if (nyaaState.abortController) {
        nyaaState.abortController.abort();
        nyaaState.abortController = null;
        searchBtn.textContent = "Start Search";
        const status = document.getElementById("nyaa-search-status");
        if (status) {
            status.textContent = `Search stopped. Found ${nyaaState.results.length} sources`;
            status.style.color = COLOURS.RED;
        }
        return;
    }

    // Prepare new search
    nyaaState.results = [];
    nyaaState.cardMap.clear();
    const currentController = new AbortController();
    nyaaState.abortController = currentController;
    searchBtn.textContent = "Stop Search";

    const isFull = (document.querySelector('input[name="nyaa-release-type"]:checked') as HTMLInputElement | null)?.value === "full-releases";
    const selectedEpisode = (document.getElementById("nyaa-episode-select") as HTMLSelectElement | null)?.value;

    if (!isFull && !selectedEpisode) {
        resultsArea.replaceChildren(make("p", {
            style: `color: ${COLOURS.RED}; margin-top: 1rem;`,
            text: "Please select an episode",
        }));
        nyaaState.abortController = null;
        searchBtn.textContent = "Start Search";
        return;
    }

    // UI reset
    const statusText = make("p", {
        id: "nyaa-search-status",
        style: `margin-top: 0.5rem; color: ${COLOURS.GREEN};`,
        text: "Searching Nyaa... Found 0 sources",
    });
    const resultsList = make("div", {
        id: "nyaa-results-list",
        style: `${STYLES.FLEX_COL_GAP_HALF} margin-top: 1rem;`,
    });
    resultsArea.replaceChildren(statusText, resultsList);

    // Streaming search
    try {
        const api = new AnidbIdApi();
        let generator: AsyncGenerator<NyaaMetadata, void, unknown>;

        if (isFull) {
            const mapping = await api.getAnidbId(anilistId);
            if (!mapping) throw new Error("No AniDB mapping found");
            generator = api.streamAnimetoshoMetadata(mapping.anidb_id, null, currentController.signal);
        } else {
            generator = api.streamNyaaAnidbEpisodeMetadata(anilistId, selectedEpisode!, currentController.signal);
        }

        // Throttled status updater
        let rafId = 0;
        const updateStatus = (text: string, colour?: string) => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                const el = document.getElementById("nyaa-search-status");
                if (el) {
                    el.textContent = text;
                    if (colour) el.style.color = colour;
                }
                rafId = 0;
            });
        };

        for await (const result of generator) {
            if (currentController.signal.aborted) break;

            const enhanced = result as NyaaMetadataEnhanced;

            // Pre-calculate sort keys
            enhanced._parsedSize = parseFileSize(enhanced.fileSize);
            enhanced._parsedDate = new Date(enhanced.date ?? "1970-01-01").getTime();
            enhanced._parsedSeeders = parseInt(enhanced.seeders ?? "0");
            enhanced._parsedCompleted = parseInt(enhanced.completed ?? "0");

            // Skip 0-seeder entries (defence-in-depth against stale/phantom data)
            if (enhanced._parsedSeeders <= 0) continue;

            // Store & render
            const idx = nyaaState.results.length;
            nyaaState.results.push(enhanced);
            const card = createNyaaCard(enhanced, idx);
            nyaaState.cardMap.set(idx, card);

            // Insert in sorted position
            const pos = getInsertPosition(resultsList, enhanced, nyaaState.sortCriteria);
            if (pos >= resultsList.children.length) {
                resultsList.append(card);
            } else {
                resultsList.insertBefore(card, resultsList.children[pos]);
            }

            // Apply active filter
            applyFilter();

            if (!currentController.signal.aborted) {
                updateStatus(`Searching Nyaa... Found ${nyaaState.results.length} sources`);
            }
        }

        // Search complete
        cancelAnimationFrame(rafId);
        if (nyaaState.abortController === currentController) {
            const count = nyaaState.results.length;
            const el = document.getElementById("nyaa-search-status");
            if (el) {
                el.textContent = count === 0 ? "No releases found with active seeders" : `Search complete. Found ${count} sources`;
                el.style.color = COLOURS.BLUE_PRIMARY;
            }
        }
    } catch (e: unknown) {
        const error = e as { name?: string };
        if (error.name !== "AbortError" && nyaaState.abortController === currentController) {
            resultsArea.replaceChildren(make("p", {
                style: `color: ${COLOURS.RED}; margin-top: 1rem;`,
                text: "Error searching Nyaa",
            }));
        }
    } finally {
        if (nyaaState.abortController === currentController) {
            nyaaState.abortController = null;
            searchBtn.textContent = "Start Search";
        }
    }
}

async function loadEpisodeData(anilistId: number): Promise<Episode[]> {
    if (nyaaState.cachedEpisodes && nyaaState.cachedAnilistId === anilistId) {
        return nyaaState.cachedEpisodes;
    }

    const api = new AnidbIdApi();
    const result = await api.getAnidbId(anilistId);

    if (result?.episodes) {
        const eps = result.episodes
            .filter(e => {
                const n = parseInt(e.episode, 10);
                return !isNaN(n) && n > 0;
            })
            .sort((a, b) => parseInt(a.episode, 10) - parseInt(b.episode, 10));

        nyaaState.cachedEpisodes = eps;
        nyaaState.cachedAnilistId = anilistId;
        return eps;
    }

    nyaaState.cachedEpisodes = [];
    nyaaState.cachedAnilistId = anilistId;
    return [];
}

// Nyaa Card Rendering

function createNyaaCard(release: NyaaMetadataEnhanced, index: number): HTMLElement {
    const title = release.releaseName ?? "Unknown Release";
    const seeders = `${release.seeders ?? "0"} Seeders`;

    const actions = make("div", {
        className: "card-actions",
        style: "display: flex; align-items: center; gap: 0.75rem; margin-left: auto; flex-shrink: 0;",
    }, [
        make("span", {
            className: "seeders-count",
            style: `color: ${COLOURS.GREEN}; font-weight: 600; min-width: 90px; text-align: right; margin-right: 0.5rem;`,
            text: seeders,
        }),
        make("button", {
            className: "action-open-magnet",
            title: "Open Magnet",
            text: "🧲",
            style: `background: ${COLOURS.BLUE_PRIMARY}; ${STYLES.BASE_BTN}`,
        }),
        make("button", {
            className: "action-copy-magnet",
            title: "Copy Magnet",
            text: "📋",
            style: `background: ${COLOURS.BLUE_PRIMARY}; ${STYLES.BASE_BTN}`,
        }),
    ]);

    if (release.url) {
        actions.append(make("a", {
            className: "action-open-url",
            title: "Open URL",
            text: "🔗",
            href: release.url,
            target: "_blank",
            rel: "noopener noreferrer",
            style: `background: ${COLOURS.BLUE_PRIMARY}; text-decoration: none; display: inline-block; ${STYLES.BASE_BTN}`,
        }));
    }

    const expandBtn = make("span", { className: "expand-btn", text: "+", style: STYLES.EXPAND_BTN });
    actions.append(expandBtn);

    const card = make("div", {
        className: "nyaa-result-card",
        dataset: { resultIndex: String(index) },
        style: STYLES.CARD_BASE,
    }, [
        make("div", { className: "card-header", style: STYLES.CARD_HEADER }, [
            make("span", {
                className: "card-title",
                style: "flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
                text: title,
                title,
            }),
            actions,
        ]),
        make("div", {
            className: "card-details",
            style: `display: none; padding: 0.75rem 1rem; border-top: 1px solid ${COLOURS.BORDER_DETAILS}; font-size: 0.9em;`,
            dataset: { hydrated: "false" },
        }),
    ]);

    release._card = card;
    return card;
}

function hydrateNyaaCard(card: HTMLElement, release: NyaaMetadataEnhanced): void {
    const details = card.querySelector(".card-details") as HTMLElement;
    if (details.dataset.hydrated === "true") return;

    details.replaceChildren(
        make("div", {
            style: "font-weight: 600; margin-bottom: 0.75rem; word-break: break-word;",
            text: release.releaseName ?? "Unknown",
        }),
        createList([
            createDetailRow([
                createListItem("Category:", release.category ?? "Unknown", { aligned: false }),
                createListItem("Date:", release.date ?? "Unknown", { aligned: false }),
            ]),
            createDetailRow([
                createListItem("Seeders:", release.seeders ?? "0", { valueColour: COLOURS.GREEN, aligned: false }),
                createListItem("Leechers:", release.leechers ?? "0", { valueColour: COLOURS.RED, aligned: false }),
                createListItem("Completed:", release.completed ?? "0", { aligned: false }),
            ]),
            createDetailRow([
                createListItem("Submitter:", release.submitter ?? "Unknown", { aligned: false }),
                createListItem("Size:", release.fileSize ?? "Unknown", { aligned: false }),
            ]),
        ]),
    );

    if (release.files?.length) {
        const treeContainer = make("div", { style: "display: none; margin-top: 0.5rem;" }, [renderFileTree(release.files)]);
        const toggle = make("button", {
            text: "Files",
            style: `background: ${COLOURS.BLUE_PRIMARY}; color: white; border: none; border-radius: 4px; padding: 0.25rem 0; font-size: 0.9em; cursor: pointer; text-align: center; font-weight: 500; width: 35px;`,
            events: {
                click: ((ev: Event) => {
                    ev.stopPropagation();
                    const hidden = treeContainer.style.display === "none";
                    treeContainer.style.display = hidden ? "block" : "none";
                    toggle.textContent = hidden ? "Hide" : "Files";
                }) as EventListener,
            },
        });
        details.append(make("div", { style: "margin-top: 0.75rem;" }, [toggle, treeContainer]));
    }

    details.dataset.hydrated = "true";
}

function renderFileTree(entries: NyaaFileEntry[], depth = 0): HTMLUListElement {
    const list = createList([]);
    if (depth > 0) list.style.paddingLeft = "1rem";

    for (const entry of entries) {
        if (entry.type === "folder") {
            const folderItem = createListItem(`📁 ${entry.name ?? "Unnamed Folder"}`, "", { bold: true });
            folderItem.style.marginBottom = "0.35rem";
            list.append(folderItem);
            if (entry.contents?.length) {
                list.append(make("li", { style: "list-style: none;" }, [renderFileTree(entry.contents, depth + 1)]));
            }
        } else {
            const size = entry.size?.replace(/^\(|\)$/g, "") ?? "";
            list.append(createListItem(`📄 ${entry.name ?? "Unnamed File"}`, size, { bold: false, boldValue: false }));
        }
    }

    return list;
}

function setupResultsDelegation(container: HTMLElement): void {
    container.addEventListener("click", (ev: Event) => {
        const target = ev.target as HTMLElement;
        const card = target.closest(".nyaa-result-card") as HTMLElement | null;
        if (!card) return;

        const idx = parseInt(card.dataset.resultIndex ?? "-1");
        const release = nyaaState.results[idx];
        if (!release) return;

        // Open magnet action
        if (target.closest(".action-open-magnet")) {
            ev.stopPropagation();
            window.location.href = release.magnet;
            return;
        }

        // Copy magnet action
        const copyBtn = target.closest(".action-copy-magnet");
        if (copyBtn) {
            ev.stopPropagation();
            copyToClipboard(release.magnet, copyBtn as HTMLElement, "✓", "📋");
            return;
        }

        // URL link — let it navigate naturally
        if (target.closest(".action-open-url")) {
            ev.stopPropagation();
            return;
        }

        // Card expand/collapse
        if (target.closest(".card-header")) {
            const details = card.querySelector(".card-details") as HTMLElement;
            const expandBtnEl = card.querySelector(".expand-btn") as HTMLElement;
            const isHidden = details.style.display === "none";
            if (isHidden) hydrateNyaaCard(card, release);
            details.style.display = isHidden ? "block" : "none";
            expandBtnEl.textContent = isHidden ? "-" : "+";
        }
    });
}

// Nyaa Filtering & Sorting

function applyFilter(): void {
    const filterText = nyaaState.filterText.toLowerCase().trim();
    const tokens = filterText.split(/\s+/).filter(t => t.length > 0);
    const isInclude = nyaaState.filterMode === "include";

    for (let i = 0; i < nyaaState.results.length; i++) {
        const card = nyaaState.cardMap.get(i);
        if (!card) continue;

        if (tokens.length === 0) {
            card.style.display = "";
            continue;
        }

        const name = (nyaaState.results[i].releaseName ?? "").toLowerCase();
        const shouldShow = isInclude
            ? tokens.every(token => name.includes(token))
            : !tokens.some(token => name.includes(token));

        card.style.display = shouldShow ? "" : "none";
    }
}

// Shared sort comparator
function compareByCriteria(a: NyaaMetadataEnhanced, b: NyaaMetadataEnhanced, criteria: SortCriteria): number {
    switch (criteria) {
        case "seeders": return (b._parsedSeeders ?? 0) - (a._parsedSeeders ?? 0);
        case "date": return (b._parsedDate ?? 0) - (a._parsedDate ?? 0);
        case "size": return (b._parsedSize ?? 0) - (a._parsedSize ?? 0);
        case "completed": return (b._parsedCompleted ?? 0) - (a._parsedCompleted ?? 0);
    }
}

function getInsertPosition(container: HTMLElement, newResult: NyaaMetadataEnhanced, criteria: SortCriteria): number {
    const children = container.children;
    let low = 0;
    let high = children.length;

    while (low < high) {
        const mid = (low + high) >>> 1;
        const midIdx = parseInt((children[mid] as HTMLElement).dataset.resultIndex ?? "0");
        const midResult = nyaaState.results[midIdx];

        if (compareByCriteria(newResult, midResult, criteria) < 0) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }

    return low;
}

function handleSortChange(criteria: SortCriteria): void {
    nyaaState.sortCriteria = criteria;

    // Update sort button highlights
    for (const btn of document.querySelectorAll<HTMLElement>("[data-sort-criteria]")) {
        btn.style.background = btn.dataset.sortCriteria === criteria ? COLOURS.BLUE_PRIMARY : COLOURS.BLUE_SECONDARY;
    }

    const list = document.getElementById("nyaa-results-list");
    if (!list || nyaaState.results.length === 0) return;

    // Sort indices using shared comparator
    const indices = nyaaState.results
        .map((_, i) => i)
        .sort((a, b) => compareByCriteria(nyaaState.results[a], nyaaState.results[b], criteria));

    const fragment = document.createDocumentFragment();
    for (const i of indices) {
        const card = nyaaState.cardMap.get(i);
        if (card) fragment.append(card);
    }
    list.replaceChildren(fragment);
}
