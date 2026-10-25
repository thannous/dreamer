// Content-free transport evidence survives retries without changing the error
// class. Keep this module independent of auth/configuration and their consumers.
const dispatchedRequestErrors = new WeakSet<object>();
export const markHttpRequestDispatched = (error: object): void => {
  dispatchedRequestErrors.add(error);
};
export const wasHttpRequestDispatched = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && dispatchedRequestErrors.has(error);
