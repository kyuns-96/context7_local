# Draft: Local Context7 MCP Server for Air-Gapped Environments

## Requirements (confirmed)
- Build a self-hosted MCP server that replicates Context7's functionality
- Must work in an air-gapped/secure environment with NO internet access
- Must integrate with OpenCode

## Research Findings

### How Context7 Cloud Works (from source code analysis)
- **Repo**: `github.com/upstash/context7` (MIT license)
- **Architecture**: The MCP server is a THIN CLIENT — it exposes two tools (`resolve-library-id` and `query-docs`) but ALL data comes from the Context7 cloud API at `https://context7.com/api`
- **API Endpoints**:
  - `GET /api/v2/libs/search?query=X&libraryName=Y` → returns library matches
  - `GET /api/v2/context?query=X&libraryId=Y` → returns documentation text
- **Key Insight**: The MCP server itself has NO local storage, NO database, NO documentation — it's purely a proxy to their cloud backend
- **This means**: We CANNOT just fork the Context7 MCP and run it offline. We need to build the entire backend (documentation storage + search + serving)

### What We Need to Build
1. **Documentation Database**: SQLite with FTS5 for full-text search (zero external deps)
2. **Documentation Ingestion Pipeline**: Scripts to scrape/download library docs and index them
3. **MCP Server**: TypeScript server using `@modelcontextprotocol/sdk` with stdio transport
4. **Two tools mirroring Context7**:
   - `resolve-library-id`: Search libraries in local database
   - `query-docs`: Query documentation for a specific library

### OpenCode Integration
- Uses `opencode.json` config file
- Local MCP: `"type": "local"`, `"command": ["node", "dist/index.js"]`
- Remote MCP: `"type": "remote"`, `"url": "http://localhost:3000/mcp"`
- For air-gapped: stdio transport (local) is ideal — zero network

### Recommended Stack
- **Runtime**: Node.js / Bun
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.x
- **Database**: SQLite via `better-sqlite3` with FTS5
- **Transport**: stdio (air-gapped) + optional HTTP for shared server
- **Ingestion**: CLI tool to scrape docs while online, export as portable `.db` file

## Technical Decisions
- SQLite FTS5 over vector DB (no embedding model needed, fully offline)
- stdio transport as primary (simplest for air-gapped)
- Markdown chunking by headings for optimal search results
- Pre-build the docs database on a machine WITH internet, then transfer the `.db` file to the air-gapped server

## User Answers (Feb 10)

### Target Libraries
- User wants "Whatever I want" — a general-purpose ingestion CLI that can scrape ANY library
- Also wants pre-configured support for popular web stack AND Python ecosystem
- May also have specific lists of libraries

### Transport Mode
- **HTTP (shared server)** — run as HTTP server on internal network, multiple devs share one instance

### Runtime
- Either Node.js or Bun works — we should recommend the best option

### Doc Versioning
- **Yes, versioned** — needs to query specific versions of library docs

## Open Questions
- (all answered)

## Scope Boundaries
- INCLUDE: MCP server (HTTP transport), SQLite database, general-purpose ingestion CLI, pre-configured scrapers for popular web+python libs, version support, OpenCode config, deployment guide
- EXCLUDE: Cloud hosting, OAuth/authentication to external services, vector search, embedding models

## Key Architecture Decisions
- HTTP transport with Streamable HTTP (MCP SDK) for shared server deployment
- SQLite FTS5 for search (zero external deps)
- CLI ingestion tool that runs on an internet-connected machine, produces a portable .db file
- Ingestion sources: GitHub repos (docs folders), npm READMEs, official doc sites
- Versioned library storage in the database schema
- Must implement both tools: resolve-library-id and query-docs
- Recommend Bun for faster startup + built-in SQLite support (bun:sqlite)
