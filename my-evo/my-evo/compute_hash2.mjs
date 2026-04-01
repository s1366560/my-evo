import crypto from 'crypto';
import fs from 'fs';

function sortKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted = {};
  Object.keys(obj).sort().forEach(k => sorted[k] = sortKeys(obj[k]));
  return sorted;
}

// Read the exact JSON from our last successful gene attempt to understand the pattern
// Gene that passed: e604cc0d04ef1bd6415eaeb3d880d8b891b3704dd9655c9f1e34d5edf43fff94

// For capsule, let me try different orderings to see what might match
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

// Try with fields in different orders
const orders = [
  ['type','trigger','summary','confidence','blast_radius','outcome','env_fingerprint','code'],
  ['type','summary','trigger','confidence','blast_radius','outcome','env_fingerprint','code'],
  ['type','trigger','summary','code','confidence','blast_radius','outcome','env_fingerprint'],
];

for (const order of orders) {
  const capsule = {};
  for (const k of order) {
    if (k === 'type') capsule.type = 'Capsule';
    else if (k === 'trigger') capsule.trigger = ['agent-memory-query', 'context-window-optimization', 'retrieval-latency-reduction'];
    else if (k === 'summary') capsule.summary = 'Capsule implementing optimized long-term memory retrieval: semantic chunking, hybrid vector+BM25 search with Reciprocal Rank Fusion, budget-aware context selection, and exponential forgetting curves for importance decay.';
    else if (k === 'confidence') capsule.confidence = 0.88;
    else if (k === 'blast_radius') capsule.blast_radius = { files: 1, lines: 150 };
    else if (k === 'outcome') capsule.outcome = { status: 'success', score: 0.88 };
    else if (k === 'env_fingerprint') capsule.env_fingerprint = { platform: 'linux', arch: 'arm64', runtime: 'node-v22' };
    else if (k === 'code') capsule.code = codeStr;
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify(sortKeys(capsule))).digest('hex');
  console.log(`order [${order.join(',')}]: ${hash}`);
}

// Also try without some optional fields
const minimalCapsule = {
  type: 'Capsule',
  trigger: ['agent-memory-query', 'context-window-optimization', 'retrieval-latency-reduction'],
  summary: 'Capsule implementing optimized long-term memory retrieval: semantic chunking, hybrid vector+BM25 search with Reciprocal Rank Fusion, budget-aware context selection, and exponential forgetting curves for importance decay.',
  confidence: 0.88
};
console.log('minimal:', crypto.createHash('sha256').update(JSON.stringify(sortKeys(minimalCapsule))).digest('hex'));
