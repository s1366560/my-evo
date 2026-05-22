// DB Mock Store Unit Tests
import { describe, test, expect, beforeEach } from '@jest/globals';
import { MockStore } from './mock-store.js';
import type { MockUser, MockMap, MockNode, MockEdge } from './index.js';

describe('MockStore', () => {
  let store: MockStore;

  beforeEach(() => {
    store = new MockStore();
  });

  describe('User operations', () => {
    test('should create a user', async () => {
      const user = await store.createUser({
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        level: 1,
        reputation: 100,
        credits: 500,
      });
      expect(user.id).toMatch(/^user_/);
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    test('should find user by email', async () => {
      const created = await store.createUser({
        email: 'findme@example.com',
        password: 'hash',
        name: 'Find Me',
        level: 1,
        reputation: 50,
        credits: 100,
      });
      const found = await store.findUserByEmail('findme@example.com');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    test('should return null for non-existent email', async () => {
      const found = await store.findUserByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });

    test('should find user by id', async () => {
      const created = await store.createUser({
        email: 'byid@example.com',
        password: 'hash',
        name: 'By ID',
        level: 1,
        reputation: 75,
        credits: 200,
      });
      const found = await store.findUserById(created.id);
      expect(found).not.toBeNull();
      expect(found!.email).toBe('byid@example.com');
    });
  });

  describe('Map operations', () => {
    let testUserId: string;

    beforeEach(async () => {
      const user = await store.createUser({
        email: 'mapuser@example.com',
        password: 'hash',
        name: 'Map User',
        level: 1,
        reputation: 100,
        credits: 500,
      });
      testUserId = user.id;
    });

    test('should create a map', async () => {
      const map = await store.createMap({
        userId: testUserId,
        name: 'My Map',
        description: 'Test description',
        isPublic: true,
      });
      expect(map.id).toMatch(/^map_/);
      expect(map.name).toBe('My Map');
      expect(map.userId).toBe(testUserId);
    });

    test('should find map by id', async () => {
      const created = await store.createMap({
        userId: testUserId,
        name: 'Find Map',
        description: 'Find me',
        isPublic: false,
      });
      const found = await store.findMapById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Find Map');
    });

    test('should find maps by user id', async () => {
      await store.createMap({
        userId: testUserId,
        name: 'Map 1',
        description: 'First',
        isPublic: true,
      });
      await store.createMap({
        userId: testUserId,
        name: 'Map 2',
        description: 'Second',
        isPublic: false,
      });
      const maps = await store.findMapsByUserId(testUserId);
      expect(maps).toHaveLength(2);
    });

    test('should update map', async () => {
      const created = await store.createMap({
        userId: testUserId,
        name: 'Old Name',
        description: 'Old',
        isPublic: false,
      });
      const updated = await store.updateMap(created.id, {
        name: 'New Name',
        isPublic: true,
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
      expect(updated!.isPublic).toBe(true);
    });

    test('should delete map', async () => {
      const created = await store.createMap({
        userId: testUserId,
        name: 'To Delete',
        description: 'Will be deleted',
        isPublic: true,
      });
      const result = await store.deleteMap(created.id);
      expect(result).toBe(true);
      const found = await store.findMapById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('Node operations', () => {
    let testMapId: string;

    beforeEach(async () => {
      const user = await store.createUser({
        email: 'nodeuser@example.com',
        password: 'hash',
        name: 'Node User',
        level: 1,
        reputation: 100,
        credits: 500,
      });
      const map = await store.createMap({
        userId: user.id,
        name: 'Node Map',
        description: 'For nodes',
        isPublic: true,
      });
      testMapId = map.id;
    });

    test('should create a node', async () => {
      const node = await store.createNode({
        mapId: testMapId,
        label: 'Test Node',
        description: 'A test node',
        nodeType: 'concept',
        positionX: 100,
        positionY: 200,
        metadata: { category: 'test' },
      });
      expect(node.id).toMatch(/^node_/);
      expect(node.label).toBe('Test Node');
      expect(node.mapId).toBe(testMapId);
    });

    test('should find nodes by map id', async () => {
      await store.createNode({
        mapId: testMapId,
        label: 'Node 1',
        description: 'First',
        nodeType: 'concept',
        positionX: 0,
        positionY: 0,
        metadata: {},
      });
      await store.createNode({
        mapId: testMapId,
        label: 'Node 2',
        description: 'Second',
        nodeType: 'concept',
        positionX: 100,
        positionY: 100,
        metadata: {},
      });
      const nodes = await store.findNodesByMapId(testMapId);
      expect(nodes).toHaveLength(2);
    });

    test('should update node', async () => {
      const created = await store.createNode({
        mapId: testMapId,
        label: 'Old Label',
        description: 'Old',
        nodeType: 'concept',
        positionX: 0,
        positionY: 0,
        metadata: {},
      });
      const updated = await store.updateNode(created.id, {
        label: 'New Label',
        positionX: 50,
      });
      expect(updated).not.toBeNull();
      expect(updated!.label).toBe('New Label');
      expect(updated!.positionX).toBe(50);
    });

    test('should delete node and its edges', async () => {
      const node = await store.createNode({
        mapId: testMapId,
        label: 'To Delete',
        description: 'Delete me',
        nodeType: 'concept',
        positionX: 0,
        positionY: 0,
        metadata: {},
      });
      await store.createEdge({
        mapId: testMapId,
        sourceId: node.id,
        targetId: node.id,
        label: 'self',
        metadata: {},
      });
      await store.deleteNode(node.id);
      const found = await store.findNodeById(node.id);
      expect(found).toBeNull();
    });
  });

  describe('Edge operations', () => {
    let testMapId: string;
    let node1Id: string;
    let node2Id: string;

    beforeEach(async () => {
      const user = await store.createUser({
        email: 'edgeuser@example.com',
        password: 'hash',
        name: 'Edge User',
        level: 1,
        reputation: 100,
        credits: 500,
      });
      const map = await store.createMap({
        userId: user.id,
        name: 'Edge Map',
        description: 'For edges',
        isPublic: true,
      });
      testMapId = map.id;
      const n1 = await store.createNode({
        mapId: testMapId,
        label: 'Source',
        description: 'Source node',
        nodeType: 'concept',
        positionX: 0,
        positionY: 0,
        metadata: {},
      });
      const n2 = await store.createNode({
        mapId: testMapId,
        label: 'Target',
        description: 'Target node',
        nodeType: 'concept',
        positionX: 100,
        positionY: 100,
        metadata: {},
      });
      node1Id = n1.id;
      node2Id = n2.id;
    });

    test('should create an edge', async () => {
      const edge = await store.createEdge({
        mapId: testMapId,
        sourceId: node1Id,
        targetId: node2Id,
        label: 'connects to',
        metadata: { weight: 1 },
      });
      expect(edge.id).toMatch(/^edge_/);
      expect(edge.sourceId).toBe(node1Id);
      expect(edge.targetId).toBe(node2Id);
    });

    test('should find edges by map id', async () => {
      await store.createEdge({
        mapId: testMapId,
        sourceId: node1Id,
        targetId: node2Id,
        label: 'edge1',
        metadata: {},
      });
      await store.createEdge({
        mapId: testMapId,
        sourceId: node2Id,
        targetId: node1Id,
        label: 'edge2',
        metadata: {},
      });
      const edges = await store.findEdgesByMapId(testMapId);
      expect(edges).toHaveLength(2);
    });

    test('should update edge', async () => {
      const created = await store.createEdge({
        mapId: testMapId,
        sourceId: node1Id,
        targetId: node2Id,
        label: 'old label',
        metadata: {},
      });
      const updated = await store.updateEdge(created.id, {
        label: 'new label',
        metadata: { weight: 5 },
      });
      expect(updated).not.toBeNull();
      expect(updated!.label).toBe('new label');
      expect(updated!.metadata.weight).toBe(5);
    });

    test('should delete edge', async () => {
      const created = await store.createEdge({
        mapId: testMapId,
        sourceId: node1Id,
        targetId: node2Id,
        label: 'to delete',
        metadata: {},
      });
      const result = await store.deleteEdge(created.id);
      expect(result).toBe(true);
      const found = await store.findEdgeById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('clear', () => {
    test('should clear all data', async () => {
      const user = await store.createUser({
        email: 'clear@example.com',
        password: 'hash',
        name: 'Clear Me',
        level: 1,
        reputation: 100,
        credits: 500,
      });
      const map = await store.createMap({
        userId: user.id,
        name: 'Clear Map',
        description: 'To be cleared',
        isPublic: true,
      });
      await store.createNode({
        mapId: map.id,
        label: 'Clear Node',
        description: 'Clear',
        nodeType: 'concept',
        positionX: 0,
        positionY: 0,
        metadata: {},
      });
      store.clear();
      expect(store.users.size).toBe(0);
      expect(store.maps.size).toBe(0);
      expect(store.nodes.size).toBe(0);
      expect(store.edges.size).toBe(0);
    });
  });
});
