/**
 * Biology Dashboard Service
 * 
 * Ecosystem analytics for EvoMap - biological evolution concepts applied to AI agent networks.
 * Implements Shannon index, phylogeny, diversity metrics, and ecosystem health analysis.
 */

import { randomUUID } from 'crypto';

// Asset categories for ecosystem analysis
export type GeneCategory = 'repair' | 'optimize' | 'innovate' | 'security' | 'performance' | 'reliability';

// Node status for ecosystem
export type NodeStatus = 'active' | 'dormant' | 'extinct';

// Phylogeny node (represents an evolutionary lineage)
export interface PhylogenyNode {
  id: string;
  type: 'gene' | 'capsule' | 'agent';
  name: string;
  parent_id?: string;
  children: string[];
  gdi_score: number;
  category?: GeneCategory;
  created_at: number;
  mutations: number;
}

// Ecosystem metrics
export interface EcosystemMetrics {
  // Shannon diversity index (0-1, higher = more diverse)
  shannon_index: number;
  
  // Simpson's diversity index (0-1, higher = more diverse)
  simpson_index: number;
  
  // Gene category richness (number of unique categories)
  species_richness: number;
  
  // Evenness (how evenly distributed)
  evenness: number;
  
  // Gini coefficient (0 = equal, 1 = monopoly)
  gini_coefficient: number;
  
  // Active nodes in last 7 days
  active_nodes_7d: number;
  
  // Category distribution
  category_distribution: Record<GeneCategory, number>;
  
  // Signal diversity
  unique_signals: number;
}

// Selection pressure metrics
export interface SelectionPressure {
  // Open bounties creating demand
  open_bounties: number;
  
  // Total credits at stake
  bounty_pool: number;
  
  // Elimination rate (rejected + revoked in 30 days)
  elimination_rate: number;
  
  // Hot demand signals
  hot_signals: string[];
}

// Fitness landscape
export interface FitnessLandscape {
  // Grid cells with average fitness scores
  grid: FitnessGridCell[][];
  
  // Total samples
  total_samples: number;
}

// Single fitness grid cell
export interface FitnessGridCell {
  rigor: number;      // 0-1, analytical/thorough
  creativity: number;   // 0-1, innovative/experimental
  avg_fitness: number; // 0-100
  sample_count: number;
}

// Symbiotic relationship between nodes
export interface SymbioticRelationship {
  node_a: string;
  node_b: string;
  type: 'mutualism' | 'commensalism' | 'parasitism';
  references_a_to_b: number;
  references_b_to_a: number;
  strength: number; // 0-1
}

// Macro evolution event
export interface MacroEvent {
  id: string;
  type: 'explosion' | 'extinction';
  magnitude: number;
  week: string;
  created_count: number;
  revoked_count: number;
  description: string;
}

// Red Queen effect (relative fitness changes)
export interface RedQueenEffect {
  category: GeneCategory;
  early_gdi: number;
  recent_gdi: number;
  delta: number;  // positive = improving
  trend: 'rising' | 'declining' | 'stable';
}

// Epigenetic modification
export interface EpigeneticModification {
  id: string;
  asset_id: string;
  type: 'chromatin_open' | 'chromatin_closed' | 'methylation';
  context: string;
  triggered_by: string;
  timestamp: number;
}

// Guardrail gene
export interface GuardrailGene {
  gene_id: string;
  gdi_at_promotion: number;
  scope: 'warning' | 'blocking';
  description: string;
}

// Emergent pattern
export interface EmergentPattern {
  id: string;
  signal_cluster: string[];
  success_rate: number;
  baseline_rate: number;
  lift: number;
  sample_size: number;
  status: 'detected' | 'confirmed' | 'dismissed';
  environment_conditions: string[];
}

// In-memory store
const phylogenyNodes: Map<string, PhylogenyNode> = new Map();
const relationships: SymbioticRelationship[] = [];
const macroEvents: MacroEvent[] = [];
const patterns: EmergentPattern[] = [];

/**
 * Calculate Shannon diversity index
 * H = -Σ(pi * ln(pi))
 * where pi is the proportion of each category
 */
export function calculateShannonIndex(categoryCounts: Record<string, number>): number {
  const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  
  let shannon = 0;
  for (const count of Object.values(categoryCounts)) {
    const p = count / total;
    if (p > 0) {
      shannon -= p * Math.log(p);
    }
  }
  
  // Normalize to 0-1 range (divide by ln(n) where n is number of categories)
  const n = Object.keys(categoryCounts).filter(k => categoryCounts[k] > 0).length;
  return n > 1 ? shannon / Math.log(n) : 0;
}

/**
 * Calculate Simpson's diversity index
 * D = 1 - Σ(pi^2)
 */
export function calculateSimpsonIndex(categoryCounts: Record<string, number>): number {
  const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  
  let sumPiSquared = 0;
  for (const count of Object.values(categoryCounts)) {
    const p = count / total;
    sumPiSquared += p * p;
  }
  
  return 1 - sumPiSquared;
}

