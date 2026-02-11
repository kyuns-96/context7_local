/**
 * Embedding Generation Service
 * 
 * Provides text embedding generation using pluggable provider backends.
 * Default: LocalProvider using Xenova/all-MiniLM-L6-v2 (384 dimensions)
 */

import { LocalProvider, type EmbeddingProvider } from './providers';

let provider: EmbeddingProvider = new LocalProvider();

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
