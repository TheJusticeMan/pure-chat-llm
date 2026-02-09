import { ResolutionNodeData, ResolutionStatus } from '../../types';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  data: ResolutionNodeData;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface TreeNode {
  filePath: string;
  fileName: string;
  depth: number;
  status: string;
  isPendingChat: boolean;
  isChatFile?: boolean;
  children: TreeNode[];
  error?: string;
}

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type InteractionState =
  | { type: 'idle' }
  | { type: 'panning'; startX: number; startY: number }
  | { type: 'dragging-node'; node: GraphNode; startTime: number }
  | { type: 'pinch-zooming'; initialDistance: number; initialScale: number };

export type IconLoadingState = 'loading' | 'loaded' | 'error';

export const GRAPH_CONSTANTS = {
  ICON_SIZE_MULTIPLIER: 2.5,
  PULSE_BASE_SIZE: 10,
  PULSE_MAX_GROWTH: 20,
  ARROW_SIZE: 10,
  LAYOUT_VERTICAL_PADDING: 160,
  LAYOUT_MIN_VERTICAL_SPACING: 120,
  TAP_THRESHOLD_PX: 15,
  TAP_MAX_DURATION_MS: 300,
  MIN_ZOOM: 0.25,
  MAX_ZOOM: 10,
  ZOOM_INCREMENT: 1.2,
  MINIMAP_SIZE: { width: 150, height: 150 },
  MINIMAP_PADDING: 10,
  ANIMATION_DURATION_MS: 1000,
  NODE_RADIUS: 20,
  EDGE_LINE_WIDTH: 2,
  LAYOUT_WIDTH: 1000,
  LAYOUT_HEIGHT: 800,
  FIT_VIEW_PADDING: 50,
  PENDING_CHAT_GLOW_SIZE: 5,
  PENDING_CHAT_GLOW_WIDTH: 3,
  RESOLVING_GLOW_BLUR: 20,
  RESOLVING_GLOW_WIDTH: 3,
  LABEL_FONT: '12px sans-serif',
  LABEL_MAX_WIDTH: 150,
  LABEL_OFFSET_Y: 20,
  MINIMAP_SCALE_FACTOR: 0.9,
  MINIMAP_NODE_RADIUS: 3,
  MINIMAP_VIEWPORT_LINE_WIDTH: 2,
};

export const STATUS_COLORS: Record<ResolutionStatus, string> = {
  idle: '255, 255, 255',
  resolving: '192, 132, 252',
  complete: '0, 255, 128',
  error: '255, 64, 129',
  cached: '100, 200, 255',
  'cycle-detected': '255, 170, 0',
};

/**
 *
 * @param status
 * @param alpha
 */
export function getStatusColor(status: ResolutionStatus, alpha: number = 1): string {
  const rgb = STATUS_COLORS[status] || STATUS_COLORS.idle;
  return `rgba(${rgb}, ${alpha})`;
}
