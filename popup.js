// Get DOM elements
const captureImageBtn = document.getElementById('captureImage');
const capturePDFBtn = document.getElementById('capturePDF');
const statusDiv = document.getElementById('status');
const hideStickyCheckbox = document.getElementById('hideStickyElements');

// Show status message
function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
}

// Hide status message
function hideStatus() {
  statusDiv.classList.add('hidden');
}

// Disable buttons during capture
function setButtonsDisabled(disabled) {
  captureImageBtn.disabled = disabled;
  capturePDFBtn.disabled = disabled;
}

// Helper function to ensure content script is injected
async function ensureContentScript(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    // Content script not loaded, inject jsPDF and content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['jspdf.min.js', 'jspdf-wrapper.js', 'content.js']
    });
  }
}

// Capture full page
async function captureFullPage(format) {
  try {
    setButtonsDisabled(true);
    showStatus(`Capturing full page as ${format}...`, 'info');

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Ensure content script is loaded
    await ensureContentScript(tab.id);

    // Get the sticky elements preference
    const hideStickyElements = hideStickyCheckbox.checked;

    // Send message to content script to capture full page
    await chrome.tabs.sendMessage(tab.id, {
      action: 'captureFullPage',
      format: format,
      hideStickyElements: hideStickyElements
    });

    showStatus(`Capturing in progress...`, 'success');
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (error) {
    console.error('Capture error:', error);
    showStatus(`Error: ${error.message}`, 'error');
    setButtonsDisabled(false);
  }
}

// Event listeners
captureImageBtn.addEventListener('click', () => {
  captureFullPage('image');
});

capturePDFBtn.addEventListener('click', () => {
  captureFullPage('pdf');
});

// Save sticky elements preference when changed
hideStickyCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ hideStickyElements: hideStickyCheckbox.checked });
});

// Load saved preferences
chrome.storage.local.get(['lastFormat', 'hideStickyElements'], (result) => {
  // Set last format focus
  if (result.lastFormat === 'pdf') {
    capturePDFBtn.focus();
  } else {
    captureImageBtn.focus();
  }

  // Set sticky elements checkbox (default to true if not set)
  if (result.hideStickyElements !== undefined) {
    hideStickyCheckbox.checked = result.hideStickyElements;
  } else {
    hideStickyCheckbox.checked = true; // Default to hiding sticky elements
  }
});
