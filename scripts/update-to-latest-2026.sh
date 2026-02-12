#!/bin/bash
#
# Update script for context7_local database - February 2026
# Ingests the latest versions of key libraries as of February 2026
#

set -e  # Exit on error

# Database path
DB="docs-v1.0.3.db"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo "  context7_local Database Update"
echo "  February 2026 - Latest Versions"
echo "======================================${NC}"
echo ""

# Function to ingest a library
ingest_library() {
    local repo=$1
    local version=$2
    local name=$3
    
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Ingesting ${GREEN}${name}${NC} (${version})..."
    echo "  Repo: ${repo}"
    echo ""
    
    bun run src/cli/index.ts ingest "${repo}" \
        --version "${version}" \
        --db "${DB}"
    
    echo -e "${GREEN}✓${NC} Completed ${name} ${version}"
    echo ""
}

# Start timestamp
START_TIME=$(date +%s)

echo -e "${BLUE}Latest versions to be ingested:${NC}"
echo "  • React v19.2.4 (Jan 26, 2026)"
echo "  • Node.js v24.13.1 LTS 'Krypton' (Feb 10, 2026)"
echo "  • Node.js v25.6.1 Current (Feb 9, 2026)"
echo "  • TypeScript v5.9.3 (Latest 5.x)"
echo "  • Next.js v15.5.12 (Latest 15.x)"
echo "  • Vue v3.5.28 (Latest 3.5.x)"
echo "  • Angular 19.2.17 (Latest 19.x)"
echo ""
if [ -t 0 ]; then
    echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
    read
else
    echo -e "${YELLOW}Running in non-interactive mode...${NC}"
fi

# Ingest React 19.2.4
ingest_library "https://github.com/facebook/react" "v19.2.4" "React"

# Ingest Node.js v24.13.1 LTS
ingest_library "https://github.com/nodejs/node" "v24.13.1" "Node.js LTS (Krypton)"

# Ingest Node.js v25.6.1 Current
ingest_library "https://github.com/nodejs/node" "v25.6.1" "Node.js Current"

# Ingest TypeScript v5.9.3
ingest_library "https://github.com/microsoft/TypeScript" "v5.9.3" "TypeScript"

# Ingest Next.js v15.5.12
ingest_library "https://github.com/vercel/next.js" "v15.5.12" "Next.js"

# Ingest Vue v3.5.28
ingest_library "https://github.com/vuejs/core" "v3.5.28" "Vue"

# Ingest Angular 19.2.17
ingest_library "https://github.com/angular/angular" "19.2.17" "Angular"

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo -e "${GREEN}======================================"
echo "  Update Complete!"
echo "======================================${NC}"
echo ""
echo "Total time: ${MINUTES}m ${SECONDS}s"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Update split databases: bun run scripts/split-database.ts"
echo "  2. Verify ingestion: bun run src/cli/index.ts list --db ${DB}"
echo "  3. Test queries with new versions"
echo ""
echo -e "${YELLOW}NOTE:${NC} Run 'bash scripts/update-to-latest-2026.sh 2>&1 | tee update-2026.log'"
echo "      to save a complete log of the update process."
echo ""
