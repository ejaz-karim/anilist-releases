import { getAnilistId } from "./utility";
import { SeadexApi } from "./seadex_api";
import { injectReleasesPanel } from "./inject_panel";

const api = new SeadexApi();
let lastPath = "";

async function render() {
  const anilistId = getAnilistId();
  if (!anilistId) return;

  try {
    const data = await api.getReleaseData(anilistId);
    if (data) {
      injectReleasesPanel(data);
    }
  } catch (err) {
    console.error("Failed to fetch Seadex data:", err);
  }
}

function watchUrlChanges() {
  const observer = new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      render();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Boot
watchUrlChanges();
render();
