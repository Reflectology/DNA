"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityTreeProvider = exports.EntityTreeItem = void 0;
const vscode = require("vscode");
class EntityTreeItem extends vscode.TreeItem {
    constructor(node, collapsibleState) {
        super(node.name, collapsibleState);
        this.node = node;
        this.id = node.id;
    }
}
exports.EntityTreeItem = EntityTreeItem;
class EntityTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
    }
    get onDidChangeTreeData() {
        return this._onDidChangeTreeData.event;
    }
    refresh(diagramData) {
        this.diagramData = diagramData;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.diagramData) {
            return Promise.resolve([]);
        }
        if (!element) {
            const roots = this.diagramData.nodes.filter(n => !this.diagramData.links.some(l => l.type === 'contains' && l.target === n.id));
            return Promise.resolve(roots.map(n => this.toItem(n)));
        }
        const childrenIds = this.diagramData.links
            .filter(l => l.type === 'contains' && l.source === element.node.id)
            .map(l => l.target);
        return Promise.resolve(childrenIds.map(id => {
            const node = this.diagramData.nodes.find(n => n.id === id);
            return this.toItem(node);
        }));
    }
    toItem(node) {
        const hasChildren = this.diagramData.links.some(l => l.type === 'contains' && l.source === node.id);
        return new EntityTreeItem(node, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    }
}
exports.EntityTreeProvider = EntityTreeProvider;
//# sourceMappingURL=entityTreeProvider.js.map
