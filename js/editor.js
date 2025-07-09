document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const tableContainer = document.getElementById('editor-table-container');
    const saveButton = document.getElementById('save-button');

    let originalDataStructure = null;
    let flatData = [];
    let headers = [];

    // 1. Handle file loading
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                originalDataStructure = JSON.parse(e.target.result);
                if (typeof originalDataStructure !== 'object' || originalDataStructure === null) {
                    throw new Error('JSON data is not a valid object.');
                }

                // Flatten the hierarchical data into a list for the table
                flatData = [];
                const allKeys = new Set();
                
                function flatten(node) {
                    if (!node) return;
                    // Add a unique ID to each node to track it during edits
                    node._uniqueId = node._uniqueId || `node_${Math.random().toString(36).substr(2, 9)}`;
                    flatData.push(node);
                    Object.keys(node).forEach(key => {
                        if (key !== 'children') allKeys.add(key);
                    });
                    if (node.children) {
                        node.children.forEach(flatten);
                    }
                }

                flatten(originalDataStructure);
                headers = [...allKeys].filter(h => h !== '_uniqueId'); // Don't show the internal ID

                renderTable();
                saveButton.disabled = false;
            } catch (error) {
                alert(`Error parsing JSON file: ${error.message}`);
                originalDataStructure = null;
                flatData = [];
                tableContainer.innerHTML = '<p class="text-red-500 italic">Failed to load or parse file. Please ensure it is a valid JSON object.</p>';
                saveButton.disabled = true;
            }
        };
        reader.readAsText(file);
    });

    // 2. Render the editable table
    function renderTable() {
        if (flatData.length === 0) return;

        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-slate-200';

        const thead = document.createElement('thead');
        thead.className = 'bg-slate-50';
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.scope = 'col';
            th.className = 'px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider';
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-slate-200';
        flatData.forEach(item => {
            const row = document.createElement('tr');
            headers.forEach(header => {
                const cell = document.createElement('td');
                cell.className = 'px-6 py-4 whitespace-nowrap text-sm text-slate-700';
                cell.contentEditable = true;
                cell.textContent = item[header] !== undefined ? item[header] : '';
                cell.addEventListener('input', (e) => {
                    item[header] = e.target.textContent;
                });
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    // 3. Handle saving the data
    saveButton.addEventListener('click', () => {
        if (!originalDataStructure) {
            alert('No data to save.');
            return;
        }

        // Rebuild the original hierarchical structure from the flat data
        const nodeMap = new Map(flatData.map(node => [node._uniqueId, node]));
        
        // Clear children arrays to start fresh
        nodeMap.forEach(node => {
            if (node.children) node.children = [];
        });

        // This part is tricky. We assume the parent-child relationships haven't changed,
        // only the data within each node. We need to reconstruct the original tree.
        // A simple way is to re-use the original structure and just update the values.
        function updateNodeValues(node) {
            if (!node || !node._uniqueId) return;
            const editedNode = nodeMap.get(node._uniqueId);
            if (editedNode) {
                Object.assign(node, editedNode);
            }
            if (node.children) {
                node.children.forEach(updateNodeValues);
            }
        }

        updateNodeValues(originalDataStructure);

        // Clean up the temporary IDs before saving
        function cleanupIds(node) {
            delete node._uniqueId;
            if (node.children) {
                node.children.forEach(cleanupIds);
            }
        }
        cleanupIds(originalDataStructure);

        const updatedJson = JSON.stringify(originalDataStructure, null, 4);
        const blob = new Blob([updatedJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'family.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('File `family.json` has been downloaded!\n\nTo see your changes, please replace the old file in the `data` directory with this new one.');
    });
});
