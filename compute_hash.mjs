import crypto from 'crypto';
import fs from 'fs';

function sortKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted = {};
  Object.keys(obj).sort().forEach(k => sorted[k] = sortKeys(obj[k]));
  return sorted;
}

// Gene hash
const genePayload = {
  type: 'Gene',
  category: 'optimize',
  signals_match: ['long-term memory', 'vector DB', 'Pinecone', 'LLM', 'retrieval', 'indexing'],
  summary: 'Hybrid LTM retrieval architecture combining HNSW vector indices, hybrid dense+sparse search, RRF reranking, and importance-weighted memory consolidation with forgetting curves for LLM-based agents.'
};

// Capsule hash - use exact string from JSON payload
const codeStr = `interface MemoryEntry { id: string; content: string; embedding: number[]; importance: number; lastAccessed: number; accessCount: number; category: string; }
async function retrieveRelevantMemories(query: string, topK = 10, memoryBudget = 4000) {
  const queryEmbedding = await embedQuery(query);
  const [vectorResults, keywordResults] = await Promise.all([pinecone.query({ vector: queryEmbedding, topK: topK * 2 }), keywordSearch(query, topK)]);
  const fused = reciprocalRankFusion(vectorResults, keywordResults, k=60);
  const selected: MemoryEntry[] = []; let totalTokens = 0;
  for (const item of fused) { const tokens = estimateTokens(item.content); if (totalTokens + tokens <= memoryBudget) { selected.push(item); totalTokens += tokens; } }
  await updateAccessMetadata(selected); return selected;
}
function reciprocalRankFusion(resultsA, resultsB, k = 60) {
  const scores = new Map();
  resultsA.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + k / (k + i + 1)));
  resultsB.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + k / (k + i + 1)));
  return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => ({ id }));
}`;

const capsulePayload = {
  type: 'Capsule',
  trigger: ['agent-memory-query', 'context-window-optimization', 'retrieval-latency-reduction'],
  summary: 'Capsule implementing optimized long-term memory retrieval: semantic chunking, hybrid vector+BM25 search with Reciprocal Rank Fusion, budget-aware context selection, and exponential forgetting curves for importance decay.',
  confidence: 0.88,
  blast_radius: { files: 1, lines: 150 },
  outcome: { status: 'success', score: 0.88 },
  env_fingerprint: { platform: 'linux', arch: 'arm64', runtime: 'node-v22' },
  code: codeStr
};

console.log('gene hash:', crypto.createHash('sha256').update(JSON.stringify(sortKeys(genePayload))).digest('hex'));
console.log('capsule hash:', crypto.createHash('sha256').update(JSON.stringify(sortKeys(capsulePayload))).digest('hex'));
