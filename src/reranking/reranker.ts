/**
 * Reranking Provider Abstraction
 * 
 * Defines interfaces and implementations for different reranking providers.
 * Rerankers improve search quality by re-scoring candidate documents
 * based on their relevance to the query using cross-encoder models or APIs.
 */

import { pipeline, type TextClassificationPipeline } from '@xenova/transformers';

/**
 * Ranked result with relevance score
 */
export interface RankedResult {
  content: string;
  score: number;
  originalIndex: number;
}

/**
 * Interface for reranking providers
 * Supports reranking a list of documents based on query relevance
 */
export interface Reranker {
  readonly name: string;
  readonly modelName: string;
  rerank(query: string, documents: string[], topN?: number): Promise<RankedResult[]>;
  isLoaded(): boolean;
}

/**
 * No-op reranker (pass-through)
 * Returns documents in original order with uniform scores
 * 
 * Use Cases:
 * - Disabling reranking for testing
 * - Baseline comparisons
 * - Environments where reranking is not needed
 */
export class NoOpReranker implements Reranker {
  readonly name = 'none';
  readonly modelName = 'none';

  isLoaded(): boolean {
    return true;
  }

  /**
   * Return documents in original order with slight score decay
   * 
   * @param query - Query string (unused)
   * @param documents - Documents to "rerank"
   * @param topN - Optional limit on number of results
   * @returns Documents in original order with uniform scores
   */
  async rerank(query: string, documents: string[], topN?: number): Promise<RankedResult[]> {
    const results = documents.map((content, index) => ({
      content,
      score: 1.0 - (index * 0.01), // Slight decay to preserve order
      originalIndex: index
    }));

    return topN ? results.slice(0, topN) : results;
  }
}

/**
 * Local reranker using cross-encoder model
 * Uses cross-encoder/ms-marco-MiniLM-L-6-v2 (~80MB)
 * 
 * Features:
 * - Lazy model loading (singleton pattern)
 * - Cross-encoder architecture for accurate relevance scoring
 * - No internet required after initial download
 * - ~200ms for 100 documents
 * 
 * Model Details:
 * - Architecture: Cross-encoder (queries and documents processed together)
 * - Training: MS MARCO passage ranking dataset
 * - Output: Single relevance score per query-document pair
 */
export class LocalReranker implements Reranker {
  readonly name = 'local';
  readonly modelName = 'cross-encoder/ms-marco-MiniLM-L-6-v2';

  private static readonly MODEL_NAME = 'cross-encoder/ms-marco-MiniLM-L-6-v2';

  private classifier: TextClassificationPipeline | null = null;
  private loadingPromise: Promise<TextClassificationPipeline> | null = null;

  isLoaded(): boolean {
    return this.classifier !== null;
  }

