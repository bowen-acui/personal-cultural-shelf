import { categoryCounts, filterCatalog } from "./lib/catalog.js";
import { loadMediaData } from "./lib/media-data.js";

const labels = { book: "书", film: "影", music: "音" };
const grid = document.querySelector("#catalog-grid");
const search = document.querySelector("#catalog-search");
const type = document.querySelector("#catalog-type");
const category = document.querySelector("#catalog-category");
const status = document.querySelector("#catalog-status");
let data = [];

function card(item) {
  const article = document.createElement("article");
  article.className = "catalog-card";
  article.setAttribute("role", "listitem");
  const image = document.createElement("img");
  image.src = item.cover;
  image.alt = [item.title, item.creator].filter(Boolean).join("，");
  image.width = 320;
  image.height = item.type === "music" ? 320 : 480;
  image.loading = "lazy";
  const title = document.createElement("strong");
  const meta = document.createElement("small");
  title.textContent = item.title;
  const month = item.type === "book" && item.completedMonth ? `${item.completedMonth.replace("-", "年")}月` : "";
  meta.textContent = [labels[item.type], item.creator, month, ...(item.categories ?? [])].filter(Boolean).join(" · ");
  article.append(image, title, meta);
  return article;
}

function render() {
  const source = type.value === "全部" ? data : data.filter((item) => item.type === type.value);
  const results = filterCatalog(source, search.value, category.value);
  grid.replaceChildren(...results.map(card));
  status.textContent = results.length ? `找到 ${results.length} 件${type.value === "全部" ? "藏品" : labels[type.value]}` : "没有找到符合条件的藏品";
}

function renderCategories() {
  const source = type.value === "全部" ? data : data.filter((item) => item.type === type.value);
  category.replaceChildren();
  for (const [name, count] of [["全部", source.length], ...categoryCounts(source)]) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${name} (${count})`;
    category.append(option);
  }
}

function renderError(message) {
  status.textContent = message;
  grid.replaceChildren();
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "page-retry";
  retry.textContent = "重新读取";
  retry.addEventListener("click", load);
  grid.append(retry);
}

async function load() {
  status.textContent = "正在读取藏品…";
  try {
    data = await loadMediaData();
    type.replaceChildren();
    for (const [value, name] of [["全部", "全部"], ["book", "书"], ["film", "影"], ["music", "音"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      type.append(option);
    }
    renderCategories();
    render();
  } catch (error) {
    renderError(error instanceof Error ? error.message : "媒体数据读取失败");
  }
}

search.addEventListener("input", render);
type.addEventListener("change", () => { renderCategories(); render(); });
category.addEventListener("change", render);
load();
