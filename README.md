# local_context7

Efficient, local Model Context Protocol (MCP) server for searching library documentation. Designed for air-gapped environments and high-performance local development.

## 1. Overview

`local_context7` is a specialized MCP server that allows AI assistants (like Claude or OpenCode) to query programming library documentation directly from your local machine. 

### Why local_context7?
- **Air-Gapped Ready**: Once libraries are ingested, no internet connection is required.
- **Privacy**: Your documentation queries stay on your local network or machine.
- **Performance**: High-speed keyword search using SQLite FTS5.
- **Customizable**: Ingest any GitHub repository's markdown documentation.

Compared to the cloud-based Context7, this local version gives you full control over the registry and ensures availability in restricted environments.

## 2. Quick Start

Get up and running in 5 steps:

1.  **Install Bun**: Ensure you have [Bun](https://bun.sh) installed (v1.3.8+).
2.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-org/local_context7.git
    cd local_context7
    ```
3.  **Install Dependencies**:
    ```bash
    bun install
    ```
4.  **Ingest a Library**:
    ```bash
    bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db
    ```
5.  **Run the Server**:
    ```bash
    bun run src/server/index.ts --transport http --port 3000 --db docs.db
    ```

## 3. Ingestion

The CLI allows you to download and index documentation from GitHub.

### Single Library
Ingest a specific repository with optional version and custom docs path:
```bash
bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db --version v14.0.0
```

### Using Presets
Ingest a library using a pre-configured shortcut:
```bash
bun run src/cli/index.ts ingest --preset react --db docs.db
```

### Ingest All Presets
Populate your database with all 20+ pre-configured libraries:
```bash
bun run src/cli/index.ts ingest --preset-all --db docs.db
```

### Custom Documentation Path
If the documentation is not in the root or `/docs`, specify it manually:
```bash
bun run src/cli/index.ts ingest https://github.com/my/repo --docs-path "documentation/**/*.md" --db docs.db
```

### Utilities
- **List ingested libraries**: `bun run src/cli/index.ts list --db docs.db`
- **Remove a library**: `bun run src/cli/index.ts remove /org/project --db docs.db`
- **Preview ingestion**: `bun run src/cli/index.ts preview https://github.com/my/repo`
- **Generate embeddings**: `bun run src/cli/index.ts vectorize --db docs.db`

## 4. Running the Server

The server supports two transport modes for different use cases.

### HTTP Mode (Shared Server)
Ideal for team-wide access or shared infrastructure.
```bash
bun run src/server/index.ts --transport http --port 3000 --db docs.db
```
Access the MCP endpoint at `http://localhost:3000/mcp`.

### Stdio Mode (Local Development)
Ideal for single-user local setups where the AI client manages the process life-cycle.
```bash
bun run src/server/index.ts --transport stdio --db docs.db
```

## 5. OpenCode Configuration

Add `local_context7` to your `opencode.json` configuration file.

### Shared Server (Remote HTTP)
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

### Developer Machine (Local Stdio)
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7-local": {
      "type": "local",
      "command": "bun",
      "args": ["run", "/absolute/path/to/src/server/index.ts", "--transport", "stdio", "--db", "/absolute/path/to/docs.db"],
      "enabled": true
    }
  }
}
```

## 6. Air-Gapped Deployment Guide

Follow these steps to deploy `local_context7` in a network-restricted environment:

1.  **Preparation**: On an internet-connected machine, install Bun and clone the repository.
2.  **Dependencies**: Run `bun install` to download all necessary packages.
3.  **Embedding Model**: Run any command that triggers embedding generation (like `vectorize` or `ingest`) to download the `Xenova/all-MiniLM-L6-v2` model (~23MB). The model is cached in the `~/.cache` directory.
4.  **Data Ingestion**: Download the documentation you need:
    ```bash
    bun run src/cli/index.ts ingest --preset-all --db docs.db
    ```
5.  **Build Binary**: Compile a standalone executable for the target server:
    ```bash
    bun build --compile src/server/index.ts --outfile context7-local
    ```
6.  **Transfer**: Copy the following to your air-gapped server:
    - The `context7-local` binary
    - The `docs.db` file
    - The cached model files from `~/.cache/onnxruntime` and `~/.cache/huggingface` (or ensure they are reachable by the binary)
7.  **Startup**: Run the server on the air-gapped machine:
    ```bash
    ./context7-local --transport http --port 3000 --db /path/to/docs.db
    ```
8.  **Client Config**: Configure OpenCode on developer machines to point to the server's IP: `http://server:3000/mcp`.

**Note on Embedding Providers**: Air-gapped deployments must use the local embedding provider (default). External API providers (like OpenAI) require active internet connections and are not compatible with air-gapped environments.

## 7. Adding New Libraries

To add new library shortcuts to the registry, edit `data/presets.json`:

