/**
 * Swarm Module Unit Tests
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as swarmService from './service';
import { SWARM_CONFIG } from './types';

interface MockSwarmTask {
  id: string; swarm_id: string; title: string; description: string;
  status: string; creator_id: string; workers: string[];
  cost: number; timeout_ms: number; result: any;
  created_at: Date; completed_at: Date | null; subtasks: MockSubtask[];
}
interface MockSubtask {
  id: string; subtask_id: string; swarm_id: string;
  title: string; description: string; status: string;
  assigned_to: string | null; result: string | null;
  assigned_at: Date | null; completed_at: Date | null;
}
interface MockNode { node_id: string; reputation: number; credit_balance: number; }

let tasks: MockSwarmTask[] = [];
let subtasks: MockSubtask[] = [];
let nodes: MockNode[] = [];
let idSeq = 1;

function resetState(): void {
  tasks = []; subtasks = []; idSeq = 1;
  nodes = [
    { node_id: 'n_creator', reputation: 60, credit_balance: 500 },
    { node_id: 'n_worker1', reputation: 40, credit_balance: 200 },
    { node_id: 'n_worker2', reputation: 50, credit_balance: 300 },
  ];
}

function makeTask(swarmId: string, overrides: Partial<MockSwarmTask> = {}): MockSwarmTask {
  return {
    id: 'id_' + (idSeq++), swarm_id: swarmId, title: 'Test Task',
    description: 'Test description', status: 'pending', creator_id: 'n_creator',
    workers: [], cost: 0, timeout_ms: SWARM_CONFIG.defaultTimeoutMs,
    result: null, created_at: new Date(), completed_at: null, subtasks: [],
    ...overrides,
  };
}

function subsFor(sid: string): MockSubtask[] {
  return subtasks.filter(s => s.swarm_id === sid);
}

const mp = {
  swarmTask: {
    findMany: jest.fn(async (o: any) => {
      let r = [...tasks];
      if (o.where?.status) r = r.filter(t => t.status === o.where.status);
      r.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      if (o.skip) r = r.slice(o.skip);
      if (o.take) r = r.slice(0, o.take);
      return r.map(t => ({ ...t, subtasks: subsFor(t.swarm_id).map(s => ({ status: s.status })) }));
    }),
    findUnique: jest.fn(async (o: any) => {
      const key = o.where.swarm_id ?? o.where.id;
      const t = tasks.find(x => x.swarm_id === key || x.id === key);
      return t ? { ...t, subtasks: subsFor(t.swarm_id) } : null;
    }),
    count: jest.fn(async (o: any) => {
      let r = [...tasks];
      if (o.where?.status) r = r.filter(t => t.status === o.where.status);
      return r.length;
    }),
    create: jest.fn(async (o: any) => {
      const d = o.data;
      const t: MockSwarmTask = {
        id: 'id_' + (idSeq++), swarm_id: d.swarm_id, title: d.title,
        description: d.description, status: d.status, creator_id: d.creator_id,
        workers: d.workers ?? [], cost: d.cost ?? 0,
        timeout_ms: d.timeout_ms ?? SWARM_CONFIG.defaultTimeoutMs,
        result: null, created_at: new Date(), completed_at: null, subtasks: [],
      };
      tasks.push(t);
      return { ...t, subtasks: [] };
    }),
    update: jest.fn(async (o: any) => {
      const key = o.where.swarm_id ?? o.where.id;
      const t = tasks.find(x => x.swarm_id === key || x.id === key);
      if (!t) throw new Error('Not found');
      Object.assign(t, o.data);
      return { ...t, subtasks: subsFor(t.swarm_id) };
    }),
  },
  swarmSubtask: {
    findMany: jest.fn(async (o: any) => {
      let r = [...subtasks];
      if (o.where?.swarm_id) r = r.filter(s => s.swarm_id === o.where.swarm_id);
      return r;
    }),
    findUnique: jest.fn(async (o: any) => {
      const key = o.where.subtask_id ?? o.where.id;
      return subtasks.find(s => s.subtask_id === key || s.id === key) ?? null;
    }),
    create: jest.fn(async (o: any) => {
      const d = o.data;
      const s: MockSubtask = {
        id: 'id_' + (idSeq++), subtask_id: d.subtask_id, swarm_id: d.swarm_id,
        title: d.title, description: d.description,
        status: d.status ?? 'pending', assigned_to: d.assigned_to ?? null,
        result: d.result ?? null, assigned_at: d.assigned_at ?? null,
        completed_at: d.completed_at ?? null,
      };
      subtasks.push(s);
      return s;
    }),
    update: jest.fn(async (o: any) => {
      const key = o.where.subtask_id ?? o.where.id;
      const s = subtasks.find(x => x.subtask_id === key || x.id === key);
      if (!s) throw new Error('Not found');
      Object.assign(s, o.data);
      return s;
    }),
  },
  node: {
    findUnique: jest.fn(async (o: any) => {
      return nodes.find(n => n.node_id === o.where.node_id) ?? null;
    }),
  },
};

const prisma = mp as any as import('@prisma/client').PrismaClient;

beforeEach(() => { resetState(); jest.clearAllMocks(); });

describe('listSwarmTasks', () => {
  it('returns empty list when no tasks exist', async () => {
    const result = await swarmService.listSwarmTasks(prisma);
    expect(result.tasks).toEqual([]);
    expect(result.total).toBe(0);
  });
  it('returns tasks with summary data', async () => {
    tasks.push(makeTask('sw_1', { status: 'pending' }));
    tasks.push(makeTask('sw_2', { status: 'running' }));
    const result = await swarmService.listSwarmTasks(prisma);
    expect(result.tasks).toHaveLength(2);
    expect(result.total).toBe(2);
  });
  it('filters by status', async () => {
    tasks.push(makeTask('sw_1', { status: 'pending' }));
    tasks.push(makeTask('sw_2', { status: 'running' }));
    const result = await swarmService.listSwarmTasks(prisma, { status: 'running' });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.status).toBe('running');
    expect(result.total).toBe(1);
  });
  it('paginates results', async () => {
    for (let i = 0; i < 5; i++) tasks.push(makeTask('sw_' + i));
    const result = await swarmService.listSwarmTasks(prisma, { limit: 2, offset: 0 });
    expect(result.tasks).toHaveLength(2);
    expect(result.total).toBe(5);
  });
});

describe('getSwarmTask', () => {
  it('returns null for non-existent task', async () => {
    const result = await swarmService.getSwarmTask(prisma, 'nonexistent');
    expect(result).toBeNull();
  });
  it('returns full task detail with subtasks', async () => {
    tasks.push(makeTask('sw_1', { status: 'running' }));
    subtasks.push({ id: 'sid_1', subtask_id: 'sub_1', swarm_id: 'sw_1',
      title: 'Sub 1', description: 'Desc', status: 'assigned',
      assigned_to: 'n_worker1', result: null,
      assigned_at: new Date(), completed_at: null });
    const result = await swarmService.getSwarmTask(prisma, 'sw_1');
    expect(result).not.toBeNull();
    expect(result!.swarm_id).toBe('sw_1');
    expect(result!.subtasks).toHaveLength(1);
    expect(result!.subtasks[0]!.subtask_id).toBe('sub_1');
  });
});

describe('createSwarmTask', () => {
  it('creates a task with pending status', async () => {
    const result = await swarmService.createSwarmTask(prisma, {
      creator_id: 'n_creator', title: 'My Task', description: 'A collaborative task',
    });
    expect(result.status).toBe('pending');
    expect(result.title).toBe('My Task');
    expect(result.subtasks).toEqual([]);
  });
  it('rejects short title', async () => {
    await expect(swarmService.createSwarmTask(prisma, {
      creator_id: 'n_creator', title: 'AB', description: 'Valid description',
    })).rejects.toThrow('Title must be at least 3 characters');
  });
  it('rejects short description', async () => {
    await expect(swarmService.createSwarmTask(prisma, {
      creator_id: 'n_creator', title: 'Valid Title', description: 'AB',
    })).rejects.toThrow('Description must be at least 5 characters');
  });
  it('rejects unknown creator', async () => {
    await expect(swarmService.createSwarmTask(prisma, {
      creator_id: 'n_unknown', title: 'Valid Title', description: 'Valid description',
    })).rejects.toThrow("Node 'n_unknown' not found");
  });
  it('uses custom timeout_ms', async () => {
    const result = await swarmService.createSwarmTask(prisma, {
      creator_id: 'n_creator', title: 'Timed Task',
      description: 'Custom timeout task', timeout_ms: 60000,
    });
    expect(result.timeout_ms).toBe(60000);
  });
});

describe('createSubtask', () => {
  it('creates subtask under existing task', async () => {
    tasks.push(makeTask('sw_1'));
    const result = await swarmService.createSubtask(prisma, {
      swarm_id: 'sw_1', title: 'Sub 1', description: 'A subtask',
    });
    expect(result.subtask_id).toBeTruthy();
    expect(result.status).toBe('pending');
  });
  it('transitions task from pending to recruiting', async () => {
    tasks.push(makeTask('sw_1', { status: 'pending' }));
    await swarmService.createSubtask(prisma, {
      swarm_id: 'sw_1', title: 'Sub 1', description: 'A subtask',
    });
    expect(tasks[0]!.status).toBe('recruiting');
  });
  it('assigns subtask when assigned_to provided', async () => {
    tasks.push(makeTask('sw_1', { status: 'recruiting' }));
    const result = await swarmService.createSubtask(prisma, {
      swarm_id: 'sw_1', title: 'Sub 1', description: 'A subtask',
      assigned_to: 'n_worker1',
    });
    expect(result.status).toBe('assigned');
    expect(result.assigned_to).toBe('n_worker1');
  });
  it('adds worker to task workers list', async () => {
    tasks.push(makeTask('sw_1', { status: 'recruiting', workers: [] }));
    await swarmService.createSubtask(prisma, {
      swarm_id: 'sw_1', title: 'Sub 1', description: 'A subtask',
      assigned_to: 'n_worker1',
    });
    expect(tasks[0]!.workers).toContain('n_worker1');
  });
  it('rejects subtask on completed task', async () => {
    tasks.push(makeTask('sw_1', { status: 'completed' }));
    await expect(swarmService.createSubtask(prisma, {
      swarm_id: 'sw_1', title: 'Sub 1', description: 'A subtask',
    })).rejects.toThrow('Cannot add subtasks to completed');
  });
  it('rejects subtask on failed task', async () => {
    tasks.push(makeTask('sw_1', { status: 'failed' }));
    await expect(swarmService.createSubtask(prisma, {
      swarm_id: 'sw_1', title: 'Sub 1', description: 'A subtask',
    })).rejects.toThrow('Cannot add subtasks to failed');
  });
  it('rejects short title', async () => {
    tasks.push(makeTask('sw_1'));
    await expect(swarmService.createSubtask(prisma, {
      swarm_id: 'sw_1', title: 'A', description: 'Desc',
    })).rejects.toThrow('at least 2 characters');
  });
  it('throws for non-existent swarm', async () => {
    await expect(swarmService.createSubtask(prisma, {
      swarm_id: 'nonexistent', title: 'Sub 1', description: 'Desc',
    })).rejects.toThrow("SwarmTask 'nonexistent' not found");
  });
});

describe('completeSubtask', () => {
  it('completes an assigned subtask', async () => {
    tasks.push(makeTask('sw_1', { status: 'recruiting' }));
    subtasks.push({ id: 'sid_1', subtask_id: 'sub_1', swarm_id: 'sw_1',
      title: 'Sub 1', description: 'Desc', status: 'assigned',
      assigned_to: 'n_worker1', result: null,
      assigned_at: new Date(), completed_at: null });
    const result = await swarmService.completeSubtask(prisma, {
      subtask_id: 'sub_1', result: 'Done!', worker_id: 'n_worker1',
    });
    expect(result.subtask.status).toBe('completed');
    expect(result.subtask.result).toBe('Done!');
  });
  it('transitions task to aggregating when all subtasks done', async () => {
    tasks.push(makeTask('sw_1', { status: 'running' }));
    subtasks.push({ id: 'sid_1', subtask_id: 'sub_1', swarm_id: 'sw_1',
      title: 'Sub 1', description: 'Desc', status: 'assigned',
      assigned_to: 'n_worker1', result: null,
      assigned_at: new Date(), completed_at: null });
    const result = await swarmService.completeSubtask(prisma, {
      subtask_id: 'sub_1', result: 'Done!', worker_id: 'n_worker1',
    });
    expect(result.swarmStatus).toBe('aggregating');
    expect(tasks[0]!.status).toBe('aggregating');
  });
  it('keeps task running when subtasks remain', async () => {
    tasks.push(makeTask('sw_1', { status: 'running' }));
    subtasks.push({ id: 'sid_1', subtask_id: 'sub_1', swarm_id: 'sw_1',
      title: 'Sub 1', description: 'Desc', status: 'assigned',
      assigned_to: 'n_worker1', result: null,
      assigned_at: new Date(), completed_at: null });
    subtasks.push({ id: 'sid_2', subtask_id: 'sub_2', swarm_id: 'sw_1',
      title: 'Sub 2', description: 'Desc', status: 'pending',
      assigned_to: null, result: null,
      assigned_at: null, completed_at: null });
    const result = await swarmService.completeSubtask(prisma, {
      subtask_id: 'sub_1', result: 'Done!', worker_id: 'n_worker1',
    });
    expect(result.swarmStatus).toBe('running');
  });
  it('rejects completing already completed subtask', async () => {
    tasks.push(makeTask('sw_1', { status: 'running' }));
    subtasks.push({ id: 'sid_1', subtask_id: 'sub_1', swarm_id: 'sw_1',
      title: 'Sub 1', description: 'Desc', status: 'completed',
      assigned_to: 'n_worker1', result: 'Already done',
      assigned_at: new Date(), completed_at: new Date() });
    await expect(swarmService.completeSubtask(prisma, {
      subtask_id: 'sub_1', result: 'Again', worker_id: 'n_worker1',
    })).rejects.toThrow('already completed');
  });
  it('throws for non-existent subtask', async () => {
    await expect(swarmService.completeSubtask(prisma, {
      subtask_id: 'nonexistent', result: 'Done', worker_id: 'n_worker1',
    })).rejects.toThrow("SwarmSubtask 'nonexistent' not found");
  });
});

describe('completeSwarmTask', () => {
  it('completes an aggregating task', async () => {
    tasks.push(makeTask('sw_1', { status: 'aggregating' }));
    subtasks.push({ id: 'sid_1', subtask_id: 'sub_1', swarm_id: 'sw_1',
      title: 'Sub 1', description: 'Desc', status: 'completed',
      assigned_to: 'n_worker1', result: 'Result 1',
      assigned_at: new Date(), completed_at: new Date() });
    const result = await swarmService.completeSwarmTask(prisma, {
      swarm_id: 'sw_1', aggregated_output: 'Combined result',
    });
    expect(result.status).toBe('completed');
    expect(result.result).not.toBeNull();
    expect(result.completed_at).not.toBeNull();
  });
  it('rejects completing already completed task', async () => {
    tasks.push(makeTask('sw_1', { status: 'completed' }));
    await expect(swarmService.completeSwarmTask(prisma, {
      swarm_id: 'sw_1', aggregated_output: 'Result',
    })).rejects.toThrow('already completed');
  });
  it('rejects completing a failed task', async () => {
    tasks.push(makeTask('sw_1', { status: 'failed' }));
    await expect(swarmService.completeSwarmTask(prisma, {
      swarm_id: 'sw_1', aggregated_output: 'Result',
    })).rejects.toThrow('Cannot complete a failed');
  });
  it('throws for non-existent task', async () => {
    await expect(swarmService.completeSwarmTask(prisma, {
      swarm_id: 'nonexistent', aggregated_output: 'Result',
    })).rejects.toThrow("SwarmTask 'nonexistent' not found");
  });
});


describe('failSwarmTask', () => {
  it('fails a running task', async () => {
    tasks.push(makeTask('sw_1', { status: 'running' }));
    const result = await swarmService.failSwarmTask(prisma, 'sw_1', 'Timeout exceeded');
    expect(result.status).toBe('failed');
    expect(result.result).not.toBeNull();
  });
  it('rejects failing a completed task', async () => {
    tasks.push(makeTask('sw_1', { status: 'completed' }));
    await expect(swarmService.failSwarmTask(prisma, 'sw_1', 'Error'))
      .rejects.toThrow('Cannot fail a completed');
  });
  it('throws for non-existent task', async () => {
    await expect(swarmService.failSwarmTask(prisma, 'nonexistent', 'Error'))
      .rejects.toThrow("SwarmTask 'nonexistent' not found");
  });
});

describe('cancelSwarmTask', () => {
  it('cancels a pending task by creator', async () => {
    tasks.push(makeTask('sw_1', { status: 'pending', creator_id: 'n_creator' }));
    const result = await swarmService.cancelSwarmTask(prisma, 'sw_1', 'n_creator');
    expect(result.success).toBe(true);
    expect(tasks[0]!.status).toBe('failed');
  });
  it('cancels a recruiting task by creator', async () => {
    tasks.push(makeTask('sw_1', { status: 'recruiting', creator_id: 'n_creator' }));
    const result = await swarmService.cancelSwarmTask(prisma, 'sw_1', 'n_creator');
    expect(result.success).toBe(true);
  });
  it('rejects cancelling a completed task', async () => {
    tasks.push(makeTask('sw_1', { status: 'completed', creator_id: 'n_creator' }));
    await expect(swarmService.cancelSwarmTask(prisma, 'sw_1', 'n_creator'))
      .rejects.toThrow('Cannot cancel');
  });
  it('rejects cancelling by non-creator', async () => {
    tasks.push(makeTask('sw_1', { status: 'pending', creator_id: 'n_creator' }));
    await expect(swarmService.cancelSwarmTask(prisma, 'sw_1', 'n_worker1'))
      .rejects.toThrow('Only the creator can cancel');
  });
  it('throws for non-existent task', async () => {
    await expect(swarmService.cancelSwarmTask(prisma, 'nonexistent', 'n_creator'))
      .rejects.toThrow("SwarmTask 'nonexistent' not found");
  });
});
