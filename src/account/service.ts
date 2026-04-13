import type { PrismaClient } from '@prisma/client';
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
import { createUnconfiguredPrismaClient } from '../shared/prisma';

let prisma = createUnconfiguredPrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
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

function cloneOnboardingStep(step: OnboardingStep): OnboardingStep {
  return { ...step };
}

export function getOnboardingSteps(): OnboardingStep[] {
  return ONBOARDING_STEPS.map(cloneOnboardingStep);
}

export function getOnboardingStepDetail(step: number): OnboardingStep {
  const onboardingStep = ONBOARDING_STEPS.find((item) => item.step === step);
  if (!onboardingStep) {
    throw new NotFoundError('Onboarding step', String(step));
  }

  return cloneOnboardingStep(onboardingStep);
}

function getValidCompletedOnboardingSteps(completedSteps: number[]): number[] {
  const completedStepSet = new Set(completedSteps);
  return ONBOARDING_STEPS
    .map((step) => step.step)
    .filter((step) => completedStepSet.has(step));
}

function buildOnboardingJourney(state: OnboardingState) {
  const validCompletedSteps = getValidCompletedOnboardingSteps(state.completed_steps as number[]);
  const completedStepSet = new Set(validCompletedSteps);
  const nextStep = ONBOARDING_STEPS.find((step) => !completedStepSet.has(step.step)) ?? null;

  return {
    agent_id: state.agent_id,
    current_step: nextStep?.step ?? ONBOARDING_STEPS.length,
    total_steps: ONBOARDING_STEPS.length,
    progress_percentage: Math.round((validCompletedSteps.length / ONBOARDING_STEPS.length) * 100),
    completed_steps: validCompletedSteps,
    steps: ONBOARDING_STEPS.map((step) => ({
      step: step.step,
      title: step.title,
      completed: completedStepSet.has(step.step),
    })),
    next_step: nextStep
      ? {
        step: nextStep.step,
        title: nextStep.title,
        action_url: nextStep.action_url,
      }
      : null,
  };
}

export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[],
  expiresAt?: string,
  authType?: string,
  prismaClient?: PrismaClient,
): Promise<ApiKeyResponse> {
  const client = getPrismaClient(prismaClient);
  if (authType === 'api_key') {
    throw new KeyInceptionError();
  }

  if (!name || name.trim().length === 0) {
    throw new ValidationError('API key name is required');
  }

  if (!scopes || scopes.length === 0) {
    throw new ValidationError('At least one scope is required');
  }

  const existingCount = await client.apiKey.count({
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

  const apiKey = await client.apiKey.create({
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
  prismaClient?: PrismaClient,
): Promise<ApiKeyListItem[]> {
  const client = getPrismaClient(prismaClient);
  const keys = await client.apiKey.findMany({
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
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);
  const key = await client.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!key) {
    throw new NotFoundError('API key', keyId);
  }

  if (key.user_id !== userId) {
    throw new ForbiddenError('Cannot revoke another user\'s API key');
  }

  await client.apiKey.delete({
    where: { id: keyId },
  });
}

export async function createSession(
  userId: string,
  prismaClient?: PrismaClient,
): Promise<{ token: string; expires_at: string }> {
  const client = getPrismaClient(prismaClient);
  const token = generateHex(SESSION_TOKEN_LENGTH);
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await client.userSession.create({
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
  prismaClient?: PrismaClient,
): Promise<{ token: string; user: UserInfo }> {
  const client = getPrismaClient(prismaClient);
  if (!email || !email.includes('@')) {
    throw new ValidationError('Valid email is required');
  }
  if (!password || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  const existing = await client.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const password_hash = await bcrypt.hash(password, 12);
  const user = await client.user.create({
    data: { email, password_hash },
    select: { id: true, email: true },
  });

  const session = await createSession(user.id, client);
  return { token: session.token, user };
}

export async function loginUser(
  email: string,
  password: string,
  prismaClient?: PrismaClient,
): Promise<{ token: string; user: UserInfo }> {
  const client = getPrismaClient(prismaClient);
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  const user = await client.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const session = await createSession(user.id, client);
  return { token: session.token, user };
}

export async function getOnboardingState(
  agentId: string,
  prismaClient?: PrismaClient,
): Promise<OnboardingState> {
  const client = getPrismaClient(prismaClient);
  const state = await client.onboardingState.findUnique({
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

  const newState = await client.onboardingState.create({
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

export async function getOnboardingJourney(
  agentId: string,
  prismaClient?: PrismaClient,
): Promise<ReturnType<typeof buildOnboardingJourney>> {
  const state = await getOnboardingState(agentId, prismaClient);
  return buildOnboardingJourney(state);
}

export async function completeOnboardingStep(
  agentId: string,
  step: number,
  prismaClient?: PrismaClient,
): Promise<OnboardingState> {
  getOnboardingStepDetail(step);

  const client = getPrismaClient(prismaClient);
  const state = await client.onboardingState.findUnique({
    where: { agent_id: agentId },
  });

  if (!state) {
    throw new NotFoundError('Onboarding state for agent', agentId);
  }

  const completedSteps = [
    ...new Set([...(state.completed_steps as number[]), step]),
  ].sort((left, right) => left - right);

  const currentStep = Math.min(step + 1, ONBOARDING_STEPS.length);

  const updated = await client.onboardingState.update({
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
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);
  await client.userSession.deleteMany({
    where: { token },
  });
}

export async function resetOnboarding(
  agentId: string,
  prismaClient?: PrismaClient,
): Promise<OnboardingState> {
  const client = getPrismaClient(prismaClient);
  const updated = await client.onboardingState.upsert({
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

export async function getUserNodes(
  userId: string,
  prismaClient?: PrismaClient,
): Promise<Array<{
  node_id: string;
  model: string;
  status: string;
  reputation: number;
  credit_balance: number;
  registered_at: string;
}>> {
  const client = getPrismaClient(prismaClient);
  const nodes = await client.node.findMany({
    where: { user_id: userId },
    select: {
      node_id: true,
      model: true,
      status: true,
      reputation: true,
      credit_balance: true,
      registered_at: true,
    },
    orderBy: { registered_at: 'desc' },
  });

  return nodes.map((n) => ({
    node_id: n.node_id,
    model: n.model,
    status: n.status,
    reputation: n.reputation,
    credit_balance: n.credit_balance,
    registered_at: n.registered_at.toISOString(),
  }));
}
