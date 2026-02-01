/**
 * Generate modern iOS-style blue gradient PWA icons
 * 
 * Run: npx tsx scripts/generate-icons.ts
 * 
 * Requires: npm install sharp --save-dev
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');

// iOS PWA icon sizes
const ICON_SIZES = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];

/**
 * Create an SVG with iOS-style blue gradient and a modern minimal design
 */
function createIconSvg(size: number): string {
  const cornerRadius = Math.round(size * 0.22);
  const centerX = size / 2;
  const centerY = size / 2;
  const circleRadius = size * 0.22;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0A84FF;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#007AFF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#5856D6;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="highlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.3);stop-opacity:1" />
      <stop offset="40%" style="stop-color:rgba(255,255,255,0.05);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:1" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:1" />
    </radialGradient>
  </defs>
  
  <!-- Background -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#bgGradient)"/>
  
  <!-- Highlight overlay -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#highlight)"/>
  
  <!-- Center design element - modern dot/orb -->
  <circle cx="${centerX}" cy="${centerY}" r="${circleRadius}" fill="rgba(255,255,255,0.95)"/>
  <circle cx="${centerX}" cy="${centerY - circleRadius * 0.2}" r="${circleRadius * 0.3}" fill="url(#bgGradient)" opacity="0.6"/>
</svg>`;
}

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log('🎨 Generating modern iOS-style blue gradient PWA icons...\n');

  for (const size of ICON_SIZES) {
    const svgContent = createIconSvg(size);
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    
    try {
      await sharp(Buffer.from(svgContent))
        .png({
          quality: 100,
          compressionLevel: 9,
        })
        .toFile(outputPath);
      
      console.log(`  ✅ Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`  ❌ Failed to generate icon-${size}x${size}.png:`, error);
    }
  }

  // Also generate apple-touch-icon.png (180x180 is the standard for iOS)
  const appleTouchIconPath = path.join(ICONS_DIR, 'apple-touch-icon.png');
  const svg180 = createIconSvg(180);
  
  try {
    await sharp(Buffer.from(svg180))
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(appleTouchIconPath);
    console.log(`  ✅ Generated apple-touch-icon.png (180x180)`);
  } catch (error) {
    console.error(`  ❌ Failed to generate apple-touch-icon.png:`, error);
  }

  // Generate favicon.ico alternative as PNG
  const faviconPath = path.join(process.cwd(), 'public', 'favicon-32x32.png');
  const svg32 = createIconSvg(32);
  
  try {
    await sharp(Buffer.from(svg32))
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(faviconPath);
    console.log(`  ✅ Generated favicon-32x32.png`);
  } catch (error) {
    console.error(`  ❌ Failed to generate favicon-32x32.png:`, error);
  }

  // Generate SVG version for reference
  const svgPath = path.join(ICONS_DIR, 'icon.svg');
  fs.writeFileSync(svgPath, createIconSvg(512));
  console.log(`  ✅ Generated icon.svg (512x512 source)`);

  console.log('\n✨ Icon generation complete!');
  console.log('\nGenerated files:');
  console.log('  • public/icons/icon-{size}x{size}.png (all sizes)');
  console.log('  • public/icons/apple-touch-icon.png');
  console.log('  • public/icons/icon.svg');
  console.log('  • public/favicon-32x32.png');
}

generateIcons().catch(console.error);
