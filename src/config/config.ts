import dotenv from 'dotenv';
import { ChainId, NativeCurrencyName } from '@uniswap/sdk-core';

// Load environment variables
dotenv.config();

// 原生代币信息
export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
  address?: string; // 某些链上原生代币可能有包装版本的合约地址
  wrappedAddress?: string; // 包装版本的合约地址 (WETH, WBNB 等)
}

// Network RPC URLs
export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  nativeCurrency: NativeCurrency;
  blockExplorerUrl?: string;
}

export interface AppConfig {
  port: number;
  logLevel: string;
  defaultSlippageTolerance: number;
  cacheTtl: number;
  chains: Record<number, ChainConfig>;
}

// Validate that an environment variable exists
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
};

// Get an optional environment variable with a default value
const getEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

// Create the application configuration
const config: AppConfig = {
  port: parseInt(getEnv('PORT', '3000'), 10),
  logLevel: getEnv('LOG_LEVEL', 'info'),
  defaultSlippageTolerance: parseFloat(getEnv('DEFAULT_SLIPPAGE_TOLERANCE', '0.5')),
  cacheTtl: parseInt(getEnv('CACHE_TTL', '60'), 10),
  chains: {
    [ChainId.MAINNET]: {
      name: 'Ethereum Mainnet',
      chainId: ChainId.MAINNET,
      rpcUrl: getEnv('ETH_RPC_URL', 'https://mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH
      },
      blockExplorerUrl: 'https://etherscan.io'
    },
    [ChainId.OPTIMISM]: {
      name: 'Optimism',
      chainId: ChainId.OPTIMISM,
      rpcUrl: getEnv('OPTIMISM_RPC_URL', 'https://optimism-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0x4200000000000000000000000000000000000006' // WETH on Optimism
      },
      blockExplorerUrl: 'https://optimistic.etherscan.io'
    },
    [ChainId.ARBITRUM_ONE]: {
      name: 'Arbitrum',
      chainId: ChainId.ARBITRUM_ONE,
      rpcUrl: getEnv('ARBITRUM_RPC_URL', 'https://arbitrum-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH on Arbitrum
      },
      blockExplorerUrl: 'https://arbiscan.io'
    },
    [ChainId.POLYGON]: {
      name: 'Polygon',
      chainId: ChainId.POLYGON,
      rpcUrl: getEnv('POLYGON_RPC_URL', 'https://polygon-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
      nativeCurrency: {
        name: 'MATIC',
        symbol: NativeCurrencyName.MATIC,
        decimals: 18,
        wrappedAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WPOL
      },
      blockExplorerUrl: 'https://polygonscan.com'
    },
    [ChainId.BNB]: {
      name: 'BNB Chain',
      chainId: ChainId.BNB,
      rpcUrl: getEnv('BNB_RPC_URL', 'https://bsc-dataseed.binance.org'),
      nativeCurrency: {
        name: 'BNB',
        symbol: NativeCurrencyName.BNB,
        decimals: 18,
        wrappedAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' // WBNB
      },
      blockExplorerUrl: 'https://bscscan.com'
    },
    [ChainId.AVALANCHE]: {
      name: 'Avalanche',
      chainId: ChainId.AVALANCHE,
      rpcUrl: getEnv('AVALANCHE_RPC_URL', 'https://api.avax.network/ext/bc/C/rpc'),
      nativeCurrency: {
        name: 'AVAX',
        symbol: NativeCurrencyName.AVAX,
        decimals: 18,
        wrappedAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7' // WAVAX
      },
      blockExplorerUrl: 'https://snowtrace.io'
    },
    [ChainId.CELO]: {
      name: 'Celo',
      chainId: ChainId.CELO,
      rpcUrl: getEnv('CELO_RPC_URL', 'https://forno.celo.org'),
      nativeCurrency: {
        name: 'CELO',
        symbol: NativeCurrencyName.CELO,
        decimals: 18,
        wrappedAddress: '0x471EcE3750Da237f93B8E339c536989b8978a438' // CELO native token
      },
      blockExplorerUrl: 'https://explorer.celo.org'
    },
    [ChainId.BASE]: {
      name: 'Base',
      chainId: ChainId.BASE,
      rpcUrl: getEnv('BASE_RPC_URL', 'https://base-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0x4200000000000000000000000000000000000006' // WETH on Base
      },
      blockExplorerUrl: 'https://basescan.org'
    },
    [ChainId.ZORA]: {
      name: 'Zora',
      chainId: ChainId.ZORA,
      rpcUrl: getEnv('ZORA_RPC_URL', 'https://rpc.zora.energy'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0x4200000000000000000000000000000000000006' // WETH on Zora
      },
      blockExplorerUrl: 'https://explorer.zora.energy'
    },
    [ChainId.BLAST]: {
      name: 'Blast',
      chainId: ChainId.BLAST,
      rpcUrl: getEnv('BLAST_RPC_URL', 'https://blast.blockpi.network/v1/rpc/public'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0x4300000000000000000000000000000000000004' // WETH on Blast
      },
      blockExplorerUrl: 'https://blastscan.io'
    },
    [ChainId.ZKSYNC]: {
      name: 'zkSync Era',
      chainId: ChainId.ZKSYNC,
      rpcUrl: getEnv('ZKSYNC_RPC_URL', 'https://mainnet.era.zksync.io'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91' // WETH on zkSync
      },
      blockExplorerUrl: 'https://explorer.zksync.io'
    },
    [ChainId.WORLDCHAIN]: {
      name: 'Worldchain',
      chainId: ChainId.WORLDCHAIN,
      rpcUrl: getEnv('WORLDCHAIN_RPC_URL', 'https://rpc.worldchain.one'),
      nativeCurrency: {
        name: 'Ether',
        symbol: NativeCurrencyName.ETHER,
        decimals: 18,
        wrappedAddress: '0x4200000000000000000000000000000000000006' // WETH on Worldchain
      },
      blockExplorerUrl: 'https://explorer.worldchain.one'
    }
  },
};

export default config; 