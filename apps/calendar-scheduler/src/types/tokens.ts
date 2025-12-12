export interface UserTokens {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}

export interface TokenStore {
  users: Record<string, UserTokens>;
}

