import { ChainId, CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core';
import { AlphaRouter, SwapRoute, SwapType } from '@uniswap/smart-order-router';
import { ethers } from 'ethers';

import config from '../config/config';
import logger from '../utils/logger';

export interface QuoteParams {
  chainId: number;
  tokenInAddress: string;
  tokenOutAddress: string;
  amount: string;
  type: 'exactIn' | 'exactOut';
  slippageTolerance?: number;
  recipient?: string;
  deadline?: number;
}

export interface QuoteResult {
  chainId: number;
  route: SwapRoute;
  quoteAmount: string;
  quoteAmountInWei: string;
  gasPriceWei: string;
  gasUseEstimate: string;
  simulationStatus: string | null;
  methodParameters?: {
    calldata: string;
    value: string;
    to: string;
  };
}

export class RouterService {
  private providers: Record<number, ethers.providers.JsonRpcProvider>;
  private routers: Record<number, AlphaRouter>;
  
  constructor() {
    this.providers = {};
    this.routers = {};
    
    // Initialize providers and routers for each chain
    Object.values(config.chains).forEach(chain => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
        this.providers[chain.chainId] = provider;
        
        this.routers[chain.chainId] = new AlphaRouter({
          chainId: chain.chainId,
          provider,
        });
        
        logger.info(`Initialized provider and router for ${chain.name}`);
      } catch (error) {
        logger.error(`Failed to initialize provider for ${chain.name}`, { error });
      }
    });
  }
  
  public async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const { 
      chainId, 
      tokenInAddress, 
      tokenOutAddress, 
      amount, 
      type, 
      slippageTolerance = config.defaultSlippageTolerance,
      recipient,
      deadline
    } = params;
    
    logger.info('Getting quote', { chainId, tokenInAddress, tokenOutAddress, amount, type });
    
    // Check if chain is supported
    if (!this.routers[chainId]) {
      throw new Error(`Chain ID ${chainId} is not supported`);
    }
    
    // Get provider and router for requested chain
    const provider = this.providers[chainId];
    const router = this.routers[chainId];
    
    try {
      // Fetch token information
      const [tokenIn, tokenOut] = await Promise.all([
        this.getTokenInfo(chainId, tokenInAddress),
        this.getTokenInfo(chainId, tokenOutAddress)
      ]);

      // Parse the amount as a string representing the raw amount
      const tokenDecimals = type === 'exactIn' ? tokenIn.decimals : tokenOut.decimals;
      const amountWei = ethers.utils.parseUnits(amount, tokenDecimals);
      const rawAmountStr = amountWei.toString();
      
      // Create currency amount using the string raw amount
      const currencyAmount = type === 'exactIn'
        ? CurrencyAmount.fromRawAmount(tokenIn, rawAmountStr)
        : CurrencyAmount.fromRawAmount(tokenOut, rawAmountStr);
      
      // Get trade type based on the 'type' param
      const tradeType = type === 'exactIn' ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT;
      
      // Get the current block
      const currentBlock = await provider.getBlockNumber();
      
      // Convert slippage to Percent
      const slippagePercent = new Percent(
        Math.floor(slippageTolerance * 100),
        10000 // 100.00%
      );
      
      // Get the route
      const route = await router.route(
        currencyAmount,
        tradeType === TradeType.EXACT_INPUT ? tokenOut : tokenIn,
        tradeType,
        {
          recipient: recipient || ethers.constants.AddressZero,
          slippageTolerance: slippagePercent,
          deadline: deadline || Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
          type: SwapType.SWAP_ROUTER_02,
        },
        { blockNumber: currentBlock }
      );
      
      if (!route) {
        throw new Error('No route found');
      }
      
      // Prepare the result
      const quoteAmount = type === 'exactIn'
        ? ethers.utils.formatUnits(route.quote.quotient.toString(), tokenOut.decimals)
        : ethers.utils.formatUnits(route.quote.quotient.toString(), tokenIn.decimals);
      
      // Handle SimulationStatus safely
      let simulationStatus: string | null = null;
      if (route.simulationStatus !== undefined) {
        simulationStatus = typeof route.simulationStatus === 'string' 
          ? route.simulationStatus 
          : String(route.simulationStatus);
      }
      
      const result: QuoteResult = {
        chainId,
        route,
        quoteAmount,
        quoteAmountInWei: route.quote.quotient.toString(),
        gasPriceWei: route.gasPriceWei.toString(),
        gasUseEstimate: route.estimatedGasUsed.toString(),
        simulationStatus,
        methodParameters: route.methodParameters,
      };
      
      logger.info('Quote generated successfully', { 
        chainId, 
        tokenIn: tokenIn.address, 
        tokenOut: tokenOut.address,
        quoteAmount
      });
      
      return result;
    } catch (error) {
      logger.error('Error getting quote', { error, chainId, tokenInAddress, tokenOutAddress });
      throw error;
    }
  }
  
  private async getTokenInfo(chainId: number, tokenAddress: string): Promise<Token> {
    try {
      // Check if it's a native token (e.g., ETH)
      if (tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return new Token(
          chainId as ChainId,
          '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          18,
          'ETH',
          'Ether'
        );
      }
      
      // For other tokens, fetch details from the contract
      const provider = this.providers[chainId];
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)'
        ],
        provider
      );
      
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);
      
      return new Token(
        chainId as ChainId,
        tokenAddress,
        decimals,
        symbol,
        name
      );
    } catch (error) {
      logger.error('Error fetching token info', { error, chainId, tokenAddress });
      throw new Error(`Failed to fetch token info for ${tokenAddress} on chain ${chainId}`);
    }
  }
} 