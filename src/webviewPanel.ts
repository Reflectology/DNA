import * as vscode from 'vscode';
import { DiagramData, DiagramGenerator, RGB } from './diagramGenerator';

export class ReflectologyVisualizer {
    private static currentPanel: ReflectologyVisualizer | undefined;
    private static readonly STATE_KEY = 'reflectologySettings';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _state: vscode.Memento;
    
    private constructor(
        panel: vscode.WebviewPanel,
        diagramData: DiagramData,
        state: vscode.Memento
    ) {
        this._panel = panel;
        this._state = state;
        
        // Set the webview's content
        this._updateWebview(diagramData);
        this._sendTheme();
        const saved = this._state.get<any>(ReflectologyVisualizer.STATE_KEY, {});
        if (saved) {
            this._panel.webview.postMessage({ type: 'initialize', state: saved });
        }

        this._disposables.push(
            vscode.window.onDidChangeActiveColorTheme((theme) => {
                this._sendTheme(theme);
            })
        );

        this._panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'updateSetting') {
                    const current = this._state.get<any>(ReflectologyVisualizer.STATE_KEY, {});
                    current[message.key] = message.value;
                    this._state.update(ReflectologyVisualizer.STATE_KEY, current);
                }
            },
            undefined,
            this._disposables
        );
        
        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    
    static createOrShow(diagramData: DiagramData, state: vscode.Memento) {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
            
        // If we already have a panel, show it
        if (ReflectologyVisualizer.currentPanel) {
            ReflectologyVisualizer.currentPanel._panel.reveal(column);
            ReflectologyVisualizer.currentPanel._state = state;
            ReflectologyVisualizer.currentPanel._updateWebview(diagramData);
            const saved = state.get<any>(ReflectologyVisualizer.STATE_KEY, {});
            ReflectologyVisualizer.currentPanel._panel.webview.postMessage({ type: 'initialize', state: saved });
            return;
        }
        
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'reflectologyDiagram',
            'Reflectology Code Structure',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        ReflectologyVisualizer.currentPanel = new ReflectologyVisualizer(
            panel,
            diagramData,
            state
        );
    }
    
    private _updateWebview(diagramData: DiagramData) {
        this._panel.title = 'Reflectology Code Structure';
        this._panel.webview.html = this._getHtmlForWebview(diagramData);
    }

    private _sendTheme(theme: vscode.ColorTheme = vscode.window.activeColorTheme) {
        this._panel.webview.postMessage({
            type: 'themeInfo',
            themeKind: theme.kind
        });
    }
    
    private _getHtmlForWebview(diagramData: DiagramData): string {
        // Convert RGB to CSS color string
        const rgbToCSS = (rgb: RGB) => 
            `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})`;
            
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reflectology Code Structure</title>
                <script src="https://d3js.org/d3.v7.min.js"></script>
                <style>
                    body, html { 
                        margin: 0; 
                        padding: 0; 
                        width: 100%; 
                        height: 100%; 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, sans-serif;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    #layout {
                        display: flex;
                        height: 100vh;
                    }
                    #sidebar {
                        width: 220px;
                        overflow: auto;
                        border-right: 1px solid var(--vscode-editor-foreground);
                        padding: 8px;
                    }
                    #container {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                    }
                    #toolbar {
                        padding: 8px;
                        background: var(--vscode-editor-background);
                        border-bottom: 1px solid var(--vscode-editor-foreground);
                        display: flex;
                        flex-wrap: wrap;
                        gap: 12px;
                    }
                    details.toggle-group {
                        padding: 4px 8px;
                        background: var(--vscode-editor-background);
                        border-radius: 4px;
                    }
                    details.toggle-group summary {
                        cursor: pointer;
                        user-select: none;
                        font-weight: bold;
                    }
                    details.toggle-group > div {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        margin-top: 4px;
                    }
                    #diagram { 
                        flex-grow: 1;
                        overflow: hidden;
                    }
                    #info { 
                        height: 150px; 
                        padding: 12px; 
                        font-size: 14px; 
                        background: var(--vscode-editor-background);
                        overflow: auto;
                        border-top: 1px solid var(--vscode-editor-foreground);
                    }
                    #legend { 
                        margin-bottom: 8px; 
                        display: flex;
                        gap: 16px;
                        flex-wrap: wrap;
                    }
                    .legend-item {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .legend-color {
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        border-radius: 2px;
                    }
                    .node { 
                        stroke: #fff; 
                        stroke-width: 1.5px; 
                        cursor: pointer; 
                    }
                    .node.file { 
                        stroke: #444; 
                    }
                    .node.folder { 
                        stroke: #000; 
                        stroke-width: 2px;
                    }
                    .node.selected {
                        stroke: #ff6600;
                        stroke-width: 3px;
                    }
                    .node.canonical {
                        stroke: #00aa00;
                        stroke-width: 2.5px;
                    }
                    .link { 
                        stroke-opacity: 0.6; 
                    }
                    .uml-class {
                        fill: #f8f8f8;
                        stroke: #333;
                        stroke-width: 1px;
                    }
                    .uml-divider {
                        stroke: #333;
                        stroke-width: 1px;
                    }
                    .uml-text {
                        font-size: 10px;
                        text-anchor: start;
                    }
                    .uml-title {
                        font-size: 12px;
                        font-weight: bold;
                        text-anchor: middle;
                    }
                    .flow-arrow {
                        marker-end: url(#arrow);
                        stroke-width: 1.5px;
                        stroke: #666;
                    }
                    .orbit {
                        fill: none;
                        stroke-dasharray: 3,3;
                        stroke-width: 1.5;
                        opacity: 0.7;
                    }
                    .label {
                        font-size: 12px;
                        pointer-events: none;
                        text-shadow: 0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff;
                    }
                    button {
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-editor-foreground);
                        color: var(--vscode-editor-foreground);
                        border-radius: 3px;
                        padding: 4px 8px;
                        cursor: pointer;
                    }
                    button:hover {
                        background: var(--vscode-editor-foreground);
                        color: var(--vscode-editor-background);
                    }
                    select {
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-editor-foreground);
                        color: var(--vscode-editor-foreground);
                        border-radius: 3px;
                        padding: 3px;
                    }
                    .grid line {
                        stroke: #e0e0e0;
                        stroke-width: 0.5px;
                    }
                    .axes line {
                        stroke: #a0a0a0;
                        stroke-width: 1px;
                    }
                </style>
            </head>
            <body>
                <div id="layout">
                    <div id="sidebar">
                        <h3>Entities</h3>
                        <div id="tree"></div>
                    </div>
                    <div id="container">
                        <div id="toolbar">
                            <details class="toggle-group" open>
                                <summary>Display Options</summary>
                                <div>
                                    <label><input type="checkbox" id="showOrbits" checked>Show Orbits</label>
                                    <label><input type="checkbox" id="showAxes" checked>Show Axes</label>
                                    <label><input type="checkbox" id="highlightCanonical" checked>Highlight Canonical Forms</label>
                                    <label><input type="checkbox" id="showUML">UML Class View</label>
                                    <label><input type="checkbox" id="showFlowDependency">Flow Dependency</label>
                                    <label><input type="checkbox" id="showLabels" checked>Show Labels</label>
                                </div>
                            </details>
                            <details class="toggle-group" open>
                                <summary>Layout</summary>
                                <div>
                                    <label for="layoutType">Layout:</label>
                                    <select id="layoutType">
                                        <option value="force">Force-Directed</option>
                                        <option value="radial">Radial</option>
                                        <option value="hierarchical">Hierarchical</option>
                                    </select>
                                    <button id="resetLayout">Reset Layout</button>
                                    <button id="zoomToFit">Zoom to Fit</button>
                                </div>
                            </details>
                        </div>

                        <div id="diagram"></div>

                        <div id="info">
                        <div id="legend">
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: ${rgbToCSS(diagramData.config.orbitHighlightColor)}"></div>
                                <span>Orbit</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(0, 170, 0)"></div>
                                <span>Canonical Form</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(100, 100, 255)"></div>
                                <span>Axiom 32: Hierarchical Structuring</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(255, 120, 0)"></div>
                                <span>Axiom 33: Causality & Correlation</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(0, 160, 0)"></div>
                                <span>Axiom 40: Reflective Conjugate Duality</span>
                            </div>
                        </div>
                        <div id="nodeInfo">Click a node to see details</div>
                    </div>
                </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    window.addEventListener('message', (event) => {
                        const msg = event.data;
                        if (msg.type === 'themeInfo') {
                            document.body.dataset.themeKind = msg.themeKind;
                        } else if (msg.type === 'initialize') {
                            const st = msg.state || {};
                            document.getElementById('showOrbits').checked = st.showOrbits ?? true;
                            document.getElementById('showAxes').checked = st.showAxes ?? true;
                            document.getElementById('highlightCanonical').checked = st.highlightCanonical ?? true;
                            document.getElementById('showUML').checked = st.showUML ?? false;
                            document.getElementById('showFlowDependency').checked = st.showFlowDependency ?? false;
                            document.getElementById('showLabels').checked = st.showLabels ?? true;
                            document.getElementById('layoutType').value = st.layoutType || 'force';
                        }
                    });

                    // Configuration and data setup
                    const width = document.getElementById('diagram').clientWidth;
                    const height = document.getElementById('diagram').clientHeight;
                    const config = ${JSON.stringify(diagramData.config)};
                    const diagramData = ${JSON.stringify(diagramData)};

                    function buildTree() {
                        const container = document.getElementById('tree');
                        if (!container) return;
                        container.innerHTML = '';

                        const children = {};
                        diagramData.links.forEach(l => {
                            if (l.type === 'contains') {
                                if (!children[l.source]) children[l.source] = [];
                                children[l.source].push(l.target);
                            }
                        });

                        const nodesMap = {};
                        diagramData.nodes.forEach(n => { nodesMap[n.id] = n; });

                        const roots = diagramData.nodes.filter(n => !diagramData.links.some(l => l.type === 'contains' && l.target === n.id));

                        function createItem(id) {
                            const node = nodesMap[id];
                            const childIds = children[id] || [];
                            const li = document.createElement('li');
                            if (childIds.length) {
                                const details = document.createElement('details');
                                const summary = document.createElement('summary');
                                summary.textContent = node.name;
                                details.appendChild(summary);
                                const ul = document.createElement('ul');
                                childIds.forEach(c => ul.appendChild(createItem(c)));
                                details.appendChild(ul);
                                li.appendChild(details);
                            } else {
                                li.textContent = node.name;
                            }
                            li.addEventListener('click', e => {
                                e.stopPropagation();
                                const circle = document.querySelector("circle.node[data-id='" + id + "']");
                                if (circle) {
                                    showNodeInfo.call(circle, null, node);
                                }
                            });
                            return li;
                        }

                        const ul = document.createElement('ul');
                        roots.forEach(r => ul.appendChild(createItem(r.id)));
                        container.appendChild(ul);
                    }
                    
                    // Define colors for axioms
                    const axiomColors = {
                        "32": "rgb(100, 100, 255)", // Hierarchical Structuring (blue)
                        "33": "rgb(255, 120, 0)",   // Causality & Correlation (orange)
                        "40": "rgb(0, 160, 0)",     // Reflective Conjugate Duality (green)
                        "default": "rgb(128, 128, 128)" // Default (gray)
                    };
                    
                    // Create SVG
                    const svg = d3.select("#diagram")
                        .append("svg")
                        .attr("width", "100%")
                        .attr("height", "100%")
                        .attr("viewBox", [0, 0, width, height]);
                    
                    // Add zoom capabilities
                    const zoom = d3.zoom()
                        .scaleExtent([0.1, 10])
                        .on("zoom", (event) => {
                            g.attr("transform", event.transform);
                        });
                    
                    svg.call(zoom);
                    
                    // Create arrow marker for flow dependencies
                    svg.append("defs").append("marker")
                        .attr("id", "arrow")
                        .attr("viewBox", "0 -5 10 10")
                        .attr("refX", 15)
                        .attr("refY", 0)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto")
                        .append("path")
                        .attr("d", "M0,-5L10,0L0,5")
                        .attr("fill", "#666");
                    
                    // Create main group for zoom/pan
                    const g = svg.append("g");
                    
                    // Add background grid if config specifies it
                    if (config.showGrid) {
                        const gridColor = "${rgbToCSS(diagramData.config.gridColor)}";
                        const grid = g.append("g").attr("class", "grid");
                        
                        const gridSize = 50;
                        const numHLines = Math.ceil(height / gridSize);
                        const numVLines = Math.ceil(width / gridSize);
                        
                        for (let i = 0; i < numHLines; i++) {
                            grid.append("line")
                                .attr("x1", 0)
                                .attr("y1", i * gridSize)
                                .attr("x2", width)
                                .attr("y2", i * gridSize)
                                .attr("stroke", gridColor)
                                .attr("stroke-width", 0.5);
                        }
                        
                        for (let i = 0; i < numVLines; i++) {
                            grid.append("line")
                                .attr("x1", i * gridSize)
                                .attr("y1", 0)
                                .attr("x2", i * gridSize)
                                .attr("y2", height)
                                .attr("stroke", gridColor)
                                .attr("stroke-width", 0.5);
                        }
                    }
                    
                    // Add axes if config specifies it
                    if (config.showAxes) {
                        const axisColor = "${rgbToCSS(diagramData.config.axisColor)}";
                        const axes = g.append("g").attr("class", "axes");
                        
                        // X axis
                        axes.append("line")
                            .attr("x1", 0)
                            .attr("y1", height / 2)
                            .attr("x2", width)
                            .attr("y2", height / 2)
                            .attr("stroke", axisColor)
                            .attr("stroke-width", 1);
                        
                        // Y axis
                        axes.append("line")
                            .attr("x1", width / 2)
                            .attr("y1", 0)
                            .attr("x2", width / 2)
                            .attr("y2", height)
                            .attr("stroke", axisColor)
                            .attr("stroke-width", 1);
                    }

                    // Draw UML containers group (initially hidden)
                    const umlContainers = g.append("g")
                        .attr("class", "uml-containers")
                        .style("display", "none");

                    // Draw flow dependency arrows group (initially hidden)
                    const flowDependencies = g.append("g")
                        .attr("class", "flow-dependencies")
                        .style("display", "none");

                    // Initialize the force simulation
                    const simulation = d3.forceSimulation(diagramData.nodes)
                        .force("link", d3.forceLink(diagramData.links)
                            .id(d => d.id)
                            .distance(d => 100 / (d.weight || 1)))
                        .force("charge", d3.forceManyBody().strength(-300))
                        .force("center", d3.forceCenter(width / 2, height / 2));

                    // If nodes have pre-computed positions, use them
                    diagramData.nodes.forEach(node => {
                        if (node.position) {
                            node.fx = node.position.x;
                            node.fy = node.position.y;
                        }
                    });

                    // Draw orbits
                    const orbits = g.append("g")
                        .attr("class", "orbits")
                        .selectAll("path")
                        .data(diagramData.nodes.filter(d => d.orbit))
                        .join("path")
                        .attr("class", "orbit")
                        .attr("stroke", d => {
                            const ax = (d.axioms && d.axioms[0]) || "default";
                            return axiomColors[ax] || axiomColors["default"];
                        });
                    
                    // Draw links
                    const link = g.append("g")
                        .attr("stroke", "#999")
                        .selectAll("line")
                        .data(diagramData.links)
                        .join("line")
                        .attr("class", "link")
                        .attr("stroke-width", d => Math.sqrt(d.weight) * 1.5)
                        .attr("stroke", d => {
                            const ax = (d.axioms && d.axioms[0]) || "default";
                            return axiomColors[ax] || axiomColors["default"];
                        });

                    // Draw nodes
                    const node = g.append("g")
                        .selectAll("circle")
                        .data(diagramData.nodes)
                        .join("circle")
                        .attr("class", d => "node" + (d.canonical ? " canonical" : ""))
                        .attr("data-id", d => d.id)
                        .attr("r", d => d.canonical ? 12 : 8)
                        .attr("fill", d => {
                            if (d.goodness !== undefined) {
                                // Map goodness to color (red for low, green for high)
                                const normalized = 1.0 / (1.0 + Math.exp(-d.goodness * 5));
                                return \`rgb(\${Math.round((1-normalized) * 255)}, \${Math.round(normalized * 255)}, 0)\`;
                            }
                            
                            const ax = (d.axioms && d.axioms[0]) || "default";
                            return axiomColors[ax] || axiomColors["default"];
                        })
                        .call(drag(simulation))
                        .on("click", showNodeInfo);

                    // Node labels
                    const labels = g.append("g")
                        .selectAll("text")
                        .data(diagramData.nodes)
                        .join("text")
                        .attr("class", "label")
                        .attr("pointer-events", "none")
                        .attr("dx", 10)
                        .attr("dy", 3)
                        .text(d => d.name);
                    
                    // Create flow dependency arrows
                    function createFlowDependencies() {
                        flowDependencies.selectAll("*").remove();
                        
                        // Filter for dependency links
                        const depLinks = diagramData.links.filter(link => 
                            link.flowType || link.type === "calls" || link.type === "extends" || link.type === "imports");
                        
                        // Create curved paths for dependencies
                        flowDependencies.selectAll("path")
                            .data(depLinks)
                            .enter()
                            .append("path")
                            .attr("class", "flow-arrow")
                            .attr("stroke-width", d => (d.flowStrength || 1) * 1.5)
                            .attr("stroke", d => {
                                // Color based on flow type
                                switch(d.flowType) {
                                    case 'invocation': return "#6666cc"; // blue
                                    case 'inheritance': return "#66cc66"; // green
                                    case 'dependency': return "#cc6666"; // red
                                    case 'transformation': return "#cc66cc"; // purple
                                    default: return "#666666"; // gray
                                }
                            })
                            .attr("d", d => {
                                const sourceNode = diagramData.nodes.find(n => n.id === d.source);
                                const targetNode = diagramData.nodes.find(n => n.id === d.target);
                                if (!sourceNode || !targetNode) return "";
                                
                                // Calculate control point for curve
                                const dx = targetNode.x - sourceNode.x;
                                const dy = targetNode.y - sourceNode.y;
                                const dr = Math.sqrt(dx * dx + dy * dy);
                                
                                // Curved path with arrow
                                return \`M \${sourceNode.x} \${sourceNode.y} A \${dr} \${dr} 0 0 1 \${targetNode.x} \${targetNode.y}\`;
                            })
                            .append("title") // Add tooltip
                            .text(d => d.description || \`\${d.type}: \${d.source} → \${d.target}\`);
                    }
                    
                    // Create UML class diagrams
                    function createUMLDiagrams() {
                        umlContainers.selectAll("*").remove();
                        
                        const UML_WIDTH = 180;
                        const HEADER_HEIGHT = 30;
                        const FIELD_HEIGHT = 20;
                        const METHOD_HEIGHT = 20;
                        
                        diagramData.nodes.forEach(node => {
                            if (!node.x || !node.y) return; // Skip nodes without positions
                            
                            // Get UML data - either directly from umlClass or build from metrics
                            const fields = node.umlClass?.fields || [];
                            const methods = node.umlClass?.methods || [];
                            const fieldCount = fields.length || node.metrics.fieldCount || 0;
                            const methodCount = methods.length || node.metrics.methodCount || 0;
                            
                            // Calculate total height based on fields and methods
                            const totalHeight = HEADER_HEIGHT + 
                                (fieldCount * FIELD_HEIGHT) + 
                                (methodCount * METHOD_HEIGHT);
                            
                            // UML container
                            const container = umlContainers.append("g")
                                .attr("transform", \`translate(\${node.x - UML_WIDTH/2}, \${node.y - totalHeight/2})\`);
                            
                            // UML class rectangle
                            container.append("rect")
                                .attr("class", "uml-class")
                                .attr("width", UML_WIDTH)
                                .attr("height", totalHeight)
                                .attr("rx", 3);
                            
                            // Class name
                            container.append("text")
                                .attr("class", "uml-title")
                                .attr("x", UML_WIDTH / 2)
                                .attr("y", HEADER_HEIGHT / 2 + 5)
                                .text(node.name);
                                
                            // Divider line after header
                            container.append("line")
                                .attr("class", "uml-divider")
                                .attr("x1", 0)
                                .attr("y1", HEADER_HEIGHT)
                                .attr("x2", UML_WIDTH)
                                .attr("y2", HEADER_HEIGHT);
                                
                            // Fields section
                            if (fields.length > 0) {
                                fields.forEach((field, i) => {
                                    container.append("text")
                                        .attr("class", "uml-text")
                                        .attr("x", 10)
                                        .attr("y", HEADER_HEIGHT + (i + 0.5) * FIELD_HEIGHT)
                                        .text(field);
                                });
                            } else if (fieldCount > 0) {
                                // If we don't have actual field names but know the count
                                container.append("text")
                                    .attr("class", "uml-text")
                                    .attr("x", 10)
                                    .attr("y", HEADER_HEIGHT + FIELD_HEIGHT / 2)
                                    .text(\`Fields: \${fieldCount}\`);
                            }
                            
                            // Divider line between fields and methods
                            const fieldsHeight = fieldCount > 0 ? fieldCount * FIELD_HEIGHT : 0;
                            if (methodCount > 0) {
                                container.append("line")
                                    .attr("class", "uml-divider")
                                    .attr("x1", 0)
                                    .attr("y1", HEADER_HEIGHT + fieldsHeight)
                                    .attr("x2", UML_WIDTH)
                                    .attr("y2", HEADER_HEIGHT + fieldsHeight);
                                    
                                // Methods section
                                if (methods.length > 0) {
                                    methods.forEach((method, i) => {
                                        container.append("text")
                                            .attr("class", "uml-text")
                                            .attr("x", 10)
                                            .attr("y", HEADER_HEIGHT + fieldsHeight + (i + 0.5) * METHOD_HEIGHT)
                                            .text(\`\${method}()\`);
                                    });
                                } else {
                                    // If we don't have actual method names but know the count
                                    container.append("text")
                                        .attr("class", "uml-text")
                                        .attr("x", 10)
                                        .attr("y", HEADER_HEIGHT + fieldsHeight + METHOD_HEIGHT / 2)
                                        .text(\`Methods: \${methodCount}\`);
                                }
                            }
                        });
                    }
                    
                    // Show info when a node is clicked
                    function showNodeInfo(event, d) {
                        // Clear any previous selections
                        node.classed("selected", false);
                        
                        // Mark this node as selected
                        d3.select(this).classed("selected", true);
                        
                        const infoDiv = document.getElementById("nodeInfo");
                        
                        // Create a detailed info display
                        let info = \`<strong>\${d.name}</strong> (\${d.type || "unknown"})<br>\`;
                        
                        if (d.canonical) {
                            info += "<strong style='color:green'>Canonical Form</strong><br>";
                        }
                        
                        if (d.goodness !== undefined) {
                            info += \`Goodness: \${d.goodness.toFixed(2)}<br>\`;
                        }
                        
                        // Show metrics
                        info += "<strong>Metrics:</strong><br>";
                        for (const [key, value] of Object.entries(d.metrics || {})) {
                            info += \`· \${key}: \${value}<br>\`;
                        }
                        
                        // Show axioms
                        if (d.axioms && d.axioms.length > 0) {
                            info += "<strong>Axioms:</strong> " + d.axioms.join(", ");
                        }
                        
                        infoDiv.innerHTML = info;
                    }

                    // Event handlers for toggles
                    document.getElementById("showOrbits").addEventListener("change", function() {
                        orbits.style("visibility", this.checked ? "visible" : "hidden");
                        vscode.postMessage({ command: 'updateSetting', key: 'showOrbits', value: this.checked });
                    });
                    
                    document.getElementById("showAxes").addEventListener("change", function() {
                        g.selectAll(".axes, .grid").style("visibility", this.checked ? "visible" : "hidden");
                        vscode.postMessage({ command: 'updateSetting', key: 'showAxes', value: this.checked });
                    });
                    
                    document.getElementById("highlightCanonical").addEventListener("change", function() {
                        node.classed("canonical", n => this.checked && n.canonical);
                        vscode.postMessage({ command: 'updateSetting', key: 'highlightCanonical', value: this.checked });
                    });
                    
                    document.getElementById("showLabels").addEventListener("change", function() {
                        labels.style("visibility", this.checked ? "visible" : "hidden");
                        vscode.postMessage({ command: 'updateSetting', key: 'showLabels', value: this.checked });
                    });
                    
                    document.getElementById("showUML").addEventListener("change", function() {
                        if (this.checked) {
                            createUMLDiagrams();
                            umlContainers.style("display", "block");
                            node.style("visibility", "hidden");
                        } else {
                            umlContainers.style("display", "none");
                            node.style("visibility", "visible");
                        }
                        vscode.postMessage({ command: 'updateSetting', key: 'showUML', value: this.checked });
                    });
                    
                    document.getElementById("showFlowDependency").addEventListener("change", function() {
                        if (this.checked) {
                            createFlowDependencies();
                            flowDependencies.style("display", "block");
                            link.style("visibility", "hidden");
                        } else {
                            flowDependencies.style("display", "none");
                            link.style("visibility", "visible");
                        }
                        vscode.postMessage({ command: 'updateSetting', key: 'showFlowDependency', value: this.checked });
                    });
                    
                    // Layout selection
                    document.getElementById("layoutType").addEventListener("change", function() {
                        // Stop current simulation
                        simulation.stop();
                        
                        switch(this.value) {
                            case "force":
                                simulation
                                    .force("link", d3.forceLink(diagramData.links).id(d => d.id).distance(100))
                                    .force("charge", d3.forceManyBody().strength(-300))
                                    .force("center", d3.forceCenter(width / 2, height / 2))
                                    .alpha(1).restart();
                                break;
                                
                            case "radial":
                                simulation
                                    .force("link", null)
                                    .force("charge", d3.forceManyBody().strength(-100))
                                    .force("r", d3.forceRadial(height * 0.4, width/2, height/2))
                                    .force("center", d3.forceCenter(width / 2, height / 2))
                                    .alpha(1).restart();
                                break;
                                
                            case "hierarchical":
                                // Create a hierarchical layout
                                const stratify = d3.stratify()
                                    .id(d => d.id)
                                    .parentId(d => {
                                        // Find parent relationship
                                        const rel = diagramData.links.find(l => 
                                            l.target === d.id && l.type === "extends");
                                        return rel ? rel.source : null;
                                    });
                                
                                try {
                                    const root = stratify(diagramData.nodes);
                                    const treeLayout = d3.tree().size([width - 100, height - 100]);
                                    const nodes = treeLayout(root).descendants();
                                    
                                    // Apply positions
                                    nodes.forEach(n => {
                                        const node = diagramData.nodes.find(d => d.id === n.id);
                                        if (node) {
                                            node.fx = n.x + 50;
                                            node.fy = n.y + 50;
                                        }
                                    });
                                    
                                    simulation.alpha(0.1).restart();
                                } catch (e) {
                                    console.error("Couldn't create hierarchy:", e);
                                    alert("Couldn't create hierarchical layout: " + e.message);
                                }
                                break;
                        }
                        vscode.postMessage({ command: 'updateSetting', key: 'layoutType', value: this.value });
                    });
                    
                    // Reset layout button
                    document.getElementById("resetLayout").addEventListener("click", function() {
                        // Clear fixed positions
                        diagramData.nodes.forEach(node => {
                            node.fx = null;
                            node.fy = null;
                        });
                        
                        // Reset the simulation
                        simulation.alpha(1).restart();
                    });
                    
                    // Zoom to fit button
                    document.getElementById("zoomToFit").addEventListener("click", function() {
                        // Get bounds of all nodes
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        
                        diagramData.nodes.forEach(node => {
                            minX = Math.min(minX, node.x || 0);
                            minY = Math.min(minY, node.y || 0);
                            maxX = Math.max(maxX, node.x || 0);
                            maxY = Math.max(maxY, node.y || 0);
                        });
                        
                        // Add padding
                        const padding = 50;
                        minX -= padding;
                        minY -= padding;
                        maxX += padding;
                        maxY += padding;
                        
                        const diagramWidth = maxX - minX;
                        const diagramHeight = maxY - minY;
                        
                        // Calculate zoom scale
                        const scale = Math.min(width / diagramWidth, height / diagramHeight);
                        
                        // Calculate transform to center and scale
                        const transform = d3.zoomIdentity
                            .translate(width/2, height/2)
                            .scale(scale)
                            .translate(-(minX + maxX)/2, -(minY + maxY)/2);
                        
                        // Apply the zoom transform
                        svg.transition().duration(750).call(zoom.transform, transform);
                    });

                    // Update the simulation on each tick
                    simulation.on("tick", () => {
                        link
                            .attr("x1", d => d.source.x)
                            .attr("y1", d => d.source.y)
                            .attr("x2", d => d.target.x)
                            .attr("y2", d => d.target.y);

                        node
                            .attr("cx", d => d.x)
                            .attr("cy", d => d.y);

                        // Update labels
                        labels
                            .attr("x", d => d.x)
                            .attr("y", d => d.y);
                            
                        // Update orbit paths
                        orbits.attr("d", d => {
                            if (!d.orbit || !d.orbit.length) return "";
                            
                            // Create path through orbit points plus the node itself
                            const points = [...d.orbit, { x: d.x, y: d.y }];
                            const pathData = d3.line()
                                .x(p => p.x)
                                .y(p => p.y)
                                .curve(d3.curveCardinalClosed.tension(0.7))
                                (points);
                                
                            return pathData;
                        });
                        
                        // Update UML containers if visible
                        if (document.getElementById("showUML").checked) {
                            createUMLDiagrams();
                        }
                        
                        // Update flow dependencies if visible
                        if (document.getElementById("showFlowDependency").checked) {
                            createFlowDependencies();
                        }
                    });

                    // Drag functionality for nodes
                    function drag(simulation) {
                        function dragstarted(event, d) {
                            if (!event.active) simulation.alphaTarget(0.3).restart();
                            d.fx = d.x;
                            d.fy = d.y;
                        }
                        function dragged(event, d) {
                            d.fx = event.x;
                            d.fy = event.y;
                        }
                        function dragended(event, d) {
                            if (!event.active) simulation.alphaTarget(0);
                            // Don't reset fx/fy to allow manual positioning
                        }
                        return d3.drag()
                            .on("start", dragstarted)
                            .on("drag", dragged)
                            .on("end", dragended);
                    }
                    
                    // Initial call to zoom to fit
                    setTimeout(() => {
                        document.getElementById("zoomToFit").click();
                        buildTree();
                    }, 500);
                </script>
            </body>
            </html>
        `;
    }
    
    dispose() {
        ReflectologyVisualizer.currentPanel = undefined;
        
        // Clean up our resources
        this._panel.dispose();
        
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
