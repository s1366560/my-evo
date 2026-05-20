// Map Routes Integration Tests — tests actual MockStore and HttpError
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MockStore } from '../db/mock-store.js';
import { HttpError } from '../middleware/errorHandler.js';

describe('Map Routes — MockStore Integration', () => {
  let store: MockStore;
  let userId: string;
  let mapId: string;
  let nodeId: string;

  beforeEach(() => {
    store = new MockStore();
  });

  // --- User (setup) ---
  test('createUser returns a MockUser with id and timestamps', async () => {
    const user = await store.createUser({
      email: 'alice@test.com', password: 'hashed', name: 'Alice',
      level: 1, reputation: 10, credits: 50,
    });
    userId = user.id;
    expect(user.id).toMatch(/^user_/);
    expect(user.email).toBe('alice@test.com');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  // --- Map CRUD ---
  test('createMap returns a MockMap with generated id', async () => {
    const user = await store.createUser({
      email: 'bob@test.com', password: 'x', name: 'Bob', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({
      userId: user.id, name: 'Test Map', description: 'desc', isPublic: false,
    });
    mapId = map.id;
    expect(map.id).toMatch(/^map_/);
    expect(map.name).toBe('Test Map');
    expect(map.userId).toBe(user.id);
  });

  test('findMapById returns null for non-existent id', async () => {
    const result = await store.findMapById('nonexistent');
    expect(result).toBeNull();
  });

  test('findMapsByUserId returns only maps for that user', async () => {
    const user = await store.createUser({
      email: 'carol@test.com', password: 'x', name: 'Carol', level: 1, reputation: 0, credits: 0,
    });
    const map1 = await store.createMap({ userId: user.id, name: 'Map A', description: '', isPublic: false });
    await store.createMap({ userId: user.id, name: 'Map B', description: '', isPublic: false });
    const otherUser = await store.createUser({
      email: 'dave@test.com', password: 'x', name: 'Dave', level: 1, reputation: 0, credits: 0,
    });
    await store.createMap({ userId: otherUser.id, name: 'Other Map', description: '', isPublic: false });
    const maps = await store.findMapsByUserId(user.id);
    expect(maps).toHaveLength(2);
    expect(maps.map(m => m.name)).toEqual(expect.arrayContaining(['Map A', 'Map B']));
  });

  test('updateMap merges fields and sets updatedAt', async () => {
    const user = await store.createUser({
      email: 'eve@test.com', password: 'x', name: 'Eve', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'Old Name', description: '', isPublic: false });
    const updated = await store.updateMap(map.id, { name: 'New Name', isPublic: true });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
    expect(updated!.isPublic).toBe(true);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(map.updatedAt.getTime());
  });

  test('updateMap returns null for non-existent id', async () => {
    const result = await store.updateMap('fake_map_id', { name: 'X' });
    expect(result).toBeNull();
  });

  test('deleteMap returns true and removes map', async () => {
    const user = await store.createUser({
      email: 'frank@test.com', password: 'x', name: 'Frank', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'ToDelete', description: '', isPublic: false });
    const deleted = await store.deleteMap(map.id);
    expect(deleted).toBe(true);
    const found = await store.findMapById(map.id);
    expect(found).toBeNull();
  });

  // --- Node CRUD ---
  test('createNode returns a MockNode with generated id', async () => {
    const user = await store.createUser({
      email: 'grace@test.com', password: 'x', name: 'Grace', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'Map', description: '', isPublic: false });
    const node = await store.createNode({
      mapId: map.id, label: 'Concept Alpha', description: 'Start', nodeType: 'concept',
      positionX: 100, positionY: 200, metadata: { tag: 'foundation' },
    });
    nodeId = node.id;
    expect(node.id).toMatch(/^node_/);
    expect(node.label).toBe('Concept Alpha');
    expect(node.nodeType).toBe('concept');
    expect(node.positionX).toBe(100);
  });

  test('findNodesByMapId returns only nodes for that map', async () => {
    const user = await store.createUser({
      email: 'henry@test.com', password: 'x', name: 'Henry', level: 1, reputation: 0, credits: 0,
    });
    const map1 = await store.createMap({ userId: user.id, name: 'M1', description: '', isPublic: false });
    const map2 = await store.createMap({ userId: user.id, name: 'M2', description: '', isPublic: false });
    await store.createNode({ mapId: map1.id, label: 'N1', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    await store.createNode({ mapId: map1.id, label: 'N2', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    await store.createNode({ mapId: map2.id, label: 'N3', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const nodes = await store.findNodesByMapId(map1.id);
    expect(nodes).toHaveLength(2);
  });

  test('updateNode merges partial fields', async () => {
    const user = await store.createUser({
      email: 'iris@test.com', password: 'x', name: 'Iris', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'M', description: '', isPublic: false });
    const node = await store.createNode({ mapId: map.id, label: 'Old', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const updated = await store.updateNode(node.id, { label: 'New Label', description: 'Updated desc' });
    expect(updated).not.toBeNull();
    expect(updated!.label).toBe('New Label');
    expect(updated!.description).toBe('Updated desc');
  });

  test('deleteNode returns true and removes node', async () => {
    const user = await store.createUser({
      email: 'jack@test.com', password: 'x', name: 'Jack', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'M', description: '', isPublic: false });
    const node = await store.createNode({ mapId: map.id, label: 'ToDelete', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const deleted = await store.deleteNode(node.id);
    expect(deleted).toBe(true);
    const found = await store.findNodeById(node.id);
    expect(found).toBeNull();
  });

  test('deleteNode also removes connected edges', async () => {
    const user = await store.createUser({
      email: 'kate@test.com', password: 'x', name: 'Kate', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'M', description: '', isPublic: false });
    const n1 = await store.createNode({ mapId: map.id, label: 'N1', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const n2 = await store.createNode({ mapId: map.id, label: 'N2', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    await store.createEdge({ mapId: map.id, sourceId: n1.id, targetId: n2.id, label: 'link', metadata: {} });
    await store.deleteNode(n1.id);
    const edges = await store.findEdgesByMapId(map.id);
    expect(edges.some(e => e.sourceId === n1.id)).toBe(false);
  });

  // --- Edge CRUD ---
  test('createEdge returns a MockEdge with generated id', async () => {
    const user = await store.createUser({
      email: 'leo@test.com', password: 'x', name: 'Leo', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'M', description: '', isPublic: false });
    const n1 = await store.createNode({ mapId: map.id, label: 'N1', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const n2 = await store.createNode({ mapId: map.id, label: 'N2', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const edge = await store.createEdge({ mapId: map.id, sourceId: n1.id, targetId: n2.id, label: 'evolves to', metadata: { weight: 1 } });
    expect(edge.id).toMatch(/^edge_/);
    expect(edge.sourceId).toBe(n1.id);
    expect(edge.targetId).toBe(n2.id);
    expect(edge.label).toBe('evolves to');
  });

  test('findEdgesByMapId returns only edges for that map', async () => {
    const user = await store.createUser({
      email: 'maya@test.com', password: 'x', name: 'Maya', level: 1, reputation: 0, credits: 0,
    });
    const map1 = await store.createMap({ userId: user.id, name: 'M1', description: '', isPublic: false });
    const map2 = await store.createMap({ userId: user.id, name: 'M2', description: '', isPublic: false });
    const n1 = await store.createNode({ mapId: map1.id, label: 'N1', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const n2 = await store.createNode({ mapId: map1.id, label: 'N2', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const n3 = await store.createNode({ mapId: map2.id, label: 'N3', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    await store.createEdge({ mapId: map1.id, sourceId: n1.id, targetId: n2.id, label: 'e1', metadata: {} });
    await store.createEdge({ mapId: map2.id, sourceId: n3.id, targetId: n3.id, label: 'e2', metadata: {} });
    const edges = await store.findEdgesByMapId(map1.id);
    expect(edges).toHaveLength(1);
    expect(edges[0].label).toBe('e1');
  });

  test('deleteEdge returns true and removes edge', async () => {
    const user = await store.createUser({
      email: 'noah@test.com', password: 'x', name: 'Noah', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'M', description: '', isPublic: false });
    const n1 = await store.createNode({ mapId: map.id, label: 'N1', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const n2 = await store.createNode({ mapId: map.id, label: 'N2', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const edge = await store.createEdge({ mapId: map.id, sourceId: n1.id, targetId: n2.id, label: 'e', metadata: {} });
    const deleted = await store.deleteEdge(edge.id);
    expect(deleted).toBe(true);
    const found = await store.findEdgeById(edge.id);
    expect(found).toBeNull();
  });
});

describe('Map Routes — HttpError', () => {
  test('HttpError constructs with statusCode and message', () => {
    const err = new HttpError(400, 'Label and mapId required');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Label and mapId required');
    expect(err instanceof Error).toBe(true);
    expect(err.isOperational).toBe(true);
  });

  test('HttpError 401 with No token provided', () => {
    const err = new HttpError(401, 'No token provided');
    expect(err.statusCode).toBe(401);
  });

  test('HttpError 404 for Node not found', () => {
    const err = new HttpError(404, 'Node not found');
    expect(err.statusCode).toBe(404);
  });

  test('HttpError 404 for Map not found', () => {
    const err = new HttpError(404, 'Map not found');
    expect(err.statusCode).toBe(404);
  });

  test('HttpError 400 for missing mapId/sourceId/targetId', () => {
    const err = new HttpError(400, 'mapId, sourceId, targetId required');
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('sourceId');
  });
});
