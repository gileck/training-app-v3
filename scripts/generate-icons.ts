import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const ICON_SIZES = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');
const SOURCE_PNG = path.join(ICONS_DIR, 'icon.png');
const SOURCE_SVG = path.join(ICONS_DIR, 'icon.svg');

async function generateIcons() {
    console.log('🎨 Generating app icons...\n');

    // Ensure the icons directory exists
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    // Determine source file (prefer PNG if exists, fallback to SVG)
    let sourceBuffer: Buffer;
    let sourceFile: string;
    
    if (fs.existsSync(SOURCE_PNG)) {
        sourceBuffer = fs.readFileSync(SOURCE_PNG);
        sourceFile = 'icon.png';
        console.log('📷 Using PNG source: icon.png\n');
    } else if (fs.existsSync(SOURCE_SVG)) {
        sourceBuffer = fs.readFileSync(SOURCE_SVG);
        sourceFile = 'icon.svg';
        console.log('🎨 Using SVG source: icon.svg\n');
    } else {
        console.error('❌ No source icon found! Please add icon.png or icon.svg to public/icons/');
        process.exit(1);
    }

    // Generate icons at each size
    for (const size of ICON_SIZES) {
        const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
        
        await sharp(sourceBuffer)
            .resize(size, size, { fit: 'cover' })
            .png()
            .toFile(outputPath);
        
        console.log(`✅ Generated: icon-${size}x${size}.png`);
    }

    // Generate apple-touch-icon (180x180)
    const appleTouchIconPath = path.join(ICONS_DIR, 'apple-touch-icon.png');
    await sharp(sourceBuffer)
        .resize(180, 180, { fit: 'cover' })
        .png()
        .toFile(appleTouchIconPath);
    console.log('✅ Generated: apple-touch-icon.png');

    // Generate favicon
    const faviconPath = path.join(process.cwd(), 'public', 'favicon.png');
    await sharp(sourceBuffer)
        .resize(32, 32, { fit: 'cover' })
        .png()
        .toFile(faviconPath);
    console.log('✅ Generated: favicon.png');

    console.log(`\n🎉 All icons generated successfully from ${sourceFile}!`);
}

generateIcons().catch(console.error);
