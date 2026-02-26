let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .popup-warning-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.5);
    }
    .popup-warning-bar {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #1a1a1a;
      box-shadow: 0 0 0 4px #f5c518;
    }
    .popup-warning-stripes {
      height: 20px;
      flex-shrink: 0;
      background: repeating-linear-gradient(
        -45deg,
        #1a1a1a,
        #1a1a1a 20px,
        #f5c518 20px,
        #f5c518 40px
      );
      background-size: 56px 56px;
      animation: popup-warning-move 3s linear infinite;
    }
    @keyframes popup-warning-move {
      0% { background-position: 0 0; }
      100% { background-position: 40px 40px; }
    }
    .popup-warning-message {
      font-size: clamp(1.5rem, 6vw, 3rem);
      font-weight: 700;
      color: #fff;
      text-shadow: 0 0 8px #000, 0 2px 4px #000;
      text-align: center;
      padding: 1.5rem 2rem;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Joe made this
 * Shows a full screen warning bar, have to click off
 * has animation too :P
 * @param {string} message - Text show on the warning
 */
export function showWarning(message) {
  if (typeof document === "undefined") return;
  injectStyles();

  const overlay = document.createElement("div");
  overlay.className = "popup-warning-overlay";
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-modal", "true");

  const bar = document.createElement("div");
  bar.className = "popup-warning-bar";

  const stripesTop = document.createElement("div");
  stripesTop.className = "popup-warning-stripes";
  const msgEl = document.createElement("div");
  msgEl.className = "popup-warning-message";
  msgEl.textContent = message ?? "Warning";
  const stripesBottom = document.createElement("div");
  stripesBottom.className = "popup-warning-stripes";

  bar.append(stripesTop, msgEl, stripesBottom);
  overlay.append(bar);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}
