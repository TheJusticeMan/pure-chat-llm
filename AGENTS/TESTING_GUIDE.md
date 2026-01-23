# Testing Guide for Graph View Mode

## Prerequisites
- Obsidian installed
- Pure Chat LLM plugin built and installed
- Blue File Resolution feature enabled in plugin settings
- Test markdown files with [[links]] between them

## Test Setup

### Create Test Files
Create the following markdown files in your vault for testing:

1. **root.md**
```markdown
# Root File
This links to:
- [[child1]]
- [[child2]]
```

2. **child1.md**
```markdown
# Child 1
Links to [[grandchild1]] and [[grandchild2]]
```

3. **child2.md**
```markdown
# Child 2
Links to [[grandchild3]]
```

4. **grandchild1.md**, **grandchild2.md**, **grandchild3.md**
```markdown
# Grandchild X
Leaf node
```

For cycle testing, add to **grandchild1.md**:
```markdown
This creates a cycle: [[root]]
```

## Test Cases

### 1. Basic Toggle Functionality
**Steps:**
1. Open `root.md`
2. Open Blue Resolution Tree panel
3. Locate the view mode toggle button in the header
4. Click to switch to graph view (should show `git-branch` icon before clicking)
5. Verify canvas appears with graph
6. Click to switch back to tree view (should show `list-tree` icon before clicking)
7. Verify tree view appears

**Expected:**
- ✅ Button toggles icon between `git-branch` and `list-tree`
- ✅ Tooltip changes appropriately
- ✅ Views switch instantly without errors
- ✅ Previous view is properly cleaned up

### 2. Graph Rendering - Simple Linear Chain
**File Structure:** A → B → C

**Steps:**
1. Create three files with links: A links to B, B links to C
2. Open file A
3. Open graph view

**Expected:**
- ✅ Three nodes arranged vertically
- ✅ Two edges connecting them
- ✅ Arrowheads point from parent to child
- ✅ All nodes visible and properly labeled

### 3. Graph Rendering - Wide Graph
**File Structure:** Root → [Child1, Child2, Child3, Child4, Child5]

**Steps:**
1. Create root file linking to 5 children
2. Open root file
3. Open graph view

**Expected:**
- ✅ Root node at top
- ✅ Five child nodes distributed horizontally below
- ✅ Five edges connecting root to children
- ✅ No overlapping nodes
- ✅ Proper horizontal spacing

### 4. Graph Rendering - Multi-Level
**File Structure:** A → B → [C, D] → E

**Steps:**
1. Create the test structure described above
2. Open file A
3. Open graph view

**Expected:**
- ✅ Four distinct layers visible
- ✅ Nodes properly positioned at correct depths
- ✅ Edges form correct parent-child relationships
- ✅ Layout is clear and readable

### 5. Node Interaction - Click to Navigate
**Steps:**
1. Open graph view with multiple nodes
2. Click on a child node

**Expected:**
- ✅ Corresponding file opens in editor
- ✅ Graph view remains locked to original root file (if lock is enabled)
- ✅ No console errors

### 6. Status Colors - Idle State
**Steps:**
1. Open graph view with files that haven't been resolved

**Expected:**
- ✅ All nodes show idle color: `rgba(255, 255, 255, 0.6)` (light gray)
- ✅ Edges show idle color: `rgba(255, 255, 255, 0.3)` (lighter gray)

### 7. Status Colors - During Resolution
**Steps:**
1. Create a pending chat file (ends with user message)
2. Link to it from another file
3. Trigger resolution
4. Observe graph during execution

**Expected:**
- ✅ Resolving nodes show purple color with glow
- ✅ Complete nodes turn green
- ✅ Any errors show red nodes
- ✅ Colors update in real-time

### 8. Cycle Detection
**File Structure:** A → B → C → A (cycle)

**Steps:**
1. Create three files with circular links
2. Open file A
3. Analyze file links
4. Open graph view

**Expected:**
- ✅ All three nodes visible
- ✅ Nodes in cycle show orange color: `rgba(255, 170, 0, 0.7)`
- ✅ Cycle is visually apparent
- ✅ No infinite loops or crashes

### 9. Responsive Sizing
**Steps:**
1. Open graph view
2. Resize the Blue Resolution Tree panel
3. Maximize/minimize the panel
4. Split the panel

