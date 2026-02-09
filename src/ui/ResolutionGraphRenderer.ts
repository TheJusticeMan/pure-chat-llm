import { ResolutionNodeData, ResolutionStatus } from '../types';
import {
  GraphNode,
  GraphEdge,
  ViewTransform,
  GRAPH_CONSTANTS,
  getStatusColor,
} from './graph/types';
import { screenToGraph, drawArrowhead, truncateLabel } from './graph/utils';
import { IconLoader } from './graph/IconLoader';
import { InteractionManager } from './graph/InteractionManager';
import { TooltipManager } from './graph/TooltipManager';
import { MinimapRenderer } from './graph/MinimapRenderer';

/**
 *
 */
export class ResolutionGraphRenderer {
  private ctx: CanvasRenderingContext2D;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private iconLoader = new IconLoader();
  private interaction: InteractionManager;
  private tooltips: TooltipManager | null = null;
  private minimap: MinimapRenderer;
  private rafId: number | null = null;
  private animationTimestamps: Map<string, number> = new Map();
  private isAnimating = false;
  private hasRendered = false;
  private onRenderCallback: ((g: ResolutionGraphRenderer) => void) | null = null;
  public showMinimap = true;

  /**
   *
   * @param canvas
   * @param treeData
   */
  constructor(
    private canvas: HTMLCanvasElement,
    private treeData: Map<string, ResolutionNodeData>,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;
    this.minimap = new MinimapRenderer(this.ctx);
    this.interaction = new InteractionManager(
      canvas,
      this.transform,
      () => this.scheduleRender(),
      (x, y) => this.getNodeAtPosition(x, y),
      node => {
        this.layoutNodes();
        this.scheduleRender();
      },
    );

    this.buildGraph();
    this.layoutNodes();
    this.interaction.setup();
    void this.iconLoader.preload().then(() => this.scheduleRender());

    canvas.addEventListener('click', e => {
      this.minimap.handleMinimapClick(e, canvas, this.nodes, this.transform, () =>
        this.scheduleRender(),
      );
    });
  }

  /**
   *
   */
  private buildGraph() {
    this.nodes.clear();
    this.edges = [];
    for (const [path, data] of this.treeData) {
      this.nodes.set(path, { id: path, x: 0, y: 0, radius: GRAPH_CONSTANTS.NODE_RADIUS, data });
      data.children.forEach(child => this.edges.push({ from: path, to: child }));
    }
  }

  /**
   *
   */
  private layoutNodes() {
    const layers: Map<number, GraphNode[]> = new Map();
    this.nodes.forEach(n => {
      if (!layers.has(n.data.depth)) layers.set(n.data.depth, []);
      layers.get(n.data.depth)!.push(n);
    });

    const maxDepth = Math.max(...Array.from(layers.keys()), 0);
    const maxWidth = Math.max(...Array.from(layers.values()).map(l => l.length), 0);
    const w = Math.max(GRAPH_CONSTANTS.LAYOUT_WIDTH, maxWidth * 150);
    const h = Math.max(
      GRAPH_CONSTANTS.LAYOUT_HEIGHT,
      maxDepth * GRAPH_CONSTANTS.LAYOUT_MIN_VERTICAL_SPACING +
        GRAPH_CONSTANTS.LAYOUT_VERTICAL_PADDING,
    );
    const vSpace = maxDepth > 0 ? (h - GRAPH_CONSTANTS.LAYOUT_VERTICAL_PADDING) / maxDepth : 0;

    layers.forEach((nodes, depth) => {
      const y = 80 + depth * Math.max(vSpace, GRAPH_CONSTANTS.LAYOUT_MIN_VERTICAL_SPACING);
      const hSpace = w / (nodes.length + 1);
      nodes.forEach((n, i) => {
        n.x = hSpace * (i + 1);
        n.y = y;
      });
    });
  }

