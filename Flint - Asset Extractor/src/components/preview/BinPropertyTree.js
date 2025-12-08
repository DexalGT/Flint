/**
 * BinPropertyTree.js - Hierarchical property tree view for BIN files
 * Part of FLINT-401: BIN Property Tree
 */

import { h } from '../../lib/utils.js';
import * as api from '../../lib/api.js';

/**
 * Type badge component with appropriate styling
 */
function TypeBadge(nodeType, binType) {
    // Map node types to CSS modifier classes
    const typeClass = `bin-tree-node__type--${nodeType}`;

    return h('span', {
        className: `bin-tree-node__type ${typeClass}`,
        title: binType
    }, binType);
}

/**
 * Render a tree node recursively
 */
function TreeNode(node, depth, expandedNodes, onToggle, onSelect, selectedId) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedId === node.id;

    // Determine the expander icon
    let expanderIcon = '';
    if (hasChildren) {
        expanderIcon = isExpanded ? '▼' : '▶';
    }

    // Build the header
    const header = h('div', {
        className: `bin-tree-node__header ${isSelected ? 'bin-tree-node__header--selected' : ''}`,
        onclick: (e) => {
            e.stopPropagation();
            if (hasChildren) {
                onToggle(node.id);
            }
            onSelect(node);
        },
        style: `padding-left: ${depth * 16 + 8}px`
    },
        // Expander
        h('span', {
            className: 'bin-tree-node__expander',
            onclick: (e) => {
                e.stopPropagation();
                if (hasChildren) {
                    onToggle(node.id);
                }
            }
        }, expanderIcon),
        // Key/Name
        h('span', { className: 'bin-tree-node__key' }, node.key),
        // Type badge
        TypeBadge(node.node_type, node.bin_type),
        // Value (for primitives) or child count (for containers)
        node.display_value ? h('span', {
            className: `bin-tree-node__value ${node.is_path ? 'bin-tree-node__value--path' : ''}`,
            title: node.display_value
        }, node.display_value) : null
    );

    // Build children if expanded
    let children = null;
    if (hasChildren && isExpanded) {
        children = h('div', { className: 'bin-tree-node__children' },
            ...node.children.map(child =>
                TreeNode(child, depth + 1, expandedNodes, onToggle, onSelect, selectedId)
            )
        );
    }

    return h('div', {
        className: `bin-tree-node bin-tree-node--${node.node_type}`,
        'data-id': node.id
    }, header, children);
}

/**
 * Search bar component
 */
function SearchBar(searchQuery, onSearchChange) {
    return h('div', { className: 'bin-tree-search' },
        h('input', {
            type: 'text',
            className: 'bin-tree-search__input',
            placeholder: 'Search properties...',
            value: searchQuery,
            oninput: (e) => onSearchChange(e.target.value)
        }),
        searchQuery ? h('button', {
            className: 'bin-tree-search__clear',
            onclick: () => onSearchChange('')
        }, '✕') : null
    );
}

/**
 * Filter nodes based on search query
 */
function filterNodes(nodes, query) {
    if (!query) return nodes;

    const lowerQuery = query.toLowerCase();

    function matchNode(node) {
        // Check if this node matches
        const keyMatches = node.key.toLowerCase().includes(lowerQuery);
        const valueMatches = node.display_value?.toLowerCase().includes(lowerQuery);

        if (keyMatches || valueMatches) {
            return true;
        }

        // Check if any children match
        if (node.children) {
            return node.children.some(child => matchNode(child));
        }

        return false;
    }

    function filterTree(node) {
        if (!matchNode(node)) {
            return null;
        }

        // If this node has children, filter them too
        if (node.children) {
            const filteredChildren = node.children
                .map(child => filterTree(child))
                .filter(Boolean);

            // If this node directly matches, keep all children
            const keyMatches = node.key.toLowerCase().includes(lowerQuery);
            const valueMatches = node.display_value?.toLowerCase().includes(lowerQuery);

            if (keyMatches || valueMatches) {
                return node;
            }

            // Otherwise, only keep matching children
            return {
                ...node,
                children: filteredChildren
            };
        }

        return node;
    }

    return nodes.map(node => filterTree(node)).filter(Boolean);
}

