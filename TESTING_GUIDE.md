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
1. No zoom/pan controls (future enhancement)
2. No drag-to-reposition (future enhancement)
3. View mode doesn't persist (future enhancement)
4. Very large graphs (100+ nodes) may be hard to navigate

## Reporting Issues
When reporting issues, please include:
- Obsidian version
- Operating system
- Display resolution and DPI
- Steps to reproduce
- Screenshots or screen recording
- Browser console output
- Expected vs actual behavior
