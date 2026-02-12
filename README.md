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

### 🚀 Quick Download (Pre-built Database)

**Don't want to ingest libraries yourself?** Download our pre-built databases with comprehensive documentation coverage:

### Option 1: Domain-Specific Databases (v1.0.7 - Recommended for 2026 Updates)

Download only the domains you need with the **latest 2026 library versions** (React 19, Node.js 24/25, TypeScript 5.9, Next.js 15):

```bash
# Frontend development (React, Vue, Angular, Next.js, TypeScript) - 286MB
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.7/frontend.db.tar.gz | tar -xz
mv frontend.db docs.db
bun run src/server/index.ts --transport http --port 3000 --db docs.db

# Backend development (Node.js, Express, GraphQL, NestJS) - 414MB
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.7/backend.db.tar.gz | tar -xz

# Or download all 8 databases (1.6GB combined)
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.7/split-databases-v1.0.7.tar.gz | tar -xz
```

**8 Split Databases in v1.0.7**:
- **frontend.db** (286MB): React 19, Vue 3.5, Angular 19, Next.js 15, TypeScript 5.9, Svelte, UI frameworks
- **backend.db** (414MB): Node.js 24/25, Express, NestJS, GraphQL, Laravel, Rails, Django
- **mobile.db** (103MB): React Native, Flutter, Expo, Ionic, Swift, Kotlin
- **devops.db** (106MB): Docker, Kubernetes, Terraform, AWS, Azure, Google Cloud
- **ai-ml.db** (48MB): LangChain, OpenAI, Anthropic, TensorFlow, PyTorch
- **data.db** (364MB): MongoDB, PostgreSQL, Redis, Elasticsearch, Prisma, Vector DBs
- **system.db** (219MB): PowerShell, Windows Server, Ubuntu, Arch Linux, WSL
- **security.db** (95MB): Auth0, OAuth, Keycloak, NextAuth

**Latest 2026 Versions**: React 19.2.4, Node.js v24.13.1 LTS, Node.js v25.6.1, TypeScript 5.9.3, Next.js 15.5.12, Vue 3.5.28, Angular 19.2.17

