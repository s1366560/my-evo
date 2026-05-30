/**
 * GEP Service Unit Tests
 * Tests for Gene, Capsule, and Node management
 */

import { GepService } from './service';
import { GeneCategory } from './types';

describe('GepService', () => {
  let service: GepService;

  beforeEach(() => {
    service = new GepService();
  });

  // ============ Gene Operations ============
  describe('Gene Operations', () => {
    const validGeneRequest = {
      name: 'test-gene',
      description: 'A test gene for validation',
      category: 'repair' as GeneCategory,
      validation: ['test_step_1', 'test_step_2'],
      strategy: ['analyze', 'fix'],
    };

    it('should register a valid gene', async () => {
      const gene = await service.registerGene(validGeneRequest, 'node_001') as any;
      
      expect(gene).toBeDefined();
      expect(gene.id).toMatch(/^gene_/);
      expect(gene.node_id).toBe('node_001');
      expect(gene.name).toBe('test-gene');
      expect(gene.category).toBe('repair');
      expect(gene.created_at).toBeDefined();
      expect(gene.updated_at).toBeDefined();
    });

    it('should reject gene without name', async () => {
      const invalidRequest = { ...validGeneRequest, name: '' };
      
      await expect(service.registerGene(invalidRequest, 'node_001'))
        .rejects.toThrow('Gene validation failed');
    });

    it('should reject gene without description', async () => {
      const invalidRequest = { ...validGeneRequest, description: '' };
      
      await expect(service.registerGene(invalidRequest, 'node_001'))
        .rejects.toThrow('Gene validation failed');
    });

    it('should reject gene with invalid category', async () => {
      const invalidRequest = { ...validGeneRequest, category: 'invalid' as GeneCategory };
      
      await expect(service.registerGene(invalidRequest, 'node_001'))
        .rejects.toThrow('Gene validation failed');
    });

    it('should reject gene with insufficient strategy steps', async () => {
      const invalidRequest = { ...validGeneRequest, strategy: ['only_one'] };
      
      await expect(service.registerGene(invalidRequest, 'node_001'))
        .rejects.toThrow('Gene validation failed');
    });

    it('should retrieve registered gene by ID', async () => {
      const registered = await service.registerGene(validGeneRequest, 'node_001');
      const retrieved = await service.getGene(registered.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(registered.id);
      expect(retrieved!.name).toBe('test-gene');
    });

    it('should return null for non-existent gene', async () => {
      const result = await service.getGene('non_existent_id');
      expect(result).toBeNull();
    });

    it('should list all genes', async () => {
      await service.registerGene(validGeneRequest, 'node_001');
      await service.registerGene(
        { ...validGeneRequest, name: 'gene-2', category: 'optimize' as GeneCategory },
        'node_002'
      );
      
      const genes = await service.listGenes();
      expect(genes.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter genes by node ID', async () => {
      await service.registerGene(validGeneRequest, 'node_001');
      await service.registerGene(
        { ...validGeneRequest, name: 'gene-2' },
        'node_002'
      );
      
      const node1Genes = await service.listGenes('node_001') as any[];
      expect(node1Genes.every(g => (g as any).node_id === 'node_001')).toBe(true);
    });

    it('should filter genes by category', async () => {
      await service.registerGene(validGeneRequest, 'node_001'); // repair
      await service.registerGene(
        { ...validGeneRequest, name: 'gene-2', category: 'optimize' as GeneCategory },
        'node_002'
      );
      
      const repairGenes = await service.listGenes(undefined, 'repair');
      expect(repairGenes.every(g => g.category === 'repair')).toBe(true);
    });
  });

  // ============ Capsule Operations ============
  describe('Capsule Operations', () => {
    const validCapsuleRequest = {
      name: 'test-capsule',
      description: 'A test capsule for validation',
      content: 'This is the content of the test capsule, which must be at least 50 characters long.',
      strategy: ['compose', 'validate'],
    };

    it('should register a valid capsule', async () => {
      const capsule = await service.registerCapsule(validCapsuleRequest, 'node_001') as any;
      
      expect(capsule).toBeDefined();
      expect(capsule.id).toMatch(/^capsule_/);
      expect(capsule.node_id).toBe('node_001');
      expect(capsule.name).toBe('test-capsule');
      expect(capsule.gene_ids).toEqual([]);
    });

    it('should register capsule with gene references', async () => {
      const gene = await service.registerGene({
        name: 'ref-gene',
        description: 'A gene to reference',
        category: 'repair',
        validation: ['test'],
        strategy: ['step1', 'step2'],
      }, 'node_001');

      const capsule = await service.registerCapsule(
        { ...validCapsuleRequest, gene_ids: [gene.id] },
        'node_001'
      ) as any;
      
      expect(capsule.gene_ids).toContain(gene.id);
    });

    it('should reject capsule referencing non-existent gene', async () => {
      const invalidRequest = {
        ...validCapsuleRequest,
        gene_ids: ['non_existent_gene'],
      };
      
      await expect(service.registerCapsule(invalidRequest, 'node_001'))
        .rejects.toThrow('Referenced gene');
    });

    it('should reject capsule without name', async () => {
      const invalidRequest = { ...validCapsuleRequest, name: '' };
      
      await expect(service.registerCapsule(invalidRequest, 'node_001'))
        .rejects.toThrow('Capsule validation failed');
    });

    it('should reject capsule with content less than 50 chars', async () => {
      const invalidRequest = { ...validCapsuleRequest, content: 'short' };
      
      await expect(service.registerCapsule(invalidRequest, 'node_001'))
        .rejects.toThrow('Capsule validation failed');
    });

    it('should retrieve registered capsule by ID', async () => {
      const registered = await service.registerCapsule(validCapsuleRequest, 'node_001');
      const retrieved = await service.getCapsule(registered.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(registered.id);
      expect(retrieved!.name).toBe('test-capsule');
    });

    it('should return null for non-existent capsule', async () => {
      const result = await service.getCapsule('non_existent_id');
      expect(result).toBeNull();
    });

    it('should list all capsules', async () => {
      await service.registerCapsule(validCapsuleRequest, 'node_001');
      await service.registerCapsule(
        { ...validCapsuleRequest, name: 'capsule-2' },
        'node_002'
      );
      
      const capsules = await service.listCapsules();
      expect(capsules.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter capsules by node ID', async () => {
      await service.registerCapsule(validCapsuleRequest, 'node_001');
      await service.registerCapsule(
        { ...validCapsuleRequest, name: 'capsule-2' },
        'node_002'
      );
      
      const node1Capsules = await service.listCapsules('node_001') as any[];
      expect(node1Capsules.every(c => c.node_id === 'node_001')).toBe(true);
    });
  });

  // ============ Node Operations ============
  describe('Node Operations', () => {
    it('should register a node', async () => {
      const node = await service.registerNode({
        node_id: 'node_001',
        name: 'Test Node',
        endpoint: 'https://api.test.com',
        reputation: 85,
        status: 'active',
      });
      
      expect(node.node_id).toBe('node_001');
      expect(node.name).toBe('Test Node');
      expect(node.created_at).toBeDefined();
    });

    it('should retrieve registered node', async () => {
      await service.registerNode({
        node_id: 'node_001',
        name: 'Test Node',
        endpoint: 'https://api.test.com',
        reputation: 85,
        status: 'active',
      });
      
      const node = await service.getNode('node_001');
      expect(node).not.toBeNull();
      expect(node!.node_id).toBe('node_001');
    });

    it('should return null for non-existent node', async () => {
      const result = await service.getNode('non_existent');
      expect(result).toBeNull();
    });

    it('should discover nodes by capabilities', async () => {
      await service.registerNode({
        node_id: 'node_001',
        name: 'Repair Node',
        endpoint: 'https://api.test.com',
        reputation: 85,
        status: 'active',
        supported_adapters: ['repair'],
      });
      await service.registerNode({
        node_id: 'node_002',
        name: 'Optimize Node',
        endpoint: 'https://api.test2.com',
        reputation: 90,
        status: 'active',
        supported_adapters: ['optimize'],
      });
      
      const repairNodes = await service.discoverNodes(['repair']);
      expect(repairNodes.length).toBeGreaterThanOrEqual(1);
      const firstNode = repairNodes[0];
      expect(firstNode && firstNode.supported_adapters && firstNode.supported_adapters.includes('repair')).toBe(true);
    });

    it('should discover nodes by minimum reputation', async () => {
      await service.registerNode({
        node_id: 'node_low',
        name: 'Low Rep Node',
        endpoint: 'https://api.low.com',
        reputation: 30,
        status: 'active',
      });
      await service.registerNode({
        node_id: 'node_high',
        name: 'High Rep Node',
        endpoint: 'https://api.high.com',
        reputation: 95,
        status: 'active',
      });
      
      const highRepNodes = await service.discoverNodes(undefined, 90);
      expect(highRepNodes.every(n => n.reputation >= 90)).toBe(true);
    });

    it('should update node heartbeat', async () => {
      await service.registerNode({
        node_id: 'node_001',
        name: 'Test Node',
        endpoint: 'https://api.test.com',
        reputation: 85,
        status: 'active',
      });
      
      const updated = await service.updateNodeHeartbeat('node_001');
      expect(updated).not.toBeNull();
      expect(updated!.last_heartbeat).toBeDefined();
    });

    it('should return null when updating heartbeat for non-existent node', async () => {
      const result = await service.updateNodeHeartbeat('non_existent');
      expect(result).toBeNull();
    });

    it('should limit discovered nodes', async () => {
      for (let i = 0; i < 5; i++) {
        await service.registerNode({
          node_id: `node_${i}`,
          name: `Node ${i}`,
          endpoint: `https://api.test${i}.com`,
          reputation: 80 + i,
          status: 'active',
        });
      }
      
      const nodes = await service.discoverNodes(undefined, undefined, undefined, 3);
      expect(nodes.length).toBeLessThanOrEqual(3);
    });
  });

  // ============ Adapter Management ============
  describe('Adapter Management', () => {
    const mockAdapter = {
      name: 'test-adapter',
      ecosystem: 'test',
      toGepGene: jest.fn().mockResolvedValue({ name: 'converted-gene' }),
      toGepCapsule: jest.fn().mockResolvedValue({ name: 'converted-capsule' }),
      fromGepGene: jest.fn().mockResolvedValue({ original: 'gene' }),
      fromGepCapsule: jest.fn().mockResolvedValue({ original: 'capsule' }),
    };

    it('should register an adapter', () => {
      service.registerAdapter(mockAdapter);
      const retrieved = service.getAdapter('test-adapter');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('test-adapter');
    });

    it('should list all adapters', () => {
      service.registerAdapter(mockAdapter);
      const adapters = service.listAdapters();
      expect(adapters.length).toBeGreaterThanOrEqual(1);
    });

    it('should return null for non-existent adapter', () => {
      const result = service.getAdapter('non_existent');
      expect(result).toBeNull();
    });
  });

  // ============ Format Conversion ============
  describe('Format Conversion', () => {
    const mockAdapter = {
      name: 'test-adapter',
      ecosystem: 'test',
      toGepGene: jest.fn().mockResolvedValue({ name: 'converted-gene' }),
      toGepCapsule: jest.fn().mockResolvedValue({ name: 'converted-capsule' }),
      fromGepGene: jest.fn().mockResolvedValue({ original: 'gene' }),
      fromGepCapsule: jest.fn().mockResolvedValue({ original: 'capsule' }),
    };

    beforeEach(() => {
      service.registerAdapter(mockAdapter);
    });

    it('should convert external asset to GEP gene format', async () => {
      const externalAsset = { name: 'external-gene', type: 'repair' };
      const result = await service.convertToGep('gene', externalAsset, 'test-adapter');
      
      expect(mockAdapter.toGepGene).toHaveBeenCalledWith(externalAsset);
      expect(result.name).toBe('converted-gene');
    });

    it('should convert external asset to GEP capsule format', async () => {
      const externalAsset = { name: 'external-capsule', content: 'test content' };
      const result = await service.convertToGep('capsule', externalAsset, 'test-adapter');
      
      expect(mockAdapter.toGepCapsule).toHaveBeenCalledWith(externalAsset);
      expect(result.name).toBe('converted-capsule');
    });

    it('should throw error for non-existent adapter on convertToGep', async () => {
      await expect(service.convertToGep('gene', {}, 'non_existent'))
        .rejects.toThrow('Adapter non_existent not found');
    });

    it('should convert GEP gene to external format', async () => {
      const gene = {
        id: 'gene_123',
        name: 'test-gene',
        description: 'test',
        category: 'repair' as GeneCategory,
        validation: ['test'],
        strategy: ['step1', 'step2'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const result = await service.convertFromGep('gene', gene, 'test-adapter');
      
      expect(mockAdapter.fromGepGene).toHaveBeenCalledWith(gene);
      expect(result).toEqual({ original: 'gene' });
    });

    it('should convert GEP capsule to external format', async () => {
      const capsule = {
        id: 'capsule_123',
        name: 'test-capsule',
        description: 'test',
        content: 'test content here that is long enough',
        strategy: ['step1', 'step2'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const result = await service.convertFromGep('capsule', capsule, 'test-adapter');
      
      expect(mockAdapter.fromGepCapsule).toHaveBeenCalledWith(capsule);
      expect(result).toEqual({ original: 'capsule' });
    });

    it('should throw error for non-existent adapter on convertFromGep', async () => {
      const gene = {
        id: 'gene_123',
        name: 'test-gene',
        description: 'test',
        category: 'repair' as GeneCategory,
        validation: ['test'],
        strategy: ['step1', 'step2'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      await expect(service.convertFromGep('gene', gene, 'non_existent'))
        .rejects.toThrow('Adapter non_existent not found');
    });
  });

  // ============ Validation ============
  describe('Validation', () => {
    describe('validateGene', () => {
      it('should validate a correct gene request', () => {
        const result = service.validateGene({
          name: 'valid-gene',
          description: 'A valid gene description',
          category: 'innovate',
          validation: ['step1', 'step2'],
          strategy: ['action1', 'action2'],
        });
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect empty name', () => {
        const result = service.validateGene({
          name: '',
          description: 'desc',
          category: 'repair',
          validation: ['test'],
          strategy: ['a', 'b'],
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
      });

      it('should detect missing description', () => {
        const result = service.validateGene({
          name: 'gene',
          description: '',
          category: 'repair',
          validation: ['test'],
          strategy: ['a', 'b'],
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'MISSING_DESCRIPTION')).toBe(true);
      });

      it('should detect invalid category', () => {
        const result = service.validateGene({
          name: 'gene',
          description: 'desc',
          category: 'unknown' as GeneCategory,
          validation: ['test'],
          strategy: ['a', 'b'],
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_CATEGORY')).toBe(true);
      });

      it('should detect non-array validation', () => {
        const result = service.validateGene({
          name: 'gene',
          description: 'desc',
          category: 'repair',
          validation: 'not-an-array' as unknown as string[],
          strategy: ['a', 'b'],
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_VALIDATION')).toBe(true);
      });

      it('should detect insufficient strategy steps', () => {
        const result = service.validateGene({
          name: 'gene',
          description: 'desc',
          category: 'repair',
          validation: ['test'],
          strategy: ['only-one'],
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INSUFFICIENT_STRATEGY')).toBe(true);
      });

      it('should detect empty strategy steps', () => {
        const result = service.validateGene({
          name: 'gene',
          description: 'desc',
          category: 'repair',
          validation: ['test'],
          strategy: ['step1', '', 'step3'],
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'EMPTY_STRATEGY_STEP')).toBe(true);
      });
    });

    describe('validateCapsule', () => {
      const validCapsuleData = {
        name: 'valid-capsule',
        description: 'A valid capsule description',
        content: 'This is the content of the capsule with enough characters.',
        strategy: ['compose', 'validate'],
      };

      it('should validate a correct capsule request', () => {
        const result = service.validateCapsule(validCapsuleData);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect empty name', () => {
        const result = service.validateCapsule({
          ...validCapsuleData,
          name: '',
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
      });

      it('should detect short content', () => {
        const result = service.validateCapsule({
          ...validCapsuleData,
          content: 'too short',
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'CONTENT_TOO_SHORT')).toBe(true);
      });

      it('should detect insufficient strategy steps', () => {
        const result = service.validateCapsule({
          ...validCapsuleData,
          strategy: ['only-one'],
        });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INSUFFICIENT_STRATEGY')).toBe(true);
      });
    });
  });
});
