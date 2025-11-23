/**
 * Logging utilities
 */

export function log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  switch (level) {
    case 'info':
      console.log(prefix, message, ...args)
      break
    case 'warn':
      console.warn(prefix, message, ...args)
      break
    case 'error':
      console.error(prefix, message, ...args)
      break
  }
}

export function info(message: string, ...args: any[]): void {
  log('info', message, ...args)
}

export function warn(message: string, ...args: any[]): void {
  log('warn', message, ...args)
}

export function error(message: string, ...args: any[]): void {
  log('error', message, ...args)
}

