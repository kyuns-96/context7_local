/**
 * Reranking Management Service
 * 
 * Provides reranking functionality using pluggable reranker backends.
 * Default: NoOpReranker (pass-through, no reranking)
 */

import {
  NoOpReranker,
  LocalReranker,
  CohereReranker,
  JinaReranker,
  type Reranker,
  type RankedResult,
} from './reranker';

let reranker: Reranker = new NoOpReranker();

/**
 * Configuration for reranker initialization
 */
export interface RerankerConfig {
  reranker?: 'none' | 'local' | 'cohere' | 'jina';
  apiKey?: string;
  model?: string;
  apiUrl?: string;
}

/**
 * Initialize reranker from config with environment variable fallback
 * Precedence: CLI options > environment variables > defaults
 * 
 * @param config - Reranker configuration from CLI
 * @throws Error if API reranker selected but no API key provided
 * 
 * @example
 * initializeReranker({
 *   reranker: 'cohere',
 *   apiKey: 'co-...',
 *   model: 'rerank-english-v3.0'
 * });
 */
export function initializeReranker(config: RerankerConfig = {}): void {
  const rerankerType = config.reranker || process.env.RERANKING_PROVIDER || 'none';
  
  console.log(`[Reranking] Initializing reranker: ${rerankerType}`);
  
  if (rerankerType === 'local') {
    setReranker(new LocalReranker());
  } else if (rerankerType === 'cohere') {
    const apiKey = config.apiKey || process.env.RERANKING_API_KEY;
    if (!apiKey) {
      throw new Error('RERANKING_API_KEY required for Cohere reranker (set via --reranking-api-key or RERANKING_API_KEY env var)');
    }
    
    setReranker(new CohereReranker({
      apiKey,
      model: config.model || process.env.RERANKING_MODEL,
      apiUrl: config.apiUrl || process.env.RERANKING_API_URL,
    }));
  } else if (rerankerType === 'jina') {
    const apiKey = config.apiKey || process.env.RERANKING_API_KEY;
    if (!apiKey) {
      throw new Error('RERANKING_API_KEY required for Jina reranker (set via --reranking-api-key or RERANKING_API_KEY env var)');
    }
    
    setReranker(new JinaReranker({
      apiKey,
      model: config.model || process.env.RERANKING_MODEL,
      apiUrl: config.apiUrl || process.env.RERANKING_API_URL,
    }));
  } else {
    setReranker(new NoOpReranker());
  }
}

/**
 * Set the reranker
 * Allows switching between different reranker implementations
 * 
 * @param r - The reranker implementation to use
 * 
 * @example
 * import { LocalReranker } from './reranker';
 * setReranker(new LocalReranker());
 */
export function setReranker(r: Reranker): void {
  reranker = r;
  console.log(`[Reranking] Reranker set to: ${reranker.name} (${reranker.modelName})`);
}

/**
 * Rerank documents based on query relevance
 * 
 * @param query - Search query
 * @param documents - List of candidate documents to rerank
 * @param topN - Optional limit on number of results to return
 * @returns Ranked results sorted by relevance score (highest first)
 * 
 * @example
 * const results = await rerank("What is React?", ["React is...", "Vue is..."]);
 * console.log(results[0].content); // Most relevant document
 * console.log(results[0].score);   // Relevance score
 */
export async function rerank(
  query: string,
  documents: string[],
  topN?: number
): Promise<RankedResult[]> {
  return reranker.rerank(query, documents, topN);
}

/**
 * Get reranker information
 * Useful for logging and debugging
 */
export function getRerankerInfo() {
  return {
    name: reranker.name,
    modelName: reranker.modelName,
    isLoaded: reranker.isLoaded(),
  };
}
