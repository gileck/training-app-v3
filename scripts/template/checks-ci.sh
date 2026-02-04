#!/bin/bash
# CI Checks Script
# Runs TypeScript, ESLint, circular dependency, and unused code checks
# Shows ALL errors, then fails if any check failed

set +e  # Don't exit on first error

echo "🔍 Running TypeScript check..."
yarn ts
TS_EXIT=$?

echo ""
echo "🔍 Running ESLint check..."
yarn lint
LINT_EXIT=$?

echo ""
echo "🔍 Running circular dependency check..."
yarn check:circular
CIRCULAR_EXIT=$?

echo ""
echo "🔍 Running unused dependencies check..."
yarn check:unused:ci
UNUSED_EXIT=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Report results
if [ $TS_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ] && [ $CIRCULAR_EXIT -eq 0 ] && [ $UNUSED_EXIT -eq 0 ]; then
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
    if [ $CIRCULAR_EXIT -ne 0 ]; then
        echo "   - Circular dependency check failed (exit code: $CIRCULAR_EXIT)"
    fi
    if [ $UNUSED_EXIT -ne 0 ]; then
        echo "   - Unused dependencies check failed (exit code: $UNUSED_EXIT)"
    fi
    exit 1
fi
