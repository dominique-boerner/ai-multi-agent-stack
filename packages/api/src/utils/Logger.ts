import { DashboardService } from '../dashboard/dashboard.service';

// NOTE: Higher number = higher severity = always shown at coarser log levels.
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO  = 2,
  WARN  = 3,
  ERROR = 4
}

export class Logger {
  public static level: LogLevel = LogLevel.INFO;

  public static setLevel(levelStr: string | undefined): void {
    switch (levelStr?.toUpperCase()) {
      case 'TRACE': this.level = LogLevel.TRACE; break;
      case 'DEBUG': this.level = LogLevel.DEBUG; break;
      case 'WARN': this.level = LogLevel.WARN; break;
      case 'INFO': this.level = LogLevel.INFO; break;
      case 'ERROR': this.level = LogLevel.ERROR; break;
      default: this.level = LogLevel.INFO; break;
    }
  }

  private static formatMessage(level: string, context: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${context}] ${level}: ${message}`;
  }

  public static trace(context: string, message: string): void {
    if (LogLevel.TRACE >= this.level) {
      console.log(this.formatMessage('TRACE', context, message));
      DashboardService.addLog('TRACE', context, message);
    }
  }

  public static debug(context: string, message: string): void {
    if (LogLevel.DEBUG >= this.level) {
      console.log(this.formatMessage('DEBUG', context, message));
      DashboardService.addLog('DEBUG', context, message);
    }
  }

  public static warn(context: string, message: string, error?: any): void {
    if (LogLevel.WARN >= this.level) {
      console.warn(this.formatMessage('WARN', context, message));
      if (error) console.warn(error instanceof Error ? error.message : error);
      DashboardService.addLog('WARN', context, error ? `${message} — ${error instanceof Error ? error.message : String(error)}` : message);
    }
  }

  public static info(context: string, message: string): void {
    if (LogLevel.INFO >= this.level) {
      console.log(this.formatMessage('INFO', context, message));
      DashboardService.addLog('INFO', context, message);
    }
  }

  public static error(context: string, message: string, error?: any): void {
    if (LogLevel.ERROR >= this.level) {
      console.error(this.formatMessage('ERROR', context, message));
      if (error) {
        console.error(error instanceof Error ? error.stack || error.message : error);
      }
      DashboardService.addLog('ERROR', context, error ? `${message} — ${error instanceof Error ? error.message : String(error)}` : message);
    }
  }
}
