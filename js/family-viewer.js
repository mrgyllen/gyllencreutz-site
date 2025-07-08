document.addEventListener('DOMContentLoaded', function() {
    const treeContainer = document.getElementById('tree-container');
    const sidebar = document.getElementById('sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    const searchInput = document.getElementById('search-input');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const resetViewBtn = document.getElementById('reset-view-btn');

    if (!treeContainer) return;

    const margin = { top: 20, right: 120, bottom: 20, left: 120 };
    let width = treeContainer.clientWidth - margin.right - margin.left;
    const height = 1200; // Fixed height, can be adjusted

    let svg, g;
    const zoom = d3.zoom().on('zoom', (event) => {
        if (g) g.attr('transform', event.transform);
    });

    const nodeWidth = 180;
    const nodeHeight = 60;
    const treemap = d3.tree()
        .nodeSize([nodeHeight + 20, 0]); // [height, width] - 20px vertical padding

    let i = 0;
    let root;
    let allNodes = [];
    const duration = 250;
    let currentHeight = height; // To store the dynamic height for centering
    let originalData = null;

    d3.json('data/family.json').then(treeData => {
        originalData = treeData;
        initializeVisualization(originalData);

        // Listeners that only need to be attached once
        document.addEventListener('click', (event) => {
            if (!event.target.closest('#search-container')) {
                autocompleteResults.innerHTML = '';
            }
        });
    }).catch(error => console.error('Error loading family.json:', error));

    // Setup listeners that are independent of the data loading
    resetViewBtn.addEventListener('click', resetTree);

    function initializeVisualization(treeData) {
        // Clear any previous visualization
        treeContainer.innerHTML = '';

        svg = d3.select(treeContainer).append('svg')
            .attr('width', '100%')
            .call(zoom);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        root = d3.hierarchy(treeData, d => d.children);
        root.x0 = height / 2;
        root.y0 = 0;

        allNodes = root.descendants();
        setupAutocomplete(allNodes);

        if (root.children) {
            root.children.forEach(collapse);
        }
        update(root, true); // Initial update, center the view
        setupUI();

        treeContainer.addEventListener('click', (event) => {
            if (event.target.closest('.node') || event.target.closest('button')) return;
            sidebar.classList.remove('open');
        });
    }

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse); // Restore recursive call
            d.children = null;
        }
    }

    function update(source, isInitial = false) {
        const layout = treemap(root);
        let nodes = layout.descendants();
        let links = layout.links();

        // Calculate the actual vertical extent of the tree.
        let minX = Infinity;
        let maxX = -Infinity;
        nodes.forEach(d => {
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
        });

        // Set the SVG height based on the calculated extent.
        const dynamicHeight = maxX - minX;
        const finalHeight = Math.max(dynamicHeight, height);
        currentHeight = finalHeight;
        svg.attr('height', finalHeight + margin.top + margin.bottom);

        // Normalize for fixed-depth BEFORE calculating any transforms.
        nodes.forEach(d => { d.y = d.depth * (nodeWidth + 120); });

        // On the first load, calculate a transform to center the root node.
        if (isInitial) {
            // The container <g> is already translated by the margin.
            // This transform centers the root node within the drawing area.
            const t = d3.zoomIdentity
                .translate(width / 2 - root.y, currentHeight / 2 - root.x)
                .scale(1);

            svg.call(zoom.transform, t);


        }

        // 1. NODES
        const nodeSelection = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = nodeSelection.enter().append('g')
            .attr('transform', `translate(${source.y0},${source.x0})`)
            .on('click', (event, d) => {
                // If the clicked node has children, expand/collapse them and redraw
                if (d.children || d._children) {
                    toggle(d);
                    update(d);
                }
                // Always handle sidebar and selection state
                toggleSidebar(d);
                centerOnNode(d);
            });

        nodeEnter.append('rect')
            .attr('class', 'node-rect')
            .attr('width', 1e-6)
            .attr('height', 1e-6)
            .attr('x', -nodeWidth / 2)
            .attr('y', -nodeHeight / 2)
            .attr('rx', 10);

        // Create a single text element for the node name.
        nodeEnter.append('text')
            .attr('class', 'node-name')
            .attr('dy', '0.31em')
            .attr('x', 0)
            .attr('text-anchor', 'middle');

        const indicator = nodeEnter.append('g')
            .attr('class', 'expand-indicator')
            .attr('transform', `translate(${nodeWidth / 2}, 0)`);

        indicator.append('circle')
            .attr('r', 8)
            .style('fill', 'var(--primary-color)');

        indicator.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('fill', 'white')
            .style('font-size', '12px')
            .style('font-weight', 'bold');

        const nodeUpdate = nodeEnter.merge(nodeSelection);

        // Set a consistent class for all nodes.
        nodeUpdate.attr('class', 'node');

        nodeUpdate.transition().duration(duration)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('rect.node-rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .style('stroke', d => d.children || d._children ? 'var(--primary-color)' : '#94a3b8');

        const indicatorUpdate = nodeUpdate.select('g.expand-indicator');

        indicatorUpdate.style('display', d => d.children || d._children ? null : 'none');

        indicatorUpdate.select('circle')
            .style('fill', d => d._children ? 'var(--primary-color)' : '#fff')
            .style('stroke', 'var(--primary-color)');

        indicatorUpdate.select('text')
            .text(d => d._children ? '+' : '-')
            .style('fill', d => d._children ? 'white' : 'var(--primary-color)');

        // On update, call wrapText on the single text element.
        nodeUpdate.select('.node-name')
            .call(wrapText, nodeWidth - 20);

        const nodeExit = nodeSelection.exit().transition().duration(duration)
            .attr('transform', `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('rect').attr('width', 1e-6).attr('height', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        // 2. HORIZONTAL LINKS
        const linkSelection = g.selectAll('path.link')
            .data(links, d => d.target.id);

        const linkEnter = linkSelection.enter().insert('path', 'g')
            .attr('class', 'link')
            .style('stroke', '#94a3b8')      // slate-400
            .style('stroke-width', '1px')
            .style('fill', 'none')
            .attr('d', () => {
                const o = { x: source.x0, y: source.y0 };
                return `M${o.y},${o.x} L${o.y},${o.x} L${o.y},${o.x} L${o.y},${o.x}`;
            });

        const linkUpdate = linkEnter.merge(linkSelection);

        linkUpdate.transition().duration(duration)
            .attr('d', d => {
                const sourceX = d.source.x;
                const sourceY = d.source.y + nodeWidth / 2;
                const targetX = d.target.x;
                const targetY = d.target.y - nodeWidth / 2;

                // Midpoint for the horizontal line
                const midY = sourceY + (targetY - sourceY) / 2;

                // Path from parent to the horizontal line, then to child
                return `M ${sourceY},${sourceX} L ${midY},${sourceX} L ${midY},${targetX} L ${targetY},${targetX}`;
            });

        linkSelection.exit().transition().duration(duration)
            .attr('d', () => {
                const o = { x: source.x, y: source.y };
                return `M ${o.y},${o.x} L ${o.y},${o.x} L ${o.y},${o.x} L ${o.y},${o.x}`;
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function toggle(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
    }

    let selectedNodeId = null;

    function toggleSidebar(d) {
        const isSameNode = selectedNodeId === d.id;

        // Clear previous selection
        d3.selectAll('.node-rect').style('stroke', '#94a3b8').style('stroke-width', '1px');

        if (isSameNode) {
            // If clicking the same node, deselect it and close the sidebar
            sidebar.classList.remove('open');
            selectedNodeId = null;
        } else {
            // If clicking a new node, select it and show the sidebar
            selectedNodeId = d.id;
            sidebarContent.innerHTML = `<p>${d.data.name.replace(/\n/g, '<br>')}</p>`;
            sidebar.classList.add('open');

            // Highlight the new selection
            d3.selectAll('.node').filter(node => node.id === d.id)
                .select('.node-rect')
                .style('stroke', 'var(--primary-color)')
                .style('stroke-width', '3px');
        }
    }

    function setupAutocomplete(nodes) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            if (query.length < 2) {
                autocompleteResults.innerHTML = '';
                return;
            }
            const filtered = nodes.filter(d => d.data.name.toLowerCase().includes(query));
            displayAutocomplete(filtered);
        });
    }

    function displayAutocomplete(results) {
        autocompleteResults.innerHTML = '';
        results.slice(0, 10).forEach(d => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = d.data.name.split('\n')[0];
            item.addEventListener('click', () => {
                navigateToNode(d);
                searchInput.value = '';
                autocompleteResults.innerHTML = '';
            });
            autocompleteResults.appendChild(item);
        });
    }

    function navigateToNode(node) {
        let current = node;
        while (current.parent) {
            if (current.parent._children) {
                current.parent.children = current.parent._children;
                current.parent._children = null;
            }
            current = current.parent;
        }
        update(node);

        centerOnNode(node);
        setTimeout(() => {
            toggleSidebar(node);
        }, duration);
    }

    function resetTree() {
        if (originalData) {
            initializeVisualization(originalData);
        }
    }

    function centerOnNode(node, animated = true) {
        // The container <g> is already translated by the margin.
        // This transform centers the node within the drawing area.
        const t = d3.zoomIdentity
            .translate(width / 2 - node.y, currentHeight / 2 - node.x)
            .scale(1);

        const transition = animated ? svg.transition().duration(750) : svg;
        transition.call(zoom.transform, t);
    }

    function wrapText(selection, width) {
        selection.each(function(d) { // Use the data object 'd' passed by D3
            const text = d3.select(this);
            // Always source the text from the data object 'd', not the DOM element
            const name = d.data.name.split('\n')[0].split(',')[0];
            const words = name.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            const y = text.attr("y") || 0;
            const dy = parseFloat(text.attr("dy")) || 0;

            // This is the critical fix: clear all content (tspans and text nodes) before re-wrapping.
            text.text(null);

            let tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > width) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", `${++lineNumber * lineHeight + dy}em`).text(word);
                }
            }

            // Center the text block vertically
            const textBlockHeight = (lineNumber + 1) * 12; // 12 is approx font-size
            const verticalOffset = -(textBlockHeight / 2) + (nodeHeight / 10);
            text.attr("transform", `translate(0, ${verticalOffset})`);
        });
    }

    // Responsive resize
    window.addEventListener('resize', () => {
        if (originalData) {
            width = treeContainer.clientWidth - margin.right - margin.left;
            initializeVisualization(originalData);
        }
    });
});
