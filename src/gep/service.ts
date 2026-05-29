/**
 * GEP Service - Core implementation for Gene, Capsule, and Node management
 */

import { randomUUID } from 'crypto';
import {
  Gene,
  Capsule,
  GepNode,
  GeneCategory,
  ValidationResult,
  ValidationError,
  GeneRegistryRecord,
  CapsuleRegistryRecord,
  Adapter,
  RegisterGeneRequest,
  RegisterCapsuleRequest,
} from './types';

export class GepService {
  private geneRegistry: Map<string, GeneRegistryRecord> = new Map();
  private capsuleRegistry: Map<string, CapsuleRegistryRecord> = new Map();
  private nodeRegistry: Map<string, GepNode> = new Map();
  private adapters: Map<string, Adapter> = new Map();

  // Gene operations
  async registerGene(request: RegisterGeneRequest, nodeId: string): Promise<Gene> {
    const validation = this.validateGene(request);
    if (!validation.valid) {
      throw new Error(`Gene validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const now = new Date().toISOString();
    const gene: GeneRegistryRecord = {
      id: `gene_${randomUUID()}`,
      node_id: nodeId,
      name: request.name,
      description: request.description,
      category: request.category,
      validation: request.validation,
      strategy: request.strategy,
      capability_profile: request.capability_profile,
      metadata: request.metadata,
      created_at: now,
      updated_at: now,
    };

    this.geneRegistry.set(gene.id, gene);
    return gene;
  }

  async getGene(geneId: string): Promise<Gene | null> {
    return this.geneRegistry.get(geneId) || null;
  }

  async listGenes(nodeId?: string, category?: GeneCategory): Promise<Gene[]> {
    let genes = Array.from(this.geneRegistry.values());
    if (nodeId) {
      genes = genes.filter(g => g.node_id === nodeId);
    }
    if (category) {
      genes = genes.filter(g => g.category === category);
    }
    return genes;
  }

  // Capsule operations
  async registerCapsule(request: RegisterCapsuleRequest, nodeId: string): Promise<Capsule> {
    const validation = this.validateCapsule(request);
    if (!validation.valid) {
      throw new Error(`Capsule validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Validate gene references
    if (request.gene_ids && request.gene_ids.length > 0) {
      for (const geneId of request.gene_ids) {
        if (!this.geneRegistry.has(geneId)) {
          throw new Error(`Referenced gene ${geneId} not found`);
        }
      }
    }

    const now = new Date().toISOString();
    const capsule: CapsuleRegistryRecord = {
      id: `capsule_${randomUUID()}`,
      node_id: nodeId,
      name: request.name,
      description: request.description,
      content: request.content,
      strategy: request.strategy,
      genes: request.gene_ids || [],
      gene_ids: request.gene_ids || [],
      organism_id: request.organism_id,
      metadata: request.metadata,
      created_at: now,
      updated_at: now,
    };

    this.capsuleRegistry.set(capsule.id, capsule);
    return capsule;
  }

  async getCapsule(capsuleId: string): Promise<Capsule | null> {
    return this.capsuleRegistry.get(capsuleId) || null;
  }

  async listCapsules(nodeId?: string): Promise<Capsule[]> {
    let capsules = Array.from(this.capsuleRegistry.values());
    if (nodeId) {
      capsules = capsules.filter(c => c.node_id === nodeId);
    }
    return capsules;
  }

  // Node operations
  async registerNode(node: Omit<GepNode, 'created_at' | 'updated_at'>): Promise<GepNode> {
    const now = new Date().toISOString();
    const gepNode: GepNode = {
      ...node,
      created_at: now,
      updated_at: now,
    };
    this.nodeRegistry.set(gepNode.node_id, gepNode);
    return gepNode;
  }

  async getNode(nodeId: string): Promise<GepNode | null> {
    return this.nodeRegistry.get(nodeId) || null;
  }

  async discoverNodes(
    capabilities?: GeneCategory[],
    minReputation?: number,
    status?: GepNode['status'],
    limit = 20
  ): Promise<GepNode[]> {
    let nodes = Array.from(this.nodeRegistry.values())
      .filter(n => n.status === (status || 'active'));

    if (minReputation !== undefined) {
      nodes = nodes.filter(n => n.reputation >= minReputation);
    }
    if (capabilities && capabilities.length > 0) {
      nodes = nodes.filter(n => 
        n.supported_adapters && 
        capabilities.some(cap => (n.supported_adapters as string[]).includes(cap))
      );
    }
    return nodes.slice(0, limit);
  }

  async updateNodeHeartbeat(nodeId: string): Promise<GepNode | null> {
    const node = this.nodeRegistry.get(nodeId);
    if (!node) return null;
    node.last_heartbeat = new Date().toISOString();
    node.updated_at = new Date().toISOString();
    return node;
  }

  // Validation
  validateGene(request: Partial<RegisterGeneRequest>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!request.name || request.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required', code: 'MISSING_NAME' });
    }

    if (!request.description || request.description.trim().length === 0) {
      errors.push({ field: 'description', message: 'Description is required', code: 'MISSING_DESCRIPTION' });
    }

    const validCategories: GeneCategory[] = ['repair', 'optimize', 'innovate', 'explore'];
    if (!request.category || !validCategories.includes(request.category)) {
      errors.push({ 
        field: 'category', 
        message: `Category must be one of: ${validCategories.join(', ')}`, 
        code: 'INVALID_CATEGORY' 
      });
    }

    if (!request.validation || !Array.isArray(request.validation)) {
      errors.push({ field: 'validation', message: 'Validation must be an array', code: 'INVALID_VALIDATION' });
    }

    if (!request.strategy || !Array.isArray(request.strategy) || request.strategy.length < 2) {
      errors.push({ 
        field: 'strategy', 
        message: 'Strategy must be an array with at least 2 steps', 
        code: 'INSUFFICIENT_STRATEGY' 
      });
    }

    if (request.strategy && request.strategy.length > 0) {
      const emptySteps = request.strategy.filter(s => !s || s.trim().length === 0);
      if (emptySteps.length > 0) {
        errors.push({ 
          field: 'strategy', 
          message: 'Strategy steps cannot be empty', 
          code: 'EMPTY_STRATEGY_STEP' 
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateCapsule(request: Partial<RegisterCapsuleRequest>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!request.name || request.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required', code: 'MISSING_NAME' });
    }

    if (!request.description || request.description.trim().length === 0) {
      errors.push({ field: 'description', message: 'Description is required', code: 'MISSING_DESCRIPTION' });
    }

    if (!request.content || request.content.length < 50) {
      errors.push({ 
        field: 'content', 
        message: 'Content must be at least 50 characters', 
        code: 'CONTENT_TOO_SHORT' 
      });
    }

    if (!request.strategy || !Array.isArray(request.strategy) || request.strategy.length < 2) {
      errors.push({ 
        field: 'strategy', 
        message: 'Strategy must be an array with at least 2 steps', 
        code: 'INSUFFICIENT_STRATEGY' 
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // Adapter management
  registerAdapter(adapter: Adapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  getAdapter(name: string): Adapter | null {
    return this.adapters.get(name) || null;
  }

  listAdapters(): Adapter[] {
    return Array.from(this.adapters.values());
  }

  // Format conversion using adapters
  async convertToGep<T extends 'gene' | 'capsule'>(
    type: T,
    asset: unknown,
    adapterName: string
  ): Promise<T extends 'gene' ? Partial<Gene> : Partial<Capsule>> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter ${adapterName} not found`);
    }

    if (type === 'gene') {
      return adapter.toGepGene(asset) as unknown as T extends 'gene' ? Partial<Gene> : Partial<Capsule>;
    } else {
      return adapter.toGepCapsule(asset) as unknown as T extends 'gene' ? Partial<Gene> : Partial<Capsule>;
    }
  }

  async convertFromGep<T extends 'gene' | 'capsule'>(
    type: T,
    gepItem: T extends 'gene' ? Gene : Capsule,
    adapterName: string
  ): Promise<unknown> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter ${adapterName} not found`);
    }

    if (type === 'gene') {
      return adapter.fromGepGene(gepItem as Gene);
    } else {
      return adapter.fromGepCapsule(gepItem as Capsule);
    }
  }
}

// Singleton instance
export const gepService = new GepService();
