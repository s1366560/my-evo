import { describe, it, expect } from '@jest/globals';
import { 
  registerSchema, 
  loginSchema, 
  a2aHelloSchema, 
  a2aHeartbeatSchema,
  assetPublishSchema,
  assetFetchSchema,
  bountyCreateSchema,
  memoryStoreSchema
} from '../models/schemas.js';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123',
      };
      
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        username: 'testuser',
        password: 'SecurePass123',
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'short',
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should reject invalid username characters', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'test user!',
        password: 'SecurePass123',
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
  
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };
      
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject missing password', () => {
      const invalidData = {
        email: 'test@example.com',
      };
      
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
  
  describe('a2aHelloSchema', () => {
    it('should validate correct hello data', () => {
      const validData = {
        name: 'My Test Node',
        description: 'A test node',
        capabilities: ['text-generation', 'analysis'],
        version: '1.0.0',
        endpoint: 'https://example.com/node',
      };
      
      const result = a2aHelloSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject empty name', () => {
      const invalidData = {
        name: '',
      };
      
      const result = a2aHelloSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should use defaults for optional fields', () => {
      const minimalData = {
        name: 'Minimal Node',
      };
      
      const result = a2aHelloSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilities).toEqual([]);
      }
    });
  });
  
  describe('a2aHeartbeatSchema', () => {
    it('should validate correct heartbeat data', () => {
      const validData = {
        node_id: 'node_abc123',
        status: 'active',
        active_tasks: ['task-1', 'task-2'],
        load: 0.75,
      };
      
      const result = a2aHeartbeatSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid status', () => {
      const invalidData = {
        node_id: 'node_abc123',
        status: 'invalid_status',
      };
      
      const result = a2aHeartbeatSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should reject load outside 0-1 range', () => {
      const invalidData = {
        node_id: 'node_abc123',
        status: 'active',
        load: 1.5,
      };
      
      const result = a2aHeartbeatSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
  
  describe('assetPublishSchema', () => {
    it('should validate gene type asset', () => {
      const validData = {
        type: 'gene',
        name: 'Creative Writing Gene',
        description: 'A gene for creative writing',
        content: {
          dna: 'ATCGATCG...',
          tools: [],
          model: 'gpt-4',
        },
        tags: ['writing', 'creative'],
        license: 'MIT',
      };
      
      const result = assetPublishSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should validate capsule type asset', () => {
      const validData = {
        type: 'capsule',
        name: 'Analysis Capsule',
        content: {
          prompt: 'You are a helpful assistant...',
          tools: ['web-search', 'calculator'],
        },
        tags: ['analysis'],
        license: 'Apache-2.0',
      };
      
      const result = assetPublishSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid asset type', () => {
      const invalidData = {
        type: 'invalid',
        name: 'Test Asset',
        content: {},
      };
      
      const result = assetPublishSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should reject more than 10 tags', () => {
      const invalidData = {
        type: 'gene',
        name: 'Test Asset',
        content: { dna: 'ATCG' },
        tags: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
      };
      
      const result = assetPublishSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
  
  describe('assetFetchSchema', () => {
    it('should validate correct fetch parameters', () => {
      const validData = {
        query: 'creative writing',
        type: 'gene',
        tags: ['writing'],
        sort: 'gdi',
        limit: 50,
        offset: 10,
      };
      
      const result = assetFetchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should use defaults for missing optional fields', () => {
      const minimalData = {};
      
      const result = assetFetchSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe('recent');
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });
    
    it('should reject limit over 100', () => {
      const invalidData = {
        limit: 200,
      };
      
      const result = assetFetchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
  
  describe('bountyCreateSchema', () => {
    it('should validate correct bounty data', () => {
      const validData = {
        title: 'Create a Writing Assistant',
        description: 'Build an AI writing assistant with specific features...',
        requirements: 'Must use GPT-4, support markdown...',
        reward: 100.50,
        expires_in_days: 30,
      };
      
      const result = bountyCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject description too short', () => {
      const invalidData = {
        title: 'Test Bounty',
        description: 'Short',
        reward: 50,
      };
      
      const result = bountyCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should reject negative reward', () => {
      const invalidData = {
        title: 'Test Bounty',
        description: 'A valid description that is long enough',
        reward: -10,
      };
      
      const result = bountyCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should reject expires_in_days over 90', () => {
      const invalidData = {
        title: 'Test Bounty',
        description: 'A valid description that is long enough for this bounty task',
        reward: 50,
        expires_in_days: 100,
      };
      
      const result = bountyCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
  
  describe('memoryStoreSchema', () => {
    it('should validate correct memory data', () => {
      const validData = {
        type: 'skill',
        content: 'How to solve differential equations',
        embedding: [0.1, 0.2, 0.3],
        metadata: { source: 'math-course' },
      };
      
      const result = memoryStoreSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid memory type', () => {
      const invalidData = {
        type: 'invalid_type',
        content: 'Some content',
      };
      
      const result = memoryStoreSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
    
    it('should accept valid memory types', () => {
      const types = ['fact', 'skill', 'experience', 'rule'];
      
      for (const type of types) {
        const data = {
          type,
          content: 'Test content',
        };
        
        const result = memoryStoreSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });
  });
});
