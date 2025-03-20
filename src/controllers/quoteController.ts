import { Request, Response } from 'express';
import { RouterService, QuoteParams } from '../services/routerService';
import logger from '../utils/logger';

export class QuoteController {
  private routerService: RouterService;
  private seen: WeakSet<object> | null = null;
  
  constructor() {
    this.routerService = new RouterService();
  }
  
  /**
   * Get a quote for a swap
   * @param req Express request
   * @param res Express response
   */
  public async getQuote(req: Request, res: Response): Promise<void> {
    try {
      const { 
        chainId, 
        tokenIn, 
        tokenOut, 
        amount, 
        type = 'exactIn',
        slippageTolerance,
        recipient,
        deadline
      } = req.query;
      
      // Validate required parameters
      if (!chainId || !tokenIn || !tokenOut || !amount) {
        res.status(400).json({ 
          error: 'Missing required parameters', 
          requiredParams: ['chainId', 'tokenIn', 'tokenOut', 'amount']
        });
        return;
      }
      
      // Prepare parameters for the router service
      const params: QuoteParams = {
        chainId: Number(chainId),
        tokenInAddress: tokenIn as string,
        tokenOutAddress: tokenOut as string,
        amount: amount as string,
        type: (type as string) === 'exactOut' ? 'exactOut' : 'exactIn',
      };
      
      // Add optional parameters if provided
      if (slippageTolerance) {
        params.slippageTolerance = Number(slippageTolerance);
      }
      
      if (recipient) {
        params.recipient = recipient as string;
      }
      
      if (deadline) {
        params.deadline = Number(deadline);
      }
      
      // Get the quote
      const quote = await this.routerService.getQuote(params);
      
      // Log the original route structure for debugging
      const routeKeys = Object.keys(quote.route || {});
      
      // Create a safe copy of route for logging
      const safeRouteCopy = this.createSafeRouteCopy(quote.route);
      
      logger.info('Original route response structure', {
        requestParams: params,
        routeKeys,
        routeDetails: safeRouteCopy
      });
      
      // Log all available quote information
      logger.info('Quote details', {
        chainId: quote.chainId,
        quoteAmount: quote.quoteAmount,
        gasPriceWei: quote.gasPriceWei,
        gasUseEstimate: quote.gasUseEstimate,
        simulationStatus: quote.simulationStatus,
        methodParametersTo: quote.methodParameters?.to,
      });
      
      // Try to extract token information directly from the request
      const inputToken = { symbol: 'Input', address: tokenIn as string };
      const outputToken = { symbol: 'Output', address: tokenOut as string };
      
      // Format the route with additional information
      const routeWithExtraInfo = this.formatRoute(quote.route, inputToken, outputToken);
      
      // Prepare the response
      const response = {
        chainId: quote.chainId,
        quoteId: this.generateQuoteId(),
        quoteAmount: quote.quoteAmount,
        gasEstimate: quote.gasUseEstimate,
        gasPrice: quote.gasPriceWei,
        simulationStatus: quote.simulationStatus,
        route: routeWithExtraInfo,
        methodParameters: quote.methodParameters,
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Error in quote controller', { error });
      res.status(500).json({
        error: error.message || 'An unexpected error occurred',
      });
    }
  }
  
  /**
   * Create a safe copy of the route object for logging
   */
  private createSafeRouteCopy(route: any): any {
    if (!route) return null;
    
    const visited = new Set();
    
    const makeSerializable = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj;
      }
      
      if (typeof obj !== 'object') {
        return obj;
      }
      
      // Handle circular references
      if (visited.has(obj)) {
        return '[Circular]';
      }
      
      visited.add(obj);
      
      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(item => makeSerializable(item));
      }
      
      // Handle special cases
      if (typeof obj.toExact === 'function') {
        return obj.toExact();
      }
      
      if (typeof obj.toString === 'function' && obj.toString() !== '[object Object]') {
        return obj.toString();
      }
      
