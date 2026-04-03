export type {
  SearchableAsset,
  SearchQuery,
  SearchResult,
  AutocompleteResult,
} from '../shared/types';

export interface WeightedMatch {
  asset_id: string;
  score: number;
}
