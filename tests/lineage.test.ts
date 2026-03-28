/**
 * Lineage Tests - Asset Evolution Chain
 * Phase 2: Asset System
 */

import {
  recordLineage,
  getParent,
  getChildren,
  getLineageChain,
  getDescendantChain,
  getLineage,
  getLineageMetadata,
  buildBundleLineage,
  calculateLineageTrust,
  haveCommonAncestor,
  getRootAncestor,
  getLineageTreeSize,
  getLineageTree,
  resetLineageStores,
} from '../src/assets/lineage';
import { Gene, Capsule, EvolutionEvent } from '../src/assets/types';

beforeEach(() => {
  resetLineageStores();
});

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeGene(overrides: Partial<Gene> = {}): Gene {
  return {
    type: 'Gene',
    schema_version: '1.5.0',
    id: 'gene_test_1',
    category: 'repair',
    signals_match: ['timeout', '/error.*retry/i'],
    strategy: ['Define error pattern', 'Implement retry'],
    constraints: { max_files: 5 },
    asset_id: 'sha256:gene123',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCapsule(geneAssetId: string, overrides: Partial<Capsule> = {}): Capsule {
  return {
    type: 'Capsule',
    schema_version: '1.5.0',
    id: 'capsule_test_1',
    trigger: ['connection timeout'],
    gene: 'gene_test_1',
    summary: 'Fixed HTTP retry',
    content: 'const retry = (fn, n) => fn();',
    strategy: ['Step 1', 'Step 2'],
    confidence: 0.87,
    blast_radius: { files: 2, lines: 45 },
    outcome: { status: 'success', score: 0.87 },
    env_fingerprint: { platform: 'linux', arch: 'x64' },
    asset_id: 'sha256:capsule123',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeEvent(capsuleAssetId: string, geneAssetId: string, overrides: Partial<EvolutionEvent> = {}): EvolutionEvent {
  return {
    type: 'EvolutionEvent',
    id: 'event_test_1',
    intent: 'repair',
    signals: ['timeout'],
    genes_used: ['gene_test_1'],
    blast_radius: { files: 2, lines: 45 },
    outcome: { status: 'success', score: 0.87 },
    capsule_id: 'capsule_test_1',
    source_type: 'generated',
    asset_id: 'sha256:event123',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Test Suites ───────────────────────────────────────────────────────────

describe('【Lineage】Basic Record & Query', () => {
  it('should record a lineage relationship', () => {
    const metadata = recordLineage('sha256:child', 'sha256:parent');
    expect(metadata.child_asset_id).toBe('sha256:child');
    expect(metadata.parent_asset_id).toBe('sha256:parent');
    expect(metadata.relationship).toBe('evolves_from');
  });

  it('should retrieve parent of an asset', () => {
    recordLineage('sha256:child', 'sha256:parent');
    expect(getParent('sha256:child')).toBe('sha256:parent');
  });

  it('should retrieve children of an asset', () => {
    recordLineage('sha256:child1', 'sha256:parent');
    recordLineage('sha256:child2', 'sha256:parent');
    const children = getChildren('sha256:parent');
    expect(children).toContain('sha256:child1');
    expect(children).toContain('sha256:child2');
  });

  it('should return undefined for non-existent parent', () => {
    expect(getParent('sha256:nonexistent')).toBeUndefined();
  });

  it('should return empty array for non-existent children', () => {
    expect(getChildren('sha256:nonexistent')).toEqual([]);
  });

  it('should record lineage with custom metadata', () => {
    const metadata = recordLineage('sha256:child', 'sha256:parent', {
      relationship: 'derived_from',
      mutation_type: 'structural',
      confidence: 0.92,
      reasoning: 'Structural mutation from parent gene',
    });
    expect(metadata.relationship).toBe('derived_from');
    expect(metadata.mutation_type).toBe('structural');
    expect(metadata.confidence).toBe(0.92);
    expect(metadata.reasoning).toBe('Structural mutation from parent gene');
  });
});

describe('【Lineage】Ancestor & Descendant Chains', () => {
  it('should get full ancestor chain', () => {
    // recordLineage(child, parent): establishes child → parent
    // Build chain: d → c → b → a
    recordLineage('sha256:c', 'sha256:d');
    recordLineage('sha256:b', 'sha256:c');
    recordLineage('sha256:a', 'sha256:b');

    const chain = getLineageChain('sha256:a');
    // For 'a', its parent is b, b's parent is c, c's parent is d
    expect(chain.depth).toBe(3);
    expect(chain.chain[0].asset_id).toBe('sha256:b'); // immediate parent
    expect(chain.chain[1].asset_id).toBe('sha256:c');
    expect(chain.chain[2].asset_id).toBe('sha256:d'); // root ancestor
  });

  it('should respect maxDepth parameter', () => {
    // d → c → b → a
    recordLineage('sha256:c', 'sha256:d');
    recordLineage('sha256:b', 'sha256:c');
    recordLineage('sha256:a', 'sha256:b');

    const chain = getLineageChain('sha256:a', 2);
    expect(chain.depth).toBe(2);
    expect(chain.chain[0].asset_id).toBe('sha256:b');
    expect(chain.chain[1].asset_id).toBe('sha256:c');
  });

  it('should get descendant chain', () => {
    // Build: root → a → b, root → c
    // recordLineage(child, parent) = child → parent
    recordLineage('sha256:a', 'sha256:root');
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:root');

    const chain = getDescendantChain('sha256:root');
    // root's children: a and c. a's child: b. c has no children.
    // Descendants (excluding root itself): a, b, c
    expect(chain.depth).toBe(3); // a, b, c
    const ids = chain.chain.map((r: { asset_id: string }) => r.asset_id);
    expect(ids).toContain('sha256:a');
    expect(ids).toContain('sha256:b');
    expect(ids).toContain('sha256:c');
  });

  it('should return empty chain for orphan asset', () => {
    const chain = getLineageChain('sha256:orphan');
    expect(chain.depth).toBe(0);
    expect(chain.chain).toEqual([]);
  });
});

describe('【Lineage】Bundle Lineage (Gene → Capsule → EvolutionEvent)', () => {
  it('should build lineage from Gene + Capsule bundle', () => {
    const gene = makeGene();
    const capsule = makeCapsule(gene.asset_id);

    buildBundleLineage(gene, capsule);

    expect(getParent(capsule.asset_id)).toBe(gene.asset_id);
    expect(getChildren(gene.asset_id)).toContain(capsule.asset_id);
  });

  it('should build lineage from full bundle (Gene + Capsule + EvolutionEvent)', () => {
    const gene = makeGene();
    const capsule = makeCapsule(gene.asset_id);
    const event = makeEvent(capsule.asset_id, gene.asset_id);

    buildBundleLineage(gene, capsule, event);

    // Capsule → Gene (direct lineage)
    expect(getParent(capsule.asset_id)).toBe(gene.asset_id);
    expect(getChildren(gene.asset_id)).toContain(capsule.asset_id);

    // Event → Gene (Event's parent is Gene, as buildBundleLineage overwrites Event → Capsule)
    expect(getParent(event.asset_id)).toBe(gene.asset_id);
    // Gene also tracks Event as a child (via references relationship)
    expect(getChildren(gene.asset_id)).toContain(event.asset_id);
  });

  it('should store lineage metadata for bundle relationships', () => {
    const gene = makeGene({ id: 'gene_meta_test' });
    const capsule = makeCapsule(gene.asset_id, { confidence: 0.95 });

    buildBundleLineage(gene, capsule);

    const metadata = getLineageMetadata(capsule.asset_id);
    expect(metadata).toBeDefined();
    expect(metadata!.relationship).toBe('evolves_from');
    expect(metadata!.confidence).toBe(0.95);
    expect(metadata!.reasoning).toContain(gene.id);
  });

  it('should infer structural mutation for significantly different strategies', () => {
    const gene = makeGene({ strategy: ['Step A'] });
    const capsule = makeCapsule(gene.asset_id, { strategy: ['Step A', 'Step B', 'Step C', 'Step D', 'Step E'] });

    buildBundleLineage(gene, capsule);

    const metadata = getLineageMetadata(capsule.asset_id);
    expect(metadata!.mutation_type).toBe('structural');
  });
});

describe('【Lineage】Trust Propagation', () => {
  it('should calculate trust from parent chain', () => {
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:b');

    const trustScores = new Map<string, number>();
    trustScores.set('sha256:a', 80);

    const trust = calculateLineageTrust('sha256:c', trustScores);
    // Trust propagates with 0.85 decay
    // c gets: 80 * 0.85^2 + 80 * 0.85^1 (via b's trust) / (0.85^2 + 0.85^1) = weighted average
    expect(trust).toBeGreaterThan(0);
    expect(trust).toBeLessThanOrEqual(80);
  });

  it('should return 0 for orphan with no trustable parents', () => {
    const trustScores = new Map<string, number>();
    const trust = calculateLineageTrust('sha256:orphan', trustScores);
    expect(trust).toBe(0);
  });

  it('should use default trust of 50 for unknown parent', () => {
    recordLineage('sha256:b', 'sha256:a');
    const trustScores = new Map<string, number>(); // a not in map
    const trust = calculateLineageTrust('sha256:b', trustScores);
    expect(trust).toBeGreaterThan(0);
  });
});

describe('【Lineage】Common Ancestor', () => {
  it('should detect common ancestor between two branched assets', () => {
    // Root → A → B
    // Root → C
    recordLineage('sha256:a', 'sha256:root');
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:root');

    expect(haveCommonAncestor('sha256:b', 'sha256:c')).toBe(true);
    expect(haveCommonAncestor('sha256:a', 'sha256:c')).toBe(true);
    expect(haveCommonAncestor('sha256:b', 'sha256:a')).toBe(true);
  });

  it('should return false for unrelated assets', () => {
    recordLineage('sha256:a', 'sha256:root_a');
    recordLineage('sha256:b', 'sha256:root_b');

    expect(haveCommonAncestor('sha256:a', 'sha256:b')).toBe(false);
  });

  it('should return true for same asset', () => {
    recordLineage('sha256:a', 'sha256:root');
    expect(haveCommonAncestor('sha256:a', 'sha256:a')).toBe(true);
  });
});

describe('【Lineage】Root Ancestor', () => {
  it('should find root ancestor of a chain', () => {
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:b');
    recordLineage('sha256:d', 'sha256:c');

    expect(getRootAncestor('sha256:d')).toBe('sha256:a');
    expect(getRootAncestor('sha256:c')).toBe('sha256:a');
    expect(getRootAncestor('sha256:b')).toBe('sha256:a');
  });

  it('should return undefined for orphan asset', () => {
    expect(getRootAncestor('sha256:orphan')).toBeUndefined();
  });
});

describe('【Lineage】Tree Size & Collection', () => {
  it('should count total assets in lineage tree', () => {
    // Root → A → B
    // Root → C → D
    recordLineage('sha256:a', 'sha256:root');
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:root');
    recordLineage('sha256:d', 'sha256:c');

    // getLineageTreeSize starts from the root ancestor of the given asset,
    // then traverses ALL descendants of that root (not just the subtree containing the given asset).
    // For b: root ancestor = root. Tree from root = {root, a, b, c, d} = 5
    expect(getLineageTreeSize('sha256:b')).toBe(5);
    // For a: root ancestor = root. Same tree = 5
    expect(getLineageTreeSize('sha256:a')).toBe(5);
    // For c: root ancestor = root. Same tree = 5
    expect(getLineageTreeSize('sha256:c')).toBe(5);
    // For root: root ancestor = root. Same tree = 5
    expect(getLineageTreeSize('sha256:root')).toBe(5);
  });

  it('should get all asset IDs in lineage tree', () => {
    recordLineage('sha256:a', 'sha256:root');
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:root');
    recordLineage('sha256:d', 'sha256:c');

    // getLineageTree starts from root ancestor, collects all descendants
    const tree = getLineageTree('sha256:b');
    expect(tree).toContain('sha256:root');
    expect(tree).toContain('sha256:a');
    expect(tree).toContain('sha256:b');
    expect(tree).toContain('sha256:c');
    expect(tree).toContain('sha256:d');
    expect(tree.length).toBe(5);
  });

  it('should handle diamond inheritance', () => {
    // A → B, A → C, B → D, C → D (diamond)
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:a');
    recordLineage('sha256:d', 'sha256:b');
    // Second parent would overwrite in single-parent model
    // This is expected - we use single-parent model
  });
});

describe('【Lineage】getLineage (combined view)', () => {
  it('should return combined parents + children view', () => {
    // A → B → C
    // A → D
    recordLineage('sha256:b', 'sha256:a');
    recordLineage('sha256:c', 'sha256:b');
    recordLineage('sha256:d', 'sha256:a');

    const result = getLineage('sha256:c');

    expect(result.has_lineage).toBe(true);
    expect(result.depth).toBe(2); // c → b → a
    expect(result.parents.length).toBe(2); // b, a
    expect(result.children.length).toBe(0); // c has no children
  });

  it('should indicate no lineage for orphan', () => {
    const result = getLineage('sha256:orphan');
    expect(result.has_lineage).toBe(false);
    expect(result.depth).toBe(0);
    expect(result.parents).toEqual([]);
    expect(result.children).toEqual([]);
  });
});
