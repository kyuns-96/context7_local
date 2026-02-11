# Local Context7 MCP Server for Air-Gapped Environments

## TL;DR

> **Quick Summary**: Build a self-hosted MCP server replicating Context7's `resolve-library-id` and `query-docs` tools, backed by SQLite FTS5 for offline full-text documentation search. Includes a CLI ingestion tool that downloads library docs from GitHub (while online), produces a portable `.db` file, and an HTTP MCP server that serves queries on an air-gapped internal network.
>
> **Deliverables**:
> - MCP server (HTTP + stdio transport) exposing `resolve-library-id` and `query-docs` tools
> - CLI ingestion tool for downloading + indexing library documentation from GitHub repos
> - Pre-configured library registry (React, Next.js, TypeScript, Node.js, Express, Django, Flask, FastAPI, etc.)
> - Versioned documentation support
> - Example `opencode.json` configuration + deployment README
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 0 (smoke) → Task 1 (schema) → Task 3 (tools) → Task 5 (ingestion) → Task 7 (integration) → Task 8 (deploy docs)

---

## Context

### Original Request
Build a local Context7 MCP server for use in a security-focused air-gapped environment with no internet access. Must integrate with OpenCode.

### Interview Summary
**Key Discussions**:
- Context7's MCP server is a thin proxy to their cloud API — the backend (crawler, indexer, search) is private. We must build the full stack.
- User wants general-purpose ingestion CLI for any library + pre-configured popular web & Python ecosystem libraries.
- HTTP transport for shared server deployment on internal network.
- Versioned documentation support required (e.g., React 18 vs React 19).
- TDD approach with `bun test`.
- Either Bun or Node.js — we chose Bun for built-in SQLite + test runner.

**Research Findings**:
- Context7 source at `github.com/upstash/context7` (MIT). MCP package uses `@modelcontextprotocol/sdk@^1.25.1`, Express, `registerTool()` API with raw Zod shapes.
- API endpoints: `GET /api/v2/libs/search` and `GET /api/v2/context` — we replicate these as local SQLite queries.
- Context7 uses `StreamableHTTPServerTransport` with `enableJsonResponse: true` (JSON, no SSE) — safe for Bun's Express compat.
- SQLite FTS5 provides BM25 ranking, prefix queries, phrase search — ideal for offline.
- `bun:sqlite` is built into Bun — zero external database deps.
- OpenCode config: `opencode.json` with `"type": "remote"`, `"url": "http://server:port/mcp"`.

### Metis Review
**Identified Gaps** (addressed):
- **Bun+Express+MCP SDK compatibility**: Added smoke test as Task 0 (gates everything)
- **FTS5 availability in bun:sqlite**: Validated via smoke test
- **Graceful shutdown**: Added SIGINT/SIGTERM handler to server task
- **Ingestion idempotency**: Use `INSERT OR REPLACE` — re-ingesting overwrites previous data
- **`--docs-path` override**: Added to ingestion CLI for repos with non-standard doc locations
- **stdio transport**: Added alongside HTTP — same `--transport` flag as Context7
- **Error responses as text content**: Follow Context7's pattern (errors returned as MCP text, not protocol errors)
- **Schema migration**: Simple `schema_version` table, but schema is frozen for v1
- **Token count**: Approximate via `Math.ceil(content.length / 4)` — zero deps

---

## Work Objectives

### Core Objective
Build a fully offline MCP documentation server that LLMs can query through OpenCode, providing library documentation search identical to Context7's tool interface, backed by locally-ingested documentation in SQLite FTS5.

### Concrete Deliverables
- `src/server/index.ts` — MCP server entry point (HTTP + stdio transport)
- `src/server/tools.ts` — `resolve-library-id` and `query-docs` tool handlers
- `src/server/format.ts` — Response formatting matching Context7 output
- `src/db/schema.ts` — SQLite schema with FTS5
- `src/db/queries.ts` — Search + query functions
- `src/db/connection.ts` — Database connection, PRAGMAs
- `src/cli/index.ts` — CLI entry point (ingest, list, remove, preview)
- `src/cli/ingest.ts` — GitHub clone → extract → chunk → insert
- `src/cli/presets.ts` — Library registry
- `src/scraper/github.ts` — Clone repo, checkout version tag, find markdown
- `src/scraper/markdown.ts` — Parse markdown into AST, extract chunks + code
- `src/scraper/chunker.ts` — Heading-aware chunking
- `data/presets.json` — Pre-configured library registry
- `opencode.json` — Example OpenCode configuration
- `README.md` — Setup, usage, deployment guide

### Definition of Done
- [x] `bun test` — all tests pass (exit code 0)
- [x] MCP server starts on HTTP, responds to `initialize`, `tools/list`, `tools/call` for both tools
- [x] MCP server starts on stdio, same tool functionality
- [x] CLI ingests a real GitHub repo (e.g., expressjs/express), produces `.db` file
- [x] `resolve-library-id` returns search results from local DB
- [x] `query-docs` returns documentation snippets from local DB with BM25 ranking
- [x] Versioned ingestion works (different versions of same library coexist)
- [x] OpenCode connects to MCP server via HTTP and can call both tools

### Must Have
- Tool names match Context7 exactly: `resolve-library-id`, `query-docs`
- Parameter names match Context7: `query`, `libraryName`, `libraryId`
- Response text format matches Context7's output (library listings, doc snippets)
- FTS5 full-text search with BM25 ranking
- HTTP and stdio transport via `--transport` CLI flag
- Versioned documentation in the database
- Pre-configured library registry for popular web + Python libraries
- Graceful shutdown (SIGINT/SIGTERM)
- `PRAGMA journal_mode=WAL` + `PRAGMA query_only=ON` in MCP server

### Must NOT Have (Guardrails)
- NO web UI, dashboard, or REST API beyond MCP protocol
- NO semantic/vector search, embeddings, or ML reranking
- NO abstract classes, strategy patterns, plugin architecture, or factory patterns
- NO authentication, rate limiting, or middleware (beyond minimal CORS for MCP)
- NO web site HTML crawling (GitHub repo markdown only in v1)
- NO custom error classes or error hierarchies
- NO JSDoc on internal functions (only public API)
- NO mocking SQLite or MCP SDK in tests — use real instances with `:memory:` DBs
- NO config files for everything — ONE registry file, everything else is CLI flags
- NO normalized schema (no author/tag/category tables) — flat: `libraries` + `snippets` + FTS5
- NO `node_modules` bundling for air-gap — use `bun build --compile` for standalone binary

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> **FORBIDDEN**: "User manually tests...", "User visually confirms...", "User clicks..."
> ALL verification is executed by the agent using tools (Bash, curl, interactive_bash).

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: TDD (test-first)
- **Framework**: `bun test` (built-in)

