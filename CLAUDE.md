# FullPageShot - Chrome Extension

Chrome extension (Manifest V3) that captures full-page screenshots as PNG or PDF with automatic scrolling and sticky element handling.

## Architecture

### Core Components
1. **manifest.json** - Extension config (Manifest V3)
   - Permissions: `activeTab`, `contextMenus`, `storage`, `scripting`
   - Host permissions: `<all_urls>` (required for `captureVisibleTab` during scrolling)
   - Note: `downloads` permission NOT needed — uses DOM `<a download>` approach

2. **popup.html/css/js** - UI
   - "Save as Image" and "Save as PDF" buttons
   - Toggles: sticky element hiding, URL header, scroll to top, limit capture length
   - Limit capture: toggle + number input (max screens), for infinite-scroll pages

3. **content.js** - Main capture logic (injected into pages)
   - Screenshot capture and canvas stitching
   - Sticky element detection and management
   - Full-page scrolling coordination

4. **background.js** - Service worker
   - Context menu creation ("Full Page Shot")
   - Message routing between popup and content script
   - Screenshot API calls (`chrome.tabs.captureVisibleTab`)

5. **jspdf.min.js + jspdf-wrapper.js** - PDF generation
   - jsPDF v2.5.1 (MIT license)
   - Wrapper exposes as `window.jsPDF`

## Key Technical Details

### Screenshot Capture Flow
Content scripts cannot capture screenshots directly:
1. Content script sends message to background script
2. Background script uses `chrome.tabs.captureVisibleTab()` API
3. Returns data URL to content script
4. Content script draws on canvas and stitches images

### Capture Length Limiting
When enabled, caps the number of vertical viewport captures (e.g., 3 screens max). Useful for infinite-scroll pages that would otherwise produce extremely long screenshots.

**Critical ordering**: Apply the limit BEFORE creating the canvas. On infinite-scroll pages, the full `scrollHeight` can be enormous. Creating an oversized canvas first can exceed Chrome's canvas size limit, causing the context to silently fail — even after resizing smaller.

### Full-Page Capture Strategy
1. Calculate total page dimensions (`scrollHeight`, `scrollWidth`)
2. Calculate number of viewport captures needed (rows × columns)
3. Apply maxCaptures limit if enabled (before canvas creation)
4. Create canvas matching (limited) page size
5. Loop through page:
   - Scroll to position → Wait 100ms for render
   - Hide sticky elements if enabled → Wait 50ms for DOM reflow
   - Capture viewport via background script
   - Restore sticky elements
   - Draw captured image on canvas at correct position
   - Wait 700ms (rate limit buffer)
6. Handle edge cases (last row/column partial captures)
7. Restore original scroll position

### Rate Limiting (Critical!)
Chrome limits `captureVisibleTab` to **2 calls per second**. Delays used:
- 100ms: Scroll settling time
- 50ms: DOM reflow after hiding elements
- 700ms: Buffer between captures
- **Total ~850-900ms per capture**

### Sticky Element Hiding
1. **Detection**: Scan DOM for `position: fixed` or `position: sticky`
   - Must scroll down first to detect elements that only become sticky on scroll
2. **Categorization**: Headers (top 20%), Footers (bottom 20%)
3. **Smart Hiding**:
   - First row: Show headers, hide footers
   - Middle rows: Hide both
   - Last row: Show footers, hide headers
4. **CSS Override**: Use `setProperty('display', 'none', 'important')` to override `!important` rules
5. **Restore**: Use `removeProperty('display')` to cleanly restore original CSS

### SPA Scroll Container Detection
Many SPAs (LinkedIn, Twitter, etc.) use a scrollable `div` instead of document body scrolling. The extension detects this:

```javascript
function getScrollContainer() {
  // If document scrolls normally, use window
  if (document.documentElement.scrollHeight > window.innerHeight + 1) {
    return null;
  }
  // Otherwise, find the largest scrollable container
  // Look for overflow-y: auto|scroll with scrollHeight > clientHeight
}
```

