/**
 * 共通の型定義
 */
export interface AuthParams {
  cookie: string;  // cosenseSidに統一
  projectName: string;
}

export interface PaginationParams {
  skip?: number;
  limit?: number;
}
