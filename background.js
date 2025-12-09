chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-ui") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggle" });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze_area") {
    handleCroppedAnalysis(request.area).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleCroppedAnalysis(area) {
  try {
    // 1. Capture the WHOLE visible tab
    const dataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(undefined, { format: "png" }, (image) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(image);
        }
      });
    });

    if (!dataUrl) return { success: false, error: "Capture failed" };

    // 2. Crop the image using OffscreenCanvas
    const croppedDataUrl = await cropImage(dataUrl, area);

    let modelId = "qwen/qwen3-vl-4b";
    try {
      const modelsResponse = await fetch("http://localhost:1234/api/v0/models");
      const modelsJson = await modelsResponse.json();

      // Select the first found model from the data array
      if (modelsJson.data && modelsJson.data.length > 0) {
        modelId = modelsJson.data[0].id;
        console.log("Using model:", modelId);
      }
    } catch (e) {
      console.warn("Failed to fetch model list, using default 'local-model'.", e);
    }

    // 3. Send to AI
    const payload = {
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: croppedDataUrl } },
          ]
        }
      ],
      stream: false
    };

    const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await response.json();

    if (json.choices && json.choices.length > 0) {
      let content = json.choices[0].message.content;
      // Clean up <think> tags if your local model outputs them
      const cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      return { success: true, data: cleanedContent };
    } else {
      return { success: false, error: "_" };
    }

  } catch (error) {
    console.error(error);
    return { success: false, error: "_" };
  }
}

/**
 * Helper to crop image in Background Service Worker
 * Uses OffscreenCanvas (Standard in Manifest V3)
 */
async function cropImage(base64Data, area) {
  // Fetch the data URL to get a blob
  const response = await fetch(base64Data);
  const blob = await response.blob();

  // Create a bitmap from the blob
  const bitmap = await createImageBitmap(blob);

  // Handle Device Pixel Ratio (Retina/HighDPI screens)
  // captureVisibleTab returns the actual physical pixel image
  const scale = area.devicePixelRatio;

  const sX = area.x * scale;
  const sY = area.y * scale;
  const sW = area.width * scale;
  const sH = area.height * scale;

  // Create canvas of the specific crop size
  const canvas = new OffscreenCanvas(sW, sH);
  const ctx = canvas.getContext('2d');

  // Draw strictly the cropped area
  // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
  ctx.drawImage(bitmap, sX, sY, sW, sH, 0, 0, sW, sH);

  // Convert back to base64
  const blobResult = await canvas.convertToBlob({ type: 'image/jpeg' });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blobResult);
  });
}