import * as service from './service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  oauthAccount: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
} as any;

describe('OAuth Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as any);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setPrisma', () => {
    it('should accept a PrismaClient instance', () => {
      expect(() => service.setPrisma(mockPrisma as any)).not.toThrow();
    });
  });
});
