#!/bin/bash
# TEMPORARY WORKAROUND: Fix broken @typescript-eslint packages from wixpress registry
# See docs/eslint-typescript-wixpress-issue.md for details
#
# This script copies working @typescript-eslint packages from another project
# that uses the public npm registry.

SOURCE_PROJECT="/Users/gileck/Projects/temp1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[fix-typescript-eslint] Checking for working @typescript-eslint packages...${NC}"

# Check if source project exists
if [ ! -d "$SOURCE_PROJECT/node_modules/@typescript-eslint" ]; then
    echo -e "${RED}[fix-typescript-eslint] Source project not found at $SOURCE_PROJECT${NC}"
    echo -e "${RED}[fix-typescript-eslint] ESLint TypeScript support may not work correctly.${NC}"
    echo -e "${YELLOW}[fix-typescript-eslint] To fix manually, copy @typescript-eslint, ts-api-utils, and graphemer from a project using public npm.${NC}"
    exit 0  # Don't fail the install
fi

# Check if we have the broken version
CURRENT_VERSION=$(cat node_modules/@typescript-eslint/parser/package.json 2>/dev/null | grep '"version"' | head -1 | grep -o '[0-9.]*')

if [ "$CURRENT_VERSION" = "8.52.0" ]; then
    echo -e "${YELLOW}[fix-typescript-eslint] Detected broken @typescript-eslint@8.52.0, replacing with working version...${NC}"

    # Copy packages
    rm -rf node_modules/@typescript-eslint
    cp -r "$SOURCE_PROJECT/node_modules/@typescript-eslint" node_modules/
    cp -r "$SOURCE_PROJECT/node_modules/ts-api-utils" node_modules/
    cp -r "$SOURCE_PROJECT/node_modules/graphemer" node_modules/

    NEW_VERSION=$(cat node_modules/@typescript-eslint/parser/package.json 2>/dev/null | grep '"version"' | head -1 | grep -o '[0-9.]*')
    echo -e "${GREEN}[fix-typescript-eslint] Replaced with @typescript-eslint@$NEW_VERSION${NC}"
else
    echo -e "${GREEN}[fix-typescript-eslint] @typescript-eslint@$CURRENT_VERSION looks OK, skipping.${NC}"
fi
