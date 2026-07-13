import { categoryCounts } from "./lib/catalog.js";
import { loadMediaData } from "./lib/media-data.js";
import { createPosterCanvas } from "./lib/poster.js";
import { pathForType, typeFromPath } from "./lib/routes.js";
import { createScatterLayout, createTidyLayout, createVortexLayout, stageHeightFor } from "./lib/layouts.js?v=2";

const typeLabels = { book: "书", film: "影", music: "音" };
const state = { type: document.body.dataset.mediaType || typeFromPath(location.pathname), all: [], items: [], mode: "scatter", seed: 0, category: "全部", picking: false, picked: [], dragging: false };
const stage = document.querySelector("#shelf-stage");
const controls = document.querySelector("#shelf-controls");
const filterPanel = document.querySelector("#filter-panel");
const detailDialog = document.querySelector("#detail-dialog");
let detailTrigger = null;

function label(item) { return [item.title, item.creator].filter(Boolean).join("，"); }
function monthLabel(item) { return item.type === "book" && item.completedMonth ? `${item.completedMonth.replace("-", "年")}月` : ""; }

function placementFor(items) {
  const viewport = { width: document.documentElement.clientWidth, height: innerHeight };
  if (state.mode === "tidy") return createTidyLayout(items, viewport, state.type);
  if (state.mode === "vortex") return createVortexLayout(items, viewport, state.type);
  return createScatterLayout(items, viewport, state.seed, state.type);
}

function applyLayout() {
  const layout = placementFor(state.items);
  stage.querySelectorAll(".media-object").forEach((object, index) => {
    const place = layout[index];
    if (!place) return;
    object.style.setProperty("--left", `${place.left}px`);
    object.style.setProperty("--top", `${place.top}px`);
    object.style.setProperty("--cover-width", `${place.width}px`);
    object.style.setProperty("--rotation", `${place.rotation}deg`);
    object.style.setProperty("--scale", place.scale);
    object.style.setProperty("--layer", place.layer);
    object.style.setProperty("--ratio", place.ratio);
    object.style.setProperty("--delay", `${Math.min(index * (state.mode === "vortex" ? 8 : 18), 500)}ms`);
  });
  stage.dataset.mode = state.mode;
  stage.dataset.mediaType = state.type;
  stage.style.height = `${stageHeightFor(state.items.length, document.documentElement.clientWidth, state.mode, state.type)}px`;
  controls.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.mode));
}

function createObject(item, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-object";
  button.dataset.index = index;
  button.dataset.categories = item.categories.join("|");
  button.setAttribute("aria-label", label(item));
  button.setAttribute("aria-pressed", "false");
  const image = document.createElement("img");
  image.src = item.cover;
  image.alt = label(item);
  image.width = 320;
  image.height = state.type === "music" ? 320 : 480;
  if (index >= 18) image.loading = "lazy";
  const information = document.createElement("span");
  information.className = "object-info";
  information.id = `object-info-${state.type}-${index}`;
  button.setAttribute("aria-describedby", information.id);
  const title = document.createElement("strong");
  const creator = document.createElement("span");
  const categories = document.createElement("small");
  title.textContent = item.title;
  creator.textContent = item.creator ?? "";
  categories.textContent = [monthLabel(item), ...item.categories].filter(Boolean).join(" · ");
  information.append(title, creator, categories);
  button.append(image, information);
  return button;
}

function setError(message) {
  stage.replaceChildren();
  stage.classList.add("shelf-state");
  const stateMessage = document.createElement("div");
  stateMessage.className = "shelf-error";
  stateMessage.innerHTML = `<strong>暂时无法打开这张精神地图</strong><span>${message}</span><button type="button" data-action="retry">重新读取</button>`;
  stage.append(stateMessage);
  stage.setAttribute("aria-busy", "false");
}

function render() {
  stage.classList.remove("shelf-state");
  stage.replaceChildren(...state.items.map(createObject));
  document.querySelector("#item-count").textContent = state.items.length;
  document.querySelector("#item-kind").textContent = typeLabels[state.type];
  document.querySelector(".media-nav [aria-current]")?.removeAttribute("aria-current");
  document.querySelector(`.media-nav [data-type="${state.type}"]`)?.setAttribute("aria-current", "page");
  stage.setAttribute("aria-label", `${typeLabels[state.type]}的收藏`);
  applyLayout();
  filter(state.category);
  stage.setAttribute("aria-busy", "false");
}

