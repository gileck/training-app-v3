export type ApiHandlers = Record<string, {
  process: ((params: unknown, context: ApiHandlerContext) => Promise<unknown>);
}>

export type ErrorResponse = {
  error: string;
};

export interface ApiHandlerContext {
  userId?: string; // Optional: User may not be authenticated
  isAdmin: boolean;
  getCookieValue: (name: string) => string | undefined;
  setCookie: (name: string, value: string, options?: Record<string, unknown>) => void;
  clearCookie: (name: string, options?: Record<string, unknown>) => void;
}
