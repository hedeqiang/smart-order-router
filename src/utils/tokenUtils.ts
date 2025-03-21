import fs from 'fs';
import path from 'path';
import { ChainId } from '@uniswap/sdk-core';
import logger from './logger';

// 定义代币信息接口
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

// 代币映射类型
export type TokenMap = Record<string, TokenInfo>;

// 链ID到代币映射的映射
export type ChainTokenMap = Record<number, TokenMap>;

// 链ID到文件名的映射
const chainToFileMap: Record<number, string> = {
  [ChainId.MAINNET]: 'eth.json',
  [ChainId.OPTIMISM]: 'op.json',
  [ChainId.ARBITRUM_ONE]: 'arb.json',
  [ChainId.POLYGON]: 'polygon.json',
  [ChainId.BNB]: 'bsc.json', 
  [ChainId.AVALANCHE]: 'avax.json',
  [ChainId.BASE]: 'base.json'
};

/**
 * 代币工具类，用于加载和管理各链的代币信息
 */
export class TokenUtils {
  private static tokensCache: ChainTokenMap = {};
  private static initialized = false;

  /**
   * 初始化代币工具类，加载所有链的代币信息
   */
  public static init(): void {
    if (this.initialized) return;

    const tokensDir = path.join(__dirname, '..', 'config', 'tokens');
    
    try {
      // 确保目录存在
      if (!fs.existsSync(tokensDir)) {
        logger.warn(`Tokens directory not found: ${tokensDir}`);
        this.initialized = true;
        return;
      }

      // 加载所有链的代币信息
      for (const [chainIdStr, fileName] of Object.entries(chainToFileMap)) {
        const chainId = parseInt(chainIdStr);
        const filePath = path.join(tokensDir, fileName);

        if (fs.existsSync(filePath)) {
          try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const tokens = JSON.parse(fileContent) as TokenMap;
            
            // 将地址转为小写作为键
            const normalizedTokens: TokenMap = {};
            for (const [address, info] of Object.entries(tokens)) {
              normalizedTokens[address.toLowerCase()] = info;
            }
            
            this.tokensCache[chainId] = normalizedTokens;
            logger.info(`Loaded ${Object.keys(normalizedTokens).length} tokens for chain ${chainId}`);
          } catch (err) {
            logger.error(`Failed to load tokens for chain ${chainId}`, { error: err });
          }
        } else {
          logger.warn(`Token file not found: ${filePath}`);
        }
      }

      this.initialized = true;
    } catch (err) {
      logger.error('Failed to initialize token utils', { error: err });
      // 确保即使出错也标记为已初始化，避免反复尝试
      this.initialized = true;
    }
  }

  /**
   * 获取指定链和地址的代币信息
   * @param chainId 链ID
   * @param address 代币地址
   * @returns 代币信息或undefined
   */
  public static getToken(chainId: number, address: string): TokenInfo | undefined {
    if (!this.initialized) {
      this.init();
    }

    const normalizedAddress = address.toLowerCase();
    const chainTokens = this.tokensCache[chainId];
    
    if (chainTokens) {
      return chainTokens[normalizedAddress];
    }
    
    return undefined;
  }

  /**
   * 获取指定链的所有代币
   * @param chainId 链ID
   * @returns 代币映射或空对象
   */
  public static getChainTokens(chainId: number): TokenMap {
    if (!this.initialized) {
      this.init();
    }
    
    return this.tokensCache[chainId] || {};
  }

  /**
   * 添加或更新代币信息到内存缓存
   * @param chainId 链ID
   * @param address 代币地址
   * @param info 代币信息
   */
  public static addToken(chainId: number, address: string, info: TokenInfo): void {
    if (!this.initialized) {
      this.init();
    }
    
    const normalizedAddress = address.toLowerCase();
    
    if (!this.tokensCache[chainId]) {
      this.tokensCache[chainId] = {};
    }
    
    this.tokensCache[chainId][normalizedAddress] = info;
  }
}

// 初始化代币工具类
TokenUtils.init();

export default TokenUtils; 