import { describe, expect, it } from "bun:test";
import { loadPresets, getPreset, listPresets } from "../../src/cli/presets";
import type { PresetConfig, PresetListItem } from "../../src/cli/presets";

describe("presets", () => {
  describe("loadPresets", () => {
    it("loads all presets from data/presets.json", () => {
      const presets = loadPresets();
      expect(presets).toBeDefined();
      expect(typeof presets).toBe("object");
    });

    it("returns exactly 30 presets", () => {
      const presets = loadPresets();
      const count = Object.keys(presets).length;
      expect(count).toBe(30);
    });

    it("contains all required web framework presets", () => {
      const presets = loadPresets();
      const webLibraries = ["react", "nextjs", "typescript", "nodejs", "express", "vue", "angular", "svelte", "tailwindcss", "prisma"];
      webLibraries.forEach((lib) => {
        expect(presets[lib]).toBeDefined();
      });
    });

    it("contains all required Python framework presets", () => {
      const presets = loadPresets();
      const pythonLibraries = ["django", "flask", "fastapi", "sqlalchemy", "pydantic", "celery", "pytest", "numpy", "pandas", "requests"];
      pythonLibraries.forEach((lib) => {
        expect(presets[lib]).toBeDefined();
      });
    });

    it("contains all new language presets", () => {
      const presets = loadPresets();
      const newLanguages = ["rust-book", "dotnet", "rails", "laravel", "swift", "kotlin"];
      newLanguages.forEach((lib) => {
        expect(presets[lib]).toBeDefined();
      });
    });

    it("contains all new DevOps presets", () => {
      const presets = loadPresets();
      const devOps = ["docker", "kubernetes", "ansible", "helm"];
      devOps.forEach((lib) => {
        expect(presets[lib]).toBeDefined();
      });
    });

    it("each preset has all required fields", () => {
      const presets = loadPresets();
      Object.entries(presets).forEach(([name, config]) => {
        expect(config.repo).toBeDefined();
        expect(typeof config.repo).toBe("string");
        expect(config.repo.includes("github.com")).toBe(true);

        expect(config.docsPath).toBeDefined();
        expect(typeof config.docsPath).toBe("string");

        expect(config.title).toBeDefined();
        expect(typeof config.title).toBe("string");

        expect(config.description).toBeDefined();
        expect(typeof config.description).toBe("string");
      });
    });

    it("versions field is a non-empty string array when present", () => {
      const presets = loadPresets();
      Object.entries(presets).forEach(([name, config]) => {
        if (config.versions !== undefined) {
          expect(Array.isArray(config.versions)).toBe(true);
          expect(config.versions.length).toBeGreaterThanOrEqual(1);
          config.versions.forEach((v) => {
            expect(typeof v).toBe("string");
            expect(v.length).toBeGreaterThan(0);
          });
        }
      });
    });

    it("throws error if presets file not found", () => {
      const originalCwd = process.cwd;
      try {
        process.cwd = () => "/nonexistent/path";
        expect(() => loadPresets()).toThrow();
      } finally {
        process.cwd = originalCwd;
      }
    });
  });

  describe("getPreset", () => {
    it("returns preset configuration for valid preset name", () => {
      const preset = getPreset("react");
      expect(preset).toBeDefined();
      expect(preset?.title).toBe("React");
      expect(preset?.repo).toBe("https://github.com/reactjs/react.dev");
      expect(preset?.docsPath).toBe("src/content");
    });

    it("returns correct config for different presets", () => {
      const django = getPreset("django");
      expect(django?.title).toBe("Django");
      expect(django?.repo).toContain("django/django");

      const nextjs = getPreset("nextjs");
      expect(nextjs?.title).toBe("Next.js");
      expect(nextjs?.repo).toContain("vercel/next.js");
    });

    it("returns null for non-existent preset", () => {
      const preset = getPreset("nonexistent");
      expect(preset).toBeNull();
    });

    it("returns null for case-sensitive mismatches", () => {
      const preset = getPreset("React");
      expect(preset).toBeNull();
    });

    it("each returned preset has complete configuration", () => {
      const preset = getPreset("express");
      expect(preset).toBeDefined();
      expect(preset?.repo).toBeDefined();
      expect(preset?.docsPath).toBeDefined();
      expect(preset?.title).toBeDefined();
      expect(preset?.description).toBeDefined();
    });

    it("returns versions for presets that have them", () => {
      const django = getPreset("django");
      expect(django?.versions).toBeDefined();
      expect(Array.isArray(django?.versions)).toBe(true);
      expect(django?.versions?.[0]).toBeDefined();
    });

    it("returns undefined versions for presets without them", () => {
      const express = getPreset("express");
      expect(express?.versions).toBeUndefined();

      const react = getPreset("react");
      expect(react?.versions).toBeUndefined();
    });
  });

  describe("listPresets", () => {
    it("returns array of preset list items", () => {
      const items = listPresets();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBe(30);
    });

    it("each list item has required fields", () => {
      const items = listPresets();
      items.forEach((item) => {
        expect(item.name).toBeDefined();
        expect(typeof item.name).toBe("string");
        expect(item.title).toBeDefined();
        expect(typeof item.title).toBe("string");
        expect(item.description).toBeDefined();
        expect(typeof item.description).toBe("string");
      });
    });

    it("returns items sorted alphabetically by name", () => {
      const items = listPresets();
      const names = items.map((item) => item.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it("contains all 30 presets with correct names", () => {
      const items = listPresets();
      const names = items.map((item) => item.name);
      expect(names).toContain("react");
      expect(names).toContain("django");
      expect(names).toContain("fastapi");
      expect(names).toContain("tailwindcss");
      expect(names).toContain("rust-book");
      expect(names).toContain("docker");
      expect(names).toContain("kubernetes");
      expect(names).toContain("rails");
    });

    it("maps preset names to correct titles and descriptions", () => {
      const items = listPresets();
      const react = items.find((item) => item.name === "react");
      expect(react?.title).toBe("React");
      expect(react?.description).toContain("JavaScript library");

      const django = items.find((item) => item.name === "django");
      expect(django?.title).toBe("Django");
      expect(django?.description).toContain("Python");
    });
  });

  describe("preset configuration validation", () => {
    it("all repository URLs are valid GitHub HTTPS URLs", () => {
      const presets = loadPresets();
      Object.values(presets).forEach((config) => {
        expect(config.repo).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
      });
    });

    it("all docsPath values are non-empty strings", () => {
      const presets = loadPresets();
      Object.values(presets).forEach((config) => {
        expect(config.docsPath.length).toBeGreaterThan(0);
      });
    });

    it("all titles are capitalized or contain keywords", () => {
      const presets = loadPresets();
      Object.values(presets).forEach((config) => {
        expect(config.title.length).toBeGreaterThan(0);
        const firstChar = config.title.charAt(0);
        expect(firstChar).toMatch(/[A-Z0-9.]/);
      });
    });

    it("all descriptions contain useful information", () => {
      const presets = loadPresets();
      Object.values(presets).forEach((config) => {
        expect(config.description.length).toBeGreaterThan(20);
      });
    });

    it("vue preset points to correct docs repo", () => {
      const vue = getPreset("vue");
      expect(vue?.repo).toBe("https://github.com/vuejs/docs");
      expect(vue?.docsPath).toBe("src/guide");
    });

    it("angular preset uses updated docsPath", () => {
      const angular = getPreset("angular");
      expect(angular?.docsPath).toBe("adev/src/content");
    });
  });
});
