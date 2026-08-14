const DASHBOARD_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Gives a group of dashboard reads one shared deadline and connects React
 * Query cancellation to every PostgREST request in that group.
 */
export const createDashboardRequestScope = (querySignal?: AbortSignal) => {
  const controller = new AbortController();
  const abortFromQuery = () => controller.abort();

  if (querySignal?.aborted) {
    controller.abort();
  } else {
    querySignal?.addEventListener("abort", abortFromQuery, { once: true });
  }

  const timeoutId = window.setTimeout(() => controller.abort(), DASHBOARD_REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      querySignal?.removeEventListener("abort", abortFromQuery);
    },
  };
};
