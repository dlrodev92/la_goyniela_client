import "server-only";
import { z } from "zod";
import type { ProfileGateway } from "../domain/profile";
import { createAuthenticatedClient } from "../../../lib/http/json-client";

const avatarSchema = z.object({ user_id: z.number().int().positive(), avatar_url: z.string().url() });

export function createProfileGateway(baseUrl: string, token: string, fetcher: typeof fetch = fetch, timeoutMs = 20000): ProfileGateway {
  const request = createAuthenticatedClient(baseUrl, token, fetcher, timeoutMs);
  return {
    async uploadAvatar(file) {
      const form = new FormData();
      form.append("file", new Blob([file.bytes], { type: file.contentType }), file.name);
      // 400 bad bytes, 415 type, 413 size, 422 missing part.
      const result = await request("/users/me/avatar", avatarSchema, {
        method: "POST", body: form, statusMap: { 400: "invalid-image", 415: "invalid-image", 422: "invalid-image", 413: "file-too-large" },
      });
      return result.avatar_url;
    },
    async removeAvatar() {
      await request("/users/me/avatar", z.undefined(), { method: "DELETE" });
    },
  };
}
