// In-memory mock store
import { MockUser, MockMap, MockNode, MockEdge } from './index.js';

export class MockStore {
  users = new Map<string, MockUser>();
  maps = new Map<string, MockMap>();
  nodes = new Map<string, MockNode>();
  edges = new Map<string, MockEdge>();

  private genId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createUser(data: Omit<MockUser, 'id'|'createdAt'|'updatedAt'>): Promise<MockUser> {
    const u: MockUser = { ...data, id: this.genId('user'), createdAt: new Date(), updatedAt: new Date() };
    this.users.set(u.id, u); return u;
  }
  async findUserByEmail(email: string): Promise<MockUser|null> {
    for (const u of this.users.values()) if (u.email === email) return u;
    return null;
  }
  async findUserById(id: string): Promise<MockUser|null> { return this.users.get(id) || null; }

  async createMap(data: Omit<MockMap, 'id'|'createdAt'|'updatedAt'>): Promise<MockMap> {
    const m: MockMap = { ...data, id: this.genId('map'), createdAt: new Date(), updatedAt: new Date() };
    this.maps.set(m.id, m); return m;
  }
  async findMapById(id: string): Promise<MockMap|null> { return this.maps.get(id) || null; }
  async findMapsByUserId(userId: string): Promise<MockMap[]> {
    return Array.from(this.maps.values()).filter(m => m.userId === userId);
  }
  async updateMap(id: string, data: Partial<MockMap>): Promise<MockMap|null> {
    const m = this.maps.get(id); if (!m) return null;
    const updated = { ...m, ...data, updatedAt: new Date() };
    this.maps.set(id, updated); return updated;
  }
  async deleteMap(id: string): Promise<boolean> { return this.maps.delete(id); }

  async createNode(data: Omit<MockNode, 'id'|'createdAt'|'updatedAt'>): Promise<MockNode> {
    const n: MockNode = { ...data, id: this.genId('node'), createdAt: new Date(), updatedAt: new Date() };
    this.nodes.set(n.id, n); return n;
  }
  async findNodesByMapId(mapId: string): Promise<MockNode[]> {
    return Array.from(this.nodes.values()).filter(n => n.mapId === mapId);
  }
  async findNodeById(id: string): Promise<MockNode|null> { return this.nodes.get(id) || null; }
  async updateNode(id: string, data: Partial<MockNode>): Promise<MockNode|null> {
    const n = this.nodes.get(id); if (!n) return null;
    const updated = { ...n, ...data, updatedAt: new Date() };
    this.nodes.set(id, updated); return updated;
  }
  async deleteNode(id: string): Promise<boolean> {
    for (const e of this.edges.values()) { if (e.sourceId === id || e.targetId === id) this.edges.delete(e.id); }
    return this.nodes.delete(id);
  }

  async createEdge(data: Omit<MockEdge, 'id'|'createdAt'|'updatedAt'>): Promise<MockEdge> {
    const e: MockEdge = { ...data, id: this.genId('edge'), createdAt: new Date(), updatedAt: new Date() };
    this.edges.set(e.id, e); return e;
  }
  async findEdgesByMapId(mapId: string): Promise<MockEdge[]> {
    return Array.from(this.edges.values()).filter(e => e.mapId === mapId);
  }
  async findEdgeById(id: string): Promise<MockEdge|null> { return this.edges.get(id) || null; }
  async updateEdge(id: string, data: Partial<MockEdge>): Promise<MockEdge|null> {
    const e = this.edges.get(id); if (!e) return null;
    const updated = { ...e, ...data, updatedAt: new Date() };
    this.edges.set(id, updated); return updated;
  }
  async deleteEdge(id: string): Promise<boolean> { return this.edges.delete(id); }

  clear(): void { this.users.clear(); this.maps.clear(); this.nodes.clear(); this.edges.clear(); }
}

export const mockStore = new MockStore();

export async function initMockData(): Promise<void> {
  if (mockStore.users.size > 0) return;
  // Generate fresh hash for 'password123'
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.default.hash('password123', 10);
  const user = await mockStore.createUser({
    email: 'demo@evo.local', password: hash, name: 'Demo User',
    level: 1, reputation: 100, credits: 500,
  });
  const map = await mockStore.createMap({
    userId: user.id, name: 'My First Map', description: 'Demo map', isPublic: true,
  });
  const n1 = await mockStore.createNode({
    mapId: map.id, label: 'Concept Alpha', description: 'Start', nodeType: 'concept',
    positionX: 100, positionY: 100, metadata: { category: 'foundation' },
  });
  const n2 = await mockStore.createNode({
    mapId: map.id, label: 'Concept Beta', description: 'Advanced', nodeType: 'concept',
    positionX: 300, positionY: 100, metadata: { category: 'advanced' },
  });
  await mockStore.createEdge({ mapId: map.id, sourceId: n1.id, targetId: n2.id, label: 'evolves to', metadata: {} });
  console.log('📦 Mock data ready: demo@evo.local / password123');
}
