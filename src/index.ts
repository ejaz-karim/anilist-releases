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

// Injection state
const injectionState = {
    inFlightId: null as number | null,
    scheduledTimeout: 0,
    contentObserver: null as MutationObserver | null,
};

function isAnimePage(): boolean {
    return document.querySelector(".page-content .media.media-anime") !== null;
}

// Orchestrates panel injection
async function tryInject(): Promise<void> {
    const id = getAnilistId();
    const isAnime = isAnimePage();

    // 1. If not an anime page or no ID, clean up everything
    if (!isAnime || !id) {
        document.querySelectorAll(`#${SEADEX_PANEL_ID}, #${NYAA_PANEL_ID}`).forEach((node) => node.remove());
        return;
    }

    // 2. Remove panels if they belong to a different anime
    const seadexPanel = document.getElementById(SEADEX_PANEL_ID);
    if (seadexPanel && seadexPanel.dataset.anilistId !== String(id)) seadexPanel.remove();

    const nyaaPanel = document.getElementById(NYAA_PANEL_ID);
    if (nyaaPanel && nyaaPanel.dataset.anilistId !== String(id)) nyaaPanel.remove();

    // 3. Ensure Seadex Panel
    if (!document.getElementById(SEADEX_PANEL_ID) && injectionState.inFlightId !== id) {
        injectionState.inFlightId = id;
        try {
            const data = await seadexApi.getReleaseData(id);
            if (data) {
                renderSeadexPanel(data, id);
            }
        } catch (err) {
            console.error("Failed to inject Seadex releases:", err);
        } finally {
            injectionState.inFlightId = null;
        }
    }
    ensureSeadexPanelPlacement(id);

    // 4. Ensure Nyaa Panel
    if (!document.getElementById(NYAA_PANEL_ID)) {
        await renderNyaaPanel(id);
    }
    ensureNyaaPanelPlacement(id);
}

// Debounce injections
function scheduleTryInject(): void {
    if (injectionState.scheduledTimeout) return;
    injectionState.scheduledTimeout = window.setTimeout(() => {
        injectionState.scheduledTimeout = 0;
        tryInject();
    }, 60);
}

function observePageContent(): void {
    const target = document.querySelector(".page-content");
    if (!target) return;

    injectionState.contentObserver?.disconnect();

    injectionState.contentObserver = new MutationObserver(() => {
        scheduleTryInject();
        const currentId = getAnilistId();
        ensureSeadexPanelPlacement(currentId);
        ensureNyaaPanelPlacement(currentId);
    });
    injectionState.contentObserver.observe(target, { childList: true, subtree: true });

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
