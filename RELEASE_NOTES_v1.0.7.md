# Release Notes: v1.0.7 - February 2026 Updates (Split Databases)

**Release Date**: February 12, 2026  
**Release Type**: Split Databases Only (Domain-Specific)  
**Total Libraries**: 205 (monolithic) / 125 (split databases)  
**Total Code Snippets**: 635,598 (monolithic) / 498,589 (split)  

## 🎯 Release Highlights

This release brings the **latest 2026 versions** of the most critical JavaScript/TypeScript libraries to local_context7, including React 19, Node.js 24/25 LTS, TypeScript 5.9, Next.js 15, Vue 3.5, and Angular 19.

### Why Split Databases Only?

The monolithic database with all 2026 updates exceeds GitHub's 2GB file size limit (2.07 GB compressed). This release provides **8 domain-specific split databases** that allow you to download only what you need while staying under the file size limit.

### Key Achievements

✅ **Latest 2026 Versions**: React 19.2.4, Node.js v24/v25, TypeScript 5.9.3, Next.js 15.5, Vue 3.5, Angular 19  
✅ **31,545 New Snippets**: Added comprehensive docs for 7 major library updates  
✅ **Domain-Specific Access**: Download only frontend, backend, mobile, devops, ai-ml, data, system, or security  
✅ **Under 2GB Per Domain**: All split databases are under GitHub's file size limit  
✅ **Full Backward Compatibility**: All previous library versions remain available  

## 📦 What's New in v1.0.7

### 🆕 2026 Library Updates

#### React v19.2.4 (January 26, 2026)
- **5,087 new snippets**
- Latest stable React release
- React Server Components production-ready
- Enhanced Suspense and concurrent rendering
- New use() hook for data fetching
- Improved DevTools and error boundaries

#### Node.js v24.13.1 LTS "Krypton" (February 10, 2026)
- **9,904 new snippets**
- Latest LTS release for enterprise deployments
- Native TypeScript support improvements
- Enhanced performance and security updates
- Recommended for production use

#### Node.js v25.6.1 Current (February 9, 2026)
- **10,381 new snippets**
- Bleeding-edge Node.js features
- Experimental features and APIs
- For developers who need latest innovations

#### TypeScript v5.9.3
- **148 new snippets**
- Latest TypeScript 5.x before TS 6.0/7.0 native port
- Performance improvements
- Enhanced type inference
- Better decorators support

#### Next.js v15.5.12
- **2,769 new snippets**
- Latest Next.js 15.x release
- Improved App Router performance
- Enhanced Server Actions
- Better static/dynamic optimization

#### Vue v3.5.28
- **54 new snippets**
- Latest Vue 3.5.x release
- Reactivity system improvements
- Better TypeScript integration

#### Angular 19.2.17
- **3,101 new snippets**
- Latest Angular 19.x release
- Improved build performance
- Enhanced signals support
- Better standalone components

### 📊 Version Coverage

| Library | Versions Available | Latest Added in v1.0.7 |
|---------|-------------------|------------------------|
| **React** | v16.x, v17.x, v18.x, **v19.2.4** | v19.2.4 ✨ |
| **Node.js** | v18.x, v20.x, v21.x, v22.x, **v24.13.1 LTS**, **v25.6.1** | v24 & v25 ✨ |
| **TypeScript** | v4.9.x, v5.0.x, v5.1.x, v5.2.x, v5.3.x, **v5.9.3** | v5.9.3 ✨ |
| **Next.js** | v13.x, v14.x, **v15.5.12** | v15.5.12 ✨ |
| **Vue** | v3.2.x, v3.3.x, v3.4.x, **v3.5.28** | v3.5.28 ✨ |
| **Angular** | v15.x, v16.x, v17.x, **v19.2.17** | v19.2.17 ✨ |

### 📦 Split Database Distribution

This release includes 8 domain-specific databases:

#### 1. **frontend.db** - 684 MB
- 33 libraries, 94,142 snippets
- React, Vue, Angular, Next.js, TypeScript, Svelte, Solid
- UI frameworks: Tailwind, MUI, Chakra UI, Ant Design
- Build tools: Webpack, Vite, Babel

