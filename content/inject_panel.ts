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

export function injectReleasesPanel(data: ReleaseData) {
  const container = document.createElement("div");

  const header = document.createElement("h2");
  header.textContent = "Releases";
  header.className = "section-header";
  container.appendChild(header);

  const contentWrap = document.createElement("div");
  contentWrap.className = "content-wrap list";

  // Combined meta info (only once, above the releases list)
  if (data.comparison || data.notes || data["theoretical best"]) {
    const meta = document.createElement("div");
    meta.className = "wrap entry";
    meta.style.padding = "1rem";
    meta.style.marginBottom = "1rem";

    if (data.comparison) {
      const cmp = document.createElement("div");
      cmp.innerHTML = `<strong>Comparison:</strong> ${data.comparison}`;
      meta.appendChild(cmp);
    }
    if (data.notes) {
      const notes = document.createElement("div");
      notes.innerHTML = `<strong>Notes:</strong> ${data.notes}`;
      meta.appendChild(notes);
    }
    if (data["theoretical best"]) {
      const best = document.createElement("div");
      best.innerHTML = `<strong>Theoretical Best:</strong> ${data["theoretical best"]}`;
      meta.appendChild(best);
    }

    contentWrap.appendChild(meta);
  }

  // Releases list
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

    card.innerHTML = `
      <div style="font-weight:600; margin-bottom:4px;">
        ${release["release group"]}
      </div>
      <div>${release.tracker}</div>
      <div><em>${release["file size"]}</em></div>
      ${flagsLine}
      <div>
        <a href="${release.url}" target="_blank">
          Download
        </a>
      </div>
    `;

    // Collapsible episode list
    if (release["episode list"]?.length) {
      const toggle = document.createElement("button");
      toggle.textContent = "Show Episodes";
      toggle.style.cssText = `
        margin-top: 0.5rem;
        background: none;
        border: none;
        color: #3fa9f5;
        cursor: pointer;
      `;

      const epContainer = document.createElement("ul");
      epContainer.style.marginTop = "0.5rem";
      epContainer.style.paddingLeft = "1.2rem";
      epContainer.style.display = "none"; // hidden by default

      release["episode list"].forEach(ep => {
        const li = document.createElement("li");
        li.textContent = `${ep.name} — ${ep.size}`;
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
