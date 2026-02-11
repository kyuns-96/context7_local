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

## 10. Reranking

`local_context7` includes a reranking system that significantly improves search precision by re-scoring candidate documents using cross-encoder models.

### What is Reranking?
Standard vector search (semantic search) uses "bi-encoders" to find candidate documents. While fast, bi-encoders can sometimes miss subtle nuances. Reranking uses more powerful "cross-encoders" to evaluate the specific relationship between your query and each candidate document, ensuring the most relevant results appear at the top.

### How It Works
1.  **Retrieval**: The system retrieves the top 100 candidate documents using the selected search mode (keyword, semantic, or hybrid).
2.  **Reranking**: The reranker re-scores these 100 candidates based on their actual relevance to the query.
3.  **Selection**: The top 10 most relevant documents (after reranking) are returned to the AI.

### Providers

#### NoOp (Default)
- **Name**: `none`
- **Behavior**: Pass-through; returns documents in their original retrieval order.
- **Cost**: Free
- **Air-gap compatible**: Yes

#### Local Reranker
- **Model**: `cross-encoder/ms-marco-MiniLM-L-6-v2` (~80MB)
- **Features**: High accuracy, runs entirely on your local machine.
- **Cost**: Free
- **Air-gap compatible**: Yes
- **Performance**: ~200ms for 100 documents.

#### Cohere Reranker
- **Model**: `rerank-english-v3.0`
- **Features**: State-of-the-art reranking quality via API.
- **Cost**: ~$2 per 1000 requests.
- **Air-gap compatible**: No
- **Performance**: ~100ms + network latency.

#### Jina AI Reranker
- **Model**: `jina-reranker-v1-base-en`
- **Features**: Excellent balance of performance and cost via API.
- **Cost**: ~$0.02 per 1000 requests.
- **Air-gap compatible**: No
- **Performance**: ~150ms + network latency.

### Configuration

**Via CLI Flags:**
```bash
# Using local reranker (recommended for privacy/offline)
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --reranking-provider local

# Using Cohere reranker
export RERANKING_API_KEY=co-...
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --reranking-provider cohere
```

**Via Environment Variables:**
```bash
export RERANKING_PROVIDER=local
export RERANKING_API_KEY=your-key-if-needed
export RERANKING_MODEL=custom-model-name  # optional
bun run src/cli/index.ts ingest ...
```

**Integration Note**: Reranking is optional for tool calls. Use the `useReranking` parameter (default: `false`) in the `query-docs` MCP tool to enable it dynamically.

### Provider Comparison

| Feature | NoOp | Local | Cohere | Jina AI |
|---------|------|-------|--------|---------|
| Precision Improvement | 0% | 15-25% | 20-30% | 18-28% |
| Air-gap Compatible | Yes | Yes | No | No |
| Cost | Free | Free | ~$2/1k req | ~$0.02/1k req |
| Latency | <1ms | ~200ms | ~100ms+ | ~150ms+ |
| Model Size | N/A | ~80MB | N/A | N/A |

### Expected Improvements
Based on MS MARCO benchmarks, enabling reranking typically yields:
- **Precision@1**: 70% → 85-92% (+15-22%)
- **Precision@5**: 60% → 75-85% (+15-25%)
- **Overall Quality**: Significantly fewer "hallucinations" caused by irrelevant context.

## 11. Configuration File

Instead of specifying embedding and reranking settings via CLI flags every time, you can create a configuration file once and reference it with a simple `--config` flag.

### Why Use a Configuration File?

**Without config file** (8+ flags to remember):
```bash
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --embedding-provider openai \
  --embedding-api-key sk-... \
  --embedding-model text-embedding-3-small \
  --embedding-api-url https://api.openai.com/v1/embeddings \
  --reranking-provider cohere \
  --reranking-api-key co-... \
  --reranking-model rerank-english-v3.0 \
  --reranking-api-url https://api.cohere.ai/v1/rerank
```

**With config file** (much simpler):
```bash
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --config config.json
```

### File Structure

Create a `config.json` file in your project root with your provider settings:

```json
{
  "embedding": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "text-embedding-3-small",
    "apiUrl": "https://api.openai.com/v1/embeddings"
  },
  "reranking": {
    "provider": "cohere",
    "apiKey": "co-...",
    "model": "rerank-english-v3.0",
    "apiUrl": "https://api.cohere.ai/v1/rerank"
  }
}
```

**All fields are optional.** You can configure just embedding, just reranking, or both. Omit fields to use defaults.

