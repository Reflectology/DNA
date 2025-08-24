import * as vscode from 'vscode';
import { DiagramData, DiagramGenerator, RGB } from './diagramGenerator';

export class mower {
    private static currentPanel: mower | undefined;
    private static readonly STATE_KEY = 'm0werSettings';
    private static nodeSelectedEmitter = new vscode.EventEmitter<any>();
    public static readonly onNodeSelected = mower.nodeSelectedEmitter.event;
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
        const saved = this._state.get<any>(mower.STATE_KEY, {});
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
                    const current = this._state.get<any>(mower.STATE_KEY, {});
                    current[message.key] = message.value;
                    this._state.update(mower.STATE_KEY, current);
                } else if (message.command === 'nodeSelected') {
                    mower.nodeSelectedEmitter.fire(message.node);
                } else if (message.command === 'revealInEditor' && message.nodeId) {
                    // Forward to extension host to reveal code
                    vscode.commands.executeCommand('mower.revealInEditor', message.nodeId);
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
        if (mower.currentPanel) {
            mower.currentPanel._panel.reveal(column);
            mower.currentPanel._state = state;
            mower.currentPanel._updateWebview(diagramData);
            const saved = state.get<any>(mower.STATE_KEY, {});
            mower.currentPanel._panel.webview.postMessage({ type: 'initialize', state: saved });
            return;
        }
        
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'm0werDiagram',
            'M0WER Visualization',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        mower.currentPanel = new mower(
            panel,
            diagramData,
            state
        );
    }

    static highlightNode(id: string) {
        if (mower.currentPanel) {
            mower.currentPanel._panel.webview.postMessage({ type: 'highlightNode', id });
            // Also send zoomToNode message
            mower.currentPanel._panel.webview.postMessage({ type: 'zoomToNode', id });
        }
    }
    
    private _updateWebview(diagramData: DiagramData) {
        this._panel.title = 'm0wer Code Structure';
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
            "rgb(" + Math.round(rgb.r * 255) + ", " + Math.round(rgb.g * 255) + ", " + Math.round(rgb.b * 255) + ")";
            
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>m0wer Code Structure</title>
                <!-- Using native W3C standards instead of D3.js -->
                <style>
                    body, html { 
                        margin: 0; 
                        padding: 0; 
                        width: 100%; 
                        height: 100%; 
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, sans-serif);
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    #layout {
                        display: flex;
                        height: 100vh;
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
                        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, sans-serif);
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
                    <div id="container">
                        <div id="toolbar">
                            <details class="toggle-group" open>
                                <summary>Display Options</summary>
                                <div>
                                    <label><input type="checkbox" id="showOrbits" checked>Show Module Groups</label>
                                    <label><input type="checkbox" id="showAxes" checked>Show Axes</label>
                                    <label><input type="checkbox" id="highlightCanonical" checked>Highlight Reference Implementations</label>
                                    <label><input type="checkbox" id="showUML">Class Diagram</label>
                                    <label><input type="checkbox" id="showFlowDependency">Data/Control Flow</label>
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
                                <span>Module Group / Cluster</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(0, 170, 0)"></div>
                                <span>Reference Implementation</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(100, 100, 255)"></div>
                                <span>Hierarchy (Inheritance/Containment)</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(255, 120, 0)"></div>
                                <span>Dependency (Calls/Uses)</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: rgb(0, 160, 0)"></div>
                                <span>Mutual Dependency (Cyclic Reference)</span>
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
                        } else if (msg.type === 'highlightNode') {
                            const circle = document.querySelector("circle.node[data-id='" + msg.id + "']");
                            if (circle) {
                                const nodeData = diagramData.nodes.find(n => n.id === msg.id);
                                if (nodeData) {
                                    showNodeInfo.call(circle, null, nodeData);
                                }
                            }
                        }
                        else if (msg.type === 'zoomToNode') {
                            const nodeData = diagramData.nodes.find(n => n.id === msg.id);
                            if (nodeData && typeof nodeData.x === 'number' && typeof nodeData.y === 'number') {
                                // Zoom to node position using native W3C standards
                                const svgElem = document.querySelector("#diagram svg");
                                const mainGroup = svgElem.querySelector('.main-group');
                                const width = svgElem.viewBox.baseVal.width || svgElem.clientWidth;
                                const height = svgElem.viewBox.baseVal.height || svgElem.clientHeight;
                                const zoomScale = 2.5;
                                const tx = width / 2 - nodeData.x * zoomScale;
                                const ty = height / 2 - nodeData.y * zoomScale;
                                
                                // Use CSS transforms for smooth animation
                                mainGroup.style.transition = 'transform 0.6s ease-in-out';
                                mainGroup.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + zoomScale + ")";
                                currentZoom = { tx, ty, scale: zoomScale };
                            }
                        }
                    });

                    // Configuration and data setup
                    const width = document.getElementById('diagram').clientWidth;
                    const height = document.getElementById('diagram').clientHeight;
                    const config = ${JSON.stringify(diagramData.config)};
                    const diagramData = ${JSON.stringify(diagramData)};

                    
                    // Update axiomColors mapping for legend and tooltips
                    const axiomColors = {
                        "32": "rgb(100, 100, 255)", // Hierarchy (blue)
                        "33": "rgb(255, 120, 0)",   // Dependency (orange)
                        "40": "rgb(0, 160, 0)",     // Mutual Dependency (green)
                        "default": "rgb(128, 128, 128)" // Default (gray)
                    };
                    
                    // Create SVG using native DOM APIs
                    const diagramDiv = document.getElementById('diagram');
                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('width', '100%');
                    svg.setAttribute('height', '100%');
                    svg.setAttribute('viewBox', "0 0 " + width + " " + height);
                    diagramDiv.appendChild(svg);
                    
                    // Track zoom state
                    let currentZoom = { tx: 0, ty: 0, scale: 1 };
                    let isDragging = false;
                    let dragStart = { x: 0, y: 0 };
                    
                    // Native zoom and pan using pointer events
                    function setupZoomPan(svg) {
                        const mainGroup = svg.querySelector('.main-group');
                        
                        svg.addEventListener('wheel', (event) => {
                            event.preventDefault();
                            const rect = svg.getBoundingClientRect();
                            const x = event.clientX - rect.left;
                            const y = event.clientY - rect.top;
                            const delta = event.deltaY > 0 ? 0.9 : 1.1;
                            
                            currentZoom.scale = Math.max(0.1, Math.min(10, currentZoom.scale * delta));
                            
                            // Zoom toward mouse position
                            const dx = (x - width/2) * (delta - 1);
                            const dy = (y - height/2) * (delta - 1);
                            currentZoom.tx -= dx;
                            currentZoom.ty -= dy;
                            
                            mainGroup.style.transform = "translate(" + currentZoom.tx + "px, " + currentZoom.ty + "px) scale(" + currentZoom.scale + ")";
                        });
                        
                        svg.addEventListener('pointerdown', (event) => {
                            if (event.target === svg || event.target === mainGroup) {
                                isDragging = true;
                                dragStart = { x: event.clientX, y: event.clientY };
                                svg.style.cursor = 'grabbing';
                                event.preventDefault();
                            }
                        });
                        
                        svg.addEventListener('pointermove', (event) => {
                            if (isDragging) {
                                const dx = event.clientX - dragStart.x;
                                const dy = event.clientY - dragStart.y;
                                currentZoom.tx += dx / currentZoom.scale;
                                currentZoom.ty += dy / currentZoom.scale;
                                mainGroup.style.transform = "translate(" + currentZoom.tx + "px, " + currentZoom.ty + "px) scale(" + currentZoom.scale + ")";
                                dragStart = { x: event.clientX, y: event.clientY };
                            }
                        });
                        
                        svg.addEventListener('pointerup', () => {
                            isDragging = false;
                            svg.style.cursor = 'grab';
                        });
                        
                        svg.style.cursor = 'grab';
                    }
                    
                    // Create arrow marker for flow dependencies using native APIs
                    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                    marker.setAttribute('id', 'arrow');
                    marker.setAttribute('viewBox', '0 -5 10 10');
                    marker.setAttribute('refX', '15');
                    marker.setAttribute('refY', '0');
                    marker.setAttribute('markerWidth', '6');
                    marker.setAttribute('markerHeight', '6');
                    marker.setAttribute('orient', 'auto');
                    
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', 'M0,-5L10,0L0,5');
                    path.setAttribute('fill', '#666');
                    marker.appendChild(path);
                    defs.appendChild(marker);
                    svg.appendChild(defs);
                    
                    // Create main group for zoom/pan
                    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    g.classList.add('main-group');
                    svg.appendChild(g);
                    
                    // Setup zoom and pan functionality
                    setupZoomPan(svg);
                    
                    // Add background grid if config specifies it using native APIs
                    if (config.showGrid) {
                        const gridColor = "${rgbToCSS(diagramData.config.gridColor)}";
                        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                        grid.classList.add('grid');
                        
                        const gridSize = 50;
                        const numHLines = Math.ceil(height / gridSize);
                        const numVLines = Math.ceil(width / gridSize);
                        
                        for (let i = 0; i < numHLines; i++) {
                            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                            line.setAttribute('x1', '0');
                            line.setAttribute('y1', i * gridSize);
                            line.setAttribute('x2', width);
                            line.setAttribute('y2', i * gridSize);
                            line.setAttribute('stroke', gridColor);
                            line.setAttribute('stroke-width', '0.5');
                            grid.appendChild(line);
                        }
                        
                        for (let i = 0; i < numVLines; i++) {
                            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                            line.setAttribute('x1', i * gridSize);
                            line.setAttribute('y1', '0');
                            line.setAttribute('x2', i * gridSize);
                            line.setAttribute('y2', height);
                            line.setAttribute('stroke', gridColor);
                            line.setAttribute('stroke-width', '0.5');
                            grid.appendChild(line);
                        }
                        g.appendChild(grid);
                    }
                    
                    // Add axes if config specifies it using native APIs
                    if (config.showAxes) {
                        const axisColor = "${rgbToCSS(diagramData.config.axisColor)}";
                        const axes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                        axes.classList.add('axes');
                        
                        // X axis
                        const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        xAxis.setAttribute('x1', '0');
                        xAxis.setAttribute('y1', height / 2);
                        xAxis.setAttribute('x2', width);
                        xAxis.setAttribute('y2', height / 2);
                        xAxis.setAttribute('stroke', axisColor);
                        xAxis.setAttribute('stroke-width', '1');
                        axes.appendChild(xAxis);
                        
                        // Y axis
                        const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        yAxis.setAttribute('x1', width / 2);
                        yAxis.setAttribute('y1', '0');
                        yAxis.setAttribute('x2', width / 2);
                        yAxis.setAttribute('y2', height);
                        yAxis.setAttribute('stroke', axisColor);
                        yAxis.setAttribute('stroke-width', '1');
                        axes.appendChild(yAxis);
                        
                        g.appendChild(axes);
                    }

                    // Draw UML containers group (initially hidden) using native APIs
                    const umlContainers = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    umlContainers.classList.add('uml-containers');
                    umlContainers.style.display = 'none';
                    g.appendChild(umlContainers);

                    // Draw flow dependency arrows group (initially hidden) using native APIs
                    const flowDependencies = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    flowDependencies.classList.add('flow-dependencies');
                    flowDependencies.style.display = 'none';
                    g.appendChild(flowDependencies);

                    // Simple physics-based layout using native JavaScript instead of D3 force simulation
                    class SimplePhysics {
                        constructor(nodes, links, width, height) {
                            this.nodes = nodes;
                            this.links = links;
                            this.width = width;
                            this.height = height;
                            this.running = false;
                            
                            // Initialize positions if not set
                            this.nodes.forEach((node, i) => {
                                if (typeof node.x !== 'number') {
                                    node.x = Math.random() * width;
                                }
                                if (typeof node.y !== 'number') {
                                    node.y = Math.random() * height;
                                }
                                node.vx = 0;
                                node.vy = 0;
                            });
                        }
                        
                        start() {
                            this.running = true;
                            this.animate();
                        }
                        
                        stop() {
                            this.running = false;
                        }
                        
                        animate() {
                            if (!this.running) return;
                            
                            this.tick();
                            requestAnimationFrame(() => this.animate());
                        }
                        
                        tick() {
                            const alpha = 0.1;
                            
                            // Apply forces
                            this.nodes.forEach(node => {
                                // Center force
                                node.vx += (this.width / 2 - node.x) * 0.01;
                                node.vy += (this.height / 2 - node.y) * 0.01;
                                
                                // Repulsion between nodes
                                this.nodes.forEach(other => {
                                    if (node !== other) {
                                        const dx = node.x - other.x;
                                        const dy = node.y - other.y;
                                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                                        const force = 300 / (distance * distance);
                                        node.vx += dx * force;
                                        node.vy += dy * force;
                                    }
                                });
                            });
                            
                            // Link forces
                            this.links.forEach(link => {
                                const source = this.nodes.find(n => n.id === link.source.id || n.id === link.source);
                                const target = this.nodes.find(n => n.id === link.target.id || n.id === link.target);
                                if (source && target) {
                                    const dx = target.x - source.x;
                                    const dy = target.y - source.y;
                                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                                    const targetDistance = 100 / (link.weight || 1);
                                    const force = (distance - targetDistance) * 0.1;
                                    const fx = dx * force / distance;
                                    const fy = dy * force / distance;
                                    
                                    source.vx += fx;
                                    source.vy += fy;
                                    target.vx -= fx;
                                    target.vy -= fy;
                                }
                            });
                            
                            // Update positions
                            this.nodes.forEach(node => {
                                if (!node.fx && !node.fy) {
                                    node.vx *= 0.9; // Friction
                                    node.vy *= 0.9;
                                    node.x += node.vx;
                                    node.y += node.vy;
                                }
                            });
                            
                            // Notify listeners
                            if (this.ontick) this.ontick();
                        }
                    }

                    const simulation = new SimplePhysics(diagramData.nodes, diagramData.links, width, height);

                    // If nodes have pre-computed positions, use them
                    diagramData.nodes.forEach(node => {
                        if (node.position) {
                            node.fx = node.position.x;
                            node.fy = node.position.y;
                        }
                    });

                    // Draw orbits using native APIs
                    const orbitsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    orbitsGroup.classList.add('orbits');
                    g.appendChild(orbitsGroup);
                    
                    const orbits = [];
                    diagramData.nodes.filter(d => d.orbit).forEach(d => {
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.classList.add('orbit');
                        const ax = (d.axioms && d.axioms[0]) || "default";
                        path.setAttribute('stroke', axiomColors[ax] || axiomColors["default"]);
                        
                        // Create orbit path (simplified circular orbit)
                        const radius = 100 + Math.random() * 50;
                        const cx = width / 2;
                        const cy = height / 2;
                        path.setAttribute('d', "M " + (cx + radius) + "," + cy + " A " + radius + "," + radius + " 0 1,1 " + (cx - radius) + "," + cy + " A " + radius + "," + radius + " 0 1,1 " + (cx + radius) + "," + cy);
                        
                        orbitsGroup.appendChild(path);
                        orbits.push(path);
                    });
                        });
                    
                    // Draw links using native APIs
                    const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    linkGroup.setAttribute('stroke', '#999');
                    const links = [];
                    
                    diagramData.links.forEach(linkData => {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.classList.add('link');
                        line.setAttribute('stroke-width', Math.sqrt(linkData.weight) * 1.5);
                        const ax = (linkData.axioms && linkData.axioms[0]) || "default";
                        line.setAttribute('stroke', axiomColors[ax] || axiomColors["default"]);
                        linkGroup.appendChild(line);
                        links.push({ element: line, data: linkData });
                    });
                    g.appendChild(linkGroup);

                    // Draw nodes using native APIs
                    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    const nodes = [];
                    
                    diagramData.nodes.forEach(nodeData => {
                        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        circle.classList.add('node');
                        if (nodeData.canonical) circle.classList.add('canonical');
                        circle.setAttribute('data-id', nodeData.id);
                        circle.setAttribute('r', nodeData.canonical ? 12 : 8);
                        
                        // Set fill color
                        if (nodeData.goodness !== undefined) {
                            const normalized = 1.0 / (1.0 + Math.exp(-nodeData.goodness * 5));
                            const r = Math.round((1-normalized) * 255);
                            const g = Math.round(normalized * 255);
                            circle.setAttribute('fill', "rgb(" + r + ", " + g + ", 0)");
                        } else {
                            const ax = (nodeData.axioms && nodeData.axioms[0]) || "default";
                            circle.setAttribute('fill', axiomColors[ax] || axiomColors["default"]);
                        }
                        
                        // Add click handler
                        circle.addEventListener('click', () => showNodeInfo(nodeData));
                        
                        // Add drag functionality
                        setupNodeDrag(circle, nodeData, simulation);
                        
                        nodeGroup.appendChild(circle);
                        nodes.push({ element: circle, data: nodeData });
                    });
                    g.appendChild(nodeGroup);

                    // Node labels using native APIs
                    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    const labels = [];
                    
                    diagramData.nodes.forEach(nodeData => {
                        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        text.classList.add('label');
                        text.setAttribute('pointer-events', 'none');
                        text.setAttribute('dx', '10');
                        text.setAttribute('dy', '3');
                        text.textContent = nodeData.name;
                        labelGroup.appendChild(text);
                        labels.push({ element: text, data: nodeData });
                    });
                    g.appendChild(labelGroup);
                    
                    // Drag functionality for nodes
                    function setupNodeDrag(element, nodeData, simulation) {
                        let isDragging = false;
                        
                        element.addEventListener('pointerdown', (event) => {
                            isDragging = true;
                            nodeData.fx = nodeData.x;
                            nodeData.fy = nodeData.y;
                            element.style.cursor = 'grabbing';
                            event.stopPropagation();
                            event.preventDefault();
                        });
                        
                        document.addEventListener('pointermove', (event) => {
                            if (isDragging) {
                                const rect = svg.getBoundingClientRect();
                                const svgX = (event.clientX - rect.left - currentZoom.tx) / currentZoom.scale;
                                const svgY = (event.clientY - rect.top - currentZoom.ty) / currentZoom.scale;
                                nodeData.fx = svgX;
                                nodeData.fy = svgY;
                                nodeData.x = svgX;
                                nodeData.y = svgY;
                            }
                        });
                        
                        document.addEventListener('pointerup', () => {
                            if (isDragging) {
                                isDragging = false;
                                element.style.cursor = 'grab';
                                // Don't reset fx/fy to allow manual positioning
                            }
                        });
                        
                        element.style.cursor = 'grab';
                    }
                    
                    // Create flow dependency arrows using native APIs
                    function createFlowDependencies() {
                        // Clear existing flow dependencies
                        flowDependencies.innerHTML = '';
                        
                        // Filter for dependency links
                        const depLinks = diagramData.links.filter(link => 
                            link.flowType || link.type === "calls" || link.type === "extends" || link.type === "imports");
                        
                        depLinks.forEach(d => {
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.classList.add('flow-arrow');
                            path.setAttribute('stroke-width', (d.flowStrength || 1) * 1.5);
                            
                            // Color based on flow type
                            let color;
                            switch(d.flowType) {
                                case 'invocation': color = "#6666cc"; break;
                                case 'inheritance': color = "#66cc66"; break; 
                                case 'dependency': color = "#cc6666"; break;
                                case 'transformation': color = "#cc66cc"; break;
                                default: color = "#666666";
                            }
                            path.setAttribute('stroke', color);
                            
                            // Calculate path
                            const sourceNode = diagramData.nodes.find(n => n.id === d.source);
                            const targetNode = diagramData.nodes.find(n => n.id === d.target);
                            if (sourceNode && targetNode) {
                                const dx = targetNode.x - sourceNode.x;
                                const dy = targetNode.y - sourceNode.y;
                                const dr = Math.sqrt(dx * dx + dy * dy);
                                
                                // Curved path with arrow
                                path.setAttribute('d', "M " + sourceNode.x + " " + sourceNode.y + " A " + dr + " " + dr + " 0 0 1 " + targetNode.x + " " + targetNode.y);
                                
                                // Add tooltip
                                const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                                title.textContent = d.description || d.type + ": " + d.source + " → " + d.target;
                                path.appendChild(title);
                            }
                            
                            flowDependencies.appendChild(path);
                        });
                    }
                    
                    // Create UML class diagrams using native APIs
                    function createUMLDiagrams() {
                        // Clear existing UML diagrams
                        umlContainers.innerHTML = '';
                        
                        const UML_WIDTH = 180;
                        const HEADER_HEIGHT = 30;
                        const FIELD_HEIGHT = 20;
                        const METHOD_HEIGHT = 20;
                        
                        diagramData.nodes.forEach(node => {
                            if (!node.x || !node.y) return;
                            
                            // Get UML data
                            const fields = node.umlClass?.fields || [];
                            const methods = node.umlClass?.methods || [];
                            const fieldCount = fields.length || node.metrics.fieldCount || 0;
                            const methodCount = methods.length || node.metrics.methodCount || 0;
                            
                            // Calculate total height
                            const totalHeight = HEADER_HEIGHT + 
                                (fieldCount * FIELD_HEIGHT) + 
                                (methodCount * METHOD_HEIGHT);
                            
                            // UML container group
                            const container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                            container.setAttribute('transform', "translate(" + (node.x - UML_WIDTH/2) + ", " + (node.y - totalHeight/2) + ")");
                            
                            // UML class rectangle
                            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                            rect.classList.add('uml-class');
                            rect.setAttribute('width', UML_WIDTH);
                            rect.setAttribute('height', totalHeight);
                            rect.setAttribute('rx', '3');
                            container.appendChild(rect);
                            
                            // Class name
                            const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                            title.classList.add('uml-title');
                            title.setAttribute('x', UML_WIDTH / 2);
                            title.setAttribute('y', HEADER_HEIGHT / 2 + 5);
                            title.textContent = node.name;
                            container.appendChild(title);
                            
                            // Header divider
                            const headerDivider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                            headerDivider.classList.add('uml-divider');
                            headerDivider.setAttribute('x1', '0');
                            headerDivider.setAttribute('y1', HEADER_HEIGHT);
                            headerDivider.setAttribute('x2', UML_WIDTH);
                            headerDivider.setAttribute('y2', HEADER_HEIGHT);
                            container.appendChild(headerDivider);
                            
                            // Fields section
                            if (fields.length > 0) {
                                fields.forEach((field, i) => {
                                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                                    text.classList.add('uml-text');
                                    text.setAttribute('x', '10');
                                    text.setAttribute('y', HEADER_HEIGHT + (i + 0.5) * FIELD_HEIGHT);
                                    text.textContent = field;
                                    container.appendChild(text);
                                });
                            } else if (fieldCount > 0) {
                                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                                text.classList.add('uml-text');
                                text.setAttribute('x', '10');
                                text.setAttribute('y', HEADER_HEIGHT + FIELD_HEIGHT / 2);
                                text.textContent = "Fields: " + fieldCount;
                                container.appendChild(text);
                            }
                            
                            // Methods divider and section
                            const fieldsHeight = fieldCount > 0 ? fieldCount * FIELD_HEIGHT : 0;
                            if (methodCount > 0) {
                                const methodDivider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                                methodDivider.classList.add('uml-divider');
                                methodDivider.setAttribute('x1', '0');
                                methodDivider.setAttribute('y1', HEADER_HEIGHT + fieldsHeight);
                                methodDivider.setAttribute('x2', UML_WIDTH);
                                methodDivider.setAttribute('y2', HEADER_HEIGHT + fieldsHeight);
                                container.appendChild(methodDivider);
                                
                                if (methods.length > 0) {
                                    methods.forEach((method, i) => {
                                        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                                        text.classList.add('uml-text');
                                        text.setAttribute('x', '10');
                                        text.setAttribute('y', HEADER_HEIGHT + fieldsHeight + (i + 0.5) * METHOD_HEIGHT);
                                        text.textContent = method + "()";
                                        container.appendChild(text);
                                    });
                                } else {
                                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                                    text.classList.add('uml-text');
                                    text.setAttribute('x', '10');
                                    text.setAttribute('y', HEADER_HEIGHT + fieldsHeight + METHOD_HEIGHT / 2);
                                    text.textContent = "Methods: " + methodCount;
                                    container.appendChild(text);
                                }
                            }
                            
                            umlContainers.appendChild(container);
                        });
                    }
                    
                    // Show info when a node is clicked using native APIs
                    function showNodeInfo(d) {
                        // Clear previous selections
                        nodes.forEach(nodeObj => {
                            nodeObj.element.classList.remove('selected');
                        });

                        // Find and select this node  
                        const selectedNode = nodes.find(nodeObj => nodeObj.data.id === d.id);
                        if (selectedNode) {
                            selectedNode.element.classList.add('selected');
                        }
                        
                        const infoDiv = document.getElementById("nodeInfo");
                        
                        let info = "<strong>" + d.name + "</strong> (" + (d.type || "unknown") + ")<br>";
                        
                        if (d.canonical) {
                            info += "<strong style='color:green'>Reference Implementation</strong><br>";
                        }
                        
                        if (d.goodness !== undefined) {
                            info += "Maintainability: " + d.goodness.toFixed(2) + "<br>";
                        }
                        
                        // Show metrics
                        info += "<strong>Metrics:</strong><br>";
                        for (const [key, value] of Object.entries(d.metrics || {})) {
                            let label = key;
                            if (key === "utility") label = "Function Count";
                            if (key === "cost") label = "Complexity";
                            if (key === "goodness") label = "Maintainability";
                            info += "· " + label + ": " + value + "<br>";
                        }
                        
                        // Show axioms
                        if (d.axioms && d.axioms.length > 0) {
                            const axiomMap = {
                                "32": "Hierarchy",
                                "33": "Dependency", 
                                "40": "Mutual Dependency"
                            };
                            info += "<strong>Relationships:</strong> " + d.axioms.map(ax => axiomMap[ax] || ax).join(", ");
                        }
                        
                        infoDiv.innerHTML = info;
                        vscode.postMessage({ command: 'nodeSelected', node: d });
                    }


                    // Setup simulation tick handler and start
                    simulation.ontick = () => {
                        // Update link positions
                        links.forEach(linkObj => {
                            const source = diagramData.nodes.find(n => n.id === linkObj.data.source.id || n.id === linkObj.data.source);
                            const target = diagramData.nodes.find(n => n.id === linkObj.data.target.id || n.id === linkObj.data.target);
                            if (source && target) {
                                linkObj.element.setAttribute('x1', source.x);
                                linkObj.element.setAttribute('y1', source.y);
                                linkObj.element.setAttribute('x2', target.x);
                                linkObj.element.setAttribute('y2', target.y);
                            }
                        });
                        
                        // Update node positions
                        nodes.forEach(nodeObj => {
                            nodeObj.element.setAttribute('cx', nodeObj.data.x);
                            nodeObj.element.setAttribute('cy', nodeObj.data.y);
                        });
                        
                        // Update label positions
                        labels.forEach(labelObj => {
                            labelObj.element.setAttribute('x', labelObj.data.x + 10);
                            labelObj.element.setAttribute('y', labelObj.data.y + 3);
                        });
                        
                        // Update UML containers if visible
                        if (document.getElementById("showUML").checked) {
                            createUMLDiagrams();
                        }
                        
                        // Update flow dependencies if visible
                        if (document.getElementById("showFlowDependency").checked) {
                            createFlowDependencies();
                        }
                    };
                    
                    simulation.start();

                    // Event handlers for toggles using native APIs
                    document.getElementById("showOrbits").addEventListener("change", function() {
                        orbitsGroup.style.visibility = this.checked ? "visible" : "hidden";
                        vscode.postMessage({ command: 'updateSetting', key: 'showOrbits', value: this.checked });
                    });
                    
                    document.getElementById("showAxes").addEventListener("change", function() {
                        const axesGridElements = g.querySelectorAll(".axes, .grid");
                        axesGridElements.forEach(el => {
                            el.style.visibility = this.checked ? "visible" : "hidden";
                        });
                        vscode.postMessage({ command: 'updateSetting', key: 'showAxes', value: this.checked });
                    });
                    
                    document.getElementById("highlightCanonical").addEventListener("change", function() {
                        nodes.forEach(nodeObj => {
                            if (this.checked && nodeObj.data.canonical) {
                                nodeObj.element.classList.add("canonical");
                            } else {
                                nodeObj.element.classList.remove("canonical");
                            }
                        });
                        vscode.postMessage({ command: 'updateSetting', key: 'highlightCanonical', value: this.checked });
                    });
                    
                    document.getElementById("showLabels").addEventListener("change", function() {
                        labelGroup.style.visibility = this.checked ? "visible" : "hidden";
                        vscode.postMessage({ command: 'updateSetting', key: 'showLabels', value: this.checked });
                    });
                    
                    document.getElementById("showUML").addEventListener("change", function() {
                        if (this.checked) {
                            createUMLDiagrams();
                            umlContainers.style.display = "block";
                            nodeGroup.style.visibility = "hidden";
                        } else {
                            umlContainers.style.display = "none";
                            nodeGroup.style.visibility = "visible";
                        }
                        vscode.postMessage({ command: 'updateSetting', key: 'showUML', value: this.checked });
                    });
                    
                    document.getElementById("showFlowDependency").addEventListener("change", function() {
                        if (this.checked) {
                            createFlowDependencies();
                            flowDependencies.style.display = "block";
                            linkGroup.style.visibility = "hidden";
                        } else {
                            flowDependencies.style.display = "none";
                            linkGroup.style.visibility = "visible";
                        }
                        vscode.postMessage({ command: 'updateSetting', key: 'showFlowDependency', value: this.checked });
                    });
                    // Layout selection using native APIs (simplified versions)
                    document.getElementById("layoutType").addEventListener("change", function() {
                        simulation.stop();
                        
                        switch(this.value) {
                            case "force":
                                // Reset to force-directed layout
                                diagramData.nodes.forEach(node => {
                                    node.fx = null;
                                    node.fy = null;
                                });
                                simulation.start();
                                break;
                                
                            case "radial":
                                // Simple radial layout
                                const centerX = width / 2;
                                const centerY = height / 2;
                                const radius = height * 0.3;
                                diagramData.nodes.forEach((node, i) => {
                                    const angle = (i / diagramData.nodes.length) * 2 * Math.PI;
                                    node.fx = centerX + radius * Math.cos(angle);
                                    node.fy = centerY + radius * Math.sin(angle);
                                });
                                simulation.start();
                                break;
                                
                            case "hierarchical":
                                // Simple hierarchical layout
                                try {
                                    // Find root nodes (nodes with no incoming extends relationships)
                                    const rootNodes = diagramData.nodes.filter(node => 
                                        !diagramData.links.some(link => 
                                            link.target === node.id && link.type === "extends"));
                                    
                                    let currentLevel = 0;
                                    const processedNodes = new Set();
                                    const nodeQueue = rootNodes.map(node => ({ node, level: 0 }));
                                    
                                    while (nodeQueue.length > 0) {
                                        const { node, level } = nodeQueue.shift();
                                        if (processedNodes.has(node.id)) continue;
                                        
                                        const nodesAtLevel = nodeQueue.filter(item => item.level === level).length + 1;
                                        const positionAtLevel = [...processedNodes].filter(id => 
                                            diagramData.nodes.find(n => n.id === id)?.level === level).length;
                                        
                                        node.fx = (positionAtLevel + 1) * (width / (nodesAtLevel + 1));
                                        node.fy = 100 + level * 100;
                                        node.level = level;
                                        processedNodes.add(node.id);
                                        
                                        // Add children to queue
                                        diagramData.links.filter(link => 
                                            link.source === node.id && link.type === "extends")
                                            .forEach(link => {
                                                const childNode = diagramData.nodes.find(n => n.id === link.target);
                                                if (childNode && !processedNodes.has(childNode.id)) {
                                                    nodeQueue.push({ node: childNode, level: level + 1 });
                                                }
                                            });
                                    }
                                    
                                    simulation.start();
                                } catch (e) {
                                    console.error("Couldn't create hierarchy:", e);
                                    alert("Couldn't create hierarchical layout: " + e.message);
                                }
                                break;
                        }
                        vscode.postMessage({ command: 'updateSetting', key: 'layoutType', value: this.value });
                    });
                    
                    // Reset layout button using native APIs
                    document.getElementById("resetLayout").addEventListener("click", function() {
                        // Clear fixed positions
                        diagramData.nodes.forEach(node => {
                            node.fx = null;
                            node.fy = null;
                        });
                        
                        // Restart the simulation
                        simulation.start();
                    });
                    
                    // Zoom to fit button using native APIs
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
                        currentZoom.scale = scale;
                        currentZoom.tx = width/2 - (minX + maxX)/2 * scale;
                        currentZoom.ty = height/2 - (minY + maxY)/2 * scale;
                        
                        // Apply the zoom transform with CSS transition
                        const mainGroup = g;
                        mainGroup.style.transition = 'transform 0.75s ease-in-out';
                        mainGroup.style.transform = "translate(" + currentZoom.tx + "px, " + currentZoom.ty + "px) scale(" + currentZoom.scale + ")";
                        
                        // Remove transition after animation completes
                        setTimeout(() => {
                            mainGroup.style.transition = '';
                        }, 750);
                    });

                    
                    // Update orbit paths (simplified without D3.js curves)
                    function updateOrbits() {
                        orbits.forEach((path, i) => {
                            const nodeData = diagramData.nodes.filter(d => d.orbit)[i];
                            if (nodeData && nodeData.orbit && nodeData.orbit.length) {
                                // Create simple circular path around node position
                                const radius = 50;
                                const cx = nodeData.x || width/2;
                                const cy = nodeData.y || height/2;
                                path.setAttribute('d', "M " + (cx + radius) + "," + cy + " A " + radius + "," + radius + " 0 1,1 " + (cx - radius) + "," + cy + " A " + radius + "," + radius + " 0 1,1 " + (cx + radius) + "," + cy);
                            }
                        });
                    }
                    
                    // Add orbit update to simulation tick
                    const originalTick = simulation.ontick;
                    simulation.ontick = () => {
                        originalTick();
                        updateOrbits();
                    };

                    // Initial call to zoom to fit
                    setTimeout(() => {
                        document.getElementById("zoomToFit").click();
                    }, 500);

                    // Add double-click handler to nodes for editor navigation
                    nodes.forEach(nodeObj => {
                        nodeObj.element.addEventListener("dblclick", () => {
                            vscode.postMessage({ command: 'revealInEditor', nodeId: nodeObj.data.id });
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }
    
    dispose() {
        mower.currentPanel = undefined;
        
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