function filter(category) {
  state.category = category;
  const matches = category === "全部" ? state.items.length : state.items.filter((item) => item.categories.includes(category)).length;
  stage.querySelectorAll(".media-object").forEach((object) => {
    const visible = category === "全部" || object.dataset.categories.split("|").includes(category);
    object.classList.toggle("is-dimmed", !visible);
    object.setAttribute("aria-hidden", String(!visible));
    object.tabIndex = visible ? 0 : -1;
  });
  document.querySelectorAll(".filter-pill").forEach((pill) => {
    const active = pill.dataset.category === category;
    pill.classList.toggle("is-active", active);
    pill.setAttribute("aria-pressed", String(active));
  });
  document.querySelector('[data-action="filter"]').textContent = category === "全部" ? "筛选" : `${category} ${matches}`;
}

function renderFilters() {
  filterPanel.replaceChildren(...[["全部", state.items.length], ...categoryCounts(state.items)].map(([category, count]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-pill";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === "全部"));
    button.textContent = `${category} ${count}`;
    return button;
  }));
}

function closeTransientStates() {
  filterPanel.hidden = true;
  document.querySelector('[data-action="filter"]').setAttribute("aria-expanded", "false");
  if (state.picking) startPicking(false);
  closeDetails(false);
  document.querySelector("#poster-dialog")?.close();
}

function showFilters() {
  if (state.picking) startPicking(false);
  filterPanel.hidden = !filterPanel.hidden;
  document.querySelector('[data-action="filter"]').setAttribute("aria-expanded", String(!filterPanel.hidden));
}

function clearSelection() {
  stage.querySelectorAll(".is-selected").forEach((object) => { object.classList.remove("is-selected"); object.setAttribute("aria-pressed", "false"); });
}

function startPicking(force) {
  state.picking = typeof force === "boolean" ? force : !state.picking;
  filterPanel.hidden = true;
  document.querySelector('[data-action="filter"]').setAttribute("aria-expanded", "false");
  state.picked = [];
  clearSelection();
  stage.querySelectorAll(".is-picked").forEach((object) => { object.classList.remove("is-picked"); object.setAttribute("aria-pressed", "false"); });
  document.body.classList.toggle("is-picking", state.picking);
  document.querySelector("#share-action").textContent = state.picking ? "取消" : "分享";
  document.querySelector("#pick-status").hidden = !state.picking;
  document.querySelector("#pick-status").firstChild.textContent = `选择五件${typeLabels[state.type]}藏品 `;
  updatePickStatus();
}

function updatePickStatus() {
  document.querySelector("#pick-count").textContent = state.picked.length;
  document.querySelector("#make-poster").disabled = state.picked.length !== 5;
}

function createPoster() {
  const items = state.picked.map((index) => ({ image: stage.querySelector(`[data-index="${index}"] img`) }));
  const canvas = createPosterCanvas(state.type, items);
  const url = canvas.toDataURL("image/png");
  document.querySelector("#poster-preview").src = url;
  document.querySelector("#poster-download").href = url;
  document.querySelector("#poster-dialog").showModal();
}

function showDetails(index, trigger) {
  const item = state.items[index];
  if (!item) return;
  filterPanel.hidden = true;
  document.querySelector('[data-action="filter"]').setAttribute("aria-expanded", "false");
  clearSelection();
  trigger.classList.add("is-selected");
  trigger.setAttribute("aria-pressed", "true");
  detailTrigger = trigger;
  document.querySelector("#detail-cover").src = item.cover;
  document.querySelector("#detail-cover").alt = item.title;
  document.querySelector("#detail-kind").textContent = typeLabels[item.type];
  document.querySelector("#detail-title").textContent = item.title;
  document.querySelector("#detail-meta").textContent = [item.creator, monthLabel(item), ...item.categories].filter(Boolean).join(" · ");
  detailDialog.showModal();
  detailDialog.querySelector(".dialog-close").focus();
}

function closeDetails(restoreFocus = true) {
  if (detailDialog?.open) detailDialog.close();
  clearSelection();
  if (restoreFocus && detailTrigger?.isConnected) detailTrigger.focus();
  detailTrigger = null;
}

