import type {
  Worker,
} from '../shared/types';

export { Worker };

export interface RegisterWorkerInput {
  nodeId: string;
  specialties: string[];
  maxConcurrent: number;
}

export interface FindWorkersInput {
  skills: string[];
  count: number;
}

export interface WorkerTaskInput {
  workerId: string;
  taskId: string;
}

export interface CompleteTaskInput {
  workerId: string;
  taskId: string;
  success: boolean;
}

export interface ListWorkersInput {
  skill?: string;
  available?: boolean;
  limit?: number;
  offset?: number;
}
