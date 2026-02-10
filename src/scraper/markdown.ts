import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, Content, Heading, Code, Paragraph, Text } from "mdast";

export interface MarkdownSection {
  heading: string | null;
  depth: number;
  content: string;
  codeBlocks: Array<{ language: string | null; value: string }>;
}

export function parseMarkdown(markdown: string): MarkdownSection[] {
  const strippedMarkdown = stripFrontmatter(markdown);

  const processor = unified().use(remarkParse).use(remarkGfm);
  const ast = processor.parse(strippedMarkdown) as Root;

  const sections: MarkdownSection[] = [];
  let currentSection: MarkdownSection | null = null;

  function ensureSection(): MarkdownSection {
    if (!currentSection) {
      currentSection = {
        heading: null,
        depth: 0,
        content: "",
        codeBlocks: [],
      };
    }
    return currentSection;
  }

  function processNode(node: Content) {
    if (node.type === "heading") {
      if (currentSection) {
        sections.push(currentSection);
      }

      const headingNode = node as Heading;
      currentSection = {
        heading: extractText(headingNode),
        depth: headingNode.depth,
        content: "",
        codeBlocks: [],
      };
    } else if (node.type === "code") {
      const codeNode = node as Code;
      const section = ensureSection();
      section.codeBlocks.push({
        language: codeNode.lang || null,
        value: codeNode.value,
      });
    } else if (node.type === "paragraph") {
      const paragraphNode = node as Paragraph;
      const section = ensureSection();
      const text = extractText(paragraphNode);
      section.content = section.content ? `${section.content}\n\n${text}` : text;
    }
  }

  ast.children.forEach(processNode);

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function stripFrontmatter(markdown: string): string {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  return markdown.replace(frontmatterRegex, "");
}

function extractText(node: Heading | Paragraph): string {
  let text = "";

  function traverse(n: any): void {
    if (n.type === "text") {
      text += (n as Text).value;
    } else if (n.type === "html") {
      const htmlContent = n.value as string;
      const textMatch = htmlContent.match(/>([^<]+)</);
      if (textMatch) {
        text += textMatch[1];
      }
    } else if (n.children) {
      n.children.forEach(traverse);
    }
  }

  traverse(node);
  return text;
}
