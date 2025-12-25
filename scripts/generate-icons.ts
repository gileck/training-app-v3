import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const ICON_SIZES = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

async function generateIcons() {
    console.log('🎨 Generating app icons from SVG...\n');

    // Ensure the icons directory exists
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    // Read the SVG file
    const svgBuffer = fs.readFileSync(SVG_PATH);

    // Generate icons at each size
    for (const size of ICON_SIZES) {
        const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
        
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        
        console.log(`✅ Generated: icon-${size}x${size}.png`);
    }

    // Generate apple-touch-icon (180x180)
    const appleTouchIconPath = path.join(ICONS_DIR, 'apple-touch-icon.png');
    await sharp(svgBuffer)
        .resize(180, 180)
        .png()
        .toFile(appleTouchIconPath);
    console.log('✅ Generated: apple-touch-icon.png');

    // Generate favicon
    const faviconPath = path.join(process.cwd(), 'public', 'favicon.ico');
    await sharp(svgBuffer)
        .resize(32, 32)
        .png()
        .toFile(faviconPath.replace('.ico', '.png'));
    console.log('✅ Generated: favicon.png');

    console.log('\n🎉 All icons generated successfully!');
}

generateIcons().catch(console.error);