#### 2. **backend.db** - 1.03 GB *(Largest)*
- 23 libraries, 125,424 snippets
- Node.js (v18-v25), Express, NestJS, Fastify
- GraphQL, Apollo, tRPC
- Laravel, Rails, Django, ASP.NET Core

#### 3. **mobile.db** - 271 MB
- 6 libraries, 37,202 snippets
- React Native, Flutter, Expo
- Ionic, Swift, Kotlin

#### 4. **devops.db** - 259 MB
- 15 libraries, 31,020 snippets
- Docker, Kubernetes, Terraform
- AWS, Azure, Google Cloud
- Prometheus, Grafana, Helm

#### 5. **ai-ml.db** - 113 MB
- 12 libraries, 14,234 snippets
- LangChain, OpenAI, Anthropic
- TensorFlow, PyTorch, Keras
- LlamaIndex, Ollama

#### 6. **data.db** - 873 MB
- 24 libraries, 105,904 snippets
- MongoDB, PostgreSQL, MySQL, Redis
- Elasticsearch, CockroachDB
- Vector DBs: Chroma, Qdrant, Milvus, Weaviate
- ORMs: Prisma, Drizzle, TypeORM

#### 7. **system.db** - 510 MB
- 7 libraries, 63,414 snippets
- PowerShell (43k snippets)
- Windows Server, Ubuntu Server
- Arch Linux, WSL, Fish Shell

#### 8. **security.db** - 220 MB
- 5 libraries, 27,249 snippets
- Auth0, Keycloak, NextAuth
- OAuth2 Proxy, Storybook

### ⚠️ Important Notes

**51 libraries are not classified** and do not appear in split databases. These include:
- Testing frameworks: Jest, Mocha, Cypress, Puppeteer
- Build tools: Rollup, Parcel, esbuild, SWC
- Utilities: Axios, Lodash, Moment, date-fns
- General languages: Rust, Go, Julia, Ruby
- Frameworks: Redwood, Symfony, Deno, Bun

**To access all 205 libraries (including unclassified ones), you need the monolithic database** (not available in this release due to 2GB limit).

## 🚀 Quick Start

### Option 1: Download All Split Databases

```bash
# Download all 8 databases (3.89 GB total)
curl -L https://github.com/kyuns-96/context7_local/releases/download/v1.0.7/split-databases.tar.gz | tar -xz

# Databases will be in split-dbs/ directory
ls split-dbs/
# frontend.db  backend.db  mobile.db  devops.db  ai-ml.db  data.db  system.db  security.db
```

### Option 2: Download Individual Domains

```bash
# Frontend development
curl -L -o frontend.db https://github.com/kyuns-96/context7_local/releases/download/v1.0.7/frontend.db.tar.gz | tar -xz

# Backend development
curl -L -o backend.db https://github.com/kyuns-96/context7_local/releases/download/v1.0.7/backend.db.tar.gz | tar -xz

# Run server with specific domain
bun run src/server/index.ts --transport http --port 3000 --db frontend.db
```

### Option 3: Use Multiple Databases

You can run multiple MCP servers (one per domain) on different ports:

```bash
# Terminal 1: Frontend
bun run src/server/index.ts --transport http --port 3001 --db split-dbs/frontend.db

# Terminal 2: Backend
bun run src/server/index.ts --transport http --port 3002 --db split-dbs/backend.db

# Terminal 3: Data
bun run src/server/index.ts --transport http --port 3003 --db split-dbs/data.db
```

Configure OpenCode to use multiple servers:

```json
{
  "mcp": {
    "context7-frontend": {
      "type": "remote",
      "url": "http://localhost:3001/mcp",
      "enabled": true
    },
    "context7-backend": {
      "type": "remote",
      "url": "http://localhost:3002/mcp",
      "enabled": true
    },
    "context7-data": {
      "type": "remote",
      "url": "http://localhost:3003/mcp",
      "enabled": true
    }
  }
}
```

## 📊 Statistics Comparison

| Metric | v1.0.6 (Monolithic) | v1.0.7 (Monolithic) | v1.0.7 (Split DBs) |
|--------|---------------------|---------------------|-------------------|
| **Compressed Size** | 1.98 GB | 2.07 GB ⚠️ | 3.89 GB (total) |
| **Uncompressed Size** | 4.8 GB | 5.01 GB | N/A |
| **Libraries** | 198 | 205 | 125 (154 unique) |
| **Code Snippets** | 604,053 | 635,598 | 498,589 |
| **Domains** | 1 | 1 | 8 |
| **GitHub Compatible** | ✅ Yes | ❌ Over limit | ✅ Yes (per domain) |

