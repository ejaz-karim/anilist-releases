import { getAnilistId } from "./utility";
import { SeadexApi } from "./seadex_api";
import { injectReleasesPanel, ensureReleasesPanelPlacement } from "./inject_panel";

const api = new SeadexApi();
let inFlightId: number | null = null;
let scheduled = 0;
let contentObserver: MutationObserver | null = null;

function isAnimePage(): boolean {
  return document.querySelector(".page-content .media.media-anime") !== null;
}

async function tryInject() {
  const id = getAnilistId();
  const isAnime = isAnimePage();

  // If not anime → remove any lingering panel and exit
  if (!isAnime) {
    document.querySelectorAll("#anilist-releases-panel").forEach(n => n.remove());
    return;
  }

  if (!id) return;

  // If an existing panel belongs to a different anime, remove it
  const existing = document.getElementById("anilist-releases-panel") as HTMLElement | null;
  if (existing && existing.dataset.anilistId !== String(id)) {
    existing.remove();
  }

  // If panel already exists for this anime, just ensure it's placed correctly
  if (document.getElementById("anilist-releases-panel")) {
    ensureReleasesPanelPlacement(id);
    return;
  }

  // Avoid duplicate fetches during rapid mutations
  if (inFlightId === id) {
    ensureReleasesPanelPlacement(id);
    return;
  }

  inFlightId = id;
  try {
    const data = await api.getReleaseData(id);
    if (data) {
      injectReleasesPanel(data, id);
      ensureReleasesPanelPlacement(id);
    }
  } catch (err) {
    console.error("Failed to inject releases:", err);
  } finally {
    inFlightId = null;
  }
}

function scheduleTryInject() {
  if (scheduled) return;
  scheduled = window.setTimeout(() => {
    scheduled = 0;
    tryInject();
  }, 60);
}

function observePageContent() {
  const target = document.querySelector(".page-content");
  if (!target) return;

  // Replace old observer with a fresh one bound to the current .page-content
  contentObserver?.disconnect();

  contentObserver = new MutationObserver(() => {
    scheduleTryInject();
    ensureReleasesPanelPlacement(getAnilistId());
  });
  contentObserver.observe(target, { childList: true, subtree: true });

  // Try once immediately
  tryInject();
}

function setupRootObserver() {
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
