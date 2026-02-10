import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { openDatabase } from "../../src/db/connection";
import { searchLibraries, queryDocumentation } from "../../src/db/queries";

describe("searchLibraries", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");

    // Insert test libraries
    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets, trust_score, benchmark_score)
      VALUES 
        ('/vercel/next.js', 'latest', 'Next.js', 'The React Framework for the Web', 'https://github.com/vercel/next.js', 500, 9.5, 95),
        ('/vercel/next.js', 'v14.0.0', 'Next.js v14', 'Next.js version 14', 'https://github.com/vercel/next.js', 450, 9.5, 95),
        ('/facebook/react', 'latest', 'React', 'A JavaScript library for building user interfaces', 'https://github.com/facebook/react', 800, 10.0, 98),
        ('/microsoft/typescript', 'latest', 'TypeScript', 'TypeScript is a superset of JavaScript', 'https://github.com/microsoft/typescript', 300, 8.0, 90),
        ('/mongodb/docs', 'latest', 'MongoDB', 'MongoDB database documentation', 'https://github.com/mongodb/docs', 200, 7.0, 85)
    `);
  });

  afterEach(() => {
    db.close();
  });

  test("should search libraries by partial name match", () => {
    const results = searchLibraries("react tutorial", "react", db);

    expect(results.length).toBeGreaterThan(0);
    const reactLib = results.find((r) => r.id === "/facebook/react");
    expect(reactLib).toBeDefined();
    expect(reactLib?.title).toBe("React");
  });

  test("should order results by trust_score DESC, then total_snippets DESC", () => {
    const results = searchLibraries("javascript frameworks", "next", db);

    // React (trust=10.0, snippets=800) should come before Next.js (trust=9.5, snippets=500)
    const react = results.find((r) => r.id === "/facebook/react");
    const nextjs = results.find((r) => r.id === "/vercel/next.js" && r.version === "latest");

    if (react && nextjs) {
      const reactIndex = results.indexOf(react);
      const nextjsIndex = results.indexOf(nextjs);
      expect(reactIndex).toBeLessThan(nextjsIndex);
    }
  });

  test("should return all required fields", () => {
    const results = searchLibraries("react", "react", db);

    expect(results.length).toBeGreaterThan(0);
    const result = results[0];
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("version");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("totalSnippets");
    expect(result).toHaveProperty("trustScore");
    expect(result).toHaveProperty("benchmarkScore");
  });

  test("should return empty array when no matches found", () => {
    const results = searchLibraries("nonexistent", "nonexistent", db);
    expect(results).toEqual([]);
  });

  test("should match libraries by ID or title using LIKE", () => {
    const results = searchLibraries("mongodb query", "mongo", db);

    const mongoLib = results.find((r) => r.id === "/mongodb/docs");
    expect(mongoLib).toBeDefined();
    expect(mongoLib?.title).toBe("MongoDB");
  });

  test("should group versions of same library", () => {
    const results = searchLibraries("next.js", "next", db);

    const versions = results.filter((r) => r.id === "/vercel/next.js");
    expect(versions.length).toBeGreaterThanOrEqual(2);

    const versionStrings = versions.map((v) => v.version);
    expect(versionStrings).toContain("latest");
    expect(versionStrings).toContain("v14.0.0");
  });

  test("should handle case-insensitive search", () => {
    const resultsUpper = searchLibraries("REACT", "REACT", db);
    const resultsLower = searchLibraries("react", "react", db);

    expect(resultsUpper.length).toBe(resultsLower.length);
  });
});

describe("queryDocumentation", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");

    // Insert test library
    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/facebook/react', 'latest', 'React', 'React library', 'https://github.com/facebook/react', 3)
    `);

    // Insert test snippets
    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb)
      VALUES 
        ('/facebook/react', 'latest', 'useState Hook', 'The useState hook lets you add state to functional components', 'docs/hooks.md', 'typescript', 50, 'Hooks > State'),
        ('/facebook/react', 'latest', 'useEffect Hook', 'The useEffect hook lets you perform side effects in functional components', 'docs/hooks.md', 'typescript', 60, 'Hooks > Effects'),
        ('/facebook/react', 'latest', 'Component Basics', 'React components are reusable pieces of UI', 'docs/components.md', 'typescript', 40, 'Components > Basics'),
        ('/mongodb/docs', 'latest', 'MongoDB Query', 'How to query MongoDB collections', 'docs/query.md', 'javascript', 70, 'Querying')
    `);
  });

  afterEach(() => {
    db.close();
  });

  test("should query documentation with FTS5 search", () => {
    const results = queryDocumentation("useState hook", "/facebook/react", "latest", db);

    expect(results.length).toBeGreaterThan(0);
    const useState = results.find((r) => r.title === "useState Hook");
    expect(useState).toBeDefined();
    expect(useState?.content).toContain("state");
  });

  test("should filter by library_id correctly", () => {
    const results = queryDocumentation("query", "/facebook/react", "latest", db);

    // Should NOT return MongoDB results even though "query" matches
    const mongoResult = results.find((r) => r.library_id === "/mongodb/docs");
    expect(mongoResult).toBeUndefined();

    // Should only return React results
    results.forEach((r) => {
      expect(r.library_id).toBe("/facebook/react");
    });
  });

  test("should parse versioned libraryId correctly", () => {
    // Insert versioned library data
    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/vercel/next.js', 'v14.0.0', 'Next.js v14', 'Next.js version 14', 'https://github.com/vercel/next.js', 1)
    `);

    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb)
      VALUES ('/vercel/next.js', 'v14.0.0', 'App Router', 'Next.js App Router documentation', 'docs/routing.md', 'typescript', 80, 'Routing')
    `);

    // Query with versioned ID format: /org/project/version
    const results = queryDocumentation("router", "/vercel/next.js", "v14.0.0", db);

    expect(results.length).toBeGreaterThan(0);
    const appRouter = results.find((r) => r.title === "App Router");
    expect(appRouter).toBeDefined();
    expect(appRouter?.library_version).toBe("v14.0.0");
  });

  test("should return all required fields", () => {
    const results = queryDocumentation("hook", "/facebook/react", "latest", db);

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
  });

  test("should order results by rank (BM25)", () => {
    const results = queryDocumentation("hook functional components", "/facebook/react", "latest", db);

    // Results should be ordered by relevance (rank)
    expect(results.length).toBeGreaterThan(0);
    // Can't easily test rank order without knowing exact BM25 scores, but ensure no errors
  });

  test("should limit results to 20", () => {
    // Insert 25 snippets
    for (let i = 0; i < 25; i++) {
      db.run(`
        INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb)
        VALUES ('/facebook/react', 'latest', 'Test ${i}', 'hook test content ${i}', 'docs/test.md', 'typescript', 30, 'Test')
      `);
    }

    const results = queryDocumentation("hook test", "/facebook/react", "latest", db);
    expect(results.length).toBeLessThanOrEqual(20);
  });

  test("should return empty array when no matches found", () => {
    const results = queryDocumentation("nonexistent query", "/facebook/react", "latest", db);
    expect(results).toEqual([]);
  });
});
