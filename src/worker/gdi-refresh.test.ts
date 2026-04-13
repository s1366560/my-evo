describe('refreshGDIScores dispute gating', () => {
  async function loadModuleWithDisputes(
    disputes: Array<{ status: string; ruling: { verdict: string } }>,
  ) {
    const tx = {
      node: {
        findUnique: jest.fn().mockResolvedValue({ reputation: 100 }),
        update: jest.fn(),
      },
      dispute: {
        findMany: jest.fn().mockResolvedValue(disputes),
      },
      asset: {
        updateMany: jest.fn(),
      },
      evolutionEvent: {
        create: jest.fn(),
      },
      creditTransaction: {
        create: jest.fn(),
      },
    };

    const mockPrisma = {
      $disconnect: jest.fn().mockResolvedValue(undefined),
      asset: {
        findMany: jest.fn().mockResolvedValue([
          {
            asset_id: 'asset-1',
            author_id: 'node-1',
            confidence: 1,
            execution_count: 10,
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            last_verified_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      },
      gDIScoreRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<boolean>) => callback(tx),
      ),
    };

    const calculateGDI = jest.fn().mockResolvedValue({
      gdi_lower: 95,
      gdi_mean: 95,
      dimensions: {
        intrinsic: 95,
      },
    });

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn(() => mockPrisma),
    }));
    jest.doMock('../assets/service', () => ({
      calculateGDI,
    }));

    let refreshGDIScores!: typeof import('./gdi-refresh').refreshGDIScores;
    let closeGDIRefreshWorker!: typeof import('./gdi-refresh').closeGDIRefreshWorker;
    await jest.isolateModulesAsync(async () => {
      ({ refreshGDIScores, closeGDIRefreshWorker } = await import('./gdi-refresh'));
    });

    return {
      tx,
      mockPrisma,
      calculateGDI,
      refreshGDIScores,
      closeGDIRefreshWorker,
    };
  }

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('does not auto-promote when pass and fail verdicts are tied', async () => {
    const {
      tx,
      mockPrisma,
      calculateGDI,
      refreshGDIScores,
      closeGDIRefreshWorker,
    } = await loadModuleWithDisputes([
      { status: 'resolved', ruling: { verdict: 'plaintiff_wins' } },
      { status: 'resolved', ruling: { verdict: 'defendant_wins' } },
      { status: 'resolved', ruling: { verdict: 'compromise' } },
    ]);

    const result = await refreshGDIScores();

    expect(result).toEqual({ refreshed: 1, promoted: 0 });
    expect(calculateGDI).toHaveBeenCalledWith('asset-1');
    expect(tx.dispute.findMany).toHaveBeenCalledWith({
      where: {
        type: { in: ['asset_quality', 'ASSET_QUALITY'] },
        OR: [
          { related_asset_id: 'asset-1' },
          { target_id: 'asset-1' },
        ],
      },
      select: { status: true, ruling: true },
    });
    expect(tx.asset.updateMany).not.toHaveBeenCalled();
    expect(tx.node.update).not.toHaveBeenCalled();
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();

    await closeGDIRefreshWorker();
    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not auto-promote while any asset-quality dispute is unresolved', async () => {
    const {
      tx,
      refreshGDIScores,
      closeGDIRefreshWorker,
    } = await loadModuleWithDisputes([
      { status: 'pending', ruling: { verdict: 'plaintiff_wins' } },
      { status: 'resolved', ruling: { verdict: 'defendant_wins' } },
    ]);

    const result = await refreshGDIScores();

    expect(result).toEqual({ refreshed: 1, promoted: 0 });
    expect(tx.asset.updateMany).not.toHaveBeenCalled();
    expect(tx.node.update).not.toHaveBeenCalled();
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();

    await closeGDIRefreshWorker();
  });
});

