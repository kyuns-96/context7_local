# local_context7

Local MCP server for searching library documentation. Works offline, runs on SQLite, supports 30 preset libraries.

## Overview

`local_context7` lets AI assistants (Claude Code, OpenCode, etc.) query programming library docs from your local machine via the [Model Context Protocol](https://modelcontextprotocol.io/).

- **Offline**: No internet after initial ingestion
- **Private**: Queries never leave your machine
- **Fast**: SQLite FTS5 keyword search + LSH-accelerated vector search
- **Flexible**: Ingest any GitHub repo with Markdown, MDX, or reStructuredText docs

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3.8+

### Install & Run

```bash
git clone https://github.com/kyuns-96/context7_local.git
cd context7_local
bun install

# Ingest a library
bun run src/cli/index.ts ingest --preset react --db docs.db

# Start the server
bun run src/server/index.ts --transport http --port 3000 --db docs.db
```

### Pre-built Databases

Skip ingestion by downloading pre-built databases from [Releases](https://github.com/kyuns-96/context7_local/releases):

```bash
# Domain-specific (v1.0.7) — download only what you need
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.7/frontend.db.tar.gz | tar -xz
mv frontend.db docs.db

# Monolithic (v1.0.6) — all 198 libraries, 604K snippets
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.6/docs-v1.0.6.db.tar.gz | tar -xz
mv docs-v1.0.6.db docs.db
```

**Split databases (v1.0.7)**: frontend (286MB), backend (414MB), mobile (103MB), devops (106MB), ai-ml (48MB), data (364MB), system (219MB), security (95MB)

---

## Client Configuration

### OpenCode

Add to your project-level `opencode.json` or global `~/.config/opencode/opencode.json`:

**Remote (shared server):**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7-local": {
      "type": "remote",
      "url": "http://YOUR_SERVER_IP:3000/mcp",
      "enabled": true
    }
  }
}
```

**Local (stdio, per-developer):**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7-local": {
      "type": "local",
      "command": [
        "bun", "run",
        "/absolute/path/to/local_context7/src/server/index.ts",
        "--transport", "stdio",
        "--db", "/absolute/path/to/docs.db"
      ],
      "enabled": true
    }
  }
}
```

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "context7-local": {
      "command": "bun",
      "args": [
        "run",
        "/absolute/path/to/local_context7/src/server/index.ts",
        "--transport", "stdio",
        "--db", "/absolute/path/to/docs.db"
      ]
    }
  }
}
```

Or for a remote HTTP server, use the [MCP plugin](https://modelcontextprotocol.io/clients) configuration for your client.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "context7-local": {
      "command": "bun",
      "args": [
        "run",
        "/absolute/path/to/local_context7/src/server/index.ts",
        "--transport", "stdio",
        "--db", "/absolute/path/to/docs.db"
      ]
    }
  }
}
```

---

## Ingestion

### Presets

30 pre-configured libraries with automatic version selection:

```bash
# Single preset (auto-selects latest version, e.g. React v19.2.4)
bun run src/cli/index.ts ingest --preset react --db docs.db

# Override version
bun run src/cli/index.ts ingest --preset react --version v18.0.0 --db docs.db

# All 30 presets (each uses its own latest version)
bun run src/cli/index.ts ingest --preset-all --db docs.db
```

<details>
<summary>All 30 presets</summary>

**JS/TS & Frontend**

| Preset | Library | Latest Version |
|--------|---------|----------------|
| `react` | React | v19.2.4 |
| `nextjs` | Next.js | v16.1.6 |
| `typescript` | TypeScript | v5.9.3 |
| `nodejs` | Node.js | v25.7.0 |
| `express` | Express.js | _(latest)_ |
| `vue` | Vue.js | _(latest)_ |
| `angular` | Angular | 21.1.5 |
| `svelte` | Svelte | svelte@5.53.3 |
| `tailwindcss` | Tailwind CSS | v4.2.1 |
| `prisma` | Prisma | 7.4.1 |

**Python**