**Expected:**
- ✅ Canvas resizes smoothly
- ✅ Graph relayouts appropriately
- ✅ No stretching or distortion
- ✅ Labels remain readable
- ✅ Nodes maintain proper spacing

### 10. High-DPI Display
**Steps:**
1. Test on a high-DPI display (Retina, 4K, etc.)
2. Open graph view

**Expected:**
- ✅ Text is crisp and clear
- ✅ Circles have smooth edges
- ✅ Lines are not pixelated
- ✅ No blurriness

### 11. Empty Graph
**Steps:**
1. Open a file with no links
2. Open graph view

**Expected:**
- ✅ Message displayed: "No resolution data available."
- ✅ No errors in console
- ✅ Can still switch back to tree view

### 12. Large Graph Performance
**Steps:**
1. Create a file with 20+ links
2. Each linked file has 5+ links
3. Open graph view

**Expected:**
- ✅ Renders without significant lag
- ✅ All nodes visible (may need scrolling)
- ✅ Click interactions remain responsive
- ✅ Resize is smooth

### 13. View Mode Persistence (Optional)
**Steps:**
1. Switch to graph view
2. Close panel
3. Reopen panel

**Expected:**
- ⚠️ Currently not implemented - will default to tree view
- 🔮 Future enhancement

### 14. Legend Visibility
**Steps:**
1. Open graph view
2. Toggle legend visibility

**Expected:**
- ✅ Legend appears/disappears
- ✅ Graph adjusts to available space
- ✅ No layout issues

### 15. Lock View Feature
**Steps:**
1. Open a file with links
2. Switch to graph view
3. Lock the view
4. Click a node to open another file

**Expected:**
- ✅ Graph remains showing original file's tree
- ✅ Can still interact with nodes
- ✅ Unlock restores normal behavior

### 16. Zoom Controls - Mouse Wheel
**Steps:**
1. Open graph view with multiple nodes
2. Hover over the canvas
3. Scroll mouse wheel up (zoom in)
4. Scroll mouse wheel down (zoom out)

**Expected:**
- ✅ Graph zooms centered on cursor position
- ✅ Zoom level indicator updates (top-left corner)
- ✅ Zoom range is constrained (0.1x to 5x)
- ✅ Nodes and edges scale proportionally
- ✅ Labels remain readable at all zoom levels

### 17. Zoom Controls - Buttons
**Steps:**
1. Open graph view
2. Click zoom in button (magnifying glass with +)
3. Click zoom out button (magnifying glass with -)
4. Click reset view button (circular arrow)

**Expected:**
- ✅ Zoom in centers on canvas center
- ✅ Zoom out centers on canvas center
- ✅ Reset returns to 1x zoom with no offset
- ✅ Zoom indicator shows current level
- ✅ Buttons are responsive and work smoothly

### 18. Zoom Controls - Keyboard Shortcuts
**Steps:**
1. Open graph view
2. Hover mouse over canvas
3. Press Ctrl+Plus (or Cmd+Plus on Mac)
4. Press Ctrl+Minus
5. Press Ctrl+0

**Expected:**
- ✅ Ctrl+Plus zooms in
- ✅ Ctrl+Minus zooms out
- ✅ Ctrl+0 resets view
- ✅ Shortcuts only work when hovering canvas
- ✅ No conflicts with other Obsidian shortcuts

### 19. Pan Controls - Shift+Drag
**Steps:**
1. Open graph view
2. Hold Shift key
3. Click and drag with left mouse button

**Expected:**
- ✅ Canvas pans in direction of drag
- ✅ Cursor changes to "grabbing" during drag
- ✅ Panning is smooth and responsive
- ✅ Can pan in all directions
- ✅ Minimap viewport indicator updates

### 20. Pan Controls - Middle Mouse Button
**Steps:**
1. Open graph view
2. Click and drag with middle mouse button

**Expected:**
- ✅ Canvas pans without needing Shift key
- ✅ Cursor changes to "grabbing"
- ✅ Behavior identical to Shift+drag

### 21. Node Dragging
**Steps:**
1. Open graph view with multiple nodes
2. Click and drag a node with left mouse button (no Shift)
3. Release mouse button
4. Drag another node

**Expected:**
- ✅ Node follows cursor during drag
- ✅ Cursor changes to "move"
- ✅ Node position updates in real-time
- ✅ Edges update to follow node
- ✅ Manual position is preserved
- ✅ Other nodes remain in place

