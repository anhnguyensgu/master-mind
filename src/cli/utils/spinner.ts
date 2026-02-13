export interface Spinner {
  start(message?: string): void;
  update(message: string): void;
  stop(finalMessage?: string): void;
  isActive(): boolean;
}
