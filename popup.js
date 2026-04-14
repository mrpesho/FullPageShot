// Get DOM elements
const captureImageBtn = document.getElementById('captureImage');
const capturePDFBtn = document.getElementById('capturePDF');
const statusDiv = document.getElementById('status');
const hideStickyCheckbox = document.getElementById('hideStickyElements');
const showUrlHeaderCheckbox = document.getElementById('showUrlHeader');
const scrollToTopCheckbox = document.getElementById('scrollToTop');
const limitCaptureCheckbox = document.getElementById('limitCapture');
const maxCapturesInput = document.getElementById('maxCaptures');
const maxCapturesRow = document.getElementById('maxCapturesRow');

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

    // Get preferences
    const hideStickyElements = hideStickyCheckbox.checked;
    const showUrlHeader = showUrlHeaderCheckbox.checked;
    const scrollToTop = scrollToTopCheckbox.checked;
    const maxCaptures = limitCaptureCheckbox.checked ? parseInt(maxCapturesInput.value, 10) : 0;

    // Send message to content script to capture full page
    await chrome.tabs.sendMessage(tab.id, {
      action: 'captureFullPage',
      format: format,
      hideStickyElements: hideStickyElements,
      showUrlHeader: showUrlHeader,
      scrollToTop: scrollToTop,
      maxCaptures: maxCaptures
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

// Save URL header preference when changed
showUrlHeaderCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ showUrlHeader: showUrlHeaderCheckbox.checked });
});

// Save scroll to top preference when changed
scrollToTopCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ scrollToTop: scrollToTopCheckbox.checked });
});

// Save limit capture preferences when changed
limitCaptureCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ limitCapture: limitCaptureCheckbox.checked });
  maxCapturesRow.classList.toggle('hidden', !limitCaptureCheckbox.checked);
});

maxCapturesInput.addEventListener('change', () => {
  const val = Math.max(1, Math.min(99, parseInt(maxCapturesInput.value, 10) || 3));
  maxCapturesInput.value = val;
  chrome.storage.local.set({ maxCaptures: val });
});

// Load saved preferences
chrome.storage.local.get(['lastFormat', 'hideStickyElements', 'showUrlHeader', 'scrollToTop', 'limitCapture', 'maxCaptures'], (result) => {
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

  // Set URL header checkbox (default to false if not set)
  if (result.showUrlHeader !== undefined) {
    showUrlHeaderCheckbox.checked = result.showUrlHeader;
  } else {
    showUrlHeaderCheckbox.checked = false; // Default to not showing URL header
  }

  // Set scroll to top checkbox (default to true if not set)
  if (result.scrollToTop !== undefined) {
    scrollToTopCheckbox.checked = result.scrollToTop;
  } else {
    scrollToTopCheckbox.checked = true;
  }

  // Set limit capture checkbox (default to false if not set)
  if (result.limitCapture !== undefined) {
    limitCaptureCheckbox.checked = result.limitCapture;
  } else {
    limitCaptureCheckbox.checked = false;
  }
  maxCapturesRow.classList.toggle('hidden', !limitCaptureCheckbox.checked);

  // Set max captures value (default to 3)
  if (result.maxCaptures !== undefined) {
    maxCapturesInput.value = result.maxCaptures;
  } else {
    maxCapturesInput.value = 3;
  }

});
