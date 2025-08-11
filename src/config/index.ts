import { ConfigManager } from './manager.js';
import { Config } from '../types/index.js';

export type { Config };

const configManager = new ConfigManager();

export async function loadConfig(): Promise<Config> {
  return await configManager.getConfig();
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  return await configManager.setGlobalConfig(config);
}

export async function setProvider(name: string, config: any): Promise<void> {
  return await configManager.setProvider(name, config);
}

export async function getProvider(name: string): Promise<any> {
  return await configManager.getProvider(name);
}

export async function listProviders(): Promise<string[]> {
  return await configManager.listProviders();
}

export { ConfigManager };