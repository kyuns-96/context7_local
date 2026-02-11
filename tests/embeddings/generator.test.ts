import { describe, test, expect } from 'bun:test';
import {
  generateEmbedding,
  generateEmbeddings,
  getEmbeddingDimensions,
  getModelInfo,
} from '../../src/embeddings/generator';

describe('generateEmbedding', () => {
  test('generates 384-dimensional embedding for simple text', async () => {
    const embedding = await generateEmbedding('Hello world');
    
    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(384);
    expect(Array.isArray(embedding)).toBe(true);
    embedding!.forEach(value => {
      expect(typeof value).toBe('number');
      expect(isFinite(value)).toBe(true);
    });
  });

  test('returns null for empty text', async () => {
    expect(await generateEmbedding('')).toBeNull();
    expect(await generateEmbedding('   ')).toBeNull();
  });

  test('generates normalized vectors (magnitude ~1)', async () => {
    const embedding = await generateEmbedding('Test normalization');
    expect(embedding).not.toBeNull();
    
    const magnitude = Math.sqrt(
      embedding!.reduce((sum, val) => sum + val * val, 0)
    );
    
    expect(magnitude).toBeGreaterThan(0.99);
    expect(magnitude).toBeLessThan(1.01);
  });

  test('handles long text by truncating', async () => {
    const longText = 'Lorem ipsum '.repeat(1000);
    const embedding = await generateEmbedding(longText);
    
    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(384);
  });

  test('generates consistent embeddings for same text', async () => {
    const text = 'Consistency test';
    const embedding1 = await generateEmbedding(text);
    const embedding2 = await generateEmbedding(text);
    
    expect(embedding1).not.toBeNull();
    expect(embedding2).not.toBeNull();
    
    for (let i = 0; i < 384; i++) {
      const val1 = embedding1![i];
      const val2 = embedding2![i];
      expect(val1).toBeDefined();
      expect(val2).toBeDefined();
      expect(Math.abs(val1! - val2!)).toBeLessThan(0.0001);
    }
  });

  test('generates different embeddings for different texts', async () => {
    const embedding1 = await generateEmbedding('Apple');
    const embedding2 = await generateEmbedding('Orange');
    
    expect(embedding1).not.toBeNull();
    expect(embedding2).not.toBeNull();
    
    let differenceCount = 0;
    for (let i = 0; i < 384; i++) {
      const val1 = embedding1![i];
      const val2 = embedding2![i];
      expect(val1).toBeDefined();
      expect(val2).toBeDefined();
      if (Math.abs(val1! - val2!) > 0.01) {
        differenceCount++;
      }
    }
    
    expect(differenceCount).toBeGreaterThan(100);
  });

  test('handles code snippets', async () => {
    const code = 'function hello() { return "world"; }';
    const embedding = await generateEmbedding(code);
    
    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(384);
  });

  test('handles special characters', async () => {
    const text = 'Special chars: @#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const embedding = await generateEmbedding(text);
    
    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(384);
  });

  test('handles unicode text', async () => {
    const text = 'Unicode: こんにちは 你好 مرحبا 🚀';
    const embedding = await generateEmbedding(text);
    
    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(384);
  });
});

describe('generateEmbeddings', () => {
  test('generates embeddings for multiple texts', async () => {
    const texts = ['First text', 'Second text', 'Third text'];
    const embeddings = await generateEmbeddings(texts);
    
    expect(embeddings).toHaveLength(3);
    embeddings.forEach(embedding => {
      expect(embedding).not.toBeNull();
      expect(embedding).toHaveLength(384);
    });
  });

  test('handles empty texts in batch', async () => {
    const texts = ['Valid text', '', 'Another valid', '   '];
    const embeddings = await generateEmbeddings(texts);
    
    expect(embeddings).toHaveLength(4);
    expect(embeddings[0]).not.toBeNull();
    expect(embeddings[1]).toBeNull();
    expect(embeddings[2]).not.toBeNull();
    expect(embeddings[3]).toBeNull();
  });

  test('handles empty array', async () => {
    const embeddings = await generateEmbeddings([]);
    expect(embeddings).toHaveLength(0);
  });

  test('handles large batch', async () => {
    const texts = Array.from({ length: 10 }, (_, i) => `Text ${i}`);
    const embeddings = await generateEmbeddings(texts);
    
    expect(embeddings).toHaveLength(10);
    embeddings.forEach((embedding, i) => {
      expect(embedding).not.toBeNull();
      expect(embedding).toHaveLength(384);
    });
  });
});

describe('getEmbeddingDimensions', () => {
  test('returns correct dimension count', () => {
    expect(getEmbeddingDimensions()).toBe(384);
  });
});

describe('getModelInfo', () => {
  test('returns model metadata', () => {
    const info = getModelInfo();
    
    expect(info.name).toBe('Xenova/all-MiniLM-L6-v2');
    expect(info.dimensions).toBe(384);
    expect(info.maxTokens).toBe(256);
    expect(typeof info.loaded).toBe('boolean');
  });

  test('shows model loaded after first embedding generation', async () => {
    const infoBefore = getModelInfo();
    
    await generateEmbedding('Test loading');
    
    const infoAfter = getModelInfo();
    expect(infoAfter.loaded).toBe(true);
  });
});

describe('semantic similarity', () => {
  test('similar texts have higher cosine similarity', async () => {
    const text1 = 'The cat sat on the mat';
    const text2 = 'A cat is sitting on a mat';
    const text3 = 'JavaScript is a programming language';
    
    const [emb1, emb2, emb3] = await Promise.all([
      generateEmbedding(text1),
      generateEmbedding(text2),
      generateEmbedding(text3),
    ]);
    
    expect(emb1).not.toBeNull();
    expect(emb2).not.toBeNull();
    expect(emb3).not.toBeNull();
    
    const cosineSimilarity = (a: number[], b: number[]): number => {
      let dotProduct = 0;
      for (let i = 0; i < a.length; i++) {
        const valA = a[i];
        const valB = b[i];
        if (valA !== undefined && valB !== undefined) {
          dotProduct += valA * valB;
        }
      }
      return dotProduct;
    };
    
    const sim12 = cosineSimilarity(emb1!, emb2!);
    const sim13 = cosineSimilarity(emb1!, emb3!);
    
    expect(sim12).toBeGreaterThan(sim13);
    expect(sim12).toBeGreaterThan(0.7);
  });
});
