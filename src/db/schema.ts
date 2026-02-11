import type { Database } from "bun:sqlite";

export function cosineSimilarity(v1: string | null, v2: string | null): number | null {
  if (!v1 || !v2) return null;
  
  try {
    const vec1: number[] = JSON.parse(v1);
    const vec2: number[] = JSON.parse(v2);
    
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
      return null;
    }
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      const val1 = vec1[i];
      const val2 = vec2[i];
      if (val1 === undefined || val2 === undefined) return null;
      
      dotProduct += val1 * val2;
      mag1 += val1 * val1;
      mag2 += val2 * val2;
    }
    
    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    if (magnitude === 0) return null;
    
    return dotProduct / magnitude;
  } catch {
    return null;
  }
}

export function createSchema(db: Database): void {
  db.exec(`
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
        content='snippets', content_rowid='id',
        tokenize='porter unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS snippets_fts_insert AFTER INSERT ON snippets BEGIN
        INSERT INTO snippets_fts(rowid, title, content, source_path)
        VALUES (new.id, new.title, new.content, new.source_path);
    END;

    CREATE TRIGGER IF NOT EXISTS snippets_fts_update AFTER UPDATE ON snippets BEGIN
        DELETE FROM snippets_fts WHERE rowid = old.id;
        INSERT INTO snippets_fts(rowid, title, content, source_path)
        VALUES (new.id, new.title, new.content, new.source_path);
    END;

    CREATE TRIGGER IF NOT EXISTS snippets_fts_delete BEFORE DELETE ON snippets BEGIN
        DELETE FROM snippets_fts WHERE rowid = old.id;
    END;
  `);
}
