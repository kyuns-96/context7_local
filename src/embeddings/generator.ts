/**
 * Embedding Generation Service
 * 
 * Provides text embedding generation using pluggable provider backends.
 * Default: LocalProvider using Xenova/all-MiniLM-L6-v2 (384 dimensions)
 */

import { LocalProvider, OpenAIProvider, type EmbeddingProvider } from './providers';

let provider: EmbeddingProvider = new LocalProvider();

/**
 * Configuration for embedding provider initialization
 */
export interface ProviderConfig {
  provider?: 'local' | 'openai';
  apiKey?: string;
  model?: string;
  apiUrl?: string;
}

/**
 * Initialize embedding provider from config with environment variable fallback
 * Precedence: CLI options > environment variables > defaults
 * 
 * @param config - Provider configuration from CLI
 * @throws Error if openai provider selected but no API key provided
 * 
 * @example
 * initializeProvider({
 *   provider: 'openai',
 *   apiKey: 'sk-...',
 *   model: 'text-embedding-3-small'
 * });
 */
export function initializeProvider(config: ProviderConfig = {}): void {
  const providerType = config.provider || process.env.EMBEDDING_PROVIDER || 'local';
  
  if (providerType === 'openai') {
    const apiKey = config.apiKey || process.env.EMBEDDING_API_KEY;
    if (!apiKey) {
      throw new Error('EMBEDDING_API_KEY required for OpenAI provider (set via --embedding-api-key or EMBEDDING_API_KEY env var)');
    }
    
    setProvider(new OpenAIProvider({
      apiKey,
      model: config.model || process.env.EMBEDDING_MODEL,
      apiUrl: config.apiUrl || process.env.EMBEDDING_API_URL,
    }));
  } else {
    setProvider(new LocalProvider());
  }
}

/**
 * Set the embedding provider
 * Allows switching between local models and remote APIs
 * 
 * @param p - The provider implementation to use
 * 
 * @example
 * import { LocalProvider } from './providers';
 * setProvider(new LocalProvider());
 */
export function setProvider(p: EmbeddingProvider): void {
  provider = p;
}

/**
 * Generate embedding for a single text
 * 
 * @param text - Input text to embed
 * @returns 384-dimensional normalized embedding vector, or null for empty text
 * 
 * @example
 * const embedding = await generateEmbedding("Hello world");
 * console.log(embedding.length); // 384
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  return provider.generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * 
 * @param texts - Array of input texts
 * @returns Array of embeddings (null for empty texts)
 * 
 * @example
 * const embeddings = await generateEmbeddings(["text 1", "text 2"]);
 * console.log(embeddings.length); // 2
 * console.log(embeddings[0].length); // 384
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  return provider.generateEmbeddings(texts);
}

/**
 * Get embedding dimensions
 * Useful for validation and database schema setup
 */
export function getEmbeddingDimensions(): number {
  return provider.dimensions;
}

/**
 * Get model information
 * Useful for logging and debugging
 */
export function getModelInfo() {
  return {
    name: provider.modelName,
    dimensions: provider.dimensions,
    maxTokens: 256,
    loaded: provider.isLoaded(),
  };
}
