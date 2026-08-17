export function hashString(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function dimensions(width, type = "book") {
  const ratio = type === "music" ? 1 : 2 / 3;
  if (width < 640) {
    const columns = type === "music" ? 5 : type === "book" ? 4 : 3;
    return { columns, cell: width / columns, cover: type === "film" ? [102, 132] : type === "music" ? [88, 112] : [88, 118], row: type === "film" ? 172 : type === "music" ? 105 : 112, ratio };
  }
  if (width < 1024) {
    const columns = type === "film" ? 4 : type === "music" ? 7 : 6;
    return { columns, cell: width / columns, cover: type === "film" ? [108, 148] : type === "music" ? [96, 132] : [92, 138], row: type === "film" ? 176 : type === "music" ? 125 : 140, ratio };
  }
  const columns = type === "film" ? 5 : type === "music" ? 12 : 10;
  return { columns, cell: width / columns, cover: type === "film" ? [130, 178] : type === "music" ? [122, 154] : [110, 155], row: type === "film" ? 212 : type === "music" ? 130 : 158, ratio };
}

export function createScatterLayout(items, viewport, seed = 0, type = "book") {
  const { columns, cell, cover, row } = dimensions(viewport.width, type);
  return items.map((item, index) => {
    const random = randomFrom(hashString(`${item.id ?? item.title}|${seed}`));
    const width = Math.min(cover[1], Math.max(cover[0], cell * (0.86 + random() * 0.34)));
    const column = index % columns;
    const center = column * cell + cell / 2;
    const left = Math.max(16, Math.min(viewport.width - width - 16, center - width / 2 + (random() - 0.5) * cell * 0.68));
    return {
      left,
      top: 90 + Math.floor(index / columns) * row + random() * Math.min(54, row * 0.35),
      width,
      rotation: -20 + random() * 40,
      layer: 1 + Math.floor(random() * 500),
      scale: 1,
      ratio: dimensions(viewport.width, type).ratio,
    };
  });
}

export function createTidyLayout(items, viewport, type = "book") {
  const width = type === "film" ? 92 : type === "music" ? 88 : 80;
  const gap = 12;
  const columns = Math.max(3, Math.floor((viewport.width - 32) / (width + gap)));
  const used = columns * width + (columns - 1) * gap;
  const start = Math.max(16, (viewport.width - used) / 2);
  return items.map((_, index) => ({
    left: start + (index % columns) * (width + gap),
    top: 90 + Math.floor(index / columns) * (type === "film" ? 156 : type === "music" ? 116 : 132),
    width,
    rotation: 0,
    layer: index + 1,
    scale: 1,
    ratio: type === "music" ? 1 : 2 / 3,
  }));
}

export function createVortexLayout(items, viewport, type = "book") {
  const centerX = viewport.width / 2;
  const centerY = Math.max(260, (viewport.height ?? 700) / 2);
  return items.map((_, index) => {
    const angle = index * 0.72;
    const radius = Math.min(85, index * 0.7);
    return {
      left: centerX - 40 + Math.cos(angle) * radius,
      top: centerY - 60 + Math.sin(angle) * radius,
      width: 80,
      rotation: index * 7,
      layer: items.length - index,
      scale: 0.3,
      ratio: type === "music" ? 1 : 2 / 3,
    };
  });
}

function placementBottom(placement) {
  return placement.top + placement.width / placement.ratio;
}

export function placementIntersectsViewportMargin(placement, viewport, marginRatio = 0.5) {
  const viewportTop = viewport.top ?? 0;
  const margin = viewport.height * marginRatio;
  return placementBottom(placement) >= viewportTop - margin
    && placement.top <= viewportTop + viewport.height + margin;
}

export function viewportPriorityIndexes(placements, viewport) {
  const viewportTop = viewport.top ?? 0;
  const viewportBottom = viewportTop + viewport.height;
  const viewportCenter = viewportTop + viewport.height / 2;
  return placements
    .map((placement, index) => ({
      index,
      distance: Math.abs((placement.top + placementBottom(placement)) / 2 - viewportCenter),
      intersects: placementBottom(placement) >= viewportTop && placement.top <= viewportBottom,
    }))
    .filter(({ intersects }) => intersects)
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .slice(0, 12)
    .map(({ index }) => index);
}

export function topVortexLayerIndexes(placements) {
  return placements
    .map((placement, index) => ({ index, layer: placement.layer }))
    .sort((left, right) => right.layer - left.layer || left.index - right.index)
    .slice(0, 36)
    .map(({ index }) => index);
}

// 高度必须从摆好的坐标反推，不能照着列数行高再推一遍：那样等于把同一套几何写两份，
// 一旦某个布局改了行高就会和舞台高度悄悄错开，页脚横线直接压穿封面。
// 封面高度取 width / ratio，与 shelf.css 的 aspect-ratio:var(--ratio) 一致。
export function stageHeightFor(placements, mode) {
  if (mode === "vortex") return Math.max(globalThis.innerHeight ?? 700, 700);
  const bottom = placements.reduce((lowest, place) => Math.max(lowest, place.top + place.width / place.ratio), 0);
  // 散落模式的封面带旋转，视觉外框比 top+height 更低，留够余量。
  return Math.max(700, bottom + (mode === "tidy" ? 80 : 128));
}
