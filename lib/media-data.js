const MEDIA_TYPES = new Set(["book", "film", "music"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseItem(value) {
  if (!isRecord(value) || typeof value.id !== "string" || !MEDIA_TYPES.has(value.type) || typeof value.title !== "string" || typeof value.cover !== "string") return null;
  if (value.rating !== undefined && (!Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5)) return null;
  if (value.type !== "book" && value.rating !== undefined) return null;
  if (value.doubanRating !== undefined && (value.type !== "film" || typeof value.doubanRating !== "number" || value.doubanRating < 0 || value.doubanRating > 10)) return null;
  if (value.coverLarge !== undefined && typeof value.coverLarge !== "string") return null;
  const categories = Array.isArray(value.categories) ? value.categories.filter((category) => typeof category === "string" && category) : [];
  return { ...value, categories };
}

export function validateMediaData(value) {
  if (!Array.isArray(value)) throw new Error("媒体数据不是数组");
  const items = value.map(parseItem);
  if (items.some((item) => item === null)) throw new Error("媒体数据包含无效记录");
  const records = items;
  if (new Set(records.map((item) => item.id)).size !== records.length) throw new Error("媒体数据包含重复 ID");
  return records;
}

export async function loadMediaData(path = "data/media.json") {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`媒体数据加载失败 (${response.status})`);
  return validateMediaData(await response.json());
}
