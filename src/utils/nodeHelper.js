// Helper function to get nearest node for ANY location worldwide
export async function getNearestNode(lat, lng) {
    const radius = 0.15; // 150m radius
    const bounds = {
        south: lat - radius / 111, // Rough conversion: 1 degree ≈ 111km
        north: lat + radius / 111,
        west: lng - radius / (111 * Math.cos(lat * Math.PI / 180)),
        east: lng + radius / (111 * Math.cos(lat * Math.PI / 180))
    };

    const query = `
    [out:json][timeout:10];
    (
      node["highway"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out body;
  `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.elements || data.elements.length === 0) {
            return null;
        }

        // Find nearest node
        let nearestNode = null;
        let minDist = Infinity;

        data.elements.forEach(node => {
            if (node.type === 'node') {
                const dist = Math.sqrt(
                    Math.pow(node.lat - lat, 2) + Math.pow(node.lon - lng, 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    nearestNode = { id: node.id, lat: node.lat, lon: node.lon };
                }
            }
        });

        return nearestNode;
    } catch (err) {
        console.error('Error fetching nearest node:', err);
        return null;
    }
}
