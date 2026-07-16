const POSTER = { width: 1200, height: 1200, margin: 80, slotWidth: 280, slotHeight: 420 };

export function coverRatio(type) {
  return type === "music" ? 1 : 2 / 3;
}

// 完整展示封面（contain）而非裁切填满（cover）。旧实现按 slot.width/slot.height 把源图
// 裁到刚好填满，凡是比槽位更宽的封面就被砍掉左右两边——库里 416/624 张比 2:3 宽，
// 音乐槽位还是正方形却拿 2:3 当基准，204/206 张方形封面被砍掉近 1/3。海报是封面墙，
// 宁可留白也不能切掉书名。这里等比缩放、框内居中，任何比例的源图都完整落进可视框。
export function coverPlacement(image, slot, type) {
  const boxWidth = slot.width;
  const boxHeight = type === "music" ? slot.width : slot.height;
  const boxX = slot.x;
  const boxY = slot.y + (slot.height - boxHeight) / 2;
  const sourceWidth = image.naturalWidth || boxWidth;
  const sourceHeight = image.naturalHeight || boxHeight;
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: boxX + (boxWidth - width) / 2, y: boxY + (boxHeight - height) / 2, width, height };
}

export function drawCover(context, image, slot, type) {
  const place = coverPlacement(image, slot, type);
  context.drawImage(image, place.x, place.y, place.width, place.height);
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
  // Georgia 没有中文字形，中文标题会掉进系统衬线回退；italic 对回退字体还会触发伪斜。
  // 调用方需先 await document.fonts.load 同款声明，否则 canvas 拿不到尚未加载的 webfont。
  context.font = '72px "LXGW WenKai", Georgia, serif';
  context.fillText(`${title} · ${type === "book" ? "书" : type === "film" ? "影" : "音"}`, POSTER.margin, 120);
  items.forEach((item, index) => drawCover(context, item.image, posterSlot(index), type));
  return canvas;
}
