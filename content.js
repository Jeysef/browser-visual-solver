if (!document.getElementById('vibecode-ai-overlay')) {
  createOverlay();
}

let isSelecting = false;
let startX = 0;
let startY = 0;

function createOverlay() {
  // 1. Create Result Container
  const container = document.createElement('div');
  container.id = 'vibecode-ai-overlay';
  container.className = 'hidden';
  container.innerHTML = `
    <div class="vc-container">
      <div class="vc-result" id="vc-result-area">Press Ctrl+. then select area</div>
    </div>
  `;
  document.body.appendChild(container);

  // 2. Create Full Screen Selection Layer
  const selectionLayer = document.createElement('div');
  selectionLayer.id = 'vc-selection-layer';
  // The selection box itself
  const selectionBox = document.createElement('div');
  selectionBox.id = 'vc-selection-box';
  selectionLayer.appendChild(selectionBox);
  document.body.appendChild(selectionLayer);

  // Elements
  const resultOverlay = document.getElementById('vibecode-ai-overlay');
  const resultArea = document.getElementById('vc-result-area');
  const selLayer = document.getElementById('vc-selection-layer');
  const selBox = document.getElementById('vc-selection-box');

  // --- Toggle Listener ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggle") {
      if (resultOverlay.classList.contains('hidden')) {
        // ACTIVATE
        resultOverlay.classList.remove('hidden');
        selLayer.classList.add('active'); // Enable selection mode
        resultArea.textContent = "Select";
      } else {
        // DEACTIVATE
        resultOverlay.classList.add('hidden');
        selLayer.classList.remove('active');
        selBox.style.display = 'none';
      }
    }
  });

  // --- Mouse Selection Logic ---

  selLayer.addEventListener('mousedown', (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Reset box styles
    selBox.style.left = startX + 'px';
    selBox.style.top = startY + 'px';
    selBox.style.width = '0px';
    selBox.style.height = '0px';
    selBox.style.display = 'block';
  });

  selLayer.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selBox.style.width = width + 'px';
    selBox.style.height = height + 'px';
    selBox.style.left = left + 'px';
    selBox.style.top = top + 'px';
  });

  selLayer.addEventListener('mouseup', async (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    // Get final coordinates
    const rect = selBox.getBoundingClientRect();
    
    // Hide selection layer immediately so we don't capture the green box border
    selBox.style.display = 'none';
    selLayer.classList.remove('active');

    // Minimal validation
    if (rect.width < 10 || rect.height < 10) {
      resultArea.textContent = "Selection too small";
      return;
    }

    resultArea.textContent = "...";

    // Capture and Analyze
    // We send coordinates relative to the viewport + pixel ratio
    const area = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      devicePixelRatio: window.devicePixelRatio || 1
    };

    chrome.runtime.sendMessage({
      action: "analyze_area",
      area: area
    }, (response) => {
      if (chrome.runtime.lastError) {
        resultArea.textContent = "Error: " + chrome.runtime.lastError.message;
        return;
      }

      if (response && response.success) {
        resultArea.textContent = response.data;
      } else {
        resultArea.textContent = response.error || "X";
      }
    });
  });
}