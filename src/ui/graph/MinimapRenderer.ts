import { GraphNode, ViewTransform, GRAPH_CONSTANTS, getStatusColor } from './types';

/**
 *
 */
export class MinimapRenderer {
  /**
   *
   * @param ctx
   */
  constructor(private ctx: CanvasRenderingContext2D) {}

  /**
   *
   * @param canvasWidth
   * @param canvasHeight
   * @param nodes
   * @param transform
   * @param showMinimap
   */
  public render(
    canvasWidth: number,
    canvasHeight: number,
    nodes: Map<string, GraphNode>,
    transform: ViewTransform,
    showMinimap: boolean,
  ): void {
    if (!showMinimap || nodes.size === 0) return;

    const {
      MINIMAP_SIZE,
      MINIMAP_PADDING,
      MINIMAP_SCALE_FACTOR,
      MINIMAP_NODE_RADIUS,
      MINIMAP_VIEWPORT_LINE_WIDTH,
    } = GRAPH_CONSTANTS;
    const x = canvasWidth - MINIMAP_SIZE.width - MINIMAP_PADDING;
    const y = MINIMAP_PADDING;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(x, y, MINIMAP_SIZE.width, MINIMAP_SIZE.height);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.strokeRect(x, y, MINIMAP_SIZE.width, MINIMAP_SIZE.height);

    // Calc bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    });

    const gw = maxX - minX + 100,
      gh = maxY - minY + 100;
    const scale =
      Math.min(MINIMAP_SIZE.width / gw, MINIMAP_SIZE.height / gh) * MINIMAP_SCALE_FACTOR;

    // Draw nodes
    nodes.forEach(n => {
      this.ctx.beginPath();
      this.ctx.arc(
        x + (n.x - minX + 50) * scale,
        y + (n.y - minY + 50) * scale,
        MINIMAP_NODE_RADIUS,
        0,
        Math.PI * 2,
      );
      this.ctx.fillStyle = getStatusColor(n.data.status);
      this.ctx.fill();
    });

    // Viewport
    const vw = (canvasWidth / transform.scale) * scale;
    const vh = (canvasHeight / transform.scale) * scale;
    const vx = x + (-transform.offsetX / transform.scale - minX + 50) * scale;
    const vy = y + (-transform.offsetY / transform.scale - minY + 50) * scale;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = MINIMAP_VIEWPORT_LINE_WIDTH;
    this.ctx.strokeRect(vx, vy, vw, vh);

    this.ctx.restore();
  }

  /**
   *
   * @param e
   * @param canvas
   * @param nodes
   * @param transform
   * @param onUpdate
   */
  public handleMinimapClick(
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    nodes: Map<string, GraphNode>,
    transform: ViewTransform,
    onUpdate: () => void,
  ): boolean {
    const { MINIMAP_SIZE, MINIMAP_PADDING, MINIMAP_SCALE_FACTOR } = GRAPH_CONSTANTS;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left,
      cy = e.clientY - rect.top;
    const x = canvas.width - MINIMAP_SIZE.width - MINIMAP_PADDING,
      y = MINIMAP_PADDING;

    if (cx < x || cx > x + MINIMAP_SIZE.width || cy < y || cy > y + MINIMAP_SIZE.height)
      return false;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    });

    const scale =
      Math.min(
        MINIMAP_SIZE.width / (maxX - minX + 100),
        MINIMAP_SIZE.height / (maxY - minY + 100),
      ) * MINIMAP_SCALE_FACTOR;
    const relX = (cx - x) / scale - 50 + minX;
    const relY = (cy - y) / scale - 50 + minY;

    transform.offsetX = canvas.width / 2 - relX * transform.scale;
    transform.offsetY = canvas.height / 2 - relY * transform.scale;
    onUpdate();
    return true;
  }
}
