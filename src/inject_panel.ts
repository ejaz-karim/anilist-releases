import type { ReleaseData } from "./seadex_api";

const PANEL_ID = "anilist-releases-panel";

function placeReleasesPanel(panelContent: HTMLElement) {
  document.querySelectorAll(`#${PANEL_ID}`).forEach(n => n.remove());

  const wrap = document.createElement("div");
  wrap.id = PANEL_ID;
  wrap.className = "grid-section-wrap";

  const inner = document.createElement("div");
  inner.className = "section";
  inner.appendChild(panelContent);
  wrap.appendChild(inner);

  const mediaRoot =
    document.querySelector<HTMLElement>(".page-content .media.media-anime");
  const reviewsSection = mediaRoot?.querySelector(".reviews");
  const reviewsGridWrap = reviewsSection?.closest(".grid-section-wrap");

  if (reviewsGridWrap && reviewsGridWrap.parentElement) {
    reviewsGridWrap.insertAdjacentElement("afterend", wrap);
  } else if (mediaRoot) {
    mediaRoot.appendChild(wrap);
  }
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

export function injectReleasesPanel(data: ReleaseData) {
  const container = document.createElement("div");

  // Header
  const header = document.createElement("h2");
  header.textContent = "Releases";
  header.className = "section-header";
  container.appendChild(header);

  // Content wrapper (grid layout for two-by-two cards)
  const contentWrap = document.createElement("div");
  contentWrap.className = "content-wrap list";
  // contentWrap.style.display = "grid";
  // contentWrap.style.gridTemplateColumns = "repeat(auto-fill, minmax(300px, 1fr))";
  // contentWrap.style.gap = "1rem";
  contentWrap.style.display = "flex";
  contentWrap.style.flexWrap = "wrap";
  contentWrap.style.gap = "1rem";



  // Combined meta box
  if (data.comparison || data.notes || data["theoretical best"]) {
    const meta = document.createElement("div");
    meta.className = "wrap entry";
    meta.style.padding = "1rem";
    meta.style.marginBottom = "1rem";
    meta.style.gridColumn = "1 / -1";

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

    const card = document.createElement("div");
    card.className = "entry";
    card.style.padding = "1rem";

    const flags: string[] = [];
    if (release["dual audio"]) flags.push("Dual Audio");
    if (release["is best"]) flags.push("Best Release");
    if (release["private tracker"]) flags.push("Private Tracker");

    const flagsLine = flags.length
      ? `<div style="color:#3fa9f5; margin-bottom:4px;">${flags.join(" • ")}</div>`
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

    if (rawUrl) {
      const row = document.createElement("div");
      row.style.marginTop = "0.4rem";

      if (/^https?:\/\//i.test(rawUrl)) {
        // Full URL → clickable
        const link = document.createElement("a");
        link.href = rawUrl;
        link.textContent = "Download";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "link";
        row.appendChild(link);
      } else {
        // Relative path → Copy only
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
  placeReleasesPanel(container);
}
