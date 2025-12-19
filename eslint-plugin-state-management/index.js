/**
 * ESLint Plugin: state-management
 * 
 * Rules to enforce proper state management patterns for PWA offline-first apps.
 * 
 * Rules:
 * - prefer-state-architecture: Warns on useState, requiring explicit justification
 */

const preferStateArchitecture = require("./rules/prefer-state-architecture");

module.exports = {
    rules: {
        "prefer-state-architecture": preferStateArchitecture,
    },
};

