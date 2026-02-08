# FullPageShot

Chrome extension that captures full-page screenshots as PNG images or PDFs.

## Features

- **Full-page capture** — Automatically scrolls and stitches the entire page into one image
- **Save as PNG or PDF** — Choose your format
- **Smart sticky element handling** — Hides fixed headers/footers during capture to prevent duplicates
- **URL header option** — Add the page URL above the screenshot
- **SPA support** — Works on sites like LinkedIn that use custom scroll containers
- **High-DPI support** — Sharp captures on Retina displays
- **Context menu** — Right-click anywhere to capture

## Installation

### Chrome Web Store
Coming soon.

### Manual Installation (Developer Mode)

1. Clone or download this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select this folder
5. The extension icon should appear in your toolbar

## Usage

**Via popup:** Click the extension icon → Choose "Save as Image" or "Save as PDF"

**Via context menu:** Right-click on any page → Full Page Shot → Choose format

### Options

- **Hide sticky menus** (on by default) — Removes fixed headers/footers from appearing multiple times in the capture
- **Show URL header** — Adds a bar with the page URL above the screenshot

## Permissions

- `activeTab` — Capture the current tab
- `contextMenus` — Right-click menu
- `storage` — Save preferences
- `scripting` — Inject capture script
- `<all_urls>` — Required for screenshot API to work on any site

## File Structure

```
FullPageShot/
├── manifest.json
├── popup.html / popup.css / popup.js
├── background.js
├── content.js
├── jspdf.min.js / jspdf-wrapper.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── CLAUDE.md (dev notes)
```

## Browser Compatibility

- Chrome 88+
- Edge 88+
- Other Chromium-based browsers with Manifest V3 support

## Privacy

All processing happens locally. No data is collected or sent anywhere.

## License

BSD-3-Clause
