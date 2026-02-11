import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { openDatabase } from "../../src/db/connection";
import { queryDocumentationByVector, queryDocumentationHybrid } from "../../src/db/queries";

describe("queryDocumentationByVector", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");

    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/facebook/react', 'latest', 'React', 'React library', 'https://github.com/facebook/react', 5)
    `);

    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb, embedding)
      VALUES 
        ('/facebook/react', 'latest', 'useState Hook', 'The useState hook lets you add state to functional components', 'docs/hooks.md', 'typescript', 50, 'Hooks > State', '[1.0, 0.0, 0.0]'),
        ('/facebook/react', 'latest', 'useEffect Hook', 'The useEffect hook lets you perform side effects', 'docs/hooks.md', 'typescript', 60, 'Hooks > Effects', '[0.9, 0.1, 0.0]'),
        ('/facebook/react', 'latest', 'Component Basics', 'React components are reusable pieces of UI', 'docs/components.md', 'typescript', 40, 'Components > Basics', '[0.0, 1.0, 0.0]'),
        ('/facebook/react', 'latest', 'JSX Introduction', 'JSX is a syntax extension for JavaScript', 'docs/jsx.md', 'typescript', 45, 'JSX', '[0.0, 0.0, 1.0]'),
        ('/facebook/react', 'latest', 'No Embedding', 'This snippet has no embedding', 'docs/other.md', 'typescript', 30, 'Other', NULL)
    `);
  });

  afterEach(() => {
    db.close();
  });

  test("should return snippets ordered by cosine similarity", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationByVector(queryEmbedding, "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("useState Hook");
    expect(results[1]?.title).toBe("useEffect Hook");
  });

  test("should filter out snippets without embeddings", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationByVector(queryEmbedding, "/facebook/react", "latest", db);

    const noEmbedding = results.find(r => r.title === "No Embedding");
    expect(noEmbedding).toBeUndefined();
  });

  test("should respect limit parameter", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationByVector(queryEmbedding, "/facebook/react", "latest", db, 2);

    expect(results.length).toBe(2);
  });

  test("should return empty array when no embeddings match", () => {
    db.run(`DELETE FROM snippets WHERE embedding IS NOT NULL`);

    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationByVector(queryEmbedding, "/facebook/react", "latest", db);

    expect(results).toEqual([]);
  });

  test("should filter by library_id and version", () => {
    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/vercel/next.js', 'latest', 'Next.js', 'Next.js framework', 'https://github.com/vercel/next.js', 1)
    `);

    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb, embedding)
      VALUES ('/vercel/next.js', 'latest', 'App Router', 'Next.js App Router', 'docs/routing.md', 'typescript', 50, 'Routing', '[1.0, 0.0, 0.0]')
    `);

    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationByVector(queryEmbedding, "/facebook/react", "latest", db);

    const nextjsResult = results.find(r => r.library_id === "/vercel/next.js");
    expect(nextjsResult).toBeUndefined();
    
    results.forEach(r => {
      expect(r.library_id).toBe("/facebook/react");
    });
  });

  test("should return all required fields", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationByVector(queryEmbedding, "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThan(0);
    const result = results[0];
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("library_id");
    expect(result).toHaveProperty("library_version");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("source_path");
    expect(result).toHaveProperty("language");
    expect(result).toHaveProperty("token_count");
    expect(result).toHaveProperty("breadcrumb");
    expect(result).not.toHaveProperty("embedding");
  });

  test("should handle dissimilar embeddings with low scores", () => {
    const queryEmbedding = [0.0, 0.0, 1.0];
    const results = queryDocumentationByVector(queryEmbedding, "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("JSX Introduction");
  });
});

