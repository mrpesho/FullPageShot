# FullPageShot - Chrome Extension

A powerful Chrome extension that captures full-page screenshots as images or PDFs with automatic scrolling support.

## Features

- **Popup Interface**: Click the extension icon to choose between image or PDF capture
- **Context Menu**: Right-click anywhere on a page and select "Full Page Shot" to capture
- **Full-Page Capture**: Automatically scrolls through the entire page and stitches screenshots together
- **Format Options**: Save as PNG image or PDF
- **Smart Filename**: Automatically generates filenames with page title and timestamp
- **Beautiful UI**: Modern, gradient-styled popup interface

## Installation

### Option 1: Install from Chrome Web Store (Coming Soon)
The extension will be available on the Chrome Web Store once published.

### Option 2: Install Locally (Developer Mode)

1. **Generate Icons First**:
   - Open `icons/generate-icons.html` in your Chrome browser
   - Click "Generate Icons" button
   - The icons (icon16.png, icon48.png, icon128.png) will be downloaded
   - Move these PNG files to the `icons/` folder

2. **Load the Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top right
   - Click "Load unpacked"
   - Select the `FullPageShot` folder containing the extension files

3. **Verify Installation**:
   - You should see the FullPageShot extension icon in your toolbar
   - Right-click on any webpage and verify "Snap the Site" appears in the context menu

## Usage

### Method 1: Using the Popup
1. Navigate to the webpage you want to capture
2. Click the FullPageShot extension icon in your toolbar
3. Choose either "Save as Image" or "Save as PDF"
4. The capture will begin automatically
5. Your file will be downloaded when ready

### Method 2: Using the Context Menu
1. Navigate to the webpage you want to capture
2. Right-click anywhere on the page
3. Hover over "Full Page Shot" in the context menu
4. Select either "Save as Image" or "Save as PDF"
5. The extension will scroll through the entire page and capture it
6. Your file will be downloaded when ready

## How It Works

### Image Capture (Full Page)
1. Calculates the total page dimensions (height and width)
2. Scrolls through the page viewport by viewport
3. Captures each section as a screenshot
4. Stitches all sections together on a canvas
5. Exports as a single PNG image
6. Restores original scroll position

### PDF Capture
1. Scrolls to the top of the page
2. Opens the browser's print dialog
3. User can save as PDF using the print-to-PDF feature

## File Structure

```
FullPageShot/
├── manifest.json          # Extension configuration
├── popup.html            # Popup interface HTML
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── background.js         # Service worker for context menu
├── content.js            # Content script for page capture
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── icon.svg          # Source SVG icon
│   └── generate-icons.html  # Icon generator tool
└── README.md             # This file
```

## Permissions

The extension requires the following permissions:

- **activeTab**: To capture the current tab's content
- **contextMenus**: To add right-click menu options
- **storage**: To remember user preferences (last used format)
- **downloads**: To save captured files to your computer

## Browser Compatibility

- Chrome 88 or later (Manifest V3 support)
- Microsoft Edge 88 or later
- Other Chromium-based browsers with Manifest V3 support

## Troubleshooting

### Icons Not Showing
- Make sure you've generated the PNG icons using `icons/generate-icons.html`
- Ensure the icon files are in the `icons/` folder
- Try reloading the extension from `chrome://extensions/`

### Context Menu Not Appearing
- Refresh the page after installing the extension
- Check that the extension is enabled in `chrome://extensions/`
- Try restarting Chrome

### Capture Not Working
- Some websites may have Content Security Policies that prevent capturing
- Make sure you've granted all required permissions
- Try refreshing the page and attempting the capture again

### PDF Download Issues
- PDF capture uses the browser's native print dialog
- Make sure "Save as PDF" is selected as the destination in the print dialog
- Some browsers may require additional print-to-PDF extensions

## Development

### Technologies Used
- **Manifest V3**: Latest Chrome extension manifest version
- **Vanilla JavaScript**: No external dependencies for core functionality
- **Canvas API**: For stitching screenshots together
- **Chrome Extensions API**: For tab capture, context menus, and downloads

### Future Enhancements
- Add support for HTML2Canvas library for better rendering
- Support for capturing specific page regions
- Custom capture dimensions
- Annotation tools before saving
- Cloud storage integration
- Batch capture multiple tabs

## Privacy

FullPageShot respects your privacy:
- No data is collected or transmitted
- All capture processing happens locally in your browser
- No external servers are contacted
- Your browsing history is never accessed
- Captured content stays on your device

## License

MIT License - Feel free to use, modify, and distribute this extension.

## Support

If you encounter any issues or have suggestions:
1. Check the Troubleshooting section above
2. Open an issue on GitHub (if repository is available)
3. Contact the developer

## Credits

Developed with attention to user experience and privacy.

---

**Version**: 1.0.0
**Last Updated**: 2025
