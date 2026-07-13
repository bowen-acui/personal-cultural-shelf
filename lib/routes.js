const TYPE_BY_PATH = new Map([
  ["/", "book"],
  ["/index.html", "book"],
  ["/film.html", "film"],
  ["/music.html", "music"],
]);

export function typeFromPath(pathname = "/") {
  return TYPE_BY_PATH.get(pathname) ?? "book";
}

export function pathForType(type) {
  return type === "book" ? "./" : `./${type}.html`;
}

export function routeForType(type) {
  return new URL(pathForType(type), window.location.href).href;
}
