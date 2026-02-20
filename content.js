// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'capture') {
    captureCurrentView(request.format, request.hideStickyElements).then(result => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'captureFullPage') {
    captureFullPage(request.format, request.hideStickyElements, request.showUrlHeader, request.maxCaptures);
    sendResponse({ success: true });
    return true;
  }
});

// Detect the actual scrollable container (for SPAs like LinkedIn that use a scrollable div)
function getScrollContainer() {
  // If the document itself scrolls, use the default window scrolling
  if (document.documentElement.scrollHeight > window.innerHeight + 1) {
    return null;
  }

  // Scan for a scrollable container element
  let best = null;
  let bestScrollHeight = 0;

  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      if (el.scrollHeight > el.clientHeight + 1) {
        if (el.scrollHeight > bestScrollHeight) {
          best = el;
          bestScrollHeight = el.scrollHeight;
        }
      }
    }
  }

  return best;
}

// Unified scroll interface that works with both window and container element scrolling
function getScrollInfo(container) {
  if (!container) {
    return {
      pageHeight: Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      ),
      pageWidth: Math.max(
        document.body.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth,
        document.documentElement.offsetWidth
      ),
      scrollTo(x, y) { window.scrollTo({ left: x, top: y, behavior: 'instant' }); },
      getScrollX() { return window.scrollX; },
      getScrollY() { return window.scrollY; },
    };
  }

  return {
    pageHeight: container.scrollHeight,
    pageWidth: Math.max(
      container.scrollWidth,
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    ),
    scrollTo(x, y) { container.scrollTo({ left: x, top: y, behavior: 'instant' }); },
    getScrollX() { return container.scrollLeft; },
    getScrollY() { return container.scrollTop; },
  };
}

// Helper functions for detecting and managing sticky elements
function getStickyElements() {
  const elements = [];
  const allElements = document.querySelectorAll('*');

  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const position = style.position;

    if (position === 'fixed' || position === 'sticky') {
      const rect = el.getBoundingClientRect();
      const isVisible = style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0' &&
                        rect.width > 0 &&
                        rect.height > 0;

      if (isVisible) {
        elements.push({
          element: el,
          originalDisplay: style.display,
          position: position,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height
        });
      }
    }
  }

  return elements;
}

function categorizeStickyElements(stickyElements) {
  const viewportHeight = window.innerHeight;
  const headers = [];
  const footers = [];
  const others = [];

  for (const item of stickyElements) {
    // Consider it a header if it's in the top 20% of viewport
    if (item.top < viewportHeight * 0.2) {
      headers.push(item);
    }
    // Consider it a footer if it's in the bottom 20% of viewport
    else if (item.bottom > viewportHeight * 0.8) {
      footers.push(item);
    }
    else {
      others.push(item);
    }
  }

  return { headers, footers, others };
}

function hideElements(elements) {
  for (const item of elements) {
    // Use setProperty with 'important' to override CSS !important rules
    item.element.style.setProperty('display', 'none', 'important');
  }
}

function showElements(elements) {
  for (const item of elements) {
    // Remove the inline display property to restore original CSS styling
    item.element.style.removeProperty('display');
  }
}

