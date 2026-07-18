export const getAppUrl = (path = "") => {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path.replace(/^\/+/, ""), baseUrl).toString();
};
