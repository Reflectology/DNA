"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const diagramGenerator_1 = require("./diagramGenerator");
const webviewPanel_1 = require("./webviewPanel");
const codeAnalyzer_1 = require("./codeAnalyzer");
const entityTreeProvider_1 = require("./entityTreeProvider");
const metricsView_1 = require("./metricsView");
function activate(context) {
    const generator = new diagramGenerator_1.DiagramGenerator();
    const analyzer = new codeAnalyzer_1.CodeAnalyzer();
    const treeProvider = new entityTreeProvider_1.EntityTreeProvider();
    vscode.window.registerTreeDataProvider('reflectologyEntities', treeProvider);
    const treeView = vscode.window.createTreeView('reflectologyEntities', { treeDataProvider: treeProvider });
    context.subscriptions.push(treeView);
    treeView.onDidChangeSelection(e => {
        const item = e.selection[0];
        if (item) {
            webviewPanel_1.ReflectologyVisualizer.highlightNode(item.node.id);
            metricsProvider.showMetrics(item.node);
        }
    });
    const metricsProvider = new metricsView_1.MetricsViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(metricsView_1.MetricsViewProvider.viewType, metricsProvider));
    const disposable = vscode.commands.registerCommand('reflectologyVisualizer.generateDiagram', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }
        // Analyze workspace with axiom annotation
        const codeStructure = await analyzer.analyzeWorkspace();
        const diagramData = generator.generateDiagram(codeStructure);
        treeProvider.refresh(diagramData);
        webviewPanel_1.ReflectologyVisualizer.createOrShow(diagramData, context.workspaceState);
        vscode.commands.executeCommand('workbench.view.extension.reflectology');
    });
    // Register a command for the token-based visualization
    const tokenVisualizeCommand = vscode.commands.registerCommand('reflectologyVisualizer.visualizeAnyCode', async () => {
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing code structure...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 20, message: "Scanning workspace files..." });
                // Run the standard code analyzer
                const codeStructure = await analyzer.analyzeWorkspace();
                progress.report({ increment: 40, message: "Generating visualization..." });
                // Generate the diagram data
                const diagramData = generator.generateDiagram(codeStructure);
                treeProvider.refresh(diagramData);
                // Create a panel with the visualization
                webviewPanel_1.ReflectologyVisualizer.createOrShow(diagramData, context.workspaceState);
                vscode.commands.executeCommand('workbench.view.extension.reflectology');
                return true;
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error visualizing code: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(tokenVisualizeCommand);
    webviewPanel_1.ReflectologyVisualizer.onNodeSelected(node => {
        metricsProvider.showMetrics(node);
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map