| Preset | Library | Latest Version |
|--------|---------|----------------|
| `django` | Django | 6.0.2 |
| `flask` | Flask | 3.1.3 |
| `fastapi` | FastAPI | 0.133.0 |
| `sqlalchemy` | SQLAlchemy | rel_2_0_47 |
| `pydantic` | Pydantic | v2.12.0 |
| `celery` | Celery | v5.6.2 |
| `pytest` | Pytest | 9.0.2 |
| `numpy` | NumPy | v2.4.2 |
| `pandas` | Pandas | v3.0.1 |
| `requests` | Requests | v2.32.5 |

**Languages**

| Preset | Library | Latest Version |
|--------|---------|----------------|
| `rust-book` | The Rust Programming Language | _(latest)_ |
| `dotnet` | .NET | _(latest)_ |
| `rails` | Ruby on Rails | v8.1.2 |
| `laravel` | Laravel | 12.x |
| `swift` | Swift | swift-6.2.3-fcs |
| `kotlin` | Kotlin | _(latest)_ |

**DevOps**

| Preset | Library | Latest Version |
|--------|---------|----------------|
| `docker` | Docker | _(latest)_ |
| `kubernetes` | Kubernetes | v1.35 |
| `ansible` | Ansible | v2.20.3 |
| `helm` | Helm | _(latest)_ |

</details>

### Custom Repositories

```bash
# Basic
bun run src/cli/index.ts ingest https://github.com/org/repo --db docs.db

# With version and docs path
bun run src/cli/index.ts ingest https://github.com/org/repo \
  --version v2.0.0 \
  --docs-path docs \
  --db docs.db
```

`--docs-path` accepts directories, single files, or glob patterns:

```bash
--docs-path docs                          # directory (recursive)
--docs-path "documentation/**/*.md"       # glob
--docs-path "packages/core/README.md"     # single file
```

### Management Commands

```bash
# List ingested libraries
bun run src/cli/index.ts list --db docs.db

# Remove a library
bun run src/cli/index.ts remove /org/repo --db docs.db

# Preview without ingesting
bun run src/cli/index.ts preview https://github.com/org/repo

# Generate/regenerate embeddings
bun run src/cli/index.ts vectorize --db docs.db
bun run src/cli/index.ts vectorize --db docs.db --library-id /vercel/next.js --force
```

---

## Server

### Transport Modes

```bash
# HTTP (shared server, team access)
bun run src/server/index.ts --transport http --port 3000 --db docs.db

# Stdio (local, managed by AI client)
bun run src/server/index.ts --transport stdio --db docs.db
```

HTTP endpoint: `http://localhost:3000/mcp`
Health check: `http://localhost:3000/ping`

### Standalone Binary

```bash
bun build --compile src/server/index.ts --outfile context7-local
./context7-local --transport http --port 3000 --db docs.db
```

### MCP Tools

**`resolve-library-id`** — Find a library by name, returns Context7-compatible ID.

**`query-docs`** — Search documentation for a library.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `libraryId` | string | _(required)_ | Library ID from `resolve-library-id` |
| `query` | string | _(required)_ | Search query |
| `searchMode` | `keyword` \| `semantic` \| `hybrid` | `hybrid` | Search strategy |
| `topK` | 1-50 | 10 | Max results |
| `useReranking` | boolean | false | Apply reranker |

```json
{
  "name": "query-docs",
  "arguments": {
    "libraryId": "/vercel/next.js",
    "query": "how to use server components",
    "searchMode": "hybrid",
    "topK": 10
  }
}
```

---

## Search Modes

### Keyword (FTS5)

Full-text search using SQLite FTS5. Fast, no embeddings required.

### Semantic (Vector)

Cosine similarity on 384-dimensional embeddings (`Xenova/all-MiniLM-L6-v2`). Uses LSH (Locality-Sensitive Hashing) with 4-band pre-filtering for ~95% fewer comparisons on large libraries.

### Hybrid (Default)

Combined ranking: 30% keyword score + 70% semantic similarity. Best overall relevance.

---

## Embedding Providers

