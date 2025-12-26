/**
 * Progress feature types
 */
export type DateRange = '7days' | '14days' | '30days' | '90days' | 'all';

export type ProgressTab = 'activity' | 'charts' | 'summary';

export interface ProgressState {
    activeTab: ProgressTab;
    dateRange: DateRange;
    setActiveTab: (tab: ProgressTab) => void;
    setDateRange: (range: DateRange) => void;
}
