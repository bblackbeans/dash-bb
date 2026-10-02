import { CANVAS_WIDTH } from "./dashboard-theme";
import {
  parseWidgetConfig,
  resolveColSpan,
  type WidgetFrame,
} from "./widget-config";

const PAD = 24;
const GAP = 16;

export function snap(value: number): number {
  return Math.round(value / 8) * 8;
}

export function sizeFor(type: string, span: 1 | 2 | 4): { w: number; h: number } {
  const inner = CANVAS_WIDTH - PAD * 2;
  const col = (inner - GAP * 3) / 4;
  const w = span * col + (span - 1) * GAP;
  const h =
    type === "kpi" || type === "rate"
      ? 148
      : type === "text"
        ? 96
        : type === "image"
          ? 220
          : type === "table"
            ? 360
            : 320;
  return { w: Math.round(w), h };
}

type FrameWidget = {
  id: string;
  type: string;
  configJson: string;
  sortOrder: number;
};

export function ensureFrames<T extends FrameWidget>(widgets: T[]): T[] {
  const sorted = [...widgets].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted.every((widget) => parseWidgetConfig(widget.configJson).frame)) {
    return widgets;
  }

  let x = PAD;
  let y = PAD;
  let rowH = 0;
  const placed = new Map<string, T>();

  for (const widget of sorted) {
    const config = parseWidgetConfig(widget.configJson);
    if (config.frame) {
      placed.set(widget.id, widget);
      y = Math.max(y, config.frame.y + config.frame.h + GAP);
      continue;
    }
    const size = sizeFor(widget.type, resolveColSpan(widget.type, config));
    if (x + size.w > CANVAS_WIDTH - PAD) {
      x = PAD;
      y += rowH + GAP;
      rowH = 0;
    }
    const frame: WidgetFrame = { x: snap(x), y: snap(y), w: snap(size.w), h: size.h };
    placed.set(widget.id, {
      ...widget,
      configJson: JSON.stringify({ ...config, frame }),
    });
    x += size.w + GAP;
    rowH = Math.max(rowH, size.h);
  }

  return widgets.map((widget) => placed.get(widget.id) || widget);
}

export function artboardHeight(
  widgets: { configJson: string }[],
  min = 640
): number {
  let height = min;
  for (const widget of widgets) {
    const frame = parseWidgetConfig(widget.configJson).frame;
    if (!frame) continue;
    height = Math.max(height, frame.y + frame.h + PAD);
  }
  return height;
}
