#!/bin/bash
# Fix yarn.lock registry URLs
# Replaces Wix internal registry URLs with public npmjs.org URLs

YARN_LOCK="yarn.lock"

if [ ! -f "$YARN_LOCK" ]; then
    exit 0
fi

# Check if there are any wixpress URLs to fix
if grep -q "npm.dev.wixpress.com" "$YARN_LOCK"; then
    echo "Fixing yarn.lock registry URLs..."

    # Replace wixpress URLs with npmjs (handles both full path and base URL)
    sed -i '' 's|https://npm.dev.wixpress.com/api/npm/npm-repos/|https://registry.npmjs.org/|g' "$YARN_LOCK"
    sed -i '' 's|https://npm.dev.wixpress.com|https://registry.npmjs.org|g' "$YARN_LOCK"

    # Stage the fixed file
    git add "$YARN_LOCK"

    echo "yarn.lock URLs fixed and staged"
fi
