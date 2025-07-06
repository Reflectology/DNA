"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanWorkspaceForTokens = scanWorkspaceForTokens;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
/**
 * Utility function that scans the workspace for tokens
 * This is a placeholder for more advanced token extraction logic
 */
async function scanWorkspaceForTokens() {
    const tokens = [];
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return tokens;
    }
    let fileIndex = 0;
    // Function to recursively walk the directory
    const walk = async (dir) => {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // Skip node_modules and hidden directories
                    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                        continue;
                    }
                    await walk(fullPath);
                }
                else {
                    const ext = path.extname(entry.name).toLowerCase();
                    // Skip binary files and non-code files
                    if (['.jpg', '.png', '.exe', '.dll', '.bin', '.pdf'].includes(ext)) {
                        continue;
                    }
                    const baseName = path.basename(fullPath);
                    const token = {
                        id: `token_${fileIndex}`,
                        name: baseName,
                        type: ext.substring(1) || 'file', // Use extension as type
                        complexity: Math.random() * 3,
                        utility: Math.floor(Math.random() * 5),
                        cost: Math.random(),
                        axioms: [Math.random() > 0.5 ? "32" : "33"]
                    };
                    tokens.push(token);
                    fileIndex++;
                }
            }
        }
        catch (err) {
            console.error(`Error walking directory ${dir}:`, err);
        }
    };
    await walk(folder.uri.fsPath);
    return tokens;
}
//# sourceMappingURL=utils.js.map