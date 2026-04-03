export type {
  Guild,
  GuildMember,
} from '../shared/types';

export interface NoveltyScore {
  node_id: string;
  score: number;
  unique_signals: number;
  total_signals: number;
  rare_signal_count: number;
}
