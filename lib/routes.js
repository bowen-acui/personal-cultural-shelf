// 后缀匹配而非精确匹配：GitHub Pages 把站点挂在 /personal-cultural-shelf/ 子路径下，
// 精确匹配 "/film.html" 会全部落空、永远回退 book。
export function typeFromPath(pathname = "/") {
  if (pathname.endsWith("/film.html")) return "film";
  if (pathname.endsWith("/music.html")) return "music";
  return "book";
}

export function pathForType(type) {
  return type === "book" ? "./" : `./${type}.html`;
}

export function routeForType(type) {
  return new URL(pathForType(type), window.location.href).href;
}
