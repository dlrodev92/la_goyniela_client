import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createProfileGateway } = require("../build/tests/features/profile/infrastructure/http-profile-gateway.js");
const { uploadAvatar, removeAvatar } = require("../build/tests/features/profile/application/profile.js");
const { checkAvatar, matchesMagicBytes, AVATAR_MAX_BYTES } = require("../build/tests/features/profile/domain/profile.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const file = (bytes, type = "image/png", name = "me.png") => ({ name, type, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
const response = (payload, status = 200) => new Response(payload === undefined ? null : JSON.stringify(payload), { status });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code);

test("upload sends multipart with the file part and maps the avatar url", async () => {
  let request;
  const gateway = createProfileGateway(BASE, "t", async (url, init) => { request = { url, init }; return response({ user_id: 7, avatar_url: "https://cdn.example.com/users/7.png" }); });
  const url = await uploadAvatar(gateway, file(PNG));
  assert.equal(url, "https://cdn.example.com/users/7.png");
  assert.equal(request.url, `${BASE}/users/me/avatar`);
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer t");
  assert.equal(request.init.headers["Content-Type"], undefined);
  assert.ok(request.init.body instanceof FormData);
  const part = request.init.body.get("file");
  assert.equal(part.type, "image/png");
  assert.equal(part.size, PNG.byteLength);
});

test("backend upload errors map to friendly codes", async () => {
  const gateway = status => createProfileGateway(BASE, "t", async () => response({ detail: "x" }, status));
  await rejectsCode(uploadAvatar(gateway(400), file(PNG)), "invalid-image");
  await rejectsCode(uploadAvatar(gateway(415), file(PNG)), "invalid-image");
  await rejectsCode(uploadAvatar(gateway(413), file(PNG)), "file-too-large");
  await rejectsCode(uploadAvatar(gateway(401), file(PNG)), "unauthenticated");
  await rejectsCode(uploadAvatar(gateway(500), file(PNG)), "upstream");
  await rejectsCode(uploadAvatar(createProfileGateway(BASE, "t", async () => response({ user_id: 7 })), file(PNG)), "malformed");
});

test("server-side validation rejects bad type, size and magic bytes before any request", async () => {
  const gateway = { uploadAvatar: async () => assert.fail("called") };
  await rejectsCode(uploadAvatar(gateway, file(PNG, "image/gif")), "invalid-image");
  await rejectsCode(uploadAvatar(gateway, file(new Uint8Array(0))), "invalid-image");
  await rejectsCode(uploadAvatar(gateway, file(Uint8Array.from([1, 2, 3, 4]), "image/png")), "invalid-image");
  await rejectsCode(uploadAvatar(gateway, file(PNG, "image/jpeg")), "invalid-image");
  await rejectsCode(uploadAvatar(gateway, { ...file(PNG), size: AVATAR_MAX_BYTES + 1 }), "file-too-large");
  // A lying `size` does not bypass the check on the real bytes.
  await rejectsCode(uploadAvatar(gateway, { ...file(new Uint8Array(AVATAR_MAX_BYTES + 1)), size: 10 }), "file-too-large");
});

test("checkAvatar and magic bytes cover the three accepted formats", () => {
  assert.equal(checkAvatar({ type: "image/webp", size: 10 }), null);
  assert.equal(checkAvatar({ type: "image/svg+xml", size: 10 }), "invalid-image");
  assert.equal(checkAvatar({ type: "image/png", size: AVATAR_MAX_BYTES }), null);
  assert.equal(checkAvatar({ type: "image/png", size: AVATAR_MAX_BYTES + 1 }), "file-too-large");
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(matchesMagicBytes(webp.buffer, "image/webp"), true);
  assert.equal(matchesMagicBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]).buffer, "image/jpeg"), true);
  assert.equal(matchesMagicBytes(webp.buffer, "image/png"), false);
});

test("removing the avatar sends DELETE and accepts 204", async () => {
  let request;
  await removeAvatar(createProfileGateway(BASE, "t", async (url, init) => { request = { url, init }; return new Response(null, { status: 204 }); }));
  assert.equal(request.init.method, "DELETE");
  assert.equal(request.url, `${BASE}/users/me/avatar`);
});