  /**
   * Get or initialize the cross-encoder model (singleton)
   * Loads model lazily on first use
   */
  private async getClassifier(): Promise<TextClassificationPipeline> {
    if (this.classifier) {
      return this.classifier;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    console.log(`[Reranking] Loading model: ${LocalReranker.MODEL_NAME}`);
    const startTime = Date.now();

    this.loadingPromise = pipeline('text-classification', LocalReranker.MODEL_NAME)
      .then((model) => {
        this.classifier = model as TextClassificationPipeline;
        const loadTime = Date.now() - startTime;
        console.log(`[Reranking] Model loaded successfully in ${loadTime}ms`);
        this.loadingPromise = null;
        return this.classifier;
      })
      .catch((error) => {
        console.error('[Reranking] Failed to load model:', error);
        this.loadingPromise = null;
        throw new Error(`Failed to load reranking model: ${error.message}`);
      });

    return this.loadingPromise;
  }

  /**
   * Rerank documents using cross-encoder model
   * 
   * @param query - Search query
   * @param documents - List of candidate documents
   * @param topN - Optional limit on number of results to return
   * @returns Ranked results sorted by relevance score (highest first)
   * 
   * @example
   * const reranker = new LocalReranker();
   * const results = await reranker.rerank(
   *   "What is React?",
   *   ["React is a JavaScript library", "Python is a programming language", "React Native for mobile"]
   * );
   * console.log(results[0].content); // "React is a JavaScript library"
   * console.log(results[0].score); // 0.95
   */
  async rerank(query: string, documents: string[], topN?: number): Promise<RankedResult[]> {
    if (documents.length === 0) {
      return [];
    }

    try {
      const model = await this.getClassifier();

      // Score each document with the cross-encoder
      // Input format: "query [SEP] document"
      const scoringPromises = documents.map(async (doc, index) => {
        const input = `${query} [SEP] ${doc}`;
        const output = await model(input);
        
        let score = 0.5;
        if (Array.isArray(output) && output.length > 0) {
          const firstResult = output[0];
          if (firstResult && typeof firstResult === 'object' && 'score' in firstResult) {
            score = (firstResult as any).score;
          }
        }

        return {
          content: doc,
          score,
          originalIndex: index
        };
      });

      const results = await Promise.all(scoringPromises);

      // Sort by score descending (highest relevance first)
      results.sort((a, b) => b.score - a.score);

      // Return top N if specified
      return topN ? results.slice(0, topN) : results;
    } catch (error) {
      console.error('[Reranking] Failed to rerank documents:', error);
      throw new Error(`Failed to rerank documents: ${(error as Error).message}`);
    }
  }
}

/**
 * Cohere reranker using Cohere API
 * Uses rerank-english-v3.0 model (or custom model)
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Rate limit handling (429)
 * - Batch processing (up to 1000 documents per request)
 * - High-quality reranking with state-of-the-art models
 * 
 * Pricing:
 * - ~$2 per 1000 requests
 * - Free tier available for testing
 */
export class CohereReranker implements Reranker {
  readonly name = 'cohere';
  readonly modelName: string;

  private apiKey: string;
  private apiUrl: string;
  private maxRetries = 3;

  constructor(options: {
    apiKey: string;
    model?: string;
    apiUrl?: string;
  }) {
    this.apiKey = options.apiKey;
    this.modelName = options.model || 'rerank-english-v3.0';
    this.apiUrl = options.apiUrl || 'https://api.cohere.ai/v1/rerank';
  }

  isLoaded(): boolean {
    return true; // API always "loaded"
  }

  /**
   * Make API request with retry logic and exponential backoff
   * Retries on network errors, 5xx errors, and 429 rate limits
   */
  private async makeRequestWithRetry(
    query: string,
    documents: string[],
    topN: number,
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
          model: this.modelName,
          query,
          documents,
          top_n: topN,
        }),
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[Cohere] Rate limited (429), retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(query, documents, topN, attempt + 1);
        }
        throw new Error('Cohere API rate limit exceeded after max retries');
      }

      // Handle unauthorized (401)
      if (response.status === 401) {
        throw new Error('Cohere API authentication failed. Please check your API key.');
      }

      // Handle server errors (5xx)
      if (response.status >= 500) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[Cohere] Server error (${response.status}), retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(query, documents, topN, attempt + 1);
        }
        throw new Error(`Cohere API server error (${response.status}) after max retries`);
      }

      // Handle other client errors (4xx)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as any;
        const errorMessage = errorBody?.message || `Cohere API error (${response.status})`;
        console.error(`[Cohere] Client error (${response.status}):`, errorBody);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[Cohere] Network error, retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(query, documents, topN, attempt + 1);
        }
        throw new Error('Cohere API network error after max retries');
      }
      throw error;
    }
  }

  /**
   * Rerank documents using Cohere API
   * 
   * @param query - Search query
   * @param documents - List of candidate documents
   * @param topN - Optional limit on number of results to return
   * @returns Ranked results sorted by relevance score (highest first)
   * 
   * @example
   * const reranker = new CohereReranker({ apiKey: 'co-...' });
   * const results = await reranker.rerank(
   *   "What is React?",
   *   ["React is a JavaScript library", "Python is a programming language"]
   * );
   */
  async rerank(query: string, documents: string[], topN?: number): Promise<RankedResult[]> {
    if (documents.length === 0) {
      return [];
    }

    try {
      const effectiveTopN = topN || documents.length;
      const data = await this.makeRequestWithRetry(query, documents, effectiveTopN);

      if (!data || !data.results) {
        throw new Error('Invalid response from Cohere API');
      }

      // Map Cohere response to RankedResult format
      const results: RankedResult[] = data.results.map((result: any) => ({
        content: documents[result.index],
        score: result.relevance_score,
        originalIndex: result.index
      }));

      return results;
    } catch (error) {
      console.error('[Cohere] Failed to rerank documents:', error);
      throw error;
    }
  }
}