### 22. Reset Node Positions
**Steps:**
1. Open graph view
2. Drag several nodes to new positions
3. Click "Reset node positions" button (refresh icon)

**Expected:**
- ✅ All nodes return to automatic layout
- ✅ Manual position overrides are cleared
- ✅ Layout recalculates properly
- ✅ Graph remains functional

### 23. Mini-map Display
**Steps:**
1. Open graph view with 10+ nodes
2. Observe mini-map in top-right corner
3. Zoom and pan the main view

**Expected:**
- ✅ Mini-map shows overview of entire graph
- ✅ All nodes visible as small dots with correct colors
- ✅ Viewport rectangle shows current view area
- ✅ Viewport rectangle updates when panning/zooming
- ✅ Mini-map has dark background with border

### 24. Mini-map Toggle
**Steps:**
1. Open graph view
2. Click "Toggle minimap" button (map icon)
3. Click again to show

**Expected:**
- ✅ Mini-map disappears when toggled off
- ✅ Mini-map reappears when toggled on
- ✅ Button state is clear
- ✅ No layout issues when toggling

### 25. Node Tooltips - Basic Display
**Steps:**
1. Open graph view
2. Hover mouse over a node
3. Wait briefly
4. Move to another node

**Expected:**
- ✅ Tooltip appears near cursor
- ✅ Shows file name, path, status, depth
- ✅ Tooltip has dark background with border
- ✅ Text is readable and properly formatted
- ✅ Tooltip follows cursor to new node
- ✅ Tooltip disappears when leaving node

### 26. Node Tooltips - Rich Content
**Steps:**
1. Create nodes with different states
2. Hover over pending chat node
3. Hover over error node
4. Hover over cycle-detected node

**Expected:**
- ✅ Pending chat shows "Pending Chat" badge
- ✅ Error shows red error message
- ✅ Status icons match node status (○ ◐ ● ✗ ◉ ↻)
- ✅ All tooltips show "Click to open file" hint

### 27. Real-time Animation - Status Changes
**Steps:**
1. Create pending chat with linked files
2. Open graph view
3. Trigger resolution
4. Watch nodes as they resolve

**Expected:**
- ✅ Nodes show expanding glow animation on status change
- ✅ Animation lasts approximately 1 second
- ✅ Multiple nodes can animate simultaneously
- ✅ Animation is smooth at 60fps
- ✅ No performance issues during animation

### 28. Combined Interactions
**Steps:**
1. Open graph view
2. Zoom in to 2x
3. Pan to a different area
4. Drag a node to new position
5. Hover to see tooltip
6. Click node to navigate

**Expected:**
- ✅ All features work together seamlessly
- ✅ No conflicts between interactions
- ✅ Transforms apply correctly
- ✅ Tooltips position correctly after transforms
- ✅ Click detection works with transforms

### 29. Large Graph Performance
**Steps:**
1. Create graph with 100+ nodes
2. Open graph view
3. Test zoom, pan, drag operations
4. Observe animation performance

**Expected:**
- ✅ Initial render completes in < 1 second
- ✅ Zoom/pan remains smooth (60fps)
- ✅ Node dragging is responsive
- ✅ Mini-map updates without lag
- ✅ Animations run smoothly
- ✅ No console warnings about performance

## Visual Checks

### Color Accuracy
Compare rendered colors to specifications:
- Idle: Light gray/white
- Resolving: Purple with animated glow
- Complete: Bright green
- Error: Pink/red
- Cached: Blue
- Cycle: Orange

### Layout Quality
- Nodes don't overlap
- Edges don't cross unnecessarily
- Labels are readable
- Spacing is proportional
- Arrowheads point correctly

### Theme Consistency
- Dark background matches plugin theme
- Colors match cyber-neon aesthetic
- Hover effects are subtle
- Overall appearance is cohesive

## Browser Console Checks
- No errors logged during normal operation
- No warnings about missing resources
- Performance is acceptable (no lag warnings)

## Known Limitations
1. Very large graphs (200+ nodes) may experience some performance impact
2. View mode preference doesn't persist between sessions (future enhancement)
3. No physics-based force-directed layout option (future enhancement)
4. No graph export to image feature (future enhancement)

## Reporting Issues
When reporting issues, please include:
- Obsidian version
- Operating system
- Display resolution and DPI
- Steps to reproduce
- Screenshots or screen recording
- Browser console output
- Expected vs actual behavior
