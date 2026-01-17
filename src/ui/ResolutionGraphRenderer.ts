import {
  ResolutionNodeData,
  ResolutionStatus,
  PURE_CHAT_LLM_ICON_SVG,
  PURE_CHAT_LLM_ICON_NAME,
} from '../types';
import { getIcon } from 'obsidian';

/**
 * Represents a node in the graph visualization
 */
interface GraphNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  data: ResolutionNodeData;
}

/**
 * Represents an edge in the graph visualization
 */
interface GraphEdge {
  from: string;
  to: string;
}

/**
 * Viewport transform state for zoom and pan
 */
interface ViewTransform {
  scale: number; // Zoom level (MIN_ZOOM - MAX_ZOOM)
  offsetX: number; // Pan offset X
  offsetY: number; // Pan offset Y
}

/**
 * Interaction state machine for better state management
 */
type InteractionState =
  | { type: 'idle' }
  | { type: 'panning'; startX: number; startY: number }
  | { type: 'dragging-node'; node: GraphNode; startTime: number }
  | { type: 'pinch-zooming'; initialDistance: number; initialScale: number };

/**
 * Icon loading state
 */
type IconLoadingState = 'loading' | 'loaded' | 'error';

/**
 * Canvas-based graph renderer for the Blue File Resolution tree.
 * Implements a layered/hierarchical layout algorithm to visualize the resolution DAG.
 */
export class ResolutionGraphRenderer {
  // Constants for magic numbers
  private static readonly ICON_SIZE_MULTIPLIER = 2.5;
  private static readonly PULSE_BASE_SIZE = 10;
  private static readonly PULSE_MAX_GROWTH = 20;
  private static readonly ARROW_SIZE = 10;
  private static readonly LAYOUT_VERTICAL_PADDING = 160;
  private static readonly LAYOUT_MIN_VERTICAL_SPACING = 120;
  private static readonly TAP_THRESHOLD_PX = 15;
  private static readonly TAP_MAX_DURATION_MS = 300;
  private static readonly MIN_ZOOM = 0.25;
  private static readonly MAX_ZOOM = 10;
  private static readonly ZOOM_INCREMENT = 1.2;
  private static readonly MINIMAP_SIZE = { width: 150, height: 150 };
  private static readonly MINIMAP_PADDING = 10;
  private static readonly ANIMATION_DURATION_MS = 1000;
  private static readonly NODE_RADIUS = 20;
  private static readonly EDGE_LINE_WIDTH = 2;
  private static readonly LAYOUT_WIDTH = 1000;
  private static readonly LAYOUT_HEIGHT = 800;
  private static readonly FIT_VIEW_PADDING = 50;
  private static readonly PENDING_CHAT_GLOW_SIZE = 5;
  private static readonly PENDING_CHAT_GLOW_WIDTH = 3;
  private static readonly RESOLVING_GLOW_BLUR = 20;
  private static readonly RESOLVING_GLOW_WIDTH = 3;
  private static readonly LABEL_FONT = '12px sans-serif';
  private static readonly LABEL_MAX_WIDTH = 150;
  private static readonly LABEL_OFFSET_Y = 20;
  private static readonly MINIMAP_SCALE_FACTOR = 0.9;
  private static readonly MINIMAP_NODE_RADIUS = 3;
  private static readonly MINIMAP_VIEWPORT_LINE_WIDTH = 2;

  private ctx: CanvasRenderingContext2D;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private canvas: HTMLCanvasElement;
  private treeData: Map<string, ResolutionNodeData>;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private interactionState: InteractionState = { type: 'idle' };
  private nodePositionOverrides: Map<string, { x: number; y: number }> = new Map();
  private animationTimestamps: Map<string, number> = new Map();
  private isAnimating: boolean = false;
  private tooltipElement: HTMLDivElement | null = null;
  private hoveredNode: GraphNode | null = null;
  public showMinimap: boolean = true;
  private minimapSize = ResolutionGraphRenderer.MINIMAP_SIZE;
  private hasRendered: boolean = false;
  private width: number = 0;
  private height: number = 0;
  private iconCache: Map<string, HTMLImageElement> = new Map();
  private iconLoadingState: IconLoadingState = 'loading';
  private touches: Map<number, { x: number; y: number; startTime: number }> = new Map();
  private rafId: number | null = null;
  private minimapClickHandlerAdded: boolean = false;

  // Event handler cleanup tracking
  private eventHandlers: Array<{
    element: HTMLElement | Document | Window;
    event: string;
    handler: EventListener;
    options?: AddEventListenerOptions | boolean;
  }> = [];

  constructor(canvas: HTMLCanvasElement, treeData: Map<string, ResolutionNodeData>) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.canvas = canvas;
    this.treeData = treeData;
    this.width = canvas.width;
    this.height = canvas.height;

    this.buildGraph();
    this.layoutNodes();
    this.setupInteractivity();
    this.setupTouchSupport();