### TDD Workflow per Task

Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first → `bun test <file>` → FAIL
2. **GREEN**: Implement minimum code to pass → `bun test <file>` → PASS
3. **REFACTOR**: Clean up while keeping green → `bun test <file>` → PASS

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Every task includes QA scenarios. The executing agent directly verifies by running the deliverable.

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| Database schema | Bash (`bun test`, `bun -e`) | Create tables, insert, search, assert |
| MCP Server (HTTP) | Bash (`curl`) | POST JSON-RPC, parse response, assert fields |
| MCP Server (stdio) | interactive_bash (tmux) | Pipe JSON-RPC via stdin, read stdout |
| CLI Tool | Bash | Run CLI commands, check exit code + output |
| Integration | Bash (curl + bun) | Start server, call tools, verify responses |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Start Immediately — GATE):
└── Task 0: Smoke test (Bun+Express+SDK+FTS5 compatibility)

Wave 1 (After Wave 0):
├── Task 1: Database schema + FTS5 setup
└── Task 2: Markdown parser + heading-aware chunker

Wave 2 (After Wave 1):
├── Task 3: MCP tools (resolve-library-id + query-docs)
├── Task 4: GitHub scraper + ingestion pipeline
└── Task 5: Response formatting (match Context7 output)

Wave 3 (After Wave 2):
├── Task 6: CLI interface (ingest, list, remove, preview)
├── Task 7: MCP server entry point (HTTP + stdio transport)
└── Task 8: Library presets registry

Wave 4 (After Wave 3):
├── Task 9: Integration tests (full roundtrip)
└── Task 10: Deployment docs + OpenCode config + README

Critical Path: 0 → 1 → 3 → 7 → 9 → 10
Parallel Speedup: ~45% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 0 | None | 1, 2 | None (gate) |
| 1 | 0 | 3, 4, 5 | 2 |
| 2 | 0 | 4, 6 | 1 |
| 3 | 1 | 7, 9 | 4, 5 |
| 4 | 1, 2 | 6, 9 | 3, 5 |
| 5 | 1 | 7 | 3, 4 |
| 6 | 2, 4 | 9, 10 | 7, 8 |
| 7 | 3, 5 | 9, 10 | 6, 8 |
| 8 | 0 | 6, 10 | 6, 7 |
| 9 | 6, 7 | 10 | None |
| 10 | 9 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 0 | 0 | `task(category="quick", ...)` |
| 1 | 1, 2 | `task(category="unspecified-high", ...)` parallel |
| 2 | 3, 4, 5 | `task(category="unspecified-high", ...)` parallel |
| 3 | 6, 7, 8 | `task(category="unspecified-high", ...)` parallel |
| 4 | 9, 10 | `task(category="unspecified-high", ...)` then `task(category="writing", ...)` |

---

## TODOs

