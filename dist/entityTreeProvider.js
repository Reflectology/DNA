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
            const sorted = this.sortNodes(roots);
            return Promise.resolve(sorted.map(n => this.toItem(n)));
        }
        const children = this.diagramData.links
            .filter(l => l.type === 'contains' && l.source === element.node.id)
            .map(l => this.diagramData.nodes.find(n => n.id === l.target))
            .filter(Boolean);
        const sorted = this.sortNodes(children);
        return Promise.resolve(sorted.map(n => this.toItem(n)));
    }
    toItem(node) {
        const hasChildren = this.diagramData.links.some(l => l.type === 'contains' && l.source === node.id);
        const item = new EntityTreeItem(node, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        if (node.type === 'folder') {
            item.iconPath = vscode.ThemeIcon.Folder;
        }
        else if (node.type === 'file') {
            item.iconPath = vscode.ThemeIcon.File;
        }
        return item;
    }
    sortNodes(nodes) {
        const order = (t) => t === 'folder' ? 0 : t === 'file' ? 1 : 2;
        return nodes.sort((a, b) => {
            const oa = order(a.type);
            const ob = order(b.type);
            if (oa !== ob)
                return oa - ob;
            return a.name.localeCompare(b.name);
        });
    }
    // Add this method to hook up selection/open
    registerOpenHandler(view) {
        view.onDidChangeSelection(e => {
            const item = e.selection[0];
            if (item) {
                vscode.commands.executeCommand('reflectologyVisualizer.revealInEditor', item.node.id);
            }
        });
        view.onDidChangeVisibility(() => { });
        view.onDidExpandElement(() => { });
        view.onDidCollapseElement(() => { });
    }
}
exports.EntityTreeProvider = EntityTreeProvider;
//# sourceMappingURL=entityTreeProvider.js.map