import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type {
  ApiKeyResponse,
  ApiKeyListItem,
  OnboardingState,
  OnboardingStep,
  UserInfo,
} from '../shared/types';
import {
  MAX_API_KEYS_PER_USER,
  API_KEY_PREFIX,
  API_KEY_HEX_LENGTH,
  API_KEY_DISPLAY_PREFIX,
  SESSION_TOKEN_LENGTH,
  SESSION_EXPIRY_DAYS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  KeyInceptionError,
  UnauthorizedError,
  ConflictError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function generateHex(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 1,
    title: 'Register Your Node',
    description: 'Send a HELLO message to the EvoMap Hub to register your node.',
    action_label: 'Register Node',
    action_url: '/a2a/hello',
    action_method: 'POST',
    code_example: 'const response = await fetch("https://api.evomap.ai/a2a/hello", { method: "POST", body: JSON.stringify(payload) });',
    estimated_time: '2 minutes',
  },
  {
    step: 2,
    title: 'Start Heartbeat',
    description: 'Begin sending periodic heartbeat messages to maintain your node status.',
    action_label: 'Configure Heartbeat',
    action_url: '/a2a/heartbeat',
    action_method: 'POST',
    code_example: 'setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL_MS);',
    estimated_time: '5 minutes',
  },
  {
    step: 3,
    title: 'Publish Your First Gene',
    description: 'Create and publish your first gene to start contributing to the ecosystem.',
    action_label: 'Publish Gene',
    action_url: '/a2a/publish',
    action_method: 'POST',
    code_example: 'const gene = { name: "my-first-gene", description: "...", signals: ["optimize"] };',
    estimated_time: '10 minutes',
  },
  {
    step: 4,
    title: 'Explore the Marketplace',
    description: 'Browse the marketplace to discover genes and capsules from other nodes.',
    action_label: 'Browse Marketplace',
    action_url: '/api/v2/marketplace/listings',
    action_method: 'GET',
    code_example: 'const listings = await fetch("https://api.evomap.ai/api/v2/marketplace/listings");',
    estimated_time: '5 minutes',
  },
  {
    step: 5,
    title: 'Join a Guild',
    description: 'Find and join a guild to collaborate with other nodes.',
    action_label: 'Join Guild',
    action_url: '/api/v2/community/guilds',
    action_method: 'GET',
    code_example: 'const guilds = await fetch("https://api.evomap.ai/api/v2/community/guilds");',
    estimated_time: '5 minutes',
  },
];

export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[],
  expiresAt?: string,
  authType?: string,
): Promise<ApiKeyResponse> {
  if (authType === 'api_key') {
    throw new KeyInceptionError();
  }

  if (!name || name.trim().length === 0) {
    throw new ValidationError('API key name is required');
  }

  if (!scopes || scopes.length === 0) {
    throw new ValidationError('At least one scope is required');
  }

  const existingCount = await prisma.apiKey.count({
    where: { user_id: userId },
  });

  if (existingCount >= MAX_API_KEYS_PER_USER) {
    throw new ValidationError(
      `Maximum of ${MAX_API_KEYS_PER_USER} API keys per user`,
    );
  }

  const rawKey = `${API_KEY_PREFIX}${generateHex(API_KEY_HEX_LENGTH)}`;
  const keyHash = crypto
    .createHash('sha256')
    .update(rawKey)
    .digest('hex');
  const prefix = rawKey.slice(0, API_KEY_DISPLAY_PREFIX);

  const apiKey = await prisma.apiKey.create({
    data: {
      key_hash: keyHash,
      prefix,
      name,
      scopes,
      expires_at: expiresAt ? new Date(expiresAt) : null,
      user_id: userId,
    },
  });

  return {
    id: apiKey.id,
    key: rawKey,
    prefix: apiKey.prefix,
    name: apiKey.name,
    scopes: apiKey.scopes,
    expires_at: apiKey.expires_at?.toISOString(),
    created_at: apiKey.created_at.toISOString(),
  };
}

