import axios from "axios";
import * as cacheStore from "./cacheStore";
import { shouldPersistInternetData } from "./dataCacheSettings";

const NS = "network";
let installed = false;

function normalizeParams(params) {
  if (!params || typeof params !== "object") return "";
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join("&");
}

function cacheKey(config = {}) {
  const method = String(config.method || "get").toLowerCase();
  const url = config.url || "";
  const params = normalizeParams(config.params);
  return `${method}:${url}?${params}`;
}

function isGet(config = {}) {
  return String(config.method || "get").toLowerCase() === "get" && !!config.url;
}

export function installAxiosDataCache() {
  if (installed) return;
  installed = true;

  axios.interceptors.response.use(
    (response) => {
      const config = response?.config || {};
      if (isGet(config) && shouldPersistInternetData()) {
        cacheStore.setJSON(NS, cacheKey(config), response.data);
      }
      return response;
    },
    (error) => {
      const config = error?.config || {};
      if (!isGet(config)) return Promise.reject(error);
      if (error?.response) return Promise.reject(error);

      const cached = cacheStore.getJSON(NS, cacheKey(config));
      if (cached === null) return Promise.reject(error);

      return Promise.resolve({
        data: cached,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: error?.request,
        __fromCache: true,
      });
    },
  );
}
