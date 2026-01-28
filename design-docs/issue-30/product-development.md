# Product Development: Exercise Definition Overrides in Training Plans

**Size: L**

## Problem Statement

Currently, when users add exercises to their training plans, they configure workout parameters (sets, reps, weight, comments) but all exercise definition fields (name, muscle groups, type, images, etc.) are inherited from the base exercise definition and cannot be customized per plan. This creates limitations when:

1. Users want to use the same exercise twice with different configurations and want to distinguish them (e.g., "Bench Press - Heavy" vs "Bench Press - Light")
2. Users disagree with the default muscle group classification for their specific use case
3. Users want to add custom notes or images specific to how they perform that exercise in a particular plan
4. The system exercise definition doesn't fully match the user's variation of the exercise

This feature enables users to have complete control over their exercises by allowing them to override any field in the exercise definition on a per-added-exercise basis, while maintaining the original exercise definition as the default source.

## Target Users

**Primary Users:**
- Intermediate to advanced fitness enthusiasts who create detailed, customized training plans
- Users who perform exercise variations that differ from standard definitions
- Personal trainers managing multiple clients with different exercise variations
- Users who want precise control over exercise categorization and tracking

**User Needs:**
- Ability to customize exercise names to reflect specific variations (e.g., "Close-Grip Bench Press" from "Bench Press")
- Flexibility to reclassify muscle groups based on their technique or focus
- Option to add personalized images or notes for exercise variations
- Capability to add the same base exercise multiple times with different definitions
- Easy way to reset overrides back to original definition defaults

## Requirements

### R1: Per-Exercise Definition Override System
**Acceptance Criteria:**
- [ ] Each added exercise (PlanExercise) can store its own set of definition overrides separate from the base exercise definition
- [ ] Overrides are stored per user per added exercise (two instances of the same exercise can have different overrides)
- [ ] Override fields include: name, imageUrl, primaryMuscle, secondaryMuscles, type, isBodyweight, isStatic
- [ ] exerciseDefId (reference to original definition) cannot be overridden
- [ ] When no override is specified for a field, the value from the original exercise definition is used
- [ ] Overrides persist across sessions and sync with the user's plan data

### R2: Override Configuration Interface
**Acceptance Criteria:**
- [ ] Users can access override configuration when adding a new exercise to a plan
- [ ] Users can access override configuration when editing an existing exercise in a plan
- [ ] Interface allows users to override any permitted exercise definition field
- [ ] Users can select muscles from the complete muscle list (both primary and secondary muscles)
- [ ] Interface clearly indicates which fields are overridden vs using defaults
- [ ] Changes to overrides save independently from workout configuration (sets/reps/weight)

### R3: Reset to Defaults Functionality
**Acceptance Criteria:**
- [ ] Users can reset all overrides for an exercise back to the original definition
- [ ] Users can reset individual fields back to their original definition value
- [ ] Reset action requires confirmation to prevent accidental data loss
- [ ] After reset, the exercise immediately displays values from the original definition
- [ ] Reset functionality is accessible from the exercise edit interface

### R4: Multiple Instances of Same Exercise
**Acceptance Criteria:**
- [ ] Users can add the same exercise (same exerciseDefId) to a plan multiple times
- [ ] Each instance maintains its own independent overrides
- [ ] Each instance maintains its own independent workout configuration (sets/reps/weight)
- [ ] Visual distinction between multiple instances in the exercise list
- [ ] Deleting one instance does not affect other instances of the same exercise

### R5: Display of Overridden Exercises
**Acceptance Criteria:**
- [ ] Exercises with overrides display the overridden values in all plan views
- [ ] Exercise cards show the overridden name, muscle group, and image if specified
- [ ] Original exercise definition remains unchanged when overrides are applied
- [ ] Overridden exercises are visually identifiable (e.g., indicator badge)
- [ ] Hovering or tapping shows which fields are overridden vs default

### R6: Data Migration and Compatibility
**Acceptance Criteria:**
- [ ] Existing exercises without overrides continue to work normally
- [ ] System gracefully handles exercises where the original definition no longer exists
- [ ] Override data structure is backward compatible with current PlanExercise schema
- [ ] API responses include both original definition and override values
- [ ] Export/import of plans preserves override information

