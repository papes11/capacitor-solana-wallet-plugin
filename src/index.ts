import { registerPlugin } from '@capacitor/core';
import type { Transaction as LegacyTransaction, TransactionSignature } from '@solana/web3.js';
import { SIGNATURE_LENGTH_IN_BYTES, Transaction, VersionedMessage, VersionedTransaction } from '@solana/web3.js';
import type {
  AuthorizeAPI,
  Base64EncodedAddress,
  Base64EncodedTransaction,
  CloneAuthorizationAPI,
  DeauthorizeAPI,
  GetCapabilitiesAPI,
  MobileWallet,
  ReauthorizeAPI,
  WalletAssociationConfig,
} from '@solana-mobile/mobile-wallet-adapter-protocol';
import {
  SolanaMobileWalletAdapterProtocolError,
  SolanaMobileWalletAdapterError,
} from '@solana-mobile/mobile-wallet-adapter-protocol';
import bs58 from 'bs58';
import { fromUint8Array, toUint8Array } from 'js-base64';

import type { SolanaMobileWalletAdapterModule } from './definitions';

const SolanaMobileWalletAdapter = registerPlugin<SolanaMobileWalletAdapterModule>('SolanaMobileWalletAdapterModule', {
  web: () => import('./web').then(m => new m.SolanaMobileWalletAdapterWeb()),
});

interface Web3SignAndSendTransactionsAPI {
  signAndSendTransactions<T extends LegacyTransaction | VersionedTransaction>(params: {
    minContextSlot?: number;
    transactions: T[];
  }): Promise<TransactionSignature[]>;
}

interface Web3SignTransactionsAPI {
  signTransactions<T extends LegacyTransaction | VersionedTransaction>(params: { transactions: T[] }): Promise<T[]>;
}

interface Web3SignMessagesAPI {
  signMessages(params: { addresses: Base64EncodedAddress[]; payloads: Uint8Array[] }): Promise<Uint8Array[]>;
}

export interface Web3MobileWallet
    extends AuthorizeAPI,
        CloneAuthorizationAPI,
        DeauthorizeAPI,
        GetCapabilitiesAPI,
        ReauthorizeAPI,
        Web3SignAndSendTransactionsAPI,
        Web3SignTransactionsAPI,
        Web3SignMessagesAPI {}

function getPayloadFromTransaction(transaction: LegacyTransaction | VersionedTransaction): Base64EncodedTransaction {
  const serializedTransaction =
      'version' in transaction
          ? transaction.serialize()
          : transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          });
  return fromUint8Array(serializedTransaction);
}

function getTransactionFromWireMessage(byteArray: Uint8Array): Transaction | VersionedTransaction {
  const numSignatures = byteArray[0]
  const messageOffset = numSignatures * SIGNATURE_LENGTH_IN_BYTES + 1
  const version = VersionedMessage.deserializeMessageVersion(byteArray.slice(messageOffset, byteArray.length));
  if (version === 'legacy') {
    return Transaction.from(byteArray);
  } else {
    return VersionedTransaction.deserialize(byteArray);
  }
}

type CapacitorError = Error & { code?: string; userInfo?: Record<string, unknown> };

function getErrorMessage(e: CapacitorError): string {
  switch (e.code) {
    case 'ERROR_WALLET_NOT_FOUND':
      return 'Found no installed wallet that supports the mobile wallet protocol.';
    default:
      return e.message;
  }
}

function handleError(e: any): never {
  if (e instanceof Error) {
    const reactNativeError: CapacitorError = e;
    switch (reactNativeError.code) {
      case undefined:
        throw e;
      case 'JSON_RPC_ERROR': {
        const details = reactNativeError.userInfo as Readonly<{ jsonRpcErrorCode: number }>;
        throw new SolanaMobileWalletAdapterProtocolError(
            0 /* jsonRpcMessageId */,
            details.jsonRpcErrorCode,
            e.message,
        );
      }
      default:
        throw new SolanaMobileWalletAdapterError<any>(
            reactNativeError.code,
            getErrorMessage(reactNativeError),
            reactNativeError.userInfo,
        );
    }
  }
  throw e;
}

