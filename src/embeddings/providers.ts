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

/**
 * OpenAI embedding provider using OpenAI API
 * Supports text-embedding-3-small, text-embedding-3-large, and text-embedding-ada-002
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Rate limit handling (429)
 * - Batch processing (up to 100 texts per request)
 * - Error handling for auth, network, and server errors
 */
export class OpenAIProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly modelName: string;
  readonly dimensions: number;

  private apiKey: string;
  private apiUrl: string;
  private maxRetries = 3;
  private batchSize = 100;

  constructor(options: {
    apiKey: string;
    model?: string;
    apiUrl?: string;
  }) {
    this.apiKey = options.apiKey;
    this.modelName = options.model || 'text-embedding-3-small';
    this.apiUrl = options.apiUrl || 'https://api.openai.com/v1/embeddings';

    // Set dimensions based on model
    if (this.modelName === 'text-embedding-3-small') {
      this.dimensions = 1536;
    } else if (this.modelName === 'text-embedding-3-large') {
      this.dimensions = 3072;
    } else if (this.modelName === 'text-embedding-ada-002') {
      this.dimensions = 1536;
    } else {
      this.dimensions = 1536; // default
    }
  }

  isLoaded(): boolean {
    return true; // API always "loaded"
  }

  /**
   * Make API request with retry logic and exponential backoff
   * Retries on network errors, 5xx errors, and 429 rate limits
   */
  private async makeRequestWithRetry(
    input: string | string[],
    attempt: number = 0
  ): Promise<any> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          model: this.modelName,
        }),
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[OpenAI] Rate limited (429), retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(input, attempt + 1);
        }
        throw new Error('Rate limit exceeded after max retries');
      }

      // Handle unauthorized (401)
      if (response.status === 401) {
        throw new Error('OpenAI API authentication failed. Please check your API key.');
      }

      // Handle server errors (5xx)
      if (response.status >= 500) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[OpenAI] Server error (${response.status}), retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(input, attempt + 1);
        }
        throw new Error(`OpenAI API server error (${response.status}) after max retries`);
      }

      // Handle other client errors (4xx)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error(`[OpenAI] Client error (${response.status}):`, errorBody);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[OpenAI] Network error, retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(input, attempt + 1);
        }
        throw new Error('Network error after max retries');
      }
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   * 
   * @param text - Input text to embed
   * @returns Embedding vector (dimensions based on model), or null for empty text or errors
   * 
   * @example
   * const provider = new OpenAIProvider({ apiKey: 'sk-...' });
   * const embedding = await provider.generateEmbedding("Hello world");
   * console.log(embedding.length); // 1536 for text-embedding-3-small
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      const data = await this.makeRequestWithRetry(text);
      
      if (!data || !data.data || !data.data[0] || !data.data[0].embedding) {
        return null;
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error('[OpenAI] Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   * Processes in chunks of 100 texts per request
   * 
   * @param texts - Array of input texts
   * @returns Array of embeddings (null for empty texts or errors)
   * 
   * @example
   * const provider = new OpenAIProvider({ apiKey: 'sk-...' });
   * const embeddings = await provider.generateEmbeddings(["text 1", "text 2"]);
   * console.log(embeddings.length); // 2
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    const results: (number[] | null)[] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      
      // Filter out empty texts and track their indices
      const validTexts: string[] = [];
      const validIndices: number[] = [];
      
      for (let j = 0; j < batch.length; j++) {
        const text = batch[j];
        if (text && text.trim().length > 0) {
          validTexts.push(text);
          validIndices.push(j);
        }
      }

      // Initialize batch results with nulls
      const batchResults: (number[] | null)[] = new Array(batch.length).fill(null);

      // Process valid texts if any
      if (validTexts.length > 0) {
        try {
          const data = await this.makeRequestWithRetry(validTexts);
          
          if (data && data.data) {
            // Map embeddings back to their original positions
            for (let k = 0; k < validIndices.length; k++) {
              const validIdx = validIndices[k];
              if (validIdx !== undefined && data.data[k] && data.data[k].embedding) {
                batchResults[validIdx] = data.data[k].embedding;
              }
            }
          }
        } catch (error) {
          console.error('[OpenAI] Failed to generate batch embeddings:', error);
          // Leave as nulls for failed batch
        }
      }

      results.push(...batchResults);
    }

    return results;
  }
}
