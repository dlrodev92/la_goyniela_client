import "server-only";
import { ServiceError } from "../../../lib/http/errors";

export function apiBaseUrl(): string {
  try {
    const url = new URL(process.env.API_BASE_URL ?? "");
    if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password || url.search || url.hash) throw new Error();
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch { throw new ServiceError("configuration"); }
}
