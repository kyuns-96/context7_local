/**
 * Embedding Generation Service
 * 
 * Provides text embedding generation using Xenova/all-MiniLM-L6-v2 model.
 * - 384 dimensions
 * - Normalized vectors (magnitude ~1)
 * - Max 256 tokens input
 * - Fast inference (~50ms per embedding)
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSIONS = 384;
const MAX_TOKENS = 256;

let extractor: FeatureExtractionPipeline | null = null;
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Get or initialize the embedding model (singleton)
 * Loads model lazily on first use
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) {
    return extractor;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  console.log(`[Embeddings] Loading model: ${MODEL_NAME}`);
  const startTime = Date.now();

  loadingPromise = pipeline('feature-extraction', MODEL_NAME)
    .then((model) => {
      extractor = model as FeatureExtractionPipeline;
      const loadTime = Date.now() - startTime;
      console.log(`[Embeddings] Model loaded successfully in ${loadTime}ms`);
      loadingPromise = null;
      return extractor;
    })
    .catch((error) => {
      console.error('[Embeddings] Failed to load model:', error);
      loadingPromise = null;
      throw new Error(`Failed to load embedding model: ${error.message}`);
    });

  return loadingPromise;
}

/**
 * Truncate text to fit within model's max token limit
 * Simple character-based truncation (rough approximation of token limit)
 * Average token is ~4 characters, so 256 tokens ≈ 1000 characters
 */
function truncateText(text: string): string {
  const maxCharsApproximation = MAX_TOKENS * 4;
  if (text.length <= maxCharsApproximation) {
    return text;
  }
  return text.slice(0, maxCharsApproximation);
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
  if (!text || text.trim().length === 0) {
    return null;
  }

  const truncated = truncateText(text.trim());

  try {
    const model = await getExtractor();
    
    const output = await model(truncated, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data) as number[];

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Unexpected embedding dimensions: ${embedding.length} (expected ${EMBEDDING_DIMENSIONS})`
      );
    }

    return embedding;
  } catch (error) {
    console.error('[Embeddings] Failed to generate embedding:', error);
    throw new Error(`Failed to generate embedding: ${(error as Error).message}`);
  }
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
  const embeddings: (number[] | null)[] = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }

  return embeddings;
}

/**
 * Get embedding dimensions
 * Useful for validation and database schema setup
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Get model information
 * Useful for logging and debugging
 */
export function getModelInfo() {
  return {
    name: MODEL_NAME,
    dimensions: EMBEDDING_DIMENSIONS,
    maxTokens: MAX_TOKENS,
    loaded: extractor !== null,
  };
}