## Success Metrics

- **Adoption Rate**: Percentage of users who use the override feature within 30 days of release
  - Target: 15% of active users create at least one override
- **Usage Frequency**: Average number of overrides per user who uses the feature
  - Target: 3+ overrides per active user
- **Feature Engagement**: Percentage of plans that contain at least one overridden exercise
  - Target: 25% of plans created after release
- **User Satisfaction**: Rating of feature usefulness from in-app feedback
  - Target: 4.0+ out of 5.0 stars
- **Support Reduction**: Decrease in support requests related to exercise customization
  - Target: 30% reduction in related support tickets

## Scope

### In Scope
- Override storage architecture for PlanExercise records
- User interface for configuring overrides when adding/editing exercises
- Reset functionality for individual fields and all overrides
- Support for multiple instances of the same exercise with different overrides
- Display of overridden values throughout the application
- Muscle selection from complete muscle group list
- API updates to handle override data
- Data migration to support new override structure
- Documentation of override behavior

### Out of Scope
- Editing the original exercise definitions (this feature only allows per-instance overrides)
- Sharing override configurations between different plan exercises
- Templates or presets for common exercise variations (may be future enhancement)
- Bulk override operations across multiple exercises (may be future enhancement)
- Override suggestions based on exercise name or user patterns (may be future enhancement)
- Creating new exercise definitions through the override interface (users must use existing "Create Exercise" flow)
- Version history or undo/redo for override changes (beyond basic reset to defaults)
- Advanced permission controls for overrides (all users can override their own exercises)

## Dependencies

**Technical Dependencies:**
- PlanExercise database schema extension to store override fields
- ExerciseDefinition type definitions for override validation
- Muscle groups API for providing selection options
- Plan data sync mechanism to handle override data
- Client-side state management for override UI

**Feature Dependencies:**
- Existing exercise library and definition system
- Current add/edit exercise dialogs and workflows
- Training plan management interface
- Exercise filtering and search functionality

**Data Dependencies:**
- Complete muscle group list must be available
- Original exercise definitions must be preserved
- Plan exercise data must maintain referential integrity to exercise definitions

## Risks & Mitigations

**Risk 1: Data Complexity**
- **Risk**: Adding override fields increases data model complexity and potential for inconsistencies
- **Mitigation**: 
  - Implement clear data validation rules
  - Use TypeScript types to enforce proper override structure
  - Create comprehensive tests for override merge logic
  - Document data model clearly for future developers

**Risk 2: User Confusion**
- **Risk**: Users may not understand the difference between overrides and editing the original definition
- **Mitigation**: 
  - Clear UI labels explaining override behavior
  - Visual indicators showing when fields are overridden
  - Help text explaining that changes only affect this specific exercise instance
  - Onboarding tooltip or guide for first-time users

**Risk 3: Performance Impact**
- **Risk**: Merging override data with base definitions could impact load times
- **Mitigation**: 
  - Perform merge operations on the server side
  - Cache merged exercise data appropriately
  - Optimize database queries to include override data
  - Monitor performance metrics after release

**Risk 4: Migration Challenges**
- **Risk**: Existing exercises may not migrate cleanly to new override system
- **Mitigation**: 
  - Design backward-compatible data structure
  - Create migration script with rollback capability
  - Test migration with production data clone
  - Implement gradual rollout to detect issues early

## Open Questions

1. **Storage Strategy**: Should overrides be stored as a nested object within PlanExercise or as separate fields at the root level?
   - **Option A**: `overrides: { name?: string, primaryMuscle?: string, ... }` (cleaner separation)
   - **Option B**: Individual optional fields like `overrideName?: string` (flatter structure)

2. **Default Behavior**: When a user edits an exercise for the first time, should all fields default to "override mode" or should users explicitly opt-in to overriding each field?
   - **Recommendation**: Explicit opt-in per field to prevent accidental overrides

3. **Visual Distinction**: How prominent should the visual indicator be for overridden exercises?
   - **Options**: Subtle badge, border color change, icon overlay, or dedicated section in list

4. **Reset Granularity**: Should reset be all-or-nothing or allow resetting individual fields?
   - **Recommendation**: Support both individual field reset and "reset all" for flexibility