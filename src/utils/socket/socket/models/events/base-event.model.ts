export interface BaseEventModel<T> {
  message: T;
  timestamp: number;
  event: string;
  isError: boolean;
  error?: Error | null;
  cause?: string | null;
  stack?: string | null;
}
