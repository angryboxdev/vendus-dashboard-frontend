export interface RevokeTokenPort {
  execute(tokenId: string): Promise<void>;
}
