import winston from 'winston';
import { format } from 'winston';
import fs from 'fs';
import path from 'path';

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'uniswap-smart-order-router' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message} ${
            Object.keys(info).length > 3 ? 
              JSON.stringify(Object.fromEntries(
                Object.entries(info).filter(
                  ([key]) => !['timestamp', 'service', 'level', 'message'].includes(key)
                )
              )) : ''
          }`
        )
      )
    }),
    
    // 文件输出
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'app.log') 
    })
  ]
});

export default logger; 