- [x] 0. Smoke Test: Bun + Express + MCP SDK + bun:sqlite FTS5 Compatibility

  **What to do**:
  - Initialize project: `bun init`, create `package.json` with `"type": "module"`
  - Install dependencies: `bun add @modelcontextprotocol/sdk@~1.25 express zod@^4 commander`
  - Install dev deps: `bun add -d @types/node @types/express typescript`
  - Create `tsconfig.json` for Bun (target ESNext, module ESNext, moduleResolution bundler)
  - Write `tests/smoke.test.ts` that validates ALL of the following:
    1. `bun:sqlite` can create an FTS5 virtual table and perform a search
    2. Express starts on Bun and responds to HTTP requests
    3. `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` instantiates
    4. `registerTool()` accepts raw Zod shapes (not wrapped in `z.object()`)
    5. `StreamableHTTPServerTransport` with `enableJsonResponse: true` handles a JSON-RPC request on Bun+Express
    6. A full roundtrip: MCP client sends `initialize` → server responds with capabilities
  - Run: `bun test tests/smoke.test.ts` → all assertions pass
  - **IF any test fails**: Document which component failed and what alternative to use (e.g., `better-sqlite3` instead of `bun:sqlite`, Node.js instead of Bun). This gates ALL subsequent tasks.

  **Must NOT do**:
  - Do NOT write application code — only test infrastructure
  - Do NOT create the full project structure — just enough for the smoke test
  - Do NOT add linting, formatting, or CI config

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single test file, environment validation, not complex logic
  - **Skills**: []
    - No specialized skills needed
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser automation needed
    - `frontend-ui-ux`: No UI

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (solo — gate task)
  - **Blocks**: Tasks 1, 2 (all subsequent work)
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - Context7 MCP entry: `https://github.com/upstash/context7/blob/master/packages/mcp/src/index.ts` — Shows exact `McpServer` instantiation, `registerTool()` API, `StreamableHTTPServerTransport` setup with `sessionIdGenerator: undefined, enableJsonResponse: true`
  - Context7 package.json: `https://github.com/upstash/context7/blob/master/packages/mcp/package.json` — Shows dependency versions: `@modelcontextprotocol/sdk@^1.25.1`, `zod@^4.3.4`, `express@^5.1.0`

  **API/Type References**:
  - MCP SDK server import: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"`
  - MCP SDK transport: `import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"`
  - bun:sqlite import: `import { Database } from "bun:sqlite"`

  **External References**:
  - Bun SQLite docs: `https://bun.sh/docs/api/sqlite`
  - Bun test runner: `https://bun.sh/docs/cli/test`
  - MCP SDK README: `https://github.com/modelcontextprotocol/typescript-sdk`

  **Acceptance Criteria**:
  - [ ] `package.json` created with all dependencies
  - [ ] `tsconfig.json` created for Bun
  - [ ] `tests/smoke.test.ts` exists and tests all 6 items above
  - [ ] `bun test tests/smoke.test.ts` → PASS (all assertions green)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Smoke test validates all integrations
    Tool: Bash
    Preconditions: Bun runtime installed, internet available for npm install
    Steps:
      1. Run: bun test tests/smoke.test.ts
      2. Assert: exit code 0
      3. Assert: stdout contains "pass" for all 6 test cases
      4. Assert: no "FAIL" in output
    Expected Result: All 6 integration checks pass
    Failure Indicators: Any test fails — document which component and fallback
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(project): initialize project and validate Bun+Express+MCP+FTS5 compatibility`
  - Files: `package.json, tsconfig.json, bun.lockb, tests/smoke.test.ts`
  - Pre-commit: `bun test tests/smoke.test.ts`

---

- [x] 1. Database Layer: Schema + FTS5 + Connection Management

  **What to do**:
  - **RED**: Write `tests/db/schema.test.ts`:
    - Test `createSchema(db)` creates `libraries` and `snippets` tables + FTS5 virtual table + triggers
    - Test insert into `libraries` and verify select
    - Test insert into `snippets` and verify FTS5 auto-sync (trigger fires)
    - Test FTS5 search returns results with BM25 ranking
    - Test `PRAGMA journal_mode` returns `wal`
    - Test `PRAGMA query_only` returns `1` when set
    - Test versioned library: insert same library ID with different versions, both coexist
    - Test `INSERT OR REPLACE` for idempotent ingestion
  - **GREEN**: Implement:
    - `src/db/schema.ts`:
      ```sql
      CREATE TABLE IF NOT EXISTS libraries (
          id TEXT NOT NULL,
          version TEXT NOT NULL DEFAULT 'latest',
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          source_repo TEXT NOT NULL,
          total_snippets INTEGER DEFAULT 0,
          trust_score REAL DEFAULT 5.0,
          benchmark_score REAL DEFAULT 0,
          ingested_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (id, version)
      );
      CREATE TABLE IF NOT EXISTS snippets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          library_id TEXT NOT NULL,
          library_version TEXT NOT NULL DEFAULT 'latest',
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          source_path TEXT,
          source_url TEXT,
          language TEXT DEFAULT '',
          token_count INTEGER DEFAULT 0,
          breadcrumb TEXT DEFAULT '',
          FOREIGN KEY (library_id, library_version) REFERENCES libraries(id, version)
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts USING fts5(
          title, content, source_path,
          content='snippets', content_rowid='id',
          tokenize='porter unicode61'
      );
      -- Insert/Delete triggers for FTS sync
      ```
    - `src/db/connection.ts`: `openDatabase(path, readOnly?)` function that opens SQLite, sets PRAGMAs (`journal_mode=WAL`, optionally `query_only=ON`), calls `createSchema()` if not read-only
  - **REFACTOR**: Extract PRAGMA setup into a dedicated function

  **Must NOT do**:
  - NO migration system — schema is frozen for v1
  - NO ORM or query builder — raw SQL only
  - NO abstract database interface

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Database schema design with FTS5, triggers, and indexing requires careful SQL
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI involved

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: Task 0

  **References**:

  **Pattern References**:
  - SQLite FTS5 official docs: `https://www.sqlite.org/fts5.html` — FTS5 CREATE, tokenizer options, MATCH syntax, rank function
  - Context7 types: `https://github.com/upstash/context7/blob/master/packages/mcp/src/lib/types.ts` — `SearchResult` interface with `id, title, description, totalSnippets, trustScore, benchmarkScore, versions`

  **External References**:
  - Bun SQLite API: `https://bun.sh/docs/api/sqlite` — `Database` class, `.run()`, `.query()`, `.prepare()`
  - FTS5 content tables: `https://www.sqlite.org/fts5.html#external_content_tables` — external content FTS5 pattern with triggers

  **WHY Each Reference Matters**:
  - FTS5 docs explain the exact `content=` and `content_rowid=` syntax for external content tables, plus trigger patterns for keeping FTS in sync
  - Context7 types show the exact fields we must store for each library to match tool output format
  - Bun SQLite API differs from `better-sqlite3` in method names (`.query()` vs `.all()`, `.run()` vs `.exec()`)

  **Acceptance Criteria**:
  - [ ] Test file: `tests/db/schema.test.ts`
  - [ ] `bun test tests/db/schema.test.ts` → PASS (8+ tests, 0 failures)
  - [ ] Libraries table supports compound PK `(id, version)`
  - [ ] FTS5 virtual table auto-syncs on insert via trigger
  - [ ] WAL mode enabled, query_only mode available

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Schema creates successfully with FTS5
    Tool: Bash
    Preconditions: Task 0 completed, dependencies installed
    Steps:
      1. Run: bun test tests/db/schema.test.ts
      2. Assert: exit code 0
      3. Assert: all test cases pass
    Expected Result: Schema creation, insertion, FTS5 search, versioning all work
    Evidence: Terminal output captured

  Scenario: FTS5 search returns ranked results
    Tool: Bash
    Preconditions: Schema test passes
    Steps:
      1. Run: bun -e "import {Database} from 'bun:sqlite'; const db = new Database(':memory:'); db.run('CREATE VIRTUAL TABLE t USING fts5(c)'); db.run(\"INSERT INTO t VALUES('hello world')\"); db.run(\"INSERT INTO t VALUES('goodbye world')\"); console.log(JSON.stringify(db.query('SELECT *, rank FROM t WHERE t MATCH ? ORDER BY rank', ['hello']).all()))"
      2. Assert: output contains "hello world"
      3. Assert: output does NOT contain "goodbye world" as first result
    Expected Result: FTS5 search filters and ranks correctly
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(db): add SQLite schema with FTS5 full-text search and connection management`
  - Files: `src/db/schema.ts, src/db/connection.ts, tests/db/schema.test.ts`
  - Pre-commit: `bun test tests/db/schema.test.ts`

---

- [x] 2. Markdown Parser + Heading-Aware Chunker

  **What to do**:
  - Install: `bun add unified remark-parse remark-gfm remark-stringify`
  - **RED**: Write `tests/scraper/markdown.test.ts`:
    - Test parsing a markdown string into AST nodes
    - Test extracting headings (H1, H2, H3) with their content
    - Test extracting code blocks with language annotation
    - Test handling MDX (JSX in markdown) — strip JSX, keep text
    - Test handling frontmatter — strip YAML frontmatter
  - **RED**: Write `tests/scraper/chunker.test.ts`:
    - Test chunking by H2/H3 boundaries
    - Test code blocks are never split across chunks
    - Test chunk size stays under configurable max (default 1500 chars)
    - Test oversized sections get split at paragraph boundaries
    - Test breadcrumb generation (e.g., "Docs > Routing > Middleware")
    - Test token count approximation (`Math.ceil(content.length / 4)`)
    - Test empty sections are skipped
  - **GREEN**: Implement:
    - `src/scraper/markdown.ts`: `parseMarkdown(content: string)` → returns structured sections with headings, content, code blocks
    - `src/scraper/chunker.ts`: `chunkDocument(sections, options)` → returns `Chunk[]` with `{title, content, breadcrumb, tokenCount, language, codeBlocks}`
  - **REFACTOR**: Ensure chunker handles edge cases (no headings, single heading, deeply nested)

  **Must NOT do**:
  - NO HTML parsing — markdown only
  - NO web crawling or fetching — pure text processing
  - NO abstract `ChunkingStrategy` interface

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: AST parsing with remark/unified requires understanding of plugin ecosystem
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 4, 6
  - **Blocked By**: Task 0

  **References**:

  **External References**:
  - unified ecosystem: `https://unifiedjs.com/` — How unified, remark-parse, remark-gfm work together
  - remark-parse API: `https://github.com/remarkjs/remark/tree/main/packages/remark-parse` — Parser options
  - mdast spec: `https://github.com/syntax-tree/mdast` — Markdown AST node types (heading, code, paragraph, etc.)

  **WHY Each Reference Matters**:
  - mdast spec defines the exact node types (`heading.depth`, `code.lang`, `code.value`) we need to traverse
  - remark-gfm adds GitHub Flavored Markdown support (tables, task lists) common in library docs

  **Acceptance Criteria**:
  - [ ] Test files: `tests/scraper/markdown.test.ts`, `tests/scraper/chunker.test.ts`
  - [ ] `bun test tests/scraper/` → PASS (12+ tests, 0 failures)
  - [ ] Chunks split at heading boundaries, code blocks intact
  - [ ] Token count approximation included on each chunk
  - [ ] Breadcrumbs generated correctly

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Markdown parser handles real-world docs
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run: bun test tests/scraper/markdown.test.ts
      2. Assert: exit code 0
      3. Assert: all parsing tests pass (headings, code blocks, frontmatter, MDX)
    Expected Result: Parser correctly extracts structured content from markdown
    Evidence: Terminal output captured

  Scenario: Chunker respects heading boundaries and size limits
    Tool: Bash
    Steps:
      1. Run: bun test tests/scraper/chunker.test.ts
      2. Assert: exit code 0
      3. Assert: no chunk exceeds 1500 chars (or configured max)
      4. Assert: code blocks are not split
    Expected Result: Chunking produces well-bounded, correctly-sized chunks
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(scraper): add markdown parser and heading-aware document chunker`
  - Files: `src/scraper/markdown.ts, src/scraper/chunker.ts, tests/scraper/markdown.test.ts, tests/scraper/chunker.test.ts`
  - Pre-commit: `bun test tests/scraper/`

---

- [x] 3. MCP Tools: resolve-library-id + query-docs

  **What to do**:
  - **RED**: Write `tests/db/queries.test.ts`:
    - Test `searchLibraries(query, libraryName, db)` searches the `libraries` table by name match + returns sorted results
    - Test `queryDocumentation(query, libraryId, db)` searches FTS5 for a library's snippets, returns BM25-ranked results
    - Test library search with partial name matches
    - Test query-docs filters by `library_id` (doesn't return results from other libraries)
    - Test query-docs with versioned library ID (`/org/project/v1.0.0`)
    - Test empty results return appropriate message
    - Test results include all required fields (id, title, description, totalSnippets, trustScore, benchmarkScore, versions)
  - **RED**: Write `tests/server/tools.test.ts`:
    - Test `handleResolveLibraryId({query, libraryName}, db)` returns formatted text matching Context7's output format
    - Test `handleQueryDocs({query, libraryId}, db)` returns formatted documentation text
    - Test error case: invalid libraryId returns helpful error message as text content
    - Test response shape: `{content: [{type: "text", text: "..."}]}`
  - **GREEN**: Implement:
    - `src/db/queries.ts`:
      - `searchLibraries(query, libraryName, db)`: `SELECT * FROM libraries WHERE id LIKE ? OR title LIKE ? ORDER BY trust_score DESC, total_snippets DESC`
      - `queryDocumentation(query, libraryId, db)`: `SELECT s.*, snippets_fts.rank FROM snippets s JOIN snippets_fts ON s.id = snippets_fts.rowid WHERE snippets_fts MATCH ? AND s.library_id = ? ORDER BY snippets_fts.rank LIMIT 20`
      - Parse versioned libraryId: `/org/project/version` → split into id=`/org/project`, version=`version`
    - `src/server/tools.ts`:
      - `handleResolveLibraryId(args, db)` — calls `searchLibraries`, formats as Context7-style text
      - `handleQueryDocs(args, db)` — calls `queryDocumentation`, formats results as plain text snippets
  - **REFACTOR**: Optimize SQL queries, add proper escaping for FTS5 MATCH syntax

  **Must NOT do**:
  - NO caching layer
  - NO result pagination (Context7 doesn't paginate)
  - NO custom ranking algorithm beyond BM25

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core business logic with FTS5 queries and format matching
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 7, 9
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - Context7 tool registration: `https://github.com/upstash/context7/blob/master/packages/mcp/src/index.ts` (lines ~120-230) — Exact tool names, descriptions, input schemas, response format
  - Context7 `formatSearchResults`: `https://github.com/upstash/context7/blob/master/packages/mcp/src/lib/utils.ts` — Exact text formatting: `- Title: X`, `- Context7-compatible library ID: Y`, `- Code Snippets: N`, `- Source Reputation: High/Medium/Low`, `- Benchmark Score: N`
  - Context7 `searchLibraries`: `https://github.com/upstash/context7/blob/master/packages/mcp/src/lib/api.ts` — Shows query parameter names and response handling

  **API/Type References**:
  - Context7 SearchResult type: `https://github.com/upstash/context7/blob/master/packages/mcp/src/lib/types.ts` — `{id, title, description, totalSnippets, trustScore, benchmarkScore, versions, state, branch, lastUpdateDate, stars}`

  **WHY Each Reference Matters**:
  - The `formatSearchResults` function shows EXACT text format that LLMs expect — we must match this line-for-line so existing prompts work
  - The tool registration in `index.ts` shows exact tool descriptions that LLMs use to decide when to call each tool — copy verbatim
  - The SearchResult type tells us exactly which fields to store and return

  **Acceptance Criteria**:
  - [ ] Test files: `tests/db/queries.test.ts`, `tests/server/tools.test.ts`
  - [ ] `bun test tests/db/queries.test.ts` → PASS (7+ tests)
  - [ ] `bun test tests/server/tools.test.ts` → PASS (4+ tests)
  - [ ] FTS5 search filters by library_id correctly
  - [ ] Versioned libraryId parsing works (`/org/project/v1.0`)
  - [ ] Response text matches Context7's format (library listing + doc snippets)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Search returns correct libraries from seeded DB
    Tool: Bash
    Preconditions: Task 1 completed, schema exists
    Steps:
      1. Run: bun test tests/db/queries.test.ts
      2. Assert: exit code 0
      3. Assert: searchLibraries returns matching libraries ranked by trust_score
      4. Assert: queryDocumentation returns BM25-ranked snippets filtered by library
    Expected Result: All query functions return correctly shaped, ranked results
    Evidence: Terminal output captured

  Scenario: Tool handlers format output like Context7
    Tool: Bash
    Steps:
      1. Run: bun test tests/server/tools.test.ts
      2. Assert: exit code 0
      3. Assert: resolve-library-id output contains "Title:", "Context7-compatible library ID:", "Code Snippets:"
      4. Assert: query-docs output contains documentation snippets as plain text
    Expected Result: Response format matches Context7 exactly
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(core): implement search queries and MCP tool handlers for resolve-library-id and query-docs`
  - Files: `src/db/queries.ts, src/server/tools.ts, tests/db/queries.test.ts, tests/server/tools.test.ts`
  - Pre-commit: `bun test tests/db/ tests/server/tools.test.ts`

---

- [x] 4. GitHub Scraper + Ingestion Pipeline

  **What to do**:
  - **RED**: Write `tests/scraper/github.test.ts`:
    - Test `resolveDocsPath(repoUrl, docsPath?)` returns correct glob pattern for docs
    - Test `listMarkdownFiles(repoDir, docsPath)` finds all `.md` files in a directory
    - Test `resolveVersion(repoDir, versionTag)` checks out a git tag (mock git with a temp directory)
    - Test `buildLibraryId(repoUrl)` converts `https://github.com/vercel/next.js` → `/vercel/next.js`
    - Test `buildSourceUrl(repoUrl, filePath, version)` constructs GitHub URL
  - **RED**: Write `tests/cli/ingest.test.ts`:
    - Test `ingestLibrary(repoUrl, dbPath, options)` end-to-end: clone → parse → chunk → insert
    - Test ingestion with `--version` flag stores versioned data
    - Test ingestion with `--docs-path` overrides default doc location
    - Test re-ingestion (same library+version) replaces previous data (idempotent)
    - Test `total_snippets` count updates on the library record
    - Use a small fixture directory (not real git clone) for tests
  - **GREEN**: Implement:
    - `src/scraper/github.ts`:
      - `cloneRepo(url, targetDir, options?)`: `git clone --depth 1 [--branch tag]`
      - `listMarkdownFiles(dir, globPattern)`: find all `.md`/`.mdx` files
      - `buildLibraryId(repoUrl)`: extract `/org/project` from GitHub URL
      - `buildSourceUrl(repoUrl, filePath, version)`: construct browsable GitHub URL
    - `src/cli/ingest.ts`:
      - `ingestLibrary(repoUrl, dbPath, options)`: orchestrates clone → list files → parse each → chunk → insert into DB
      - Uses `src/scraper/markdown.ts` and `src/scraper/chunker.ts` from Task 2
      - Uses `src/db/connection.ts` and `src/db/schema.ts` from Task 1
      - Wraps all inserts in a transaction for atomicity
      - Updates `libraries.total_snippets` count after insertion
  - **REFACTOR**: Add progress logging during ingestion

  **Must NOT do**:
  - NO web crawling or HTML fetching
  - NO npm registry scraping
  - NO parallel cloning (keep it simple)
  - NO retry logic for git clone

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: File system operations, git interaction, pipeline orchestration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Tasks 6, 9
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - Context7 API response: `https://github.com/upstash/context7/blob/master/packages/mcp/src/lib/types.ts` — `SearchResult.id` format is `/org/project`

  **External References**:
  - Git clone depth: `git clone --depth 1 --branch <tag> <url> <dir>` for shallow versioned clones
  - Bun glob API: `https://bun.sh/docs/api/glob` — `new Bun.Glob("**/*.md").scan(dir)`

  **WHY Each Reference Matters**:
  - Library ID format must match `/org/project` exactly for compatibility with existing Context7 prompts
  - Bun.Glob is faster than shell `find` and built into the runtime

  **Acceptance Criteria**:
  - [ ] Test files: `tests/scraper/github.test.ts`, `tests/cli/ingest.test.ts`
  - [ ] `bun test tests/scraper/github.test.ts` → PASS (5+ tests)
  - [ ] `bun test tests/cli/ingest.test.ts` → PASS (5+ tests)
  - [ ] Library ID extraction from GitHub URLs works correctly
  - [ ] Versioned ingestion stores data under correct version key
  - [ ] Re-ingestion is idempotent (replaces previous data)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Ingest a small test fixture
    Tool: Bash
    Preconditions: Tasks 1, 2 completed
    Steps:
      1. Create a temp directory with 3 markdown files (README.md, docs/guide.md, docs/api.md)
      2. Run ingest function against the temp directory
      3. Query the resulting DB: SELECT COUNT(*) FROM snippets
      4. Assert: snippet count > 0
      5. Query: SELECT * FROM libraries
      6. Assert: library record exists with correct total_snippets
    Expected Result: Ingestion pipeline processes markdown files into indexed snippets
    Evidence: Terminal output captured

  Scenario: Versioned ingestion stores separately
    Tool: Bash
    Steps:
      1. Ingest fixture as version "v1.0"
      2. Ingest fixture as version "v2.0" (with slightly different content)
      3. Query: SELECT COUNT(DISTINCT library_version) FROM snippets WHERE library_id = '/test/repo'
      4. Assert: count equals 2
    Expected Result: Both versions coexist in the database
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(scraper): add GitHub repo cloning and documentation ingestion pipeline`
  - Files: `src/scraper/github.ts, src/cli/ingest.ts, tests/scraper/github.test.ts, tests/cli/ingest.test.ts`
  - Pre-commit: `bun test tests/scraper/ tests/cli/`

---

- [x] 5. Response Formatting (Match Context7 Output)

  **What to do**:
  - **RED**: Write `tests/server/format.test.ts`:
    - Test `formatSearchResults(results)` produces exact Context7 text format:
      ```
      - Title: React
      - Context7-compatible library ID: /facebook/react
      - Description: A JavaScript library for building user interfaces
      - Code Snippets: 150
      - Source Reputation: High
      - Benchmark Score: 95
      - Versions: v18.2.0, v19.0.0
      ----------
      ```
    - Test `formatDocumentation(snippets)` produces readable doc output with section titles and content
    - Test `getSourceReputationLabel(score)` maps numeric trust_score to "High"/"Medium"/"Low"/"Unknown"
    - Test empty results return "No libraries found" / "Documentation not found" messages
    - Test response wrapper: `{content: [{type: "text", text: "..."}]}`
  - **GREEN**: Implement:
    - `src/server/format.ts`:
      - `formatSearchResults(results)` — matches Context7's `formatSearchResult` and `formatSearchResults` from `utils.ts` exactly
      - `formatDocumentation(snippets)` — formats snippets as readable doc text with headings and code blocks
      - `getSourceReputationLabel(score)` — `>=7: "High"`, `>=4: "Medium"`, `<4: "Low"`, `undefined: "Unknown"`
      - `wrapResponse(text)` — wraps in MCP content array

  **Must NOT do**:
  - NO HTML or rich formatting — plain text only (matches Context7)
  - NO custom formatting — match Context7 exactly

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: String formatting, straightforward logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - Context7 `formatSearchResult` and `formatSearchResults`: `https://github.com/upstash/context7/blob/master/packages/mcp/src/lib/utils.ts` — EXACT format to replicate line by line. Shows conditional inclusion of Code Snippets (only when not -1), Source Reputation label mapping, Benchmark Score (only when >0), Versions list
  - Context7 `getSourceReputationLabel`: same file — `>=7: "High"`, `>=4: "Medium"`, `<4: "Low"`, `undefined/<0: "Unknown"`
  - Context7 tool response text in `index.ts`: `https://github.com/upstash/context7/blob/master/packages/mcp/src/index.ts` (lines ~160-200) — The "Available Libraries:" header text and instruction block that precedes search results

  **WHY Each Reference Matters**:
  - The output format is what LLMs parse to extract library IDs — if we change format, existing prompts break
  - The reputation label mapping must be identical (7/4 thresholds)

  **Acceptance Criteria**:
  - [ ] Test file: `tests/server/format.test.ts`
  - [ ] `bun test tests/server/format.test.ts` → PASS (5+ tests)
  - [ ] Output text matches Context7's format character-for-character (separator `----------`, field labels, etc.)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Format matches Context7 output exactly
    Tool: Bash
    Steps:
      1. Run: bun test tests/server/format.test.ts
      2. Assert: exit code 0
      3. Assert: formatted output contains "- Title:", "- Context7-compatible library ID:", "- Source Reputation:"
      4. Assert: separator between results is "----------"
    Expected Result: Output format is identical to Context7's
    Evidence: Terminal output captured
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `feat(server): add response formatting matching Context7 output format`
  - Files: `src/server/format.ts, tests/server/format.test.ts`
  - Pre-commit: `bun test tests/server/format.test.ts`

