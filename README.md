# M0WER - Math 0nce, Write/Work Everywhere, Really

M0WER is the vision became reality of math once as a blueprint that writes and works everywhere.


## Features

- Visualizes your entire codebase as an interactive graph (force, tree, cluster, radial, and more)
- Entity tree view for folders, files, and functions
- Click or double-click nodes to highlight and jump to code in the editor
- Metrics panel shows complexity, utility, cost, and line count for each node
- UML class diagram overlays for files and classes
- Dependency, import, and call relationships visualized as edges
- Multiple D3 layouts: force-directed, tree, cluster, radial, partition, treemap, etc.
- Resizable and dockable panels, just like native VS Code
- Quick side panel access to all visualization options (no need for Ctrl+Shift+P)
- Works with any language/codebase (token-based analysis)


## Usage

1. Install the extension from the VSIX or Marketplace.
2. Open a folder or workspace in VS Code.
3. Click the "M0WER" icon in the side panel to open the visualizer and entity tree.
4. Click "Visualize Codebase Structure" or "Generate Diagram" from the side panel options.
5. Explore your codebase using the interactive diagram and entity tree.
6. Click or double-click any node or entity to highlight and jump to its code in the editor.
7. Select a node to view detailed metrics and UML info in the Metrics panel.
8. Use the layout dropdown to switch between force, tree, cluster, radial, and other views.
9. Drag the panel dividers to resize the diagram, info, and toolbar areas as needed.


![image](https://github.com/Reflectology/DNA/blob/main/resources/coloredmower.png)
## Metrics

Each file node in the diagram displays several metrics:

- **complexity** – approximate nesting depth discovered during analysis.
- **utility** – number of detected functions in the file.
- **cost** – placeholder cost metric.
- **lineCount** – total number of lines in the file.

Select a node in the diagram to view these values in the information panel.
