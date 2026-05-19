/**
 * Shared Config Module
 * Application configuration
 */

interface Config {
  baseUrl: string;
  port: number;
  environment: string;
}

let config: Config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
};

export function getConfig(): Config {
  return config;
}

export function setConfig(newConfig: Partial<Config>): void {
  config = { ...config, ...newConfig };
}
