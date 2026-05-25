---
description: Design and generate an iOS-optimized PWA app icon, regenerate all sizes, and wire it into the manifest
---

# Create App Icon

Design a new app icon that follows iOS Human Interface Guidelines, then regenerate every PWA size from a single SVG source.

The pipeline is already in place — there is an SVG generator at `scripts/template/generate-icons.ts` that uses `sharp` to render PNGs at every size required by `public/manifest.json` and `src/pages/_document.tsx`. This skill's job is to:

1. Design a concept that reads well at iOS scale
2. Replace the SVG body inside `createIconSvg(size)` so it scales parametrically
3. Run `yarn generate-icons` and verify

---

## Step 1: Understand the App

Before designing, answer:

- What does the app do? (Read `package.json` `name`/`description` and `public/manifest.json`.)
- What is the brand color? (Check `theme_color` in `public/manifest.json` and any theme tokens in `src/client/styles/` or `src/client/theme/`.)
- Is there an existing icon to evolve, or is this the first design?

If any of these are unclear, ask the user **once** before drawing.

---

## Step 2: Get Design Direction From the User

Ask the user (in a single question, with concrete options):

- **Concept**: a glyph (initial, monogram), a symbol (relevant icon), or an abstract shape (gradient + form)?
- **Palette**: brand colors, iOS system colors (e.g. `#0A84FF`, `#34C759`, `#FF9500`), or custom?
- **Style**: solid flat, single gradient, or gradient + subtle highlight (current default)?
- **Mood**: playful, professional, technical, minimal?

Don't proceed until the user has confirmed direction. A bad icon is worse than no icon.

---

## Step 3: Apply iOS App Icon Guidelines

Every design MUST follow these rules — they are non-negotiable for App Store / home-screen quality:

### Canvas & format
- **Master is 1024×1024**, sRGB. The script renders down from each size's SVG, so build the SVG to scale parametrically (sizes already passed in via `size` param).
- **Square. No rounded corners.** iOS applies its own corner radius (the squircle mask). Drawing your own rounding leaves it visibly inside iOS's mask.
- **No transparency / alpha** in the background. The icon must be a fully opaque rectangle. (You may use partial alpha for internal highlights/shadows, but the outer rect must cover all 4 corners with full opacity.)
- **PNG output, no metadata.** `sharp` already handles this.

### Composition
- **Safe zone**: keep the meaningful content inside the central **~80%** (i.e. ≥10% padding on every side). iOS, Android masks, and the home-screen badge all crop the edges.
- **Single focal point**. No collages, no stacked elements. The icon must read in **<200ms** at 60×60.
- **High contrast** between subject and background. Aim for ≥4.5:1 luminance ratio so it works on any wallpaper.
- **No fine detail**. Stroke widths must be ≥**2% of canvas** (≥20px at 1024). Anything thinner disappears at 60×60.
- **No text**, except a single short letter/monogram if it's part of the brand. Even one word is unreadable at 60×60.
- **No photographs**, no screenshots, no UI mockups inside the icon.

### Color
- Use **bold, saturated** colors. Pastels and near-neutrals get washed out by iOS's vibrancy filters.
- If using a gradient: 2–3 stops max, diagonal (top-left → bottom-right) reads most "iOS-native".
- A subtle top highlight (`rgba(255,255,255,0.15)` linear gradient, fading to transparent ~40% down) gives the iOS depth feel without looking dated.

### What to avoid
- ❌ Drop shadows on the outer edge (iOS adds its own)
- ❌ Inner glows that touch the edge
- ❌ Drawn rounded corners (let iOS mask)
- ❌ Transparent or partially-transparent background
- ❌ Multiple subjects, "scene" compositions
- ❌ Thin outlines, hairlines, 1px borders
- ❌ Small text or wordmarks
- ❌ Photographic textures, gradients with >3 stops, noise

---

## Step 4: Implement the SVG

Edit `createIconSvg(size: number)` in `scripts/template/generate-icons.ts`. Rules:

- Every coordinate, radius, stroke width must be derived from `size` (parametric). Never hardcode pixel values — the function is called for every output size.
- Keep the function pure: it returns an SVG string, no side effects.
- Use `viewBox="0 0 ${size} ${size}"` and absolute coordinates scaled by `size`.
- Background `<rect>` MUST be `width="${size}" height="${size}"` with **no** `rx`/`ry` (iOS adds the mask). The current template has a `cornerRadius` — **remove it** unless the user explicitly asks for visible rounded corners (e.g. for non-iOS contexts).
- Inline all gradients in a single `<defs>` block.

**Self-check before running:**
- Open the SVG mentally at 60×60 — is the focal element still recognizable?
- Is there ≥10% padding on every side of the focal element?
- Is the background rect fully opaque and edge-to-edge?
- Are stroke widths ≥`size * 0.02`?

---

## Step 5: Generate All Sizes

Run:

```bash
yarn generate-icons
```

This regenerates:

- `public/icons/icon-{72,96,128,144,152,167,180,192,384,512}x{...}.png`
- `public/icons/apple-touch-icon.png` (180×180)
- `public/icons/icon.svg` (512 source for reference)
- `public/favicon-32x32.png`

Verify:

```bash
ls -la public/icons/
file public/icons/icon-512x512.png   # should report 512x512, no alpha at the corners
```

---

## Step 6: Update Manifest Colors (If Needed)

If the new icon's background color differs meaningfully from the current `theme_color` / `background_color` in `public/manifest.json`, update both so the iOS PWA splash screen and status bar match the icon.

```json
{
  "background_color": "#<icon's dominant color>",
  "theme_color": "#<icon's dominant color>"
}
```

The existing `manifest.json` keeps `purpose: "any maskable"` on every icon — that's correct. Don't change it.

---

## Step 7: Verify on Device-like Surfaces

Quick visual checks you can run yourself:

- Open `public/icons/icon-180x180.png` (the apple-touch-icon size). Does it read clearly?
- Shrink it to ~60px in your image viewer. Still recognizable? If not, the design is too detailed.
- Open `public/icons/icon-72x72.png` directly. Is it legible? This is the smallest size shipped.

Then ask the user to add the PWA to their iOS home screen and confirm the icon looks right. If there's an existing install, they may need to remove and re-add it (iOS caches the icon).

---

## Step 8: Commit

```bash
git add scripts/template/generate-icons.ts public/icons public/favicon-32x32.png public/manifest.json
git commit -m "feat(icon): redesign app icon for <concept>"
```

Don't commit the SVG separately — `public/icons/icon.svg` is regenerated by the script and stays in sync with the source.

---

## Quick Checklist

- [ ] Design direction confirmed with user
- [ ] Background rect: full size, fully opaque, no rounded corners
- [ ] Focal element inside central 80% of canvas
- [ ] No strokes thinner than 2% of canvas
- [ ] No text (or single brand letter only)
- [ ] All coordinates parametric on `size`
- [ ] `yarn generate-icons` ran cleanly
- [ ] All `public/icons/*.png` regenerated
- [ ] `manifest.json` colors updated if dominant color changed
- [ ] Verified at 72×72 — still recognizable