`getScrollInfo(container)` provides a unified interface for both cases:
- `pageHeight`, `pageWidth` — dimensions
- `scrollTo(x, y)`, `getScrollX()`, `getScrollY()` — scroll operations

**Important**: `scrollTo` uses `behavior: 'instant'` to override sites with `scroll-behavior: smooth` in CSS. Without this, smooth scrolling causes the page to still be mid-animation when the capture fires, producing duplicate content.

### Edge Capture Alignment
When page height isn't a multiple of viewport height:
```javascript
// For last row
sourceY = viewportHeight - remainingHeight; // Start Y in captured image
drawHeight = remainingHeight;               // Height to draw
drawY = pageHeight - remainingHeight;       // Position on canvas
```

### High-DPI (Retina) Display Support
`captureVisibleTab()` captures at **device pixel resolution**, not CSS pixels. On a Retina display with DPR=2, a 1440px CSS viewport produces a 2880px image.

**Solution**: Scale canvas and drawing coordinates by `devicePixelRatio`:
```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = pageWidth * dpr;
canvas.height = pageHeight * dpr;
// When drawing captured images:
ctx.drawImage(img,
  sourceX * dpr, sourceY * dpr, drawWidth * dpr, drawHeight * dpr,
  drawX * dpr, drawY * dpr, drawWidth * dpr, drawHeight * dpr
);
```

