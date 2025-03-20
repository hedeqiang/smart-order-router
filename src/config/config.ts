import dotenv from 'dotenv';
import { ChainId } from '@uniswap/sdk-core';

// Load environment variables
dotenv.config();

// Network RPC URLs
export interface ChainConfig {
  name: string;
  chainId: ChainId;
  rpcUrl: string;
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
    },
    [ChainId.OPTIMISM]: {
      name: 'Optimism',
      chainId: ChainId.OPTIMISM,
      rpcUrl: getEnv('OPTIMISM_RPC_URL', 'https://optimism-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
    },
    [ChainId.ARBITRUM_ONE]: {
      name: 'Arbitrum',
      chainId: ChainId.ARBITRUM_ONE,
      rpcUrl: getEnv('ARBITRUM_RPC_URL', 'https://arbitrum-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
    },
    [ChainId.POLYGON]: {
      name: 'Polygon',
      chainId: ChainId.POLYGON,
      rpcUrl: getEnv('POLYGON_RPC_URL', 'https://polygon-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
    },
    [ChainId.BNB]: {
      name: 'BNB Chain',
      chainId: ChainId.BNB,
      rpcUrl: getEnv('BNB_RPC_URL', 'https://bsc-dataseed.binance.org'),
    },
    [ChainId.AVALANCHE]: {
      name: 'Avalanche',
      chainId: ChainId.AVALANCHE,
      rpcUrl: getEnv('AVALANCHE_RPC_URL', 'https://api.avax.network/ext/bc/C/rpc'),
    },
    [ChainId.CELO]: {
      name: 'Celo',
      chainId: ChainId.CELO,
      rpcUrl: getEnv('CELO_RPC_URL', 'https://forno.celo.org'),
    },
    [ChainId.BASE]: {
      name: 'Base',
      chainId: ChainId.BASE,
      rpcUrl: getEnv('BASE_RPC_URL', 'https://base-mainnet.infura.io/v3/YOUR_INFURA_API_KEY'),
    },
    // Add other chains as needed
  },
};

export default config; 