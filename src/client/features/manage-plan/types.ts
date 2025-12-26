/**
 * Manage Plan feature types
 */
export type ManagePlanTab = 'exercises' | 'workouts';

export type FilterSource = 'all' | 'system' | 'custom';

export interface ManagePlanState {
    activeTab: ManagePlanTab;
    filterMuscle: string;
    filterType: string;
    filterSource: FilterSource;
    setActiveTab: (tab: ManagePlanTab) => void;
    setFilterMuscle: (muscle: string) => void;
    setFilterType: (type: string) => void;
    setFilterSource: (source: FilterSource) => void;
}