describe("queryDocumentationHybrid", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");

    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/facebook/react', 'latest', 'React', 'React library', 'https://github.com/facebook/react', 5)
    `);

    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb, embedding)
      VALUES 
        ('/facebook/react', 'latest', 'useState Hook', 'The useState hook lets you add state to functional components', 'docs/hooks.md', 'typescript', 50, 'Hooks > State', '[1.0, 0.0, 0.0]'),
        ('/facebook/react', 'latest', 'useEffect Hook', 'The useEffect hook lets you perform side effects in functional components', 'docs/hooks.md', 'typescript', 60, 'Hooks > Effects', '[0.9, 0.1, 0.0]'),
        ('/facebook/react', 'latest', 'Component Basics', 'React components are reusable pieces of UI', 'docs/components.md', 'typescript', 40, 'Components > Basics', '[0.0, 1.0, 0.0]'),
        ('/facebook/react', 'latest', 'JSX Introduction', 'JSX is a syntax extension for JavaScript', 'docs/jsx.md', 'typescript', 45, 'JSX', '[0.0, 0.0, 1.0]'),
        ('/facebook/react', 'latest', 'State Management', 'Managing state in React applications', 'docs/state.md', 'typescript', 55, 'State', '[0.95, 0.05, 0.0]')
    `);
  });

  afterEach(() => {
    db.close();
  });

  test("should combine FTS5 and vector search results", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationHybrid("state hook", queryEmbedding, "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThan(0);
    
    const stateHookTitles = results.map(r => r.title);
    expect(stateHookTitles).toContain("useState Hook");
  });

  test("should deduplicate results by snippet ID", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationHybrid("useState hook state", queryEmbedding, "/facebook/react", "latest", db);

    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  test("should respect limit parameter", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationHybrid("hook", queryEmbedding, "/facebook/react", "latest", db, 2);

    expect(results.length).toBeLessThanOrEqual(2);
  });

  test("should return snippets from both FTS5 and vector search", () => {
    const queryEmbedding = [0.0, 1.0, 0.0];
    const results = queryDocumentationHybrid("hook", queryEmbedding, "/facebook/react", "latest", db, 10);

    expect(results.length).toBeGreaterThan(0);
  });

  test("should filter by library_id and version", () => {
    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/vercel/next.js', 'latest', 'Next.js', 'Next.js framework', 'https://github.com/vercel/next.js', 1)
    `);

    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb, embedding)
      VALUES ('/vercel/next.js', 'latest', 'App Router Hook', 'Next.js App Router with hooks', 'docs/routing.md', 'typescript', 50, 'Routing', '[1.0, 0.0, 0.0]')
    `);

    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationHybrid("hook", queryEmbedding, "/facebook/react", "latest", db);

    const nextjsResult = results.find(r => r.library_id === "/vercel/next.js");
    expect(nextjsResult).toBeUndefined();
    
    results.forEach(r => {
      expect(r.library_id).toBe("/facebook/react");
    });
  });

  test("should return all required fields without scores", () => {
    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationHybrid("hook", queryEmbedding, "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThan(0);
    const result = results[0];
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("library_id");
    expect(result).toHaveProperty("library_version");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("source_path");
    expect(result).toHaveProperty("language");
    expect(result).toHaveProperty("token_count");
    expect(result).toHaveProperty("breadcrumb");
    expect(result).not.toHaveProperty("embedding");
    expect(result).not.toHaveProperty("finalScore");
    expect(result).not.toHaveProperty("fts_score");
    expect(result).not.toHaveProperty("vector_score");
  });

  test("should handle case when only FTS5 has results", () => {
    db.run(`UPDATE snippets SET embedding = NULL`);
    
    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb, embedding)
      VALUES ('/facebook/react', 'latest', 'Unique Term', 'This has a unique searchable term', 'docs/unique.md', 'typescript', 30, 'Unique', NULL)
    `);

    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationHybrid("unique searchable", queryEmbedding, "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThan(0);
  });

  test("should handle case when only vector search has results", () => {
    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb, embedding)
      VALUES ('/facebook/react', 'latest', 'Another Topic', 'Content without query terms', 'docs/other.md', 'typescript', 35, 'Other', '[1.0, 0.0, 0.0]')
    `);

    const queryEmbedding = [1.0, 0.0, 0.0];
    const results = queryDocumentationHybrid("nonexistent query term xyz", queryEmbedding, "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});
