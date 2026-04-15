describe('buildApp health wiring', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  async function loadBuildApp(workerStatus: 'running' | 'degraded') {
    const mockPrisma = {
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const mockGetGDIRefreshWorkerStatus = jest.fn().mockReturnValue(workerStatus);

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn(() => mockPrisma),
      Prisma: {
        TransactionIsolationLevel: {
          Serializable: 'Serializable',
        },
      },
    }));
    jest.doMock('./worker/gdi-refresh', () => ({
      getGDIRefreshWorkerStatus: mockGetGDIRefreshWorkerStatus,
    }));

    let buildApp!: typeof import('./app').buildApp;
    await jest.isolateModulesAsync(async () => {
      ({ buildApp } = await import('./app'));
    });

    return {
      app: await buildApp(),
      mockPrisma,
      mockGetGDIRefreshWorkerStatus,
    };
  }

  it('reports degraded health when the GDI refresh worker is degraded', async () => {
    const { app, mockPrisma, mockGetGDIRefreshWorkerStatus } = await loadBuildApp('degraded');

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetGDIRefreshWorkerStatus).toHaveBeenCalledTimes(1);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'degraded',
      services: {
        gdi_refresh_worker: 'degraded',
      },
    });

    await app.close();
    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('reports ok health when the GDI refresh worker is running', async () => {
    const { app } = await loadBuildApp('running');

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'ok',
      services: {
        gdi_refresh_worker: 'running',
      },
    });

    await app.close();
  });

  it('exposes version metadata at the root version endpoint', async () => {
    const { app } = await loadBuildApp('running');

    const response = await app.inject({
      method: 'GET',
      url: '/version',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      success: true,
      data: {
        service: 'evomap-hub',
        version: '0.1.0',
        api_version: '1.0.0',
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
      },
    });

    await app.close();
  });
});