/**
 * BinPropertyTree - Main component for displaying BIN file as a property tree
 */
export function BinPropertyTree(filePath, options = {}) {
    const {
        onSelect = () => { },
        initialExpandedNodes = new Set(),
        searchEnabled = true
    } = options;

    // State
    let treeData = null;
    let loading = true;
    let error = null;
    let expandedNodes = new Set(initialExpandedNodes);
    let selectedNode = null;
    let searchQuery = '';

    // Container element
    const container = h('div', { className: 'bin-property-tree' });

    // Render function
    function render() {
        container.innerHTML = '';

        if (loading) {
            container.appendChild(h('div', { className: 'bin-property-tree__loading' },
                h('div', { className: 'loading-spinner' }),
                h('span', {}, 'Loading properties...')
            ));
            return;
        }

        if (error) {
            container.appendChild(h('div', { className: 'bin-property-tree__error' },
                h('span', { className: 'error-icon' }, '⚠'),
                h('span', {}, error)
            ));
            return;
        }

        if (!treeData || treeData.length === 0) {
            container.appendChild(h('div', { className: 'bin-property-tree__empty' },
                'No properties found'
            ));
            return;
        }

        // Search bar
        if (searchEnabled) {
            container.appendChild(SearchBar(searchQuery, (query) => {
                searchQuery = query;
                render();
            }));
        }

        // Filter nodes based on search
        const displayNodes = filterNodes(treeData, searchQuery);

        // Tree content
        const treeContent = h('div', { className: 'bin-property-tree__content' },
            ...displayNodes.map(node =>
                TreeNode(node, 0, expandedNodes, handleToggle, handleSelect, selectedNode?.id)
            )
        );

        container.appendChild(treeContent);

        // Statistics
        const totalNodes = countNodes(treeData);
        const stats = h('div', { className: 'bin-property-tree__stats' },
            `${totalNodes} properties`
        );
        container.appendChild(stats);
    }

    function countNodes(nodes) {
        let count = 0;
        for (const node of nodes) {
            count++;
            if (node.children) {
                count += countNodes(node.children);
            }
        }
        return count;
    }

    function handleToggle(nodeId) {
        if (expandedNodes.has(nodeId)) {
            expandedNodes.delete(nodeId);
        } else {
            expandedNodes.add(nodeId);
        }
        render();
    }

    function handleSelect(node) {
        selectedNode = node;
        onSelect(node);
        render();
    }

    // Expand all nodes at a certain depth
    function expandToDepth(nodes, maxDepth, currentDepth = 0, nodeSet = new Set()) {
        if (currentDepth >= maxDepth) return nodeSet;

        for (const node of nodes) {
            if (node.children && node.children.length > 0) {
                nodeSet.add(node.id);
                expandToDepth(node.children, maxDepth, currentDepth + 1, nodeSet);
            }
        }

        return nodeSet;
    }

    // Load data
    async function loadData() {
        loading = true;
        error = null;
        render();

        try {
            treeData = await api.parseBinToTree(filePath);

            // Auto-expand first two levels
            expandedNodes = expandToDepth(treeData, 2);

            loading = false;
            render();
        } catch (e) {
            loading = false;
            error = e.message || 'Failed to load BIN file';
            render();
        }
    }

    // Public API
    container.refresh = loadData;
    container.expandAll = () => {
        expandedNodes = expandToDepth(treeData, 100);
        render();
    };
    container.collapseAll = () => {
        expandedNodes.clear();
        render();
    };
    container.getSelectedNode = () => selectedNode;
    container.getExpandedNodes = () => new Set(expandedNodes);

    // Initial load
    loadData();

    return container;
}

export default BinPropertyTree;
