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
    const columns = type === "music" ? 3 : 3;
    return { columns, cell: width / columns, cover: type === "film" ? [102, 132] : type === "music" ? [92, 116] : [88, 120], row: type === "film" ? 172 : type === "music" ? 132 : 144, ratio };
  }
  if (width < 1024) {
    const columns = type === "film" ? 4 : type === "music" ? 5 : 6;
    return { columns, cell: width / columns, cover: type === "film" ? [108, 148] : type === "music" ? [96, 132] : [92, 138], row: type === "film" ? 176 : type === "music" ? 148 : 140, ratio };
  }
  const columns = type === "film" ? 5 : type === "music" ? 8 : 10;
  return { columns, cell: width / columns, cover: type === "film" ? [130, 178] : type === "music" ? [122, 154] : [110, 155], row: type === "film" ? 212 : type === "music" ? 178 : 158, ratio };
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

export function stageHeightFor(count, width, mode, type = "book") {
  if (mode === "vortex") return Math.max(globalThis.innerHeight ?? 700, 700);
  const { columns, row } = dimensions(width, type);
  const tidyWidth = type === "film" ? 104 : type === "music" ? 100 : 92;
  const effectiveColumns = mode === "tidy" ? Math.max(3, Math.floor((width - 32) / tidyWidth)) : columns;
  const coverHeight = type === "music" ? 154 : type === "film" ? 178 : 155;
  const bottomSafety = mode === "tidy" ? 80 : 128;
  return Math.max(700, 90 + Math.ceil(count / effectiveColumns) * row + coverHeight + bottomSafety);
}
