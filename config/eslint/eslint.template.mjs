/**
 * ESLint Template Configuration
 *
 * This file is synced from the template and should not be modified.
 * To add project-specific rules, modify eslint.project.mjs instead.
 */

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import boundaries from "eslint-plugin-boundaries";
import apiGuidelinesPlugin from "../../eslint-plugin-api-guidelines/index.js";
import stateManagementPlugin from "../../eslint-plugin-state-management/index.js";

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

const eslintTemplateConfig = [
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
      // Allow <img> - we use base64 data URLs for user uploads where next/image doesn't help
      "@next/next/no-img-element": "off",
      // Allow unused vars that start with underscore (common convention)
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      // Add API Guidelines rules (no-server-import-in-client replaced by eslint-plugin-boundaries)
      "api-guidelines/api-names-from-index": ["warn", {
        // Type imports from server are fine
        allowedPaths: [
          '@/server/template/cache/types'
        ]
      }],
      "api-guidelines/server-reexport-from-index": "warn",
      "api-guidelines/client-returns-cache-result": "off",
      "api-guidelines/no-duplicate-api-types": "off",
      "api-guidelines/no-direct-api-client-call": "warn",
      "api-guidelines/export-name-from-index": "warn",
      "api-guidelines/no-export-process-from-index": ["warn", {
        // For actions we need to export these functions
        ignorePatterns: [
          '**/actions/index.ts'
        ]
      }],
      // Prevent value re-exports from API index files that leak server code into client bundle
      "api-guidelines/no-value-reexport-from-api-index": "error",
      // Warn about direct ObjectId methods that fail on UUID strings
      "api-guidelines/prefer-id-utilities": "warn",
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
  // Scope API-specific lint rules to where they actually apply
  {
    files: ["src/apis/**/client.ts", "src/apis/**/client.tsx"],
    rules: {
      "api-guidelines/client-returns-cache-result": "warn"
    }
  },
  {
    files: ["src/client/**/*.ts", "src/client/**/*.tsx", "src/agents/**/*.ts"],
    rules: {
      "api-guidelines/no-duplicate-api-types": "warn"
    }
  },
  // Allow direct zustand imports in the stores factory folder
  {
    files: ["src/client/stores/**/*.ts"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Module boundaries rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      boundaries
    },
    settings: {
      "boundaries/elements": [
        { type: "client-features-template", pattern: "src/client/features/template/**" },
        { type: "client-features-project", pattern: "src/client/features/project/**" },
        { type: "client-routes-template", pattern: "src/client/routes/template/**" },
        { type: "client-routes-project", pattern: "src/client/routes/project/**" },
        { type: "client-components-template", pattern: "src/client/components/template/**" },
        { type: "client-components-project", pattern: "src/client/components/project/**" },
        { type: "client-utils", pattern: "src/client/utils/**" },
        { type: "client-stores", pattern: "src/client/stores/**" },
        { type: "client-other", pattern: "src/client/**" },
        { type: "server", pattern: "src/server/**" },
        { type: "apis", pattern: "src/apis/**" },
        { type: "agents", pattern: "src/agents/**" },
        { type: "pages", pattern: "src/pages/**" },
        { type: "common", pattern: "src/common/**" },
      ],
      "boundaries/ignore": [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/node_modules/**"
      ]
    },
    rules: {
      // Enforce module boundaries
      "boundaries/element-types": ["error", {
        default: "allow",
        rules: [
          {
            // Client code cannot import from server (except via apis)
            // Only value imports are disallowed; type imports are fine (compile-time only)
            from: ["client-features-template", "client-features-project", "client-routes-template", "client-routes-project", "client-components-template", "client-components-project", "client-utils", "client-stores", "client-other"],
            disallow: ["server", "agents"],
            importKind: "value",
            message: "Client code cannot import from server or agents. Use APIs instead. (type imports are allowed)"
          },
          {
            // Server code cannot import from client (browser APIs don't exist in Node.js)
            from: ["server", "agents"],
            disallow: ["client-features-template", "client-features-project", "client-routes-template", "client-routes-project", "client-components-template", "client-components-project", "client-utils", "client-stores", "client-other"],
            message: "Server/agents code cannot import from client. Client code uses browser APIs that don't exist in Node.js."
          },
          {
            // Template code cannot import from project code
            from: ["client-features-template", "client-routes-template", "client-components-template"],
            disallow: ["client-features-project", "client-routes-project", "client-components-project"],
            message: "Template code cannot import from project code. Template must remain project-agnostic."
          }
        ]
      }]
    }
  }
];

export default eslintTemplateConfig;
