/**
 * ESLint Configuration
 *
 * Combines template and project ESLint configs.
 * - config/eslint/eslint.template.mjs: Template rules (synced from template)
 * - config/eslint/eslint.project.mjs: Project overrides (not synced)
 */

import eslintTemplateConfig from "./config/eslint/eslint.template.mjs";
import eslintProjectConfig from "./config/eslint/eslint.project.mjs";

const eslintConfig = [
  ...eslintTemplateConfig,
  ...eslintProjectConfig,
];

export default eslintConfig;
