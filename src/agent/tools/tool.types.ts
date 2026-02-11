import type { CostApiConfig } from '../../config/config.types';

export interface CostApiOptions {
  baseUrl: string;
  token: string;
}

export function costApiOptionsFromConfig(config: CostApiConfig): CostApiOptions {
  return {
    baseUrl: config.baseUrl.replace(/\/$/, ''),
    token: config.token,
  };
}

export async function costApiFetch(
  options: CostApiOptions,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = `${options.baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errData = data as { error?: { message?: string } };
    throw new Error(
      errData.error?.message || `Cost API error: ${response.status} ${response.statusText}`,
    );
  }

  const successData = data as { success: boolean; data?: unknown };
  if (successData.success === false) {
    throw new Error('Cost API returned unsuccessful response');
  }

  return successData.data ?? data;
}
