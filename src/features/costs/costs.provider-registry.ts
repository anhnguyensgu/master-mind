import type {
  CloudCostProvider,
  CloudProviderName,
  ProviderConfig,
} from './costs.types';
import { AppError, ErrorCodes } from '../../shared/error';
import { loadProviderConfigs, getDefaultProviderName } from './costs.config';

type ProviderFactory = (config: ProviderConfig) => CloudCostProvider;

class CostProviderRegistry {
  private factories = new Map<CloudProviderName, ProviderFactory>();
  private instances = new Map<CloudProviderName, CloudCostProvider>();
  private initialized = false;

  registerFactory(name: CloudProviderName, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  /** Register a pre-built provider instance directly */
  registerProvider(provider: CloudCostProvider): void {
    this.instances.set(provider.name, provider);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const configs = await loadProviderConfigs();

    for (const [name, config] of configs) {
      const factory = this.factories.get(name);
      if (factory) {
        this.instances.set(name, factory(config));
      }
    }

    this.initialized = true;
  }

  getProvider(name?: CloudProviderName): CloudCostProvider {
    const providerName = name ?? getDefaultProviderName();
    const provider = this.instances.get(providerName);

    if (!provider) {
      throw new AppError(
        `Cost provider '${providerName}' is not configured. Available: ${[...this.instances.keys()].join(', ') || 'none'}`,
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        400
      );
    }

    return provider;
  }

  listProviders(): CloudProviderName[] {
    return [...this.instances.keys()];
  }
}

let registryInstance = new CostProviderRegistry();

export function getCostProviderRegistry(): CostProviderRegistry {
  return registryInstance;
}

export function setCostProviderRegistry(
  registry: CostProviderRegistry
): void {
  registryInstance = registry;
}

export async function initializeCostProviders(): Promise<void> {
  const registry = getCostProviderRegistry();
  await registry.initialize();
}
