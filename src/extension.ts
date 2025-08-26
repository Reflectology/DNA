import * as vscode from 'vscode';
import { DiagramGenerator } from './diagramGenerator';
import { mower } from './webviewPanel';
import { CodeAnalyzer } from './codeAnalyzer';
import { TokenAdapter } from './codeAnalyzer';
import { EntityTreeProvider } from './entityTreeProvider';

export function activate(context: vscode.ExtensionContext) {
    const generator = new DiagramGenerator();
    const analyzer = new CodeAnalyzer();
    const treeProvider = new EntityTreeProvider();
    vscode.window.registerTreeDataProvider('m0werEntities', treeProvider);
    const treeView = vscode.window.createTreeView('m0werEntities', { treeDataProvider: treeProvider });
    context.subscriptions.push(treeView);
    treeProvider.registerOpenHandler?.(treeView);
    treeView.onDidChangeSelection(e => {
        const item = e.selection[0];
        if (item) {
            mower.highlightNode(item.node.id);
                    }
    });

    const disposable = vscode.commands.registerCommand('mower.generateDiagram', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }
        
        // Analyze workspace with axiom annotation
        const codeStructure = await analyzer.analyzeWorkspace();
        const diagramData = generator.generateDiagram(codeStructure);
        treeProvider.refresh(diagramData);
        mower.createOrShow(diagramData, context.workspaceState);
        vscode.commands.executeCommand('workbench.view.extension.m0wer');
    });

    // Register a command for the token-based visualization
    const tokenVisualizeCommand = vscode.commands.registerCommand(
        'mower.visualizeAnyCode', 
        async () => {
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
                    mower.createOrShow(diagramData, context.workspaceState);
                    vscode.commands.executeCommand('workbench.view.extension.m0wer');
                    
                    return true;
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error visualizing code: ${error}`);
            }
        }
    );
    
    context.subscriptions.push(disposable);
    context.subscriptions.push(tokenVisualizeCommand);

    mower.onNodeSelected(node => {
    });

    // Command to reveal code location for a node/entity
    context.subscriptions.push(
        vscode.commands.registerCommand('mower.revealInEditor', async (nodeId: string) => {
            // Find the file entity for the nodeId
            // You may want to keep a map of nodeId -> file path for efficiency
            const allNodes = treeProvider['diagramData']?.nodes || [];
            const node = allNodes.find((n: any) => n.id === nodeId);
            if (node && node.type === 'file' && node.name) {
                // Try to find the file in the workspace
                const folders = vscode.workspace.workspaceFolders;
                if (folders) {
                    const folderPath = folders[0].uri.fsPath;
                    const filePath = await findFileInWorkspace(folderPath, node.name);
                    if (filePath) {
                        const doc = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(doc, { preview: false });
                    }
                }
            }
            // Optionally, handle function/class nodes by opening their parent file and searching for the symbol
        })
    );

    // Helper to find file by name in workspace
    async function findFileInWorkspace(dir: string, fileName: string): Promise<string | undefined> {
        const fs = require('fs');
        const path = require('path');
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
                const found = await findFileInWorkspace(fullPath, fileName);
                if (found) return found;
            } else if (entry.name === fileName) {
                return fullPath;
            }
        }
        return undefined;
    }

    async function startGeneration() {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating visualization...",
            cancellable: true
        }, async (progress, token) => {
            // Call your generation function, passing the token
            await generateVisualization(token);
        });
    }

    // Example long-running function
    async function generateVisualization(token: vscode.CancellationToken) {
        for (let i = 0; i < 100; i++) {
            if (token.isCancellationRequested) {
                vscode.window.showInformationMessage("Generation cancelled.");
                return;
            }
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        vscode.window.showInformationMessage("Generation complete!");
    }

    // Register your command
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.startGeneration', startGeneration)
    );
}

export function deactivate() {}
