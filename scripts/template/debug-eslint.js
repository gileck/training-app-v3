#!/usr/bin/env node

const { ESLint } = require('eslint');
const path = require('path');

async function main() {
    // Get the absolute path to the file(s) you want to lint
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Please provide a file path to lint');
        process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);
    console.log(`Linting file: ${resolvedPath}`);

    // Enable debug mode for ESLint
    process.env.DEBUG = 'eslint:*,-eslint:code-path';

    // Create an instance of ESLint with the rule we want to debug
    const eslint = new ESLint({
        overrideConfig: [
            {
                plugins: {
                    'api-guidelines': require('../eslint-plugin-api-guidelines')
                },
                rules: {
                    'api-guidelines/no-server-import-in-client': ['warn', { debug: true }]
                },
                languageOptions: {
                    ecmaVersion: 2022,
                    sourceType: 'module'
                },
                files: ['**/*.ts', '**/*.tsx', '**/*.js']
            }
        ]
    });

    // Lint the file(s)
    const results = await eslint.lintFiles([resolvedPath]);

    // Format the results for display
    const formatter = await eslint.loadFormatter('stylish');
    const formattedResults = await formatter.format(results);
    console.log(formattedResults);
}

main().catch(error => {
    console.error('Error running ESLint:', error);
    process.exit(1);
}); 