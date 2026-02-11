/**
 * Embedding Provider Abstraction
 * 
 * Defines interfaces and implementations for different embedding providers.
 * Allows switching between local models and remote APIs.
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

/**
 * Interface for embedding generation providers
 * Supports both single and batch embedding generation
 */
export interface EmbeddingProvider {
  readonly name: string;
  readonly modelName: string;
  readonly dimensions: number;
  generateEmbedding(text: string): Promise<number[] | null>;
  generateEmbeddings(texts: string[]): Promise<(number[] | null)[]>;
  isLoaded(): boolean;
}

/**
 * Local embedding provider using @xenova/transformers
 * Uses Xenova/all-MiniLM-L6-v2 model (384 dimensions)
 * 
 * Features:
 * - Lazy model loading (singleton pattern)
 * - Automatic text truncation to 256 tokens
 * - Mean pooling with normalization
 * - Fast inference (~50ms per embedding)
 */
export class LocalProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  readonly dimensions = 384;

  private static readonly MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
  private static readonly EMBEDDING_DIMENSIONS = 384;
  private static readonly MAX_TOKENS = 256;

  private extractor: FeatureExtractionPipeline | null = null;
  private loadingPromise: Promise<FeatureExtractionPipeline> | null = null;

  isLoaded(): boolean {
    return this.extractor !== null;
  }

  /**
   * Get or initialize the embedding model (singleton)
   * Loads model lazily on first use
   */
  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (this.extractor) {
      return this.extractor;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    console.log(`[Embeddings] Loading model: ${LocalProvider.MODEL_NAME}`);
    const startTime = Date.now();

    this.loadingPromise = pipeline('feature-extraction', LocalProvider.MODEL_NAME)
      .then((model) => {
        this.extractor = model as FeatureExtractionPipeline;
        const loadTime = Date.now() - startTime;
        console.log(`[Embeddings] Model loaded successfully in ${loadTime}ms`);
        this.loadingPromise = null;
        return this.extractor;
      })
      .catch((error) => {
        console.error('[Embeddings] Failed to load model:', error);
        this.loadingPromise = null;
        throw new Error(`Failed to load embedding model: ${error.message}`);
      });

    return this.loadingPromise;
  }

  /**
   * Truncate text to fit within model's max token limit
   * Simple character-based truncation (rough approximation of token limit)
   * Average token is ~4 characters, so 256 tokens ≈ 1000 characters
   */
  private truncateText(text: string): string {
    const maxCharsApproximation = LocalProvider.MAX_TOKENS * 4;
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
   * const provider = new LocalProvider();
   * const embedding = await provider.generateEmbedding("Hello world");
   * console.log(embedding.length); // 384
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    const truncated = this.truncateText(text.trim());

    try {
      const model = await this.getExtractor();

      const output = await model(truncated, {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = Array.from(output.data) as number[];

      if (embedding.length !== LocalProvider.EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding dimensions: ${embedding.length} (expected ${LocalProvider.EMBEDDING_DIMENSIONS})`
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
   * const provider = new LocalProvider();
   * const embeddings = await provider.generateEmbeddings(["text 1", "text 2"]);
   * console.log(embeddings.length); // 2
   * console.log(embeddings[0].length); // 384
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    const embeddings: (number[] | null)[] = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }
}
