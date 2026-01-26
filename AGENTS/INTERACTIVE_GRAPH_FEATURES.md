# Interactive Graph Features Guide

## Overview

The Blue Resolution Tree graph view now includes professional-grade interactive features that make navigating and understanding complex resolution trees easier and more intuitive.

## Features

### 🔍 Zoom Controls

#### Mouse Wheel Zoom

- **Usage**: Scroll mouse wheel while hovering over the graph
- **Behavior**: Zooms in/out centered on your cursor position
- **Range**: 0.1x (10%) to 5x (500%)
- **Smart**: The graph zooms towards where you're pointing, making it easy to focus on specific nodes

#### Button Controls

Located in the header when in graph view:

- **Zoom In** (🔍+): Increases zoom level centered on canvas
- **Zoom Out** (🔍-): Decreases zoom level centered on canvas
- **Reset View** (↻): Returns to 100% zoom with no offset

#### Keyboard Shortcuts

- **Ctrl/Cmd + Plus** or **Ctrl/Cmd + =**: Zoom in
- **Ctrl/Cmd + Minus**: Zoom out
- **Ctrl/Cmd + 0**: Reset to default view
- ⚠️ Shortcuts only work when mouse is hovering over the canvas

#### Zoom Level Indicator

- Displays current zoom percentage in top-left corner
- Updates in real-time as you zoom
- Example: "100%", "250%", "50%"

### 🖐️ Pan Controls

#### Shift + Drag

- Hold **Shift** key
- Click and drag with **left mouse button**
- Canvas pans smoothly in the direction of your drag

#### Middle Mouse Button

- Click and drag with **middle mouse button**
- Works without holding any modifier keys
- Same behavior as Shift+drag

#### Visual Feedback

- Cursor changes to "grabbing" 👊 during pan operation
- Minimap viewport rectangle updates to show your position

### 🎯 Node Dragging

#### Manual Positioning

- **Click and drag** any node with the left mouse button (without Shift)
- Node follows your cursor in real-time
- Edges automatically update to stay connected
- Position is preserved until reset

#### Cursor Feedback

- Cursor changes to "move" ✋ when dragging a node

#### Reset Positions

- Click the **Reset node positions** button (🔄 refresh icon)
- All nodes return to automatic layout
- Clears all manual position overrides

### 🗺️ Mini-map Navigator

#### Display

- Located in **top-right corner** of the graph
- Shows an overview of the entire graph
- Displays all nodes as small colored dots
- Shows a white rectangle indicating your current viewport

#### Features

- **Real-time updates**: Viewport rectangle moves as you pan/zoom
- **Color-coded nodes**: Uses same status colors as main graph
- **Always visible**: Even when zoomed in or panned far from origin
- **Dark background**: Easy to see against the main graph

#### Toggle Control

- Click the **Toggle minimap** button (🗺️ map icon) in header
- Instantly shows/hides the minimap
- State is preserved during the session

### 💬 Enhanced Tooltips

#### Activation

- **Hover** your mouse over any node
- Tooltip appears automatically after a brief moment
- Follows your mouse to different nodes

#### Information Displayed

- **File name**: The name of the file (bold header)
- **Path**: Full file path in the vault
- **Status**: Current resolution status (idle, resolving, complete, error, cached, cycle-detected)
- **Depth**: How many levels deep in the resolution tree
- **Status icon**: Visual indicator (○ ◐ ● ✗ ◉ ↻)
- **Special badges**:
  - "Pending Chat" badge for chat files awaiting response
  - Red error box with error message for failed resolutions
- **Hint**: "Click to open file" reminder at bottom

#### Styling

- Dark background with subtle border
- Professional typography with monospace font for technical details
- Color-coded status information
- Automatically positioned near cursor

#### Dismissal

- Move mouse away from node
- Tooltip fades out automatically
- No tooltips during drag operations (prevents clutter)

### ✨ Real-time Animations

#### Status Change Animations

- Nodes display an **expanding glow effect** when status changes
- Animation lasts **1 second**
- Smooth 60fps animation using `requestAnimationFrame`
- Multiple nodes can animate simultaneously

#### Animation Triggers

- Triggered automatically during Blue File Resolution
- Shows when a node transitions between statuses:
  - idle → resolving
  - resolving → complete
  - resolving → error
  - Any status change

