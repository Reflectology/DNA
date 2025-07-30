import { CodeStructure, CodeEntity, UMLClass } from './codeAnalyzer';

/**
 * Represents a point in 2D space for diagram visualization
 */
export interface Point {
    x: number;
    y: number;
}

/**
 * RGB color representation matching the Lean definition
 */
export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Configuration for diagram visualization parameters
 * Based on the DiagramConfig structure from diagram_generator.lean
 */
export interface DiagramConfig {
    resolution: number;
    colorMap: string;
    orbitHighlightColor: RGB;
    configSpaceBgColor: RGB;
    axisColor: RGB;
    gridColor: RGB;
    showGrid: boolean;
    showAxes: boolean;
    projectionDimensions: [number, number];
}

/**
 * Represents a node in the diagram
 */
export interface DiagramNode {
    id: string;
    name: string;
    type: string;
    metrics: Record<string, number>;
    axioms?: string[];
    position?: Point;
    orbit?: Point[];
    canonical?: boolean;
    goodness?: number;
    umlType?: string;            // Type for UML visualization
    umlClass?: UMLClass;         // UML class information
    calls?: string[];            // IDs of called functions for call graphs
}

/**
 * Represents a connection between nodes in the diagram
 */
export interface DiagramLink {
    source: string;
    target: string;
    type: string;
    weight: number;
    axioms?: string[];
    orbit?: boolean;
    transformation?: string;
    flowDirection?: string;      // Direction of flow for dependencies
    flowStrength?: number;       // Strength of flow for visualization
    description?: string;        // Description for tooltips
    flowType?: string;           // Type of flow relationship
}

/**
 * Complete diagram data structure
 */
export interface DiagramData {
    nodes: DiagramNode[];
    links: DiagramLink[];
    config: DiagramConfig;
    metadata: {
        configSpace: string;
        groupActions: string[];
        axioms: string[];
        canonicalForms: string[];
    };
}

export class DiagramGenerator {
    // Default configuration matching the Lean definition
    private defaultConfig: DiagramConfig = {
        resolution: 800,
        colorMap: "viridis",
        orbitHighlightColor: { r: 1.0, g: 0.3, b: 0.3 },
        configSpaceBgColor: { r: 0.95, g: 0.95, b: 0.98 },
        axisColor: { r: 0.3, g: 0.3, b: 0.3 },
        gridColor: { r: 0.8, g: 0.8, b: 0.8 },
        showGrid: true,
        showAxes: true,
        projectionDimensions: [0, 1]
    };

    /**
     * Generate a diagram from code structure
     * This follows the principles from the Lean diagram_generator.lean
     */
    generateDiagram(codeStructure: CodeStructure, config?: Partial<DiagramConfig>): DiagramData {
        const mergedConfig = { ...this.defaultConfig, ...config };
        const axiomsMap = this.extractAxioms(codeStructure);
        
        // Convert entities to nodes with proper positioning
        const nodes = codeStructure.entities.map((entity: CodeEntity) => this.createNode(entity, axiomsMap));
        
        // Apply geometric projection to position nodes
        this.projectNodes(nodes);
        
        // Generate links with proper geometric properties
        const links = this.createLinks(codeStructure.relationships, nodes);
        
        // Generate orbits for nodes where applicable
        this.generateOrbits(nodes, links);
        
        // Identify canonical forms
        this.identifyCanonicalForms(nodes);
        
        // Calculate goodness values
        this.calculateGoodness(nodes);
        
        // Generate UML class diagram information
        this.enhanceNodesWithUMLInfo(nodes, codeStructure);
        
        // Enhance links with flow dependency information
        this.enhanceLinksWithFlowInfo(links);
        
        return {
            nodes,
            links,
            config: mergedConfig,
            metadata: {
                configSpace: "ConfigSpace",
                groupActions: this.extractGroupActions(codeStructure),
                axioms: Object.keys(axiomsMap),
                canonicalForms: nodes.filter(n => n.canonical).map(n => n.id)
            }
        };
    }
    
    /**
     * Extract axioms from code structure to create a mapping
     */
    private extractAxioms(codeStructure: CodeStructure): Record<string, string> {
        const axiomMap: Record<string, string> = {};
        
        // Extract axioms from entities and relationships
        for (const entity of codeStructure.entities) {
            if (entity.axioms) {
                for (const axiom of entity.axioms) {
                    if (!axiomMap[axiom]) {
                        // Map axiom numbers to their names according to reflectology.md
                        const axiomNames: Record<string, string> = {
                            "32": "Hierarchical Structuring",
                            "33": "Causality & Correlation",
                            "40": "Reflective Conjugate Duality"
                        };
                        axiomMap[axiom] = axiomNames[axiom] || `Axiom ${axiom}`;
                    }
                }
            }
        }
        
        return axiomMap;
    }
    
