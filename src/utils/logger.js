/**
 * Logger utility - Điều khiển log level qua biến môi trường
 * LOG_LEVEL: 'none' | 'error' | 'warn' | 'info' | 'debug'
 * Mặc định: 'error' (chỉ log lỗi)
 */

const LOG_LEVELS = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.error;

const logger = {
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(...args);
    }
  },
  
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(...args);
    }
  },
  
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(...args);
    }
  },
  
  // Log quan trọng luôn hiển thị (startup, shutdown)
  important: (...args) => {
    console.log(...args);
  }
};

export default logger;
