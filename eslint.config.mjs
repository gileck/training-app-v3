import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import apiGuidelinesPlugin from "./eslint-plugin-api-guidelines/index.js";
import stateManagementPlugin from "./eslint-plugin-state-management/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Custom rule to prevent adding new files under /src/pages/api/ except for process/* files
const restrictApiRoutesRule = {
  create(context) {
    // Get the filename of the current file being linted
    const filename = context.getFilename();

    // Check if the file is under /src/pages/api/ but not under process/
    if (
      filename.includes('/src/pages/api/') &&
      !filename.includes('/src/pages/api/process/') &&
      !filename.includes('\\src\\pages\\api\\process\\') // For Windows paths
    ) {
      // Report an error for any file that's not under process/ directory
      context.report({
        loc: { line: 1, column: 0 },
        message: 'API routes should not be added directly under /src/pages/api/. Use the centralized API architecture pattern instead.',
      });
    }

    return {};
  }
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      "restrict-api-routes": {
        rules: {
          "no-direct-api-routes": restrictApiRoutesRule
        }
      },
      "api-guidelines": apiGuidelinesPlugin,
      "state-management": stateManagementPlugin
    },
    rules: {
      "restrict-api-routes/no-direct-api-routes": "error",
      "react-hooks/exhaustive-deps": "off",
      // Allow unused vars that start with underscore (common convention)
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      // Add API Guidelines rules
      "api-guidelines/no-server-import-in-client": ["warn", {
        // Import type imports from server are fine
        allowedPaths: [
          '@/server/cache/types'
        ]
      }],
      "api-guidelines/api-names-from-index": ["warn", {
        // Type imports from server are fine
        allowedPaths: [
          '@/server/cache/types'
        ]
      }],
      "api-guidelines/server-reexport-from-index": "warn",
      "api-guidelines/client-returns-cache-result": "warn",
      "api-guidelines/no-duplicate-api-types": "warn",
      "api-guidelines/no-direct-api-client-call": "warn",
      "api-guidelines/export-name-from-index": "warn",
      "api-guidelines/no-export-process-from-index": ["warn", {
        // For actions we need to export these functions
        ignorePatterns: [
          '**/actions/index.ts'
        ]
      }],
      // Block direct zustand imports - use createStore from @/client/stores
      "no-restricted-imports": ["error", {
        "paths": [
          {
            "name": "zustand",
            "message": "Use createStore from @/client/stores. See docs/zustand-stores.md"
          },
          {
            "name": "zustand/middleware",
            "message": "Use createStore from @/client/stores. See docs/zustand-stores.md"
          }
        ]
      }],
      // State management rule - warn on useState to encourage thinking
      // Disabled for now - enable after fixing existing code
      // "state-management/prefer-state-architecture": "warn"
    }
  },
  // State management rule for client components only
  {
    files: ["src/client/**/*.tsx", "src/client/**/*.ts"],
    // Exclude hooks files, stores, and test files
    ignores: [
      "src/client/stores/**",
      "src/client/hooks/**",
      "**/*.test.ts",
      "**/*.test.tsx"
    ],
    rules: {
      "state-management/prefer-state-architecture": "warn"
    }
  },
  // Allow direct zustand imports in the stores factory folder
  {
    files: ["src/client/stores/**/*.ts"],
    rules: {
      "no-restricted-imports": "off"
    }
  }
];

export default eslintConfig;
