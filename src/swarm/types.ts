import type {
  SwarmStatus,
  SubtaskStatus,
  SwarmTask,
  Subtask,
  SwarmResult,
} from '../shared/types';

export { SwarmStatus, SubtaskStatus, SwarmTask, Subtask, SwarmResult };

export interface CreateSwarmInput {
  title: string;
  description: string;
  cost: number;
}

export interface DecomposeInput {
  swarmId: string;
  subtasks: Array<{
    title: string;
    description: string;
  }>;
}

export interface AssignSubtaskInput {
  swarmId: string;
  subtaskId: string;
  workerId: string;
}

export interface SubmitSubtaskInput {
  swarmId: string;
  subtaskId: string;
  result: string;
}

export interface ListSwarmsInput {
  status?: SwarmStatus;
  limit?: number;
  offset?: number;
}
