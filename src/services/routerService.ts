import { ChainId, CurrencyAmount, Percent, Token, TradeType, NativeCurrency } from '@uniswap/sdk-core';
import { AlphaRouter, SwapRoute, SwapType, nativeOnChain } from '@uniswap/smart-order-router';
import { ethers } from 'ethers';

import config from '../config/config';
import logger from '../utils/logger';
import TokenUtils from '../utils/tokenUtils';

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
      logger.info('Fetching token information', { chainId, tokenInAddress, tokenOutAddress });
      const [tokenIn, tokenOut] = await Promise.all([
        this.getTokenInfo(chainId, tokenInAddress),
        this.getTokenInfo(chainId, tokenOutAddress)
      ]);
      
      logger.info('Token information fetched successfully', { 
        tokenIn: { 
          address: 'address' in tokenIn ? tokenIn.address : 'Native', 
          symbol: tokenIn.symbol, 
          decimals: tokenIn.decimals 
        }, 
        tokenOut: { 
          address: 'address' in tokenOut ? tokenOut.address : 'Native', 
          symbol: tokenOut.symbol, 
          decimals: tokenOut.decimals 
        } 
      });

      // Parse the amount as a string representing the raw amount
      const tokenDecimals = type === 'exactIn' ? tokenIn.decimals : tokenOut.decimals;
      const amountWei = ethers.utils.parseUnits(amount, tokenDecimals);
      const rawAmountStr = amountWei.toString();
      
      logger.info('Amount parsed', { 
        rawAmount: rawAmountStr, 
        decimals: tokenDecimals 
      });
      
      // Create currency amount using the string raw amount
      const currencyAmount = type === 'exactIn'
        ? CurrencyAmount.fromRawAmount(tokenIn, rawAmountStr)
        : CurrencyAmount.fromRawAmount(tokenOut, rawAmountStr);
      
      // Get trade type based on the 'type' param
      const tradeType = type === 'exactIn' ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT;
      
      // Get the current block
      const currentBlock = await provider.getBlockNumber();
      logger.info('Current block', { chainId, blockNumber: currentBlock });
      
      // Convert slippage to Percent
      const slippagePercent = new Percent(
        Math.floor(slippageTolerance * 100),
        10000 // 100.00%
      );
      
      logger.info('Preparing to call router.route', {
        chainId,
        currencyAmount: currencyAmount.toExact(),
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        tradeType: tradeType === TradeType.EXACT_INPUT ? 'EXACT_INPUT' : 'EXACT_OUTPUT',
        slippageTolerance: slippageTolerance
      });
      
      try {
        // Get the route
        logger.info('Calling router.route with options', {
          recipient: recipient || ethers.constants.AddressZero,
          slippageTolerance: slippagePercent.toFixed(2),
          deadline: deadline || Math.floor(Date.now() / 1000) + 1800,
          type: 'SWAP_ROUTER_02',
          blockNumber: currentBlock
        });
        
        let route;
        try {
          route = await router.route(
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
        } catch (routeErr: any) {
          logger.error('Router.route threw an error', { 
            error: routeErr.toString(),
            stack: routeErr.stack,
            chainId,
            tokenIn: tokenIn.symbol, 
            tokenOut: tokenOut.symbol 
          });
          
          // 区分不同的错误情况
          if (chainId !== ChainId.MAINNET && 
              chainId !== ChainId.OPTIMISM && 
              chainId !== ChainId.ARBITRUM_ONE && 
              chainId !== ChainId.POLYGON && 
              chainId !== ChainId.BASE) {
            throw new Error(`Unable to find route. Chain ${chainId} may not be supported by Uniswap. Consider using a chain-specific DEX instead.`);
          }
          
          throw new Error(`Error finding route: ${routeErr.message || 'Unknown error'}`);
        }
        
        logger.info('Route found', { 
          success: !!route,
          quote: route?.quote?.toExact()
        });
        
        if (!route) {
          // 对于已知Uniswap应该支持的链，提供标准错误
          if (chainId === ChainId.MAINNET || 
              chainId === ChainId.OPTIMISM || 
              chainId === ChainId.ARBITRUM_ONE || 
              chainId === ChainId.POLYGON || 
              chainId === ChainId.BASE) {
            throw new Error('No route found. There may not be enough liquidity for this trade.');
          } else {
            // 对于其他链，提供更具体的错误
            throw new Error(`No route found. Chain ${chainId} may not be fully supported by Uniswap. Consider using a chain-specific DEX instead.`);
          }
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
          tokenIn: 'address' in tokenIn ? tokenIn.address : 'Native', 
          tokenOut: 'address' in tokenOut ? tokenOut.address : 'Native',
          quoteAmount
        });
        
        return result;
      } catch (routeError) {
        logger.error('Error finding route', { 
          error: routeError, 
          chainId, 
          tokenIn: tokenIn.symbol, 
          tokenOut: tokenOut.symbol 
        });
        throw routeError;
      }
    } catch (error) {
      logger.error('Error getting quote', { error, chainId, tokenInAddress, tokenOutAddress });
      console.log(error);
      throw error;
    }
  }
  
  private async getTokenInfo(chainId: number, tokenAddress: string): Promise<Token | NativeCurrency> {
    try {
      // 检查是否为原生代币(ETH, BNB等)
      const normalizedTokenAddress = tokenAddress.toLowerCase();
      const nativeTokenSymbols = ['eth', 'bnb', 'matic', 'avax', 'celo', 'native'];
      
      const isNativeBySymbol = nativeTokenSymbols.includes(normalizedTokenAddress);
      const isNativeByAddress = 
        normalizedTokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
        normalizedTokenAddress === '0x0000000000000000000000000000000000000000';
      
      if (isNativeBySymbol || isNativeByAddress) {
        // 获取链的配置
        const chainConfig = config.chains[chainId];
        if (!chainConfig) {
          logger.warn(`No chain config found for chainId: ${chainId}, defaulting to ETH`);
          // 使用 nativeOnChain 获取原生代币
          return nativeOnChain(chainId as ChainId);
        }
        
        // 记录日志，使用 nativeOnChain 函数处理原生代币
        logger.info('Detected native token request, using nativeOnChain', {
          chainId,
          tokenAddress,
          nativeCurrency: {
            symbol: chainConfig.nativeCurrency.symbol,
            name: chainConfig.nativeCurrency.name,
            decimals: chainConfig.nativeCurrency.decimals
          }
        });
        
        // 使用 nativeOnChain 获取原生代币
        return nativeOnChain(chainId as ChainId);
      }
      
      // 从TokenUtils中检查是否是已知代币
      const tokenInfo = TokenUtils.getToken(chainId, normalizedTokenAddress);
      if (tokenInfo) {
        logger.info('Using token info from TokenUtils', { 
          chainId, 
          tokenAddress, 
          symbol: tokenInfo.symbol 
        });
        
        return new Token(
          chainId as ChainId,
          tokenAddress,
          tokenInfo.decimals,
          tokenInfo.symbol,
          tokenInfo.name
        );
      }
      
      // 对于其他代币，从合约获取详情
      try {
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
        
        // 缓存这个代币的信息用于后续使用
        TokenUtils.addToken(chainId, normalizedTokenAddress, {
          name,
          symbol,
          decimals
        });
        
        return new Token(
          chainId as ChainId,
          tokenAddress,
          decimals,
          symbol,
          name
        );
      } catch (contractError) {
        logger.warn('Error fetching token info from contract', { 
          error: contractError, 
          chainId, 
          tokenAddress 
        });
        
        // 尝试智能推测代币信息
        // Arbitrum USDT
        if (normalizedTokenAddress === '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9' && chainId === 42161) {
          logger.info('Using fallback for USDT on Arbitrum', { chainId, tokenAddress });
          return new Token(
            chainId as ChainId,
            tokenAddress,
            6,
            'USDT',
            'Tether USD'
          );
        }
        
        // 根据地址后缀尝试识别常见稳定币
        if (normalizedTokenAddress.includes('usdt') || normalizedTokenAddress.includes('tether')) {
          logger.info('Detected potential USDT token by address', { chainId, tokenAddress });
          return new Token(
            chainId as ChainId,
            tokenAddress,
            6, // 大多数USDT是6位小数
            'USDT',
            'Tether USD'
          );
        }
        
        if (normalizedTokenAddress.includes('usdc') || normalizedTokenAddress.includes('usd-coin')) {
          logger.info('Detected potential USDC token by address', { chainId, tokenAddress });
          return new Token(
            chainId as ChainId,
            tokenAddress,
            6, // USDC通常是6位小数
            'USDC',
            'USD Coin'
          );
        }
        
        if (normalizedTokenAddress.includes('dai')) {
          logger.info('Detected potential DAI token by address', { chainId, tokenAddress });
          return new Token(
            chainId as ChainId,
            tokenAddress,
            18, // DAI是18位小数
            'DAI',
            'Dai Stablecoin'
          );
        }
        
        // 最后尝试常见的ERC20代币默认配置
        try {
          // 尝试重新连接，可能是临时网络问题
          logger.info('Retrying token query with fallback config', { chainId, tokenAddress });
          
          // 设置一个较短的超时
          const fallbackProvider = new ethers.providers.JsonRpcProvider(
            config.chains[chainId].rpcUrl,
            { name: chainId.toString(), chainId: chainId }
          );
          
          // 手动添加请求超时设置
          fallbackProvider.connection.timeout = 3000; // 3秒超时
          
          const fallbackContract = new ethers.Contract(
            tokenAddress,
            [
              // 简化的ABI，只获取最基础的信息
              'function decimals() view returns (uint8)'
            ],
            fallbackProvider
          );
          
          // 至少尝试获取小数位数
          const tokenDecimals = await fallbackContract.decimals();
          
          // 使用地址最后4位作为标识
          const shortAddr = tokenAddress.substring(tokenAddress.length - 4);
          const fallbackSymbol = `TKN-${shortAddr}`;
          
          // 缓存获取到的信息
          const tokenInfo = {
            name: `Token ${shortAddr}`,
            symbol: fallbackSymbol,
            decimals: tokenDecimals
          };
          
          TokenUtils.addToken(chainId, normalizedTokenAddress, tokenInfo);
          
          logger.info('Created fallback token with minimal info', { 
            chainId, 
            tokenAddress, 
            decimals: tokenDecimals,
            symbol: fallbackSymbol
          });
          
          return new Token(
            chainId as ChainId,
            tokenAddress,
            tokenDecimals,
            fallbackSymbol,
            `Token ${shortAddr}`
          );
        } catch (fallbackError) {
          // 如果仍然失败，只能假设这是一个标准ERC20代币
          logger.warn('Fallback retrieval failed, using defaults', { chainId, tokenAddress });
          
          const tokenInfo = {
            name: `Unknown Token ${tokenAddress.substring(2, 10)}`,
            symbol: `TKN-${tokenAddress.substring(2, 6)}`,
            decimals: 18 // 大多数ERC20代币使用18位小数
          };
          
          TokenUtils.addToken(chainId, normalizedTokenAddress, tokenInfo);
          
          return new Token(
            chainId as ChainId,
            tokenAddress,
            18, // 大多数ERC20代币使用18位小数
            `TKN-${tokenAddress.substring(2, 6)}`,
            `Unknown Token ${tokenAddress.substring(2, 10)}`
          );
        }
      }
    } catch (error) {
      logger.error('Error fetching token info', { error, chainId, tokenAddress });
      throw new Error(`Failed to fetch token info for ${tokenAddress} on chain ${chainId}`);
    }
  }
} 