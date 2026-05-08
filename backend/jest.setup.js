// Jest test environment setup
// Set DATABASE_URL for test runs so Prisma can connect to the dev DB
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-jest';