#### Visual Effect

- Expanding circular pulse from node
- Color matches the new status
- Fades out gradually over 1 second
- Does not interfere with other interactions

### 🎨 Node Status Colors

All features respect the existing status color system:

- **Idle** (○): `rgba(255, 255, 255, 0.6)` - Light gray/white
- **Resolving** (◐): `rgba(192, 132, 252, 0.8)` - Purple with glow
- **Complete** (●): `rgba(0, 255, 128, 0.7)` - Green
- **Error** (✗): `rgba(255, 64, 129, 0.7)` - Red/pink
- **Cached** (◉): `rgba(100, 200, 255, 0.7)` - Blue
- **Cycle Detected** (↻): `rgba(255, 170, 0, 0.7)` - Orange

## Usage Tips

### Navigating Large Graphs

1. Use **minimap** to get overview of entire structure
2. **Zoom in** on areas of interest
3. **Pan** to explore different sections
4. Use **tooltips** to identify specific files without clicking

### Custom Layouts

1. **Zoom and pan** to desired view
2. **Drag nodes** to organize them logically
3. Take a screenshot for documentation
4. Use **Reset positions** to return to automatic layout

### Efficient Exploration

1. **Hover** over nodes to preview information
2. **Click** only when you want to open the file
3. Use **keyboard shortcuts** for quick zoom adjustments
4. **Toggle minimap** off when working with small graphs to maximize space

### Performance Optimization

- Minimap can be **toggled off** for very large graphs (200+ nodes)
- Animations are **automatically** managed for performance
- Zoom/pan operations are **hardware accelerated** via canvas

## Compatibility

### Browser Requirements

- Modern browser with HTML5 Canvas support
- Hardware acceleration recommended for smooth animations
- Works in Obsidian's Electron environment

### Display Support

- **High-DPI displays**: Fully supported (Retina, 4K)
- **Responsive**: Adapts to panel resize
- **Theme compatible**: Works with all Obsidian themes

## Accessibility

- **Keyboard shortcuts** for zoom control
- **Visual feedback** for all interactions (cursor changes)
- **Color-blind friendly**: Uses both color and shapes for status
- **Tooltip information**: Full textual description of visual elements

## Technical Details

### Performance

- Canvas rendering with hardware acceleration
- Efficient coordinate transformations
- Optimized animation loop (stops when no animations active)
- Minimap updates only on render

### Coordinate System

- Graph coordinates remain fixed
- Viewport transform applied to all rendering
- Screen-to-graph coordinate conversion for accurate interaction
- Independent transform contexts for main view and minimap

### Memory Management

- Animation timestamps cleaned up automatically
- Node position overrides stored efficiently in Map
- Tooltip element reused for all nodes
- No memory leaks from event listeners

## Troubleshooting

### Issue: Zoom not working

- **Check**: Is mouse hovering over the canvas?
- **Try**: Click on canvas first to ensure focus

### Issue: Keyboard shortcuts not responding

- **Check**: Mouse must be hovering over canvas
- **Check**: No text input fields are focused
- **Try**: Click canvas to ensure it's in focus

### Issue: Performance lag with large graphs

- **Solution**: Toggle minimap off
- **Solution**: Reset zoom to 1x
- **Check**: Graph size (200+ nodes may impact performance)

### Issue: Tooltips not appearing

- **Check**: Are you hovering directly over a node?
- **Check**: Are you currently dragging?
- **Try**: Move mouse slowly over node

### Issue: Node positions reset unexpectedly

- **Cause**: Canvas resize recalculates layout
- **Workaround**: Avoid resizing panel after manual positioning
- **Note**: Manual positions persist until resize or explicit reset

## Future Enhancements

Potential features not yet implemented:

- Save custom layouts to settings
- Export graph as PNG/SVG
- Physics-based force-directed layout
- Multi-select nodes with Ctrl+Click
- Undo/redo for node positions
- Edge labels showing relationship types
- Search/filter nodes in graph view

## Feedback

If you encounter issues or have suggestions for improvements, please report them with:

- Description of the issue or suggestion
- Steps to reproduce (if applicable)
- Screenshots or recordings
- Graph size and complexity
- Obsidian version and OS
