"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenAdapter = exports.CodeAnalyzer = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class CodeAnalyzer {
    async analyzeWorkspace() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showErrorMessage("No workspace folder found.");
            return { entities: [], relationships: [] };
        }
        const results = { entities: [], relationships: [] };
        let fileIndex = 0;
        let folderIndex = 0;
        const rootFolderId = `folder_${folderIndex++}`;
        const rootFolder = {
            id: rootFolderId,
            name: path.basename(folder.uri.fsPath),
            type: "folder",
            metrics: {},
            axioms: ["32"]
        };
        results.entities.push(rootFolder);
        const walk = async (dir, parentId) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const folderEntity = {
                        id: `folder_${folderIndex++}`,
                        name: entry.name,
                        type: "folder",
                        metrics: {},
                        axioms: ["32"]
                    };
                    results.entities.push(folderEntity);
                    results.relationships.push({
                        source: parentId,
                        target: folderEntity.id,
                        type: "contains",
                        weight: 1,
                        flowDirection: "forward"
                    });
                    await walk(fullPath, folderEntity.id);
                }
                else {
                    const ext = path.extname(entry.name).toLowerCase();
                    const isBinary = [".jpg", ".png", ".exe", ".dll", ".bin"].includes(ext);
                    if (isBinary)
                        continue;
                    try {
                        const text = await fs.promises.readFile(fullPath, "utf8");
                        const entityId = `file_${fileIndex}`;
                        const baseName = path.basename(fullPath);
                        const lines = text.split("\n");
                        const lineCount = lines.length;
                        const functions = [];
                        const references = [];
                        let structureDepth = 0;
                        let maxDepth = 0;
                        const functionPattern = /\b(function|def|fn|void|int|float|double|public|private|class|struct|interface|enum|type)\b\s+([a-zA-Z0-9_]+)/;
                        const referencePattern = /\b(import|include|require|use|from|using)\s+([^\s;'"()]+)/;
                        lines.forEach(line => {
                            const funcMatch = functionPattern.exec(line);
                            if (funcMatch)
                                functions.push(funcMatch[2]);
                            const refMatch = referencePattern.exec(line);
                            if (refMatch)
                                references.push(refMatch[2]);
                            const opens = (line.match(/{/g) || []).length;
                            const closes = (line.match(/}/g) || []).length;
                            structureDepth += opens - closes;
                            if (structureDepth > maxDepth)
                                maxDepth = structureDepth;
                        });
                        // Create file entity
                        const fileEntity = {
                            id: entityId,
                            name: baseName,
                            type: "file",
                            metrics: {
                                complexity: maxDepth,
                                utility: functions.length,
                                cost: 0,
                                lineCount: lineCount
                            },
                            axioms: ["32"]
                        };
                        results.entities.push(fileEntity);
                        results.relationships.push({
                            source: parentId,
                            target: fileEntity.id,
                            type: "contains",
                            weight: 1,
                            flowDirection: "forward"
                        });
                        // Add function entities and relationships
                        functions.forEach((funcName, i) => {
                            const funcEntity = {
                                id: `func_${fileIndex}_${i}`,
                                name: funcName,
                                type: "function",
                                metrics: {
                                    complexity: 1 + Math.random() * 2,
                                    utility: 1,
                                    cost: 0.5
                                },
                                axioms: ["33"]
                            };
                            results.entities.push(funcEntity);
                            results.relationships.push({
                                source: fileEntity.id,
                                target: funcEntity.id,
                                type: "contains",
                                weight: 1,
                                flowDirection: "forward"
                            });
                        });
                        // Add reference relationships
                        references.forEach(ref => {
                            const refTarget = results.entities.find(e => e.type === "file" && e.name.replace(/\.[^/.]+$/, "") === ref);
                            if (refTarget) {
                                results.relationships.push({
                                    source: fileEntity.id,
                                    target: refTarget.id,
                                    type: "imports",
                                    weight: 0.7,
                                    axioms: ["40"],
                                    flowDirection: "forward"
                                });
                            }
                        });
                        fileIndex++;
                    }
                    catch (err) {
                        console.error(`Failed to parse file ${fullPath}:`, err);
                    }
                }
            }
        };
        await walk(folder.uri.fsPath, rootFolderId);
        this.enrichWithReflectology(results);
        return results;
    }
    enrichWithReflectology(structure) {
        const { entities, relationships } = structure;
        entities.forEach(entity => {
            if (entity.metrics.complexity > 2.0) {
                entity.metrics.canonical = 1;
            }
            const incoming = relationships.filter(r => r.target === entity.id).length;
            if (incoming > 3) {
                if (!entity.axioms)
                    entity.axioms = [];
                if (!entity.axioms.includes("40")) {
                    entity.axioms.push("40");
                }
            }
            if (entity.type === "file") {
                entity.umlClass = { type: "class", fields: [], methods: [] };
                relationships
                    .filter(r => r.source === entity.id && r.type === "contains")
                    .forEach(r => {
                    const func = entities.find(e => e.id === r.target);
                    if (func && entity.umlClass) {
                        entity.umlClass.methods.push(func.name);
                    }
                });
            }
        });
        relationships.forEach(rel => {
            if (rel.type === "calls") {
                rel.flowType = "invocation";
                rel.flowStrength = 1.0;
            }
            else if (rel.type === "imports") {
                rel.flowType = "dependency";
                rel.flowStrength = 0.7;
            }
            else if (rel.type === "contains") {
                rel.flowType = "composition";
                rel.flowStrength = 1.0;
            }
        });
    }
}
exports.CodeAnalyzer = CodeAnalyzer;
class TokenAdapter {
    convertTokensToCodeStructure(tokenResults) {
        const codeStructure = { entities: [], relationships: [] };
        // Convert token results to code structure
        tokenResults.forEach((token) => {
            const entity = {
                id: token.id,
                name: token.name,
                type: token.type,
                metrics: {
                    complexity: token.complexity,
                    utility: token.utility,
                    cost: token.cost
                },
                axioms: token.axioms
            };
            codeStructure.entities.push(entity);
        });
        return codeStructure;
    }
}
exports.TokenAdapter = TokenAdapter;
//# sourceMappingURL=codeAnalyzer.js.map