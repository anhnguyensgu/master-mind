/** Supported cloud providers */
export type CloudProviderName = 'aws' | 'gcp' | 'azure';

/** Time granularity for cost queries */
export type CostGranularity = 'DAILY' | 'MONTHLY';

/** How to group cost results */
export type CostGroupByDimension =
  | 'SERVICE'
  | 'RESOURCE'
  | 'TAG'
  | 'REGION'
  | 'ACCOUNT';

// ──────────────── Query Types ────────────────

/** Date range for queries. ISO-8601 date strings (YYYY-MM-DD). */
export interface DateRange {
  start: string; // inclusive
  end: string; // exclusive
}

export interface CostGroupBy {
  dimension: CostGroupByDimension;
  /** Required when dimension is TAG */
  tagKey?: string;
}

export interface CostFilter {
  dimension: CostGroupByDimension;
  values: string[];
  /** Required when dimension is TAG */
  tagKey?: string;
}

export interface CostQuery {
  dateRange: DateRange;
  granularity: CostGranularity;
  groupBy?: CostGroupBy[];
  filters?: CostFilter[];
}

// ──────────────── Result Types ────────────────

export interface CostAmount {
  amount: number;
  unit: string;
  estimated: boolean;
}

export interface CostGroupKey {
  dimension: CostGroupByDimension;
  value: string;
  tagKey?: string;
}

export interface CostEntry {
  keys: CostGroupKey[];
  total: CostAmount;
  metrics: Record<string, CostAmount>;
}

export interface CostTimePeriod {
  start: string;
  end: string;
  entries: CostEntry[];
  periodTotal: CostAmount;
}

export interface CostResult {
  provider: CloudProviderName;
  query: CostQuery;
  timePeriods: CostTimePeriod[];
  grandTotal: CostAmount;
  currency: string;
  fetchedAt: string;
}

// ──────────────── Provider Interface ────────────────

export interface CloudCostProvider {
  readonly name: CloudProviderName;
  getCosts(query: CostQuery): Promise<CostResult>;
  validateCredentials(): Promise<boolean>;
}

// ──────────────── Config Types ────────────────

export interface AwsProviderConfig {
  provider: 'aws';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  accountId?: string;
}

export interface GcpProviderConfig {
  provider: 'gcp';
  projectId: string;
  credentialsPath: string;
}

export interface AzureProviderConfig {
  provider: 'azure';
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export type ProviderConfig =
  | AwsProviderConfig
  | GcpProviderConfig
  | AzureProviderConfig;

// ──────────────── Request Types (for handlers) ────────────────

export interface GetCostsRequest {
  start: string;
  end: string;
  granularity?: CostGranularity;
  groupBy?: CostGroupBy[];
  filters?: CostFilter[];
  provider?: CloudProviderName;
}