// Draw URL header on canvas
function drawUrlHeader(ctx, width, height, dpr) {
  const url = window.location.href;

  // Draw beige-to-white gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, height * dpr);
  gradient.addColorStop(0, '#f5f5dc'); // Beige
  gradient.addColorStop(1, '#ffffff'); // White
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width * dpr, height * dpr);

  // Draw bottom border
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, height * dpr - 0.5 * dpr);
  ctx.lineTo(width * dpr, height * dpr - 0.5 * dpr);
  ctx.stroke();

  // Set up text style
  const fontSize = 14;
  const padding = 16;
  ctx.font = `${fontSize * dpr}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#333333'; // Dark text
  ctx.textBaseline = 'middle';

  // Calculate available width for text
  const maxTextWidth = (width - padding * 2) * dpr;

  // Truncate URL with "..." if too long
  let displayUrl = url;
  let textWidth = ctx.measureText(displayUrl).width;

  if (textWidth > maxTextWidth) {
    const ellipsis = '...';
    const ellipsisWidth = ctx.measureText(ellipsis).width;

    // Binary search for the right truncation point
    let low = 0;
    let high = displayUrl.length;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const truncated = displayUrl.substring(0, mid) + ellipsis;
      if (ctx.measureText(truncated).width <= maxTextWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    displayUrl = displayUrl.substring(0, low) + ellipsis;
  }

  // Draw the URL text
  ctx.fillText(displayUrl, padding * dpr, (height / 2) * dpr);
}

// Capture current viewport only
async function captureCurrentView(format, hideStickyElements = true) {
  try {
    if (format === 'image') {
      return await captureAsImage(false, hideStickyElements);
    } else if (format === 'pdf') {
      return await captureAsPDF(false, hideStickyElements);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Capture full page by scrolling
async function captureFullPage(format, hideStickyElements = true, showUrlHeader = false, maxCaptures = 0) {
  // showCaptureProgress('Preparing to capture full page...');

  try {
    if (format === 'image') {
      await captureAsImage(true, hideStickyElements, showUrlHeader, maxCaptures);
    } else if (format === 'pdf') {
      await captureAsPDF(true, hideStickyElements, showUrlHeader, maxCaptures);
    }
    // hideCaptureProgress();
  } catch (error) {
    console.error('Full page capture error:', error);
    // showCaptureProgress('Error: ' + error.message, true);
    // setTimeout(hideCaptureProgress, 3000);
  }
}

// Capture as image (PNG)
async function captureAsImage(fullPage = false, hideStickyElements = true, showUrlHeader = false, maxCaptures = 0) {
  try {
    if (fullPage) {
      // showCaptureProgress('Capturing full page as image...');

      // Detect scroll container (for SPAs like LinkedIn)
      const scrollContainer = getScrollContainer();
      const scrollInfo = getScrollInfo(scrollContainer);

      // Save original scroll position
      const originalScrollY = scrollInfo.getScrollY();
      const originalScrollX = scrollInfo.getScrollX();

      // Get device pixel ratio for high-DPI displays
      const dpr = window.devicePixelRatio || 1;

      // Get page dimensions (in CSS pixels)
      let pageHeight = scrollInfo.pageHeight;
      const pageWidth = scrollInfo.pageWidth;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate number of screenshots needed
      let numVertical = Math.ceil(pageHeight / viewportHeight);
      const numHorizontal = Math.ceil(pageWidth / viewportWidth);

      // Apply max captures limit before creating canvas (avoids oversized canvas)
      if (maxCaptures > 0 && numVertical > maxCaptures) {
        numVertical = maxCaptures;
        pageHeight = numVertical * viewportHeight;
      }

      // URL header dimensions (in CSS pixels)
      const headerHeight = showUrlHeader ? 40 : 0;
      const totalHeight = pageHeight + headerHeight;

      // Create canvas for full page (at device pixel resolution for sharpness)
      const canvas = document.createElement('canvas');
      canvas.width = pageWidth * dpr;
      canvas.height = totalHeight * dpr;
      const ctx = canvas.getContext('2d');

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw URL header if enabled
      if (showUrlHeader) {
        drawUrlHeader(ctx, pageWidth, headerHeight, dpr);
      }

      let captureCount = 0;
      const totalCaptures = numVertical * numHorizontal;

      // Detect sticky elements (only if hiding is enabled)
      let stickyElements = [];
      let headers = [];
      let footers = [];
      let others = [];

      if (hideStickyElements) {
        // Scroll down first to activate sticky elements that only become sticky on scroll
        scrollInfo.scrollTo(0, viewportHeight);
        await new Promise(resolve => setTimeout(resolve, 100));

        stickyElements = getStickyElements();
        const categorized = categorizeStickyElements(stickyElements);
        headers = categorized.headers;
        footers = categorized.footers;
        others = categorized.others;

        // Scroll back to top before starting capture
        scrollInfo.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Scroll and capture
      for (let row = 0; row < numVertical; row++) {
        for (let col = 0; col < numHorizontal; col++) {
          let x = col * viewportWidth;
          let y = row * viewportHeight;
          let drawX = x;
          let drawY = y;
          let drawWidth = viewportWidth;
          let drawHeight = viewportHeight;
          let sourceX = 0;
          let sourceY = 0;

          // For the last row, adjust to capture only remaining content
          if (row === numVertical - 1 && pageHeight % viewportHeight !== 0) {
            const remainingHeight = pageHeight % viewportHeight;
            y = pageHeight - viewportHeight; // Scroll so bottom aligns with viewport bottom
            sourceY = viewportHeight - remainingHeight; // Start copying from this Y position in the image
            drawHeight = remainingHeight; // Only draw the remaining height
            drawY = pageHeight - remainingHeight; // Draw at this position on canvas
          }

          // For the last column, adjust to capture only remaining content
          if (col === numHorizontal - 1 && pageWidth % viewportWidth !== 0) {
            const remainingWidth = pageWidth % viewportWidth;
            x = pageWidth - viewportWidth; // Scroll so right edge aligns with viewport right
            sourceX = viewportWidth - remainingWidth; // Start copying from this X position in the image
            drawWidth = remainingWidth; // Only draw the remaining width
            drawX = pageWidth - remainingWidth; // Draw at this position on canvas
          }

          scrollInfo.scrollTo(x, y);
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait for render

          // Hide/show sticky elements based on position (only if enabled)
          if (hideStickyElements) {
            const isFirstRow = (row === 0);
            const isLastRow = (row === numVertical - 1);

            // Hide headers except on first row
            if (!isFirstRow) {
              hideElements(headers);
            }

            // Hide footers except on last row
            if (!isLastRow) {
              hideElements(footers);
            }

            // Wait for DOM to reflow after hiding elements
            if (!isFirstRow || !isLastRow) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          captureCount++;
          // showCaptureProgress(`Capturing... ${captureCount}/${totalCaptures}`);

          // Capture current viewport
          let dataUrl;
          try {
            dataUrl = await captureViewport();
          } catch (error) {
            // Restore sticky elements before throwing
            showElements(headers);
            showElements(footers);
            throw new Error(`Capture failed at position ${captureCount}/${totalCaptures}: ${error.message}`);
          }

          // Restore sticky elements for next iteration
          showElements(headers);
          showElements(footers);
          const img = await loadImage(dataUrl);

          // Draw on canvas (scale by DPR since captured image is in device pixels)
          // Source coordinates are in device pixels (captured image resolution)
          // Destination coordinates are in device pixels (canvas resolution)
          // Add headerHeight offset to Y position for screenshots
          ctx.drawImage(
            img,
            sourceX * dpr, sourceY * dpr, drawWidth * dpr, drawHeight * dpr,
            drawX * dpr, (drawY + headerHeight) * dpr, drawWidth * dpr, drawHeight * dpr
          );

          // Add delay to avoid Chrome's rate limit (max 2 captures per second)
          // Using 700ms to account for reflow delays and provide buffer
          if (captureCount < totalCaptures) {
            await new Promise(resolve => setTimeout(resolve, 700));
          }
        }
      }

      // Restore original scroll position
      scrollInfo.scrollTo(originalScrollX, originalScrollY);

      // Ensure all sticky elements are restored
      if (stickyElements && stickyElements.length > 0) {
        showElements(headers);
        showElements(footers);
      }

      // Convert canvas to blob and download
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const filename = generateFilename('png');

      downloadFile(url, filename);

      return { success: true };
    } else {
      // Capture only current viewport
      const dataUrl = await captureViewport();
      const filename = generateFilename('png');
      downloadFile(dataUrl, filename);
      return { success: true };
    }
  } catch (error) {
    console.error('Image capture error:', error);
    return { success: false, error: error.message };
  }
}

// Capture current viewport using background script
async function captureViewport() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (response) => {
      if (response && response.dataUrl) {
        resolve(response.dataUrl);
      } else {
        reject(new Error('Failed to capture viewport'));
      }
    });
  });
}

// Capture as PDF - capture as image then convert to PDF
async function captureAsPDF(fullPage = false, hideStickyElements = true, showUrlHeader = false, maxCaptures = 0) {
  try {
    // showCaptureProgress('Capturing page for PDF...');

    if (fullPage) {
      // Detect scroll container (for SPAs like LinkedIn)
      const scrollContainer = getScrollContainer();
      const scrollInfo = getScrollInfo(scrollContainer);

      // Save original scroll position
      const originalScrollY = scrollInfo.getScrollY();
      const originalScrollX = scrollInfo.getScrollX();

      // Get device pixel ratio for high-DPI displays
      const dpr = window.devicePixelRatio || 1;

      // Get page dimensions (in CSS pixels)
      let pageHeight = scrollInfo.pageHeight;
      const pageWidth = scrollInfo.pageWidth;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate number of screenshots needed
      let numVertical = Math.ceil(pageHeight / viewportHeight);
      const numHorizontal = Math.ceil(pageWidth / viewportWidth);

      // Apply max captures limit before creating canvas (avoids oversized canvas)
      if (maxCaptures > 0 && numVertical > maxCaptures) {
        numVertical = maxCaptures;
        pageHeight = numVertical * viewportHeight;
      }

      // URL header dimensions (in CSS pixels)
      const headerHeight = showUrlHeader ? 40 : 0;
      const totalHeight = pageHeight + headerHeight;

      // Create canvas for full page (at device pixel resolution for sharpness)
      const canvas = document.createElement('canvas');
      canvas.width = pageWidth * dpr;
      canvas.height = totalHeight * dpr;
      const ctx = canvas.getContext('2d');

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw URL header if enabled
      if (showUrlHeader) {
        drawUrlHeader(ctx, pageWidth, headerHeight, dpr);
      }

      let captureCount = 0;
      const totalCaptures = numVertical * numHorizontal;

      // Detect sticky elements (only if hiding is enabled)
      let stickyElements = [];
      let headers = [];
      let footers = [];
      let others = [];

      if (hideStickyElements) {
        // Scroll down first to activate sticky elements that only become sticky on scroll
        scrollInfo.scrollTo(0, viewportHeight);
        await new Promise(resolve => setTimeout(resolve, 100));

        stickyElements = getStickyElements();
        const categorized = categorizeStickyElements(stickyElements);
        headers = categorized.headers;
        footers = categorized.footers;
        others = categorized.others;

        // Scroll back to top before starting capture
        scrollInfo.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Scroll and capture
      for (let row = 0; row < numVertical; row++) {
        for (let col = 0; col < numHorizontal; col++) {
          let x = col * viewportWidth;
          let y = row * viewportHeight;
          let drawX = x;
          let drawY = y;
          let drawWidth = viewportWidth;
          let drawHeight = viewportHeight;
          let sourceX = 0;
          let sourceY = 0;

          // For the last row, adjust to capture only remaining content
          if (row === numVertical - 1 && pageHeight % viewportHeight !== 0) {
            const remainingHeight = pageHeight % viewportHeight;
            y = pageHeight - viewportHeight; // Scroll so bottom aligns with viewport bottom
            sourceY = viewportHeight - remainingHeight; // Start copying from this Y position in the image
            drawHeight = remainingHeight; // Only draw the remaining height
            drawY = pageHeight - remainingHeight; // Draw at this position on canvas
          }

          // For the last column, adjust to capture only remaining content
          if (col === numHorizontal - 1 && pageWidth % viewportWidth !== 0) {
            const remainingWidth = pageWidth % viewportWidth;
            x = pageWidth - viewportWidth; // Scroll so right edge aligns with viewport right
            sourceX = viewportWidth - remainingWidth; // Start copying from this X position in the image
            drawWidth = remainingWidth; // Only draw the remaining width
            drawX = pageWidth - remainingWidth; // Draw at this position on canvas
          }

          scrollInfo.scrollTo(x, y);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Hide/show sticky elements based on position (only if enabled)
          if (hideStickyElements) {
            const isFirstRow = (row === 0);
            const isLastRow = (row === numVertical - 1);

            // Hide headers except on first row
            if (!isFirstRow) {
              hideElements(headers);
            }

            // Hide footers except on last row
            if (!isLastRow) {
              hideElements(footers);
            }

            // Wait for DOM to reflow after hiding elements
            if (!isFirstRow || !isLastRow) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          captureCount++;
          // showCaptureProgress(`Capturing for PDF... ${captureCount}/${totalCaptures}`);

          // Capture current viewport
          let dataUrl;
          try {
            dataUrl = await captureViewport();
          } catch (error) {
            // Restore sticky elements before throwing
            showElements(headers);
            showElements(footers);
            throw new Error(`Capture failed at position ${captureCount}/${totalCaptures}: ${error.message}`);
          }

          // Restore sticky elements for next iteration
          showElements(headers);
          showElements(footers);
          const img = await loadImage(dataUrl);

          // Draw on canvas (scale by DPR since captured image is in device pixels)
          // Add headerHeight offset to Y position for screenshots
          ctx.drawImage(
            img,
            sourceX * dpr, sourceY * dpr, drawWidth * dpr, drawHeight * dpr,
            drawX * dpr, (drawY + headerHeight) * dpr, drawWidth * dpr, drawHeight * dpr
          );

          // Add delay to avoid Chrome's rate limit (max 2 captures per second)
          // Using 700ms to account for reflow delays and provide buffer
          if (captureCount < totalCaptures) {
            await new Promise(resolve => setTimeout(resolve, 700));
          }
        }
      }

      // Restore original scroll position
      scrollInfo.scrollTo(originalScrollX, originalScrollY);

      // Ensure all sticky elements are restored
      if (stickyElements && stickyElements.length > 0) {
        showElements(headers);
        showElements(footers);
      }

      // showCaptureProgress('Converting to PDF...');

      // Convert canvas to PDF using jsPDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // Calculate PDF dimensions (A4 proportions or page proportions)
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (totalHeight / pageWidth) * pdfWidth;

      // Create PDF with jsPDF
      if (!window.jsPDF) {
        throw new Error('jsPDF library not loaded');
      }
      const pdf = new window.jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      // Download PDF
      const filename = generateFilename('pdf');
      pdf.save(filename);

      // hideCaptureProgress();
      return { success: true };
    } else {
      // Capture current viewport and convert to PDF
      const dataUrl = await captureViewport();

      // showCaptureProgress('Converting to PDF...');

      if (!window.jsPDF) {
        throw new Error('jsPDF library not loaded');
      }
      const pdf = new window.jsPDF({
        orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
        unit: 'px',
        format: [window.innerWidth, window.innerHeight]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, window.innerWidth, window.innerHeight);

      const filename = generateFilename('pdf');
      pdf.save(filename);

      // hideCaptureProgress();
      return { success: true };
    }
  } catch (error) {
    console.error('PDF capture error:', error);
    // hideCaptureProgress();
    return { success: false, error: error.message };
  }
}

// Helper function to load image from data URL
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Generate filename with timestamp
function generateFilename(extension) {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const pageTitle = document.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50) || 'page';
  return `fullpageshot_${pageTitle}_${timestamp}.${extension}`;
}

// Download file
function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up object URL if it was created
  if (url.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

// Show capture progress overlay
function showCaptureProgress(message, isError = false) {
  let overlay = document.getElementById('fullpageshot-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'fullpageshot-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isError ? '#ef4444' : '#667eea'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      animation: slideIn 0.3s ease;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(overlay);
  }

  overlay.textContent = message;
  overlay.style.background = isError ? '#ef4444' : '#667eea';
}

// Hide capture progress overlay
function hideCaptureProgress() {
  const overlay = document.getElementById('fullpageshot-overlay');
  if (overlay) {
    overlay.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }
}