describe('runPeriodicMaintenance', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('runs GDI refresh, credit decay, and memory decay in one maintenance cycle', async () => {
    const tx = {
      node: {
        findUnique: jest.fn().mockResolvedValue({ reputation: 10 }),
        update: jest.fn(),
      },
      dispute: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      asset: {
        updateMany: jest.fn(),
      },
      evolutionEvent: {
        create: jest.fn(),
      },
      creditTransaction: {
        create: jest.fn(),
      },
    };

    const mockPrisma = {
      $disconnect: jest.fn().mockResolvedValue(undefined),
      asset: {
        findMany: jest.fn().mockResolvedValue([
          {
            asset_id: 'asset-1',
            author_id: 'node-1',
            confidence: 1,
            execution_count: 10,
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            last_verified_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      },
      gDIScoreRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<boolean>) => callback(tx),
      ),
    };
    const calculateGDI = jest.fn().mockResolvedValue({
      gdi_lower: 20,
      gdi_mean: 20,
      dimensions: {
        intrinsic: 0.3,
      },
    });
    const applyDecayToInactiveNodes = jest.fn().mockResolvedValue({
      processed: 2,
      decayed: 2,
      skipped: 0,
    });
    const triggerDecayAll = jest.fn().mockResolvedValue({
      processed: 3,
      skipped: 1,
    });

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn(() => mockPrisma),
    }));
    jest.doMock('../assets/service', () => ({
      calculateGDI,
    }));
    jest.doMock('../credits/service', () => ({
      applyDecayToInactiveNodes,
    }));
    jest.doMock('../memory_graph/service', () => ({
      triggerDecayAll,
    }));

    let runPeriodicMaintenance!: typeof import('./gdi-refresh').runPeriodicMaintenance;
    let closeGDIRefreshWorker!: typeof import('./gdi-refresh').closeGDIRefreshWorker;
    await jest.isolateModulesAsync(async () => {
      ({ runPeriodicMaintenance, closeGDIRefreshWorker } = await import('./gdi-refresh'));
    });

    const result = await runPeriodicMaintenance();

    expect(result).toEqual({
      refreshed: 1,
      promoted: 0,
      credits_processed: 2,
      credits_decayed: 2,
      credits_skipped: 0,
      memory_processed: 3,
      memory_skipped: 1,
    });
    expect(applyDecayToInactiveNodes).toHaveBeenCalledWith(100, mockPrisma);
    expect(triggerDecayAll).toHaveBeenCalledWith(undefined, 90, 100, mockPrisma);

    await closeGDIRefreshWorker();
  });
});

describe('startGDIRefreshWorker scheduling', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('creates the repeatable refresh job and cleans up queue resources on shutdown', async () => {
    const workerMock = {
      on: jest.fn(),
      waitUntilReady: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const queueMock = {
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue({ id: 'gdi-refresh:hourly' }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const redisMock = {
      quit: jest.fn().mockResolvedValue(undefined),
    };
    jest.doMock('bullmq', () => ({
      Worker: jest.fn(() => workerMock),
      Queue: jest.fn(() => queueMock),
      Job: class {},
    }));
    jest.doMock('ioredis', () => ({
      __esModule: true,
      default: jest.fn(() => redisMock),
    }));
    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn(() => ({
        $disconnect: jest.fn().mockResolvedValue(undefined),
      })),
    }));

    let startGDIRefreshWorker!: typeof import('./gdi-refresh').startGDIRefreshWorker;
    let closeGDIRefreshWorker!: typeof import('./gdi-refresh').closeGDIRefreshWorker;
    await jest.isolateModulesAsync(async () => {
      ({ startGDIRefreshWorker, closeGDIRefreshWorker } = await import('./gdi-refresh'));
    });

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await startGDIRefreshWorker({ logger, startupTimeoutMs: 100 });

    expect(queueMock.getRepeatableJobs).toHaveBeenCalledTimes(1);
    expect(queueMock.add).toHaveBeenCalledWith(
      'gdi-refresh:run',
      {},
      expect.objectContaining({
        jobId: 'gdi-refresh:hourly',
        repeat: { every: 60 * 60 * 1000 },
      }),
    );

    await closeGDIRefreshWorker();

    expect(workerMock.close).toHaveBeenCalledTimes(1);
    expect(queueMock.close).toHaveBeenCalledTimes(1);
    expect(redisMock.quit).toHaveBeenCalledTimes(1);
  });
});
