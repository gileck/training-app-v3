#!/bin/bash
# CI Checks Script
# Runs TypeScript, ESLint, circular dependency, and unused code checks in PARALLEL
# Shows ALL errors, then fails if any check failed

set +e  # Don't exit on first error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Force CI mode to suppress interactive progress indicators
export CI=true

# Create temp directory for output
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${BOLD}${BLUE}🔍 Running all checks in parallel...${NC}"
echo ""

# Run all checks in parallel, capturing output to temp files
(
    echo -e "${CYAN}▸ TypeScript${NC}" > "$TEMP_DIR/ts.out"
    yarn ts 2>&1 >> "$TEMP_DIR/ts.out"
    echo $? > "$TEMP_DIR/ts.exit"
) &

(
    echo -e "${CYAN}▸ ESLint${NC}" > "$TEMP_DIR/lint.out"
    yarn lint 2>&1 >> "$TEMP_DIR/lint.out"
    echo $? > "$TEMP_DIR/lint.exit"
) &

(
    echo -e "${CYAN}▸ Circular Dependencies${NC}" > "$TEMP_DIR/circular.out"
    yarn check:circular 2>&1 >> "$TEMP_DIR/circular.out"
    echo $? > "$TEMP_DIR/circular.exit"
) &

(
    echo -e "${CYAN}▸ Unused Dependencies${NC}" > "$TEMP_DIR/unused.out"
    yarn check:unused:ci --no-config-hints 2>&1 >> "$TEMP_DIR/unused.out"
    echo $? > "$TEMP_DIR/unused.exit"
) &

# Wait for all background jobs to complete
wait

# Read exit codes
TS_EXIT=$(cat "$TEMP_DIR/ts.exit")
LINT_EXIT=$(cat "$TEMP_DIR/lint.exit")
CIRCULAR_EXIT=$(cat "$TEMP_DIR/circular.exit")
UNUSED_EXIT=$(cat "$TEMP_DIR/unused.exit")

# Display output with status indicators
display_result() {
    local name=$1
    local exit_code=$2
    local output_file=$3

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓${NC} ${BOLD}$name${NC}"
    else
        echo -e "${RED}✗${NC} ${BOLD}$name${NC}"
    fi
    # Show output indented, skip the first line (header)
    tail -n +2 "$output_file" | sed 's/^/  /'
    echo ""
}

display_result "TypeScript" $TS_EXIT "$TEMP_DIR/ts.out"
display_result "ESLint" $LINT_EXIT "$TEMP_DIR/lint.out"
display_result "Circular Dependencies" $CIRCULAR_EXIT "$TEMP_DIR/circular.out"
display_result "Unused Dependencies" $UNUSED_EXIT "$TEMP_DIR/unused.out"

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Report results
if [ $TS_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ] && [ $CIRCULAR_EXIT -eq 0 ] && [ $UNUSED_EXIT -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}❌ Checks failed:${NC}"
    if [ $TS_EXIT -ne 0 ]; then
        echo -e "   ${RED}•${NC} TypeScript"
    fi
    if [ $LINT_EXIT -ne 0 ]; then
        echo -e "   ${RED}•${NC} ESLint"
    fi
    if [ $CIRCULAR_EXIT -ne 0 ]; then
        echo -e "   ${RED}•${NC} Circular Dependencies"
    fi
    if [ $UNUSED_EXIT -ne 0 ]; then
        echo -e "   ${RED}•${NC} Unused Dependencies"
    fi
    exit 1
fi