## 🎯 Target Use Cases

This release is optimized for:

- 🌐 **Modern Web Developers** - Latest React 19, Next.js 15, Node.js 24/25
- 📱 **Full-Stack Teams** - Separate frontend/backend/data databases
- 🏢 **Selective Downloads** - Only download domains you need
- 🔧 **Development Teams** - Different databases for different specializations
- 💾 **Storage-Constrained Environments** - Download individual domains instead of full 5GB
- 🚀 **Rapid Prototyping** - Latest framework versions for bleeding-edge features

## 🔄 Migration from v1.0.6

### If you need ALL libraries (including unclassified):
Keep using v1.0.6 monolithic database OR wait for a future release with optimized storage.

### If you work primarily in specific domains:
Download the relevant split databases from v1.0.7 to get 2026 updates.

### Recommended approach:
1. Use v1.0.6 monolithic as your comprehensive fallback
2. Add v1.0.7 split databases for domains you actively work in
3. Configure OpenCode to query v1.0.7 first, v1.0.6 as fallback

## 📖 Documentation Updates

- `README.md` updated to reference v1.0.7 and split databases
- `SPLIT_DATABASES.md` provides complete guide to using split databases
- `scripts/split-database.ts` fixed to match current database schema

## 🐛 Bug Fixes

- Fixed `scripts/split-database.ts` schema mismatch (columns didn't match actual database)
- Updated split script to handle composite primary keys (id + version)
- Improved duplicate library version handling in split process

## 🔮 Future Plans

### v1.0.8 (Planned)
- **Classify remaining 51 libraries** into appropriate domains or create new domains (testing, build-tools, etc.)
- **Database optimization** to reduce monolithic size back under 2GB
- **Selective version retention** (keep latest + 1 LTS per library)
- **Compression improvements** (investigate xz/zstd alternatives to gzip)

### Long-term
- **Torrent distribution** for monolithic database over 2GB
- **IPFS integration** for decentralized distribution
- **Delta updates** instead of full database downloads
- **On-demand version download** from within the MCP server

## 📝 Release Files

| File | Size | Description |
|------|------|-------------|
| `frontend.db.tar.gz` | ~350 MB | Frontend development (React, Vue, Angular, etc.) |
| `backend.db.tar.gz` | ~520 MB | Backend development (Node.js, Express, GraphQL, etc.) |
| `mobile.db.tar.gz` | ~140 MB | Mobile development (React Native, Flutter, etc.) |
| `devops.db.tar.gz` | ~135 MB | DevOps tools (Docker, Kubernetes, Terraform, etc.) |
| `ai-ml.db.tar.gz` | ~60 MB | AI/ML frameworks (LangChain, OpenAI, TensorFlow, etc.) |
| `data.db.tar.gz` | ~440 MB | Databases and ORMs (MongoDB, PostgreSQL, Prisma, etc.) |
| `system.db.tar.gz` | ~260 MB | Operating systems and shells (PowerShell, Linux, etc.) |
| `security.db.tar.gz` | ~115 MB | Security and auth (Auth0, OAuth, Keycloak, etc.) |
| `split-databases.tar.gz` | ~2.0 GB | All 8 databases in one archive |

## 🙏 Acknowledgments

Special thanks to the maintainers of:
- React team for the excellent React 19 documentation
- Node.js team for maintaining comprehensive API docs across multiple versions
- TypeScript team for detailed language reference
- Next.js, Vue, and Angular teams for keeping docs up-to-date

## 📞 Support

- **Issues**: https://github.com/kyuns-96/context7_local/issues
- **Documentation**: See README.md and SPLIT_DATABASES.md
- **Discussions**: https://github.com/kyuns-96/context7_local/discussions

---

**Previous Release**: [v1.0.6 - 2GB Maximum Capacity Edition](./RELEASE_NOTES_v1.0.6.md)  
**Download**: https://github.com/kyuns-96/context7_local/releases/tag/v1.0.7
