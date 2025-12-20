import { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
}

// List plans
export interface ListPlansRequest {
    _?: never; // No parameters - uses userId from context
}

export interface ListPlansResponse {
    plans?: TrainingPlanClient[];
    error?: string;
}

// Get single plan
export interface GetPlanRequest {
    planId: string;
}

export interface GetPlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

// Create plan
export interface CreatePlanRequest {
    name: string;
    durationWeeks: number;
}

export interface CreatePlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

// Delete plan
export interface DeletePlanRequest {
    planId: string;
}

export interface DeletePlanResponse {
    success?: boolean;
    error?: string;
}

// Set active plan
export interface SetActivePlanRequest {
    planId: string;
}

export interface SetActivePlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

