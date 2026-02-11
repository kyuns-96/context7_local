#!/bin/bash
# Ingest popular libraries to build a comprehensive documentation database

DB_FILE="${1:-docs.db}"

echo "Building documentation database: $DB_FILE"
echo "This will take 15-30 minutes and download ~500MB of documentation"
echo ""

# JavaScript/TypeScript ecosystem
echo "Ingesting JavaScript/TypeScript ecosystem..."
bun run src/cli/index.ts ingest https://github.com/facebook/react --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/expressjs/expressjs.com --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/nodejs/node --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/microsoft/TypeScript --db "$DB_FILE"

# Frontend frameworks
echo "Ingesting frontend frameworks..."
bun run src/cli/index.ts ingest https://github.com/vuejs/core --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/sveltejs/svelte --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/angular/angular --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/tailwindlabs/tailwindcss --db "$DB_FILE"

# Python ecosystem
echo "Ingesting Python ecosystem..."
bun run src/cli/index.ts ingest https://github.com/tiangolo/fastapi --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/prisma/prisma --db "$DB_FILE"

# Data/Testing
echo "Ingesting data and testing libraries..."
bun run src/cli/index.ts ingest https://github.com/pydantic/pydantic --db "$DB_FILE"

# Build tools
echo "Ingesting build tools..."
bun run src/cli/index.ts ingest https://github.com/webpack/webpack --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/vitejs/vite --db "$DB_FILE"

# Databases
echo "Ingesting database documentation..."
bun run src/cli/index.ts ingest https://github.com/mongodb/mongo --db "$DB_FILE"

# DevOps
echo "Ingesting DevOps tools..."
bun run src/cli/index.ts ingest https://github.com/docker/cli --db "$DB_FILE"
bun run src/cli/index.ts ingest https://github.com/kubernetes/kubernetes --db "$DB_FILE"

# Programming languages
echo "Ingesting programming languages..."
bun run src/cli/index.ts ingest https://github.com/rust-lang/rust --db "$DB_FILE"

# Others
echo "Ingesting additional libraries..."
bun run src/cli/index.ts ingest https://github.com/tensorflow/tensorflow --db "$DB_FILE"

echo ""
echo "✅ Database build complete!"
echo "Database file: $DB_FILE"
echo ""
echo "Start the server with:"
echo "  bun run src/server/index.ts --transport http --port 3000 --db $DB_FILE"
