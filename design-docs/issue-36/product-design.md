# Product Design: Add SUCCESS Title Box to Home Page

**Size: S**

## Overview

This is a test feature to verify the agent workflow works end-to-end. The feature adds a prominent SUCCESS title box at the top of the home page to visually confirm the workflow completed successfully.

## UI/UX Design

### Layout (Mobile-First)

A large, visually prominent success box displayed at the very top of the home page content area, before any existing content.

**Visual Design:**
- Full-width box with rounded corners (rounded-2xl)
- Green gradient background using semantic success colors (bg-success/10 or bg-green-500/10)
- Green border (border-success or border-green-500)
- Large centered text reading "SUCCESS" in bold
- Padding for comfortable touch-friendly spacing (p-6)

**Typography:**
- "SUCCESS" text in large, bold font (text-2xl or text-3xl font-bold)
- Green text color using semantic tokens (text-success or text-green-600)
- Centered alignment

### User Experience

- The box appears immediately when the home page loads
- No user interaction required - purely visual confirmation
- Box is visible on all device sizes
- Does not interfere with existing home page functionality
- Positioned above the Week Navigator card

### Responsive Behavior

- Mobile (~400px): Full-width box with adequate padding, text remains readable
- Tablet/Desktop: Box maintains full-width within the content container, text may scale slightly larger