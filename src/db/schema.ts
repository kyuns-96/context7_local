import type { Database } from "bun:sqlite";

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
