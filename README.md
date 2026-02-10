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
3.  **Data Ingestion**: Download the documentation you need:
    ```bash
    bun run src/cli/index.ts ingest --preset-all --db docs.db
    ```
4.  **Build Binary**: Compile a standalone executable for the target server:
    ```bash
    bun build --compile src/server/index.ts --outfile context7-local
    ```
5.  **Transfer**: Copy the `context7-local` binary and the `docs.db` file to your air-gapped server.
6.  **Startup**: Run the server on the air-gapped machine:
    ```bash
    ./context7-local --transport http --port 3000 --db /path/to/docs.db
    ```
7.  **Client Config**: Configure OpenCode on developer machines to point to the server's IP: `http://server:3000/mcp`.

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

## 8. Known Limitations

- **Keyword Search Only**: Uses SQLite FTS5. Does not support semantic or vector-based search.
- **RST Documentation**: Python libraries using reStructuredText (.rst) may have lower formatting quality compared to Markdown.
- **GitHub Markdown**: Only parses Markdown files found in the repository. It does not crawl external websites or scrape HTML.
- **No Authentication**: The HTTP server does not currently include authentication or rate limiting. It is intended for use within trusted private networks.
