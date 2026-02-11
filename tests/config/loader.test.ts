import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { type ProviderConfig, loadConfig } from '../../src/config/loader';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from 'fs';
import { resolve } from 'path';

describe('loadConfig', () => {
  const TEST_DIR = './test-config-dir';
  const TEST_CONFIG_PATH = `${TEST_DIR}/test-config.json`;
  const DEFAULT_PATH_1 = './config.json';
  const DEFAULT_PATH_2 = './local_context7.config.json';

  beforeEach(() => {
    // Ensure test directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    const pathsToClean = [
      TEST_CONFIG_PATH,
      DEFAULT_PATH_1,
      DEFAULT_PATH_2,
    ];

    for (const path of pathsToClean) {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    }

    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      try {
        rmdirSync(TEST_DIR);
      } catch {
        // Directory might not be empty, ignore
      }
    }
  });

  // ============================================================================
  // VALID CONFIGURATION TESTS
  // ============================================================================

  describe('Valid Configurations', () => {
    test('loads valid config with embedding only', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: 'sk-test123' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding?.provider).toBe('openai');
      expect(result?.embedding?.apiKey).toBe('sk-test123');
      expect(result?.reranking).toBeUndefined();
    });

    test('loads valid config with reranking only', () => {
      const config = {
        reranking: { provider: 'cohere', apiKey: 'co-test456' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding).toBeUndefined();
      expect(result?.reranking?.provider).toBe('cohere');
      expect(result?.reranking?.apiKey).toBe('co-test456');
    });

    test('loads valid config with both embedding and reranking', () => {
      const config = {
        embedding: {
          provider: 'openai',
          apiKey: 'sk-test123',
          model: 'text-embedding-3-small',
        },
        reranking: {
          provider: 'jina',
          apiKey: 'jina-test789',
          model: 'jina-reranker-v1-base-en',
        },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding?.provider).toBe('openai');
      expect(result?.embedding?.model).toBe('text-embedding-3-small');
      expect(result?.reranking?.provider).toBe('jina');
      expect(result?.reranking?.model).toBe('jina-reranker-v1-base-en');
    });

    test('loads config with all valid embedding providers', () => {
      for (const provider of ['local', 'openai'] as const) {
        const config = {
          embedding: { provider },
        };
        writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        const result = loadConfig(TEST_CONFIG_PATH);

        expect(result).not.toBeNull();
        expect(result?.embedding?.provider).toBe(provider);
      }
    });

    test('loads config with all valid reranking providers', () => {
      for (const provider of ['none', 'local', 'cohere', 'jina'] as const) {
        const config = {
          reranking: { provider },
        };
        writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        const result = loadConfig(TEST_CONFIG_PATH);

        expect(result).not.toBeNull();
        expect(result?.reranking?.provider).toBe(provider);
      }
    });

    test('loads config with optional fields (model, apiUrl)', () => {
      const config = {
        embedding: {
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'text-embedding-3-large',
          apiUrl: 'https://api.openai.com/v1',
        },
        reranking: {
          provider: 'jina',
          apiKey: 'jina-test',
          model: 'jina-reranker-v1',
          apiUrl: 'https://api.jina.ai/v1',
        },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding?.model).toBe('text-embedding-3-large');
      expect(result?.embedding?.apiUrl).toBe('https://api.openai.com/v1');
      expect(result?.reranking?.model).toBe('jina-reranker-v1');
      expect(result?.reranking?.apiUrl).toBe('https://api.jina.ai/v1');
    });

    test('loads minimal config (empty objects)', () => {
      const config = {
        embedding: {},
        reranking: {},
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding).toBeDefined();
      expect(result?.reranking).toBeDefined();
    });

    test('loads config from custom path', () => {
      const customPath = `${TEST_DIR}/custom-config.json`;
      const config = { embedding: { provider: 'local' } };
      writeFileSync(customPath, JSON.stringify(config));

      const result = loadConfig(customPath);

      expect(result).not.toBeNull();
      expect(result?.embedding?.provider).toBe('local');

      // Cleanup
      unlinkSync(customPath);
    });

    test('loads from first default path (./config.json)', () => {
      const config = { embedding: { provider: 'local' } };
      writeFileSync(DEFAULT_PATH_1, JSON.stringify(config));

      const result = loadConfig();

      expect(result).not.toBeNull();
      expect(result?.embedding?.provider).toBe('local');
    });

    test('falls back to second default path (./local_context7.config.json)', () => {
      const config = { reranking: { provider: 'none' } };
      writeFileSync(DEFAULT_PATH_2, JSON.stringify(config));

      const result = loadConfig();

      expect(result).not.toBeNull();
      expect(result?.reranking?.provider).toBe('none');
    });

    test('prefers first default path over second', () => {
      const config1 = { embedding: { provider: 'openai' } };
      const config2 = { embedding: { provider: 'local' } };
      writeFileSync(DEFAULT_PATH_1, JSON.stringify(config1));
      writeFileSync(DEFAULT_PATH_2, JSON.stringify(config2));

      const result = loadConfig();

      expect(result?.embedding?.provider).toBe('openai');
    });
  });

  // ============================================================================
  // INVALID PROVIDER VALUES TESTS
  // ============================================================================

  describe('Invalid Provider Values', () => {
    test('throws on invalid embedding provider', () => {
      const config = {
        embedding: { provider: 'invalid-provider' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Invalid embedding provider: "invalid-provider". Valid options are: local, openai'
      );
    });

    test('throws on invalid reranking provider', () => {
      const config = {
        reranking: { provider: 'invalid-provider' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Invalid reranking provider: "invalid-provider". Valid options are: none, local, cohere, jina'
      );
    });

    test('error message includes valid embedding provider options', () => {
      const config = {
        embedding: { provider: 'claude' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      try {
        loadConfig(TEST_CONFIG_PATH);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('local');
        expect(message).toContain('openai');
      }
    });

    test('error message includes valid reranking provider options', () => {
      const config = {
        reranking: { provider: 'openai' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      try {
        loadConfig(TEST_CONFIG_PATH);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('none');
        expect(message).toContain('local');
        expect(message).toContain('cohere');
        expect(message).toContain('jina');
      }
    });

    test('throws on numeric provider value', () => {
      const config = {
        embedding: { provider: 123 },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow('Invalid embedding provider');
    });

    test('throws on provider null value', () => {
      const config = {
        reranking: { provider: null },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow('Invalid reranking provider');
    });
  });

  // ============================================================================
  // INVALID FIELD TYPES TESTS
  // ============================================================================

  describe('Invalid Field Types', () => {
    test('throws on embedding.apiKey not a string', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: 123 },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.embedding.apiKey must be a string'
      );
    });

    test('throws on embedding.apiKey as object', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: {} },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.embedding.apiKey must be a string'
      );
    });

    test('throws on embedding.model not a string', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: 'sk-test', model: 42 },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.embedding.model must be a string'
      );
    });

    test('throws on embedding.apiUrl not a string', () => {
      const config = {
        embedding: {
          provider: 'openai',
          apiKey: 'sk-test',
          apiUrl: ['https://api.openai.com'],
        },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.embedding.apiUrl must be a string'
      );
    });

    test('throws on reranking.apiKey not a string', () => {
      const config = {
        reranking: { provider: 'cohere', apiKey: true },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.reranking.apiKey must be a string'
      );
    });

    test('throws on reranking.model not a string', () => {
      const config = {
        reranking: {
          provider: 'jina',
          apiKey: 'jina-test',
          model: ['jina-reranker'],
        },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.reranking.model must be a string'
      );
    });

    test('throws on reranking.apiUrl not a string', () => {
      const config = {
        reranking: { provider: 'cohere', apiKey: 'co-test', apiUrl: 123 },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.reranking.apiUrl must be a string'
      );
    });

    test('throws on embedding not an object', () => {
      const config = {
        embedding: 'invalid-string',
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.embedding must be an object'
      );
    });

    test('throws on embedding null', () => {
      const config = {
        embedding: null,
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.embedding must be an object'
      );
    });

    test('throws on reranking not an object (is number)', () => {
      const config = {
        reranking: 42,
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.reranking must be an object'
      );
    });

    test('throws on reranking null', () => {
      const config = {
        reranking: null,
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config.reranking must be an object'
      );
    });
  });

  // ============================================================================
  // INVALID JSON TESTS
  // ============================================================================

  describe('Invalid JSON', () => {
    test('throws on invalid JSON syntax', () => {
      const invalidJson = '{ "embedding": { "provider": "openai" }';
      writeFileSync(TEST_CONFIG_PATH, invalidJson);

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow('Invalid JSON in config file');
    });

    test('error message includes path without double path', () => {
      const invalidJson = '{ broken json }';
      writeFileSync(TEST_CONFIG_PATH, invalidJson);

      try {
        loadConfig(TEST_CONFIG_PATH);
        expect(true).toBe(false);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Invalid JSON');
        expect(message).toContain('test-config.json');
      }
    });

    test('throws on config file with trailing comma', () => {
      const invalidJson = '{ "embedding": { "provider": "openai", }, }';
      writeFileSync(TEST_CONFIG_PATH, invalidJson);

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow('Invalid JSON in config file');
    });

    test('allows JSON array (passes as object since arrays are objects)', () => {
      const config = [{ embedding: { provider: 'openai' } }];
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
    });

    test('throws when config is a JSON string', () => {
      const config = '"just a string"';
      writeFileSync(TEST_CONFIG_PATH, config);

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config must be a JSON object'
      );
    });

    test('throws when config is a JSON number', () => {
      const config = '42';
      writeFileSync(TEST_CONFIG_PATH, config);

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config must be a JSON object'
      );
    });

    test('throws when config is null', () => {
      const config = 'null';
      writeFileSync(TEST_CONFIG_PATH, config);

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Config must be a JSON object'
      );
    });
  });

  // ============================================================================
  // MISSING FILES TESTS
  // ============================================================================

  describe('Missing Config Files', () => {
    test('returns null when custom path file not found', () => {
      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).toBeNull();
    });

    test('returns null when no default config files exist', () => {
      const result = loadConfig();

      expect(result).toBeNull();
    });

    test('returns null for non-existent custom path', () => {
      const nonExistentPath = `${TEST_DIR}/does-not-exist.json`;

      const result = loadConfig(nonExistentPath);

      expect(result).toBeNull();
    });

    test('does not throw error when file missing (returns null)', () => {
      expect(() => {
        loadConfig(TEST_CONFIG_PATH);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // WARNING CASES TESTS
  // ============================================================================

  describe('Warning Cases (Missing API Keys)', () => {
    let originalWarn: typeof console.warn;
    let warnCalls: string[] = [];

    beforeEach(() => {
      originalWarn = console.warn;
      warnCalls = [];
      console.warn = (msg: string) => {
        warnCalls.push(msg);
      };
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    test('warns when embedding provider is openai without apiKey', () => {
      const config = {
        embedding: { provider: 'openai' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0]).toContain('openai');
      expect(warnCalls[0]).toContain('apiKey');
    });

    test('does not warn when embedding is openai with apiKey', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: 'sk-test' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(0);
    });

    test('does not warn when embedding provider is local', () => {
      const config = {
        embedding: { provider: 'local' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(0);
    });

    test('warns when reranking provider is cohere without apiKey', () => {
      const config = {
        reranking: { provider: 'cohere' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0]).toContain('cohere');
      expect(warnCalls[0]).toContain('apiKey');
    });

    test('warns when reranking provider is jina without apiKey', () => {
      const config = {
        reranking: { provider: 'jina' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0]).toContain('jina');
      expect(warnCalls[0]).toContain('apiKey');
    });

    test('does not warn when reranking provider is cohere with apiKey', () => {
      const config = {
        reranking: { provider: 'cohere', apiKey: 'co-test' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(0);
    });

    test('does not warn when reranking provider is jina with apiKey', () => {
      const config = {
        reranking: { provider: 'jina', apiKey: 'jina-test' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(0);
    });

    test('does not warn when reranking provider is none or local', () => {
      for (const provider of ['none', 'local']) {
        warnCalls = [];
        const config = {
          reranking: { provider: provider as 'none' | 'local' },
        };
        writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        loadConfig(TEST_CONFIG_PATH);

        expect(warnCalls.length).toBe(0);
      }
    });

    test('warns for both embedding and reranking when both missing apiKey', () => {
      const config = {
        embedding: { provider: 'openai' },
        reranking: { provider: 'cohere' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      loadConfig(TEST_CONFIG_PATH);

      expect(warnCalls.length).toBe(2);
      expect(warnCalls.some(msg => msg.includes('openai'))).toBe(true);
      expect(warnCalls.some(msg => msg.includes('cohere'))).toBe(true);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    test('handles empty config file (empty object)', () => {
      writeFileSync(TEST_CONFIG_PATH, '{}');

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding).toBeUndefined();
      expect(result?.reranking).toBeUndefined();
    });

    test('handles config with extra unknown fields', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: 'sk-test' },
        unknownField: 'should be ignored',
        anotherField: { nested: true },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding?.provider).toBe('openai');
    });

    test('handles config with empty string apiKey (allowed)', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: '' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding?.apiKey).toBe('');
    });

    test('handles very long strings in fields', () => {
      const longString = 'a'.repeat(10000);
      const config = {
        embedding: {
          provider: 'openai',
          apiKey: longString,
          model: longString,
        },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding?.apiKey?.length).toBe(10000);
    });

    test('handles config with whitespace-only model name', () => {
      const config = {
        embedding: { provider: 'openai', apiKey: 'sk-test', model: '   ' },
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const result = loadConfig(TEST_CONFIG_PATH);

      expect(result).not.toBeNull();
      expect(result?.embedding?.model).toBe('   ');
    });

    test('handles absolute paths correctly', () => {
      const absolutePath = resolve(TEST_CONFIG_PATH);
      const config = { embedding: { provider: 'local' } };
      writeFileSync(absolutePath, JSON.stringify(config));

      const result = loadConfig(absolutePath);

      expect(result).not.toBeNull();
      expect(result?.embedding?.provider).toBe('local');
    });

    test('handles relative paths with multiple segments', () => {
      const customPath = `${TEST_DIR}/subdir/config.json`;
      mkdirSync(`${TEST_DIR}/subdir`, { recursive: true });
      const config = { embedding: { provider: 'local' } };
      writeFileSync(customPath, JSON.stringify(config));

      const result = loadConfig(customPath);

      expect(result).not.toBeNull();

      // Cleanup
      unlinkSync(customPath);
    });
  });
});
