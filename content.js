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
        resultArea.textContent = ".";
      } else {
        // DEACTIVATE
        resultOverlay.classList.add('hidden');
        selLayer.classList.remove('active');
        selBox.style.display = 'none';
      }
    }
  });

  // --- Mouse Selection Logic ---

  // 1. Click to Start/End Selection
  selLayer.addEventListener('click', (e) => {
    // If we are not selecting, this click STARTS the selection
    if (!isSelecting) {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;

      // Reset box styles
      selBox.style.left = startX + 'px';
      selBox.style.top = startY + 'px';
      selBox.style.width = '0px';
      selBox.style.height = '0px';
      selBox.style.display = 'block';
      return;
    }

    // If we ARE selecting, this click ENDS the selection
    isSelecting = false;

    // Get final coordinates
    const rect = selBox.getBoundingClientRect();

    // Hide selection layer immediately
    selBox.style.display = 'none';

    // If selection is tiny, treat as invalid or potential double-click
    if (rect.width < 10 || rect.height < 10) {
      resultArea.textContent = "_";
      // Do NOT remove active class here, so dblclick can fire or user can retry
      return;
    }

    // Valid selection
    selLayer.classList.remove('active');
    resultArea.textContent = ". .";

    // Capture and Analyze
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
        resultArea.textContent = response.error || "_";
      }
    });
  });

  // 2. Mouse Move to Update Selection Box
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

  // 3. Double Click to Capture Whole Page
  selLayer.addEventListener('dblclick', (e) => {
    // Stop any active selection
    isSelecting = false;
    selBox.style.display = 'none';
    selLayer.classList.remove('active');

    resultArea.textContent = ". .";

    const area = {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
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
        resultArea.textContent = response.error || "_";
      }
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (resultOverlay.classList.contains('hidden')) return;
    if (resultOverlay.contains(e.target)) return;
    // If the click was on the selection layer (e.g. finishing a selection), don't hide
    if (e.target === selLayer) return;

    resultOverlay.classList.add('hidden');
    selLayer.classList.remove('active');
    selBox.style.display = 'none';
  });
}