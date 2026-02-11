import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { 
  NoOpReranker, 
  LocalReranker, 
  CohereReranker, 
  JinaReranker 
} from '../../src/reranking/reranker';

describe('NoOpReranker', () => {
  beforeEach(() => {
    (globalThis as any).fetch = undefined;
  });

  test('constructs with correct name and modelName', () => {
    const reranker = new NoOpReranker();
    expect(reranker.name).toBe('none');
    expect(reranker.modelName).toBe('none');
  });

  test('isLoaded returns true', () => {
    const reranker = new NoOpReranker();
    expect(reranker.isLoaded()).toBe(true);
  });

  test('returns documents in original order', async () => {
    const reranker = new NoOpReranker();
    const documents = [
      'First document',
      'Second document',
      'Third document'
    ];
    
    const results = await reranker.rerank('test query', documents);
    
    expect(results.length).toBe(3);
    expect(results[0]?.content).toBe('First document');
    expect(results[0]?.originalIndex).toBe(0);
    expect(results[1]?.content).toBe('Second document');
    expect(results[1]?.originalIndex).toBe(1);
    expect(results[2]?.content).toBe('Third document');
    expect(results[2]?.originalIndex).toBe(2);
  });

  test('applies score decay based on original index', async () => {
    const reranker = new NoOpReranker();
    const documents = [
      'First document',
      'Second document',
      'Third document'
    ];
    
    const results = await reranker.rerank('test query', documents);
    
    expect(results[0]?.score).toBe(1.0);
    expect(results[1]?.score).toBe(0.99);
    expect(results[2]?.score).toBe(0.98);
  });

  test('respects topN parameter', async () => {
    const reranker = new NoOpReranker();
    const documents = [
      'First document',
      'Second document',
      'Third document',
      'Fourth document'
    ];
    
    const results = await reranker.rerank('test query', documents, 2);
    
    expect(results.length).toBe(2);
    expect(results[0]?.content).toBe('First document');
    expect(results[1]?.content).toBe('Second document');
  });

  test('handles empty documents array', async () => {
    const reranker = new NoOpReranker();
    const results = await reranker.rerank('test query', []);
    
    expect(results).toEqual([]);
  });

  test('topN larger than documents count returns all documents', async () => {
    const reranker = new NoOpReranker();
    const documents = ['Doc 1', 'Doc 2'];
    
    const results = await reranker.rerank('test query', documents, 10);
    
    expect(results.length).toBe(2);
  });
});

describe('LocalReranker', () => {
  beforeEach(() => {
    (globalThis as any).fetch = undefined;
  });

  test('constructs with correct defaults', () => {
    const reranker = new LocalReranker();
    expect(reranker.name).toBe('local');
    expect(reranker.modelName).toBe('cross-encoder/ms-marco-MiniLM-L-6-v2');
  });

  test('isLoaded returns false initially', () => {
    const reranker = new LocalReranker();
    expect(reranker.isLoaded()).toBe(false);
  });

  test('handles empty documents array', async () => {
    const reranker = new LocalReranker();
    const results = await reranker.rerank('test query', []);
    
    expect(results).toEqual([]);
  });
});

