import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".webp": "image/webp", ".woff2": "font/woff2" };
// webp/woff2/png 自身已压缩，再 gzip 只浪费 CPU；只压文本类。
const compressible = new Set([".html", ".css", ".js", ".json", ".svg", ".txt", ".xml"]);

// 只放行站点真正要发的资源：根目录静态页 + public/lib/data 三个目录。
// 其余（server.mjs、scripts/、docs/、.git/、node_modules/）一律当 404。
export function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  if (decoded.split("/").some((part) => part.startsWith("."))) return null;
  const candidate = path.resolve(root, `.${decoded === "/" ? "/index.html" : decoded}`);
  if (!candidate.startsWith(root + path.sep)) return null;
  const relative = path.relative(root, candidate);
  const [head] = relative.split(path.sep);
  const topLevelFile = !relative.includes(path.sep) && /\.(html|css|js|png|svg|txt|xml)$/.test(relative);
  const allowedDirectory = ["public", "lib", "data"].includes(head) && relative.includes(path.sep);
  return topLevelFile || allowedDirectory ? candidate : null;
}

function cacheControl(file) {
  const relative = path.relative(root, file);
  if (relative.startsWith(path.join("public", "covers")) || relative.startsWith(path.join("public", "fonts"))) return "public, max-age=31536000, immutable";
  if (relative === path.join("data", "media.json")) return "public, max-age=60, must-revalidate";
  if ([".css", ".js"].includes(path.extname(file).toLowerCase())) return "public, max-age=3600, must-revalidate";
  return "public, max-age=300";
}

export const server = http.createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]);
    let file = safePath(request.url || "/") ?? path.join(root, "404.html");
    try {
      if (!(await stat(file)).isFile()) throw new Error("not a file");
    } catch {
      file = path.join(root, "404.html");
    }
    const status = path.basename(file) === "404.html" && requested !== "/404.html" ? 404 : 200;
    const extension = path.extname(file).toLowerCase();
    const headers = { "Cache-Control": cacheControl(file), "Content-Type": mime[extension] || "application/octet-stream" };
    if (compressible.has(extension)) {
      headers.Vary = "Accept-Encoding";
      if (/\bgzip\b/.test(request.headers["accept-encoding"] || "")) {
        headers["Content-Encoding"] = "gzip";
        response.writeHead(status, headers);
        pipeline(createReadStream(file), createGzip(), response, () => {});
        return;
      }
    }
    response.writeHead(status, headers);
    createReadStream(file).pipe(response);
  } catch { response.writeHead(500).end("Server error"); }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, "0.0.0.0", () => console.log(`Personal cultural shelf listening on ${port}`));
}