### URL Header Feature
When enabled, adds a header bar above the screenshot showing the page URL:
1. **Height**: 40px (CSS pixels), scaled by `devicePixelRatio` for Retina
2. **Background**: Linear gradient from beige (#f5f5dc) to white (#ffffff)
3. **Text**: Dark (#333333), 14px system font
4. **Truncation**: Long URLs truncated with "..." using binary search for optimal fit
5. **Canvas offset**: All screenshot content drawn with Y offset of `headerHeight * dpr`

### Dynamic Script Injection
When injecting content script dynamically, must include all files:
```javascript
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['jspdf.min.js', 'jspdf-wrapper.js', 'content.js']
});
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "jsPDF library not loaded" | Only content.js injected | Include all 3 files in executeScript |
| Sticky elements still visible | CSS uses `!important` | Use `setProperty` with 'important' flag |
| Sticky not detected on some sites | Elements only sticky after scroll | Scroll down before detecting, then scroll back |
| Only first screen captured | Using wrong action | Use `captureFullPage` action, not `capture` |
| Rate limit exceeded | Capturing too fast | Ensure 700ms+ delay between captures |
| White/blank images | Not using screenshot API | Use `captureVisibleTab` via background script |
| Duplicate content at edges | Not handling partial viewports | Use source rectangle extraction for last row/col |
| Right side clipped on Retina/HiDPI | Not accounting for devicePixelRatio | Scale canvas and drawImage coords by `window.devicePixelRatio` |
| Only first viewport on LinkedIn/SPAs | Site uses scrollable div, not body | Use `getScrollContainer()` to detect and scroll the correct element |
| Context menu ignores user settings | background.js not reading all prefs | Ensure background.js reads ALL storage keys and passes to content script |
| Top of page captured twice | Site uses `scroll-behavior: smooth` | Use `behavior: 'instant'` in all `scrollTo()` calls |
| URL header missing with limit enabled | Canvas created at full page size (too large), then resized | Apply maxCaptures limit BEFORE creating canvas |

## Storage Keys
`chrome.storage.local`:
- `lastFormat`: "image" or "pdf"
- `hideStickyElements`: boolean (default: true)
- `showUrlHeader`: boolean (default: false)
- `scrollToTop`: boolean (default: true) — scroll to top before capturing
- `limitCapture`: boolean (default: false)
- `maxCaptures`: number (default: 3) — max viewport captures when limitCapture is true

## File Naming
Format: `fullpageshot_[PAGE_TITLE]_[TIMESTAMP].[ext]`
- Page title: Sanitized, max 50 chars
- Timestamp: ISO format with dashes

## Context Menu Structure
```
Full Page Shot (parent)
├── Save as Image
└── Save as PDF
```

## Performance
- Single viewport: ~1 second
- 14 viewports: ~12-13 seconds
- Formula: `(captures × 0.85s) + 2s overhead`

## Limitations
1. Dynamic/infinite scroll content may not capture completely
2. Shadow DOM elements might not be detected for sticky hiding
3. Canvas size limit: ~32,767px in any dimension
4. Cannot capture Chrome internal pages (chrome://)
5. Cannot capture cross-origin iframe content

## Code Patterns

**Async message passing (must return true for async response):**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  doAsyncWork().then(result => sendResponse(result));
  return true; // Keep channel open!
});
```

**Ensure content script is loaded:**
```javascript
try {
  await chrome.tabs.sendMessage(tabId, { action: 'ping' });
} catch {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['jspdf.min.js', 'jspdf-wrapper.js', 'content.js']
  });
}
```

## Testing Checklist
- [ ] Popup opens and displays correctly
- [ ] "Save as Image" captures full page
- [ ] "Save as PDF" creates PDF
- [ ] Context menu triggers work
- [ ] Long page captures completely (no duplicates at edges)
- [ ] Scroll position restored after capture
- [ ] Sticky toggle works (headers/footers hidden correctly)
- [ ] URL header toggle adds page URL above screenshot (beige-to-white gradient, truncated with "...")
- [ ] Limit capture toggle caps number of viewport captures (e.g., 3 screens max)
- [ ] Toggle states persist across sessions
- [ ] Test on both standard and high-DPI (Retina) displays
- [ ] Test on SPA sites (LinkedIn, Twitter) — should scroll and capture full content
- [ ] Test on sites with `scroll-behavior: smooth` (e.g., jobicy.com) — no duplicate content

## Development Commands
```bash
# Load extension
chrome://extensions/ → Enable "Developer mode" → "Load unpacked" → Select folder

# View errors
chrome://extensions/ → FullPageShot → "Errors"

# Debug consoles
Popup: Right-click popup → "Inspect"
Background: chrome://extensions/ → "Service Worker"
Content: F12 on page → Console

# Common fix: Reload extension + Reload page
```

## Browser Compatibility
- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Not compatible: Firefox, Safari

## Chrome Web Store Publishing

### MV3 "Remotely Hosted Code" Violations
Chrome Web Store rejects extensions containing references to external scripts. The bundled `jspdf.min.js` (v2.5.1) required these modifications before publishing:

**Removed from jspdf.min.js:**
1. `//# sourceMappingURL=jspdf.umd.min.js.map` - Source map reference (scanner flags missing .map files)
2. `https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js` - CDN URL in the `pdfobjectnewwindow` output feature

**Why these cause rejection:**
- `sourceMappingURL` is a directive browsers interpret as "fetch this file"
- The pdfobject CDN URL is actual remote code loading (for a feature this extension doesn't use)

**Commands to fix:**
```bash
# Remove sourceMappingURL
sed -i '' 's|//# sourceMappingURL=jspdf.umd.min.js.map||g' jspdf.min.js

# Remove CDN URL
sed -i '' 's|https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js||g' jspdf.min.js
```

**Safe to keep:** Attribution URLs in license comments (github.com, myersdaily.org) are not flagged.

**Extension only uses:** `pdf.save(filename)` - does not need `pdfobjectnewwindow` feature.

### Packaging for Chrome Web Store
```bash
# From the project root — excludes dev files (README, CLAUDE.md, store/, generate-icons.js)
zip -r ../FullPageShot-v1.2.0.zip manifest.json background.js content.js popup.html popup.css popup.js jspdf.min.js jspdf-wrapper.js icons/ LICENSE
```

