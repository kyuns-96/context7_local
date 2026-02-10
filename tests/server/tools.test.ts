import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { openDatabase } from "../../src/db/connection";
import { handleResolveLibraryId, handleQueryDocs } from "../../src/server/tools";

describe("handleResolveLibraryId", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");

    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets, trust_score, benchmark_score)
      VALUES 
        ('/vercel/next.js', 'latest', 'Next.js', 'The React Framework for the Web', 'https://github.com/vercel/next.js', 500, 9.5, 95),
        ('/vercel/next.js', 'v14.0.0', 'Next.js v14', 'Next.js version 14', 'https://github.com/vercel/next.js', 450, 9.5, 95),
        ('/facebook/react', 'latest', 'React', 'A JavaScript library for building user interfaces', 'https://github.com/facebook/react', 800, 10.0, 98),
        ('/microsoft/typescript', 'latest', 'TypeScript', 'TypeScript is a superset of JavaScript', 'https://github.com/microsoft/typescript', 300, 8.0, 90)
    `);
  });

  afterEach(() => {
    db.close();
  });

  test("should return formatted search results with Context7 format", () => {
    const result = handleResolveLibraryId({ query: "react", libraryName: "react" }, db);

    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBe(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Available Libraries:");
    expect(result.content[0].text).toContain("Library ID:");
    expect(result.content[0].text).toContain("/facebook/react");
  });

  test("should include all required fields in response text", () => {
    const result = handleResolveLibraryId({ query: "next.js", libraryName: "next" }, db);

    const text = result.content[0].text;
    expect(text).toContain("Library ID:");
    expect(text).toContain("Name:");
    expect(text).toContain("Description:");
    expect(text).toContain("Code Snippets:");
    expect(text).toContain("Source Reputation:");
    expect(text).toContain("Benchmark Score:");
    expect(text).toContain("Versions:");
  });

  test("should group multiple versions in response", () => {
    const result = handleResolveLibraryId({ query: "next.js", libraryName: "next" }, db);

    const text = result.content[0].text;
    expect(text).toContain("latest");
    expect(text).toContain("v14.0.0");
  });

  test("should return appropriate message when no libraries found", () => {
    const result = handleResolveLibraryId(
      { query: "nonexistent", libraryName: "nonexistent" },
      db
    );

    const text = result.content[0].text;
    expect(text).toContain("No libraries found");
  });

  test("should map trust_score to Source Reputation labels", () => {
    const result = handleResolveLibraryId({ query: "react", libraryName: "react" }, db);

    const text = result.content[0].text;
    expect(text).toMatch(/Source Reputation: (High|Medium|Low|Unknown)/);
  });
});

describe("handleQueryDocs", () => {
  let db: Database;

  beforeEach(() => {
    db = openDatabase(":memory:");

    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/facebook/react', 'latest', 'React', 'React library', 'https://github.com/facebook/react', 2)
    `);

    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb)
      VALUES 
        ('/facebook/react', 'latest', 'useState Hook', 'The useState hook lets you add state to functional components', 'docs/hooks.md', 'typescript', 50, 'Hooks > State'),
        ('/facebook/react', 'latest', 'useEffect Hook', 'The useEffect hook lets you perform side effects in functional components', 'docs/hooks.md', 'typescript', 60, 'Hooks > Effects')
    `);
  });

  afterEach(() => {
    db.close();
  });

  test("should return formatted documentation snippets", () => {
    const result = handleQueryDocs(
      { query: "useState hook", libraryId: "/facebook/react/latest" },
      db
    );

    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBe(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("useState");
  });

  test("should parse versioned libraryId format /org/project/version", () => {
    db.run(`
      INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
      VALUES ('/vercel/next.js', 'v14.0.0', 'Next.js v14', 'Next.js version 14', 'https://github.com/vercel/next.js', 1)
    `);

    db.run(`
      INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb)
      VALUES ('/vercel/next.js', 'v14.0.0', 'App Router', 'Next.js App Router documentation', 'docs/routing.md', 'typescript', 80, 'Routing')
    `);

    const result = handleQueryDocs(
      { query: "router", libraryId: "/vercel/next.js/v14.0.0" },
      db
    );

    const text = result.content[0].text;
    expect(text).toContain("App Router");
  });

  test("should default to 'latest' version when not specified", () => {
    const result = handleQueryDocs(
      { query: "hook", libraryId: "/facebook/react" },
      db
    );

    const text = result.content[0].text;
    expect(text).toContain("Hook");
  });

  test("should return appropriate message when no documentation found", () => {
    const result = handleQueryDocs(
      { query: "nonexistent query terms", libraryId: "/facebook/react/latest" },
      db
    );

    const text = result.content[0].text;
    expect(text).toContain("No documentation found");
  });
});