/**
 * Jina AI reranker (generic API compatible)
 * Works with Jina AI and other compatible rerank APIs
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Rate limit handling (429)
 * - Generic API format compatible with multiple providers
 * - Batch processing support
 * 
 * Pricing (Jina AI):
 * - ~$0.02 per 1000 requests
 * - Free tier available for testing
 * 
 * Compatible APIs:
 * - Jina AI Rerank API
 * - Custom rerank APIs following similar format
 */
export class JinaReranker implements Reranker {
  readonly name = 'jina';
  readonly modelName: string;

  private apiKey: string;
  private apiUrl: string;
  private maxRetries = 3;

  constructor(options: {
    apiKey: string;
    model?: string;
    apiUrl?: string;
  }) {
    this.apiKey = options.apiKey;
    this.modelName = options.model || 'jina-reranker-v1-base-en';
    this.apiUrl = options.apiUrl || 'https://api.jina.ai/v1/rerank';
  }

  isLoaded(): boolean {
    return true; // API always "loaded"
  }

  /**
   * Make API request with retry logic and exponential backoff
   * Retries on network errors, 5xx errors, and 429 rate limits
   */
  private async makeRequestWithRetry(
    query: string,
    documents: string[],
    topN: number,
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
          model: this.modelName,
          query,
          documents,
          top_n: topN,
        }),
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[Jina] Rate limited (429), retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(query, documents, topN, attempt + 1);
        }
        throw new Error('Jina API rate limit exceeded after max retries');
      }

      // Handle unauthorized (401)
      if (response.status === 401) {
        throw new Error('Jina API authentication failed. Please check your API key.');
      }

      // Handle server errors (5xx)
      if (response.status >= 500) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[Jina] Server error (${response.status}), retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(query, documents, topN, attempt + 1);
        }
        throw new Error(`Jina API server error (${response.status}) after max retries`);
      }

      // Handle other client errors (4xx)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as any;
        const errorMessage = errorBody?.message || `Jina API error (${response.status})`;
        console.error(`[Jina] Client error (${response.status}):`, errorBody);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`[Jina] Network error, retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.makeRequestWithRetry(query, documents, topN, attempt + 1);
        }
        throw new Error('Jina API network error after max retries');
      }
      throw error;
    }
  }

  /**
   * Rerank documents using Jina AI API
   * 
   * @param query - Search query
   * @param documents - List of candidate documents
   * @param topN - Optional limit on number of results to return
   * @returns Ranked results sorted by relevance score (highest first)
   * 
   * @example
   * const reranker = new JinaReranker({ apiKey: 'jina_...' });
   * const results = await reranker.rerank(
   *   "What is React?",
   *   ["React is a JavaScript library", "Python is a programming language"]
   * );
   */
  async rerank(query: string, documents: string[], topN?: number): Promise<RankedResult[]> {
    if (documents.length === 0) {
      return [];
    }

    try {
      const effectiveTopN = topN || documents.length;
      const data = await this.makeRequestWithRetry(query, documents, effectiveTopN);

      if (!data || !data.results) {
        throw new Error('Invalid response from Jina API');
      }

      // Map Jina response to RankedResult format
      const results: RankedResult[] = data.results.map((result: any) => ({
        content: documents[result.index],
        score: result.relevance_score,
        originalIndex: result.index
      }));

      return results;
    } catch (error) {
      console.error('[Jina] Failed to rerank documents:', error);
      throw error;
    }
  }
}