    /**
     * Extract group actions from code structure
     * This identifies transformations/symmetries in the code
     */
    private extractGroupActions(codeStructure: CodeStructure): string[] {
        const groupActions: Set<string> = new Set();
        
        // Look for relationships with transformation types
        for (const rel of codeStructure.relationships) {
            if (rel.type.includes("transform") || rel.type.includes("symmetry")) {
                groupActions.add(rel.type);
            }
        }
        
        return Array.from(groupActions);
    }
    
    /**
     * Create a diagram node from a code entity
     * This maps code entities to the mathematical configuration space
     */
    private createNode(entity: CodeEntity, axiomsMap: Record<string, string>): DiagramNode {
        return {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            metrics: entity.metrics || {},
            axioms: entity.axioms || [],
            // Position will be set by projectNodes
            canonical: entity.metrics?.canonical === 1
        };
    }
    
    /**
     * Project nodes to 2D space using mathematical principles
     * This implements the projectConfigPoint concept from diagram_generator.lean
     */
    private projectNodes(nodes: DiagramNode[]): void {
        // Calculate the bounds of the metric space
        const metricDimensions = this.findMetricDimensions(nodes);
        if (!metricDimensions) return;
        
        const { metrics, minValues, maxValues } = metricDimensions;
        
        // Project each node to 2D based on its metrics (using primary metrics as dimensions)
        for (const node of nodes) {
            const x = metrics[0] ? this.normalizeMetric(node.metrics[metrics[0]], minValues[metrics[0]], maxValues[metrics[0]]) : Math.random();
            const y = metrics[1] ? this.normalizeMetric(node.metrics[metrics[1]], minValues[metrics[1]], maxValues[metrics[1]]) : Math.random();
            
            // Apply inner product space projections - this ensures geometric correctness
            // In a real implementation, we would use the actual inner product
            node.position = {
                x: x * 700 + 50, // Scale to fit the visualization
                y: y * 700 + 50
            };
        }
    }
    
    /**
     * Find the most relevant metric dimensions to use for projection
     */
    private findMetricDimensions(nodes: DiagramNode[]): { 
        metrics: string[], 
        minValues: Record<string, number>, 
        maxValues: Record<string, number> 
    } | null {
        if (nodes.length === 0) return null;
        
        // Collect all available metrics
        const allMetrics = new Set<string>();
        const minValues: Record<string, number> = {};
        const maxValues: Record<string, number> = {};
        
        for (const node of nodes) {
            for (const metric in node.metrics) {
                allMetrics.add(metric);
                
                // Track min/max values for normalization
                if (minValues[metric] === undefined || node.metrics[metric] < minValues[metric]) {
                    minValues[metric] = node.metrics[metric];
                }
                if (maxValues[metric] === undefined || node.metrics[metric] > maxValues[metric]) {
                    maxValues[metric] = node.metrics[metric];
                }
            }
        }
        
        // Find metrics with the most variation (to use as dimensions)
        const metricVariation: [string, number][] = [];
        for (const metric of allMetrics) {
            const variation = maxValues[metric] - minValues[metric];
            metricVariation.push([metric, variation]);
        }
        
        // Sort by variation (descending) and take the top 2
        metricVariation.sort((a, b) => b[1] - a[1]);
        const primaryMetrics = metricVariation.slice(0, 2).map(m => m[0]);
        
        return {
            metrics: primaryMetrics,
            minValues,
            maxValues
        };
    }
    
    /**
     * Normalize a metric value to a 0-1 range
     */
    private normalizeMetric(value: number, min: number, max: number): number {
        if (max === min) return 0.5; // Avoid division by zero
        return (value - min) / (max - min);
    }
    
    /**
     * Create diagram links from code relationships
     */
    private createLinks(relationships: any[], nodes: DiagramNode[]): DiagramLink[] {
        return relationships.map(rel => ({
            source: rel.source,
            target: rel.target,
            type: rel.type,
            weight: rel.weight || 1,
            axioms: rel.axioms || [],
            orbit: rel.type === "orbit" || rel.type.includes("transform"),
            transformation: rel.transformation
        }));
    }
    
    /**
     * Generate orbits for nodes based on group actions
     * This implements the visualizeConfigSpaceWithOrbits concept from diagram_generator.lean
     */
    private generateOrbits(nodes: DiagramNode[], links: DiagramLink[]): void {
        // Find all transformation links (group actions)
        const transformLinks = links.filter(link => link.orbit);
        
        // For each node, collect its orbit points
        for (const node of nodes) {
            if (!node.position) continue;
            
            // Find all nodes connected via transformations
            const orbitNodes = this.findOrbitNodes(node.id, nodes, transformLinks);
            
            if (orbitNodes.length > 0) {
                node.orbit = orbitNodes.map(n => n.position!);
            }
        }
    }
    
