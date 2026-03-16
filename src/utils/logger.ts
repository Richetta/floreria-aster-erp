/**
 * Logger Service
 * Servicio centralizado de logging para la aplicación
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}

class LoggerService {
  private isDevelopment = import.meta.env.MODE === 'development';

  /**
   * Log message
   */
  private log(entry: LogEntry): void {
    // En desarrollo, mostrar en consola
    if (this.isDevelopment) {
      const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.context ? `[${entry.context}] ` : ''}${entry.message}`;
      
      switch (entry.level) {
        case 'error':
          console.error(logMessage, entry.data || '');
          break;
        case 'warn':
          console.warn(logMessage, entry.data || '');
          break;
        case 'info':
          console.info(logMessage, entry.data || '');
          break;
        case 'debug':
          console.log(logMessage, entry.data || '');
          break;
      }
    }

    // En producción, los errores se podrían enviar a un servicio externo
    // if (!this.isDevelopment && entry.level === 'error') {
    //   sendToErrorTrackingService(entry);
    // }
  }

  /**
   * Log error
   */
  error(message: string, error?: any, context?: string): void {
    this.log({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      context,
      data: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
  }

  /**
   * Log warning
   */
  warn(message: string, data?: any, context?: string): void {
    this.log({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      context,
      data
    });
  }

  /**
   * Log info
   */
  info(message: string, data?: any, context?: string): void {
    this.log({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      context,
      data
    });
  }

  /**
   * Log debug
   */
  debug(message: string, data?: any, context?: string): void {
    this.log({
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      context,
      data
    });
  }

  /**
   * Log success (info con estilo especial)
   */
  success(message: string, data?: any, context?: string): void {
    this.log({
      level: 'info',
      message: `✅ ${message}`,
      timestamp: new Date().toISOString(),
      context,
      data
    });
  }
}

// Export singleton instance
export const logger = new LoggerService();

// Export for use in components
export default logger;
