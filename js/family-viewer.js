document.addEventListener('DOMContentLoaded', function() {
    const treeContainer = document.getElementById('tree-container');
    const sidebar = document.getElementById('sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    const searchInput = document.getElementById('search-input');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const resetViewBtn = document.getElementById('reset-view-btn');
    const editButton = document.getElementById('edit-button');
    const editFormContainer = document.getElementById('edit-form-container');

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
    const treemap = d3.tree().nodeSize([nodeHeight + 20, 0]);

    let i = 0;
    let root;
    let allNodes = [];
    const duration = 250;
    let currentHeight = height;
    let originalData = null;
    let selectedNode = null;

    fetch('data/family.json')
        .then(response => response.json())
        .then(data => {
            originalData = data;
            initializeVisualization(originalData);
            document.addEventListener('click', (event) => {
                if (!event.target.closest('#search-container')) {
                    autocompleteResults.innerHTML = '';
                }
            });
        }).catch(error => console.error('Error loading family data:', error));

    resetViewBtn.addEventListener('click', resetTree);
    editButton.addEventListener('click', () => {
        if (selectedNode) {
            showEditForm(selectedNode);
        }
    });

    function initializeVisualization(treeData) {
        treeContainer.innerHTML = '';
        svg = d3.select(treeContainer).append('svg').attr('width', '100%').call(zoom);
        g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
        root = d3.hierarchy(treeData, d => d.children);
        root.x0 = height / 2;
        root.y0 = 0;
        allNodes = root.descendants();
        setupAutocomplete(allNodes);
        if (root.children) {
            root.children.forEach(collapse);
        }
        update(root, true);
        treeContainer.addEventListener('click', (event) => {
            if (event.target.closest('.node') || event.target.closest('#sidebar')) return;
            sidebar.classList.remove('open');
            selectedNode = null;
            updateSidebarControls();
        });
    }

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    function update(source, isInitial = false) {
        const layout = treemap(root);
        let nodes = layout.descendants();
        let links = layout.links();
        let minX = Infinity, maxX = -Infinity;
        nodes.forEach(d => {
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
        });
        const dynamicHeight = maxX - minX;
        currentHeight = Math.max(dynamicHeight, height);
        svg.attr('height', currentHeight + margin.top + margin.bottom);
        nodes.forEach(d => { d.y = d.depth * (nodeWidth + 120); });

        if (isInitial) {
            const t = d3.zoomIdentity.translate(width / 2 - root.y, currentHeight / 2 - root.x).scale(1);
            svg.call(zoom.transform, t);
        }

        const nodeSelection = g.selectAll('g.node').data(nodes, d => d.id || (d.id = ++i));
        const nodeEnter = nodeSelection.enter().append('g')
            .attr('transform', `translate(${source.y0},${source.x0})`)
            .on('click', (event, d) => {
                if (d.children || d._children) {
                    toggle(d);
                    update(d);
                }
                handleNodeSelection(d);
                centerOnNode(d);
            });

        nodeEnter.append('rect').attr('class', 'node-rect').attr('width', 1e-6).attr('height', 1e-6).attr('x', -nodeWidth / 2).attr('y', -nodeHeight / 2).attr('rx', 10);
        nodeEnter.append('text').attr('class', 'node-name').attr('dy', '0.31em').attr('x', 0).attr('text-anchor', 'middle');
        const indicator = nodeEnter.append('g').attr('class', 'expand-indicator').attr('transform', `translate(${nodeWidth / 2}, 0)`);
        indicator.append('circle').attr('r', 8).style('fill', 'var(--primary-color)');
        indicator.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').style('fill', 'white').style('font-size', '12px').style('font-weight', 'bold');

        const nodeUpdate = nodeEnter.merge(nodeSelection);
        nodeUpdate.attr('class', 'node');
        nodeUpdate.transition().duration(duration).attr('transform', d => `translate(${d.y},${d.x})`);
        nodeUpdate.select('rect.node-rect').attr('width', nodeWidth).attr('height', nodeHeight).style('stroke', d => d.id === (selectedNode && selectedNode.id) ? 'var(--primary-color)' : (d.children || d._children ? 'var(--primary-color)' : '#94a3b8')).style('stroke-width', d => d.id === (selectedNode && selectedNode.id) ? '3px' : '1px');
        const indicatorUpdate = nodeUpdate.select('g.expand-indicator');
        indicatorUpdate.style('display', d => d.children || d._children ? null : 'none');
        indicatorUpdate.select('circle').style('fill', d => d._children ? 'var(--primary-color)' : '#fff').style('stroke', 'var(--primary-color)');
        indicatorUpdate.select('text').text(d => d._children ? '+' : '-').style('fill', d => d._children ? 'white' : 'var(--primary-color)');
        nodeUpdate.select('.node-name').call(wrapText, nodeWidth - 20);

        const nodeExit = nodeSelection.exit().transition().duration(duration).attr('transform', `translate(${source.y},${source.x})`).remove();
        nodeExit.select('rect').attr('width', 1e-6).attr('height', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        const linkSelection = g.selectAll('path.link').data(links, d => d.target.id);
        const linkEnter = linkSelection.enter().insert('path', 'g').attr('class', 'link').style('stroke', '#94a3b8').style('stroke-width', '1px').style('fill', 'none').attr('d', () => `M${source.y0},${source.x0} L${source.y0},${source.x0}`);
        const linkUpdate = linkEnter.merge(linkSelection);
        linkUpdate.transition().duration(duration).attr('d', d => `M ${d.source.y + nodeWidth / 2},${d.source.x} L ${d.source.y + nodeWidth / 2 + 60},${d.source.x} L ${d.source.y + nodeWidth / 2 + 60},${d.target.x} L ${d.target.y - nodeWidth / 2},${d.target.x}`);
        linkSelection.exit().transition().duration(duration).attr('d', () => `M ${source.y},${source.x} L ${source.y},${source.x}`).remove();

        nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
    }

    function toggle(d) {
        if (d.children) { d._children = d.children; d.children = null; } 
        else { d.children = d._children; d._children = null; }
    }

    function handleNodeSelection(d) {
        const isSameNode = selectedNode && selectedNode.id === d.id;
        selectedNode = isSameNode ? null : d;
        updateSidebar();
        update(d);
    }

    function updateSidebar() {
        if (selectedNode) {
            sidebarContent.innerHTML = `<p>${selectedNode.data.name.replace(/\n/g, '<br>')}</p>`;
            sidebar.classList.add('open');
        } else {
            sidebar.classList.remove('open');
        }
        updateSidebarControls();
    }

    function updateSidebarControls() {
        editButton.style.display = selectedNode ? 'inline-block' : 'none';
        editFormContainer.classList.add('hidden');
        sidebarContent.style.display = 'block';
    }

    function showEditForm(d) {
        sidebarContent.style.display = 'none';
        editButton.style.display = 'none';
        editFormContainer.classList.remove('hidden');

        const [name, ...bioParts] = d.data.name.split('\n');
        const biography = bioParts.join('\n');

        editFormContainer.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label for="edit-name" class="block text-sm font-medium text-gray-700">Name</label>
                    <input type="text" id="edit-name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value="${name}">
                </div>
                <div>
                    <label for="edit-bio" class="block text-sm font-medium text-gray-700">Biography</label>
                    <textarea id="edit-bio" rows="6" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">${biography}</textarea>
                </div>
                <div class="flex justify-end space-x-2">
                    <button id="cancel-edit" class="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded">Cancel</button>
                    <button id="save-edit" class="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded">Save</button>
                </div>
            </div>
        `;

        document.getElementById('save-edit').onclick = () => saveNodeData(d);
        document.getElementById('cancel-edit').onclick = () => {
            sidebarContent.style.display = 'block';
            editFormContainer.classList.add('hidden');
            updateSidebarControls();
        };
    }

    function saveNodeData(d) {
        const newName = document.getElementById('edit-name').value;
        const newBio = document.getElementById('edit-bio').value;
        d.data.name = `${newName}\n${newBio}`.trim();

        fetch('/api/family-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(originalData)
        })
        .then(response => response.json())
        .then(res => {
            console.log(res.message);
            // Visually confirm save
            const saveButton = document.getElementById('save-edit');
            saveButton.textContent = 'Saved!';
            saveButton.style.backgroundColor = '#22c55e'; // green-500
            setTimeout(() => {
                initializeVisualization(originalData); // Full redraw to reflect changes
                handleNodeSelection(d); // Reselect the node
                centerOnNode(d);
            }, 1000);
        })
        .catch(error => console.error('Error saving data:', error));
    }

    function setupAutocomplete(nodes) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            if (query.length < 2) { autocompleteResults.innerHTML = ''; return; }
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
        setTimeout(() => handleNodeSelection(node), duration);
    }

    function resetTree() {
        if (originalData) initializeVisualization(originalData);
    }

    function centerOnNode(node, animated = true) {
        const t = d3.zoomIdentity.translate(width / 2 - node.y, currentHeight / 2 - node.x).scale(1);
        const transition = animated ? svg.transition().duration(750) : svg;
        transition.call(zoom.transform, t);
    }

    function wrapText(selection, width) {
        selection.each(function(d) {
            const text = d3.select(this);
            const name = d.data.name.split('\n')[0].split(',')[0];
            const words = name.split(/\s+/).reverse();
            let word, line = [], lineNumber = 0;
            const lineHeight = 1.1;
            const y = text.attr("y") || 0;
            const dy = parseFloat(text.attr("dy")) || 0;
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
            const textBlockHeight = (lineNumber + 1) * 12;
            const verticalOffset = -(textBlockHeight / 2) + (nodeHeight / 10);
            text.attr("transform", `translate(0, ${verticalOffset})`);
        });
    }

    window.addEventListener('resize', () => {
        if (originalData) {
            width = treeContainer.clientWidth - margin.right - margin.left;
            initializeVisualization(originalData);
        }
    });
});
