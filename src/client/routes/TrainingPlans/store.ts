import { createStore } from '@/client/stores';

/**
 * TrainingPlans route store - persists the selected plan ID
 * When a user selects a plan to manage, it's stored here so that
 * navigating away and back will restore the manage view.
 */
interface TrainingPlansState {
    selectedPlanId: string | null;
    setSelectedPlanId: (planId: string | null) => void;
}

export const useTrainingPlansStore = createStore<TrainingPlansState>({
    key: 'training-plans-route-storage',
    label: 'Training Plans Route',
    creator: (set) => ({
        selectedPlanId: null,
        setSelectedPlanId: (planId: string | null) => set({ selectedPlanId: planId }),
    }),
    persistOptions: {
        partialize: (state) => ({
            selectedPlanId: state.selectedPlanId,
        }),
    },
});

