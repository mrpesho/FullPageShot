// Node.js script to generate simple PNG icons
// Run with: node generate-icons.js

const fs = require('fs');
const path = require('path');

// Simple PNG creator function - creates a minimal valid PNG
function createSimplePNG(size, r, g, b) {
  const width = size;
  const height = size;

  // Create RGBA pixel data (all pixels same color)
  const pixelData = [];
  for (let y = 0; y < height; y++) {
    pixelData.push(0); // Filter type
    for (let x = 0; x < width; x++) {
      pixelData.push(r, g, b, 255); // RGBA
    }
  }

  const pngData = Buffer.from(pixelData);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = createChunk('IHDR', Buffer.concat([
    Buffer.from([0, 0, 0, width]), // Width
    Buffer.from([0, 0, 0, height]), // Height
    Buffer.from([8]), // Bit depth
    Buffer.from([6]), // Color type (RGBA)
    Buffer.from([0, 0, 0]) // Compression, filter, interlace
  ]));

  // IDAT chunk (compressed data)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(pngData);
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = calculateCRC(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function calculateCRC(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Generate icons with purple gradient color
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const png = createSimplePNG(size, 102, 126, 234); // Purple color
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png`);
});

console.log('All icons generated successfully!');
