let hoverTimer;
let currentLink = null;
const openPopups = new Set();

document.addEventListener("mouseover", (e) => {
  const targetLink = e.target.closest("a");

  if (
    targetLink &&
    targetLink.href &&
    targetLink.href.startsWith("http") &&
    targetLink !== currentLink &&
    !isDescendantOfPopup(targetLink)
  ) {
    if (
      targetLink.href === window.location.href ||
      targetLink.href === window.location.href + "#"
    ) {
      return;
    }

    clearTimeout(hoverTimer);
    currentLink = targetLink;
    hoverTimer = setTimeout(() => {
      if (!isPopupOpen(targetLink.href)) {
        createPreviewPopup(targetLink.href, e.clientX, e.clientY);
      }
    }, 500);
  }
});
document.addEventListener("mouseout", (e) => {
  if (currentLink) {
    if (
      e.target.closest("a") === currentLink &&
      !currentLink.contains(e.relatedTarget)
    ) {
      clearTimeout(hoverTimer);
      currentLink = null;
    }
  }
});

function isDescendantOfPopup(element) {
  return element.closest(".link-preview-popup") !== null;
}

function isPopupOpen(url) {
  for (const popup of openPopups) {
    if (popup.dataset.url === url) return true;
  }
  return false;
}

function createPreviewPopup(url, x, y) {
  const popup = document.createElement("div");
  popup.className = "link-preview-popup";
  popup.dataset.url = url;

  const header = document.createElement("div");
  header.className = "link-preview-header";
  header.innerHTML = `
        <span class="link-preview-title">Loading...</span>
        <div class="link-preview-controls">
            <button class="lp-btn lp-reading-mode" title="Reading Mode">📖</button>
            <button class="lp-btn lp-open-tab" title="Open in New Tab">↗️</button>
            <button class="lp-btn lp-pin" title="Pin Position">📌</button>
            <button class="lp-btn lp-close" title="Close">❌</button>
        </div>
    `;

  const contentContainer = document.createElement("div");
  contentContainer.className = "link-preview-content";

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.className = "link-preview-iframe";
  iframe.sandbox = "allow-scripts allow-same-origin allow-popups allow-forms";
  contentContainer.appendChild(iframe);

  const resizer = document.createElement("div");
  resizer.className = "link-preview-resizer";

  popup.append(header, contentContainer, resizer);
  document.body.appendChild(popup);
  openPopups.add(popup);

  const popupWidth = 600;
  const popupHeight = 400;
  popup.style.width = `${popupWidth}px`;
  popup.style.height = `${popupHeight}px`;
  popup.style.left = `${Math.min(x, window.innerWidth - popupWidth - 20) + window.scrollX}px`;
  popup.style.top = `${Math.min(y, window.innerHeight - popupHeight - 20) + window.scrollY}px`;

  makeDraggable(popup, header);
  makeResizable(popup, resizer);
  const controls = {
    closeBtn: popup.querySelector(".lp-close"),
    pinBtn: popup.querySelector(".lp-pin"),
    readingModeBtn: popup.querySelector(".lp-reading-mode"),
    openTabBtn: popup.querySelector(".lp-open-tab"),
  };
  setupControls(popup, contentContainer, url, controls);

  let iframeLoaded = false;
  iframe.onload = () => {
    iframeLoaded = true;
    try {
      const title = iframe.contentDocument.title;
      popup.querySelector(".link-preview-title").textContent =
        title || "Content Preview";
    } catch (e) {
      popup.querySelector(".link-preview-title").textContent =
        "Content Preview";
    }
  };

  setTimeout(() => {
    if (!iframeLoaded) {
      activateReaderMode(
        contentContainer,
        url,
        popup.querySelector(".link-preview-title"),
      );
    }
  }, 3000);
}

function setupControls(popup, contentContainer, url, controls) {
  controls.closeBtn.onclick = () => {
    popup.remove();
    openPopups.delete(popup);
  };

  controls.openTabBtn.onclick = () => window.open(url, "_blank");

  controls.pinBtn.onclick = () => {
    const isFixed = popup.classList.toggle("fixed");
    controls.pinBtn.textContent = isFixed ? "📍" : "📌";
    const rect = popup.getBoundingClientRect();

    if (isFixed) {
      popup.style.left = `${rect.left}px`;
      popup.style.top = `${rect.top}px`;
    } else {
      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.style.top = `${rect.top + window.scrollY}px`;
    }
  };

  controls.readingModeBtn.onclick = () => {
    activateReaderMode(
      contentContainer,
      url,
      popup.querySelector(".link-preview-title"),
    );
  };
}

function activateReaderMode(contentContainer, url, titleElement) {
  contentContainer.innerHTML = `<div class="message">⏳ Parsing article...</div>`;
  chrome.runtime.sendMessage(
    { action: "fetchForReader", url: url },
    (response) => {
      if (response && response.success) {
        contentContainer.innerHTML = `
                <div class="reader-view-content">
                    <h1>${response.article.title}</h1>
                    <p><em>${response.article.byline || ""}</em></p>
                    ${response.article.content}
                </div>
            `;
        titleElement.textContent = response.article.title;
      } else {
        contentContainer.innerHTML = `<div class="message">❌ Reader mode failed: ${response.error || "Unknown error"}</div>`;
      }
    },
  );
}

function makeDraggable(element, handle) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = element.offsetTop - pos2 + "px";
    element.style.left = element.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function makeResizable(element, resizer) {
  let startX, startY, startWidth, startHeight;

  resizer.addEventListener("mousedown", initDrag, false);

  function initDrag(e) {
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(
      document.defaultView.getComputedStyle(element).width,
      10,
    );
    startHeight = parseInt(
      document.defaultView.getComputedStyle(element).height,
      10,
    );
    document.documentElement.addEventListener("mousemove", doDrag, false);
    document.documentElement.addEventListener("mouseup", stopDrag, false);
  }

  function doDrag(e) {
    element.style.width = startWidth + e.clientX - startX + "px";
    element.style.height = startHeight + e.clientY - startY + "px";
  }

  function stopDrag() {
    document.documentElement.removeEventListener("mousemove", doDrag, false);
    document.documentElement.removeEventListener("mouseup", stopDrag, false);
  }
}
