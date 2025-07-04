import * as vscode from 'vscode';
import { DiagramGenerator } from './diagramGenerator';
import { ReflectologyVisualizer } from './webviewPanel';
import { CodeAnalyzer } from './codeAnalyzer';
import { TokenAdapter } from './codeAnalyzer';

export function activate(context: vscode.ExtensionContext) {
    const generator = new DiagramGenerator();
    const analyzer = new CodeAnalyzer();

    const disposable = vscode.commands.registerCommand('reflectologyVisualizer.generateDiagram', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }
        
        // Analyze workspace with axiom annotation
        const codeStructure = await analyzer.analyzeWorkspace();
        const diagramData = generator.generateDiagram(codeStructure);
        ReflectologyVisualizer.createOrShow(diagramData);
    });

    // Register a command for the token-based visualization
    const tokenVisualizeCommand = vscode.commands.registerCommand(
        'reflectologyVisualizer.visualizeAnyCode', 
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
                    
                    // Create a panel with the visualization
                    ReflectologyVisualizer.createOrShow(diagramData);
                    
                    return true;
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error visualizing code: ${error}`);
            }
        }
    );
    
    context.subscriptions.push(disposable);
    context.subscriptions.push(tokenVisualizeCommand);
}

export function deactivate() {}
