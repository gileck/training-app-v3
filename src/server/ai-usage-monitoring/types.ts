/**
 * Types for AI usage monitoring
 */

import { Usage } from '../ai/types';

export interface AIUsageRecord {
  id: string;
  timestamp: string;
  modelId: string;
  provider: string;
  usage: Usage;
  cost: number;
  endpoint: string;
}

export interface AIUsageSummary {
  totalCost: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  usageByModel: Record<string, {
    totalCost: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    count: number;
  }>;
  usageByDay: Record<string, {
    totalCost: number;
    totalTokens: number;
    count: number;
  }>;
}

export interface AIUsageMonitoringOptions {
  maxRecords?: number;
}
