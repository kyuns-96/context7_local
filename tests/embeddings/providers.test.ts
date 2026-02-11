import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { OpenAIProvider } from '../../src/embeddings/providers';

describe('OpenAIProvider', () => {
  beforeEach(() => {
    (globalThis as any).fetch = undefined;
  });

  test('constructs with defaults', () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    expect(provider.name).toBe('openai');
    expect(provider.modelName).toBe('text-embedding-3-small');
    expect(provider.dimensions).toBe(1536);
    expect(provider.isLoaded()).toBe(true);
  });

  test('constructs with custom model text-embedding-3-large', () => {
    const provider = new OpenAIProvider({ 
      apiKey: 'test-key',
      model: 'text-embedding-3-large'
    });
    expect(provider.modelName).toBe('text-embedding-3-large');
    expect(provider.dimensions).toBe(3072);
  });

  test('constructs with text-embedding-ada-002', () => {
    const provider = new OpenAIProvider({ 
      apiKey: 'test-key',
      model: 'text-embedding-ada-002'
    });
    expect(provider.modelName).toBe('text-embedding-ada-002');
    expect(provider.dimensions).toBe(1536);
  });

  test('constructs with custom API URL', () => {
    const provider = new OpenAIProvider({ 
      apiKey: 'test-key',
      apiUrl: 'https://custom.api.com/v1/embeddings'
    });
    expect(provider.modelName).toBe('text-embedding-3-small');
  });

  test('generates embedding successfully', async () => {
    const mockEmbedding = new Array(1536).fill(0.1);
    const mockFetch = mock((url: string, options: any) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: [{ embedding: mockEmbedding }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 5, total_tokens: 5 }
      })
    }));

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const result = await provider.generateEmbedding('test text');

    expect(result).toBeDefined();
    expect(result?.length).toBe(1536);
    expect(result?.[0]).toBe(0.1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0];
    if (call) {
      const [url, options] = call;
      expect(url).toBe('https://api.openai.com/v1/embeddings');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-key');
      expect(options.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(options.body);
      expect(body.input).toBe('test text');
      expect(body.model).toBe('text-embedding-3-small');
    }
  });

  test('returns null for empty text', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    
    expect(await provider.generateEmbedding('')).toBe(null);
    expect(await provider.generateEmbedding('   ')).toBe(null);
  });

  test('retries on 500 server error', async () => {
    let attempt = 0;
    const mockEmbedding = new Array(1536).fill(0.1);
    
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
          data: [{ embedding: mockEmbedding }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const result = await provider.generateEmbedding('test text');

    expect(result).toBeDefined();
    expect(result?.length).toBe(1536);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('retries on 429 rate limit', async () => {
    let attempt = 0;
    const mockEmbedding = new Array(1536).fill(0.1);
    
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
          data: [{ embedding: mockEmbedding }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const result = await provider.generateEmbedding('test text');

    expect(result).toBeDefined();
    expect(result?.length).toBe(1536);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('throws on 401 authentication error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid API key' })
    }));

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'invalid-key' });
    
    await expect(provider.generateEmbedding('test text')).rejects.toThrow(
      'OpenAI API authentication failed'
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('returns null on 400 client error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid request' })
    }));

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const result = await provider.generateEmbedding('test text');

    expect(result).toBe(null);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('throws after max retries on 500 error', async () => {
    const mockFetch = mock(() => Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' })
    }));

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    
    await expect(provider.generateEmbedding('test text')).rejects.toThrow(
      'OpenAI API server error (500) after max retries'
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('retries on network error', async () => {
    let attempt = 0;
    const mockEmbedding = new Array(1536).fill(0.1);
    
    const mockFetch = mock(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.reject(new TypeError('fetch failed'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [{ embedding: mockEmbedding }]
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const result = await provider.generateEmbedding('test text');

    expect(result).toBeDefined();
    expect(result?.length).toBe(1536);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('generates batch embeddings successfully', async () => {
    const mockEmbedding1 = new Array(1536).fill(0.1);
    const mockEmbedding2 = new Array(1536).fill(0.2);
    
    const mockFetch = mock((url: string, options: any) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: [
          { embedding: mockEmbedding1 },
          { embedding: mockEmbedding2 }
        ]
      })
    }));

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const results = await provider.generateEmbeddings(['text 1', 'text 2']);

    expect(results.length).toBe(2);
    expect(results[0]?.length).toBe(1536);
    expect(results[1]?.length).toBe(1536);
    expect(results[0]?.[0]).toBe(0.1);
    expect(results[1]?.[0]).toBe(0.2);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0];
    if (call) {
      const [, options] = call;
      const body = JSON.parse(options.body);
      expect(body.input).toEqual(['text 1', 'text 2']);
    }
  });

  test('handles empty texts in batch', async () => {
    const mockEmbedding = new Array(1536).fill(0.1);
    
    const mockFetch = mock((url: string, options: any) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: [
          { embedding: mockEmbedding }
        ]
      })
    }));

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const results = await provider.generateEmbeddings(['', 'text 1', '   ']);

    expect(results.length).toBe(3);
    expect(results[0]).toBe(null);
    expect(results[1]?.length).toBe(1536);
    expect(results[2]).toBe(null);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0];
    if (call) {
      const [, options] = call;
      const body = JSON.parse(options.body);
      expect(body.input).toEqual(['text 1']);
    }
  });

  test('processes large batches in chunks', async () => {
    const mockEmbedding = new Array(1536).fill(0.1);
    const texts = new Array(250).fill('test text');
    
    const mockFetch = mock(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: new Array(100).fill({ embedding: mockEmbedding })
      })
    }));

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const results = await provider.generateEmbeddings(texts);

    expect(results.length).toBe(250);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('handles batch with all nulls gracefully', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const results = await provider.generateEmbeddings(['', '   ', '']);

    expect(results.length).toBe(3);
    expect(results[0]).toBe(null);
    expect(results[1]).toBe(null);
    expect(results[2]).toBe(null);
  });

  test('continues processing after batch failure', async () => {
    let callCount = 0;
    const mockEmbedding = new Array(1536).fill(0.1);
    
    const mockFetch = mock(() => {
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: new Array(50).fill({ embedding: mockEmbedding })
        })
      });
    });

    globalThis.fetch = mockFetch as any;

    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const texts = new Array(150).fill('test');
    const results = await provider.generateEmbeddings(texts);

    expect(results.length).toBe(150);
    expect(results.slice(0, 100).every(r => r === null)).toBe(true);
    expect(results.slice(100).every(r => r !== null)).toBe(true);
  });
});
