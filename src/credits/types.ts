import type {
  CreditBalance,
  CreditTransaction,
  CreditTransactionType,
} from '../shared/types';

export { CreditBalance, CreditTransaction, CreditTransactionType };

export interface TransferPayload {
  from_id: string;
  to_id: string;
  amount: number;
  description?: string;
}