See [Release v1.0.7](https://github.com/kyuns-96/context7_local/releases/tag/v1.0.7) for full details.

### Option 2: Monolithic Database (v1.0.6 - Maximum Coverage)

Download the comprehensive database with all 198 libraries (no 2026 updates):

```bash
# Download v1.0.6 - Maximum Capacity Edition (1.98GB compressed, 4.8GB uncompressed)
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.6/docs-v1.0.6.db.tar.gz | tar -xz

# Rename for convenience
mv docs-v1.0.6.db docs.db

# Run the server immediately
bun run src/server/index.ts --transport http --port 3000 --db docs.db
```

**Available Releases**:
- **v1.0.7** (Latest - 2026 Updates, Split Databases): 125 libraries (split), 498,589 snippets, 1.6GB combined
- **v1.0.6** (Maximum Capacity, Monolithic): 198 libraries, 604,053 snippets, 1.98GB compressed
- v1.0.5 (Version-Specific + Shell + OS): 158 libraries, 420,023 snippets, 1.35GB compressed
- v1.0.4 (AI Development): 160 libraries, 300,670 snippets, 969MB compressed
- v1.0.3 (Cloud+DevOps): 134 libraries, 268,831 snippets, 868MB compressed

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

## 9.5. Re-embedding in Different Environments

Once you've ingested documentation and created embeddings with one provider, you may want to switch to a different provider or environment. The `scripts/re-embed.sh` automation script makes this process seamless.

### Why Re-embed?

Common reasons to re-embed existing data:

1. **Environment Switch**: From development (local) to production (OpenAI), or vice versa
2. **Provider Change**: Switching from local to OpenAI for better quality, or from OpenAI to local for cost savings
3. **Model Update**: Using a newer embedding model for improved relevance
4. **Quality Improvement**: Re-embedding with a different provider to test quality improvements
5. **Library Update**: After ingesting a new version of a library, update its embeddings
6. **Air-gap Transition**: Moving from internet-connected to offline environment (use local provider)

### Quick Start

The easiest way to re-embed is using the provided automation script:

```bash
# Interactive mode (prompts for provider and settings)
./scripts/re-embed.sh

# Non-interactive mode with OpenAI
./scripts/re-embed.sh --provider openai --api-key sk-... --force

# Local provider (free, no API key needed)
./scripts/re-embed.sh --provider local --force

# Specific library only
./scripts/re-embed.sh --provider openai --api-key sk-... --library-id /vercel/next.js --force
```

### Using the Re-embedding Script

The `scripts/re-embed.sh` script provides a user-friendly interface for re-embedding with progress reporting, time estimation, and statistics.

#### Installation (First Time)

The script is included in the repository and is executable. If not already executable, run:
```bash
chmod +x scripts/re-embed.sh
```

#### Basic Usage

**Interactive Mode (Recommended):**
```bash
./scripts/re-embed.sh
```

The script will prompt you for:
1. Database path (default: `./docs.db`)
2. Embedding provider (1 for local, 2 for OpenAI)
3. OpenAI API key (if you choose OpenAI)
4. Library to re-embed (leave blank for all)
5. Force regeneration (yes/no)

**Command-Line Options:**
```bash
./scripts/re-embed.sh --provider local --force
./scripts/re-embed.sh --provider openai --api-key sk-... --force
./scripts/re-embed.sh --provider local --library-id /pytorch/pytorch --force
./scripts/re-embed.sh --db custom.db --provider local --force
```

**Configuration File:**
```bash
./scripts/re-embed.sh --config config.json --force
```

#### Script Options Reference

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--provider` | `-p` | string | `local` or `openai` | interactive |
| `--api-key` | `-k` | string | API key for external providers | from env |
| `--model` | `-m` | string | Model name (advanced) | provider default |
| `--library-id` | `-l` | string | Re-embed specific library only | all libraries |
| `--db` | `-d` | string | Database file path | `./docs.db` |
| `--config` | `-c` | string | Configuration file path | auto-detect |
| `--force` | `-f` | flag | Force regeneration even if embeddings exist | false |
| `--help` | `-h` | flag | Show detailed help | - |

#### Understanding Script Output

When you run the script, you'll see:

```
ℹ local_context7 - Re-embedding Automation Script

ℹ Checking embedding statistics...
✓ Total snippets in database: 244127
✓ Already embedded: 244127
✓ Need embedding: 0

ℹ Using local provider: Xenova/all-MiniLM-L6-v2
ℹ Estimated time to re-embed: 2h 15m

Configuration:
  Provider: local
  Force: Yes
  Snippets to process: 244127

Continue with re-embedding? (y/N): 
```

The script shows:
- **Statistics**: How many snippets need embeddings
- **Provider**: Which embedding provider will be used
- **Estimate**: Time required based on snippet count and provider
- **Progress**: Real-time progress during re-embedding
- **Results**: Embeddings created and time taken

### Use Cases and Examples

#### Scenario 1: Download Release and Re-embed with OpenAI

You've downloaded the pre-built database and want to use OpenAI embeddings instead:

```bash
# Download the release database
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.2/docs.db.tar.gz | tar -xz
mv docs-release.db docs.db

# Re-embed with OpenAI (requires API key)
./scripts/re-embed.sh --provider openai --api-key sk-... --force

# Verify embeddings
bun run src/cli/index.ts list --db docs.db
```

#### Scenario 2: Re-embed Single Library After Update

You've updated a library with `ingest` and want to ensure it has quality embeddings:

```bash
# Re-embed just the PyTorch library
./scripts/re-embed.sh \
  --provider openai \
  --api-key sk-... \
  --library-id /pytorch/pytorch \
  --force

# Verify the library's embeddings
bun run src/cli/index.ts list --db docs.db | grep pytorch
```

#### Scenario 3: Switch from OpenAI to Local (Cost Savings)

You've been using OpenAI but want to switch to the free local provider:

```bash
# Re-embed all libraries with local provider
./scripts/re-embed.sh --provider local --force

# No API key needed, runs completely offline
# Takes longer but saves costs
```

#### Scenario 4: Air-gapped Environment Setup

You're deploying to an air-gapped environment and need local embeddings:

```bash
# On internet-connected machine:
./scripts/re-embed.sh --provider local --force

# Transfer docs.db to air-gapped server
scp docs.db user@server:/path/to/

# Server can now run without internet
bun run src/server/index.ts --transport http --port 3000 --db docs.db
```

#### Scenario 5: Using Configuration File

Create a `config.json` for repeated re-embedding operations:

```json
{
  "embedding": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "text-embedding-3-small"
  }
}
```

Then use it:
```bash
./scripts/re-embed.sh --config config.json --force

# Or with environment variable
EMBEDDING_API_KEY=sk-... ./scripts/re-embed.sh --config config.json --force
```

### Manual Method: Using vectorize Command Directly

If you prefer not to use the automation script, you can use the `vectorize` CLI command directly:

```bash
# Re-embed all snippets with OpenAI
bun run src/cli/index.ts vectorize \
  --db docs.db \
  --embedding-provider openai \
  --embedding-api-key sk-... \
  --force

