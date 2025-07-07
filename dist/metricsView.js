"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsViewProvider = void 0;
class MetricsViewProvider {
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(view, _context, _token) {
        this._view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this._getHtml('Select a node to see metrics');
    }
    _getHtml(content) {
        return `<!DOCTYPE html>
<html lang="en">
<body style="font-family: var(--vscode-font-family); padding: 8px;">
    <div id="content">${content}</div>
</body>
</html>`;
    }
    showMetrics(node) {
        if (!this._view) {
            return;
        }
        let html = `<strong>${node.name}</strong> (${node.type || 'unknown'})<br/>`;
        if (node.canonical) {
            html += "<strong style='color:green'>Canonical Form</strong><br/>";
        }
        if (typeof node.goodness === 'number') {
            html += `Goodness: ${node.goodness.toFixed(2)}<br/>`;
        }
        html += '<strong>Metrics:</strong><br/>';
        for (const [k, v] of Object.entries(node.metrics || {})) {
            html += `· ${k}: ${v}<br/>`;
        }
        if (node.axioms && node.axioms.length) {
            html += `<strong>Axioms:</strong> ${node.axioms.join(', ')}<br/>`;
        }
        this._view.webview.html = this._getHtml(html);
    }
}
exports.MetricsViewProvider = MetricsViewProvider;
MetricsViewProvider.viewType = 'reflectologyMetrics';
//# sourceMappingURL=metricsView.js.map