export async function listApiKeys(
  userId: string,
): Promise<ApiKeyListItem[]> {
  const keys = await prisma.apiKey.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });

  return keys.map((k: { id: string; prefix: string; name: string; scopes: string[]; expires_at: Date | null; created_at: Date }) => ({
    id: k.id,
    prefix: k.prefix,
    name: k.name,
    scopes: k.scopes,
    expires_at: k.expires_at?.toISOString(),
    created_at: k.created_at.toISOString(),
  }));
}

export async function revokeApiKey(
  userId: string,
  keyId: string,
): Promise<void> {
  const key = await prisma.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!key) {
    throw new NotFoundError('API key', keyId);
  }

  if (key.user_id !== userId) {
    throw new ForbiddenError('Cannot revoke another user\'s API key');
  }

  await prisma.apiKey.delete({
    where: { id: keyId },
  });
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expires_at: string }> {
  const token = generateHex(SESSION_TOKEN_LENGTH);
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.userSession.create({
    data: {
      token,
      user_id: userId,
      expires_at: expiresAt,
    },
  });

  return {
    token,
    expires_at: expiresAt.toISOString(),
  };
}

export async function registerUser(
  email: string,
  password: string,
): Promise<{ token: string; user: UserInfo }> {
  if (!email || !email.includes('@')) {
    throw new ValidationError('Valid email is required');
  }
  if (!password || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const password_hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password_hash },
    select: { id: true, email: true },
  });

  const session = await createSession(user.id);
  return { token: session.token, user };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ token: string; user: UserInfo }> {
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const session = await createSession(user.id);
  return { token: session.token, user };
}

export async function getOnboardingState(
  agentId: string,
): Promise<OnboardingState> {
  const state = await prisma.onboardingState.findUnique({
    where: { agent_id: agentId },
  });

  if (state) {
    return {
      agent_id: state.agent_id,
      started_at: state.started_at.toISOString(),
      completed_steps: state.completed_steps as number[],
      current_step: state.current_step,
    };
  }

  const newState = await prisma.onboardingState.create({
    data: {
      agent_id: agentId,
      completed_steps: [],
      current_step: 1,
    },
  });

  return {
    agent_id: newState.agent_id,
    started_at: newState.started_at.toISOString(),
    completed_steps: newState.completed_steps as number[],
    current_step: newState.current_step,
  };
}

export async function completeOnboardingStep(
  agentId: string,
  step: number,
): Promise<OnboardingState> {
  const state = await prisma.onboardingState.findUnique({
    where: { agent_id: agentId },
  });

  if (!state) {
    throw new NotFoundError('Onboarding state for agent', agentId);
  }

  const completedSteps = [
    ...new Set([...(state.completed_steps as number[]), step]),
  ].sort();

  const currentStep =
    step >= ONBOARDING_STEPS.length
      ? ONBOARDING_STEPS.length
      : step + 1;

  const updated = await prisma.onboardingState.update({
    where: { agent_id: agentId },
    data: {
      completed_steps: completedSteps,
      current_step: currentStep,
    },
  });

  return {
    agent_id: updated.agent_id,
    started_at: updated.started_at.toISOString(),
    completed_steps: updated.completed_steps as number[],
    current_step: updated.current_step,
  };
}

export async function deleteSessionByToken(
  token: string,
): Promise<void> {
  await prisma.userSession.deleteMany({
    where: { token },
  });
}

export async function resetOnboarding(
  agentId: string,
): Promise<OnboardingState> {
  const updated = await prisma.onboardingState.upsert({
    where: { agent_id: agentId },
    update: {
      completed_steps: [],
      current_step: 1,
    },
    create: {
      agent_id: agentId,
      completed_steps: [],
      current_step: 1,
    },
  });

  return {
    agent_id: updated.agent_id,
    started_at: updated.started_at.toISOString(),
    completed_steps: updated.completed_steps as number[],
    current_step: updated.current_step,
  };
}