---

- [x] 6. CLI Interface: ingest, list, remove, preview Commands

  **What to do**:
  - **RED**: Write `tests/cli/cli.test.ts`:
    - Test `ingest` command parses args: `--repo <url> --db <path> [--version <tag>] [--docs-path <glob>]`
    - Test `list` command shows all libraries in DB with version info
    - Test `remove` command deletes a library (and its snippets) from DB
    - Test `preview` command shows extracted chunks without inserting into DB
    - Test `ingest --preset react` uses preset config for React
    - Test `ingest --preset-all` ingests all preset libraries
    - Test error handling: invalid repo URL, missing DB path
  - **GREEN**: Implement:
    - `src/cli/index.ts`: Commander-based CLI with subcommands:
      - `ingest <repo-url> --db <path> [--version <tag>] [--docs-path <glob>] [--preset <name>] [--preset-all]`
      - `list --db <path>` — shows table of libraries with id, version, snippets count, ingested date
      - `remove <library-id> [--version <version>] --db <path>` — deletes library + snippets + FTS entries
      - `preview <repo-url> [--docs-path <glob>]` — clone, parse, chunk, display summary (no DB write)
    - Wire up `commander` for CLI parsing
    - Add progress output: "Cloning...", "Parsing N files...", "Indexed M snippets", "Done"
  - **REFACTOR**: Add helpful error messages and `--help` text

  **Must NOT do**:
  - NO interactive prompts — CLI only
  - NO config file for CLI — all via flags
  - NO parallel operations

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CLI design with multiple subcommands, argument parsing, user-facing output
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 2, 4

  **References**:

  **Pattern References**:
  - Context7 CLI: `https://github.com/upstash/context7/blob/master/packages/mcp/src/index.ts` (lines ~30-50) — Commander setup with `--transport`, `--port`, `--api-key` options

  **External References**:
  - Commander.js: `https://github.com/tj/commander.js` — Subcommands, options, required args

  **Acceptance Criteria**:
  - [ ] Test file: `tests/cli/cli.test.ts`
  - [ ] `bun test tests/cli/cli.test.ts` → PASS (7+ tests)
  - [ ] All 4 subcommands work: ingest, list, remove, preview
  - [ ] Preset ingestion works: `--preset react`
  - [ ] Error messages are helpful (not stack traces)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: CLI help shows all commands
    Tool: Bash
    Steps:
      1. Run: bun run src/cli/index.ts --help
      2. Assert: output contains "ingest", "list", "remove", "preview"
      3. Run: bun run src/cli/index.ts ingest --help
      4. Assert: output contains "--db", "--version", "--docs-path", "--preset"
    Expected Result: CLI is well-documented and discoverable
    Evidence: Terminal output captured

  Scenario: List shows ingested libraries
    Tool: Bash
    Preconditions: A test .db file with ingested data
    Steps:
      1. Run: bun run src/cli/index.ts list --db /tmp/test-cli.db
      2. Assert: output contains library ID, version, snippet count
    Expected Result: Library listing is readable
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(cli): add CLI interface with ingest, list, remove, and preview commands`
  - Files: `src/cli/index.ts, tests/cli/cli.test.ts`
  - Pre-commit: `bun test tests/cli/`

---

- [x] 7. MCP Server Entry Point: HTTP + stdio Transport

  **What to do**:
  - **RED**: Write `tests/server/integration.test.ts`:
    - Test HTTP transport: start server → send `initialize` via curl → assert response has `serverInfo.name`
    - Test HTTP transport: `tools/list` returns both tool names
    - Test stdio transport: pipe JSON-RPC via stdin → read response from stdout
    - Test graceful shutdown: send SIGINT → server exits cleanly (exit code 0)
    - Test `--db` flag: server opens specified database file
    - Test `--port` flag: server listens on specified port
    - Test CORS headers: response includes `Access-Control-Allow-Origin: *`
  - **GREEN**: Implement:
    - `src/server/index.ts`:
      - Commander CLI: `--transport <stdio|http>`, `--port <number>`, `--db <path>`
      - HTTP mode: Express app with `StreamableHTTPServerTransport(sessionIdGenerator: undefined, enableJsonResponse: true)`
      - stdio mode: `StdioServerTransport`
      - `McpServer` with name `"context7-local"`, version from `package.json`
      - Register tools using `server.registerTool()` with raw Zod shapes (matching Context7 exactly)
      - Tool descriptions copied verbatim from Context7 source (so LLMs know when to use them)
      - Open database with `query_only=ON` (read-only in server mode)
      - CORS middleware: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type, MCP-Session-Id, MCP-Protocol-Version`
      - Graceful shutdown: `process.on('SIGINT', () => { db.close(); process.exit(0) })`
      - `/mcp` endpoint for MCP protocol (matches Context7's URL path)
      - `/ping` health check endpoint
  - **REFACTOR**: Extract transport setup into helper functions

  **Must NOT do**:
  - NO authentication middleware
  - NO rate limiting
  - NO request logging middleware (use `console.error` for startup info only, like Context7)
  - NO session management (stateless transport)
  - NO OAuth endpoints

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core server setup with MCP SDK, Express, transport bridging
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 6, 8)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 3, 5

  **References**:

  **Pattern References**:
  - Context7 MCP server entry: `https://github.com/upstash/context7/blob/master/packages/mcp/src/index.ts` — ENTIRE file is the reference. Key sections:
    - Lines 30-55: Commander CLI setup with `--transport`, `--port`, `--api-key`
    - Lines 100-115: `McpServer` instantiation with name/version and instructions
    - Lines 118-230: `registerTool()` calls with full descriptions and raw Zod shapes
    - Lines 240-280: Express HTTP setup with CORS
    - Lines 285-310: `StreamableHTTPServerTransport` creation with `sessionIdGenerator: undefined, enableJsonResponse: true`
    - Lines 315-325: stdio transport setup with `StdioServerTransport`
  - Context7 constants: `https://github.com/upstash/context7/blob/master/packages/mcp/src/lib/constants.ts` — Server version from package.json

  **WHY Each Reference Matters**:
  - Context7's `index.ts` is the EXACT pattern we're replicating — same Express+MCP SDK integration, same tool registration, same transport setup. Only difference: we query local SQLite instead of calling cloud API
  - The CORS headers and endpoint paths (`/mcp`, `/ping`) must match for compatibility

  **Acceptance Criteria**:
  - [ ] Test file: `tests/server/integration.test.ts`
  - [ ] `bun test tests/server/integration.test.ts` → PASS (7+ tests)
  - [ ] HTTP: `POST /mcp` with `initialize` → returns `serverInfo.name: "context7-local"`
  - [ ] HTTP: `POST /mcp` with `tools/list` → returns `resolve-library-id` and `query-docs`
  - [ ] stdio: pipe initialize JSON → stdout contains response
  - [ ] CORS headers present on all responses
  - [ ] Graceful shutdown works

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: MCP server starts and responds to initialize
    Tool: Bash
    Preconditions: Tasks 3, 5 completed; test .db file exists
    Steps:
      1. Start: timeout 15 bun run src/server/index.ts --transport http --port 3459 --db /tmp/test-server.db &
      2. Wait 2 seconds for startup
      3. Run: curl -sf http://localhost:3459/mcp -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
      4. Assert: response contains "context7-local" in serverInfo.name
      5. Run: curl -sf http://localhost:3459/ping
      6. Assert: response contains "ok"
      7. Kill server process
    Expected Result: Server starts, responds to MCP protocol, health check works
    Evidence: curl response bodies captured

  Scenario: tools/list returns both tools
    Tool: Bash
    Preconditions: Server running on port 3459
    Steps:
      1. Run: curl -sf http://localhost:3459/mcp -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}'
      2. Assert: response contains "resolve-library-id"
      3. Assert: response contains "query-docs"
    Expected Result: Both tools listed with correct names and descriptions
    Evidence: curl response body captured
  ```

  **Commit**: YES
  - Message: `feat(server): add MCP server with HTTP and stdio transport`
  - Files: `src/server/index.ts, tests/server/integration.test.ts`
  - Pre-commit: `bun test tests/server/`

---

- [x] 8. Library Presets Registry

  **What to do**:
  - Create `data/presets.json` with pre-configured library entries:
    ```json
    {
      "react": {
        "repo": "https://github.com/facebook/react",
        "docsPath": "docs/**/*.md",
        "title": "React",
        "description": "A JavaScript library for building user interfaces"
      },
      "nextjs": {
        "repo": "https://github.com/vercel/next.js",
        "docsPath": "docs/**/*.mdx",
        "title": "Next.js",
        "description": "The React Framework for the Web"
      },
      ...
    }
    ```
  - **RED**: Write `tests/cli/presets.test.ts`:
    - Test loading presets file returns all entries
    - Test `getPreset("react")` returns correct repo URL and docsPath
    - Test `listPresets()` returns all preset names
    - Test unknown preset returns helpful error
    - Test preset config includes all required fields
  - **GREEN**: Implement:
    - `src/cli/presets.ts`:
      - `loadPresets()` — reads `data/presets.json`
      - `getPreset(name)` — returns config for a preset
      - `listPresets()` — returns all preset names with descriptions
  - Populate `data/presets.json` with these libraries:
    - **Web**: react, nextjs, typescript, nodejs, express, vue, angular, svelte, tailwindcss, prisma
    - **Python**: django, flask, fastapi, sqlalchemy, pydantic, celery, pytest, numpy, pandas, requests

  **Must NOT do**:
  - NO dynamic preset discovery
  - NO remote preset fetching

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: JSON data file + simple loader function
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 6, 7)
  - **Blocks**: Tasks 6, 10
  - **Blocked By**: Task 0

  **References**:

  **External References**:
  - React docs location: `https://github.com/facebook/react` → `docs/` directory
  - Next.js docs: `https://github.com/vercel/next.js` → `docs/` directory (MDX format)
  - Express docs: `https://github.com/expressjs/expressjs.com` → separate repo for docs
  - Django docs: `https://github.com/django/django` → `docs/` directory (RST format — needs special handling note)
  - Flask docs: `https://github.com/pallets/flask` → `docs/` directory (RST)

  **WHY Each Reference Matters**:
  - Each library stores docs differently — presets must include the EXACT `docsPath` glob that finds the documentation files
  - Some Python libraries use RST instead of Markdown — preset should note this (ingestion may produce lower quality for RST, documented as known limitation)

  **Acceptance Criteria**:
  - [ ] `data/presets.json` contains 20 library entries
  - [ ] Test file: `tests/cli/presets.test.ts`
  - [ ] `bun test tests/cli/presets.test.ts` → PASS (5+ tests)
  - [ ] Each preset has: repo, docsPath, title, description

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Presets load and contain expected libraries
    Tool: Bash
    Steps:
      1. Run: bun test tests/cli/presets.test.ts
      2. Assert: exit code 0
      3. Run: bun -e "import p from './data/presets.json'; console.log(Object.keys(p).length)"
      4. Assert: output >= 20
    Expected Result: All 20 preset libraries configured correctly
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(cli): add pre-configured library presets for popular web and Python frameworks`
  - Files: `data/presets.json, src/cli/presets.ts, tests/cli/presets.test.ts`
  - Pre-commit: `bun test tests/cli/presets.test.ts`

---

- [x] 9. End-to-End Integration Tests

  **What to do**:
  - Write `tests/e2e/full-roundtrip.test.ts`:
    - Test the COMPLETE flow: ingest a small real repo → start MCP server → call resolve-library-id → call query-docs → verify results
    - Use `expressjs/express` as the test repo (small, well-structured markdown docs)
    - Test flow:
      1. Run ingestion: clone express repo → parse → insert into temp DB
      2. Start MCP server on a random high port with the temp DB
      3. Send `initialize` via HTTP POST → assert success
      4. Send `tools/call` for `resolve-library-id` with `libraryName: "express"` → assert results contain `/expressjs/express`
      5. Send `tools/call` for `query-docs` with `libraryId: "/expressjs/express"` and `query: "routing middleware"` → assert results contain relevant documentation
      6. Shut down server
      7. Clean up temp DB and cloned repo
    - Test with versioned query if express has tags
    - Test error cases: query with non-existent library, empty query

  **Must NOT do**:
  - NO performance benchmarks
  - NO load testing
  - NO testing of every preset library (just one real repo for E2E)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Full-stack integration test coordinating DB, server, and HTTP client
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential — needs all prior tasks)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 6, 7

  **References**:

  **Pattern References**:
  - All prior source files — this test exercises every component

  **WHY Each Reference Matters**:
  - This is the final verification that all components work together correctly

  **Acceptance Criteria**:
  - [ ] Test file: `tests/e2e/full-roundtrip.test.ts`
  - [ ] `bun test tests/e2e/full-roundtrip.test.ts` → PASS
  - [ ] Full flow works: ingest → start server → resolve-library-id → query-docs → results
  - [ ] `bun test` → ALL tests pass (full suite)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Full roundtrip with real Express docs
    Tool: Bash
    Preconditions: All prior tasks completed, internet available for git clone
    Steps:
      1. Run: bun test tests/e2e/full-roundtrip.test.ts --timeout 60000
      2. Assert: exit code 0
      3. Assert: resolve-library-id found express
      4. Assert: query-docs returned documentation about routing/middleware
    Expected Result: Complete pipeline works end-to-end
    Evidence: Terminal output captured

  Scenario: Full test suite passes
    Tool: Bash
    Steps:
      1. Run: bun test
      2. Assert: exit code 0
      3. Assert: 0 failures
    Expected Result: All unit, integration, and E2E tests pass
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `test(e2e): add end-to-end integration tests with real Express docs`
  - Files: `tests/e2e/full-roundtrip.test.ts`
  - Pre-commit: `bun test`

---

- [x] 10. Deployment Documentation + OpenCode Config + README

  **What to do**:
  - Create `opencode.json` example config:
    ```json
    {
      "$schema": "https://opencode.ai/config.json",
      "mcp": {
        "context7-local": {
          "type": "remote",
          "url": "http://YOUR_SERVER_IP:3000/mcp",
          "enabled": true,
          "oauth": false
        }
      }
    }
    ```
  - Create `README.md` with sections:
    1. **Overview** — what this is and why it exists
    2. **Quick Start** — 5-step setup (install Bun, clone, build, ingest, run)
    3. **Ingestion** — how to use the CLI to download library docs
       - Single library: `bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db --version v14.0.0`
       - Using presets: `bun run src/cli/index.ts ingest --preset react --db docs.db`
       - All presets: `bun run src/cli/index.ts ingest --preset-all --db docs.db`
       - Custom docs path: `bun run src/cli/index.ts ingest https://github.com/my/repo --docs-path "documentation/**/*.md" --db docs.db`
    4. **Running the Server** — HTTP and stdio modes
       - HTTP: `bun run src/server/index.ts --transport http --port 3000 --db docs.db`
       - stdio: `bun run src/server/index.ts --transport stdio --db docs.db`
    5. **OpenCode Configuration** — how to add to `opencode.json` (remote HTTP + local stdio examples)
    6. **Air-Gapped Deployment Guide**:
       - Step 1: On an internet-connected machine, install Bun and clone this repo
       - Step 2: Run `bun install` to download dependencies
       - Step 3: Ingest the libraries you need into `docs.db`
       - Step 4: Build standalone binary: `bun build --compile src/server/index.ts --outfile context7-local`
       - Step 5: Transfer `context7-local` binary + `docs.db` to air-gapped server
       - Step 6: Run: `./context7-local --transport http --port 3000 --db /path/to/docs.db`
       - Step 7: Configure OpenCode on developer machines to point to `http://server:3000/mcp`
    7. **Adding New Libraries** — how to add custom libraries to the registry
    8. **Known Limitations** — keyword search only (no semantic), RST docs have lower quality, etc.
  - Add `bin` entry to `package.json`: `"bin": { "context7-local": "src/server/index.ts", "context7-ingest": "src/cli/index.ts" }`
  - Update `package.json` `"scripts"`: `"start": "bun run src/server/index.ts --transport http", "ingest": "bun run src/cli/index.ts"` 
  - Test: `bun build --compile src/server/index.ts --outfile /tmp/context7-local-test` → binary exists and runs

  **Must NOT do**:
  - NO Docker/container config (user has Bun available)
  - NO CI/CD config
  - NO changelog
  - NO contributing guide

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation-focused task
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Task 9)
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:

  **Pattern References**:
  - OpenCode MCP docs: `https://opencode.ai/docs/mcp-servers/` — Exact config format for local + remote MCP servers, including Context7 example
  - Context7 OpenCode config example from docs: `{"type": "remote", "url": "https://mcp.context7.com/mcp"}` — we replace URL with local server

  **WHY Each Reference Matters**:
  - OpenCode config format must be exact (`type`, `url`, `enabled`, `oauth: false`) or it won't connect
  - The air-gapped deployment guide is the most critical deliverable for the user's use case

  **Acceptance Criteria**:
  - [ ] `README.md` exists with all 8 sections
  - [ ] `opencode.json` exists with valid config
  - [ ] `bun build --compile src/server/index.ts --outfile /tmp/context7-local-test` → binary created
  - [ ] `/tmp/context7-local-test --help` → shows usage information
  - [ ] All deployment steps documented clearly

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Standalone binary compiles and runs
    Tool: Bash
    Preconditions: All prior tasks completed
    Steps:
      1. Run: bun build --compile src/server/index.ts --outfile /tmp/context7-local-test
      2. Assert: file /tmp/context7-local-test exists
      3. Run: /tmp/context7-local-test --help
      4. Assert: output contains "--transport", "--port", "--db"
      5. Clean up: rm /tmp/context7-local-test
    Expected Result: Standalone binary works without Bun installed
    Evidence: Terminal output captured

  Scenario: OpenCode config is valid JSON
    Tool: Bash
    Steps:
      1. Run: bun -e "const c = require('./opencode.json'); console.log(c.mcp['context7-local'].type)"
      2. Assert: output is "remote"
    Expected Result: Config file is valid and parseable
    Evidence: Terminal output captured

  Scenario: README covers all deployment steps
    Tool: Bash
    Steps:
      1. Run: grep -c "##" README.md
      2. Assert: at least 8 sections
      3. Run: grep -q "air-gapped\|Air-Gapped\|Air-gapped" README.md
      4. Assert: exit code 0 (air-gapped deployment section exists)
      5. Run: grep -q "opencode.json\|opencode\.json" README.md
      6. Assert: exit code 0 (OpenCode config documented)
    Expected Result: README is comprehensive
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `docs: add deployment guide, OpenCode config, and README for air-gapped setup`
  - Files: `README.md, opencode.json, package.json`
  - Pre-commit: `bun test`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 0 | `feat(project): initialize project and validate Bun+Express+MCP+FTS5 compatibility` | package.json, tsconfig.json, tests/smoke.test.ts | `bun test tests/smoke.test.ts` |
