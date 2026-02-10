import { describe, test, expect } from "bun:test";
import { parseMarkdown } from "../../src/scraper/markdown";

describe("Markdown Parser", () => {
  test("parses simple markdown with single heading and paragraph", () => {
    const markdown = `# Hello World

This is a paragraph.`;

    const result = parseMarkdown(markdown);

    expect(result).toEqual([
      {
        heading: "Hello World",
        depth: 1,
        content: "This is a paragraph.",
        codeBlocks: [],
      },
    ]);
  });

  test("parses markdown with nested headings (H1 > H2 > H3)", () => {
    const markdown = `# Title

## Section One

Content for section one.

### Subsection

Content for subsection.`;

    const result = parseMarkdown(markdown);

    expect(result).toHaveLength(3);
    expect(result[0].heading).toBe("Title");
    expect(result[0].depth).toBe(1);
    expect(result[1].heading).toBe("Section One");
    expect(result[1].depth).toBe(2);
    expect(result[2].heading).toBe("Subsection");
    expect(result[2].depth).toBe(3);
  });

  test("parses markdown with code blocks", () => {
    const markdown = `# Code Example

Here is some code:

\`\`\`javascript
function hello() {
  console.log("world");
}
\`\`\`

And some more text.`;

    const result = parseMarkdown(markdown);

    expect(result[0].codeBlocks).toHaveLength(1);
    expect(result[0].codeBlocks[0]).toEqual({
      language: "javascript",
      value: 'function hello() {\n  console.log("world");\n}',
    });
  });

  test("handles markdown with no headings", () => {
    const markdown = `This is just a paragraph.

And another one.`;

    const result = parseMarkdown(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].heading).toBeNull();
    expect(result[0].content).toContain("This is just a paragraph");
  });

  test("strips frontmatter from markdown", () => {
    const markdown = `---
title: My Document
author: John Doe
---

# Heading

Content here.`;

    const result = parseMarkdown(markdown);

    expect(result[0].heading).toBe("Heading");
    expect(result[0].content).not.toContain("title:");
    expect(result[0].content).not.toContain("author:");
  });

  test("handles MDX with JSX components", () => {
    const markdown = `# React Component

<Button variant="primary">Click me</Button>

Regular text continues here.`;

    const result = parseMarkdown(markdown);

    expect(result[0].heading).toBe("React Component");
    // JSX should be stripped, keeping text content
    expect(result[0].content).toContain("Click me");
    expect(result[0].content).not.toContain("<Button");
  });

  test("handles code blocks without language annotation", () => {
    const markdown = `# Example

\`\`\`
plain code block
\`\`\``;

    const result = parseMarkdown(markdown);

    expect(result[0].codeBlocks).toHaveLength(1);
    expect(result[0].codeBlocks[0].language).toBeNull();
    expect(result[0].codeBlocks[0].value).toBe("plain code block");
  });

  test("groups content under correct heading", () => {
    const markdown = `# Main

Paragraph 1.

Paragraph 2.

## Sub

Sub content.`;

    const result = parseMarkdown(markdown);

    expect(result[0].heading).toBe("Main");
    expect(result[0].content).toContain("Paragraph 1");
    expect(result[0].content).toContain("Paragraph 2");
    expect(result[1].heading).toBe("Sub");
    expect(result[1].content).toContain("Sub content");
  });
});
