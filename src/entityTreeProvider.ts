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
            return Promise.resolve(roots.map(n => this.toItem(n)));
        }

        const childrenIds = this.diagramData.links
            .filter(l => l.type === 'contains' && l.source === element.node.id)
            .map(l => l.target);
        return Promise.resolve(childrenIds.map(id => {
            const node = this.diagramData!.nodes.find(n => n.id === id)!;
            return this.toItem(node);
        }));
    }

    private toItem(node: DiagramNode): EntityTreeItem {
        const hasChildren = this.diagramData!.links.some(l => l.type === 'contains' && l.source === node.id);
        return new EntityTreeItem(node, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    }
}
