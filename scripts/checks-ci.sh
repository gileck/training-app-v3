#!/bin/bash
# CI Checks Script
# Runs both TypeScript and ESLint checks, shows ALL errors, then fails if either failed

set +e  # Don't exit on first error

echo "🔍 Running TypeScript check..."
yarn ts
TS_EXIT=$?

echo ""
echo "🔍 Running ESLint check..."
yarn lint
LINT_EXIT=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Report results
if [ $TS_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ]; then
    echo "✅ All checks passed!"
    exit 0
else
    echo "❌ Checks failed:"
    if [ $TS_EXIT -ne 0 ]; then
        echo "   - TypeScript check failed (exit code: $TS_EXIT)"
    fi
    if [ $LINT_EXIT -ne 0 ]; then
        echo "   - ESLint check failed (exit code: $LINT_EXIT)"
    fi
    exit 1
fi
