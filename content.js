if (!document.getElementById('vibecode-ai-overlay')) {
  createOverlay();
}

let isRunning = false;
let loopTimeout = null;

function createOverlay() {
  const container = document.createElement('div');
  container.id = 'vibecode-ai-overlay';
  container.className = 'hidden';

  container.innerHTML = `
    <div class="vc-container">
      <div class="vc-result" id="vc-result-area">Waiting to start...</div>
    </div>
  `;

  document.body.appendChild(container);

  // Elements
  const overlay = document.getElementById('vibecode-ai-overlay');
  const resultArea = document.getElementById('vc-result-area');

  // Toggle Settings
//   settingsBtn.addEventListener('click', (e) => {
//     e.stopPropagation(); // Prevent issues
//     settingsPanel.classList.toggle('show');
//   });

  // Toggle On/Off via Background Script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggle") {
      if (overlay.classList.contains('hidden')) {
        // SHOW and START
        overlay.classList.remove('hidden');
        isRunning = true;
        resultArea.textContent = ".";
        runAnalysisLoop();
      } else {
        // HIDE and STOP
        overlay.classList.add('hidden');
        isRunning = false;
        clearTimeout(loopTimeout);
        // settingsPanel.classList.remove('show');
      }
    }
  });

  async function runAnalysisLoop() {
    if (!isRunning) return;

    // 1. Get Prompt

    // 2. Send Message to Background
    chrome.runtime.sendMessage({
      action: "analyze",
      userPrompt: "Current screen state", // Generic trigger
      systemPrompt: ""
    }, (response) => {
      // 3. Update UI if we are still running
      if (!isRunning) return;

      if (response && response.success) {
        resultArea.textContent = response.data;
      } else if (response && response.error) {
        // Only show error if it's not a cancellation
        resultArea.textContent = "."; 
        console.warn(response.error);
      }

      // 4. Schedule next run in 3 seconds
      if (isRunning) {
        loopTimeout = setTimeout(runAnalysisLoop, 3000);
      }
    });
  }
}