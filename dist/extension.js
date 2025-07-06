"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const diagramGenerator_1 = require("./diagramGenerator");
const webviewPanel_1 = require("./webviewPanel");
const codeAnalyzer_1 = require("./codeAnalyzer");
const entityTreeProvider_1 = require("./entityTreeProvider");
function activate(context) {
    const generator = new diagramGenerator_1.DiagramGenerator();
    const analyzer = new codeAnalyzer_1.CodeAnalyzer();
    const treeProvider = new entityTreeProvider_1.EntityTreeProvider();
    vscode.window.registerTreeDataProvider('reflectologyEntities', treeProvider);
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
        webviewPanel_1.ReflectologyVisualizer.createOrShow(diagramData);
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
                webviewPanel_1.ReflectologyVisualizer.createOrShow(diagramData);
                return true;
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error visualizing code: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(tokenVisualizeCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map