/**
 * Calculate Gini coefficient
 * Uses the Lorenz curve approach
 */
export function calculateGiniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sumX = sorted.reduce((sum, val) => sum + val, 0);
  
  if (sumX === 0) return 0;
  
  let cumY = 0;
  let sumArea = 0;
  
  for (let i = 0; i < n; i++) {
    cumY += sorted[i];
    sumArea += (sorted[i] / sumX) * ((i + 1) / n) - (cumY / sumX);
  }
  
  return 2 * sumArea;
}

/**
 * Get full ecosystem metrics
 */
export function getEcosystemMetrics(params: {
  categoryDistribution: Record<GeneCategory, number>;
  nodeContributions: number[];
  activeNodes7d: number;
  uniqueSignals: number;
}): EcosystemMetrics {
  const { categoryDistribution, nodeContributions, activeNodes7d, uniqueSignals } = params;
  
  const counts = Object.values(categoryDistribution);
  const total = counts.reduce((sum, c) => sum + c, 0);
  const n = counts.filter(c => c > 0).length;
  
  // Shannon index
  const shannon = calculateShannonIndex(categoryDistribution);
  
  // Simpson index
  const simpson = calculateSimpsonIndex(categoryDistribution);
  
  // Evenness (Shannon / ln(species))
  const evenness = n > 1 ? shannon / Math.log(n) : 0;
  
  // Gini coefficient
  const gini = calculateGiniCoefficient(nodeContributions);
  
  return {
    shannon_index: shannon,
    simpson_index: simpson,
    species_richness: n,
    evenness,
    gini_coefficient: gini,
    active_nodes_7d: activeNodes7d,
    category_distribution: categoryDistribution,
    unique_signals: uniqueSignals,
  };
}

/**
 * Add phylogeny node
 */
export function addPhylogenyNode(params: {
  type: 'gene' | 'capsule' | 'agent';
  name: string;
  parentId?: string;
  gdiScore: number;
  category?: GeneCategory;
}): PhylogenyNode {
  const node: PhylogenyNode = {
    id: `phylo_${randomUUID().slice(0, 8)}`,
    type: params.type,
    name: params.name,
    parent_id: params.parentId,
    children: [],
    gdi_score: params.gdiScore,
    category: params.category,
    created_at: Date.now(),
    mutations: 0,
  };
  
  phylogenyNodes.set(node.id, node);
  
  // Update parent's children
  if (params.parentId) {
    const parent = phylogenyNodes.get(params.parentId);
    if (parent) {
      parent.children.push(node.id);
    }
  }
  
  return node;
}

/**
 * Get phylogeny tree
 */
export function getPhylogenyTree(rootId?: string): PhylogenyNode[] {
  if (rootId) {
    const node = phylogenyNodes.get(rootId);
    return node ? [node] : [];
  }
  return Array.from(phylogenyNodes.values());
}

/**
 * Get node's evolutionary lineage
 */
export function getLineage(nodeId: string): PhylogenyNode[] {
  const lineage: PhylogenyNode[] = [];
  let current = phylogenyNodes.get(nodeId);
  
  while (current) {
    lineage.unshift(current);
    current = current.parent_id ? phylogenyNodes.get(current.parent_id) : undefined;
  }
  
  return lineage;
}

/**
 * Detect symbiotic relationships between nodes
 */
export function detectSymbioticRelationship(params: {
  nodeA: string;
  nodeB: string;
  referencesAToB: number;
  referencesBToA: number;
}): SymbioticRelationship {
  const { nodeA, nodeB, referencesAToB, referencesBToA } = params;
  
  let type: SymbioticRelationship['type'];
  let strength: number;
  
  if (referencesAToB > 0 && referencesBToA > 0) {
    type = 'mutualism';
    strength = Math.min(referencesAToB, referencesBToA) / Math.max(referencesAToB, referencesBToA);
  } else if (referencesAToB > referencesBToA) {
    type = 'commensalism';
    strength = referencesBToA / referencesAToB;
  } else {
    type = 'parasitism';
    strength = referencesAToB / referencesBToA;
  }
  
  const relationship: SymbioticRelationship = {
    node_a: nodeA,
    node_b: nodeB,
    type,
    references_a_to_b: referencesAToB,
    references_b_to_a: referencesBToA,
    strength,
  };
  
  // Check if relationship exists
  const existing = relationships.find(
    r => (r.node_a === nodeA && r.node_b === nodeB) ||
         (r.node_a === nodeB && r.node_b === nodeA)
  );
  
  if (existing) {
    Object.assign(existing, relationship);
    return existing;
  }
  
  relationships.push(relationship);
  return relationship;
}

/**
 * Get all symbiotic relationships
 */
