import type { WalletAssociationConfig } from '@solana-mobile/mobile-wallet-adapter-protocol';

export interface SolanaMobileWalletAdapterModule {
  startSession(config?: WalletAssociationConfig ): Promise<void>;
  invoke(options: { method: string, params: any }): Promise<void>;
  endSession(): Promise<void>;
}
