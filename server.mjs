import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".webp": "image/webp" };

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = path.resolve(root, `.${decoded === "/" ? "/index.html" : decoded}`);
  return candidate.startsWith(root + path.sep) ? candidate : null;
}

const server = http.createServer(async (request, response) => {
  try {
    let file = safePath(request.url || "/");
    if (!file) return response.writeHead(400).end("Bad request");
    try { await access(file); } catch { file = path.join(root, "404.html"); }
    const info = await stat(file);
    if (!info.isFile()) file = path.join(root, "404.html");
    response.writeHead(200, { "Cache-Control": "public, max-age=300", "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(500).end("Server error"); }
});

server.listen(port, "0.0.0.0", () => console.log(`Personal cultural shelf listening on ${port}`));
