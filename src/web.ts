import { WebPlugin } from '@capacitor/core';
import type { WalletAssociationConfig } from '@solana-mobile/mobile-wallet-adapter-protocol';

import type { SolanaMobileWalletAdapterModule } from './definitions';

export class SolanaMobileWalletAdapterWeb extends WebPlugin implements SolanaMobileWalletAdapterModule {
  async startSession(config?: WalletAssociationConfig): Promise<void> {
    console.log('[SolanaMobileWalletAdapterWeb] startSession config: ', config)
  }

  async invoke(options: { method: string, params: any }): Promise<void> {
    console.log('[SolanaMobileWalletAdapterWeb] invoke', options)
    // logic here
  }

  async endSession(): Promise<void> {
    console.log('[SolanaMobileWalletAdapterWeb] endSession')
    // logic here
  }
}
