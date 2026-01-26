# Product Design: Exercise Definition Overrides

**Size: L**

## Overview

This feature allows users to customize any aspect of an exercise's definition for each instance they add to their training plan. Currently, users can only customize workout parameters (sets, reps, weight) when adding exercises. With this feature, users will also be able to override the exercise's name, image, muscle groups, type, and other properties on a per-instance basis, giving them complete control over how each exercise appears and behaves in their plan.

This is particularly useful when:
- A user wants to add the same exercise twice but track different variations (e.g., "Incline Bench Press" and "Decline Bench Press" both derived from "Bench Press")
- A user disagrees with the default muscle classification or wants to emphasize different muscles
- A user wants to customize the exercise name or image for personal preference
- A user wants to create specialized variations without cluttering their exercise library

## UI/UX Design

### Entry Point

When viewing a plan exercise that has already been added to the plan, users will see a new option to customize the exercise definition.

**Exercise Card Enhancement:**
- Each plan exercise card now shows a small indicator (e.g., pencil icon or "Custom" badge) if it has definition overrides applied
- Tapping/clicking on the exercise card opens the edit dialog as it does today

### Edit Exercise Dialog - Enhanced

The existing "Edit Exercise" dialog will be expanded with a new section for definition overrides.

**Layout:**
- **Top Section:** Exercise header (image, name, primary muscle) - now editable
- **Configuration Section:** Existing controls for sets, reps, weight, notes
- **New Section:** "Customize Definition" expandable panel

**Customize Definition Panel:**
When the user taps "Customize Definition" (or a similar action), the dialog expands or switches to a new view that shows:

**Fields Available for Override:**
- **Exercise Name** - Text input
  - Placeholder shows original name in light text
  - When overridden, shows custom name
  - Clear/reset button appears when modified
  
- **Exercise Image** - Same image upload interface as creating custom exercises
  - Shows current image (either original or overridden)
  - Upload or paste new image
  - Remove button to clear override and revert to original
  
- **Primary Muscle** - Dropdown selector
  - Shows list of all available muscle groups
  - Currently selected value highlighted
  - Reset icon appears when changed from original
  
- **Secondary Muscles** - Multi-select chips/buttons
  - Display all available muscle groups as selectable chips
  - Selected muscles shown with filled/active state
  - Can select multiple
  - Shows which muscles are from original definition vs. overridden (subtle indicator)
  
- **Exercise Type** - Dropdown selector
  - Options: Strength, Cardio, Flexibility, Balance, Plyometric
  - Reset icon when changed from original
  
- **Bodyweight Exercise** - Toggle/checkbox
  - When enabled, weight tracking is disabled for this exercise
  - Shows original state with subtle indicator
  
- **Static/Timed Exercise** - Toggle/checkbox
  - When enabled, reps tracking switches to duration
  - Shows original state with subtle indicator

**Visual Indicators:**
- Each field shows whether it's using the original value or an override
  - Original values: Normal text, subtle "Default" badge or icon
  - Overridden values: Highlighted text, "Custom" badge or colored indicator
  - Clear indicator icon/button next to each overridden field

**Reset Functionality:**
- Individual field reset: Small "reset" icon button next to each overridden field
  - Tapping resets that specific field to the original value
  
- Reset all: "Reset to Defaults" button at the bottom of the override section
  - Shows confirmation: "Reset all customizations to the original exercise definition?"
  - Clears all overrides for this exercise instance
  - Only appears when at least one override is active

**Footer Actions:**
- "Cancel" - Discards all changes
- "Save" - Saves both configuration and definition overrides

### Visual Design Details

**Override Indicators:**
- Use a small colored dot or icon (e.g., blue dot, pencil icon) on the exercise card to show it has overrides
- In the dialog, use subtle background shading or border highlight for overridden fields
- Use consistent colors: original (neutral/gray), overridden (primary blue or accent color)

**Two-Step Approach Option:**
Since this dialog is becoming complex with both configuration and definition customization, consider a tab or section approach:

**Option A - Expandable Section (Recommended for simplicity):**
- Main view shows configuration (sets, reps, weight, notes)
- "Customize Definition" button/section at bottom
- Tapping expands inline to show override fields
- Scrollable dialog to accommodate all fields

**Option B - Tabbed Interface (For clearer separation):**
- Tab 1: "Workout Config" (sets, reps, weight, notes)
- Tab 2: "Exercise Details" (all definition fields)
- Active tab shows blue indicator
- Both tabs show "modified" indicator if changed

**Recommendation:** Use Option A (expandable section) as it's less navigation overhead for quick edits, but the panel is collapsed by default to avoid overwhelming users.

### Add Exercise Flow

When adding an exercise to the plan (from the "Add Exercise" dialog), users should also be able to customize the definition before adding.

**Enhanced Add Exercise Dialog:**
- After selecting an exercise from the library, user sees the configuration form (as today)
- Add an "Advanced Options" or "Customize Definition" collapsible section
- Users can optionally override definition fields before adding
- If no overrides are made, exercise is added with original definition (default behavior)

### Mobile Considerations

**Compact View:**
- Use collapsible/expandable sections to manage screen space
- Override section collapsed by default
- Use bottom sheets or full-screen dialog on mobile for the expanded view
- Stack fields vertically with clear spacing
- Make reset buttons touch-friendly (minimum 44×44pt tap target)

**Scrolling:**
- Dialog should scroll smoothly when override section is expanded
- Sticky header showing exercise name
- Sticky footer with Save/Cancel buttons

### Loading and Error States

**Loading:**
- Show skeleton loaders for muscle group list while loading
- Disable Save button while mutation is in progress
- Show "Saving..." text on button

**Errors:**
- If save fails, show error toast notification
- Keep dialog open with user's changes intact
- Allow user to retry or cancel

**Empty States:**
- If muscle groups fail to load, show "Unable to load muscle groups" with retry button
- Graceful fallback to allow manual text entry if needed

## Edge Cases

**Multiple Instances with Different Overrides:**
- User adds "Bench Press" twice to the same plan
- First instance: Overrides name to "Flat Bench Press", primary muscle to "Chest"
- Second instance: Overrides name to "Incline Bench Press", primary muscle to "Upper Chest"
- Both instances appear in the plan with their respective customizations
- Each maintains its own set of overrides independently
- No confusion between instances (each card shows its custom name)

**Original Exercise Definition Changes:**
- If the user (or system) updates the original exercise definition in the library, the overridden instances remain unchanged
- Overrides always take precedence
- User can optionally reset to see updated original values

**Deleting Original Exercise:**
- If the original exercise definition is deleted from the library (custom exercises only), plan exercises with overrides continue to work
- All overridden fields are preserved
- Any non-overridden fields retain their last known values from the original definition
- This is transparent to the user - their exercise continues to function

**Image Upload Limits:**
- Same 2MB limit as custom exercise creation
- Show error message if image too large
- Support paste from clipboard

**Partial Overrides:**
- User can override only specific fields
- Other fields automatically pull from original definition
- Clear visual distinction between overridden and original values
- System stores only the overridden fields, not the entire definition

**Reset Confirmation:**
- "Reset to Defaults" shows confirmation dialog
- Warns user if they have many overrides
- Lists what will be reset in the confirmation message
- Action is irreversible (can't undo after saving)

**Muscle Selection:**
- Primary muscle cannot be empty (required field)
- Secondary muscles can include multiple selections
- Primary muscle is automatically excluded from secondary muscle options
- Changes to primary muscle automatically remove it from secondary if it was selected

**Bodyweight + Weight Tracking:**
- If user overrides "isBodyweight" to true on an exercise that had weight configured, show warning
- Prompt: "This will disable weight tracking for this exercise. Continue?"
- Weight value is preserved but hidden in UI

**Static/Timed + Reps:**
- If user overrides "isStatic" to true, reps input switches to duration
- Existing reps value is preserved but hidden
- Switching back restores previous reps value