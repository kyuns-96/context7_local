#!/usr/bin/env bun
/**
 * Split the monolithic docs-v1.0.3.db into domain-specific databases
 * 
 * This script creates 8 separate databases organized by development domain,
 * allowing users to download only the domains they need and enabling
 * better distribution under GitHub's 2GB file size limit.
 */

import Database from 'bun:sqlite';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

// Domain classification rules
const domains = {
  frontend: [
    'react', 'vue', 'angular', 'next.js', 'svelte', 'typescript',
    'javascript', 'css', 'tailwind', 'webpack', 'vite', 'babel',
    'solid', 'preact', 'lit', 'polymer', 'ember', 'backbone',
    'nuxt', 'gatsby', 'astro', 'remix', 'qwik', 'alpine',
    'htmx', 'stimulus', 'turbo', 'hotwire', 'jquery', 'lodash',
    'underscore', 'ramda', 'immer', 'mobx', 'redux', 'zustand',
    'jotai', 'recoil', 'xstate', 'sass', 'less', 'styled-components',
    'emotion', 'chakra', 'mui', 'ant-design', 'bootstrap', 'bulma',
    'foundation', 'semantic-ui', 'mantine', 'shadcn', 'radix',
    'headless-ui', 'daisyui', 'flowbite', 'primereact', 'primevue'
  ],
  backend: [
    'express', 'fastify', 'node', 'laravel', 'rails', 'flask',
    'django', 'aspnetcore', 'spring', 'graphql', 'nestjs',
    'koa', 'hapi', 'restify', 'sails', 'meteor', 'strapi',
    'adonis', 'loopback', 'feathers', 'trpc', 'grpc', 'soap',
    'rest', 'phoenix', 'elixir', 'gin', 'echo', 'fiber',
    'chi', 'gorilla', 'actix', 'rocket', 'axum', 'warp'
  ],
  mobile: [
    'react-native', 'flutter', 'expo', 'ionic', 'swift', 'kotlin',
    'capacitor', 'cordova', 'nativescript', 'xamarin', 'maui',
    'swiftui', 'jetpack', 'compose', 'reactnavigation', 'tamagui'
  ],
  devops: [
    'docker', 'kubernetes', 'terraform', 'ansible', 'aws', 'azure',
    'google-cloud', 'gcp', 'helm', 'prometheus', 'grafana', 'datadog',
    'jenkins', 'gitlab', 'github', 'circleci', 'travis', 'netlify',
    'vercel', 'cloudflare', 'heroku', 'digitalocean', 'linode',
    'vagrant', 'packer', 'consul', 'vault', 'nomad', 'pulumi',
    'argocd', 'flux', 'tekton', 'spinnaker', 'okteto', 'skaffold'
  ],
  'ai-ml': [
    'tensorflow', 'pytorch', 'langchain', 'openai', 'anthropic',
    'llama', 'transformers', 'keras', 'guidance', 'huggingface',
    'scikit', 'sklearn', 'xgboost', 'lightgbm', 'catboost',
    'spacy', 'nltk', 'gensim', 'fastai', 'jax', 'flax',
    'mlx', 'onnx', 'tensorrt', 'mlflow', 'wandb', 'comet',
    'autogluon', 'ray', 'dask', 'rapids', 'cuml', 'cudf'
  ],
  data: [
    'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch',
    'cassandra', 'cockroach', 'sqlite', 'prisma', 'chroma',
    'qdrant', 'milvus', 'weaviate', 'pinecone', 'pandas', 'numpy',
    'mariadb', 'oracle', 'mssql', 'dynamodb', 'firestore',
    'supabase', 'planetscale', 'neon', 'turso', 'drizzle',
    'typeorm', 'sequelize', 'mongoose', 'knex', 'kysely',
    'sqlalchemy', 'alembic', 'dbt', 'airbyte', 'dagster',
    'airflow', 'prefect', 'spark', 'flink', 'kafka', 'pulsar',
    'rabbitmq', 'nats', 'zeromq', 'clickhouse', 'timescale',
    'influx', 'questdb', 'dgraph', 'neo4j', 'arangodb', 'fauna'
  ],
  system: [
    'powershell', 'bash', 'zsh', 'fish', 'windows', 'ubuntu',
    'arch', 'wsl', 'terminal', 'linux', 'macos', 'freebsd',
    'openbsd', 'debian', 'fedora', 'centos', 'rhel', 'alpine',
    'nix', 'guix', 'systemd', 'cron', 'supervisord', 'pm2'
  ],
  security: [
    'auth0', 'oauth', 'jwt', 'keycloak', 'next-auth', 'passport',
    'clerk', 'supertokens', 'lucia', 'better-auth', 'authjs',
    'ory', 'authentik', 'authelia', 'okta', 'cognito', 'firebase-auth',
    'bcrypt', 'argon2', 'scrypt', 'pbkdf2', 'helmet', 'cors',
    'csrf', 'xss', 'sanitize', 'validator', 'zod', 'yup', 'joi'
  ]
} as const;