  /**
   *
   */
  public render() {
    const { width, height } = this.canvas;
    if (!this.hasRendered) {
      this.fitToView();
      this.hasRendered = true;
    }
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.save();
    this.ctx.setTransform(
      this.transform.scale,
      0,
      0,
      this.transform.scale,
      this.transform.offsetX,
      this.transform.offsetY,
    );

    // Edges
    this.edges.forEach(e => {
      const f = this.nodes.get(e.from),
        t = this.nodes.get(e.to);
      if (!f || !t) return;
      const cy = (f.y + t.y) / 2;
      const color = getStatusColor(f.data.status, 0.5);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = GRAPH_CONSTANTS.EDGE_LINE_WIDTH;
      this.ctx.beginPath();
      this.ctx.moveTo(f.x, f.y + f.radius);
      this.ctx.bezierCurveTo(f.x, cy, t.x, cy, t.x, t.y - t.radius);
      this.ctx.stroke();
      drawArrowhead(this.ctx, t.x, t.y - t.radius, t.x, cy, color);
    });

    // Nodes
    const now = Date.now();
    this.nodes.forEach(n => {
      const color = getStatusColor(n.data.status, 0.8);
      const iconSize = n.radius * GRAPH_CONSTANTS.ICON_SIZE_MULTIPLIER;
      const icon = this.iconLoader.get(this.iconLoader.getNodeIconId(n));

      if (icon && this.iconLoader.loadingState === 'loaded') {
        this.ctx.save();
        this.ctx.drawImage(icon, n.x - iconSize / 2, n.y - iconSize / 2, iconSize, iconSize);
        this.ctx.globalCompositeOperation = 'source-atop';
        this.ctx.fillStyle = color;
        this.ctx.fillRect(n.x - iconSize / 2, n.y - iconSize / 2, iconSize, iconSize);
        this.ctx.restore();

        if (n.data.isPendingChat) {
          this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
          this.ctx.lineWidth = GRAPH_CONSTANTS.PENDING_CHAT_GLOW_WIDTH;
          const p = GRAPH_CONSTANTS.PENDING_CHAT_GLOW_SIZE;
          this.ctx.strokeRect(
            n.x - iconSize / 2 - p,
            n.y - iconSize / 2 - p,
            iconSize + p * 2,
            iconSize + p * 2,
          );
        }

        if (n.data.status === 'resolving') {
          this.ctx.save();
          this.ctx.shadowBlur = GRAPH_CONSTANTS.RESOLVING_GLOW_BLUR;
          this.ctx.shadowColor = color;
          this.ctx.strokeStyle = getStatusColor(n.data.status, 1);
          this.ctx.lineWidth = GRAPH_CONSTANTS.RESOLVING_GLOW_WIDTH;
          this.ctx.strokeRect(n.x - iconSize / 2, n.y - iconSize / 2, iconSize, iconSize);
          this.ctx.restore();
        }

        const ts = this.animationTimestamps.get(n.id);
        if (ts) {
          const prog = (now - ts) / GRAPH_CONSTANTS.ANIMATION_DURATION_MS;
          const pulse =
            iconSize + GRAPH_CONSTANTS.PULSE_BASE_SIZE + prog * GRAPH_CONSTANTS.PULSE_MAX_GROWTH;
          this.ctx.strokeStyle = getStatusColor(n.data.status, 1 - prog);
          this.ctx.lineWidth = GRAPH_CONSTANTS.RESOLVING_GLOW_WIDTH;
          this.ctx.strokeRect(n.x - pulse / 2, n.y - pulse / 2, pulse, pulse);
        }
      } else {
        this.ctx.beginPath();
        this.ctx.arc(n.x, n.y, iconSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = getStatusColor(n.data.status, 1);
        this.ctx.lineWidth = GRAPH_CONSTANTS.EDGE_LINE_WIDTH;
        this.ctx.stroke();
      }

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.font = GRAPH_CONSTANTS.LABEL_FONT;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        truncateLabel(this.ctx, n.id.split('/').pop() || n.id, GRAPH_CONSTANTS.LABEL_MAX_WIDTH),
        n.x,
        n.y + iconSize / 2 + GRAPH_CONSTANTS.LABEL_OFFSET_Y,
      );
    });

    this.ctx.restore();
    this.onRenderCallback?.(this);
    this.minimap.render(width, height, this.nodes, this.transform, this.showMinimap);

    if (this.tooltips) {
      // Tooltips updated via event listener in setupTooltips
    }
  }

