/**
 * 雪花算法(Snowflake)ID生成器
 * 结构：
 * - 1位符号位，固定为0
 * - 41位时间戳，精确到毫秒（当前时间减去开始时间）
 * - 10位工作机器ID（5位数据中心ID + 5位机器ID）
 * - 12位序列号，毫秒内的计数，从0开始（同一毫秒内最多生成4096个ID）
 */
export class SnowflakeIdGenerator {
  private readonly twepoch: bigint = 1420041600000n; // 开始时间戳：2015-01-01
  
  private readonly workerIdBits: bigint = 5n; // 机器ID所占位数
  private readonly dataCenterIdBits: bigint = 5n; // 数据中心ID所占位数
  private readonly sequenceBits: bigint = 12n; // 序列号所占位数
  
  private readonly maxWorkerId: bigint = -1n ^ (-1n << this.workerIdBits); // 最大机器ID：31
  private readonly maxDataCenterId: bigint = -1n ^ (-1n << this.dataCenterIdBits); // 最大数据中心ID：31
  
  private readonly workerIdShift: bigint = this.sequenceBits; // 机器ID左移位数：12
  private readonly dataCenterIdShift: bigint = this.sequenceBits + this.workerIdBits; // 数据中心ID左移位数：17
  private readonly timestampLeftShift: bigint = this.sequenceBits + this.workerIdBits + this.dataCenterIdBits; // 时间戳左移位数：22
  
  private readonly sequenceMask: bigint = -1n ^ (-1n << this.sequenceBits); // 序列号掩码：4095
  
  private sequence: bigint = 0n; // 序列号
  private lastTimestamp: bigint = -1n; // 上次生成ID的时间戳
  
  private workerId: bigint; // 机器ID
  private dataCenterId: bigint; // 数据中心ID
  
  /**
   * 构造函数
   * @param workerId 工作机器ID (0-31)
   * @param dataCenterId 数据中心ID (0-31)
   */
  constructor(workerId: number = 0, dataCenterId: number = 0) {
    // 检查workerId是否合法
    if (workerId > Number(this.maxWorkerId) || workerId < 0) {
      throw new Error(`Worker ID must be between 0 and ${this.maxWorkerId}`);
    }
    
    // 检查dataCenterId是否合法
    if (dataCenterId > Number(this.maxDataCenterId) || dataCenterId < 0) {
      throw new Error(`Data Center ID must be between 0 and ${this.maxDataCenterId}`);
    }
    
    this.workerId = BigInt(workerId);
    this.dataCenterId = BigInt(dataCenterId);
  }
  
  /**
   * 获取下一个ID
   * @returns 雪花算法生成的ID
   */
  public nextId(): string {
    let timestamp = this.currentTimestamp();
    
    // 检查时钟是否回拨
    if (timestamp < this.lastTimestamp) {
      throw new Error(`Clock moved backwards. Refusing to generate ID for ${this.lastTimestamp - timestamp} milliseconds`);
    }
    
    // 如果是同一时间生成的，则进行序列号自增
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & this.sequenceMask;
      // 序列号用尽，等待下一毫秒
      if (this.sequence === 0n) {
        timestamp = this.tilNextMillis(this.lastTimestamp);
      }
    } else {
      // 时间戳改变，序列号重置
      this.sequence = 0n;
    }
    
    this.lastTimestamp = timestamp;
    
    // 组合ID各部分形成64位的ID
    const id = 
      ((timestamp - this.twepoch) << this.timestampLeftShift) | 
      (this.dataCenterId << this.dataCenterIdShift) | 
      (this.workerId << this.workerIdShift) | 
      this.sequence;
    
    return id.toString();
  }
  
  /**
   * 获取当前时间戳
   */
  private currentTimestamp(): bigint {
    return BigInt(Date.now());
  }
  
  /**
   * 等待到下一毫秒
   * @param lastTimestamp 上次生成ID的时间戳
   */
  private tilNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }
} 