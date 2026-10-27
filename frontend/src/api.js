export function getApiBaseUrl() {
  const custom = localStorage.getItem("udpServerUrl")?.trim();
  if (custom) {
    return custom.replace(/\/+$/, "");
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:5000/api`;
  }

  return "http://localhost:5000/api";
}

export function setApiBaseUrl(url) {
  if (!url) {
    localStorage.removeItem("udpServerUrl");
  } else {
    localStorage.setItem("udpServerUrl", url.trim().replace(/\/+$/, ""));
  }
}

export async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();

  let storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem("udpAlertUser") || "null");
  } catch {
    localStorage.removeItem("udpAlertUser");
  }

  const { headers = {}, ...requestOptions } = options;
  const requestHeaders = { "Content-Type": "application/json", ...headers };
  if (storedUser?.token && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    requestHeaders.Authorization = `Bearer ${storedUser.token}`;
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...requestOptions,
      headers: requestHeaders
    });
  } catch (error) {
    throw new Error(`Unable to reach the alert server at ${baseUrl}. Ensure backend is running and reachable on this network.`);
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (response.status === 401 && storedUser?.token) {
    localStorage.removeItem("udpAlertUser");
    window.location.assign(`${import.meta.env.BASE_URL}#/login`);
  }

  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}
