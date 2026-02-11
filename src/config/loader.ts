import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Configuration for embedding provider
 */
export interface EmbeddingConfig {
  provider?: 'local' | 'openai';
  apiKey?: string;
  model?: string;
  apiUrl?: string;
}

/**
 * Configuration for reranking provider
 */
export interface RerankingConfig {
  provider?: 'none' | 'local' | 'cohere' | 'jina';
  apiKey?: string;
  model?: string;
  apiUrl?: string;
}

/**
 * Root configuration object
 */
export interface ProviderConfig {
  embedding?: EmbeddingConfig;
  reranking?: RerankingConfig;
}

/**
 * Valid embedding provider values
 */
const VALID_EMBEDDING_PROVIDERS = ['local', 'openai'] as const;

/**
 * Valid reranking provider values
 */
const VALID_RERANKING_PROVIDERS = ['none', 'local', 'cohere', 'jina'] as const;

/**
 * Validates an embedding provider value
 */
function validateEmbeddingProvider(provider: unknown): provider is 'local' | 'openai' {
  return VALID_EMBEDDING_PROVIDERS.includes(provider as 'local' | 'openai');
}

/**
 * Validates a reranking provider value
 */
function validateRerankingProvider(provider: unknown): provider is 'none' | 'local' | 'cohere' | 'jina' {
  return VALID_RERANKING_PROVIDERS.includes(provider as 'none' | 'local' | 'cohere' | 'jina');
}

/**
 * Validates the entire config structure
 */
function validateConfig(config: unknown): asserts config is ProviderConfig {
  if (config === null || typeof config !== 'object') {
    throw new Error('Config must be a JSON object');
  }

  const obj = config as Record<string, unknown>;

  // Validate embedding config if present
  if (obj.embedding !== undefined) {
    if (obj.embedding === null || typeof obj.embedding !== 'object') {
      throw new Error('Config.embedding must be an object');
    }

    const embeddingCfg = obj.embedding as Record<string, unknown>;

    if (
      embeddingCfg.provider !== undefined &&
      !validateEmbeddingProvider(embeddingCfg.provider)
    ) {
      throw new Error(
        `Invalid embedding provider: "${embeddingCfg.provider}". ` +
        `Valid options are: ${VALID_EMBEDDING_PROVIDERS.join(', ')}`
      );
    }

    if (embeddingCfg.apiKey !== undefined && typeof embeddingCfg.apiKey !== 'string') {
      throw new Error('Config.embedding.apiKey must be a string');
    }

    if (embeddingCfg.model !== undefined && typeof embeddingCfg.model !== 'string') {
      throw new Error('Config.embedding.model must be a string');
    }

    if (embeddingCfg.apiUrl !== undefined && typeof embeddingCfg.apiUrl !== 'string') {
      throw new Error('Config.embedding.apiUrl must be a string');
    }

    // Warn if API provider is specified without API key
    if (
      embeddingCfg.provider === 'openai' &&
      !embeddingCfg.apiKey
    ) {
      console.warn('Warning: embedding provider is "openai" but no apiKey provided');
    }
  }

  // Validate reranking config if present
  if (obj.reranking !== undefined) {
    if (obj.reranking === null || typeof obj.reranking !== 'object') {
      throw new Error('Config.reranking must be an object');
    }

    const rerankingCfg = obj.reranking as Record<string, unknown>;

    if (
      rerankingCfg.provider !== undefined &&
      !validateRerankingProvider(rerankingCfg.provider)
    ) {
      throw new Error(
        `Invalid reranking provider: "${rerankingCfg.provider}". ` +
        `Valid options are: ${VALID_RERANKING_PROVIDERS.join(', ')}`
      );
    }

    if (rerankingCfg.apiKey !== undefined && typeof rerankingCfg.apiKey !== 'string') {
      throw new Error('Config.reranking.apiKey must be a string');
    }

    if (rerankingCfg.model !== undefined && typeof rerankingCfg.model !== 'string') {
      throw new Error('Config.reranking.model must be a string');
    }

    if (rerankingCfg.apiUrl !== undefined && typeof rerankingCfg.apiUrl !== 'string') {
      throw new Error('Config.reranking.apiUrl must be a string');
    }

    // Warn if API provider is specified without API key
    if (
      (rerankingCfg.provider === 'cohere' || rerankingCfg.provider === 'jina') &&
      !rerankingCfg.apiKey
    ) {
      console.warn(
        `Warning: reranking provider is "${rerankingCfg.provider}" but no apiKey provided`
      );
    }
  }
}

/**
 * Loads configuration from a JSON file
 *
 * @param configPath - Path to config file. If not specified, tries default paths.
 * @returns Parsed and validated configuration, or null if no config file found.
 * @throws Error if config file exists but is invalid JSON or fails validation.
 *
 * @example
 * ```ts
 * // Try default paths
 * const config = loadConfig();
 *
 * // Use specific path
 * const config = loadConfig('./custom-config.json');
 * ```
 */
export function loadConfig(configPath?: string): ProviderConfig | null {
  // Determine which paths to try
  const pathsToTry = configPath
    ? [configPath]
    : ['./config.json', './local_context7.config.json'];

  for (const path of pathsToTry) {
    const absolutePath = resolve(path);

    if (existsSync(absolutePath)) {
      try {
        const content = readFileSync(absolutePath, 'utf-8');

        // Parse JSON
        let config: unknown;
        try {
          config = JSON.parse(content);
        } catch (parseError) {
          const error = parseError as SyntaxError;
          throw new Error(
            `Invalid JSON in config file at ${absolutePath}: ${error.message}`
          );
        }

        // Validate structure and types
        validateConfig(config);

        return config;
      } catch (error) {
        // Re-throw validation and parse errors
        throw error;
      }
    }
  }

  // No config file found
  return null;
}