```json
{
  "new-lib": {
    "repo": "https://github.com/org/repo",
    "docsPath": "path/to/docs",
    "title": "Friendly Name",
    "description": "Short description of the library"
  }
}
```

Once added, you can use `bun run src/cli/index.ts ingest --preset new-lib --db docs.db`.

## 8. Vector Search (Semantic Search)

`local_context7` supports semantic search using vector embeddings, allowing you to find relevant documentation based on meaning rather than just keyword matches.

### How It Works
- Embeddings are automatically generated during ingestion using the `Xenova/all-MiniLM-L6-v2` model (~23MB).
- Documents are converted to 384-dimensional vectors.
- Queries are matched using cosine similarity.
- No internet required after the model is downloaded once and cached locally.

### Search Modes
The `query-docs` tool supports three search modes through the `searchMode` parameter:

1.  **keyword**: Traditional full-text search (FTS5).
2.  **semantic**: Vector similarity search (requires embeddings).
3.  **hybrid**: Combined approach (30% keyword rank + 70% semantic similarity) - **default**.

### Using Search Modes in Queries
When using the `query-docs` tool, you can specify the `searchMode` parameter. If omitted, it defaults to `hybrid`.

**Example (MCP Tool Call):**
```json
{
  "name": "query-docs",
  "arguments": {
    "libraryId": "/vercel/next.js",
    "query": "how to use server components",
    "searchMode": "semantic"
  }
}
```

### Generating Embeddings
Embeddings are generated automatically during standard ingestion:
```bash
bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db
```

### Regenerating Embeddings
Use the `vectorize` command to add embeddings to existing data or regenerate them after a model update:

```bash
# Generate embeddings for all snippets that don't have them
bun run src/cli/index.ts vectorize --db docs.db

# Regenerate for a specific library
bun run src/cli/index.ts vectorize --db docs.db --library-id /vercel/next.js

# Force regeneration for all snippets (even if embeddings already exist)
bun run src/cli/index.ts vectorize --db docs.db --force
```

### Performance Characteristics
- **Model Loading**: ~100ms on first use.
- **Query Embedding**: ~50ms per query.
- **Search Latency**: Similar to keyword search (<100ms).
- **Storage Overhead**: ~1.5KB per document chunk for embedding data.

## 9. Embedding Providers

`local_context7` supports multiple embedding providers, allowing you to choose between offline local models and online API services.

### Local Provider (Default)
- **Model**: Xenova/all-MiniLM-L6-v2
- **Dimensions**: 384
- **Cost**: Free
- **Requirements**: No internet after initial model download (~23MB)
- **Air-gap compatible**: Yes
- **Performance**: ~50ms per embedding

The local provider is ideal for air-gapped environments, privacy-sensitive deployments, and cost-conscious users.

### OpenAI Provider
- **Models**: text-embedding-3-small (1536d), text-embedding-3-large (3072d)
- **Cost**: Pay per token (requires OpenAI API key)
- **Requirements**: Active internet connection
- **Air-gap compatible**: No
- **Performance**: Network latency dependent

The OpenAI provider offers higher-quality embeddings for production deployments with internet access.

### Configuration

**Via CLI Flags:**
```bash
# Using OpenAI provider
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --embedding-provider openai \
  --embedding-api-key sk-... \
  --embedding-model text-embedding-3-small

# Using local provider (default)
bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db
```

**Via Environment Variables:**
```bash
export EMBEDDING_PROVIDER=openai
export EMBEDDING_API_KEY=sk-...
export EMBEDDING_MODEL=text-embedding-3-small  # optional
bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db
```

**Precedence**: CLI flags > environment variables > defaults

### Provider Comparison

| Feature | Local Provider | OpenAI Provider |
|---------|----------------|-----------------|
| Model | Xenova/all-MiniLM-L6-v2 | text-embedding-3-small/large |
| Dimensions | 384 | 1536 or 3072 |
| Cost | Free | Pay per token |
| Internet Required | Only for initial download | Yes, for every request |
| Air-gap Compatible | Yes | No |
| Performance | ~50ms per embedding | Network dependent |
| Quality | Good | Excellent |

### Security Notes

**IMPORTANT**: Never commit API keys to source control.

- Use environment variables for server deployments
- Use CLI flags for one-off commands
- Add `.env` to `.gitignore` if using dotenv files
- Rotate API keys if accidentally exposed

## 10. Known Limitations

- **Embedding Model Size**: The vector search model is ~23MB. It downloads automatically on first use and is cached locally.
- **Embeddings Optional**: Vector search requires embeddings. Keyword search works without them.
- **RST Documentation**: Python libraries using reStructuredText (.rst) may have lower formatting quality compared to Markdown.
- **GitHub Markdown**: Only parses Markdown files found in the repository. It does not crawl external websites or scrape HTML.
- **No Authentication**: The HTTP server does not currently include authentication or rate limiting. It is intended for use within trusted private networks.
