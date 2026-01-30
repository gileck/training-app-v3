# Technical Design: Add SUCCESS Title Box to Home Page

**Size: S** | **Complexity: Low**

## Overview

Add a visually prominent SUCCESS message box at the top of the home page (before the Week Navigator). This is a simple UI-only change that requires modifying a single component to display a full-width success box with green styling.

## Files to Modify

**Component file:**
- `src/client/routes/Home/Home.tsx`
  - Add a SUCCESS box component at the top of the main return statement (line 371, just after the opening `<div className="p-4 pb-20 space-y-4">`)
  - Use existing Card component from shadcn/ui
  - Apply success-themed styling using CSS variables

## Implementation Details

**Visual Design:**
- Full-width Card component with rounded corners (`rounded-2xl`)
- Green border using success color (`border-success` or inline style with `hsl(var(--success))`)
- Light green background using success color with opacity (`bg-success/10` or inline style)
- Large, centered, bold "SUCCESS" text using success color (`text-success`)
- Touch-friendly padding (`p-6`)

**Styling Approach:**
- Use semantic color tokens from the theme system (CSS variable `--success` defined at line 74 and 120 in `globals.css`)
- Follow the theming guidelines from `docs/theming.md` to ensure compatibility with all theme presets
- Match the visual style of existing Card components on the page (e.g., WeekNavigator card at line 373)

**Placement:**
- Insert immediately after the opening div of the main return statement (line 371)
- Position before the WeekNavigator component (line 373)
- Maintain the existing `space-y-4` spacing between components

## Implementation Plan

1. Open `src/client/routes/Home/Home.tsx` and locate the main return statement (line 370-481)
2. Add the SUCCESS box Card component after line 371 (just after `<div className="p-4 pb-20 space-y-4">`)
3. Create a Card with CardContent containing centered "SUCCESS" text
4. Apply green border, background, and text styling using success color variables
5. Use `rounded-2xl`, `p-6`, `text-3xl`, and `font-bold` classes to match the product design
6. Run `yarn checks` to verify the code passes linting
7. Test the UI in browser to verify the SUCCESS box appears correctly
