# Product Design: Add Welcome Toast on Home Page

**Size: S**

## Overview

Show a friendly welcome toast notification when a user first visits the home page. The toast provides a warm greeting to new visitors, enhancing the first-time user experience. The toast appears once per device and auto-dismisses after 3 seconds.

## UI/UX Design

### Toast Appearance

- **Type:** Info toast (blue accent, informational icon)
- **Message:** "Welcome! Explore the app to get started."
- **Position:** Bottom of screen, above the navigation bar (consistent with existing toast placement)
- **Duration:** 3 seconds, then fades out automatically
- **Dismissible:** User can tap the X button to dismiss early

### User Flow

1. User opens the app and lands on the home page for the first time on this device
2. Welcome toast slides in from the right with a subtle animation
3. Toast displays for 3 seconds
4. Toast automatically fades out
5. On subsequent visits to the home page, no toast appears

### Mobile Considerations

- Toast is positioned at the bottom of the screen in the thumb-friendly zone
- Full-width on mobile (~400px) with comfortable padding
- Touch target for dismiss button meets 44px minimum requirement
- Does not obstruct navigation or primary content

### Edge Cases

- **Returning users:** Toast only shows once per device (tracked in local storage)
- **Page refresh:** Toast does not re-appear if already shown during this session or previously
- **Logged in vs anonymous:** Toast shows for both logged-in and anonymous users on their first visit