    // Pre-load all icons asynchronously to avoid race conditions during render
    void this.preloadIcons();
  }

  /**
   * Cleanup method to remove all event listeners and free resources
   * Call this when the renderer is being destroyed to prevent memory leaks
   */
  public destroy(): void {
    // Cancel any pending animation frame
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Remove all tracked event listeners
    for (const { element, event, handler, options } of this.eventHandlers) {
      element.removeEventListener(event, handler, options);
    }
    this.eventHandlers = [];

    // Clear tooltip
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }

    // Revoke cached icon URLs to free memory
    for (const img of this.iconCache.values()) {
      if (img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
    }
    this.iconCache.clear();

    // Clear animation state
    this.isAnimating = false;
    this.animationTimestamps.clear();

    // Clear interaction state
    this.interactionState = { type: 'idle' };
    this.hoveredNode = null;

    // Clear touch data
    this.touches.clear();
  }

  /**
   * Helper method to add an event listener and track it for cleanup
   */
  private addEventListener(
    element: HTMLElement | Document | Window,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void {
    try {
      element.addEventListener(event, handler, options);
      this.eventHandlers.push({ element, event, handler, options });
    } catch (error) {
      console.error('Failed to add event listener:', error);
      // Don't add to tracking array if addEventListener failed
    }
  }

  /**
   * Builds the graph structure from the tree data
   */
  private buildGraph(): void {
    this.nodes.clear();
    this.edges = [];

    // Create nodes from tree data
    for (const [filePath, nodeData] of this.treeData) {
      this.nodes.set(filePath, {
        id: filePath,
        x: 0,
        y: 0,
        radius: ResolutionGraphRenderer.NODE_RADIUS,
        data: nodeData,
      });

      // Create edges from parent to children
      for (const childPath of nodeData.children) {
        this.edges.push({
          from: filePath,
          to: childPath,
        });
      }
    }
  }

  /**
   * Implements a layered/hierarchical layout algorithm.
   * Nodes are positioned based on their depth (vertical) and distributed horizontally within each layer.
   * Uses a fixed virtual layout space independent of canvas dimensions.
   */
  private layoutNodes(): void {
    // Use a fixed virtual layout space (aspect ratio independent of canvas)
    const layoutWidth = ResolutionGraphRenderer.LAYOUT_WIDTH;
    const layoutHeight = ResolutionGraphRenderer.LAYOUT_HEIGHT;

    // Group nodes by depth
    const layers: Map<number, GraphNode[]> = new Map();
    for (const node of this.nodes.values()) {
      const depth = node.data.depth;
      if (!layers.has(depth)) {
        layers.set(depth, []);
      }
      layers.get(depth)!.push(node);
    }

    // Calculate layout parameters
    const maxDepth = Math.max(...Array.from(layers.keys()));
    const verticalSpacing =
      maxDepth > 0
        ? (layoutHeight - ResolutionGraphRenderer.LAYOUT_VERTICAL_PADDING) / maxDepth
        : 0;

    // Position nodes
    for (const [depth, layerNodes] of layers) {
      const layerY =
        80 + depth * Math.max(verticalSpacing, ResolutionGraphRenderer.LAYOUT_MIN_VERTICAL_SPACING);
      const horizontalSpacing = layoutWidth / (layerNodes.length + 1);

      layerNodes.forEach((node, index) => {
        node.x = horizontalSpacing * (index + 1);
        node.y = layerY;
      });
    }

    // Apply manual position overrides after automatic layout
    this.nodePositionOverrides.forEach((pos, nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.x = pos.x;
        node.y = pos.y;
      }
    });
  }

  /**
   * Calculate bounds of all nodes in the graph
   */
  private calculateGraphBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of this.nodes.values()) {
      minX = Math.min(minX, node.x - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Fit the entire graph to view with padding
   */
  public fitToView(padding: number = ResolutionGraphRenderer.FIT_VIEW_PADDING): void {
    if (this.nodes.size === 0) return;

    const bounds = this.calculateGraphBounds();
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;

    // Calculate scale to fit graph in canvas with padding
    const scaleX = (this.width - padding * 2) / graphWidth;
    const scaleY = (this.height - padding * 2) / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

    // Center the graph
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    this.transform.scale = scale;
    this.transform.offsetX = this.width / 2 - centerX * scale;
    this.transform.offsetY = this.height / 2 - centerY * scale;
  }

  /**
   * Schedule a render using requestAnimationFrame to batch render calls
   */
  private scheduleRender(): void {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.render();
        this.rafId = null;
      });
    }
  }

  /**
   * Main render method - draws the entire graph
   */
  public render(): void {
    // Update canvas dimensions
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Only fit on first render or when explicitly called
    if (!this.hasRendered) {
      this.fitToView();
      this.hasRendered = true;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Save context and apply transform for main graph
    this.ctx.save();
    this.applyTransform();

    // Draw edges first (so they appear behind nodes)
    this.drawEdges();

    // Draw nodes on top
    this.drawNodes();

    // Restore context
    this.ctx.restore();

    // Draw minimap on top (uses its own transform)
    this.renderMinimap();
  }

  /**
   * Draws all edges with Bezier curves
   */
  private drawEdges(): void {
    for (const edge of this.edges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);

      if (!fromNode || !toNode) continue;

      // Calculate control points for Bezier curve
      const controlY = (fromNode.y + toNode.y) / 2;

      // Get edge color from source node status
      const edgeColor = this.getEdgeColor(fromNode.data.status);

      // Draw curve
      this.ctx.strokeStyle = edgeColor;
      this.ctx.lineWidth = ResolutionGraphRenderer.EDGE_LINE_WIDTH;
      this.ctx.beginPath();
      this.ctx.moveTo(fromNode.x, fromNode.y + fromNode.radius);
      this.ctx.bezierCurveTo(
        fromNode.x,
        controlY,
        toNode.x,
        controlY,
        toNode.x,
        toNode.y - toNode.radius,
      );
      this.ctx.stroke();

      // Draw arrowhead
      this.drawArrowhead(toNode.x, toNode.y - toNode.radius, toNode.x, controlY, edgeColor);
    }
  }

  /**
   * Draws all nodes with status-based colors and file type icons
   */
  private drawNodes(): void {
    const now = Date.now();

    for (const node of this.nodes.values()) {
      const nodeColor = this.getNodeColor(node.data.status);
      const fileName = node.id.split('/').pop() || node.id;

      // Draw icon or placeholder
      if (this.iconLoadingState === 'loaded') {
        // Icons are loaded - draw them
        const iconId = this.getNodeIcon(node);
        const icon = this.iconCache.get(iconId);

        if (icon) {
          // Calculate icon size (larger, no circle background)
          const iconSize = node.radius * ResolutionGraphRenderer.ICON_SIZE_MULTIPLIER;

          // Apply status-based color tint
          this.ctx.save();

          // Draw icon first
          this.ctx.drawImage(
            icon,
            node.x - iconSize / 2,
            node.y - iconSize / 2,
            iconSize,
            iconSize,
          );

          // Apply color overlay for status
          this.ctx.globalCompositeOperation = 'source-atop';
          this.ctx.fillStyle = nodeColor;
          this.ctx.fillRect(node.x - iconSize / 2, node.y - iconSize / 2, iconSize, iconSize);

          this.ctx.restore();

          // Draw glow for pending chats (around icon, not circle)
          if (node.data.isPendingChat) {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
            this.ctx.lineWidth = ResolutionGraphRenderer.PENDING_CHAT_GLOW_WIDTH;
            this.ctx.strokeRect(
              node.x - iconSize / 2 - ResolutionGraphRenderer.PENDING_CHAT_GLOW_SIZE,
              node.y - iconSize / 2 - ResolutionGraphRenderer.PENDING_CHAT_GLOW_SIZE,
              iconSize + ResolutionGraphRenderer.PENDING_CHAT_GLOW_SIZE * 2,
              iconSize + ResolutionGraphRenderer.PENDING_CHAT_GLOW_SIZE * 2,
            );
            this.ctx.restore();
          }

          // Add glow effect for resolving nodes
          if (node.data.status === 'resolving') {
            this.ctx.save();
            this.ctx.shadowBlur = ResolutionGraphRenderer.RESOLVING_GLOW_BLUR;
            this.ctx.shadowColor = nodeColor;
            this.ctx.strokeStyle = this.getNodeBorderColor(node.data.status);
            this.ctx.lineWidth = ResolutionGraphRenderer.RESOLVING_GLOW_WIDTH;
            this.ctx.strokeRect(node.x - iconSize / 2, node.y - iconSize / 2, iconSize, iconSize);
            this.ctx.shadowBlur = 0;
            this.ctx.restore();
          }

          // Animated glow for recently changed nodes
          const timestamp = this.animationTimestamps.get(node.id);
          if (timestamp) {
            const elapsed = now - timestamp;
            const progress = elapsed / ResolutionGraphRenderer.ANIMATION_DURATION_MS;
            const alpha = 1 - progress;
            const pulseSize =
              iconSize +
              ResolutionGraphRenderer.PULSE_BASE_SIZE +
              progress * ResolutionGraphRenderer.PULSE_MAX_GROWTH;

            this.ctx.save();
            this.ctx.strokeStyle = nodeColor.replace(/[\d.]+\)$/, `${alpha})`);
            this.ctx.lineWidth = ResolutionGraphRenderer.RESOLVING_GLOW_WIDTH;
            this.ctx.strokeRect(
              node.x - pulseSize / 2,
              node.y - pulseSize / 2,
              pulseSize,
              pulseSize,
            );
            this.ctx.restore();
          }
        } else {
          // Icon failed to load - draw placeholder circle
          this.drawPlaceholderNode(node, nodeColor);
        }
      } else if (this.iconLoadingState === 'loading') {
        // Still loading - draw placeholder
        this.drawPlaceholderNode(node, nodeColor);
      } else {
        // Error state - draw placeholder
        this.drawPlaceholderNode(node, nodeColor);
      }

      // Draw file name label below icon
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.font = ResolutionGraphRenderer.LABEL_FONT;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';

      // Truncate long file names
      const maxWidth = ResolutionGraphRenderer.LABEL_MAX_WIDTH;
      let displayName = fileName;
      const metrics = this.ctx.measureText(displayName);
      if (metrics.width > maxWidth) {
        while (
          this.ctx.measureText(displayName + '...').width > maxWidth &&
          displayName.length > 0
        ) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '...';
      }

      this.ctx.fillText(
        displayName,
        node.x,
        node.y +
          (node.radius * ResolutionGraphRenderer.ICON_SIZE_MULTIPLIER) / 2 +
          ResolutionGraphRenderer.LABEL_OFFSET_Y,
      );
    }
  }

  /**
   * Draw a placeholder circle when icons are loading or failed to load
   */
  private drawPlaceholderNode(node: GraphNode, nodeColor: string): void {
    const iconSize = node.radius * ResolutionGraphRenderer.ICON_SIZE_MULTIPLIER;

    // Draw circle as placeholder
    this.ctx.beginPath();
    this.ctx.arc(node.x, node.y, iconSize / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = nodeColor;
    this.ctx.fill();
    this.ctx.strokeStyle = this.getNodeBorderColor(node.data.status);
    this.ctx.lineWidth = ResolutionGraphRenderer.EDGE_LINE_WIDTH;
    this.ctx.stroke();

    // Draw loading indicator if still loading
    if (this.iconLoadingState === 'loading') {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.font = '10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('...', node.x, node.y);
    }
  }

  /**
   * Draws an arrowhead at the end of an edge
   */
  private drawArrowhead(x: number, y: number, fromX: number, fromY: number, color: string): void {
    const angle = Math.atan2(y - fromY, x - fromX);
    const arrowSize = ResolutionGraphRenderer.ARROW_SIZE;
    const arrowAngle = Math.PI / 6; // 30 degrees

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(
      x - arrowSize * Math.cos(angle - arrowAngle),
      y - arrowSize * Math.sin(angle - arrowAngle),
    );
    this.ctx.lineTo(
      x - arrowSize * Math.cos(angle + arrowAngle),
      y - arrowSize * Math.sin(angle + arrowAngle),
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Gets the node fill color based on status
   */
  private getNodeColor(status: ResolutionStatus): string {
    switch (status) {
      case 'idle':
        return 'rgba(255, 255, 255, 0.6)';
      case 'resolving':
        return 'rgba(192, 132, 252, 0.8)';
      case 'complete':
        return 'rgba(0, 255, 128, 0.7)';
      case 'error':
        return 'rgba(255, 64, 129, 0.7)';
      case 'cached':
        return 'rgba(100, 200, 255, 0.7)';
      case 'cycle-detected':
        return 'rgba(255, 170, 0, 0.7)';
      default:
        return 'rgba(255, 255, 255, 0.6)';
    }
  }

  /**
   * Gets the node border color based on status
   */
  private getNodeBorderColor(status: ResolutionStatus): string {
    switch (status) {
      case 'idle':
        return 'rgba(255, 255, 255, 0.4)';
      case 'resolving':
        return 'rgba(192, 132, 252, 1)';
      case 'complete':
        return 'rgba(0, 255, 128, 0.9)';
      case 'error':
        return 'rgba(255, 64, 129, 0.9)';
      case 'cached':
        return 'rgba(100, 200, 255, 0.9)';
      case 'cycle-detected':
        return 'rgba(255, 170, 0, 0.9)';
      default:
        return 'rgba(255, 255, 255, 0.4)';
    }
  }

  /**
   * Gets the edge color based on source node status
   */
  private getEdgeColor(status: ResolutionStatus): string {
    switch (status) {
      case 'idle':
        return 'rgba(255, 255, 255, 0.3)';
      case 'resolving':
        return 'rgba(192, 132, 252, 0.6)';
      case 'complete':
        return 'rgba(0, 255, 128, 0.5)';
      case 'error':
        return 'rgba(255, 64, 129, 0.5)';
      case 'cached':
        return 'rgba(100, 200, 255, 0.5)';
      case 'cycle-detected':
        return 'rgba(255, 170, 0, 0.5)';
      default:
        return 'rgba(255, 255, 255, 0.3)';
    }
  }

  /**
   * Pre-load all necessary icons to avoid async loading during render
   */
  private async preloadIcons(): Promise<void> {
    this.iconLoadingState = 'loading';

    // Pre-load all icon types we might use
    const iconTypes = ['folder', PURE_CHAT_LLM_ICON_NAME, 'file-text', 'image', 'file'];

    try {
      await Promise.all(iconTypes.map(iconId => this.loadIcon(iconId)));

      this.iconLoadingState = 'loaded';
    } catch (error) {
      console.error('Failed to load icons:', error);
      this.iconLoadingState = 'error';
    }

    // Trigger initial render after icons are loaded (or failed)
    this.render();
  }

  /**
   * Get the appropriate icon ID for a node based on its file type
   */
  private getNodeIcon(node: GraphNode): string {
    const fileName = node.id.split('/').pop() || node.id;

    // Root node (depth 0)
    if (node.data.depth === 0) {
      return 'folder';
    }

    // Image files
    if (/\.(png|jpe?g|gif|webp)$/i.test(fileName)) {
      return 'image';
    }

    // Chat files
    if (node.data.isChatFile) {
      return PURE_CHAT_LLM_ICON_NAME;
    }

    // Markdown files
    if (fileName.endsWith('.md')) {
      return 'file-text';
    }

    // Other files
    return 'file';
  }

  /**
   * Load an Obsidian icon and convert it to HTMLImageElement for canvas rendering
   */
  private async loadIcon(iconId: string): Promise<HTMLImageElement | null> {
    if (this.iconCache.has(iconId)) {
      return this.iconCache.get(iconId)!;
    }

    let svgElement: SVGSVGElement | null = null;

    // Handle pure-chat-llm icon specially since it's manually registered
    if (iconId === PURE_CHAT_LLM_ICON_NAME) {
      // Create SVG element from the SVG string in types.ts
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${PURE_CHAT_LLM_ICON_SVG}</svg>`,
        'image/svg+xml',
      );
      svgElement = svgDoc.documentElement as unknown as SVGSVGElement;
    } else {
      svgElement = getIcon(iconId);
    }

    if (!svgElement) {
      return null;
    }

    const svgString = svgElement.outerHTML;

    // Convert SVG to data URL for canvas rendering
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise(resolve => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        this.iconCache.set(iconId, img);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  /**
   * Gets the node at a specific position (for click detection)
   */
  public getNodeAtPosition(x: number, y: number): GraphNode | null {
    for (const node of this.nodes.values()) {
      const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
      if (distance <= node.radius) {
        return node;
      }
    }
    return null;
  }

  /**
   * Gets the node at a screen position (handles coordinate transformation)
   */
  public getNodeAtScreenPosition(screenX: number, screenY: number): GraphNode | null {
    const graphPos = this.screenToGraph(screenX, screenY);
    return this.getNodeAtPosition(graphPos.x, graphPos.y);
  }

  /**
   * Apply viewport transform to context
   */
  private applyTransform(): void {
    this.ctx.setTransform(
      this.transform.scale,
      0,
      0,
      this.transform.scale,
      this.transform.offsetX,
      this.transform.offsetY,
    );
  }

  /**
   * Convert screen coordinates to graph coordinates
   */
  private screenToGraph(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.transform.offsetX) / this.transform.scale,
      y: (screenY - this.transform.offsetY) / this.transform.scale,
    };
  }

  /**
   * Helper method to get mouse position in graph coordinates
   * Encapsulates rect calculation and coordinate transformation
   */
  private getMouseGraphPosition(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return this.screenToGraph(screenX, screenY);
  }

  /**
   * Setup interactive controls for zoom, pan, and node dragging
   */
  private setupInteractivity(): void {
    // Mouse wheel zoom (centered on cursor position)
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomDelta =
        e.deltaY < 0
          ? ResolutionGraphRenderer.ZOOM_INCREMENT
          : 1 / ResolutionGraphRenderer.ZOOM_INCREMENT;
      const newScale = Math.max(
        ResolutionGraphRenderer.MIN_ZOOM,
        Math.min(ResolutionGraphRenderer.MAX_ZOOM, this.transform.scale * zoomDelta),
      );

      // Show visual feedback when zoom limits are reached
      if (newScale === this.transform.scale) {
        // Hit zoom limit - could add visual feedback here
        return;
      }

      // Zoom towards cursor position
      this.transform.offsetX -=
        (mouseX - this.transform.offsetX) * (newScale / this.transform.scale - 1);
      this.transform.offsetY -=
        (mouseY - this.transform.offsetY) * (newScale / this.transform.scale - 1);
      this.transform.scale = newScale;

      this.scheduleRender();
    };
    this.addEventListener(this.canvas, 'wheel', wheelHandler as EventListener, { passive: false });

    // Mouse move for hover feedback
    const mouseMoveHandler = (e: MouseEvent) => {
      if (this.interactionState.type === 'panning') {
        // Pan the view
        this.transform.offsetX = e.clientX - this.interactionState.startX;
        this.transform.offsetY = e.clientY - this.interactionState.startY;
        this.scheduleRender();
      } else if (this.interactionState.type === 'dragging-node') {
        // Drag node
        const graphPos = this.getMouseGraphPosition(e);
        this.interactionState.node.x = graphPos.x;
        this.interactionState.node.y = graphPos.y;
        this.nodePositionOverrides.set(this.interactionState.node.id, {
          x: graphPos.x,
          y: graphPos.y,
        });
        this.scheduleRender();
      } else {
        // Check if hovering over a node for cursor feedback
        const graphPos = this.getMouseGraphPosition(e);
        const node = this.getNodeAtPosition(graphPos.x, graphPos.y);

        if (node) {
          this.canvas.classList.add('graph-node-hover');
        } else {
          this.canvas.classList.remove('graph-node-hover');
        }
      }
    };
    this.addEventListener(this.canvas, 'mousemove', mouseMoveHandler as EventListener);

    // Pan with Shift+drag or middle mouse button
    const mouseDownHandler = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // Middle click or Shift+Left click - Pan
        e.preventDefault();
        this.interactionState = {
          type: 'panning',
          startX: e.clientX - this.transform.offsetX,
          startY: e.clientY - this.transform.offsetY,
        };
        this.canvas.classList.add('graph-panning');
      } else if (e.button === 0 && !e.shiftKey) {
        // Left click without shift - Node dragging
        const graphPos = this.getMouseGraphPosition(e);
        const node = this.getNodeAtPosition(graphPos.x, graphPos.y);

        if (node) {
          this.interactionState = {
            type: 'dragging-node',
            node,
            startTime: Date.now(),
          };
          this.canvas.classList.add('graph-dragging');
          e.preventDefault();
        }
      }
    };
    this.addEventListener(this.canvas, 'mousedown', mouseDownHandler as EventListener);

    const mouseUpHandler = () => {
      if (this.interactionState.type === 'panning') {
        this.canvas.classList.remove('graph-panning');
      } else if (this.interactionState.type === 'dragging-node') {
        this.canvas.classList.remove('graph-dragging');
      }
      this.interactionState = { type: 'idle' };
    };
    this.addEventListener(this.canvas, 'mouseup', mouseUpHandler as EventListener);

    const mouseLeaveHandler = () => {
      this.canvas.classList.remove('graph-panning', 'graph-dragging', 'graph-node-hover');
      this.interactionState = { type: 'idle' };
    };
    this.addEventListener(this.canvas, 'mouseleave', mouseLeaveHandler as EventListener);

    // Double-click to reset node position
    const dblClickHandler = (e: MouseEvent) => {
      const graphPos = this.getMouseGraphPosition(e);
      const node = this.getNodeAtPosition(graphPos.x, graphPos.y);

      if (node) {
        // Remove manual override for this node
        this.nodePositionOverrides.delete(node.id);
        // Recalculate layout
        this.layoutNodes();
        this.scheduleRender();
        e.preventDefault();
      }
    };
    this.addEventListener(this.canvas, 'dblclick', dblClickHandler as EventListener);
  }

  /**
   * Setup touch support for mobile/tablet interaction
   */
  private setupTouchSupport(): void {
    const touchStartHandler = (e: TouchEvent) => {
      e.preventDefault();

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        this.touches.set(touch.identifier, {
          x: touch.clientX,
          y: touch.clientY,
          startTime: Date.now(),
        });
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const node = this.getNodeAtScreenPosition(
          touch.clientX - rect.left,
          touch.clientY - rect.top,
        );
        if (node) {
          this.interactionState = {
            type: 'dragging-node',
            node,
            startTime: Date.now(),
          };
        }
      }

      if (e.touches.length === 2) {
        const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
        this.interactionState = {
          type: 'pinch-zooming',
          initialDistance: distance,
          initialScale: this.transform.scale,
        };
      }
    };
    this.addEventListener(this.canvas, 'touchstart', touchStartHandler as EventListener, {
      passive: false,
    });

    const touchMoveHandler = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const prevTouch = this.touches.get(touch.identifier);

        if (prevTouch) {
          const deltaX = touch.clientX - prevTouch.x;
          const deltaY = touch.clientY - prevTouch.y;

          if (this.interactionState.type === 'dragging-node') {
            const rect = this.canvas.getBoundingClientRect();
            const graphPos = this.screenToGraph(
              touch.clientX - rect.left,
              touch.clientY - rect.top,
            );
            this.interactionState.node.x = graphPos.x;
            this.interactionState.node.y = graphPos.y;
            this.nodePositionOverrides.set(this.interactionState.node.id, graphPos);
          } else {
            this.transform.offsetX += deltaX;
            this.transform.offsetY += deltaY;
          }

          this.touches.set(touch.identifier, {
            x: touch.clientX,
            y: touch.clientY,
            startTime: prevTouch.startTime,
          });
          this.scheduleRender();
        }
      } else if (e.touches.length === 2 && this.interactionState.type === 'pinch-zooming') {
        const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
        const scale =
          (distance / this.interactionState.initialDistance) * this.interactionState.initialScale;
        this.transform.scale = Math.max(
          ResolutionGraphRenderer.MIN_ZOOM,
          Math.min(ResolutionGraphRenderer.MAX_ZOOM, scale),
        );
        this.scheduleRender();
      }
    };
    this.addEventListener(this.canvas, 'touchmove', touchMoveHandler as EventListener, {
      passive: false,
    });

    const touchEndHandler = (e: TouchEvent) => {
      e.preventDefault();

      // Check if this was a tap (not a drag) with improved detection
      if (
        e.changedTouches.length === 1 &&
        this.interactionState.type !== 'pinch-zooming' &&
        this.touches.size === 1
      ) {
        const touch = e.changedTouches[0];
        const prevTouch = this.touches.get(touch.identifier);

        if (prevTouch) {
          const deltaX = Math.abs(touch.clientX - prevTouch.x);
          const deltaY = Math.abs(touch.clientY - prevTouch.y);
          const duration = Date.now() - prevTouch.startTime;

          // Scale-aware tap threshold
          const tapThreshold = ResolutionGraphRenderer.TAP_THRESHOLD_PX / this.transform.scale;

          // If movement was minimal and duration was short, treat it as a tap
          if (
            deltaX < tapThreshold &&
            deltaY < tapThreshold &&
            duration < ResolutionGraphRenderer.TAP_MAX_DURATION_MS
          ) {
            const rect = this.canvas.getBoundingClientRect();
            const node = this.getNodeAtScreenPosition(
              touch.clientX - rect.left,
              touch.clientY - rect.top,
            );

            if (node) {
              // Dispatch a custom event that can be listened to
              const event = new CustomEvent('nodeclick', { detail: { nodeId: node.id } });
              this.canvas.dispatchEvent(event);
            }
          }
        }
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        this.touches.delete(e.changedTouches[i].identifier);
      }

      if (e.touches.length < 2) {
        this.interactionState = { type: 'idle' };
      }
    };
    this.addEventListener(this.canvas, 'touchend', touchEndHandler as EventListener, {
      passive: false,
    });

    const touchCancelHandler = () => {
      this.touches.clear();
      this.interactionState = { type: 'idle' };
    };
    this.addEventListener(this.canvas, 'touchcancel', touchCancelHandler as EventListener);
  }

  /**
   * Calculate distance between two touch points for pinch zoom
   */
  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Setup keyboard shortcuts for zoom controls
   */
  public setupKeyboardShortcuts(): void {
    const handler = (e: KeyboardEvent) => {
      if (!this.canvas.matches(':hover')) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '+':
          case '=':
            e.preventDefault();
            this.zoomIn();
            break;
          case '-':
            e.preventDefault();
            this.zoomOut();
            break;
          case '0':
            e.preventDefault();
            this.resetView();
            break;
        }
      }
    };

    this.addEventListener(document, 'keydown', handler as EventListener);
  }

  /**
   * Zoom in on the center of the canvas
   */
  public zoomIn(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const newScale = Math.min(
      ResolutionGraphRenderer.MAX_ZOOM,
      this.transform.scale * ResolutionGraphRenderer.ZOOM_INCREMENT,
    );
    this.transform.offsetX -=
      (centerX - this.transform.offsetX) * (newScale / this.transform.scale - 1);
    this.transform.offsetY -=
      (centerY - this.transform.offsetY) * (newScale / this.transform.scale - 1);
    this.transform.scale = newScale;
    this.scheduleRender();
  }

  /**
   * Zoom out from the center of the canvas
   */
  public zoomOut(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const newScale = Math.max(
      ResolutionGraphRenderer.MIN_ZOOM,
      this.transform.scale / ResolutionGraphRenderer.ZOOM_INCREMENT,
    );
    this.transform.offsetX -=
      (centerX - this.transform.offsetX) * (newScale / this.transform.scale - 1);
    this.transform.offsetY -=
      (centerY - this.transform.offsetY) * (newScale / this.transform.scale - 1);
    this.transform.scale = newScale;
    this.scheduleRender();
  }

  /**
   * Reset view to default zoom and position
   */
  public resetView(): void {
    this.transform = { scale: 1, offsetX: 0, offsetY: 0 };
    this.scheduleRender();
  }

  /**
   * Reset all manual node positions
   */
  public resetNodePositions(): void {
    this.nodePositionOverrides.clear();
    this.layoutNodes();
    this.scheduleRender();
  }

  /**
   * Called when a node's status changes to trigger animation
   */
  public onNodeStatusChange(nodeId: string, status: ResolutionStatus): void {
    this.animationTimestamps.set(nodeId, Date.now());
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animate();
    }
  }

  /**
   * Animation loop for node status changes
   */
  private animate(): void {
    const now = Date.now();
    let needsUpdate = false;

    // Remove old timestamps (animation complete after defined duration)
    this.animationTimestamps.forEach((timestamp, nodeId) => {
      if (now - timestamp > ResolutionGraphRenderer.ANIMATION_DURATION_MS) {
        this.animationTimestamps.delete(nodeId);
      } else {
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      this.scheduleRender();
      requestAnimationFrame(() => this.animate());
    } else {
      this.isAnimating = false;
    }
  }

  /**
   * Setup tooltips for nodes
   */
  public setupTooltips(container: HTMLElement): void {
    // Create tooltip element
    this.tooltipElement = container.createDiv({ cls: 'graph-tooltip' });
    this.tooltipElement.classList.add('graph-tooltip-hidden');

    const mouseMoveHandler = (e: MouseEvent) => {
      if (
        this.interactionState.type === 'panning' ||
        this.interactionState.type === 'dragging-node'
      )
        return;

      const graphPos = this.getMouseGraphPosition(e);
      const node = this.getNodeAtPosition(graphPos.x, graphPos.y);

      if (node && node !== this.hoveredNode) {
        this.hoveredNode = node;
        this.showTooltip(node, e.clientX, e.clientY);
      } else if (!node && this.hoveredNode) {
        this.hideTooltip();
        this.hoveredNode = null;
      }
    };
    this.addEventListener(this.canvas, 'mousemove', mouseMoveHandler as EventListener);

    const mouseLeaveHandler = () => {
      this.hideTooltip();
      this.hoveredNode = null;
    };
    this.addEventListener(this.canvas, 'mouseleave', mouseLeaveHandler as EventListener);
  }

  /**
   * Show tooltip for a node
   */
  private showTooltip(node: GraphNode, x: number, y: number): void {
    if (!this.tooltipElement) return;

    const fileName = node.id.split('/').pop() || node.id;
    const statusIcon = this.getStatusIcon(node.data.status);

    // Clear previous content
    this.tooltipElement.empty();

    // Create header
    const headerEl = this.tooltipElement.createDiv({ cls: 'tooltip-header' });
    headerEl.createSpan({ cls: 'tooltip-icon', text: statusIcon });
    headerEl.createSpan({ cls: 'tooltip-title', text: fileName });

    // Create body
    const bodyEl = this.tooltipElement.createDiv({ cls: 'tooltip-body' });

    const pathRow = bodyEl.createDiv({ cls: 'tooltip-row' });
    pathRow.createSpan({ cls: 'tooltip-label', text: 'Path:' });
    pathRow.createSpan({ cls: 'tooltip-value', text: node.id });

    const statusRow = bodyEl.createDiv({ cls: 'tooltip-row' });
    statusRow.createSpan({ cls: 'tooltip-label', text: 'Status:' });
    statusRow.createSpan({ cls: 'tooltip-value', text: node.data.status });

    const depthRow = bodyEl.createDiv({ cls: 'tooltip-row' });
    depthRow.createSpan({ cls: 'tooltip-label', text: 'Depth:' });
    depthRow.createSpan({ cls: 'tooltip-value', text: node.data.depth.toString() });

    if (node.data.isPendingChat) {
      bodyEl.createDiv({ cls: 'tooltip-badge', text: 'Pending Chat' });
    }

    if (node.data.error) {
      bodyEl.createDiv({ cls: 'tooltip-error', text: node.data.error });
    }

    bodyEl.createDiv({ cls: 'tooltip-hint', text: 'Click to open file' });

    // Position tooltip
    this.tooltipElement.style.left = `${x + 15}px`;
    this.tooltipElement.style.top = `${y + 15}px`;
    this.tooltipElement.classList.remove('graph-tooltip-hidden');
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.classList.add('graph-tooltip-hidden');
    }
  }

  /**
   * Get status icon for tooltip
   */
  private getStatusIcon(status: ResolutionStatus): string {
    const icons: Record<ResolutionStatus, string> = {
      idle: '○',
      resolving: '◐',
      complete: '●',
      error: '✗',
      cached: '◉',
      'cycle-detected': '↻',
    };
    return icons[status] || '○';
  }

  /**
   * Render minimap in corner
   */
  private renderMinimap(): void {
    if (!this.showMinimap || this.nodes.size === 0) return;

    const padding = ResolutionGraphRenderer.MINIMAP_PADDING;
    const x = this.canvas.width - this.minimapSize.width - padding;
    const y = padding;

    // Save context
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for minimap

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(x, y, this.minimapSize.width, this.minimapSize.height);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.strokeRect(x, y, this.minimapSize.width, this.minimapSize.height);

    // Calculate bounds of all nodes
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });

    const graphWidth = maxX - minX + 100;
    const graphHeight = maxY - minY + 100;
    const scale =
      Math.min(this.minimapSize.width / graphWidth, this.minimapSize.height / graphHeight) *
      ResolutionGraphRenderer.MINIMAP_SCALE_FACTOR;

    // Draw nodes as small circles
    this.nodes.forEach(node => {
      const miniX = x + (node.x - minX + 50) * scale;
      const miniY = y + (node.y - minY + 50) * scale;

      this.ctx.beginPath();
      this.ctx.arc(miniX, miniY, ResolutionGraphRenderer.MINIMAP_NODE_RADIUS, 0, Math.PI * 2);
      this.ctx.fillStyle = this.getNodeColor(node.data.status);
      this.ctx.fill();
    });

    // Draw viewport rectangle
    const viewportWidth = (this.canvas.width / this.transform.scale) * scale;
    const viewportHeight = (this.canvas.height / this.transform.scale) * scale;
    const viewportX = x + (-this.transform.offsetX / this.transform.scale - minX + 50) * scale;
    const viewportY = y + (-this.transform.offsetY / this.transform.scale - minY + 50) * scale;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = ResolutionGraphRenderer.MINIMAP_VIEWPORT_LINE_WIDTH;
    this.ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);

    // Restore context
    this.ctx.restore();

    // Setup minimap click handler (only once)
    if (!this.minimapClickHandlerAdded) {
      const minimapClickHandler = (e: MouseEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        // Check if click is within minimap bounds
        if (
          canvasX >= x &&
          canvasX <= x + this.minimapSize.width &&
          canvasY >= y &&
          canvasY <= y + this.minimapSize.height
        ) {
          // Convert click position to graph coordinates
          const relX = (canvasX - x) / scale - 50 + minX;
          const relY = (canvasY - y) / scale - 50 + minY;

          // Pan to clicked location (center it)
          this.transform.offsetX = this.canvas.width / 2 - relX * this.transform.scale;
          this.transform.offsetY = this.canvas.height / 2 - relY * this.transform.scale;

          this.scheduleRender();
          e.preventDefault();
        }
      };

      this.addEventListener(this.canvas, 'click', minimapClickHandler as EventListener);
      this.minimapClickHandlerAdded = true;
    }
  }

  /**
   * Get current transform state for saving/restoring
   */
  public getTransform(): ViewTransform {
    return { ...this.transform };
  }

  /**
   * Set transform state (for restoring saved state)
   */
  public setTransform(transform: ViewTransform): void {
    this.transform = { ...transform };
    this.render();
  }

  /**
   * Get current zoom level as percentage
   */
  public getZoomLevel(): string {
    return Math.round(this.transform.scale * 100) + '%';
  }
}