  /**
   *
   */
  public zoomIn() {
    this.interaction.zoom(1.2);
  }
  /**
   *
   */
  public zoomOut() {
    this.interaction.zoom(1 / 1.2);
  }
  /**
   *
   */
  public resetNodePositions() {
    this.layoutNodes();
    this.scheduleRender();
  }
  /**
   *
   */
  public setupKeyboardShortcuts() {
    /* InteractionManager handles this in setup() */
  }

  /**
   *
   * @param x
   * @param y
   */
  public getNodeAtScreenPosition(x: number, y: number): GraphNode | null {
    const pos = screenToGraph(x, y, this.transform);
    return this.getNodeAtPosition(pos.x, pos.y);
  }

  /**
   *
   */
  public scheduleRender() {
    if (this.rafId === null)
      this.rafId = requestAnimationFrame(() => {
        this.render();
        this.rafId = null;
      });
  }

  /**
   *
   * @param padding
   */
  public fitToView(padding = GRAPH_CONSTANTS.FIT_VIEW_PADDING) {
    if (this.nodes.size === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    });
    const gw = maxX - minX,
      gh = maxY - minY;
    const s = Math.min(
      (this.canvas.width - padding * 2) / gw,
      (this.canvas.height - padding * 2) / gh,
      1,
    );
    this.transform.scale = s;
    this.transform.offsetX = this.canvas.width / 2 - ((minX + maxX) / 2) * s;
    this.transform.offsetY = this.canvas.height / 2 - ((minY + maxY) / 2) * s;
  }

  /**
   *
   * @param x
   * @param y
   */
  public getNodeAtPosition(x: number, y: number): GraphNode | null {
    for (const n of this.nodes.values()) {
      if (
        Math.sqrt((x - n.x) ** 2 + (y - n.y) ** 2) <=
        (n.radius * GRAPH_CONSTANTS.ICON_SIZE_MULTIPLIER) / 2
      )
        return n;
    }
    return null;
  }

  /**
   *
   * @param nodeId
   * @param status
   */
  public onNodeStatusChange(nodeId: string, status: ResolutionStatus) {
    this.animationTimestamps.set(nodeId, Date.now());
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animate();
    }
  }

  /**
   *
   */
  private animate() {
    const now = Date.now();
    let active = false;
    this.animationTimestamps.forEach((ts, id) => {
      if (now - ts > GRAPH_CONSTANTS.ANIMATION_DURATION_MS) this.animationTimestamps.delete(id);
      else active = true;
    });
    if (active) {
      this.scheduleRender();
      requestAnimationFrame(() => this.animate());
    } else this.isAnimating = false;
  }

  /**
   *
   * @param container
   */
  public setupTooltips(container: HTMLElement) {
    this.tooltips = new TooltipManager(container);
    this.tooltips.setup();
    this.canvas.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect();
      const pos = screenToGraph(e.clientX - rect.left, e.clientY - rect.top, this.transform);
      this.tooltips?.update(this.getNodeAtPosition(pos.x, pos.y), e.clientX, e.clientY);
    });
  }

  /**
   *
   * @param cb
   */
  public onRender(cb: (g: ResolutionGraphRenderer) => void): this {
    this.onRenderCallback = cb;
    return this;
  }
  /**
   *
   */
  public getZoomLevel() {
    return Math.round(this.transform.scale * 100) + '%';
  }
  /**
   *
   */
  public resetView() {
    Object.assign(this.transform, { scale: 1, offsetX: 0, offsetY: 0 });
    this.scheduleRender();
  }
  /**
   *
   */
  public destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.interaction.destroy();
    this.tooltips?.destroy();
    this.iconLoader.destroy();
  }
}
