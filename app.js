import { categoryCounts, toggleCategory } from "./lib/catalog.js?v=15";
import { loadMediaData } from "./lib/media-data.js?v=15";
import { createPosterCanvas } from "./lib/poster.js?v=15";
import { pathForType, typeFromPath } from "./lib/routes.js?v=15";
import { createScatterLayout, createTidyLayout, createVortexLayout, stageHeightFor } from "./lib/layouts.js?v=15";

const typeLabels = { book: "书", film: "影", music: "音" };
const pageMeta = {
  book: { title: "阿崔的精神地图", description: "阿崔的精神地图：读过的书、看过的电影、听过的音乐。" },
  film: { title: "影 · 阿崔的精神地图", description: "阿崔看过的电影。" },
  music: { title: "音 · 阿崔的精神地图", description: "阿崔听过的音乐。" },
};
// 三种排布是互斥的，移动端塞不下三个并列按钮：合成一个循环键，按钮文字就是当前排布。
const layoutModes = ["scatter", "tidy", "vortex"];
const layoutLabels = { scatter: "散落", tidy: "整理", vortex: "漩涡" };
const state = { type: document.body.dataset.mediaType || typeFromPath(location.pathname), all: [], items: [], mode: "scatter", seed: 0, category: "全部", picking: false, picked: [], dragging: false, savedScroll: 0 };
const stage = document.querySelector("#shelf-stage");
const controls = document.querySelector("#shelf-controls");
const filterPanel = document.querySelector("#filter-panel");
const workDialog = document.querySelector("#work-dialog");
const workFlip = document.querySelector("#work-flip");
const filterAction = document.querySelector('[data-action="filter"]');
const layoutAction = document.querySelector('[data-action="layout"]');
const shareAction = document.querySelector('[data-action="share"]');
let transientTrigger = null;
let posterUrl = null;
const PRIORITY_IMAGE_COUNT = 30;

function label(item) { return [item.title, item.creator].filter(Boolean).join("，"); }
function monthLabel(item) { return item.type === "book" && item.completedMonth ? `完读日期：${item.completedMonth.replace("-", "年")}月` : ""; }

function placementFor(items) {
  const viewport = { width: document.documentElement.clientWidth, height: innerHeight };
  if (state.mode === "tidy") return createTidyLayout(items, viewport, state.type);
  if (state.mode === "vortex") return createVortexLayout(items, viewport, state.type);
  return createScatterLayout(items, viewport, state.seed, state.type);
}

