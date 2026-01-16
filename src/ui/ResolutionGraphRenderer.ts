import { ResolutionNodeData, ResolutionStatus } from '../types';

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
 * Canvas-based graph renderer for the Blue File Resolution tree.
 * Implements a layered/hierarchical layout algorithm to visualize the resolution DAG.
 */
export class ResolutionGraphRenderer {
  private ctx: CanvasRenderingContext2D;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private canvas: HTMLCanvasElement;
  private treeData: Map<string, ResolutionNodeData>;

  constructor(canvas: HTMLCanvasElement, treeData: Map<string, ResolutionNodeData>) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.canvas = canvas;
    this.treeData = treeData;

    this.buildGraph();
    this.layoutNodes();
  }

  /**
   * Builds the graph structure from the tree data
   */
  private buildGraph(): void {
    this.nodes.clear();
    this.edges = [];

    // Create nodes from tree data
    for (const [filePath, nodeData] of this.treeData) {
      const fileName = filePath.split('/').pop() || filePath;
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
  }

  /**
   * Main render method - draws the entire graph
   */
  public render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw edges first (so they appear behind nodes)
    this.drawEdges();

    // Draw nodes on top
    this.drawNodes();
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
   * Draws all nodes with status-based colors
   */
  private drawNodes(): void {
    for (const node of this.nodes.values()) {
      const nodeColor = this.getNodeColor(node.data.status);
      const fileName = node.id.split('/').pop() || node.id;

      // Draw circle
      this.ctx.fillStyle = nodeColor;
      this.ctx.strokeStyle = this.getNodeBorderColor(node.data.status);
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Add glow effect for resolving nodes
      if (node.data.status === 'resolving') {
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = nodeColor;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }

      // Draw file name label below node
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

      this.ctx.fillText(displayName, node.x, node.y + node.radius + 8);
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
}
