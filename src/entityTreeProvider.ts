import * as vscode from 'vscode';
import { DiagramData, DiagramNode } from './diagramGenerator';

export class EntityTreeItem extends vscode.TreeItem {
    constructor(
        public readonly node: DiagramNode,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(node.name, collapsibleState);
        this.id = node.id;
    }
}

export class EntityTreeProvider implements vscode.TreeDataProvider<EntityTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EntityTreeItem | undefined | void> = new vscode.EventEmitter();
    private diagramData: DiagramData | undefined;

    get onDidChangeTreeData(): vscode.Event<EntityTreeItem | undefined | void> {
        return this._onDidChangeTreeData.event;
    }

    refresh(diagramData: DiagramData) {
        this.diagramData = diagramData;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: EntityTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: EntityTreeItem): Thenable<EntityTreeItem[]> {
        if (!this.diagramData) {
            return Promise.resolve([]);
        }

        if (!element) {
            const roots = this.diagramData.nodes.filter(n => !this.diagramData!.links.some(l => l.type === 'contains' && l.target === n.id));
            const sorted = this.sortNodes(roots);
            return Promise.resolve(sorted.map(n => this.toItem(n)));
        }

        const children = this.diagramData.links
            .filter(l => l.type === 'contains' && l.source === element.node.id)
            .map(l => this.diagramData!.nodes.find(n => n.id === l.target)!)
            .filter(Boolean);
        const sorted = this.sortNodes(children);
        return Promise.resolve(sorted.map(n => this.toItem(n)));
    }

    private toItem(node: DiagramNode): EntityTreeItem {
        const hasChildren = this.diagramData!.links.some(l => l.type === 'contains' && l.source === node.id);
        const item = new EntityTreeItem(node, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        if (node.type === 'folder') {
            item.iconPath = vscode.ThemeIcon.Folder;
        } else if (node.type === 'file') {
            item.iconPath = vscode.ThemeIcon.File;
        }
        return item;
    }

    private sortNodes(nodes: DiagramNode[]): DiagramNode[] {
        const order = (t: string) => t === 'folder' ? 0 : t === 'file' ? 1 : 2;
        return nodes.sort((a, b) => {
            const oa = order(a.type);
            const ob = order(b.type);
            if (oa !== ob) return oa - ob;
            return a.name.localeCompare(b.name);
        });
    }
}
