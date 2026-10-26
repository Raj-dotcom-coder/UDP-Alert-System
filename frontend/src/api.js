const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, "")
  || (import.meta.env.DEV ? "http://localhost:5000/api" : "");

export async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("The backend is not configured yet. Set the VITE_API_URL GitHub Actions variable after hosting the backend.");
  }

  let storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem("udpAlertUser") || "null");
  } catch {
    localStorage.removeItem("udpAlertUser");
  }

  const { headers = {}, ...requestOptions } = options;
  const requestHeaders = { "Content-Type": "application/json", ...headers };
  if (storedUser?.token && !path.startsWith("/auth/login")) {
    requestHeaders.Authorization = `Bearer ${storedUser.token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: requestHeaders
    });
  } catch (error) {
    throw new Error("Unable to reach the alert server.");
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