# Re-embed specific library
bun run src/cli/index.ts vectorize \
  --db docs.db \
  --library-id /vercel/next.js \
  --force

# Using local provider
bun run src/cli/index.ts vectorize --db docs.db --force
```

### Performance and Cost Considerations

#### Local Provider (Xenova/all-MiniLM-L6-v2)

| Metric | Value |
|--------|-------|
| **Time for 244k snippets** | 2-3 hours |
| **Cost** | Free |
| **Embedding dimensions** | 384 |
| **Requirements** | ~23MB model (cached) |
| **Best for** | Air-gapped, privacy, cost-sensitive |
| **Model size on disk** | ~1.5KB per embedding |

**When to use:**
- Air-gapped or offline environments
- Privacy is critical
- Cost is a concern
- Local-only deployments

#### OpenAI Provider (text-embedding-3-small)

| Metric | Value |
|--------|-------|
| **Time for 244k snippets** | 1-2 hours |
| **Cost** | ~$1-2 for full database |
| **Embedding dimensions** | 1536 |
| **Requirements** | API key + internet |
| **Best for** | Production, quality, speed |
| **Model size on disk** | ~1.5KB per embedding |

**When to use:**
- Production environments with internet access
- Higher embedding quality is needed
- Faster re-embedding is preferred
- Budget allows for minimal costs

**Cost estimation:**
```
OpenAI text-embedding-3-small:
- Cost: $0.02 per 1 million input tokens
- Average: 100 tokens per snippet
- 244k snippets × 100 tokens = 24.4M tokens
- Cost: $0.488 (less than $1)
```

**OpenAI text-embedding-3-large** (higher quality, ~3x cost):
```
- Cost: $0.06 per 1 million input tokens
- 244k snippets × 100 tokens = 24.4M tokens
- Cost: $1.46
```

### Advanced Configuration

#### Using Environment Variables

Instead of command-line flags, use environment variables for cleaner workflows:

```bash
export EMBEDDING_PROVIDER=openai
export EMBEDDING_API_KEY=sk-...
export EMBEDDING_MODEL=text-embedding-3-small

./scripts/re-embed.sh --force
```

Or inline:
```bash
EMBEDDING_PROVIDER=openai \
EMBEDDING_API_KEY=sk-... \
./scripts/re-embed.sh --force
```

#### Custom Database Paths

For multiple databases or testing:

```bash
./scripts/re-embed.sh --db prod.db --provider openai --api-key sk-... --force
./scripts/re-embed.sh --db staging.db --provider local --force
```

#### Resuming Interrupted Re-embedding

If re-embedding is interrupted (Ctrl+C), you can resume:

```bash
# First attempt (interrupted)
./scripts/re-embed.sh --provider openai --api-key sk-... --force
# (Ctrl+C after 1 hour)

# Resume without --force (skips already embedded snippets)
./scripts/re-embed.sh --provider openai --api-key sk-...
```

Without `--force`, the script only embeds snippets that don't yet have embeddings.

### Troubleshooting

#### Problem: "Database file not found"

```bash
Error: Database file not found: ./docs.db
```

**Solution**: Create a database first:
```bash
bun run src/cli/index.ts ingest https://github.com/vercel/next.js --db docs.db
```

#### Problem: "Bun is not installed or not in PATH"

```bash
Error: Bun is not installed or not in PATH
```

**Solution**: Install Bun from https://bun.sh

#### Problem: "OpenAI provider requires API key"

```bash
Error: OpenAI provider requires API key
```

**Solution**: Provide the API key via flag or environment variable:
```bash
./scripts/re-embed.sh --api-key sk-... --force
# or
EMBEDDING_API_KEY=sk-... ./scripts/re-embed.sh --force
```

#### Problem: "API key doesn't look like an OpenAI key"

```bash
Warning: API key doesn't look like an OpenAI key (should start with 'sk-')
```

**Solution**: Double-check your API key from https://platform.openai.com/api-keys

### Next Steps

After re-embedding:

1. **Verify embeddings**: Check that embeddings were created
   ```bash
   bun run src/cli/index.ts list --db docs.db
   ```

2. **Test search**: Try semantic search with the new embeddings
   ```bash
   # In OpenCode or your MCP client
   # Use searchMode: "semantic" or "hybrid" in query-docs
   ```

3. **Monitor results**: Test search quality and adjust if needed
   ```bash
   # Compare results between providers
   # Use semantic mode for one, keyword mode for the other
   ```

4. **Update production**: Once satisfied, deploy updated database
   ```bash
   scp docs.db user@server:/path/to/
   systemctl restart context7-local  # or your service manager
   ```

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