function enableDrag(object, event) {
  if (state.picking || event.button !== 0) return;
  const start = { x: event.clientX, y: event.clientY, left: Number.parseFloat(object.style.getPropertyValue("--left")) || object.offsetLeft, top: Number.parseFloat(object.style.getPropertyValue("--top")) || object.offsetTop };
  let moved = false;
  let finished = false;
  const move = (next) => {
    const dx = next.clientX - start.x;
    const dy = next.clientY - start.y;
    moved ||= Math.hypot(dx, dy) > 6;
    if (!moved) return;
    object.style.setProperty("--left", `${start.left + dx}px`);
    object.style.setProperty("--top", `${start.top + dy}px`);
    state.dragging = true;
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    object.removeEventListener("pointermove", move);
    object.removeEventListener("pointerup", finish);
    object.removeEventListener("pointercancel", finish);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    object.releasePointerCapture?.(event.pointerId);
    object.classList.remove("is-dragging");
    setTimeout(() => { state.dragging = false; }, 0);
  };
  object.setPointerCapture(event.pointerId);
  object.classList.add("is-dragging");
  object.addEventListener("pointermove", move);
  object.addEventListener("pointerup", finish);
  object.addEventListener("pointercancel", finish);
  window.addEventListener("pointerup", finish, { once: true });
  window.addEventListener("pointercancel", finish, { once: true });
}

function renderType(type, push = false) {
  closeTransientStates();
  state.type = type;
  document.body.dataset.mediaType = type;
  state.category = "全部";
  state.mode = "scatter";
  state.seed += 1;
  state.items = state.all.filter((item) => item.type === type);
  if (push) history.pushState({ type }, "", pathForType(type));
  renderFilters();
  render();
}

async function load() {
  stage.setAttribute("aria-busy", "true");
  try {
    state.all = await loadMediaData();
    renderType(state.type);
  } catch (error) {
    setError(error instanceof Error ? error.message : "请检查数据文件后重试");
  }
}

controls.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.mode) { state.mode = button.dataset.mode; if (state.mode === "scatter") state.seed += 1; applyLayout(); }
  if (button.dataset.action === "shake") { state.mode = "scatter"; state.seed += 1; applyLayout(); }
  if (button.dataset.action === "filter") showFilters();
  if (button.dataset.action === "share") startPicking();
  if (button.dataset.action === "retry") load();
});
document.querySelector(".media-nav").addEventListener("click", (event) => {
  const link = event.target.closest("[data-type]");
  if (!link) return;
  event.preventDefault();
  const type = link.dataset.type;
  if (type && type !== state.type) renderType(type, true);
});
addEventListener("popstate", () => renderType(typeFromPath(location.pathname)));
stage.addEventListener("pointerdown", (event) => { const object = event.target.closest(".media-object"); if (object) enableDrag(object, event); });
stage.addEventListener("click", (event) => { if (event.target.closest('[data-action="retry"]')) load(); });
stage.addEventListener("click", (event) => {
  const object = event.target.closest(".media-object");
  if (!object) { closeDetails(false); return; }
  if (state.dragging) return;
  if (!state.picking) { showDetails(Number(object.dataset.index), object); return; }
  const index = Number(object.dataset.index); const position = state.picked.indexOf(index);
  if (position >= 0) state.picked.splice(position, 1); else if (state.picked.length < 5) state.picked.push(index);
  object.classList.toggle("is-picked", state.picked.includes(index)); object.setAttribute("aria-pressed", String(state.picked.includes(index))); updatePickStatus();
});
filterPanel.addEventListener("click", (event) => { const pill = event.target.closest("[data-category]"); if (pill) filter(pill.dataset.category); });
document.querySelector("#make-poster").addEventListener("click", createPoster);
document.querySelector("#copy-link").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try { await navigator.clipboard.writeText(location.href); button.textContent = "已复制"; } catch { button.textContent = "复制失败"; }
  setTimeout(() => { button.textContent = "复制本站链接"; }, 1600);
});
document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => {
  if (button.closest("dialog") === detailDialog) closeDetails();
  else button.closest("dialog").close();
}));
detailDialog.addEventListener("click", (event) => { if (event.target === detailDialog) closeDetails(); });
detailDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDetails(); });
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (filterPanel.hidden === false) showFilters();
  else if (state.picking) startPicking(false);
  else if (detailDialog.open) closeDetails();
  else document.querySelector("#poster-dialog")?.close();
});
let resizeFrame = 0;
addEventListener("resize", () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(applyLayout); });
load();
