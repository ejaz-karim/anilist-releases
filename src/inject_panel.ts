import type { ReleaseData } from "./seadex_api";

const PANEL_ID = "anilist-releases-panel";

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
