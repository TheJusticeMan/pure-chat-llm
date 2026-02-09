import { ViewTransform, GRAPH_CONSTANTS } from './types';
import { PURE_CHAT_LLM_ICON_NAME } from '../../types';

/**
 *
 * @param path
 * @param isChat
 * @param depth
 */
export function getFileIconId(path: string, isChat?: boolean, depth?: number): string {
  const name = path.split('/').pop() || path;
  if (depth === 0) return 'folder';
  if (/\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image';
  if (isChat) return PURE_CHAT_LLM_ICON_NAME;
  if (name.endsWith('.md')) return 'file-text';
  return 'file';
}

/**
 *
 * @param screenX
 * @param screenY
 * @param transform
 */
export function screenToGraph(
  screenX: number,
  screenY: number,
  transform: ViewTransform,
): { x: number; y: number } {
  return {
    x: (screenX - transform.offsetX) / transform.scale,
    y: (screenY - transform.offsetY) / transform.scale,
  };
}

/**
 *
 * @param ctx
 * @param x
 * @param y
 * @param fromX
 * @param fromY
 * @param color
 */
export function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  color: string,
): void {
  const angle = Math.atan2(y - fromY, x - fromX);
  const { ARROW_SIZE } = GRAPH_CONSTANTS;
  const arrowAngle = Math.PI / 6;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - ARROW_SIZE * Math.cos(angle - arrowAngle),
    y - ARROW_SIZE * Math.sin(angle - arrowAngle),
  );
  ctx.lineTo(
    x - ARROW_SIZE * Math.cos(angle + arrowAngle),
    y - ARROW_SIZE * Math.sin(angle + arrowAngle),
  );
  ctx.closePath();
  ctx.fill();
}

/**
 *
 * @param ctx
 * @param text
 * @param maxWidth
 */
export function truncateLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let label = text;
  while (ctx.measureText(label + '...').width > maxWidth && label.length > 0) {
    label = label.slice(0, -1);
  }
  return label + '...';
}