type DomainName = keyof typeof domains;

// Schema for new databases
const SCHEMA = `
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
  embedding TEXT,
  FOREIGN KEY (library_id, library_version) REFERENCES libraries(id, version)
);

CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts USING fts5(
  title, content, source_path,
  content='snippets',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS snippets_ai AFTER INSERT ON snippets BEGIN
  INSERT INTO snippets_fts(rowid, title, content, source_path)
  VALUES (new.id, new.title, new.content, new.source_path);
END;

CREATE TRIGGER IF NOT EXISTS snippets_ad AFTER DELETE ON snippets BEGIN
  DELETE FROM snippets_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS snippets_au AFTER UPDATE ON snippets BEGIN
  DELETE FROM snippets_fts WHERE rowid = old.id;
  INSERT INTO snippets_fts(rowid, title, content, source_path)
  VALUES (new.id, new.title, new.content, new.source_path);
END;
`;

interface Library {
  id: string;
  version: string;
  title: string;
  description: string;
  source_repo: string;
  total_snippets: number;
  trust_score: number;
  benchmark_score: number;
  ingested_at: string;
}

interface Stats {
  domain: DomainName;
  libraries: number;
  snippets: number;
  fileSize: number;
}

function classifyLibrary(libraryId: string): DomainName | null {
  const lowerLibId = libraryId.toLowerCase();
  
  for (const [domain, keywords] of Object.entries(domains)) {
    for (const keyword of keywords) {
      if (lowerLibId.includes(keyword)) {
        return domain as DomainName;
      }
    }
  }
  
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

async function createDomainDatabase(
  sourceDb: Database,
  targetPath: string,
  domain: DomainName,
  libraryIds: string[]
): Promise<Stats> {
  console.log(`\n📦 Creating ${domain}.db...`);
  
  // Create target database
  const targetDb = new Database(targetPath);
  
  // Create schema
  targetDb.exec(SCHEMA);
  
  // Prepare statements for bulk insert
  const insertLibrary = targetDb.prepare(
    'INSERT INTO libraries (id, version, title, description, source_repo, total_snippets, trust_score, benchmark_score, ingested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  
  const insertSnippet = targetDb.prepare(
    'INSERT INTO snippets (id, library_id, library_version, title, content, source_path, source_url, language, token_count, breadcrumb, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  
  let libraryCount = 0;
  let snippetCount = 0;
  
  // Begin transaction for performance
  targetDb.run('BEGIN TRANSACTION');
  
  try {
    for (const libraryId of libraryIds) {
      // Copy library
      const library = sourceDb.query('SELECT * FROM libraries WHERE id = ?').get(libraryId) as Library | null;
      
      if (!library) {
        console.warn(`  ⚠️  Library not found: ${libraryId}`);
        continue;
      }
      
      try {
        insertLibrary.run(
          library.id,
          library.version,
          library.title,
          library.description,
          library.source_repo,
          library.total_snippets,
          library.trust_score,
          library.benchmark_score,
          library.ingested_at
        );
      } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
          console.warn(`  ⚠️  Duplicate library ID skipped: ${libraryId}`);
          continue;
        }
        throw err;
      }
      libraryCount++;
      
      // Copy snippets
      const snippets = sourceDb.query('SELECT * FROM snippets WHERE library_id = ?').all(libraryId) as any[];
      
      for (const snippet of snippets) {
        insertSnippet.run(
          snippet.id,
          snippet.library_id,
          snippet.library_version,
          snippet.title,
          snippet.content,
          snippet.source_path,
          snippet.source_url,
          snippet.language,
          snippet.token_count,
          snippet.breadcrumb,
          snippet.embedding
        );
        snippetCount++;
      }
      
      if (libraryCount % 10 === 0) {
        console.log(`  ✓ Processed ${libraryCount} libraries, ${snippetCount} snippets...`);
      }
    }
    
    // Commit transaction
    targetDb.run('COMMIT');
    
    // Rebuild FTS index
    console.log(`  🔍 Rebuilding FTS index...`);
    targetDb.run('INSERT INTO snippets_fts(snippets_fts) VALUES("rebuild")');
    
    // Optimize database
    console.log(`  🗜️  Optimizing database...`);
    targetDb.run('VACUUM');
    targetDb.run('ANALYZE');
    
    targetDb.close();
    
    // Get file size
    const fileSize = statSync(targetPath).size;
    
    console.log(`  ✅ Created ${domain}.db: ${libraryCount} libraries, ${snippetCount} snippets, ${formatBytes(fileSize)}`);
    
    return {
      domain,
      libraries: libraryCount,
      snippets: snippetCount,
      fileSize
    };
  } catch (error) {
    targetDb.run('ROLLBACK');
    targetDb.close();
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting database split process...\n');
  
  const sourceDbPath = join(process.cwd(), 'docs-v1.0.3.db');
  const targetDir = join(process.cwd(), 'split-dbs');
  
  // Verify source database exists
  if (!existsSync(sourceDbPath)) {
    console.error(`❌ Source database not found: ${sourceDbPath}`);
    process.exit(1);
  }
  
  // Create target directory
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    console.log(`📁 Created directory: ${targetDir}`);
  }
  
  // Open source database
  const sourceDb = new Database(sourceDbPath, { readonly: true });
  
  // Get all libraries
  console.log('📊 Analyzing libraries...\n');
  const libraries = sourceDb.query('SELECT id FROM libraries').all() as { id: string }[];
  
  console.log(`Found ${libraries.length} libraries in source database\n`);
  
  // Classify libraries by domain
  const domainLibraries: Record<DomainName, string[]> = {
    frontend: [],
    backend: [],
    mobile: [],
    devops: [],
    'ai-ml': [],
    data: [],
    system: [],
    security: []
  };
  
  const unclassified: string[] = [];
  
  for (const { id } of libraries) {
    const domain = classifyLibrary(id);
    if (domain) {
      domainLibraries[domain].push(id);
    } else {
      unclassified.push(id);
    }
  }
  
  // Report classification
  console.log('📋 Library classification:\n');
  for (const [domain, libs] of Object.entries(domainLibraries)) {
    console.log(`  ${domain}: ${libs.length} libraries`);
  }
  
  if (unclassified.length > 0) {
    console.log(`\n⚠️  Unclassified libraries (${unclassified.length}):`);
    for (const id of unclassified) {
      console.log(`    - ${id}`);
    }
    console.log('\n  These will be skipped. Consider adding keywords to classify them.\n');
  }
  
  // Create domain databases
  const stats: Stats[] = [];
  
  for (const domain of Object.keys(domainLibraries) as DomainName[]) {
    const libs = domainLibraries[domain];
    
    if (libs.length === 0) {
      console.log(`⏭️  Skipping ${domain} (no libraries)\n`);
      continue;
    }
    
    const targetPath = join(targetDir, `${domain}.db`);
    const domainStats = await createDomainDatabase(sourceDb, targetPath, domain, libs);
    stats.push(domainStats);
  }
  
  sourceDb.close();
  
  // Final report
  console.log('\n' + '='.repeat(80));
  console.log('✨ DATABASE SPLIT COMPLETE\n');
  console.log('Summary:\n');
  
  let totalLibraries = 0;
  let totalSnippets = 0;
  let totalSize = 0;
  
  for (const stat of stats) {
    console.log(`  ${stat.domain}.db:`);
    console.log(`    Libraries: ${stat.libraries}`);
    console.log(`    Snippets:  ${stat.snippets.toLocaleString()}`);
    console.log(`    Size:      ${formatBytes(stat.fileSize)}`);
    console.log();
    
    totalLibraries += stat.libraries;
    totalSnippets += stat.snippets;
    totalSize += stat.fileSize;
  }
  
  console.log('  TOTAL:');
  console.log(`    Databases: ${stats.length}`);
  console.log(`    Libraries: ${totalLibraries}`);
  console.log(`    Snippets:  ${totalSnippets.toLocaleString()}`);
  console.log(`    Size:      ${formatBytes(totalSize)}`);
  
  if (unclassified.length > 0) {
    console.log(`\n  ⚠️  ${unclassified.length} libraries were not classified and skipped`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📦 All databases created in: split-dbs/');
  console.log('📖 See SPLIT_DATABASES.md for usage instructions');
}

main().catch(console.error);
