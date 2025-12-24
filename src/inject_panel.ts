import type { ReleaseData } from "./seadex_api";
import { AnidbIdApi } from "./anidb_id_api";
import type { NyaaMetadata } from "./nyaa_scraper";

const PANEL_ID = "anilist-releases-panel";
const NYAA_PANEL_ID = "anilist-nyaa-panel";

function findAnchor(): HTMLElement | null {
  const mediaRoot = document.querySelector<HTMLElement>(".page-content .media.media-anime");
  if (!mediaRoot) return null;

  // Prefer Reviews, otherwise Threads
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

function placeReleasesPanel(panelContent: HTMLElement, anilistId: number) {
  document.querySelectorAll(`#${PANEL_ID}`).forEach(n => n.remove());

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

export function ensureReleasesPanelPlacement(currentAniId: number | null) {
  const panel = document.getElementById(PANEL_ID) as HTMLElement | null;
  if (!panel) return;

  if (currentAniId && panel.dataset.anilistId && panel.dataset.anilistId !== String(currentAniId)) return;

  const anchor = findAnchor();
  if (!anchor || !anchor.parentElement) return;

  if (panel.previousElementSibling === anchor) {
    panel.dataset.anchored = "true";
    return;
  }

  anchor.insertAdjacentElement("afterend", panel);
  panel.dataset.anchored = "true";
}

function linkifyAndSplitComparison(text: string): string {
  const lines = text.split(/\n+/);
  const urlRegex = /(https?:\/\/[^\s,]+)/g;

  const out: string[] = [];
  for (const line of lines) {
    const urls = line.match(urlRegex);
    if (urls && urls.length > 1) {
      urls.forEach(u => {
        out.push(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
      });
    } else {
      const replaced = line.replace(urlRegex, u =>
        `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
      );
      out.push(replaced);
    }
  }
  return out.join("<br>");
}

export function injectReleasesPanel(data: ReleaseData, anilistId: number) {
  const container = document.createElement("div");

  // Header
  const header = document.createElement("h2");
  header.textContent = "Releases";
  header.className = "section-header";
  container.appendChild(header);

  // Content wrapper
  const contentWrap = document.createElement("div");
  contentWrap.className = "content-wrap list";
  contentWrap.style.display = "flex";
  contentWrap.style.flexWrap = "wrap";
  contentWrap.style.gap = "1rem";

  // Combined meta box
  if (data.comparison || data.notes || data["theoretical best"]) {
    const meta = document.createElement("div");
    meta.className = "wrap entry";
    meta.style.padding = "1rem";
    meta.style.marginBottom = "1rem";
    meta.style.flex = "1 1 100%";

    if (data.comparison) {
      const cmp = document.createElement("div");
      cmp.innerHTML = `<strong>Comparison:</strong><br>${linkifyAndSplitComparison(
        data.comparison
      )}`;
      meta.appendChild(cmp);
    }
    if (data.notes) {
      const notes = document.createElement("div");
      notes.innerHTML = `<strong>Notes:</strong> ${data.notes.replace(/\n/g, "<br>")}`;
      meta.appendChild(notes);
    }
    if (data["theoretical best"]) {
      const best = document.createElement("div");
      best.innerHTML = `<strong>Theoretical Best:</strong> ${data["theoretical best"]}`;
      meta.appendChild(best);
    }

    contentWrap.appendChild(meta);
  }

  // Release cards
  data.releases.forEach((release) => {
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.style.flex = "1 1 300px";
    wrap.style.minWidth = "300px";
    wrap.style.maxWidth = "48%";

    const card = document.createElement("div");
    card.className = "entry";
    card.style.padding = "1rem";

    // Combine flags + custom tags inline
    const allFlags: string[] = [];
    if (release["dual audio"]) allFlags.push("Dual Audio");
    if (release["is best"]) allFlags.push("Best Release");
    if (release["private tracker"]) allFlags.push("Private Tracker");
    if (release.tags && release.tags.length) allFlags.push(...release.tags);

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

    // url, copy link
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
            setTimeout(() => { copyBtn.textContent = prev; }, 1000);
          } catch {
            window.prompt("Copy URL", rawUrl);
          }
        });
        row.appendChild(copyBtn);
      }

      card.appendChild(row);
    }

    // Collapsible episodes
    if (release["episode list"]?.length) {
      const toggle = document.createElement("a");
      toggle.textContent = "Show Episodes";
      toggle.className = "link";
      toggle.style.display = "block";
      toggle.style.marginTop = "0.5rem";

      const epContainer = document.createElement("ul");
      epContainer.style.marginTop = "0.5rem";
      epContainer.style.paddingLeft = "1.2rem";
      epContainer.style.display = "none";

      release["episode list"].forEach(ep => {
        const li = document.createElement("li");
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
  placeReleasesPanel(container, anilistId);
}

// Nyaa Panel Functions

export function injectNyaaPanel(anilistId: number) {
  // Remove existing panel for different anime
  const existingPanel = document.getElementById(NYAA_PANEL_ID);
  if (existingPanel && existingPanel.dataset.anilistId !== String(anilistId)) {
    existingPanel.remove();
  }
  if (existingPanel) return; // Already exists for this anime

  const panel = document.createElement("div");
  panel.id = NYAA_PANEL_ID;
  panel.className = "grid-section-wrap";
  panel.dataset.anilistId = String(anilistId);

  const section = document.createElement("div");
  section.className = "section";

  // Header
  const header = document.createElement("h2");
  header.textContent = "Nyaa Releases";
  header.className = "section-header";
  section.appendChild(header);

  // Content
  const content = document.createElement("div");
  content.className = "content-wrap";

  // Search controls
  const controls = document.createElement("div");
  controls.style.cssText = "display: flex; gap: 1rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap;";

  // Radio buttons
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

  // Episode input
  const episodeInput = document.createElement("input");
  episodeInput.type = "number";
  episodeInput.id = "nyaa-episode-input";
  episodeInput.placeholder = "Episode #";
  episodeInput.min = "1";
  episodeInput.style.cssText = "width: 100px; padding: 0.25rem; display: none;";

  // Search button
  const searchBtn = document.createElement("button");
  searchBtn.id = "search-nyaa-btn";
  searchBtn.textContent = "Start Search";
  searchBtn.className = "button";
  searchBtn.style.cssText = "padding: 0.5rem 1rem; cursor: pointer;";

  // Event listeners
  const updateEpisodeInputVisibility = () => {
    episodeInput.style.display = episodeRadio.checked ? "block" : "none";
  };
  
  episodeRadio.addEventListener("change", updateEpisodeInputVisibility);
  fullRadio.addEventListener("change", updateEpisodeInputVisibility);

  searchBtn.addEventListener("click", () => handleNyaaSearch(anilistId));

  controls.appendChild(fullRadio);
  controls.appendChild(fullLabel);
  controls.appendChild(episodeRadio);
  controls.appendChild(episodeLabel);
  controls.appendChild(episodeInput);
  controls.appendChild(searchBtn);

  content.appendChild(controls);

  // Results area
  const resultsArea = document.createElement("div");
  resultsArea.id = "nyaa-results";
  content.appendChild(resultsArea);

  section.appendChild(content);
  panel.appendChild(section);

  // Place the panel
  placeNyaaPanel(panel, anilistId);
}

function placeNyaaPanel(panel: HTMLElement, anilistId: number) {
  // Try to place after Seadex panel
  const seadexPanel = document.getElementById(PANEL_ID);
  if (seadexPanel && seadexPanel.parentElement) {
    seadexPanel.insertAdjacentElement("afterend", panel);
    return;
  }

  // Fallback to anchor
  const anchor = findAnchor();
  if (anchor && anchor.parentElement) {
    anchor.insertAdjacentElement("afterend", panel);
    return;
  }

  // Last resort
  const provisional = provisionalContainer();
  if (provisional) {
    provisional.appendChild(panel);
  }
}

export function ensureNyaaPanelPlacement(currentAniId: number | null) {
  const panel = document.getElementById(NYAA_PANEL_ID);
  if (!panel) return;

  if (currentAniId && panel.dataset.anilistId && panel.dataset.anilistId !== String(currentAniId)) return;

  const seadexPanel = document.getElementById(PANEL_ID);
  if (seadexPanel && seadexPanel.parentElement) {
    if (panel.previousElementSibling !== seadexPanel) {
      seadexPanel.insertAdjacentElement("afterend", panel);
    }
    return;
  }

  // Fallback if Seadex panel not found
  const anchor = findAnchor();
  if (anchor && anchor.parentElement) {
    if (panel.previousElementSibling !== anchor) {
      anchor.insertAdjacentElement("afterend", panel);
    }
  }
}

async function handleNyaaSearch(anilistId: number) {
  const resultsArea = document.getElementById("nyaa-results");
  const searchBtn = document.getElementById("search-nyaa-btn") as HTMLButtonElement;
  if (!resultsArea || !searchBtn) return;

  // Disable button during search
  searchBtn.disabled = true;
  searchBtn.textContent = "Searching...";

  // Get selected option
  const fullRelease = (document.querySelector('input[name="nyaa-release-type"]:checked') as HTMLInputElement)?.value === "full";
  const episodeInput = document.getElementById("nyaa-episode-input") as HTMLInputElement;
  const episode = episodeInput?.value;

  if (!fullRelease && !episode) {
    resultsArea.innerHTML = '<p style="color: #ff6b6b; margin-top: 1rem;">Please enter an episode number</p>';
    searchBtn.disabled = false;
    searchBtn.textContent = "Start Search";
    return;
  }

  // Show loading state
  resultsArea.innerHTML = '<p style="margin-top: 1rem;">Searching Nyaa...</p>';

  try {
    const anidbApi = new AnidbIdApi();
    
    let results;
    if (fullRelease) {
      // Get mapping for anidb_id
      const mapping = await anidbApi.getAnidbId(anilistId);
      if (!mapping) {
        resultsArea.innerHTML = '<p style="color: #ff6b6b; margin-top: 1rem;">Failed to get AniDB mapping</p>';
        return;
      }
      results = await anidbApi.getAnimetoshoMetadata(mapping.anidb_id);
    } else {
      // Use convenience method for episodic search
      results = await anidbApi.getNyaaAnidbEpisode(anilistId, episode!);
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
    // Re-enable button
    searchBtn.disabled = false;
    searchBtn.textContent = "Start Search";
  }
}

function displayNyaaResults(results: NyaaMetadata[], container: HTMLElement) {
  const contentWrap = document.createElement("div");
  contentWrap.className = "content-wrap list";
  contentWrap.style.cssText = "display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;";

  results.forEach((release) => {
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.style.cssText = "flex: 1 1 300px; min-width: 300px; max-width: 48%;";

    const card = document.createElement("div");
    card.className = "entry";
    card.style.cssText = "padding: 1rem;";

    // Release name
    const title = document.createElement("div");
    title.style.cssText = "font-weight: 600; margin-bottom: 4px; color: #3fa9f5;";
    title.textContent = release["release name"] || "Unknown Release";
    card.appendChild(title);

    // Metadata
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

    // Magnet link
    if (release.magnet) {
      const magnetRow = document.createElement("div");
      magnetRow.style.cssText = "margin-top: 0.75rem;";

      const magnetLink = document.createElement("a");
      magnetLink.href = release.magnet;
      magnetLink.textContent = "Magnet Link";
      magnetLink.className = "link";
      magnetLink.target = "_blank";
      magnetLink.rel = "noopener noreferrer";

      const copyBtn = document.createElement("a");
      copyBtn.textContent = "Copy";
      copyBtn.className = "link";
      copyBtn.href = "javascript:void(0)";
      copyBtn.style.cssText = "margin-left: 0.75rem;";
      copyBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try {
          await navigator.clipboard.writeText(release.magnet!);
          const prev = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = prev; }, 1000);
        } catch {
          window.prompt("Copy Magnet Link", release.magnet!);
        }
      });

      magnetRow.appendChild(magnetLink);
      magnetRow.appendChild(copyBtn);
      card.appendChild(magnetRow);
    }

    // Files info
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

      // Format file list
      const fileList = document.createElement("ul");
      fileList.style.cssText = "padding-left: 1rem; margin: 0; list-style: none;";
      
      release.files.forEach((file: any) => {
        const li = document.createElement("li");
        li.style.cssText = "margin: 0.25rem 0;";
        if (file.type === "folder") {
          li.textContent = `📁 ${file.name || "Unnamed Folder"}`;
        } else {
          li.textContent = `📄 ${file.name || "Unnamed File"}${file.size ? ` (${file.size})` : ""}`;
        }
        fileList.appendChild(li);
      });

      fileContainer.appendChild(fileList);
      card.appendChild(toggle);
      card.appendChild(fileContainer);
    }

    wrap.appendChild(card);
    contentWrap.appendChild(wrap);
  });

  container.innerHTML = "";
  container.appendChild(contentWrap);
}