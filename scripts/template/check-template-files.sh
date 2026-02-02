#!/bin/bash
#
# Pre-commit hook: Check for modifications to template-owned files
#
# This script checks if any staged files are template-owned but not in projectOverrides.
# If found, it fails the commit with instructions to either:
# 1. Add the file to projectOverrides (for intentional project customizations)
# 2. Contribute the change back to the template (preferred in most cases)
#

# Config file paths
TEMPLATE_CONFIG=".template-sync.template.json"
PROJECT_CONFIG=".template-sync.json"

# Check if config files exist
if [ ! -f "$TEMPLATE_CONFIG" ]; then
    # No template config - this might be the template itself or not a synced project
    exit 0
fi

if [ ! -f "$PROJECT_CONFIG" ]; then
    # No project config - skip check
    exit 0
fi

# Get staged files (excluding deleted files)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

# Use Node.js to check files and output result
RESULT=$(node -e "
const fs = require('fs');

// Read configs
const templateConfig = JSON.parse(fs.readFileSync('$TEMPLATE_CONFIG', 'utf-8'));
const projectConfig = JSON.parse(fs.readFileSync('$PROJECT_CONFIG', 'utf-8'));

const templatePaths = templateConfig.templatePaths || [];
const projectOverrides = projectConfig.projectOverrides || [];

// Function to check if file matches a glob pattern
function matchesPattern(file, pattern) {
    // Handle ** patterns
    if (pattern.includes('**')) {
        const prefix = pattern.split('**')[0];
        if (file.startsWith(prefix)) return true;
    }
    // Handle * patterns (single level)
    else if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\\\.').replace(/\*/g, '.*') + '\$');
        if (regex.test(file)) return true;
    }
    // Exact match or directory prefix
    else {
        if (file === pattern || file.startsWith(pattern + '/')) return true;
    }
    return false;
}

// Check if file is template-owned
function isTemplateOwned(file) {
    return templatePaths.some(p => matchesPattern(file, p));
}

// Check if file is in projectOverrides
function isProjectOverride(file) {
    return projectOverrides.includes(file);
}

// Get staged files
const stagedFiles = \`$STAGED_FILES\`.split('\\n').filter(f => f.trim());

// Check each staged file
const violations = [];

for (const file of stagedFiles) {
    // Skip config files themselves
    if (file === '.template-sync.json' || file === '.template-sync.template.json') {
        continue;
    }

    // Check if file is template-owned but not in overrides
    if (isTemplateOwned(file) && !isProjectOverride(file)) {
        violations.push(file);
    }
}

// Output result as JSON
console.log(JSON.stringify({ violations }));
" 2>/dev/null)

# Parse violations from result
VIOLATIONS=$(echo "$RESULT" | node -e "
const input = require('fs').readFileSync(0, 'utf-8');
try {
    const data = JSON.parse(input);
    if (data.violations && data.violations.length > 0) {
        console.log(data.violations.join('\\n'));
        process.exit(1);
    }
    process.exit(0);
} catch (e) {
    process.exit(0);
}
")

PARSE_EXIT=$?

if [ $PARSE_EXIT -eq 0 ]; then
    exit 0
fi

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}${BOLD}  ⚠️  TEMPLATE FILE MODIFICATION DETECTED${NC}"
echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}The following template-owned files are being modified:${NC}"
echo ""
echo "$VIOLATIONS" | while read -r file; do
    [ -z "$file" ] && continue
    echo -e "  ${CYAN}•${NC} $file"
done
echo ""
echo -e "${BOLD}These files are owned by the template and will be overwritten on next sync.${NC}"
echo ""
echo -e "${GREEN}${BOLD}Choose one of these options:${NC}"
echo ""
echo -e "  ${CYAN}Option 1: Contribute to template (recommended)${NC}"
echo -e "  ─────────────────────────────────────────────────────"
echo -e "  If this change would benefit all projects:"
echo -e "  1. Make the change in the template repository instead"
echo -e "  2. Run ${BOLD}yarn sync-template${NC} to pull it into this project"
echo ""
echo -e "  ${CYAN}Option 2: Add to projectOverrides (keep your version)${NC}"
echo -e "  ─────────────────────────────────────────────────────"
echo -e "  Edit ${BOLD}.template-sync.json${NC} and add to projectOverrides:"
echo ""
echo -e "    \"projectOverrides\": ["
echo "$VIOLATIONS" | while read -r file; do
    [ -z "$file" ] && continue
    echo -e "      \"$file\","
done
echo -e "    ]"
echo ""
echo -e "  ${YELLOW}⚠️  Warning: Override files won't receive template updates${NC}"
echo ""
echo -e "  ${CYAN}Option 3: Bypass this check (not recommended)${NC}"
echo -e "  ─────────────────────────────────────────────────────"
echo -e "  ${YELLOW}git commit --no-verify${NC}"
echo ""
echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
exit 1
