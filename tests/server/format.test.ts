import { describe, it, expect } from "bun:test";
import {
  formatSearchResults,
  formatDocumentation,
  getSourceReputationLabel,
  wrapResponse,
} from "../../src/server/format";

describe("Response Formatting", () => {
  describe("getSourceReputationLabel", () => {
    it("returns 'High' for score >= 7", () => {
      expect(getSourceReputationLabel(7)).toBe("High");
      expect(getSourceReputationLabel(8)).toBe("High");
      expect(getSourceReputationLabel(10)).toBe("High");
    });

    it("returns 'Medium' for score >= 4 and < 7", () => {
      expect(getSourceReputationLabel(4)).toBe("Medium");
      expect(getSourceReputationLabel(5)).toBe("Medium");
      expect(getSourceReputationLabel(6)).toBe("Medium");
    });

    it("returns 'Low' for score < 4", () => {
      expect(getSourceReputationLabel(0)).toBe("Low");
      expect(getSourceReputationLabel(1)).toBe("Low");
      expect(getSourceReputationLabel(3)).toBe("Low");
    });

    it("returns 'Unknown' for undefined score", () => {
      expect(getSourceReputationLabel(undefined)).toBe("Unknown");
    });

    it("returns 'Unknown' for negative score", () => {
      expect(getSourceReputationLabel(-1)).toBe("Unknown");
    });
  });

  describe("formatSearchResults", () => {
    it("formats single search result with all fields", () => {
      const result = {
        results: [
          {
            title: "React",
            id: "/facebook/react",
            description: "A JavaScript library for building user interfaces",
            totalSnippets: 150,
            trustScore: 9,
            benchmarkScore: 95,
            versions: ["v18.2.0", "v19.0.0"],
          },
        ],
      };

      const output = formatSearchResults(result);

      // Check all required fields are present
      expect(output).toContain("- Title: React");
      expect(output).toContain("- Context7-compatible library ID: /facebook/react");
      expect(output).toContain(
        "- Description: A JavaScript library for building user interfaces"
      );
      expect(output).toContain("- Code Snippets: 150");
      expect(output).toContain("- Source Reputation: High");
      expect(output).toContain("- Benchmark Score: 95");
      expect(output).toContain("- Versions: v18.2.0, v19.0.0");
    });

    it("formats multiple results separated by ----------", () => {
      const result = {
        results: [
          {
            title: "React",
            id: "/facebook/react",
            description: "UI library",
            totalSnippets: 150,
            trustScore: 9,
          },
          {
            title: "Vue",
            id: "/vuejs/vue",
            description: "Progressive framework",
            totalSnippets: 100,
            trustScore: 8,
          },
        ],
      };

      const output = formatSearchResults(result);

      // Check separator is present
      expect(output).toContain("----------");
      expect(output.split("----------").length).toBe(2);

      // Check both titles are present
      expect(output).toContain("React");
      expect(output).toContain("Vue");
    });

    it("skips optional fields when values are invalid or undefined", () => {
      const result = {
        results: [
          {
            title: "TestLib",
            id: "/test/lib",
            description: "A test library",
            totalSnippets: -1,
            trustScore: 5,
            benchmarkScore: 0,
            versions: [],
          },
        ],
      };

      const output = formatSearchResults(result);

      // Should not contain invalid fields
      expect(output).not.toContain("Code Snippets:");
      expect(output).not.toContain("Benchmark Score:");
      expect(output).not.toContain("Versions:");

      // Should contain required fields
      expect(output).toContain("- Title: TestLib");
      expect(output).toContain("- Context7-compatible library ID: /test/lib");
      expect(output).toContain("- Description: A test library");
      expect(output).toContain("- Source Reputation: Medium");
    });

    it("returns 'No documentation libraries found' message for empty results", () => {
      const result = { results: [] };
      const output = formatSearchResults(result);

      expect(output).toBe("No documentation libraries found matching your query.");
    });

    it("returns 'No documentation libraries found' message when results is null", () => {
      const result = { results: null };
      const output = formatSearchResults(result);

      expect(output).toBe("No documentation libraries found matching your query.");
    });
  });

  describe("formatDocumentation", () => {
    it("formats single documentation snippet", () => {
      const snippets = [
        {
          title: "Getting Started",
          content: "Install with npm install react",
          breadcrumb: "Docs > Installation",
          language: "typescript",
          tokenCount: 10,
        },
      ];

      const output = formatDocumentation(snippets);

      expect(output).toContain("Getting Started");
      expect(output).toContain("Install with npm install react");
      expect(output).toContain("Docs > Installation");
    });

    it("formats multiple documentation snippets separated by ----------", () => {
      const snippets = [
        {
          title: "Installation",
          content: "npm install react",
          breadcrumb: "Docs > Setup",
          language: "bash",
          tokenCount: 5,
        },
        {
          title: "Usage",
          content: "import React from 'react'",
          breadcrumb: "Docs > Basics",
          language: "typescript",
          tokenCount: 8,
        },
      ];

      const output = formatDocumentation(snippets);

      // Check separator is present
      expect(output).toContain("----------");
      expect(output.split("----------").length).toBe(2);

      // Check both snippets are present
      expect(output).toContain("Installation");
      expect(output).toContain("Usage");
    });

    it("returns empty string for empty snippets array", () => {
      const snippets: any[] = [];
      const output = formatDocumentation(snippets);

      expect(output).toBe("");
    });

    it("formats snippet without breadcrumb", () => {
      const snippets = [
        {
          title: "Example",
          content: "Some code",
          breadcrumb: "",
          language: "javascript",
          tokenCount: 10,
        },
      ];

      const output = formatDocumentation(snippets);

      expect(output).toContain("Example");
      expect(output).toContain("Some code");
    });
  });

  describe("wrapResponse", () => {
    it("wraps text in MCP content array format", () => {
      const text = "Test response";
      const wrapped = wrapResponse(text);

      expect(wrapped).toHaveProperty("content");
      expect(Array.isArray(wrapped.content)).toBe(true);
      expect(wrapped.content[0]).toEqual({
        type: "text",
        text: "Test response",
      });
    });

    it("preserves multiline text in wrapped response", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const wrapped = wrapResponse(text);

      expect(wrapped.content[0].text).toBe("Line 1\nLine 2\nLine 3");
    });

    it("wraps empty string", () => {
      const text = "";
      const wrapped = wrapResponse(text);

      expect(wrapped.content[0].text).toBe("");
    });
  });
});
