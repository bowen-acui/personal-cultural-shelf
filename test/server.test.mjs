import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { safePath } from "../server.mjs";

const root = path.dirname(fileURLToPath(new URL("../server.mjs", import.meta.url)));
const resolved = (urlPath) => safePath(urlPath) && path.relative(root, safePath(urlPath));

test("safePath serves the site's own pages and asset directories", () => {
  assert.equal(resolved("/"), "index.html");
  assert.equal(resolved("/browse.html"), "browse.html");
  assert.equal(resolved("/styles.css"), "styles.css");
  assert.equal(resolved("/data/media.json"), path.join("data", "media.json"));
  assert.equal(resolved("/public/covers/x.webp"), path.join("public", "covers", "x.webp"));
  assert.equal(resolved("/lib/routes.js"), path.join("lib", "routes.js"));
});

test("safePath refuses dotfiles, source files and undeclared directories", () => {
  assert.equal(safePath("/.git/config"), null);
  assert.equal(safePath("/.env"), null);
  assert.equal(safePath("/server.mjs"), null);
  assert.equal(safePath("/package.json"), null);
  assert.equal(safePath("/scripts/build-library.mjs"), null);
  assert.equal(safePath("/docs/x.md"), null);
  assert.equal(safePath("/node_modules/sharp/package.json"), null);
});

test("safePath refuses traversal, including through the URL encoding", () => {
  assert.equal(safePath("/../etc/passwd"), null);
  assert.equal(safePath("/public/../../etc/passwd"), null);
  // %2e%2e 解码后才现出原形，所以判定必须发生在 decodeURIComponent 之后。
  assert.equal(safePath("/%2e%2e/etc/passwd"), null);
  assert.equal(safePath("/public/%2e%2e/%2e%2e/server.mjs"), null);
});

test("safePath ignores the query string that cache-busting appends", () => {
  assert.equal(resolved("/lib/routes.js?v=7"), path.join("lib", "routes.js"));
  assert.equal(resolved("/?v=7"), "index.html");
});

test("safePath rejects a bare allowed directory with no file under it", () => {
  assert.equal(safePath("/public"), null);
  assert.equal(safePath("/lib"), null);
  assert.equal(safePath("/data"), null);
});
