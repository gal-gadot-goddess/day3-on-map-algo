const OVERPASS_INSTANCES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.osmsurround.org/api/interpreter",
    "https://overpass.osm.ch/api/interpreter"
];

export async function fetchGraphData(bounds, retries = 3) {
    // bounds: { south, west, north, east }
    const { south, west, north, east } = bounds;
    const query = `
    [out:json][timeout:25];
    (
      way["highway"]
         ["highway"!="motorway"]
         ["highway"!="trunk"]
         (${south},${west},${north},${east});
    );
    (._;>;);
    out body;
  `;

    // Try each server in order until one works
    for (const baseUrl of OVERPASS_INSTANCES) {
        const url = `${baseUrl}?data=${encodeURIComponent(query)}`;

        // Retry logic for the current server
        for (let attempt = 0; attempt < 2; attempt++) { // Reduced retries per server to failover faster
            try {
                console.log(`Fetching from ${baseUrl} (attempt ${attempt + 1})...`);

                // Add AbortController for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.status === 429 || response.status === 504) {
                    throw new Error(`Rate limited or Timeout (${response.status})`);
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                console.log(`Successfully fetched ${data.elements?.length || 0} elements`);
                return buildGraphFromOverpass(data);
            } catch (err) {
                console.warn(`${baseUrl} failed:`, err.message);

                // If it's a rate limit (429), break inner loop to try next server immediately
                if (err.message.includes('429') || err.message.includes('Rate limited')) {
                    break;
                }

                // For other errors, wait briefly then retry same server
                if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    console.error("All Overpass servers failed");
    return null;
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
    // This cleans up isolated sub-graphs (islands) that cause pathfinding failure
    const largestComponent = getLargestComponent(Object.keys(nodes), adj);
    const filteredNodes = {};
    const filteredAdj = {};

    if (largestComponent.size > 0) {
        largestComponent.forEach(id => {
            filteredNodes[id] = nodes[id];
            if (adj[id]) {
                filteredAdj[id] = {};
                // Only keep edges that connect to other nodes in the component
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
