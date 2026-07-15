export function filterCatalog(items, search = "", category = "全部") {
  const query = search.trim().toLocaleLowerCase("zh-CN");
  return items.filter((item) => {
    const matchesCategory = category === "全部" || item.categories?.includes(category);
    const haystack = [item.title, item.creator, ...(item.categories ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return matchesCategory && (!query || haystack.includes(query));
  });
}

export function categoryCounts(items) {
  const counts = new Map();
  for (const item of items) {
    for (const category of item.categories ?? []) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts].sort(([left, leftCount], [right, rightCount]) =>
    rightCount - leftCount || left.localeCompare(right, "zh-CN"),
  );
}

export function toggleCategory(current, selected) {
  return current === selected ? "全部" : selected;
}
