import { describe, test, expect } from "bun:test";
import { chunkDocument, type ChunkOptions } from "../../src/scraper/chunker";
import type { MarkdownSection } from "../../src/scraper/markdown";

describe("Document Chunker", () => {
  test("chunks document by H2/H3 boundaries", () => {
    const sections: MarkdownSection[] = [
      {
        heading: "Main Title",
        depth: 1,
        content: "Introduction text.",
        codeBlocks: [],
      },
      {
        heading: "Section One",
        depth: 2,
        content: "Content for section one.",
        codeBlocks: [],
      },
      {
        heading: "Section Two",
        depth: 2,
        content: "Content for section two.",
        codeBlocks: [],
      },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].title).toBe("Main Title");
    expect(chunks[1].title).toBe("Section One");
    expect(chunks[2].title).toBe("Section Two");
  });

  test("generates breadcrumbs from heading hierarchy", () => {
    const sections: MarkdownSection[] = [
      { heading: "Docs", depth: 1, content: "Root content.", codeBlocks: [] },
      {
        heading: "Routing",
        depth: 2,
        content: "Routing content.",
        codeBlocks: [],
      },
      {
        heading: "Middleware",
        depth: 3,
        content: "Middleware content.",
        codeBlocks: [],
      },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks[0].breadcrumb).toBe("Docs");
    expect(chunks[1].breadcrumb).toBe("Docs > Routing");
    expect(chunks[2].breadcrumb).toBe("Docs > Routing > Middleware");
  });

  test("calculates token count as Math.ceil(length / 4)", () => {
    const sections: MarkdownSection[] = [
      {
        heading: "Test",
        depth: 1,
        content: "a".repeat(100),
        codeBlocks: [],
      },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks[0].tokenCount).toBe(Math.ceil(100 / 4));
  });

  test("keeps code blocks complete in chunks", () => {
    const sections: MarkdownSection[] = [
      {
        heading: "Code Example",
        depth: 1,
        content: "Here is code.",
        codeBlocks: [
          {
            language: "javascript",
            value: "function hello() {\n  return 'world';\n}",
          },
        ],
      },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks[0].codeBlocks).toHaveLength(1);
    expect(chunks[0].codeBlocks[0].value).toContain("function hello()");
  });

  test("splits oversized sections at paragraph boundaries", () => {
    const longContent = Array(50)
      .fill("This is a paragraph with some content.")
      .join("\n\n");

    const sections: MarkdownSection[] = [
      {
        heading: "Long Section",
        depth: 1,
        content: longContent,
        codeBlocks: [],
      },
    ];

    const chunks = chunkDocument(sections, { maxChunkSize: 500 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(500);
    });
  });

  test("skips empty sections", () => {
    const sections: MarkdownSection[] = [
      { heading: "Empty", depth: 1, content: "", codeBlocks: [] },
      {
        heading: "Not Empty",
        depth: 2,
        content: "Has content.",
        codeBlocks: [],
      },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].title).toBe("Not Empty");
  });

  test("handles sections without headings", () => {
    const sections: MarkdownSection[] = [
      { heading: null, depth: 0, content: "No heading content.", codeBlocks: [] },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].title).toBe("");
    expect(chunks[0].content).toBe("No heading content.");
  });

  test("respects custom maxChunkSize option", () => {
    const sections: MarkdownSection[] = [
      {
        heading: "Test",
        depth: 1,
        content: "a".repeat(2000),
        codeBlocks: [],
      },
    ];

    const chunks = chunkDocument(sections, { maxChunkSize: 1000 });

    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(1000);
    });
  });

  test("preserves language annotation in code blocks", () => {
    const sections: MarkdownSection[] = [
      {
        heading: "TypeScript",
        depth: 1,
        content: "Example code.",
        codeBlocks: [
          { language: "typescript", value: "const x: number = 5;" },
        ],
      },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks[0].language).toBe("typescript");
  });

  test("handles deeply nested headings (H1 > H2 > H3 > H4)", () => {
    const sections: MarkdownSection[] = [
      { heading: "H1", depth: 1, content: "Level 1", codeBlocks: [] },
      { heading: "H2", depth: 2, content: "Level 2", codeBlocks: [] },
      { heading: "H3", depth: 3, content: "Level 3", codeBlocks: [] },
      { heading: "H4", depth: 4, content: "Level 4", codeBlocks: [] },
    ];

    const chunks = chunkDocument(sections);

    expect(chunks[3].breadcrumb).toBe("H1 > H2 > H3 > H4");
  });
});