| 1 | `feat(db): add SQLite schema with FTS5 full-text search and connection management` | src/db/*, tests/db/schema.test.ts | `bun test tests/db/schema.test.ts` |
| 2 | `feat(scraper): add markdown parser and heading-aware document chunker` | src/scraper/markdown.ts, src/scraper/chunker.ts, tests/scraper/* | `bun test tests/scraper/` |
| 3 | `feat(core): implement search queries and MCP tool handlers` | src/db/queries.ts, src/server/tools.ts, tests/* | `bun test tests/db/ tests/server/tools.test.ts` |
| 4 | `feat(scraper): add GitHub repo cloning and ingestion pipeline` | src/scraper/github.ts, src/cli/ingest.ts, tests/* | `bun test tests/scraper/ tests/cli/` |
| 5 | `feat(server): add response formatting matching Context7 output` | src/server/format.ts, tests/server/format.test.ts | `bun test tests/server/format.test.ts` |
| 6 | `feat(cli): add CLI with ingest, list, remove, preview commands` | src/cli/index.ts, tests/cli/cli.test.ts | `bun test tests/cli/` |
| 7 | `feat(server): add MCP server with HTTP and stdio transport` | src/server/index.ts, tests/server/integration.test.ts | `bun test tests/server/` |
| 8 | `feat(cli): add library presets for web and Python frameworks` | data/presets.json, src/cli/presets.ts | `bun test tests/cli/presets.test.ts` |
| 9 | `test(e2e): add end-to-end integration tests` | tests/e2e/full-roundtrip.test.ts | `bun test` |
| 10 | `docs: add deployment guide and OpenCode config for air-gapped setup` | README.md, opencode.json | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
bun test
# Expected: 0 failures, 50+ tests pass

# Server starts and responds
timeout 10 bun run src/server/index.ts --transport http --port 3000 --db docs.db &
curl -sf http://localhost:3000/ping | jq .status
# Expected: "ok"

# MCP initialize works
curl -sf http://localhost:3000/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
# Expected: {"result":{"serverInfo":{"name":"context7-local",...}}}

# Standalone binary compiles
bun build --compile src/server/index.ts --outfile context7-local
./context7-local --help
# Expected: Shows usage with --transport, --port, --db options
```

### Final Checklist
- [x] All "Must Have" present (tool names, parameters, format, transports, versioning, presets, shutdown)
- [x] All "Must NOT Have" absent (no web UI, no auth, no vector search, no abstractions, no mocking)
- [x] All tests pass (`bun test` exit code 0)
- [x] MCP server connects to OpenCode via HTTP
- [x] Standalone binary compiles for air-gapped deployment
- [x] README documents complete air-gapped deployment workflow
