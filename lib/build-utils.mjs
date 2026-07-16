import os from "node:os";
import path from "node:path";

// 构建脚本里不碰文件系统、不碰 sharp 的部分都放这儿：
// 测试只 import 这个文件，就不必为了跑单测装原生依赖。
// 需要 sharp / 读盘 / 写盘的留在 scripts/build-library.mjs。

export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const metadata = {};
  let listKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    const property = line.match(/^([^\s][^:]*):\s*(.*)$/);
    if (property) {
      const key = property[1].trim();
      const value = property[2].trim().replace(/^['"]|['"]$/g, "");
      listKey = key === "分类" && !value ? key : null;
      if (value) metadata[key] = value;
      if (listKey) metadata[listKey] = [];
      continue;
    }
    const item = listKey ? line.match(/^\s+-\s+(.+)$/) : null;
    if (item) metadata[listKey].push(item[1].trim().replace(/^['"]|['"]$/g, ""));
  }
  return metadata;
}

export function isDisplayableBook(metadata) {
  const completed = /^(已读|读完|完成|读完待整理)$/.test(metadata.状态?.trim() ?? "");
  return Boolean(metadata.封面 && (metadata.完读日期 || completed));
}

export function completedMonth(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})[-/.年](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : "";
}

export function publicRating(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : 0;
}

export function publicDecimalRating(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : 0;
}

export function isDisplayableMedia(metadata) {
  return Boolean((metadata.名称 || metadata.书名)?.trim() && metadata.封面?.trim());
}

export function resolveVaultRoot(env = process.env, home = os.homedir()) {
  return path.resolve(env.OBSIDIAN_VAULT || path.join(home, "Documents/obsidian/阿崔"));
}

export function validateUniqueRecords(records) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) throw new Error(`Duplicate media id: ${record.id}`);
    seen.add(record.id);
  }
  return records;
}

export function sortMediaRecords(records) {
  return records.sort((left, right) => {
    const typeOrder = left.type.localeCompare(right.type);
    if (typeOrder) return typeOrder;
    if (left.type === "book") {
      const ratingOrder = (right.rating ?? 0) - (left.rating ?? 0);
      if (ratingOrder) return ratingOrder;
    }
    if (left.type === "film") {
      const priorityOrder = (left.pinned ?? 99) - (right.pinned ?? 99);
      if (priorityOrder) return priorityOrder;
      const doubanOrder = (right.doubanRating ?? 0) - (left.doubanRating ?? 0);
      if (doubanOrder) return doubanOrder;
    }
    if (left.type === "music") {
      const priorityOrder = (left.pinned ?? 99) - (right.pinned ?? 99);
      if (priorityOrder) return priorityOrder;
    }
    return left.title.localeCompare(right.title, "zh-CN");
  });
}

// 影/音的置顶来自 frontmatter `置顶:`（数字越小越靠前），换偏好改笔记即可，不用改代码。
// 该字段只参与排序，写 JSON 前会被剥掉，不进入公开数据面。
export function pinnedRank(metadata) {
  const raw = String(metadata.置顶 ?? "").trim();
  const rank = Number(raw);
  // 空串要走缺省而不是被 Number("") 悄悄算成 0 —— 那会把没写置顶的笔记顶到最前。
  return raw && Number.isFinite(rank) ? rank : 99;
}

export function orphanCoverNames(names, referenced) {
  return names.filter((name) => /^[a-f0-9]{12}(?:-(?:320|720))?\.(jpg|jpeg|png|webp|avif)$/i.test(name) && !referenced.has(name));
}

export function categories(metadata) {
  return Array.isArray(metadata.分类) ? metadata.分类.filter(Boolean) : [];
}

export function publicId(filename, type) {
  return `${type}:${path.basename(filename, path.extname(filename))}`;
}

export function toPublicMedia(filename, metadata, publicCover, type, publicCoverLarge = "") {
  const title = (metadata.名称 || metadata.书名 || path.basename(filename, path.extname(filename))).trim();
  const creator = (metadata.创作者 || metadata.作者 || "").trim();
  const month = type === "book" ? completedMonth(metadata.完读日期) : "";
  const rating = type === "book" ? publicRating(metadata.评分) : 0;
  const doubanRating = type === "film" ? publicDecimalRating(metadata.豆瓣评分 || metadata.豆瓣分数) : 0;
  return {
    id: publicId(filename, type),
    type,
    title,
    ...(creator ? { creator } : {}),
    cover: publicCover,
    ...(publicCoverLarge ? { coverLarge: publicCoverLarge } : {}),
    categories: categories(metadata),
    ...(month ? { completedMonth: month } : {}),
    ...(rating ? { rating } : {}),
    ...(doubanRating ? { doubanRating } : {}),
  };
}

export function toPublicBook(filename, metadata, publicCover) {
  return toPublicMedia(filename, metadata, publicCover, "book");
}

export function coverDestinationName(sourcePath, digest) {
  const extension = path.extname(sourcePath).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension) ? digest : null;
}
