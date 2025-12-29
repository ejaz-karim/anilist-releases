// index.ts - Clean rewrite of the extension entry point

import { getAnilistId } from "./utility";
import { SeadexApi } from "./seadex_api";
import {
    injectReleasesPanel,
    ensureReleasesPanelPlacement,
    injectNyaaPanel,
    ensureNyaaPanelPlacement,
} from "./inject_panel";

const seadexApi = new SeadexApi();

let inFlightId: number | null = null;
let scheduledTimeout: number = 0;
let contentObserver: MutationObserver | null = null;

function isAnimePage(): boolean {
    return document.querySelector(".page-content .media.media-anime") !== null;
}

async function tryInject(): Promise<void> {
    const id = getAnilistId();
    const isAnime = isAnimePage();

    // If not anime → remove any lingering panels and exit
    if (!isAnime) {
        document.querySelectorAll("#anilist-releases-panel, #anilist-nyaa-panel").forEach((n) => n.remove());
        return;
    }

    if (!id) return;

    // Remove panels for different anime
    const existingSeadex = document.getElementById("anilist-releases-panel");
    if (existingSeadex && existingSeadex.dataset.anilistId !== String(id)) {
        existingSeadex.remove();
    }

    const existingNyaa = document.getElementById("anilist-nyaa-panel");
    if (existingNyaa && existingNyaa.dataset.anilistId !== String(id)) {
        existingNyaa.remove();
    }

    // If Seadex panel exists for this anime, ensure placement and inject Nyaa panel
    if (document.getElementById("anilist-releases-panel")) {
        ensureReleasesPanelPlacement(id);
        if (!document.getElementById("anilist-nyaa-panel")) {
            await injectNyaaPanel(id);
        }
        return;
    }

    // Avoid duplicate fetches during rapid mutations
    if (inFlightId === id) {
        ensureReleasesPanelPlacement(id);
        return;
    }

    inFlightId = id;
    try {
        const data = await seadexApi.getReleaseData(id);
        if (data) {
            injectReleasesPanel(data, id);
            ensureReleasesPanelPlacement(id);
        }
    } catch (err) {
        console.error("Failed to inject Seadex releases:", err);
    } finally {
        inFlightId = null;
    }

    // Always inject Nyaa panel (independent of Seadex fetch)
    if (!document.getElementById("anilist-nyaa-panel")) {
        await injectNyaaPanel(id);
    }
}

function scheduleTryInject(): void {
    if (scheduledTimeout) return;
    scheduledTimeout = window.setTimeout(() => {
        scheduledTimeout = 0;
        tryInject();
    }, 60);
}

function observePageContent(): void {
    const target = document.querySelector(".page-content");
    if (!target) return;

    contentObserver?.disconnect();

    contentObserver = new MutationObserver(() => {
        scheduleTryInject();
        const currentId = getAnilistId();
        ensureReleasesPanelPlacement(currentId);
        ensureNyaaPanelPlacement(currentId);
    });
    contentObserver.observe(target, { childList: true, subtree: true });

    tryInject();
}

function setupRootObserver(): void {
    const root = document.getElementById("app") || document.body;
    if (!root) return;

    let rafQueued = false;

    const rootObserver = new MutationObserver(() => {
        if (rafQueued) return;
        rafQueued = true;
        requestAnimationFrame(() => {
            rafQueued = false;
            observePageContent();
        });
    });

    rootObserver.observe(root, { childList: true, subtree: true });

    observePageContent();
}

// Boot
setupRootObserver();
