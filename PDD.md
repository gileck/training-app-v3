# Product Definition Document (PDD)
## Training App

---

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [User Authentication](#2-user-authentication)
3. [Training Plans Management](#3-training-plans-management)
4. [Exercise Definitions Library](#4-exercise-definitions-library)
5. [Exercise Management](#5-exercise-management)
6. [Exercise Details](#6-exercise-details)
7. [Workout View](#7-workout-view)
8. [Active Workout Session](#8-active-workout-session)
9. [Saved Workouts](#9-saved-workouts)
10. [Progress View & Activity Tracking](#10-progress-view--activity-tracking)
11. [Weekly Progress Tracking](#11-weekly-progress-tracking)
12. [General UX Guidelines](#12-general-ux-guidelines)

---

## Glossary

| Term | Definition |
|------|------------|
| **Exercise Definition** | A template/master record for an exercise type (e.g., "Bench Press"). Contains name, image, target muscles. Can be system-provided (pre-populated) or user-created (custom). |
| **Custom Exercise** | An exercise definition created by a user with their own name, image, and muscle targets. Private to the user. |
| **Exercise (Instance)** | A specific exercise added to a training plan with user-configured sets, reps, weight, and comments. References an Exercise Definition. |
| **Training Plan** | A multi-week workout program containing exercises. Users create and manage these. |
| **Saved Workout** | A reusable template containing a selection of exercises from a plan. Used for quick-start workouts. |
| **Active Workout Session** | A temporary in-progress workout state where user is actively completing exercises. |
| **Weekly Progress** | Tracking data for exercise completion within a specific week of a plan. |

---

## 1. Product Overview

### 1.1 Development Phases

> **The app will be built in two phases. Phase 1 delivers a working MVP as quickly as possible. Phase 2 adds advanced features.**

#### Phase 1 - MVP (Minimum Viable Product)
Focus: Core functionality, simple implementation, online-only

| Area | Included |
|------|----------|
| **Authentication** | Login, Register, Logout |
| **Training Plans** | Create, Delete, View, Set Active |
| **Exercise Library** | System exercises only (read-only, simple list) |
| **Exercise Management** | Add, Edit (sets/reps/weight), Delete |
| **Workout View** | View exercises, Week navigation, Complete sets inline |
| **Progress** | Weekly progress bar and counter |
| **Connectivity** | Online only |

#### Phase 2 - Full Features
Focus: Advanced features, enhanced UX, offline support

| Area | Added Features |
|------|----------------|
| **Authentication** | Profile view/edit |
| **Training Plans** | Duplicate plan, Edit duration |
| **Exercise Library** | Custom exercises, Image upload |
| **Exercise Management** | Search/filter, Reorder, "Already in plan" badge |
| **Exercise Details** | History, Weekly notes |
| **Workout View** | Selection mode, Show/hide completed, Tabs |
| **Active Workout** | Large cards, +/- buttons, Session persistence |
| **Rest Timer** | Full timer with presets and alerts |
| **Saved Workouts** | Full CRUD, Start workout |
| **Progress View** | Activity log, Charts, Date filtering |
| **Connectivity** | Full offline support with sync |

---

### 1.2 Purpose
A mobile-first training application designed to help users manage and track their workout plans and progress. The app provides an intuitive interface for creating training programs, executing workouts, and monitoring fitness progress over time.

### 1.3 Target Users
- Fitness enthusiasts who want to track their training
- Gym-goers who follow structured workout programs
- Users who want to organize exercises into weekly training plans

### 1.4 Core Value Proposition
- Organize training into multi-week plans
- Track workout progress week-by-week
- Save and reuse favorite workout routines
- View historical activity and progress

---

## 2. User Authentication

> **Phase 1**: Login, Register, Logout | **Phase 2**: Profile editing

### 2.1 Overview
Basic authentication to secure user data and associate training plans with individual accounts.

### 2.2 Features

#### 2.2.1 User Registration
- **Requirement**: Users can create a new account
- **Inputs**: Username, Password, Confirm Password
- **Validation**: 
  - Username required (minimum length)
  - Password required (minimum length)
  - Passwords must match

#### 2.2.2 User Login
- **Requirement**: Users can log into their existing account
- **Inputs**: Username, Password
- **Behavior**: Redirect to main app on success, show error on failure

#### 2.2.3 User Logout
- **Requirement**: Users can log out of the application
- **Behavior**: Clear session, redirect to login screen

#### 2.2.4 Profile View *(Phase 2)*
- **Requirement**: Users can view their profile information
- **Display**: Username, Member since date
- **Edit**: Username can be updated

### 2.3 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| Register | Fill form, tap "Register" | Account created, auto-login |
| Login | Fill form, tap "Sign In" | Navigate to main app |
| Logout | Tap logout in menu | Return to login screen |
| Edit Profile | Tap edit icon, modify, save | Profile updated |

### 2.4 UX/Design
- **Layout**: Centered card on mobile, form fields stacked vertically
- **Toggle**: Link to switch between Login/Register modes
- **Feedback**: Inline validation errors, loading spinner during submission
- **Protected Routes**: Unauthenticated users redirected to login

---

## 3. Training Plans Management

> **Phase 1**: Create, Delete, View, Set Active | **Phase 2**: Duplicate, Edit duration

### 3.1 Overview
Central hub for managing all training plans. Users can create, organize, and manage their workout programs.

### 3.2 Features

#### 3.2.1 View Training Plans List
- **Requirement**: Display all training plans created by the user
- **Display per plan**:
  - Plan name
  - Duration (weeks)
  - Active status indicator (star badge)
  - Created date
- **Empty State**: Prompt to create first plan when no plans exist

#### 3.2.2 Create Training Plan
- **Requirement**: Users can create a new training plan
- **Inputs**:
  - Plan name (required)
  - Duration in weeks (required, number, minimum 1, no maximum limit)
- **Behavior**: Opens dialog/modal for input

#### 3.2.3 Delete Training Plan
- **Requirement**: Users can delete a training plan
- **Behavior**: Confirmation dialog before deletion
- **Warning**: "This action cannot be undone"
- **Cascade**: Deleting a plan also removes:
  - All exercises in the plan
  - All weekly progress data for the plan
  - All saved workouts associated with the plan

#### 3.2.4 Duplicate Training Plan *(Phase 2)*
- **Requirement**: Users can duplicate an existing plan
- **Behavior**: Creates copy with "(Copy)" suffix in name
- **Includes**: All exercises from original plan
- **Does NOT include**: Progress data (starts fresh)

#### 3.2.5 Set Active Training Plan
- **Requirement**: Users can designate one plan as "active"
- **Constraint**: Only one plan can be active at a time
- **Visual**: Active plan shows star badge/indicator
- **Purpose**: Active plan is the default shown in Workout View

#### 3.2.6 Edit Plan Duration *(Phase 2)*
- **Requirement**: Users can modify the number of weeks in a plan
- **Behavior**:
  - Increasing weeks: No data loss, new weeks start empty
  - Decreasing weeks: Warning that progress data for removed weeks will be lost
- **Confirmation**: Required when reducing weeks

#### 3.2.7 Navigate to Manage Plan
- **Requirement**: Users can access exercise/workout management for a plan
- **Action**: Tap on plan card or management icon

### 3.3 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| View Plans | Navigate to Training Plans page | See list of all plans |
| Create Plan | Tap "Add Plan" button | Dialog opens for input |
| Delete Plan | Tap delete icon on plan card | Confirmation dialog appears |
| Duplicate | Tap duplicate icon | New plan created instantly |
| Set Active | Tap star icon on inactive plan | Plan becomes active, previous deactivated |
| Manage | Tap plan card or list icon | Navigate to plan management page |

### 3.4 UX/Design
- **Layout**: 
  - Mobile: Vertical card list, full-width cards
  - Cards show plan info with action icons at bottom
- **Header**: Page title "Training Plans" with "Add Plan" button
- **Plan Card**:
  - Plan name (prominent)
  - Duration badge (e.g., "8 Weeks")
  - Active badge (if active)
  - Created date (subtle)
  - Action icons row: Set Active, Manage, Duplicate, Delete
- **Add Dialog**: Modal with form fields, Cancel/Save buttons
- **Delete Dialog**: Warning message listing what will be deleted, Cancel/Delete buttons (Delete in red)

---

## 4. Exercise Definitions Library

> **Phase 1**: System exercises only (read-only) | **Phase 2**: Custom exercises with image upload

### 4.1 Overview
A database of exercise types that users select from when adding exercises to their training plans. Contains both pre-populated system exercises and user-created custom exercises.

### 4.2 Data Structure

Each exercise definition contains:
- **Name**: Exercise name (e.g., "Bench Press", "Squats", "Pull-ups")
- **Image**: Visual representation of the exercise
- **Primary Muscle**: Main muscle targeted (e.g., "Chest", "Quadriceps")
- **Secondary Muscles**: Additional muscles worked (array)
- **Type**: Exercise category (e.g., "Strength", "Cardio")
- **Bodyweight Flag**: Whether it's a bodyweight exercise
- **Weight Unit**: Kilograms (KG) - standard across the app

### 4.3 Exercise Types

#### 4.3.1 System Exercises (Pre-populated)
- **Source**: Pre-loaded and hosted (CDN/server)
- **Images**: Professional, consistent images
- **Availability**: Shared across all users
- **Editable**: No - read-only for users

#### 4.3.2 Custom Exercises (User-created) *(Phase 2)*
- **Source**: Created by individual users
- **Images**: User-uploaded images
- **Availability**: Private to the user who created them
- **Editable**: Yes - user can edit/delete their own custom exercises

### 4.4 Library Contents

#### Pre-populated Exercises
The library is pre-populated with common exercises covering:
- **Upper Body**: Push-ups, Bench Press, Shoulder Press, Rows, Pull-ups, etc.
- **Lower Body**: Squats, Lunges, Deadlifts, Leg Press, etc.
- **Core**: Planks, Crunches, Russian Twists, etc.
- **Cardio**: Running, Cycling, Jump Rope, etc.

### 4.5 Custom Exercise Creation *(Phase 2)*

#### 4.5.1 Create Custom Exercise
- **Requirement**: Users can create their own exercise definitions
- **Inputs**:
  - Exercise name (required)
  - Image upload (optional)
  - Primary muscle (required)
  - Secondary muscles (optional)
  - Type/category (required)
  - Bodyweight flag (optional)
- **Image Upload** (optional):
  - Source options: Camera or Photo Gallery
  - Supported formats: JPG, PNG
  - Max file size: TBD
  - Cropping/preview before save
  - Images stored and synced with offline support
  - **Default**: Placeholder image shown if no image uploaded

#### 4.5.2 Edit Custom Exercise
- **Requirement**: Users can modify their custom exercises
- **Editable**: All fields including image
- **Impact**: Changes reflect immediately in all plans using this exercise
- **Live Data**: Exercise instances reference definitions - not snapshots. Definition data is pulled fresh when rendering.

#### 4.5.3 Delete Custom Exercise
- **Requirement**: Users can delete their custom exercises
- **Constraint**: Cannot delete if exercise is used in any plan
- **UX**: Delete button is disabled with tooltip explaining "Remove from all plans first"
- **Flow**: User must remove exercise from all plans first, then delete button becomes enabled

### 4.6 Relationship to User Data
- **System Definitions**: Read-only, shared across all users
- **Custom Definitions**: Owned by user, private, editable
- Users create **Exercise Instances** that reference definitions
- Both system and custom exercises appear in the library browser

---

## 5. Exercise Management

> **Phase 1**: Add, Edit, Delete exercises (simple list) | **Phase 2**: Search/filter, Reorder, "Already in plan" badge

### 5.1 Overview
Manage exercises within a specific training plan. Add exercises from the library, configure sets/reps, and organize the workout routine.

### 5.2 Features

#### 5.2.1 View Plan Exercises
- **Requirement**: Display all exercises in the training plan
- **Display per exercise**:
  - Exercise name (from definition)
  - Exercise image (from definition)
  - Sets × Reps configuration (user-defined)
  - Target muscle groups (from definition)
- **Ordering**: Exercises displayed in user-defined order
- **Empty State**: Prompt to add first exercise

#### 5.2.2 Add Exercise to Plan
- **Requirement**: Add exercises from the exercise definitions library
- **Flow**:
  1. Tap "Add Exercise" button
  2. Browse exercise library (see 5.2.2.1)
  3. Select exercise definition
  4. Configure: sets, reps, weight (optional), comments (optional)
  5. Save to plan
- **Result**: New exercise instance created referencing the definition
- **Duplicate Allowed**: Same exercise definition can be added multiple times (e.g., "Bench Press" for different days with different sets/reps/weight). Each is a separate instance with unique ID.

##### 5.2.2.1 Exercise Library Browser
- **Phase 1**: Simple scrollable list of exercises with image and name
- **Phase 2 additions**:
  - Search: Text search by exercise name
  - Filter by Muscle Group: Filter exercises by primary muscle target
  - Filter by Type: Filter by exercise type (Strength, Cardio, etc.)
  - Filter by Source: Show All / System Only / My Custom Only
  - Already Added Indicator: Visual badge/styling on exercises already in plan
  - Create Custom: "Create Custom Exercise" button (see Section 4.5)

#### 5.2.3 Edit Exercise in Plan
- **Requirement**: Modify exercise configuration
- **Editable Fields**:
  - Sets (number, required)
  - Reps (number, required)
  - Weight (number in KG, optional - null for bodyweight exercises)
  - Duration in seconds (number, optional - for timed exercises)
  - Comments/instructions (text, optional - user notes)
- **NOT Editable**: Exercise name, image, muscles (from definition)
- **Note**: All numeric fields use number inputs (no free text for sets/reps/weight)

#### 5.2.4 Delete Exercise from Plan
- **Requirement**: Remove exercise from the plan
- **Behavior**: Confirmation dialog before removal
- **Cascade**: Also removes:
  - Weekly progress for this exercise
  - This exercise from any saved workouts in the plan

#### 5.2.5 Reorder Exercises *(Phase 2)*
- **Requirement**: Change the display order of exercises in the plan
- **Interaction**: Up/Down arrow buttons on each exercise card
- **Persistence**: Order saved and maintained across sessions

### 5.3 Sub-Features

#### Tabs Navigation
- **Exercises Tab**: Manage exercises in plan (this section)
- **Workouts Tab**: Manage saved workouts for this plan (see Section 9)

### 5.4 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| View Exercises | Open plan management | See exercise list |
| Add Exercise | Tap "Add" → Browse library → Select → Configure | Exercise added to plan |
| Search Library | Type in search field | Library filters by name |
| Filter by Muscle | Select muscle group filter | Library shows matching exercises |
| Create Custom | Tap "Create Custom" → Fill form → Upload image → Save | Custom exercise created |
| Edit Exercise | Tap exercise card → Edit icon | Edit dialog opens |
| Delete Exercise | Tap delete icon on exercise | Confirmation, then removed |
| Reorder | Tap up/down arrows on exercise card | Order updated |
| Switch Tabs | Tap Exercises/Workouts tab | View switches |

### 5.5 UX/Design
- **Layout**:
  - Mobile: Full-width exercise cards in vertical list
  - Tab bar at top (Exercises | Workouts)
- **Page Header**: Plan name, back navigation
- **Exercise Card**:
  - Thumbnail image (left)
  - Exercise name (prominent)
  - Sets × Reps below name
  - Muscle group chips
  - Action icons: Up arrow, Down arrow, Edit, Delete
- **Add Exercise Flow**:
  - Step 1: Library browser
    - Search bar at top
    - Filter chips/dropdown below search (Muscle, Type, Source)
    - "Create Custom Exercise" button (prominent)
    - Grid of exercise cards with images
    - "Already in plan" badge where applicable
    - Custom exercises show "Custom" badge
  - Step 2: Configuration form in dialog (sets, reps, weight, comments)
- **Create Custom Exercise Dialog**:
  - Exercise name field
  - Image upload with preview
  - Primary muscle dropdown
  - Secondary muscles multi-select
  - Type dropdown
  - Bodyweight toggle
- **Edit Dialog**: Form with current values pre-filled

---

## 6. Exercise Details

> **Phase 1**: Basic info display (image, name, sets/reps) | **Phase 2**: History, Weekly notes

### 6.1 Overview
Detailed view of a specific exercise showing all information, history, and notes. Accessible from various places in the app.

### 6.2 Features

#### 6.2.1 Exercise Information Display
- **Requirement**: Show comprehensive exercise details
- **From Definition** (read-only display):
  - Large exercise image
  - Exercise name
  - Exercise type
  - Primary muscle target
  - Secondary muscles
  - Bodyweight indicator
- **From Exercise Instance** (user-configured):
  - Sets, Reps, Weight configuration
  - Instructions/comments

#### 6.2.2 Exercise History *(Phase 2)*
- **Requirement**: Show historical completion data for this exercise
- **Display**: Table with columns:
  - Date
  - Sets completed
  - Reps (if tracked)
  - Weight used (if tracked)
- **Data Source**: From activity logs
- **Scope**: History for this specific exercise instance

#### 6.2.3 Weekly Notes *(Phase 2)*
- **Requirement**: Users can add notes specific to this exercise for the current week
- **Use Case**: Record observations like "Reduced weight due to shoulder pain"
- **Features**:
  - Add new note
  - Edit existing note
  - Delete note
- **Display**: Note text with timestamp
- **Scope**: Notes are per exercise, per week

### 6.3 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| Open Details | Tap exercise card (in workout view) | Modal opens |
| View History | Scroll to history section | See past activity |
| Add Note | Tap "Add Note" → Enter text → Save | Note saved |
| Edit Note | Tap edit icon on note → Modify → Save | Note updated |
| Delete Note | Tap delete icon on note | Note removed |
| Close | Tap close button or outside modal | Modal closes |

### 6.4 UX/Design
- **Layout**: Full-screen modal/dialog
- **Sections** (scrollable):
  1. **Header**: Exercise name, close button
  2. **Image & Details**: Image with details card beside/below
  3. **Instructions**: If comments exist, displayed in card
  4. **History**: Table in collapsible section
  5. **Weekly Notes**: List of notes with add button
- **Notes Card**:
  - Date displayed
  - Note text
  - Edit/Delete icons on each note
- **Add Note**: Inline text field that expands, Save/Cancel buttons

---

## 7. Workout View

> **Phase 1**: View exercises, Week navigation, Complete sets inline, Progress bar | **Phase 2**: Selection mode, Show/hide completed, Tabs

### 7.1 Overview
The main training interface where users execute their workouts. Shows the active plan's exercises for the current week with progress tracking.

### 7.2 Features

#### 7.2.1 Active Plan Display
- **Requirement**: Show the currently active training plan
- **Display**: Plan name prominently at top
- **No Active Plan**: Message prompting to select a plan, with navigation button

#### 7.2.2 Week Navigation
- **Requirement**: Navigate between weeks of the training plan
- **Display**: "Week X / Y" (e.g., "Week 3 / 12")
- **Controls**: Left/right arrows to change week
- **Bounds**: Cannot go below Week 1 or above plan duration
- **Initial Week**: Last viewed week is persisted and shown on app open
- **No Auto-Calculation**: There is no "plan start date" - weeks are manually navigated
- **New Week Behavior**: Navigating to a week with no progress creates fresh tracking data

#### 7.2.3 Weekly Progress Indicator
- **Requirement**: Show completion progress for current week
- **Display**:
  - Progress bar (percentage complete)
  - Sets counter: "X / Y sets completed"
  - Percentage: "X% complete"

#### 7.2.4 Exercise List
- **Requirement**: Show all exercises for the current week
- **Sections**:
  - Active exercises (not fully completed)
  - Completed exercises (all sets done)
- **Per Exercise Display**:
  - Exercise image
  - Exercise name
  - Sets completed / Total sets
  - Completion indicators (checkmarks per set)

#### 7.2.5 Set Completion Toggle
- **Requirement**: Mark individual sets as complete/incomplete
- **Interaction**: Tap on set indicator to toggle
- **Visual**: Filled vs empty circle/checkbox
- **Behavior**: Updates progress counts in real-time
- **Limit**: Cannot exceed defined sets (e.g., if exercise has 4 sets, max completion is 4)

#### 7.2.6 Show/Hide Completed Exercises *(Phase 2)*
- **Requirement**: Toggle visibility of fully completed exercises
- **Default**: Completed exercises hidden or collapsed
- **Control**: "Show completed" toggle/button

#### 7.2.7 Exercise Selection Mode *(Phase 2)*
- **Requirement**: Select multiple exercises to start an ad-hoc workout
- **Activation**: Simply tap/click on exercise card to select/deselect
- **Visual**: Selected exercises show checkbox/highlight state
- **Action**: "Start Workout" button appears when exercises selected
- **Multi-select**: Users can tap multiple exercises to build workout selection

### 7.3 Sub-Features *(Phase 2)*

#### Tabs *(Phase 2)*
- **Exercises Tab**: View exercises for current week (default)
- **Workouts Tab**: View saved workouts for quick-start (see 7.3.1)
- **Active Workout Tab**: Shows current workout session (enabled when session active)

*Note: Phase 1 has single view showing exercises only - no tabs.*

##### 7.3.1 Workouts Tab in Workout View *(Phase 2)*
- **Purpose**: Quick access to start saved workouts
- **Display**: List of saved workouts for the current plan
- **Actions**: 
  - Tap to expand and see exercises
  - Start button to launch workout
- **Relationship**: Shows workouts saved for the currently active plan only

### 7.4 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| Navigate Week | Tap left/right arrows | Week changes, exercises update |
| Complete Set | Tap set indicator | Set marked complete, progress updates |
| Undo Set | Tap completed set | Set marked incomplete |
| View Details | Tap exercise info area | Exercise details modal opens |
| Select Exercise | Tap exercise card | Exercise selected/deselected for workout |
| Start Workout | Select exercises → Tap "Start Workout" | Active workout begins |
| Toggle Completed | Tap "Show/Hide completed" | Completed section visibility toggles |

### 7.5 UX/Design
- **Layout**: Mobile-optimized single column
- **Header Section**:
  - Plan name (tappable to manage)
  - "Manage" button to go to plan management
- **Week Header**:
  - Week indicator centered: "Week 3 / 12"
  - Left/right navigation arrows
  - Progress bar below
  - Sets counter
- **Tab Bar**: Exercises | Workouts | Active Workout (when active)
- **Exercise Card**:
  - Image thumbnail (left)
  - Exercise name
  - Sets progress: "2 / 4 sets"
  - Set indicators: ● ● ○ ○ (filled = completed)
  - Tap card → Select/deselect for workout
  - Tap set indicator → Toggle set completion
  - Info icon/area → Open details modal
  - Selected state: Highlight/checkbox visible
- **Selection Bar** (when selecting):
  - Fixed at bottom
  - Shows count: "3 exercises selected"
  - "Start Workout" button
- **Completed Section**:
  - Collapsible with header: "Completed (5)"
  - Cards shown with all sets filled

---

## 8. Active Workout Session *(Phase 2)*

> **Phase 1**: Users complete sets directly from Workout View (inline) | **Phase 2**: Full dedicated workout mode

### 8.1 Overview
Dedicated workout execution mode. When a workout is started, users enter a focused interface for completing their exercises with workout-specific tools.

*Note: This entire section is Phase 2. In Phase 1, users complete sets using the set indicators directly in the Workout View.*

### 8.2 Features

#### 8.2.1 Start Workout
- **Trigger Methods**:
  - Select exercises in Workout View → Start
  - Launch saved workout from Workouts tab
- **Behavior**: Switches to Active Workout tab automatically

#### 8.2.2 Workout Exercise Display
- **Requirement**: Show exercises in large, easy-to-use cards
- **Display per exercise**:
  - Large exercise image
  - Exercise name (prominent)
  - Sets completed / Total sets
  - Large +/- buttons for set tracking
  - Remove from session option

#### 8.2.3 Set Increment/Decrement
- **Requirement**: Easy one-tap set completion during workout
- **Controls**:
  - Large "+" button to add completed set (disabled when max reached)
  - Large "-" button to undo set (disabled when at 0)
- **Visual**: Counter updates immediately
- **Limit**: Cannot exceed defined sets - "+" button disabled at max

#### 8.2.4 Rest Timer
- **Requirement**: Timer for rest periods between sets
- **Features**:
  - Configurable rest duration (30s, 60s, 90s, 120s, custom)
  - Auto-start toggle (OFF by default) - available in active workout view
  - Manual start/stop/reset
  - Visual countdown display
  - Audio/vibration alert when timer ends
- **Default Duration**: 60 seconds
- **Configuration**: Per-session in active workout view (not global setting)
- **Display**: Large, visible countdown numbers
- **Quick Presets**: Common rest durations as quick-tap buttons

#### 8.2.5 Remove Exercise from Session
- **Requirement**: Remove exercise from current workout session
- **Use Case**: Skip exercise, not feeling it today
- **Behavior**: Exercise removed from active list only (not from plan)

#### 8.2.6 Save Active Session as Workout
- **Requirement**: Save current selection as a reusable saved workout
- **Flow**:
  1. Tap "Save as Workout"
  2. Enter workout name
  3. Save
- **Result**: New saved workout created with current exercises
- **Association**: Saved to the current active plan

#### 8.2.7 End Workout
- **Requirement**: Complete the workout session
- **Behavior**: 
  - Clears active session
  - Returns to Exercises tab
  - Progress already saved during session

#### 8.2.8 Session Persistence
- **Requirement**: Workout session survives app close/crash
- **Behavior**: 
  - Active session is persisted locally
  - On app reopen, user returns to active workout automatically
  - All set progress is preserved
  - User can continue or end the workout

### 8.3 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| Complete Set | Tap "+" button | Set count increases, optional timer starts |
| Undo Set | Tap "-" button | Set count decreases |
| Start Timer | Tap timer or auto-start | Countdown begins |
| Stop Timer | Tap timer | Countdown pauses |
| Reset Timer | Tap reset | Timer returns to set duration |
| Change Rest Duration | Tap preset or set custom | Timer duration updates |
| Remove Exercise | Tap remove/X icon | Exercise removed from session |
| Save Workout | Tap "Save" → Enter name → Confirm | Saved workout created |
| End Workout | Tap "End Workout" | Session ends, return to exercises |

### 8.4 UX/Design
- **Layout**: Large touch targets optimized for gym use
- **Header**: Workout name (or "Ad-hoc Workout")
- **Rest Timer Section**:
  - Large countdown display (centered)
  - Start/Pause/Reset buttons
  - Preset buttons: 30s | 60s | 90s | 120s | Custom
  - Visual progress ring around timer
- **Exercise Cards** (large format):
  - Full-width cards
  - Large image at top
  - Exercise name below
  - Set counter: Large "3 / 4" display
  - Progress bar
  - Large circular buttons: [-] [+]
  - Small "Remove" text/icon in corner
- **Bottom Actions**:
  - "Save as Workout" button (secondary)
  - "End Workout" button (primary)
- **Touch Targets**: All buttons minimum 48x48px for easy gym use
- **Timer Alert**: Full-screen flash or overlay when timer ends

---

## 9. Saved Workouts *(Phase 2)*

> **Phase 1**: Not included | **Phase 2**: Full saved workouts feature

### 9.1 Overview
Pre-defined workout templates that users can create and reuse. Quick way to start a workout without manual exercise selection.

*Note: This entire section is Phase 2. In Phase 1, users work directly with the week's exercises.*

### 9.2 Important: Plan Association

> **Saved workouts are tied to a specific training plan.**

- Each saved workout belongs to one training plan
- Saved workouts reference exercises from their parent plan
- **If a plan is deleted**: All saved workouts for that plan are also deleted
- **If an exercise is removed from plan**: It's also removed from saved workouts
- Users can only use saved workouts from the currently active plan in Workout View

### 9.3 Features

#### 9.3.1 View Saved Workouts List
- **Requirement**: Display all saved workouts for a plan
- **Display per workout**:
  - Workout name
  - Exercise count
  - Exercise names preview
- **Empty State**: Prompt to create first workout
- **Context**: Shown within plan management (Workouts tab) or Workout View

#### 9.3.2 Search/Filter Workouts
- **Requirement**: Find workouts by name
- **Control**: Search input field
- **Behavior**: Filter list as user types

#### 9.3.3 Create New Workout
- **Requirement**: Create a new saved workout
- **Methods**:
  1. From scratch: Create empty → Add exercises
  2. From active session: Save current workout selection
- **Inputs**:
  - Workout name (required)
- **Association**: Automatically linked to current plan

#### 9.3.4 Edit Workout Name
- **Requirement**: Rename an existing workout
- **Flow**: Tap edit icon → Dialog with name input → Save

#### 9.3.5 Delete Workout
- **Requirement**: Remove a saved workout
- **Behavior**: Confirmation dialog before deletion
- **Note**: Does not affect exercises in the plan

#### 9.3.6 Duplicate Workout
- **Requirement**: Create a copy of a workout
- **Behavior**: New workout with "(Copy)" suffix
- **Same Plan**: Copy belongs to same plan as original

#### 9.3.7 View Workout Details
- **Requirement**: See all exercises in a saved workout
- **Display**: List of exercises with their configurations
- **Actions available**: Add/Remove exercises

#### 9.3.8 Add Exercise to Workout
- **Requirement**: Add exercises from the plan to saved workout
- **Source**: Only exercises already in the parent plan
- **Flow**: Browse plan exercises → Select → Add

#### 9.3.9 Remove Exercise from Workout
- **Requirement**: Remove exercise from saved workout
- **Behavior**: Removes from template only (not from plan)

#### 9.3.10 Reorder Exercises in Workout
- **Requirement**: Change exercise order within saved workout
- **Interaction**: Up/Down arrow buttons on each exercise
- **Independence**: Order can differ from plan order

#### 9.3.11 Start Saved Workout
- **Requirement**: Launch workout directly
- **Behavior**: Opens Active Workout session with all exercises from template
- **Availability**: Only from Workout View when plan is active

### 9.4 Access Points

| Location | Purpose | Features Available |
|----------|---------|-------------------|
| Plan Management → Workouts Tab | Full CRUD management | All features |
| Workout View → Workouts Tab | Quick-start workouts | View, Start only |
| Saved Workouts Page (/saved-workouts) | Standalone management | All features |

### 9.5 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| View Workouts | Navigate to Workouts tab | See list of saved workouts |
| Search | Type in search field | List filters in real-time |
| Create | Tap "Create Workout" → Enter name | New workout created |
| Rename | Tap edit icon → Enter name → Save | Name updated |
| Delete | Tap delete → Confirm | Workout removed |
| Duplicate | Tap duplicate icon | Copy created |
| View Details | Tap workout card | Details dialog opens |
| Add Exercise | In details → Tap "Add" → Select from plan | Exercise added |
| Remove Exercise | In details → Tap remove on exercise | Exercise removed |
| Reorder | Drag exercises in details view | Order updated |
| Start | Tap play icon | Active workout begins |

### 9.6 UX/Design
- **Layout**: List of workout cards
- **Search Bar**: At top, with placeholder text
- **Workout Card**:
  - Workout name (prominent)
  - Exercise count badge
  - Exercise names preview (truncated)
  - Action icons: Start, View, Edit, Duplicate, Delete
- **Create Dialog**: Name field only (simple)
- **Details Dialog**:
  - Full-screen modal
  - Header: Workout name
  - Exercise list with reorder arrows and remove options
  - "Add Exercise" button at bottom
  - Note: "Exercises from [Plan Name]"

---

## 10. Progress View & Activity Tracking *(Phase 2)*

> **Phase 1**: Not included (users see progress via weekly progress bar) | **Phase 2**: Full activity log and charts

### 10.1 Overview
Historical view of workout activity. Users can see what they've accomplished over time with charts and detailed logs.

*Note: This entire section is Phase 2. In Phase 1, users see their progress through the weekly progress bar in Workout View.*

### 10.2 Features

#### 10.2.1 Activity Log Table
- **Requirement**: Display detailed activity records
- **Columns**:
  - Date
  - Exercise name
  - Sets completed
  - Plan/Workout context
- **Sorting**: By date (most recent first)
- **Loading**: Infinite scroll (load more as user scrolls down)

#### 10.2.2 Progress Chart
- **Requirement**: Visual representation of activity over time
- **Chart Type**: Bar or line chart
- **Data**: Sets completed per day
- **Time Range**: Based on selected date range

#### 10.2.3 Date Range Selection
- **Requirement**: Filter activity by date range
- **Presets**:
  - Today
  - This Week
  - Last Week
  - Last 30 Days
- **Custom**: Date pickers for start/end dates

#### 10.2.4 Delete Activity Record
- **Requirement**: Remove incorrect activity entries
- **Use Case**: Accidentally logged wrong data
- **Behavior**: Confirmation before deletion

#### 10.2.5 Refresh Data
- **Requirement**: Manually refresh activity data
- **Control**: Refresh button
- **Display**: Last updated timestamp

### 10.3 Sub-Features

#### Tabs
- **Activity Log Tab**: Table view of activities
- **Progress Chart Tab**: Visual chart view

### 10.4 User Interactions
| Action | Interaction | Result |
|--------|-------------|--------|
| View Activity | Navigate to Progress View | See activity table |
| Switch Tab | Tap Activity Log / Progress Chart | View changes |
| Filter Date | Tap preset or use date pickers | Data filters |
| Refresh | Tap Refresh button | Data reloads |
| Delete Entry | Tap delete on row → Confirm | Entry removed |

### 10.5 UX/Design
- **Layout**: Full-screen page with date controls
- **Header**: 
  - "Progress & Activity" title
  - "Go to Workout" quick action button
- **Date Range Section** (card):
  - Start/End date pickers
  - Refresh button
  - Preset buttons row: Today | This Week | Last Week | Last 30 Days
- **Tab Bar**: Activity Log | Progress Chart
- **Activity Table**:
  - Scrollable table
  - Alternating row colors
  - Delete icon per row
- **Progress Chart**:
  - Bar chart showing daily activity
  - X-axis: Dates
  - Y-axis: Sets completed
  - Touch to see day details
- **Last Updated**: Timestamp at bottom

---

## 11. Weekly Progress Tracking

> **Phase 1**: Set completion tracking, Progress calculation | **Phase 2**: Weekly notes

### 11.1 Overview
System for tracking exercise completion on a weekly basis within training plans. Powers the progress indicators throughout the app.

### 11.2 Features

#### 11.2.1 Set Completion Tracking
- **Requirement**: Track completed sets per exercise per week
- **Data Stored**:
  - Sets completed (count)
  - Is exercise fully done (boolean)
  - Last updated timestamp
  - Week completed timestamp

#### 11.2.2 Progress Calculation
- **Requirement**: Calculate weekly completion percentage
- **Formula**: (Total completed sets / Total required sets) × 100
- **Aggregation**: Across all exercises in the plan for that week

#### 11.2.3 Weekly Notes *(Phase 2)*
- **Requirement**: Notes attached to specific exercises for specific weeks
- **Fields per note**:
  - Note ID
  - Date created
  - Note text
- **Operations**: Add, Edit, Delete

#### 11.2.4 Week Independence
- **Requirement**: Each week's progress is tracked independently
- **Behavior**: Navigating to a new week shows fresh progress state
- **Historical**: Past weeks' data preserved and viewable

#### 11.2.5 Progress When Exercise Modified
- **Scenario**: User changes exercise from 4 sets to 3 sets mid-week after completing 4
- **Behavior**: 
  - Completed count is preserved (4 completed)
  - Display shows exercise as "done" (100%)
  - Actual data: 4 completed, 3 required = marked complete
- **Principle**: If completed >= required, exercise is considered done

### 11.3 Data Model Concepts
- Progress tracked per: User → Plan → Exercise → Week
- Activity logged per: User → Exercise → Date
- Ensures data consistency between weekly progress and daily activity logs

### 11.4 UX/Design
- Progress indicators shown throughout app:
  - Week header progress bar
  - Per-exercise set indicators
  - Completion badges on exercises
- Real-time updates when sets completed
- Visual distinction between partial and full completion

---

## 12. General UX Guidelines

### 12.1 Mobile-First Design Philosophy

> **CRITICAL: This application is designed MOBILE-FIRST. All features and layouts must be optimized for mobile devices as the primary experience.**

#### 12.1.1 Design Principles
- **Touch-First**: All interactive elements sized for finger taps (minimum 44x44px)
- **Thumb Zone**: Primary actions within easy thumb reach
- **One-Handed Use**: Core workout features usable with one hand
- **Gym Environment**: Large text, high contrast for visibility
- **Offline Consideration**: Graceful handling of connectivity issues (see 12.8)

#### 12.1.2 Screen Sizes
- **Primary Target**: Mobile phones (320px - 428px width)
- **Secondary**: Tablets and larger screens adapt layouts
- **Breakpoints**: 
  - xs: 0-599px (mobile - primary)
  - sm: 600px+ (tablet/desktop - enhanced)

### 12.2 Navigation

#### 12.2.1 Bottom Navigation Bar (Mobile)
- **Position**: Fixed at bottom of screen
- **Items** (4-5 max):
  - Workout (home/main view)
  - Training Plans
  - Progress
  - Profile
- **Behavior**: Always visible, current item highlighted
- **Safe Area**: Respects device safe areas (notch, home indicator)

#### 12.2.2 Top Navigation (Desktop/Tablet)
- **Position**: Fixed at top
- **Contains**: App logo, navigation links, user menu

#### 12.2.3 Drawer Menu
- **Access**: Hamburger icon or swipe from edge
- **Contains**: All navigation items, logout option

### 12.3 Common Components

#### 12.3.1 Loading States
- **Skeleton Screens**: For content loading (preferred)
- **Spinners**: For actions in progress
- **Progress Indicators**: For multi-step processes
- **Placement**: Centered in the loading area

#### 12.3.2 Error Handling
- **Inline Errors**: Below form fields for validation
- **Alert Banners**: For page-level errors
- **Toast/Snackbar**: For transient errors
- **Retry Options**: When applicable

#### 12.3.3 Confirmation Dialogs
- **Use Cases**: Delete actions, irreversible changes
- **Structure**:
  - Clear title
  - Explanation text
  - Cancel button (left/secondary)
  - Confirm button (right/primary, red for destructive)

#### 12.3.4 Success Feedback
- **Snackbar/Toast**: Brief success messages
- **Duration**: 3-4 seconds auto-dismiss
- **Position**: Bottom of screen (above navigation)

#### 12.3.5 Empty States
- **Structure**:
  - Illustrative icon or image
  - Explanatory heading
  - Supporting text
  - Call-to-action button
- **Tone**: Encouraging, not error-like

### 12.4 Form Design

#### 12.4.1 Input Fields
- **Size**: Full-width on mobile
- **Labels**: Above field or floating
- **Validation**: Real-time with inline errors
- **Keyboard**: Appropriate type (number, text, etc.)

#### 12.4.2 Buttons
- **Primary Action**: Prominent, filled style
- **Secondary Action**: Outlined or text style
- **Destructive**: Red color for delete/remove
- **Disabled State**: Reduced opacity, not clickable

### 12.5 Visual Design

#### 12.5.1 Color Usage
- **Primary Color**: Used for main actions, active states
- **Error Color**: Red for destructive actions, errors
- **Success Color**: Green for completion, success states
- **Neutral Colors**: For text, borders, backgrounds

#### 12.5.2 Typography
- **Hierarchy**: Clear distinction between headings, body, captions
- **Readability**: Sufficient size for gym environment (min 14px body)
- **Contrast**: High contrast for text legibility

#### 12.5.3 Spacing
- **Consistent**: Use spacing scale (8px base unit)
- **Touch Targets**: Adequate spacing between tappable elements
- **Content Padding**: Comfortable margins on mobile

### 12.6 Performance

#### 12.6.1 Loading Performance
- **Skeleton Loading**: Immediate feedback while content loads
- **Optimistic Updates**: UI updates before server confirmation
- **Caching**: Appropriate caching for frequently accessed data

#### 12.6.2 Interaction Feedback
- **Immediate**: Visual feedback on tap/click
- **Progress**: Indicators for longer operations
- **State Changes**: Clear visual transitions

### 12.7 Accessibility

#### 12.7.1 Basic Requirements
- **Touch Targets**: Minimum 44x44px
- **Color Contrast**: WCAG AA compliant
- **Focus States**: Visible focus indicators
- **Screen Reader**: Meaningful labels on interactive elements

### 12.8 Offline Support *(Phase 2)*

> **Phase 1**: Online only | **Phase 2**: Full offline support with sync

> **MANDATORY (Phase 2): Offline support is a critical feature of this app. Users must be able to use the app fully in gym environments with poor or no connectivity.**

#### 12.8.1 Core Principle
- **All changes saved locally** and synced when back online
- **Full functionality offline** - users should not notice they're offline during workouts
- **Seamless sync** - automatic background sync when connectivity restored

#### 12.8.2 Offline-Capable Features (Full Functionality)
- **View**: All plans, exercises, saved workouts
- **Create/Edit/Delete**: Training plans, exercises, saved workouts
- **Track**: Set completions, progress tracking
- **Active Workout**: Full workout session functionality
- **Timer**: Rest timer works offline
- **Progress**: View all progress data

#### 12.8.3 Sync Behavior
- **Local-First**: All data written to local storage first
- **Background Sync**: Automatic sync when online
- **Sync Queue**: All offline changes queued and synced in order
- **Retry Logic**: Failed syncs automatically retry
- **Conflict Resolution**: Last-write-wins (simple strategy, no complex merge logic)

#### 12.8.4 User Experience
- **Offline Indicator**: Subtle visual indicator when offline (non-intrusive)
- **Sync Status**: Optional indicator showing pending sync items
- **Sync Notification**: Brief notification when sync completes after being offline
- **Error Handling**: Clear messaging if sync fails, with retry option

#### 12.8.5 Gym-Friendly Considerations
- **Pre-load**: Active plan data fully cached on app open
- **Minimal Bandwidth**: Optimized data transfer for poor connections
- **Image Caching**: Exercise images cached locally
- **No Blocking**: Network issues never block user actions

---

## Appendix A: Page Map

| Page | Path | Description |
|------|------|-------------|
| Login | /login | Authentication |
| Workout View | / | Main workout interface (home) |
| Training Plans | /training-plans | List of all plans |
| Manage Plan | /training-plans/:id/exercises | Exercise management |
| Manage Workouts | /training-plans/:id/workouts | Workout management |
| Progress View | /progress-view | Activity and charts |
| Profile | /profile | User profile |
| Saved Workouts | /saved-workouts | Standalone workouts page |

---

## Appendix B: User Flows

### B.1 First-Time User Flow *(Phase 1)*
1. Register account
2. Create first training plan (name + weeks)
3. Add exercises from library to plan
4. Configure sets/reps for each exercise
5. Set plan as active
6. Navigate to Workout View
7. Start completing exercises by tapping set indicators

### B.2 Returning User Daily Flow - Phase 1
1. Open app → Workout View (active plan shown)
2. View current week's exercises
3. Complete sets by tapping set indicators
4. See progress bar update

### B.3 Returning User Daily Flow - Phase 2 (Enhanced)
1. Open app → Workout View (active plan shown)
2. View current week's exercises
3. Either:
   - Complete sets individually, OR
   - Start saved workout for focused session
4. Use rest timer between sets
5. Optionally view progress

### B.4 Create Workout Template Flow *(Phase 2)*
1. In Workout View, select exercises for workout
2. Tap "Start Workout"
3. Complete workout (or partial)
4. Tap "Save as Workout"
5. Enter workout name
6. Future: Launch saved workout directly from Workouts tab

### B.5 Quick-Start Saved Workout Flow *(Phase 2)*
1. Open app → Workout View
2. Switch to Workouts tab
3. Tap play icon on saved workout
4. Active workout session starts
5. Complete sets using large +/- buttons
6. End workout when done

### B.6 Create Custom Exercise Flow *(Phase 2)*
1. In Plan Management, tap "Add Exercise"
2. In library browser, tap "Create Custom Exercise"
3. Enter exercise name
4. Upload exercise image (photo from gallery or camera)
5. Select primary muscle group
6. Optionally add secondary muscles
7. Select exercise type
8. Save custom exercise
9. Custom exercise now available in library
10. Select it and configure sets/reps to add to plan

---

## Appendix C: Data Relationships

```
User
  ├── Custom Exercise Definitions (1:many, user-created)
  │
  └── Training Plans (1:many)
        ├── Exercises (1:many) ──references──> Exercise Definitions (system OR custom)
        ├── Saved Workouts (1:many)
        │     └── Exercise References (many:many to Exercises)
        └── Weekly Progress (1:many per week)
              └── Exercise Progress (1:many)
                    └── Weekly Notes (1:many)

Exercise Definitions
  ├── System Definitions (pre-populated, shared, read-only)
  └── Custom Definitions (user-created, private, editable)

Activity Logs (per user, per date)
  └── Exercise completions with timestamps

Local Storage (Offline Support)
  └── Full mirror of user data for offline access
  └── Sync queue for pending changes
```

---

---

## Appendix D: TBD Items (To Be Decided During Development)

The following items are intentionally left open and should be decided during development:

### Authentication
- Password validation rules (min length, complexity)
- Username validation rules (min/max length, allowed characters)

### Limits
- Max exercises per plan
- Max saved workouts per plan
- Max custom exercises per user
- Max custom exercise image file size
- Custom exercise image dimensions/aspect ratio

### Timer
- Timer alert type (sound, vibration, or both)
- User configurability of alert type

### History & Data
- Exercise history scope (all time or limited)
- Progress view date range limits
- Account deletion data handling
- "Delete all data" option availability

### Edge Cases
- Empty workout behavior (0 exercises)
- Week change during active workout
- Workout start with no exercises selected

---

*Document Version: 1.4*
*Last Updated: December 2024*
