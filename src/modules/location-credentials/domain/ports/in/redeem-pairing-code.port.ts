export interface RedeemPairingCodePort {
  execute(code: string): Promise<void>;
}