function applyLayout() {
  const objects = [...stage.querySelectorAll(".media-object")];
  const visible = objects.filter((object) => !object.classList.contains("is-dimmed"));
  const layout = placementFor(visible.map((object) => state.items[Number(object.dataset.index)]));
  visible.forEach((object, index) => {
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
  stage.style.height = `${stageHeightFor(layout, state.mode)}px`;
  layoutAction.textContent = layoutLabels[state.mode];
  layoutAction.setAttribute("aria-label", `当前排布：${layoutLabels[state.mode]}，点击换下一种`);
}

function rememberTrigger(element) {
  transientTrigger = element instanceof HTMLElement ? element : null;
}

function restoreTrigger() {
  const trigger = transientTrigger;
  transientTrigger = null;
  if (trigger?.isConnected) trigger.focus();
}

// 同一时刻只能有一个元素叫 work-card，所以名字在回调里交接：开的时候从封面交给详情卡，关的时候交还。
// 名字必须在 startViewTransition 之前挂好——旧状态是同步截取的。
let morphSource = null;
const canMorph = () => typeof document.startViewTransition === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
const dropMorphName = (element) => { if (element) element.style.viewTransitionName = ""; };

function morphOpen(source) {
  dropMorphName(morphSource);
  morphSource = source?.isConnected ? source : null;
  if (!canMorph() || !morphSource) { workDialog.showModal(); return; }
  morphSource.style.viewTransitionName = "work-card";
  const from = morphSource;
  document.startViewTransition(() => {
    dropMorphName(from);
    workDialog.showModal();
  }).finished.catch(() => dropMorphName(from));
}

function morphClose() {
  const back = morphSource;
  morphSource = null;
  if (!canMorph() || !back?.isConnected || !workDialog.open) { workDialog.close(); return; }
  const transition = document.startViewTransition(() => {
    workDialog.close();
    back.style.viewTransitionName = "work-card";
  });
  transition.finished.then(() => dropMorphName(back), () => dropMorphName(back));
}

function createObject(item, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-object";
  button.dataset.index = index;
  button.dataset.categories = item.categories.join("|");
  button.setAttribute("aria-label", label(item));
  const image = document.createElement("img");
  image.src = item.cover;
  if (item.coverLarge) image.srcset = `${item.cover} 320w, ${item.coverLarge} 720w`;
  image.sizes = state.type === "music" ? "(max-width: 639px) 20vw, 8vw" : "(max-width: 639px) 25vw, 10vw";
  image.alt = label(item);
  image.width = 320;
  image.height = state.type === "music" ? 320 : 480;
  image.decoding = "async";
  image.fetchPriority = index < PRIORITY_IMAGE_COUNT ? "high" : "auto";
  if (index >= PRIORITY_IMAGE_COUNT) image.loading = "lazy";
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

function setFlipped(flipped) {
  workFlip.classList.toggle("is-flipped", flipped);
  workFlip.setAttribute("aria-pressed", String(flipped));
  workFlip.setAttribute("aria-label", flipped ? `${workFlip.dataset.detailLabel}。翻回作品封面` : "翻转查看作品信息");
}

function openWork(item, source) {
  filterPanel.hidden = true;
  filterAction.setAttribute("aria-expanded", "false");
  document.querySelector("#poster-dialog")?.close();
  workFlip.dataset.titleLength = item.title.length > 42 ? "long" : "short";
  workFlip.style.setProperty("--detail-ratio", item.type === "music" ? "1" : "2 / 3");
  const cover = document.querySelector("#work-cover");
  cover.src = item.coverLarge || item.cover;
  if (item.coverLarge) cover.srcset = `${item.cover} 320w, ${item.coverLarge} 720w`;
  cover.sizes = "(max-width: 639px) 72vw, 360px";
  cover.alt = label(item);
  document.querySelector("#work-type").textContent = typeLabels[item.type];
  document.querySelector("#work-title").textContent = item.title;
  document.querySelector("#work-creator").textContent = item.creator ?? "";
  document.querySelector("#work-meta").textContent = [monthLabel(item), ...(item.categories ?? [])].filter(Boolean).join(" · ");
  const score = item.type === "book" ? Math.max(0, Math.min(5, Number(item.rating) || 0)) : 0;
  let rating = document.querySelector("#work-rating");
  if (!rating) {
    rating = document.createElement("span");
    rating.id = "work-rating";
    rating.className = "work-rating";
    document.querySelector(".work-back").insertBefore(rating, document.querySelector(".work-back em"));
  }
  rating.hidden = item.type !== "book";
  rating.setAttribute("aria-label", score ? `个人评分 ${score} / 5` : "尚未录入个人评分");
  rating.replaceChildren(...Array.from({ length: 5 }, (_, index) => {
    const dot = document.createElement("i");
    dot.className = index < score ? "is-filled" : "";
    return dot;
  }));
  const ratingLabel = item.type === "book"
    ? (score ? `个人评分 ${score} / 5` : "尚未录入个人评分")
    : "";
  workFlip.dataset.detailLabel = [item.title, item.creator, document.querySelector("#work-meta").textContent, ratingLabel].filter(Boolean).join("，");
  // 触屏没有 hover，封面上的信息条永远不显示：点开只看到刚点的那张封面等于零信息，
  // 所以无 hover 设备直接开在信息面，想看大图再翻回去。
  setFlipped(matchMedia("(hover: none)").matches);
  morphOpen(source);
}

function setError(message) {
  stage.replaceChildren();
  stage.classList.add("shelf-state");
  const stateMessage = document.createElement("div");
  stateMessage.className = "shelf-error";
  const title = document.createElement("strong");
  const detail = document.createElement("span");
  const retry = document.createElement("button");
  title.textContent = "暂时无法打开这张精神地图";
  detail.textContent = message;
  retry.type = "button";
  retry.dataset.action = "retry";
  retry.textContent = "重新读取";
  stateMessage.append(title, detail, retry);
  stage.append(stateMessage);
  stage.setAttribute("aria-busy", "false");
}

function render() {
  stage.classList.remove("shelf-state");
  stage.replaceChildren(...state.items.map(createObject));
  document.querySelector("#item-count").textContent = state.items.length;
  document.querySelector("#item-kind").textContent = typeLabels[state.type];
  const meta = pageMeta[state.type];
  document.title = meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
  document.querySelector(".media-nav [aria-current]")?.removeAttribute("aria-current");
  document.querySelector(`.media-nav [data-type="${state.type}"]`)?.setAttribute("aria-current", "page");
  stage.setAttribute("aria-label", `${typeLabels[state.type]}的收藏`);
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
  applyLayout();
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
  filterAction.setAttribute("aria-expanded", "false");
  if (state.picking) startPicking(false);
  workDialog?.close();
  document.querySelector("#poster-dialog")?.close();
  restoreTrigger();
}

function showFilters() {
  if (state.picking) startPicking(false);
  const opening = filterPanel.hidden;
  if (opening) rememberTrigger(filterAction);
  filterPanel.hidden = !opening;
  filterAction.setAttribute("aria-expanded", String(opening));
  if (opening) requestAnimationFrame(() => filterPanel.querySelector(".filter-pill")?.focus());
  else restoreTrigger();
}

function startPicking(force) {
  state.picking = typeof force === "boolean" ? force : !state.picking;
  filterPanel.hidden = true;
  filterAction.setAttribute("aria-expanded", "false");
  if (state.picking) rememberTrigger(shareAction);
  state.picked = [];
  workDialog?.close();
  stage.querySelectorAll(".media-object").forEach((object) => {
    object.classList.remove("is-picked");
    if (state.picking) object.setAttribute("aria-pressed", "false");
    else object.removeAttribute("aria-pressed");
  });
  document.body.classList.toggle("is-picking", state.picking);
  document.querySelector("#share-action").textContent = state.picking ? "取消" : "分享";
  document.querySelector("#pick-status").hidden = !state.picking;
  document.querySelector("#pick-status .pick-label").firstChild.textContent = `选择五件${typeLabels[state.type]}藏品 `;
  updatePickStatus();
  if (state.picking) requestAnimationFrame(() => stage.querySelector('.media-object:not([aria-hidden="true"])')?.focus());
  else restoreTrigger();
}

function updatePickStatus() {
  document.querySelector("#pick-count").textContent = state.picked.length;
  document.querySelector("#make-poster").disabled = state.picked.length !== 5;
}

async function createPoster() {
  const items = state.picked.map((index) => ({ image: stage.querySelector(`[data-index="${index}"] img`) }));
  // 字体是 font-display:swap 懒加载的，canvas 不会等它：不先 load 就会画成回退字形。
  // 声明必须和 poster.js 里的 context.font 一致，否则匹配不上。
  await document.fonts.load('72px "LXGW WenKai"');
  const canvas = createPosterCanvas(state.type, items);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (posterUrl) URL.revokeObjectURL(posterUrl);
  posterUrl = URL.createObjectURL(blob);
  startPicking(false);
  document.querySelector("#poster-preview").src = posterUrl;
  document.querySelector("#poster-download").href = posterUrl;
  const share = document.querySelector("#poster-share");
  const file = new File([blob], "acui-spiritual-map.png", { type: "image/png" });
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  share.hidden = !canShare;
  share.onclick = () => navigator.share({ files: [file] }).catch(() => {});
  document.querySelector("#poster-dialog").showModal();
}

function enableDrag(object, event) {
  if (state.picking || event.pointerType === "touch" || event.button !== 0) return;
  const start = { x: event.clientX, y: event.clientY, left: Number.parseFloat(object.style.getPropertyValue("--left")) || object.offsetLeft, top: Number.parseFloat(object.style.getPropertyValue("--top")) || object.offsetTop };
  let moved = false;
  let finished = false;
  const move = (next) => {
    const dx = next.clientX - start.x;
    const dy = next.clientY - start.y;
    moved ||= Math.hypot(dx, dy) > 6;
    if (!moved) return;
    const maxLeft = Math.max(stage.clientWidth - object.offsetWidth, 0);
    const maxTop = Math.max(stage.clientHeight - object.offsetHeight, 0);
    object.style.setProperty("--left", `${Math.min(Math.max(start.left + dx, 0), maxLeft)}px`);
    object.style.setProperty("--top", `${Math.min(Math.max(start.top + dy, 0), maxTop)}px`);
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
  if (button.dataset.action === "layout") {
    const previous = state.mode;
    const next = layoutModes[(layoutModes.indexOf(previous) + 1) % layoutModes.length];
    if (next === "vortex") state.savedScroll = scrollY;
    state.mode = next;
    if (next === "scatter") state.seed += 1;
    applyLayout();
    if (previous === "vortex") scrollTo({ top: state.savedScroll, behavior: "instant" });
  }
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
  if (!object || state.dragging) return;
  const index = Number(object.dataset.index); const position = state.picked.indexOf(index);
  if (!state.picking) { openWork(state.items[index], object); return; }
  if (position >= 0) state.picked.splice(position, 1); else if (state.picked.length < 5) state.picked.push(index);
  object.classList.toggle("is-picked", state.picked.includes(index)); object.setAttribute("aria-pressed", String(state.picked.includes(index))); updatePickStatus();
});
filterPanel.addEventListener("click", (event) => {
  const pill = event.target.closest("[data-category]");
  if (!pill) return;
  filter(toggleCategory(state.category, pill.dataset.category));
  filterPanel.hidden = true;
  filterAction.setAttribute("aria-expanded", "false");
  restoreTrigger();
});
document.querySelector("#make-poster").addEventListener("click", createPoster);
document.querySelector("#copy-link").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try { await navigator.clipboard.writeText(location.href); button.textContent = "已复制"; } catch { button.textContent = "复制失败"; }
  setTimeout(() => { button.textContent = "复制本站链接"; }, 1600);
});
document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => {
  button.closest("dialog").close();
}));
document.querySelectorAll(".work-close").forEach((button) => button.addEventListener("click", morphClose));
workFlip.addEventListener("click", () => setFlipped(!workFlip.classList.contains("is-flipped")));
workDialog.addEventListener("click", (event) => { if (event.target === workDialog) morphClose(); });
// Esc 走的是原生关闭，拦下来换成同一条收回动画。
workDialog.addEventListener("cancel", (event) => { event.preventDefault(); morphClose(); });
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (filterPanel.hidden === false) showFilters();
  else if (state.picking) startPicking(false);
  else if (document.querySelector("#poster-dialog")?.open) {
    document.querySelector("#poster-dialog").close();
    restoreTrigger();
  }
});
let resizeFrame = 0;
addEventListener("resize", () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(applyLayout); });
load();
