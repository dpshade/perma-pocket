/**
 * Wallet connector services
 * Provides unified interface for connecting to different Arweave wallets
 */

export { WanderWalletConnector, WANDER_WALLET_PERMISSIONS, WalletNotInstalledError, WanderError } from './WanderWalletConnector';
export { ArweaveAppWalletConnector, ArweaveAppError } from './ArweaveAppWalletConnector';
export { BeaconWalletConnector, BEACON_WALLET_PERMISSIONS, BeaconError } from './BeaconWalletConnector';
