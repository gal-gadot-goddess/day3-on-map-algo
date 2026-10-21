// Road graph builder using real OpenStreetMap geometry
// Primary: Official OSM Core API (fast, reliable)
// Fallback: Overpass API instances via POST

const OVERPASS_INSTANCES = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter"
];

const VALID_HIGHWAYS = new Set([
    'primary', 'secondary', 'tertiary', 'residential', 'living_street',
    'unclassified', 'trunk', 'motorway', 'motorway_link', 'trunk_link',
    'primary_link', 'secondary_link', 'tertiary_link'
]);

export async function fetchGraphData(bounds) {
    // bounds: { south, west, north, east }
    const { south, west, north, east } = bounds;

    // 1. Try official OpenStreetMap Core API first (fast, 99.99% uptime)
    try {
        const osmUrl = `https://api.openstreetmap.org/api/0.6/map?bbox=${west},${south},${east},${north}`;
        console.log(`[OSM] Fetching real street network from OSM Core API...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(osmUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Day3MapVisualizer/1.0 (https://github.com/gal-gadot-goddess/day3-on-map-algo)'
            }
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const xmlText = await response.text();
            const graph = buildGraphFromOsmXml(xmlText);
            if (graph && Object.keys(graph.nodes).length >= 20) {
                console.log(`[OSM] Successfully parsed ${Object.keys(graph.nodes).length} real street intersections from OSM API`);
                return graph;
            }
            console.warn(`[OSM] Parsed too few connected nodes (${graph ? Object.keys(graph.nodes).length : 0})`);
        } else {
            console.warn(`[OSM] OSM Core API returned HTTP ${response.status}`);
        }
    } catch (err) {
        console.warn(`[OSM] OSM Core API fetch failed:`, err.message);
    }

    // 2. Fallback to Overpass API instances using POST
    const overpassQuery = `
    [out:json][timeout:25];
    (
      way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|trunk|motorway)$"](${south},${west},${north},${east});
    );
    (._;>;);
    out body;
    `;

    for (const baseUrl of OVERPASS_INSTANCES) {
        try {
            console.log(`[Overpass] Fetching real street network from ${baseUrl}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            const response = await fetch(baseUrl, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Day3MapVisualizer/1.0 (https://github.com/gal-gadot-goddess/day3-on-map-algo)',
                    'Accept': 'application/json'
                },
                body: 'data=' + encodeURIComponent(overpassQuery)
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.elements && data.elements.length >= 20) {
                    const graph = buildGraphFromOverpass(data);
                    if (graph && Object.keys(graph.nodes).length >= 20) {
                        console.log(`[Overpass] Successfully loaded ${Object.keys(graph.nodes).length} real street nodes from ${baseUrl}`);
                        return graph;
                    }
                }
            } else {
                console.warn(`[Overpass] ${baseUrl} returned HTTP ${response.status}`);
            }
        } catch (err) {
            console.warn(`[Overpass] ${baseUrl} failed:`, err.message);
        }
    }

    // Strictly real street geometry only — no synthetic or procedural mesh fallbacks
    console.error("All real map data providers failed to return road network for bounds:", bounds);
    return null;
}

export function buildGraphFromOsmXml(xmlText) {
    const nodes = {};
    const adj = {};

    // Extract all node tags: <node id="123" ... lat="64.14" lon="-21.92" ... />
    const nodeTagRegex = /<node\s+([^>]+)(?:\/?>|>[\s\S]*?<\/node>)/g;
    let match;
    while ((match = nodeTagRegex.exec(xmlText)) !== null) {
        const attrs = match[1];
        const idMatch = attrs.match(/\bid=["'](\d+)["']/);
        const latMatch = attrs.match(/\blat=["']([0-9.-]+)["']/);
        const lonMatch = attrs.match(/\blon=["']([0-9.-]+)["']/);
        if (idMatch && latMatch && lonMatch) {
            nodes[idMatch[1]] = {
                id: idMatch[1],
                lat: parseFloat(latMatch[1]),
                lon: parseFloat(lonMatch[1])
            };
        }
    }

    const wayRegex = /<way[\s\S]*?<\/way>/g;
    let wayMatch;

    while ((wayMatch = wayRegex.exec(xmlText)) !== null) {
        const wayXml = wayMatch[0];
        const hwMatch = wayXml.match(/<tag\s+[^>]*k=["']highway["'][^>]*v=["']([^"']+)["']/);
        if (!hwMatch || !VALID_HIGHWAYS.has(hwMatch[1])) {
            continue;
        }

        const ndRegex = /<nd\s+[^>]*ref=["'](\d+)["']/g;
        let ndMatch;
        const wayNodes = [];
        while ((ndMatch = ndRegex.exec(wayXml)) !== null) {
            wayNodes.push(ndMatch[1]);
        }

        for (let i = 0; i < wayNodes.length - 1; i++) {
            const u = wayNodes[i];
            const v = wayNodes[i + 1];
            if (nodes[u] && nodes[v]) {
                const dist = getDistance(nodes[u], nodes[v]);
                if (!adj[u]) adj[u] = {};
                if (!adj[v]) adj[v] = {};
                adj[u][v] = dist;
                adj[v][u] = dist;
            }
        }
    }

    // Keep only the largest connected component
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

export function buildGraphFromOverpass(data) {
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
