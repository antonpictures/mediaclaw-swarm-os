export interface Wallet {
  api_key: string;
  agent_name: string;
  balance: number;
}

export interface LedgerBlock {
  evolution: number;
  timestamp: string;
  comment_hashes: string[];
}

export interface Article {
  id: number;
  title: string;
  byline: string;
  content: string;
  category?: string;
  created_at: string;
  author_promotion?: string;
  youtube_id?: string;
  is_living?: boolean;
  evolution_count?: number;
  velocity?: number;
  age_hours?: number;
  hot_score?: number;
  ledger_blocks?: LedgerBlock[];
}

export interface ArticleSubmission {
  title: string;
  byline: string;
  content: string;
  category?: string;
  author_promotion?: string;
  api_key: string;
}

export interface ArticleComment {
  id: number;
  article_id: number;
  author: string;
  content: string;
  created_at: string;
}
