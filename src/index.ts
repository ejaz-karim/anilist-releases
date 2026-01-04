import { getAnilistId } from "./utility";
import { SeadexApi } from "./seadex_api";
import {
    renderSeadexPanel,
    ensureSeadexPanelPlacement,
    renderNyaaPanel,
    ensureNyaaPanelPlacement,
    SEADEX_PANEL_ID,
    NYAA_PANEL_ID,
} from "./render_panels";

const seadexApi = new SeadexApi();

// Prevent race conditions from rapid mutations
let inFlightId: number | null = null;
let scheduledTimeout: number = 0;
let contentObserver: MutationObserver | null = null;

function isAnimePage(): boolean {
    return document.querySelector(".page-content .media.media-anime") !== null;
}

// Orchestrates panel injection
async function tryInject(): Promise<void> {
    const id = getAnilistId();
    const isAnime = isAnimePage();

    if (!isAnime) {
        document.querySelectorAll(`#${SEADEX_PANEL_ID}, #${NYAA_PANEL_ID}`).forEach((node) => node.remove());
        return;
    }

    if (!id) return;

    const seadexPanel = document.getElementById(SEADEX_PANEL_ID);
    if (seadexPanel && seadexPanel.dataset.anilistId !== String(id)) {
        seadexPanel.remove();
    }

    const nyaaPanel = document.getElementById(NYAA_PANEL_ID);
    if (nyaaPanel && nyaaPanel.dataset.anilistId !== String(id)) {
        nyaaPanel.remove();
    }

    if (document.getElementById(SEADEX_PANEL_ID)) {
        ensureSeadexPanelPlacement(id);
        if (!document.getElementById(NYAA_PANEL_ID)) {
            await renderNyaaPanel(id);
        }
        return;
    }

    if (inFlightId === id) {
        ensureSeadexPanelPlacement(id);
        return;
    }

    inFlightId = id;
    try {
        const data = await seadexApi.getReleaseData(id);
        if (data) {
            renderSeadexPanel(data, id);
            ensureSeadexPanelPlacement(id);
        }
    } catch (err) {
        console.error("Failed to inject Seadex releases:", err);
    } finally {
        inFlightId = null;
    }

    if (!document.getElementById(NYAA_PANEL_ID)) {
        await renderNyaaPanel(id);
    }
}

// Debounce injections
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
        ensureSeadexPanelPlacement(currentId);
        ensureNyaaPanelPlacement(currentId);
    });
    contentObserver.observe(target, { childList: true, subtree: true });

    tryInject();
}

// Handle SPA navigation re-renders
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

setupRootObserver();
