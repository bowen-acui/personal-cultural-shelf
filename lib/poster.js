const POSTER = { width: 1200, height: 1200, margin: 80, slotWidth: 280, slotHeight: 420 };

export function coverRatio(type) {
  return type === "music" ? 1 : 2 / 3;
}

export function drawCover(context, image, slot, type) {
  const ratio = coverRatio(type);
  const slotRatio = slot.width / slot.height;
  const sourceRatio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : ratio;
  const crop = sourceRatio > slotRatio ? { width: image.naturalHeight * slotRatio, height: image.naturalHeight } : { width: image.naturalWidth, height: image.naturalWidth / slotRatio };
  const sourceX = (image.naturalWidth - crop.width) / 2;
  const sourceY = (image.naturalHeight - crop.height) / 2;
  const height = type === "music" ? slot.width : slot.height;
  const y = slot.y + (slot.height - height) / 2;
  context.drawImage(image, sourceX, sourceY, crop.width, crop.height, slot.x, y, slot.width, height);
}

export function posterSlot(position) {
  return { x: POSTER.margin + (position % 3) * 360, y: 190 + Math.floor(position / 3) * 480, width: POSTER.slotWidth, height: POSTER.slotHeight };
}

export function createPosterCanvas(type, items, title = "阿崔的精神地图") {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER.width;
  canvas.height = POSTER.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建海报画布");
  context.fillStyle = "#e8e2d8";
  context.fillRect(0, 0, POSTER.width, POSTER.height);
  context.fillStyle = "#1a1a1a";
  context.font = "italic 72px Georgia";
  context.fillText(`${title} · ${type === "book" ? "书" : type === "film" ? "影" : "音"}`, POSTER.margin, 120);
  items.forEach((item, index) => drawCover(context, item.image, posterSlot(index), type));
  return canvas;
}