**Minimal example** (use OpenAI with defaults):
```json
{
  "embedding": {
    "provider": "openai",
    "apiKey": "sk-..."
  }
}
```

**Air-gapped example** (local providers only):
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

### Default Paths

If you don't specify `--config`, the system automatically checks these locations:
1. `./config.json` (current directory)
2. `./local_context7.config.json` (current directory)

If neither file exists, the system continues without error and uses CLI flags, environment variables, or defaults.

### Usage Examples

**Basic usage:**
```bash
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --config config.json
```

**Custom config path:**
```bash
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --config /path/to/my-config.json
```

**Override specific settings:**
```bash
# Use config.json for most settings, but override embedding provider for this run
bun run src/cli/index.ts ingest https://github.com/vercel/next.js \
  --db docs.db \
  --config config.json \
  --embedding-provider local  # Overrides config file
```

**Automatic config discovery:**
```bash
# If config.json exists in current directory, it's loaded automatically
bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db
```

### Priority Order

Settings are merged in this priority order (highest to lowest):

1. **CLI flags** (highest priority)
2. **Config file** (`--config` or auto-discovered)
3. **Environment variables** (`EMBEDDING_PROVIDER`, etc.)
4. **Defaults** (lowest priority)

This means you can set baseline configuration in a file, but still override individual settings via CLI flags when needed.

### Configuration Options Reference

| Config Field | Valid Values | Default | Description |
|--------------|--------------|---------|-------------|
| `embedding.provider` | `local`, `openai` | `local` | Embedding service to use |
| `embedding.apiKey` | string | - | API key (required for `openai`) |
| `embedding.model` | string | See provider docs | Model name override |
| `embedding.apiUrl` | URL | Provider default | Custom API endpoint |
| `reranking.provider` | `none`, `local`, `cohere`, `jina` | `none` | Reranker to use |
| `reranking.apiKey` | string | - | API key (required for API providers) |
| `reranking.model` | string | See provider docs | Model name override |
| `reranking.apiUrl` | URL | Provider default | Custom API endpoint |

### Security Notes

**IMPORTANT: Protect your API keys**

1. **Never commit real API keys to version control.**
   - `config.json` and `local_context7.config.json` are already in `.gitignore`
   - Use `config.example.json` (included) as a template for version control

2. **Use environment-specific config files:**
   ```bash
   # Development
   cp config.example.json config.dev.json
   # Edit config.dev.json with dev API keys
   
   # Production
   cp config.example.json config.prod.json
   # Edit config.prod.json with prod API keys
   
   # Add to .gitignore
   echo "config.*.json" >> .gitignore
   ```

3. **For shared repositories, document config structure without keys:**
   - Commit `config.example.json` with placeholder values
   - Document required fields in README (this section)
   - Never commit files with actual API keys

4. **Rotate keys immediately if exposed:**
   - OpenAI: https://platform.openai.com/api-keys
   - Cohere: https://dashboard.cohere.com/api-keys
   - Jina: https://jina.ai/api-keys

### Example: Team Setup

**Step 1**: Create `config.example.json` (safe to commit):
```json
{
  "embedding": {
    "provider": "openai",
    "apiKey": "YOUR_OPENAI_API_KEY_HERE",
    "model": "text-embedding-3-small"
  },
  "reranking": {
    "provider": "cohere",
    "apiKey": "YOUR_COHERE_API_KEY_HERE"
  }
}
```

**Step 2**: Team members copy and fill in real keys:
```bash
cp config.example.json config.json
# Edit config.json with your actual API keys
```

**Step 3**: Use consistently across all commands:
```bash
bun run src/cli/index.ts ingest --preset react --db docs.db --config config.json
bun run src/cli/index.ts vectorize --db docs.db --config config.json
```

### Supported Commands

The `--config` flag is supported by these CLI commands:
- `ingest`: Ingest documentation with embedding/reranking settings
- `vectorize`: Generate embeddings using config file settings

## 12. Known Limitations

- **Embedding Model Size**: The vector search model is ~23MB. It downloads automatically on first use and is cached locally.
- **Embeddings Optional**: Vector search requires embeddings. Keyword search works without them.
- **RST Documentation**: Python libraries using reStructuredText (.rst) may have lower formatting quality compared to Markdown.
- **GitHub Markdown**: Only parses Markdown files found in the repository. It does not crawl external websites or scrape HTML.
- **No Authentication**: The HTTP server does not currently include authentication or rate limiting. It is intended for use within trusted private networks.
