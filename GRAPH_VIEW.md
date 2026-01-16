# Graph View Mode for Blue Resolution Tree

## Overview

The Blue Resolution Tree View now supports two visualization modes:
1. **Tree View** (default) - Hierarchical DOM-based tree with expand/collapse
2. **Graph View** (new) - Canvas-based graph visualization with spatial layout

## Features

### Toggle Button
- Located in the header of the Blue Resolution Tree panel
- Icons:
  - `git-branch` - Click to switch to graph view
  - `list-tree` - Click to switch to tree view
- Tooltip provides clear action description

### Graph View Capabilities

#### Visual Layout
- **Layered/Hierarchical Layout**: Nodes are arranged in layers based on their depth
- **Bezier Curves**: Smooth curved edges connecting parent to child nodes
- **Arrowheads**: Visual indicators showing direction of dependencies

#### Node Representation
- **Circles**: Each file is represented as a circle
- **Status Colors**: Matches existing theme
  - Idle: `rgba(255, 255, 255, 0.6)` - Light gray
  - Resolving: `rgba(192, 132, 252, 0.8)` - Purple with glow
  - Complete: `rgba(0, 255, 128, 0.7)` - Green
  - Error: `rgba(255, 64, 129, 0.7)` - Red
  - Cached: `rgba(100, 200, 255, 0.7)` - Blue
  - Cycle Detected: `rgba(255, 170, 0, 0.7)` - Orange

#### Interactions
- **Click to Navigate**: Click any node to open the corresponding file
- **File Name Labels**: Displayed below each node (truncated if too long)
- **Responsive**: Canvas automatically resizes with the panel
- **High-DPI Support**: Crisp rendering on Retina/4K displays

### Edge Rendering
- **Status-Based Colors**: Edge color inherits from the source node's status
- **Bezier Curves**: Control points at vertical midpoint for smooth appearance
- **Arrowheads**: 10px size with 30° angle pointing to child nodes

## Technical Implementation

### Architecture
```
BlueResolutionTreeView
├── viewMode: 'tree' | 'graph'
├── renderView() → calls renderTree() or renderGraphView()
└── renderGraphView()
    ├── Creates canvas element
    ├── Instantiates ResolutionGraphRenderer
    ├── Sets up click handlers
    └── Handles resize events

ResolutionGraphRenderer
├── buildGraph() → converts treeData Map to graph structure
├── layoutNodes() → layered/hierarchical positioning
├── render() → main entry point
├── drawEdges() → Bezier curves with arrowheads
├── drawNodes() → circles with status colors
└── getNodeAtPosition() → click detection
```

### Layout Algorithm
1. Group nodes by depth (using existing `node.data.depth`)
2. Calculate vertical position: `layerY = 80 + (depth * spacing)`
3. Calculate horizontal spacing: `spacing = canvasWidth / (nodesInLayer + 1)`
4. Position each node: `node.x = spacing * (index + 1)`, `node.y = layerY`

### Canvas Handling
- Uses `devicePixelRatio` for high-DPI displays
- Scales context to maintain CSS pixel coordinates
- Recreates renderer on resize for proper layout recalculation
- Cleans up old canvas when switching views

## Usage

1. Open a markdown file in Obsidian
2. Ensure Blue File Resolution feature is enabled in settings
3. Open the Blue Resolution Tree panel (side panel icon: `list-tree`)
4. Click the `git-branch` icon in the header to switch to graph view
5. Click nodes to navigate to files
6. Click the `list-tree` icon to switch back to tree view

## Testing Scenarios

### Simple Linear Chain
```
A → B → C
```
Renders as three nodes in a vertical line.

### Wide Graph
```
A → [B, C, D, E, F]
```
Renders with A at the top, and B through F distributed horizontally below.

### Multi-Level
```
A → B → [C, D] → E
```
Four layers with proper parent-child relationships visualized.

### Cycle Detection
```
A → B → C → A
```
Cycle-detected nodes highlighted in orange.

## Browser Compatibility
- Modern browsers with HTML5 Canvas support
- Tested with Obsidian's Electron environment
- No external dependencies required

## Future Enhancements (Not in Current Implementation)
- Zoom and pan controls
- Drag to reposition nodes
- Mini-map for large graphs
- Animation during resolution
- Persistent view mode preference
- Export graph as image
- Physics-based force-directed layout option

## Files Modified
1. `src/ui/BlueResolutionTreeView.ts` - Main view component
2. `src/ui/ResolutionGraphRenderer.ts` - New graph renderer
3. `styles.css` - Graph container and canvas styles
