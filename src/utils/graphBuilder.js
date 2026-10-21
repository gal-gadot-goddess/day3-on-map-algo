const OVERPASS_INSTANCES = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter"
];

export async function fetchGraphData(bounds, retries = 3) {
    // bounds: { south, west, north, east }
    const { south, west, north, east } = bounds;
    const query = `
    [out:json][timeout:20];
    (
      way["highway"]
         ["highway"!="motorway"]
         ["highway"!="trunk"]
         (${south},${west},${north},${east});
    );
    (._;>;);
    out body;
  `;

    // Try each global server in order until one works
    for (const baseUrl of OVERPASS_INSTANCES) {
        const url = `${baseUrl}?data=${encodeURIComponent(query)}`;

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                console.log(`Fetching from ${baseUrl} (attempt ${attempt + 1})...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json, text/plain, */*'
                    }
                });
                clearTimeout(timeoutId);

                if (response.status === 429 || response.status === 504) {
                    throw new Error(`Rate limited or Timeout (${response.status})`);
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                if (!data.elements || data.elements.length < 20) {
                    throw new Error(`Insufficient road elements (${data.elements?.length || 0})`);
                }

                console.log(`Successfully fetched ${data.elements.length} elements from ${baseUrl}`);
                const graph = buildGraphFromOverpass(data);
                if (graph && Object.keys(graph.nodes).length >= 10) {
                    return graph;
                }
                throw new Error("Parsed graph has too few connected intersections");
            } catch (err) {
                console.warn(`${baseUrl} failed:`, err.message);

                if (err.message.includes('429') || err.message.includes('Rate limited')) {
                    break;
                }

                if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    console.warn("⚠️ All Overpass servers failed or timed out. Generating procedural street graph fallback for coordinates...");
    return generateProceduralGraph(bounds);
}

function buildGraphFromOverpass(data) {
    const nodes = {};
    const adj = {};

    // First pass: extract nodes
    data.elements.forEach(el => {
        if (el.type === 'node') {
            nodes[el.id] = { id: el.id, lat: el.lat, lon: el.lon };
        }
    });

    // Second pass: extract ways and build edges
    data.elements.forEach(el => {
        if (el.type === 'way' && el.nodes) {
            for (let i = 0; i < el.nodes.length - 1; i++) {
                const u = el.nodes[i];
                const v = el.nodes[i + 1];

                if (nodes[u] && nodes[v]) {
                    const dist = getDistance(nodes[u], nodes[v]);

                    if (!adj[u]) adj[u] = {};
                    if (!adj[v]) adj[v] = {};

                    adj[u][v] = dist;
                    adj[v][u] = dist;
                }
            }
        }
    });

    // Post-processing: Keep only the largest connected component
    const largestComponent = getLargestComponent(Object.keys(nodes), adj);
    const filteredNodes = {};
    const filteredAdj = {};

    if (largestComponent.size > 0) {
        largestComponent.forEach(id => {
            filteredNodes[id] = nodes[id];
            if (adj[id]) {
                filteredAdj[id] = {};
                Object.keys(adj[id]).forEach(neighbor => {
                    if (largestComponent.has(neighbor)) {
                        filteredAdj[id][neighbor] = adj[id][neighbor];
                    }
                });
            }
        });
        return { nodes: filteredNodes, adj: filteredAdj };
    }

    return { nodes, adj };
}

export function generateProceduralGraph(bounds) {
    const { south, west, north, east } = bounds;
    const rows = 12;
    const cols = 12;
    const nodes = {};
    const adj = {};

    const dLat = (north - south) / (rows - 1);
    const dLon = (east - west) / (cols - 1);

    const grid = [];
    let idCounter = 100000;

    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            const id = `proc_${idCounter++}`;
            const jitterLat = (Math.sin(r * 3.7 + c * 2.1) * 0.15) * dLat;
            const jitterLon = (Math.cos(r * 2.3 + c * 4.1) * 0.15) * dLon;

            const lat = south + r * dLat + jitterLat;
            const lon = west + c * dLon + jitterLon;

            nodes[id] = { id, lat, lon };
            adj[id] = {};
            grid[r][c] = id;
        }
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const u = grid[r][c];

            if (c < cols - 1) {
                const v = grid[r][c + 1];
                const dist = getDistance(nodes[u], nodes[v]);
                adj[u][v] = dist;
                adj[v][u] = dist;
            }

            if (r < rows - 1) {
                const v = grid[r + 1][c];
                const dist = getDistance(nodes[u], nodes[v]);
                adj[u][v] = dist;
                adj[v][u] = dist;
            }

            if ((r + c) % 3 === 0 && r < rows - 1 && c < cols - 1) {
                const v = grid[r + 1][c + 1];
                const dist = getDistance(nodes[u], nodes[v]);
                adj[u][v] = dist;
                adj[v][u] = dist;
            }
        }
    }

    return { nodes, adj };
}

function getLargestComponent(nodeIds, adj) {
    const visited = new Set();
    let maxComponent = new Set();

    for (const id of nodeIds) {
        if (!visited.has(id)) {
            const component = new Set();
            const stack = [id];
            visited.add(id);
            component.add(id);

            while (stack.length > 0) {
                const u = stack.pop();
                if (adj[u]) {
                    for (const v in adj[u]) {
                        if (!visited.has(v)) {
                            visited.add(v);
                            component.add(v);
                            stack.push(v);
                        }
                    }
                }
            }

            if (component.size > maxComponent.size) {
                maxComponent = component;
            }
        }
    }
    return maxComponent;
}

function getDistance(nodeA, nodeB) {
    const R = 6371e3; // meters
    const dLat = (nodeB.lat - nodeA.lat) * Math.PI / 180;
    const dLon = (nodeB.lon - nodeA.lon) * Math.PI / 180;
    const lat1 = nodeA.lat * Math.PI / 180;
    const lat2 = nodeB.lat * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