| | Local (default) | OpenAI |
|--|--|--|
| Model | Xenova/all-MiniLM-L6-v2 | text-embedding-3-small/large |
| Dimensions | 384 | 1536 / 3072 |
| Cost | Free | Pay per token |
| Offline | Yes (after first download) | No |
| Speed | ~50ms/embedding | Network dependent |

### Configuration

```bash
# Local (default, no config needed)
bun run src/cli/index.ts ingest --preset react --db docs.db

# OpenAI
bun run src/cli/index.ts ingest --preset react --db docs.db \
  --embedding-provider openai \
  --embedding-api-key sk-...
```

Or via environment variables:

```bash
export EMBEDDING_PROVIDER=openai
export EMBEDDING_API_KEY=sk-...
```

Or via config file (`config.json`):

```json
{
  "embedding": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "text-embedding-3-small"
  }
}
```

```bash
bun run src/cli/index.ts ingest --preset react --db docs.db --config config.json
```

Priority: CLI flags > config file > environment variables > defaults.

---

## Reranking

Optional re-scoring of search results using cross-encoder models. Enable per-query with `useReranking: true`.

| Provider | Cost | Offline | Latency |
|----------|------|---------|---------|
| `none` (default) | Free | Yes | <1ms |
| `local` | Free | Yes | ~200ms |
| `cohere` | ~$2/1k req | No | ~100ms+ |
| `jina` | ~$0.02/1k req | No | ~150ms+ |

```bash
# Local reranker
bun run src/cli/index.ts ingest --preset react --db docs.db --reranking-provider local

# Cohere
RERANKING_API_KEY=co-... bun run src/cli/index.ts ingest --preset react --db docs.db --reranking-provider cohere
```

---

## Re-embedding

Switch embedding providers or regenerate after model updates:

```bash
# Interactive
./scripts/re-embed.sh

# Non-interactive
./scripts/re-embed.sh --provider openai --api-key sk-... --force

# Specific library
./scripts/re-embed.sh --provider local --library-id /vercel/next.js --force
```

Resume interrupted runs by omitting `--force` (skips already-embedded snippets).

---

## Air-Gapped Deployment

1. On an internet-connected machine:
   ```bash
   bun install
   bun run src/cli/index.ts ingest --preset-all --db docs.db
   bun build --compile src/server/index.ts --outfile context7-local
   ```

2. Transfer to the air-gapped server:
   - `context7-local` binary
   - `docs.db` database
   - Model cache from `~/.cache/onnxruntime` and `~/.cache/huggingface`

3. Run:
   ```bash
   ./context7-local --transport http --port 3000 --db docs.db
   ```

4. Configure clients to point to `http://server:3000/mcp`.

---

## Adding Custom Presets

Edit `data/presets.json`:

```json
{
  "my-lib": {
    "repo": "https://github.com/org/repo",
    "docsPath": "docs",
    "title": "My Library",
    "description": "Description of the library",
    "versions": ["v2.0.0", "v1.0.0"]
  }
}
```

The `versions` field is optional. When present, `versions[0]` is used automatically unless `--version` overrides it.

---

## Configuration File

Create `config.json` to avoid repeating CLI flags:

```json
{
  "embedding": {
    "provider": "local"
  },
  "reranking": {
    "provider": "local"
  }
}
```

Auto-discovered from `./config.json` or `./local_context7.config.json`. Or specify with `--config path/to/config.json`.

| Field | Values | Default |
|-------|--------|---------|
| `embedding.provider` | `local`, `openai` | `local` |
| `embedding.apiKey` | string | — |
| `embedding.model` | string | provider default |
| `embedding.apiUrl` | URL | provider default |
| `reranking.provider` | `none`, `local`, `cohere`, `jina` | `none` |
| `reranking.apiKey` | string | — |
| `reranking.model` | string | provider default |
| `reranking.apiUrl` | URL | provider default |

---

## Known Limitations

- **Embedding model**: ~23MB download on first use, cached locally
- **Embeddings optional**: Keyword search works without them
- **RST support**: Python docs using reStructuredText may have lower formatting quality than Markdown
- **GitHub only**: Parses docs from GitHub repos; does not crawl websites or HTML
- **No auth**: HTTP server has no authentication — intended for trusted networks
