import { ResolutionNodeData, ResolutionStatus } from '../types';
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
  scale: number; // Zoom level (0.1 - 5.0)
  offsetX: number; // Pan offset X
  offsetY: number; // Pan offset Y
}

/**
 * Canvas-based graph renderer for the Blue File Resolution tree.
 * Implements a layered/hierarchical layout algorithm to visualize the resolution DAG.
 */
export class ResolutionGraphRenderer {
  private ctx: CanvasRenderingContext2D;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private canvas: HTMLCanvasElement;
  private treeData: Map<string, ResolutionNodeData>;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private draggedNode: GraphNode | null = null;
  private nodePositionOverrides: Map<string, { x: number; y: number }> = new Map();
  private animationTimestamps: Map<string, number> = new Map();
  private isAnimating: boolean = false;
  private tooltipElement: HTMLDivElement | null = null;
  private hoveredNode: GraphNode | null = null;
  public showMinimap: boolean = true;
  private minimapSize = { width: 150, height: 150 };
  private hasRendered: boolean = false;
  private width: number = 0;
  private height: number = 0;
  private iconCache: Map<string, HTMLImageElement> = new Map();
  private iconsLoaded: boolean = false;
  private touches: Map<number, { x: number; y: number }> = new Map();
  private initialPinchDistance: number | null = null;
  private initialScale: number = 1;

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
        radius: 20,
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
   */
  private layoutNodes(): void {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

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
    const verticalSpacing = maxDepth > 0 ? (canvasHeight - 160) / maxDepth : 0;

    // Position nodes
    for (const [depth, layerNodes] of layers) {
      const layerY = 80 + depth * Math.max(verticalSpacing, 120);
      const horizontalSpacing = canvasWidth / (layerNodes.length + 1);

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
  public fitToView(padding: number = 50): void {
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
      this.ctx.lineWidth = 2;
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

      // Draw icon ONLY (no circle background)
      if (this.iconsLoaded) {
        const iconId = this.getNodeIcon(node);
        const icon = this.iconCache.get(iconId);
        
        if (icon) {
          // Calculate icon size (larger, no circle background)
          const iconSize = node.radius * 2.5;
          
          // Apply status-based color tint
          this.ctx.save();
          
          // Draw icon first
          this.ctx.drawImage(
            icon,
            node.x - iconSize / 2,
            node.y - iconSize / 2,
            iconSize,
            iconSize
          );
          
          // Apply color overlay for status
          this.ctx.globalCompositeOperation = 'source-atop';
          this.ctx.fillStyle = nodeColor;
          this.ctx.fillRect(
            node.x - iconSize / 2,
            node.y - iconSize / 2,
            iconSize,
            iconSize
          );
          
          this.ctx.restore();
          
          // Draw glow for pending chats (around icon, not circle)
          if (node.data.isPendingChat) {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
              node.x - iconSize / 2 - 5,
              node.y - iconSize / 2 - 5,
              iconSize + 10,
              iconSize + 10
            );
            this.ctx.restore();
          }
          
          // Add glow effect for resolving nodes
          if (node.data.status === 'resolving') {
            this.ctx.save();
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = nodeColor;
            this.ctx.strokeStyle = this.getNodeBorderColor(node.data.status);
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
              node.x - iconSize / 2,
              node.y - iconSize / 2,
              iconSize,
              iconSize
            );
            this.ctx.shadowBlur = 0;
            this.ctx.restore();
          }
          
          // Animated glow for recently changed nodes
          const timestamp = this.animationTimestamps.get(node.id);
          if (timestamp) {
            const elapsed = now - timestamp;
            const progress = elapsed / 1000; // 0 to 1
            const alpha = 1 - progress;
            const pulseSize = iconSize + 10 + progress * 20;

            this.ctx.save();
            this.ctx.strokeStyle = nodeColor.replace(/[\d.]+\)$/, `${alpha})`);
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
              node.x - pulseSize / 2,
              node.y - pulseSize / 2,
              pulseSize,
              pulseSize
            );
            this.ctx.restore();
          }
        }
      }

      // Draw file name label below icon
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';

      // Truncate long file names
      const maxWidth = 150;
      let displayName = fileName;
      const metrics = this.ctx.measureText(displayName);
      if (metrics.width > maxWidth) {
        while (this.ctx.measureText(displayName + '...').width > maxWidth && displayName.length > 0) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '...';
      }

      this.ctx.fillText(displayName, node.x, node.y + node.radius * 2 + 20);
    }
  }

  /**
   * Draws an arrowhead at the end of an edge
   */
  private drawArrowhead(x: number, y: number, fromX: number, fromY: number, color: string): void {
    const angle = Math.atan2(y - fromY, x - fromX);
    const arrowSize = 10;
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
    // Pre-load all icon types we might use
    const iconTypes = ['folder', 'pure-chat-llm', 'file-text', 'image', 'file'];
    
    await Promise.all(
      iconTypes.map(iconId => this.loadIcon(iconId))
    );
    
    this.iconsLoaded = true;
    // Trigger initial render after icons are loaded
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
      return 'pure-chat-llm';
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
    
    const svgElement = getIcon(iconId);
    if (!svgElement) {
      return null;
    }
    
    const svgString = svgElement.outerHTML;
    
    // Convert SVG to data URL for canvas rendering
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve) => {
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
   * Setup interactive controls for zoom, pan, and node dragging
   */
  private setupInteractivity(): void {
    // Mouse wheel zoom (centered on cursor position)
    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.1, Math.min(5, this.transform.scale * zoomDelta));

      // Zoom towards cursor position
      this.transform.offsetX -=
        (mouseX - this.transform.offsetX) * (newScale / this.transform.scale - 1);
      this.transform.offsetY -=
        (mouseY - this.transform.offsetY) * (newScale / this.transform.scale - 1);
      this.transform.scale = newScale;

      this.render();
    });

    // Pan with Shift+drag or middle mouse button
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // Middle click or Shift+Left click - Pan
        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.clientX - this.transform.offsetX;
        this.dragStartY = e.clientY - this.transform.offsetY;
        this.canvas.style.cursor = 'grabbing';
      } else if (e.button === 0 && !e.shiftKey) {
        // Left click without shift - Node dragging
        const graphPos = this.screenToGraph(x, y);
        const node = this.getNodeAtPosition(graphPos.x, graphPos.y);

        if (node) {
          this.draggedNode = node;
          this.canvas.style.cursor = 'move';
          e.preventDefault();
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isDragging) {
        // Pan the view
        this.transform.offsetX = e.clientX - this.dragStartX;
        this.transform.offsetY = e.clientY - this.dragStartY;
        this.render();
      } else if (this.draggedNode) {
        // Drag node
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const graphPos = this.screenToGraph(x, y);

        this.draggedNode.x = graphPos.x;
        this.draggedNode.y = graphPos.y;
        this.nodePositionOverrides.set(this.draggedNode.id, { x: graphPos.x, y: graphPos.y });
        this.render();
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
      }
      if (this.draggedNode) {
        this.draggedNode = null;
        this.canvas.style.cursor = 'default';
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.draggedNode = null;
      this.canvas.style.cursor = 'default';
    });
  }

  /**
   * Setup touch support for mobile/tablet interaction
   */
  private setupTouchSupport(): void {
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        this.touches.set(touch.identifier, {
          x: touch.clientX,
          y: touch.clientY
        });
      }
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const node = this.getNodeAtScreenPosition(
          touch.clientX - rect.left,
          touch.clientY - rect.top
        );
        if (node) {
          this.draggedNode = node;
        }
      }
      
      if (e.touches.length === 2) {
        this.initialPinchDistance = this.getTouchDistance(
          e.touches[0],
          e.touches[1]
        );
        this.initialScale = this.transform.scale;
      }
    });
    
    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const prevTouch = this.touches.get(touch.identifier);
        
        if (prevTouch) {
          const deltaX = touch.clientX - prevTouch.x;
          const deltaY = touch.clientY - prevTouch.y;
          
          if (this.draggedNode) {
            const rect = this.canvas.getBoundingClientRect();
            const graphPos = this.screenToGraph(
              touch.clientX - rect.left,
              touch.clientY - rect.top
            );
            this.draggedNode.x = graphPos.x;
            this.draggedNode.y = graphPos.y;
            this.nodePositionOverrides.set(this.draggedNode.id, graphPos);
          } else {
            this.transform.offsetX += deltaX;
            this.transform.offsetY += deltaY;
          }
          
          this.touches.set(touch.identifier, {
            x: touch.clientX,
            y: touch.clientY
          });
          this.render();
        }
      } else if (e.touches.length === 2 && this.initialPinchDistance) {
        const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
        const scale = (distance / this.initialPinchDistance) * this.initialScale;
        this.transform.scale = Math.max(0.1, Math.min(5, scale));
        this.render();
      }
    });
    
    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      
      // Check if this was a tap (not a drag)
      if (e.changedTouches.length === 1 && !this.draggedNode && this.touches.size === 1) {
        const touch = e.changedTouches[0];
        const prevTouch = this.touches.get(touch.identifier);
        
        if (prevTouch) {
          const deltaX = Math.abs(touch.clientX - prevTouch.x);
          const deltaY = Math.abs(touch.clientY - prevTouch.y);
          
          // If movement was minimal, treat it as a tap
          if (deltaX < 10 && deltaY < 10) {
            const rect = this.canvas.getBoundingClientRect();
            const node = this.getNodeAtScreenPosition(
              touch.clientX - rect.left,
              touch.clientY - rect.top
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
        this.initialPinchDistance = null;
      }
      
      this.draggedNode = null;
    });
    
    this.canvas.addEventListener('touchcancel', () => {
      this.touches.clear();
      this.draggedNode = null;
      this.initialPinchDistance = null;
    });
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

    document.addEventListener('keydown', handler);
  }

  /**
   * Zoom in on the center of the canvas
   */
  public zoomIn(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const newScale = Math.min(5, this.transform.scale * 1.2);
    this.transform.offsetX -=
      (centerX - this.transform.offsetX) * (newScale / this.transform.scale - 1);
    this.transform.offsetY -=
      (centerY - this.transform.offsetY) * (newScale / this.transform.scale - 1);
    this.transform.scale = newScale;
    this.render();
  }

  /**
   * Zoom out from the center of the canvas
   */
  public zoomOut(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const newScale = Math.max(0.1, this.transform.scale / 1.2);
    this.transform.offsetX -=
      (centerX - this.transform.offsetX) * (newScale / this.transform.scale - 1);
    this.transform.offsetY -=
      (centerY - this.transform.offsetY) * (newScale / this.transform.scale - 1);
    this.transform.scale = newScale;
    this.render();
  }

  /**
   * Reset view to default zoom and position
   */
  public resetView(): void {
    this.transform = { scale: 1, offsetX: 0, offsetY: 0 };
    this.render();
  }

  /**
   * Reset all manual node positions
   */
  public resetNodePositions(): void {
    this.nodePositionOverrides.clear();
    this.layoutNodes();
    this.render();
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

    // Remove old timestamps (animation complete after 1 second)
    this.animationTimestamps.forEach((timestamp, nodeId) => {
      if (now - timestamp > 1000) {
        this.animationTimestamps.delete(nodeId);
      } else {
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      this.render();
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
    this.tooltipElement.style.position = 'absolute';
    this.tooltipElement.style.display = 'none';
    this.tooltipElement.style.pointerEvents = 'none';
    this.tooltipElement.style.zIndex = '1000';

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isDragging || this.draggedNode) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const graphPos = this.screenToGraph(x, y);
      const node = this.getNodeAtPosition(graphPos.x, graphPos.y);

      if (node && node !== this.hoveredNode) {
        this.hoveredNode = node;
        this.showTooltip(node, e.clientX, e.clientY);
      } else if (!node && this.hoveredNode) {
        this.hideTooltip();
        this.hoveredNode = null;
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hideTooltip();
      this.hoveredNode = null;
    });
  }

  /**
   * Show tooltip for a node
   */
  private showTooltip(node: GraphNode, x: number, y: number): void {
    if (!this.tooltipElement) return;

    const fileName = node.id.split('/').pop() || node.id;
    const statusIcon = this.getStatusIcon(node.data.status);

    this.tooltipElement.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-icon">${statusIcon}</span>
        <span class="tooltip-title">${fileName}</span>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-row">
          <span class="tooltip-label">Path:</span>
          <span class="tooltip-value">${node.id}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Status:</span>
          <span class="tooltip-value">${node.data.status}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Depth:</span>
          <span class="tooltip-value">${node.data.depth}</span>
        </div>
        ${node.data.isPendingChat ? '<div class="tooltip-badge">Pending Chat</div>' : ''}
        ${node.data.error ? `<div class="tooltip-error">${node.data.error}</div>` : ''}
        <div class="tooltip-hint">Click to open file</div>
      </div>
    `;

    this.tooltipElement.style.left = `${x + 15}px`;
    this.tooltipElement.style.top = `${y + 15}px`;
    this.tooltipElement.style.display = 'block';
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
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

    const padding = 10;
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
      Math.min(this.minimapSize.width / graphWidth, this.minimapSize.height / graphHeight) * 0.9;

    // Draw nodes as small circles
    this.nodes.forEach(node => {
      const miniX = x + (node.x - minX + 50) * scale;
      const miniY = y + (node.y - minY + 50) * scale;

      this.ctx.beginPath();
      this.ctx.arc(miniX, miniY, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = this.getNodeColor(node.data.status);
      this.ctx.fill();
    });

    // Draw viewport rectangle
    const viewportWidth = (this.canvas.width / this.transform.scale) * scale;
    const viewportHeight = (this.canvas.height / this.transform.scale) * scale;
    const viewportX = x + (-this.transform.offsetX / this.transform.scale - minX + 50) * scale;
    const viewportY = y + (-this.transform.offsetY / this.transform.scale - minY + 50) * scale;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);

    // Restore context
    this.ctx.restore();
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