async function baseTransact<TReturn>(
    callback: (wallet: MobileWallet) => TReturn,
    config?: WalletAssociationConfig,
): Promise<TReturn> {
  let didSuccessfullyConnect = false;
  try {
    await SolanaMobileWalletAdapter.startSession(config);
    didSuccessfullyConnect = true;
    const wallet = new Proxy<MobileWallet>({} as MobileWallet, {
      get<TMethodName extends keyof MobileWallet>(target: MobileWallet, p: TMethodName) {
        if (target[p] == null) {
          const method = p
          .toString()
          .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
          .toLowerCase();
          target[p] = async function (params: Parameters<MobileWallet[TMethodName]>[0]) {
            try {
              return await SolanaMobileWalletAdapter.invoke({ method, params });
            } catch (e) {
              return handleError(e);
            }
          } as unknown as MobileWallet[TMethodName];
        }
        return target[p];
      },
      defineProperty() {
        return false;
      },
      deleteProperty() {
        return false;
      },
    });
    return await callback(wallet);
  } catch (e) {
    return handleError(e);
  } finally {
    if (didSuccessfullyConnect) {
      await SolanaMobileWalletAdapter.endSession();
    }
  }
}

export async function transact<TReturn>(
    callback: (wallet: Web3MobileWallet) => TReturn,
    config?: WalletAssociationConfig,
): Promise<TReturn> {
  const augmentedCallback: (wallet: MobileWallet) => TReturn = (wallet) => {
    const augmentedAPI = new Proxy<Web3MobileWallet>({} as Web3MobileWallet, {
      get<TMethodName extends keyof Web3MobileWallet>(target: Web3MobileWallet, p: TMethodName) {
        if (target[p] == null) {
          switch (p) {
            case 'signAndSendTransactions':
              target[p] = async function ({
                  minContextSlot,
                  transactions,
                  ...rest
                }: Parameters<Web3MobileWallet['signAndSendTransactions']>[0]) {
                const payloads = transactions.map(getPayloadFromTransaction);
                const { signatures: base64EncodedSignatures } = await wallet.signAndSendTransactions({
                  ...rest,
                  ...(minContextSlot != null
                      ? { options: { min_context_slot: minContextSlot } }
                      : null),
                  payloads,
                });
                const signatures = base64EncodedSignatures.map(toUint8Array).map(bs58.encode);
                return signatures as TransactionSignature[];
              } as Web3MobileWallet[TMethodName];
              break;
            case 'signMessages':
              target[p] = async function ({
                  payloads,
                  ...rest
                }: Parameters<Web3MobileWallet['signMessages']>[0]) {
                const base64EncodedPayloads:string[] = payloads.map(fromUint8Array as any);
                const { signed_payloads: base64EncodedSignedMessages } = await wallet.signMessages({
                  ...rest,
                  payloads: base64EncodedPayloads,
                });
                const signedMessages = base64EncodedSignedMessages.map(toUint8Array);
                return signedMessages;
              } as Web3MobileWallet[TMethodName];
              break;
            case 'signTransactions':
              target[p] = async function ({
                  transactions,
                  ...rest
                }: Parameters<Web3MobileWallet['signTransactions']>[0]) {
                const payloads = transactions.map(getPayloadFromTransaction);
                const { signed_payloads: base64EncodedCompiledTransactions } =
                    await wallet.signTransactions({
                      ...rest,
                      payloads,
                    });
                const compiledTransactions = base64EncodedCompiledTransactions.map(toUint8Array);
                const signedTransactions = compiledTransactions.map(getTransactionFromWireMessage);
                return signedTransactions;
              } as Web3MobileWallet[TMethodName];
              break;
            default: {
              target[p] = wallet[p] as unknown as Web3MobileWallet[TMethodName];
              break;
            }
          }
        }
        return target[p];
      },
      defineProperty() {
        return false;
      },
      deleteProperty() {
        return false;
      },
    });
    return callback(augmentedAPI);
  };
  return await baseTransact(augmentedCallback, config);
}
