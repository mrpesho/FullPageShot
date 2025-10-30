// Helper function to ensure content script is injected
async function ensureContentScript(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    // Content script not loaded, inject it
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  }
}

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  // Create main context menu item
  chrome.contextMenus.create({
    id: 'fullPageShot',
    title: 'Full Page Shot',
    contexts: ['page', 'selection', 'link', 'image']
  });

  // Create submenu for image capture
  chrome.contextMenus.create({
    id: 'fullPageShotImage',
    parentId: 'fullPageShot',
    title: 'Save as Image',
    contexts: ['page', 'selection', 'link', 'image']
  });

  // Create submenu for PDF capture
  chrome.contextMenus.create({
    id: 'fullPageShotPDF',
    parentId: 'fullPageShot',
    title: 'Save as PDF',
    contexts: ['page', 'selection', 'link', 'image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let format = null;

  if (info.menuItemId === 'fullPageShotImage') {
    format = 'image';
  } else if (info.menuItemId === 'fullPageShotPDF') {
    format = 'pdf';
  }

  if (format) {
    // Save the user's preference
    chrome.storage.local.set({ lastFormat: format });

    try {
      // Ensure content script is injected
      await ensureContentScript(tab.id);

      // Get the sticky elements preference (default to true)
      const result = await chrome.storage.local.get(['hideStickyElements']);
      const hideStickyElements = result.hideStickyElements !== undefined ? result.hideStickyElements : true;

      // Send message to content script to start full-page capture
      await chrome.tabs.sendMessage(tab.id, {
        action: 'captureFullPage',
        format: format,
        hideStickyElements: hideStickyElements
      });
    } catch (error) {
      console.error('Error sending message to content script:', error);
    }
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureVisibleTab') {
    // Capture the visible tab
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Capture error:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'generatePDF') {
    // Use chrome.tabs.printToPDF or fallback to print dialog
    // Note: printToPDF is not available in standard extensions
    // We'll trigger the print dialog which allows saving as PDF
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            // Add print-friendly CSS temporarily
            const style = document.createElement('style');
            style.id = 'fullpageshot-print-style';
            style.textContent = `
              @media print {
                body { margin: 0; }
                @page { margin: 0.5cm; size: auto; }
              }
            `;
            document.head.appendChild(style);

            // Trigger print
            window.print();

            // Remove style after print
            setTimeout(() => {
              const el = document.getElementById('fullpageshot-print-style');
              if (el) el.remove();
            }, 1000);
          }
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true;
  } else if (request.action === 'downloadCapture') {
    // Trigger download
    chrome.downloads.download({
      url: request.dataUrl,
      filename: request.filename,
      saveAs: true
    }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Download error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  }
});