      // Handle regular objects
      const result: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          try {
            // Skip functions
            if (typeof obj[key] === 'function') {
              continue;
            }
            
            // Extract useful properties from token objects
            if (key === 'currency' || key === 'token' || key === 'inputToken' || key === 'outputToken') {
              if (obj[key] && obj[key].address && obj[key].symbol) {
                result[key] = {
                  address: obj[key].address,
                  symbol: obj[key].symbol,
                  decimals: obj[key].decimals
                };
                continue;
              }
            }
            
            // Process other properties
            result[key] = makeSerializable(obj[key]);
          } catch (error) {
            result[key] = '[Error serializing property]';
          }
        }
      }
      
      return result;
    };
    
    return makeSerializable(route);
  }
  
  /**
   * Format the route data for the response to remove circular references and
   * include only the essential information
   */
  private formatRoute(route: any, inputToken?: any, outputToken?: any): any {
    if (!route) return null;
    
    try {
      // Check for trade object which contains the detailed route information
      if (route.trade && route.trade.swaps && route.trade.swaps.length > 0) {
        // Get the first swap (usually there's only one for simple quotes)
        const swap = route.trade.swaps[0];
        
        // Get token path from the swap route
        let tokenPath = [];
        if (swap.route && swap.route.tokenPath && Array.isArray(swap.route.tokenPath)) {
          tokenPath = swap.route.tokenPath.map((token: any) => ({
            symbol: token.symbol || 'Unknown',
            address: token.address || 'Unknown',
            decimals: token.decimals
          }));
        } else if (inputToken && outputToken) {
          tokenPath = [inputToken, outputToken];
        }
        
        // Get pool information
        let paths = [];
        if (swap.route && swap.route.pools && Array.isArray(swap.route.pools)) {
          paths = [{
            protocol: swap.route.protocol || 'V3',
            path: swap.route.pools.map((pool: any) => pool.token0.address + '-' + pool.token1.address),
            fee: swap.route.pools.map((pool: any) => 
              pool.fee ? `${(pool.fee / 10000).toFixed(2)}%` : 'Unknown'
            ).join(', '),
            pools: swap.route.pools.map((pool: any) => ({
              fee: pool.fee ? `${(pool.fee / 10000).toFixed(2)}%` : 'Unknown',
              liquidity: pool.liquidity?.toString() || 'Unknown',
              token0: {
                symbol: pool.token0?.symbol || 'Unknown',
                address: pool.token0?.address || 'Unknown'
              },
              token1: {
                symbol: pool.token1?.symbol || 'Unknown',
                address: pool.token1?.address || 'Unknown'
              }
            }))
          }];
        } else {
          // Fall back to other methods
          paths = this.extractRoutePaths(route);
        }
        
        // Create route string from tokenPath
        const routeString = tokenPath.length >= 2 
          ? tokenPath.map((token: { symbol: string }) => token.symbol).join(' → ') 
          : (route.route && Array.isArray(route.route) ? route.route.join(', ') : 'Route details unavailable');
        
        // Add extra information based on the methodParameters
        const extraRouteInfo = {};
        if (route.methodParameters?.to) {
          Object.assign(extraRouteInfo, {
            router: route.methodParameters.to,
            routerType: this.inferProtocolFromRouter(route.methodParameters.to)
          });
        }
        
        // Get exact amounts from the swap or fall back to other sources
        const amountIn = swap.inputAmount || route.amountIn?.toExact?.() || route.amount?.toExact?.() || 'Unknown';
        const amountOut = swap.outputAmount || route.amountOut?.toExact?.() || route.quote?.toExact?.() || route.quoteAmount || 'Unknown';
        
        // Build the final route info
        return {
          routeString,
          paths,
          tokenPath,
          amountIn,
          amountOut,
          ...extraRouteInfo,
          // Include additional useful information
          route: route.route,
          estimatedGasUsedQuoteToken: route.estimatedGasUsedQuoteToken,
          estimatedGasUsedUSD: route.estimatedGasUsedUSD,
          quoteGasAdjusted: route.quoteGasAdjusted
        };
      } else {
        // Fall back to existing methods if trade object is not available
        let tokenPath = this.extractTokenPath(route);
        
        if (!tokenPath.length && inputToken && outputToken) {
          tokenPath = [inputToken, outputToken];
        }
        
        const paths = this.extractRoutePaths(route);
        
        const extraRouteInfo = {};
        if (route.methodParameters?.to) {
          Object.assign(extraRouteInfo, {
            router: route.methodParameters.to,
            routerType: this.inferProtocolFromRouter(route.methodParameters.to)
          });
        }
        
        return {
          routeString: this.getReadableRouteString(route, tokenPath),
          paths,
          tokenPath,
          amountIn: route.amountIn?.toExact?.() || route.amount?.toExact?.() || 'Unknown',
          amountOut: route.amountOut?.toExact?.() || route.quote?.toExact?.() || route.quoteAmount || 'Unknown',
          ...extraRouteInfo
        };
      }
    } catch (error) {
      logger.error('Error formatting route', { error });
      return {
        routeString: 'Error formatting route details',
        paths: [],
        tokenPath: inputToken && outputToken ? [inputToken, outputToken] : [],
        amountIn: 'Unknown',
        amountOut: 'Unknown'
      };
    }
  }
  
  /**
   * Get a readable string representation of the route
   */
  private getReadableRouteString(route: any, tokenPath: any[]): string {
    try {
      // Try various ways to get a readable route string
      if (typeof route.toString === 'function') {
        const routeStr = route.toString();
        if (routeStr !== '[object Object]') {
          return routeStr;
        }
      }
      
      // If we have token path, use it to create a readable string
      if (tokenPath.length >= 2) {
        return tokenPath.map((token: { symbol: string }) => token.symbol).join(' → ');
      }
      
      // If toString() doesn't provide useful info, try to construct manually
      if (route.tokenPath) {
        return route.tokenPath.map((token: any) => token.symbol).join(' → ');
      }
      
      if (Array.isArray(route.route)) {
        const protocols = route.route.map((r: any) => r.protocol || 'Unknown').join('-');
        return `Route via ${protocols} protocol${route.route.length > 1 ? 's' : ''}`;
      }
      
      return 'Route details unavailable';
    } catch (error) {
      return 'Error getting route string';
    }
  }
  
  /**
   * Extract paths from the route object
   */
  private extractRoutePaths(route: any): any[] {
    try {
      // For V3 routes, look for route.pools
      if (route.pools && Array.isArray(route.pools)) {
        return [{
          protocol: 'V3',
          path: route.pools.map((pool: any) => pool.address || pool.id || 'Unknown pool'),
          fee: route.pools.map((pool: any) => 
            pool.fee ? `${(pool.fee / 10000).toFixed(2)}%` : 'Unknown'
          ).join(', '),
          pools: route.pools.map((pool: any) => ({
            fee: pool.fee ? `${(pool.fee / 10000).toFixed(2)}%` : 'Unknown',
            liquidity: pool.liquidity?.toString() || 'Unknown',
            address: pool.address || pool.id || 'Unknown'
          }))
        }];
      }
      
      // Handle the case where route.route is an array
      if (Array.isArray(route.route)) {
        return route.route.map((path: any) => {
          // Try to find pool addresses in various possible locations
          const poolAddresses = this.findPoolAddresses(path);
          
          return {
            protocol: path.protocol || 'Unknown',
            path: poolAddresses,
            fee: path.fee?.toString() || 'Unknown'
          };
        });
      }
      
      // If methodParameters exists, use that to infer protocol type
      if (route.methodParameters && route.methodParameters.to) {
        // The address in methodParameters.to is typically the router contract
        // which can help identify the protocol
        return [{
          protocol: this.inferProtocolFromRouter(route.methodParameters.to),
          path: [], // We don't have pool addresses here
          fee: 'Unknown'
        }];
      }
      
      // If route has path property
      if (route.path) {
        return [{
          protocol: route.protocol || 'Unknown',
          path: Array.isArray(route.path) ? route.path : [route.path],
          fee: route.fee?.toString() || 'Unknown'
        }];
      }
      
      return [];
    } catch (error) {
      logger.error('Error extracting route paths', { error });
      return [];
    }
  }
  
  /**
   * Infer protocol type from router address
   */
  private inferProtocolFromRouter(routerAddress: string): string {
    // Common Uniswap router addresses
    const routerAddresses = {
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45': 'V3', // Universal Router
      '0xE592427A0AEce92De3Edee1F18E0157C05861564': 'V3', // SwapRouter
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'V2'  // V2 Router
    };
    
    return routerAddresses[routerAddress as keyof typeof routerAddresses] || 'Unknown';
  }
  
  /**
   * Extract token path from route
   */
  private extractTokenPath(route: any): any[] {
    try {
      // Handle V3 routes with route.tokenPath
      if (route.tokenPath && Array.isArray(route.tokenPath)) {
        return route.tokenPath.map((token: any) => ({
          symbol: token.symbol || 'Unknown',
          address: token.address || 'Unknown'
        }));
      }
      
      // For V3 routes, look for tokenIn and tokenOut
      if (route.tokenIn && route.tokenOut) {
        return [
          {
            symbol: route.tokenIn.symbol || 'Input Token',
            address: route.tokenIn.address || 'Unknown'
          },
          {
            symbol: route.tokenOut.symbol || 'Output Token',
            address: route.tokenOut.address || 'Unknown'
          }
        ];
      }
      
      // Try to extract from input/output tokens
      if (route.input || route.output) {
        const tokens = [];
        if (route.input) tokens.push({
          symbol: route.input.symbol || 'Input',
          address: route.input.address || 'Unknown'
        });
        
        if (route.output) tokens.push({
          symbol: route.output.symbol || 'Output',
          address: route.output.address || 'Unknown'
        });
        
        return tokens;
      }
      
      // Try extracting from currency in the quote
      if (route.quote && route.quote.currency) {
        if (route.quote.currency.symbol) {
          // We can infer input token from query parameters
          return [
            { symbol: 'Input', address: 'Unknown' },
            { 
              symbol: route.quote.currency.symbol, 
              address: route.quote.currency.address || 'Unknown' 
            }
          ];
        }
      }
      
      return [];
    } catch (error) {
      logger.error('Error extracting token path', { error });
      return [];
    }
  }
  
  /**
   * Find pool addresses by checking various possible locations
   */
  private findPoolAddresses(path: any): string[] {
    // Check various possible locations for pool addresses
    if (Array.isArray(path.poolAddresses)) {
      return path.poolAddresses;
    }
    
    if (path.pools && Array.isArray(path.pools)) {
      return path.pools.map((pool: any) => pool.address || pool.id || 'Unknown pool');
    }
    
    if (path.pool?.address) {
      return [path.pool.address];
    }
    
    return [];
  }
  
  /**
   * Generate a unique ID for a quote
   */
  private generateQuoteId(): string {
    return `q-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  }
} 