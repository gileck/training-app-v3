/**
 * Re-export model definitions from common location
 * This maintains backward compatibility for server-side imports
 * 
 * NOTE: For client-side code, import directly from '@/common/ai/models'
 * to avoid pulling in server-only dependencies
 */
export {
  type AIModelDefinition,
  GEMINI_MODELS,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  getAllModels,
  getModelsByProvider,
  getModelById,
  isModelExists,
} from '@/common/ai/models';