describe('CohereReranker', () => {
  beforeEach(() => {
    (globalThis as any).fetch = undefined;
  });

  test('constructs with default model', () => {
    const reranker = new CohereReranker({ apiKey: 'test-key' });
    expect(reranker.name).toBe('cohere');
    expect(reranker.modelName).toBe('rerank-english-v3.0');
  });

  test('constructs with custom model', () => {
    const reranker = new CohereReranker({ 
      apiKey: 'test-key',
      model: 'rerank-english-v2.0'
    });
    expect(reranker.modelName).toBe('rerank-english-v2.0');
  });

  test('constructs with custom API URL', () => {
    const reranker = new CohereReranker({ 
      apiKey: 'test-key',
      apiUrl: 'https://custom.cohere.com/v1/rerank'
    });
    expect(reranker.name).toBe('cohere');
  });

  test('isLoaded returns true', () => {
    const reranker = new CohereReranker({ apiKey: 'test-key' });
    expect(reranker.isLoaded()).toBe(true);
  });

  test('reranks documents successfully', async () => {
    const mockFetch = mock((url: string, options: any) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        results: [
          { index: 1, relevance_score: 0.95 },
          { index: 0, relevance_score: 0.75 }
        ]
      })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    const documents = [
      'React is a JavaScript library',
      'React is a frontend framework'
    ];
    
    const results = await reranker.rerank('What is React?', documents);

    expect(results.length).toBe(2);
    expect(results[0]?.content).toBe('React is a frontend framework');
    expect(results[0]?.score).toBe(0.95);
    expect(results[0]?.originalIndex).toBe(1);
    expect(results[1]?.content).toBe('React is a JavaScript library');
    expect(results[1]?.score).toBe(0.75);
    expect(results[1]?.originalIndex).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0];
    if (call && call.length >= 2) {
      const [url, options] = call;
      expect(url).toBe('https://api.cohere.ai/v1/rerank');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-key');
      expect(options.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(options.body);
      expect(body.model).toBe('rerank-english-v3.0');
      expect(body.query).toBe('What is React?');
      expect(body.documents).toEqual(documents);
    }
  });

  test('respects topN parameter', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        results: [
          { index: 2, relevance_score: 0.95 },
          { index: 1, relevance_score: 0.85 }
        ]
      })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    const documents = ['Doc 1', 'Doc 2', 'Doc 3', 'Doc 4'];
    
    const results = await reranker.rerank('test query', documents, 2);

    expect(results.length).toBe(2);
    
    const call = mockFetch.mock.calls[0] as any;
    if (call) {
      const [, options] = call;
      const body = JSON.parse(options.body);
      expect(body.top_n).toBe(2);
    }
  });

  test('retries on 429 rate limit', async () => {
    let attempt = 0;
    const mockFetch = mock(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: 'Rate limit exceeded' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [{ index: 0, relevance_score: 0.9 }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', ['Document 1']);

    expect(results.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('retries on 500 server error', async () => {
    let attempt = 0;
    const mockFetch = mock(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal server error' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [{ index: 0, relevance_score: 0.9 }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', ['Document 1']);

    expect(results.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('throws on 401 authentication error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid API key' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'invalid-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Cohere API authentication failed');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('throws on 400 client error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid request' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Invalid request');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('throws after max retries on 500 error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Cohere API server error (500) after max retries');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('retries on network error', async () => {
    let attempt = 0;
    const mockFetch = mock(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.reject(new TypeError('fetch failed'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [{ index: 0, relevance_score: 0.9 }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', ['Document 1']);

    expect(results.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('handles empty documents array', async () => {
    const reranker = new CohereReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', []);
    
    expect(results).toEqual([]);
  });

  test('throws after max retries on network error', async () => {
    const mockFetch = mock(() => Promise.reject(new TypeError('fetch failed')));

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Cohere API network error after max retries');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('throws on 429 rate limit after max retries', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new CohereReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Cohere API rate limit exceeded after max retries');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe('JinaReranker', () => {
  beforeEach(() => {
    (globalThis as any).fetch = undefined;
  });

  test('constructs with default model', () => {
    const reranker = new JinaReranker({ apiKey: 'test-key' });
    expect(reranker.name).toBe('jina');
    expect(reranker.modelName).toBe('jina-reranker-v1-base-en');
  });

  test('constructs with custom model', () => {
    const reranker = new JinaReranker({ 
      apiKey: 'test-key',
      model: 'jina-reranker-v1-base-zh'
    });
    expect(reranker.modelName).toBe('jina-reranker-v1-base-zh');
  });

  test('constructs with custom API URL', () => {
    const reranker = new JinaReranker({ 
      apiKey: 'test-key',
      apiUrl: 'https://custom.jina.ai/v1/rerank'
    });
    expect(reranker.name).toBe('jina');
  });

  test('isLoaded returns true', () => {
    const reranker = new JinaReranker({ apiKey: 'test-key' });
    expect(reranker.isLoaded()).toBe(true);
  });

  test('reranks documents successfully', async () => {
    const mockFetch = mock((url: string, options: any) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        results: [
          { index: 1, relevance_score: 0.95 },
          { index: 0, relevance_score: 0.75 }
        ]
      })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    const documents = [
      'React is a JavaScript library',
      'React is a frontend framework'
    ];
    
    const results = await reranker.rerank('What is React?', documents);

    expect(results.length).toBe(2);
    expect(results[0]?.content).toBe('React is a frontend framework');
    expect(results[0]?.score).toBe(0.95);
    expect(results[0]?.originalIndex).toBe(1);
    expect(results[1]?.content).toBe('React is a JavaScript library');
    expect(results[1]?.score).toBe(0.75);
    expect(results[1]?.originalIndex).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0];
    if (call) {
      const [url, options] = call;
      expect(url).toBe('https://api.jina.ai/v1/rerank');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-key');
      expect(options.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(options.body);
      expect(body.model).toBe('jina-reranker-v1-base-en');
      expect(body.query).toBe('What is React?');
      expect(body.documents).toEqual(documents);
    }
  });

  test('respects topN parameter', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        results: [
          { index: 2, relevance_score: 0.95 },
          { index: 1, relevance_score: 0.85 }
        ]
      })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    const documents = ['Doc 1', 'Doc 2', 'Doc 3', 'Doc 4'];
    
    const results = await reranker.rerank('test query', documents, 2);

    expect(results.length).toBe(2);
    
    const call = mockFetch.mock.calls[0] as any;
    if (call) {
      const [, options] = call;
      const body = JSON.parse(options.body);
      expect(body.top_n).toBe(2);
    }
  });

  test('retries on 429 rate limit', async () => {
    let attempt = 0;
    const mockFetch = mock(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: 'Rate limit exceeded' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [{ index: 0, relevance_score: 0.9 }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', ['Document 1']);

    expect(results.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('retries on 500 server error', async () => {
    let attempt = 0;
    const mockFetch = mock(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal server error' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [{ index: 0, relevance_score: 0.9 }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', ['Document 1']);

    expect(results.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('throws on 401 authentication error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid API key' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'invalid-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Jina API authentication failed');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('throws on 400 client error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid request' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Invalid request');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('throws after max retries on 500 error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Jina API server error (500) after max retries');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('retries on network error', async () => {
    let attempt = 0;
    const mockFetch = mock(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.reject(new TypeError('fetch failed'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [{ index: 0, relevance_score: 0.9 }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', ['Document 1']);

    expect(results.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('handles empty documents array', async () => {
    const reranker = new JinaReranker({ apiKey: 'test-key' });
    const results = await reranker.rerank('test', []);
    
    expect(results).toEqual([]);
  });

  test('throws after max retries on network error', async () => {
    const mockFetch = mock(() => Promise.reject(new TypeError('fetch failed')));

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Jina API network error after max retries');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('throws on 429 rate limit after max retries', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' })
    }));

    globalThis.fetch = mockFetch as any;

    const reranker = new JinaReranker({ apiKey: 'test-key' });
    
    await expect(
      reranker.rerank('test', ['Document 1'])
    ).rejects.toThrow('Jina API rate limit exceeded after max retries');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