export function getSymbioticRelationships(filter?: {
  type?: SymbioticRelationship['type'];
  minStrength?: number;
}): SymbioticRelationship[] {
  let result = relationships;
  
  if (filter?.type) {
    result = result.filter(r => r.type === filter.type);
  }
  if (filter?.minStrength !== undefined) {
    result = result.filter(r => r.strength >= filter.minStrength!);
  }
  
  return result;
}

/**
 * Record macro evolution event
 */
export function recordMacroEvent(params: {
  type: 'explosion' | 'extinction';
  magnitude: number;
  week: string;
  createdCount: number;
  revokedCount: number;
}): MacroEvent {
  const event: MacroEvent = {
    id: `macro_${randomUUID().slice(0, 8)}`,
    type: params.type,
    magnitude: params.magnitude,
    week: params.week,
    created_count: params.createdCount,
    revoked_count: params.revokedCount,
    description: params.type === 'explosion'
      ? `Rapid diversification detected in week ${params.week}`
      : `Asset purge detected in week ${params.week}`,
  };
  
  macroEvents.push(event);
  return event;
}

/**
 * Get macro events
 */
export function getMacroEvents(limit = 12): MacroEvent[] {
  return macroEvents.slice(-limit);
}

/**
 * Calculate selection pressure metrics
 */
export function getSelectionPressure(params: {
  openBounties: number;
  bountyPool: number;
  rejected30d: number;
  total30d: number;
  hotSignals: string[];
}): SelectionPressure {
  const eliminationRate = params.total30d > 0
    ? params.rejected30d / params.total30d
    : 0;
  
  return {
    open_bounties: params.openBounties,
    bounty_pool: params.bountyPool,
    elimination_rate: eliminationRate,
    hot_signals: params.hotSignals,
  };
}

/**
 * Get Red Queen effect analysis
 */
export function getRedQueenEffect(categories: GeneCategory[], earlyGDIs: number[], recentGDIs: number[]): RedQueenEffect[] {
  return categories.map((category, i) => {
    const delta = recentGDIs[i] - earlyGDIs[i];
    let trend: RedQueenEffect['trend'] = 'stable';
    if (delta > 2) trend = 'rising';
    else if (delta < -2) trend = 'declining';
    
    return {
      category,
      early_gdi: earlyGDIs[i],
      recent_gdi: recentGDIs[i],
      delta,
      trend,
    };
  });
}

/**
 * Get fitness landscape grid
 */
export function getFitnessLandscape(samples: Array<{rigor: number; creativity: number; fitness: number}>): FitnessLandscape {
  const gridSize = 5;
  const grid: FitnessGridCell[][] = [];
  
  // Initialize grid
  for (let r = 0; r < gridSize; r++) {
    grid[r] = [];
    for (let c = 0; c < gridSize; c++) {
      grid[r][c] = {
        rigor: r / (gridSize - 1),
        creativity: c / (gridSize - 1),
        avg_fitness: 0,
        sample_count: 0,
      };
    }
  }
  
  // Populate with samples
  samples.forEach(sample => {
    const r = Math.min(gridSize - 1, Math.floor(sample.rigor * (gridSize - 1)));
    const c = Math.min(gridSize - 1, Math.floor(sample.creativity * (gridSize - 1)));
    const cell = grid[r][c];
    cell.avg_fitness = (cell.avg_fitness * cell.sample_count + sample.fitness) / (cell.sample_count + 1);
    cell.sample_count++;
  });
  
  return {
    grid,
    total_samples: samples.length,
  };
}

/**
 * Add emergent pattern
 */
export function addEmergentPattern(params: {
  signalCluster: string[];
  successRate: number;
  baselineRate: number;
  environmentConditions: string[];
}): EmergentPattern {
  const pattern: EmergentPattern = {
    id: `pattern_${randomUUID().slice(0, 8)}`,
    signal_cluster: params.signalCluster,
    success_rate: params.successRate,
    baseline_rate: params.baselineRate,
    environment_conditions: params.environmentConditions,
    lift: params.baselineRate > 0 ? params.successRate / params.baselineRate : 0,
    status: 'detected',
    sample_size: 0,
  };
  
  patterns.push(pattern);
  return pattern;
}

/**
 * Get emergent patterns
 */
export function getEmergentPatterns(filter?: {
  status?: EmergentPattern['status'];
  minLift?: number;
}): EmergentPattern[] {
  let result = patterns;
  
  if (filter?.status) {
    result = result.filter(p => p.status === filter.status);
  }
  if (filter?.minLift !== undefined) {
    result = result.filter(p => p.lift >= filter.minLift!);
  }
  
  return result;
}

/**
 * Get biology statistics
 */
export function getBiologyStats(): {
  totalNodes: number;
  totalRelationships: number;
  totalMacroEvents: number;
  totalPatterns: number;
} {
  return {
    totalNodes: phylogenyNodes.size,
    totalRelationships: relationships.length,
    totalMacroEvents: macroEvents.length,
    totalPatterns: patterns.length,
  };
}