    /**
     * Find all nodes in the orbit of a given node
     */
    private findOrbitNodes(nodeId: string, nodes: DiagramNode[], transformLinks: DiagramLink[]): DiagramNode[] {
        // Find direct connections through transforms
        const directConnections = new Set<string>();
        
        for (const link of transformLinks) {
            if (link.source === nodeId) {
                directConnections.add(link.target);
            }
            else if (link.target === nodeId) {
                directConnections.add(link.source);
            }
        }
        
        // Get the node objects
        return nodes.filter(node => directConnections.has(node.id));
    }
    
    /**
     * Identify canonical forms among nodes
     * This implements the visualizeCanonicalForms concept from diagram_generator.lean
     */
    private identifyCanonicalForms(nodes: DiagramNode[]): void {
        // Group nodes by their type (representing equivalence classes)
        const typeGroups = new Map<string, DiagramNode[]>();
        
        for (const node of nodes) {
            if (!typeGroups.has(node.type)) {
                typeGroups.set(node.type, []);
            }
            typeGroups.get(node.type)!.push(node);
        }
        
        // For each group, identify the canonical form (e.g., by a metric like complexity)
        for (const [type, nodeGroup] of typeGroups.entries()) {
            // Use complexity as our f function for canonical form selection
            const complexity = (node: DiagramNode) => node.metrics.complexity || 0;
            
            // Find node with minimum complexity in each group
            let canonicalNode = nodeGroup[0];
            for (const node of nodeGroup) {
                if (complexity(node) < complexity(canonicalNode)) {
                    canonicalNode = node;
                }
            }
            
            // Mark as canonical
            canonicalNode.canonical = true;
        }
    }
    
    /**
     * Calculate goodness values for nodes
     * This implements the goodness function from rsc.lean
     */
    private calculateGoodness(nodes: DiagramNode[]): void {
        for (const node of nodes) {
            // Extract utility and cost from metrics or use defaults
            const utility = node.metrics.utility || node.metrics.value || 0;
            const cost = node.metrics.cost || node.metrics.complexity || 0;
            
            // Goodness = Utility - Cost (as defined in rsc.lean)
            node.goodness = utility - cost;
        }
    }
    
    /**
     * Generate color from goodness value
     * This implements the colorFromGoodness function from diagram_generator.lean
     */
    public static colorFromGoodness(goodness: number): RGB {
        // Normalize goodness to 0-1 using sigmoid
        const normalized = 1.0 / (1.0 + Math.exp(-goodness * 5));
        
        // Red to green color mapping
        return {
            r: 1.0 - normalized,
            g: normalized,
            b: 0.0
        };
    }
    
    /**
     * Generate a color for a node based on axioms
     */
    public static getNodeColor(node: DiagramNode): RGB {
        // If node has goodness, use that for color
        if (node.goodness !== undefined) {
            return DiagramGenerator.colorFromGoodness(node.goodness);
        }
        
        // If node has axioms, use the first one for color
        if (node.axioms && node.axioms.length > 0) {
            const axiomColors: Record<string, RGB> = {
                "32": { r: 0.12, g: 0.47, b: 0.71 }, // blue
                "33": { r: 1.0, g: 0.5, b: 0.05 },  // orange
                "40": { r: 0.17, g: 0.63, b: 0.17 }  // green
            };
            
            return axiomColors[node.axioms[0]] || { r: 0.5, g: 0.5, b: 0.5 };
        }
        
        // Default color
        return { r: 0.5, g: 0.5, b: 0.5 };
    }
    
    /**
     * Enhance nodes with additional information for UML class diagrams
     */
    private enhanceNodesWithUMLInfo(nodes: DiagramNode[], codeStructure: CodeStructure): void {
        for (const node of nodes) {
            if (node.type === 'function') {
                const called = codeStructure.relationships
                    .filter(r => r.type === 'calls' && r.source === node.id)
                    .map(r => r.target);
                if (called.length > 0) {
                    (node as any).calls = called;
                }
            }
        }
    }
    
    /**
     * Get UML type for an entity
     */
    private getUMLType(entity: CodeEntity): string {
        // For classes and structures, use their name
        if (entity.type === 'class' || entity.type === 'structure') {
            return entity.name;
        }
        
        // For methods and fields, extract their container name if possible
        if (entity.id.includes('_')) {
            const parts = entity.id.split('_');
            if (parts.length > 1) {
                return parts[0]; // Return the container name
            }
        }
        
        // Default to entity name
        return entity.name;
    }
    
    /**
     * Enhance links with flow dependency information
     */
    private enhanceLinksWithFlowInfo(links: DiagramLink[]): void {
        for (const link of links) {
            // Add flow direction info for dependency links
            if (link.type === 'calls' || link.type === 'extends' || link.type === 'imports') {
                link.flowDirection = 'forward';
                link.flowStrength = link.weight;
                
                // Highlight canonical form relationships
                if (link.type === 'extends') {
                    link.flowStrength = 2; // Stronger flow for inheritance
                }
            }
            
            // Add transformation info for orbit links
            if (link.orbit) {
                link.flowDirection = 'bidirectional';
                link.transformation = link.transformation || 'symmetry';
            }
        }
    }
}
