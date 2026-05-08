import TinyQueue from 'tinyqueue';

// Basic heuristic for A* (Haversine distance)
function heuristic(nodeA, nodeB) {
  if (!nodeA || !nodeB) return 0;
  const R = 6371; // km
  const dLat = (nodeB.lat - nodeA.lat) * Math.PI / 180;
  const dLon = (nodeB.lon - nodeA.lon) * Math.PI / 180;
  const lat1 = nodeA.lat * Math.PI / 180;
  const lat2 = nodeB.lat * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Meters
}

export const algorithms = {
  BFS: (graph, startId, endId) => {
    const sId = String(startId);
    const eId = String(endId);
    const visitedEdges = [];
    const queue = [sId];
    const visited = new Set([sId]);
    const parent = {};
    let found = false;

    while (queue.length > 0) {
      const u = queue.shift();
      if (u === eId) {
        found = true;
        break;
      }
      if (graph.adj[u]) {
        for (const v in graph.adj[u]) {
          if (!visited.has(v)) {
            visited.add(v);
            parent[v] = u;
            visitedEdges.push({ from: u, to: v });
            queue.push(v);
          }
        }
      }
    }
    const path = reconstructPath(parent, sId, eId, found);
    return { visitedEdges, path };
  },

  DFS: (graph, startId, endId) => {
    const sId = String(startId);
    const eId = String(endId);
    const visitedEdges = [];
    const stack = [sId];
    const visited = new Set([sId]);
    const parent = {};
    let found = false;

    while (stack.length > 0) {
      const u = stack.pop();
      if (u === eId) {
        found = true;
        break;
      }
      if (graph.adj[u]) {
        const neighbors = Object.keys(graph.adj[u]);
        for (const v of neighbors) {
          if (!visited.has(v)) {
            visited.add(v);
            parent[v] = u;
            visitedEdges.push({ from: u, to: v });
            stack.push(v);
          }
        }
      }
    }
    const path = reconstructPath(parent, sId, eId, found);
    return { visitedEdges, path };
  },

  Dijkstra: (graph, startId, endId) => {
    return runWeightedSearch(graph, String(startId), String(endId), 'Dijkstra');
  },

  'A*': (graph, startId, endId) => {
    return runWeightedSearch(graph, String(startId), String(endId), 'A*');
  },

  'Greedy Best-First': (graph, startId, endId) => {
    // Heuristic only, no path cost
    return runWeightedSearch(graph, String(startId), String(endId), 'Greedy');
  },

  'Bidirectional BFS': (graph, startId, endId) => {
    return runBidirectionalBFS(graph, String(startId), String(endId));
  },

  'Bidirectional Dijkstra': (graph, startId, endId) => {
    return runBidirectionalWeighted(graph, String(startId), String(endId), false);
  },

  'Bidirectional A*': (graph, startId, endId) => {
    // Typically simpler to implement as meeting in the middle with balanced heuristics
    return runBidirectionalWeighted(graph, String(startId), String(endId), true);
  }
};

function runWeightedSearch(graph, startId, endId, type) {
  const visitedEdges = [];
  const startNode = graph.nodes[startId];
  const endNode = graph.nodes[endId];

  // item format: { id, cost, priority }
  const pq = new TinyQueue([], (a, b) => a.priority - b.priority);

  const dist = {};
  const parent = {};

  // Initialize
  for (const id in graph.nodes) {
    dist[id] = Infinity;
  }
  dist[startId] = 0;

  pq.push({ id: startId, cost: 0, priority: 0 });

  const visited = new Set();

  while (pq.length > 0) {
    const { id: u, cost: uCost } = pq.pop();

    if (visited.has(u)) continue;
    visited.add(u);

    if (parent[u]) {
      visitedEdges.push({ from: parent[u], to: u });
    }

    if (u === endId) break;

    if (graph.adj[u]) {
      for (const v in graph.adj[u]) {
        if (visited.has(v)) continue;

        const weight = graph.adj[u][v];
        const newDist = uCost + weight;

        // Greedy: cost is ignored, priority is just heuristic
        if (type === 'Greedy') {
          if (newDist < dist[v]) { // Use dist to track visited basically
            dist[v] = newDist;
            parent[v] = u;
            const h = heuristic(graph.nodes[v], endNode);
            pq.push({ id: v, cost: newDist, priority: h });
          }
        } else {
          // Dijkstra/A*
          if (newDist < dist[v]) {
            dist[v] = newDist;
            parent[v] = u;

            let priority = newDist;
            if (type === 'A*') {
              priority += heuristic(graph.nodes[v], endNode);
            }
            pq.push({ id: v, cost: newDist, priority });
          }
        }
      }
    }
  }

  const path = reconstructPath(parent, startId, endId, visited.has(endId));
  return { visitedEdges, path };
}

function runBidirectionalBFS(graph, startId, endId) {
  const visitedEdges = []; // We will push edges from both sides
  // Two queues, two visited sets, two parent maps
  const qFwd = [startId];
  const qBwd = [endId];

  const visitedFwd = new Set([startId]);
  const visitedBwd = new Set([endId]);

  const parentFwd = {};
  const parentBwd = {};

  let intersectNode = null;

  while (qFwd.length > 0 && qBwd.length > 0) {
    // Forward Step
    if (qFwd.length > 0) {
      const u = qFwd.shift();
      if (graph.adj[u]) {
        for (const v in graph.adj[u]) {
          if (!visitedFwd.has(v)) {
            visitedFwd.add(v);
            parentFwd[v] = u;
            visitedEdges.push({ from: u, to: v });
            qFwd.push(v);
            if (visitedBwd.has(v)) {
              intersectNode = v;
              break;
            }
          }
        }
      }
    }
    if (intersectNode) break;

    // Backward Step
    if (qBwd.length > 0) {
      const u = qBwd.shift();
      if (graph.adj[u]) {
        for (const v in graph.adj[u]) {
          if (!visitedBwd.has(v)) {
            visitedBwd.add(v);
            parentBwd[v] = u;
            // Store backward edges too for viz, maybe with a flag? 
            // For now just list them, they might look like they are expanding from end
            visitedEdges.push({ from: u, to: v });
            qBwd.push(v);
            if (visitedFwd.has(v)) {
              intersectNode = v;
              break;
            }
          }
        }
      }
    }
    if (intersectNode) break;
  }

  // Reconstruct Path
  let path = [];
  if (intersectNode) {
    // Path start -> intersect
    let curr = intersectNode;
    const p1 = [];
    while (curr !== startId) {
      p1.push(curr);
      curr = parentFwd[curr];
    }
    p1.push(startId);
    p1.reverse();

    // Path intersect -> end
    const p2 = [];
    curr = intersectNode;
    while (curr !== endId) {
      // p2 does not include intersectNode to strict duplicate
      curr = parentBwd[curr];
      p2.push(curr);
    }

    path = p1.concat(p2);
  }

  return { visitedEdges, path };
}

function runBidirectionalWeighted(graph, startId, endId, useAStar) {
  const visitedEdges = [];

  const startNode = graph.nodes[startId];
  const endNode = graph.nodes[endId];

  const pqFwd = new TinyQueue([], (a, b) => a.priority - b.priority);
  const pqBwd = new TinyQueue([], (a, b) => a.priority - b.priority);

  const distFwd = {};
  const distBwd = {};
  const parentFwd = {};
  const parentBwd = {};

  // Init dicts
  // Unlike unweighted, we don't init all to infinity for perf on large graphs, just lazy
  // But check existence

  distFwd[startId] = 0;
  distBwd[endId] = 0;

  pqFwd.push({ id: startId, cost: 0, priority: 0 });
  pqBwd.push({ id: endId, cost: 0, priority: 0 });

  const visitedFwd = new Set();
  const visitedBwd = new Set();

  let intersectNode = null;
  let bestPathLen = Infinity;

  // We alternate steps
  while (pqFwd.length > 0 && pqBwd.length > 0) {
    // Forward Step
    if (pqFwd.length > 0) {
      const { id: u, cost: uCost } = pqFwd.pop();

      if (!visitedFwd.has(u)) {
        visitedFwd.add(u);
        if (parentFwd[u]) visitedEdges.push({ from: parentFwd[u], to: u });

        if (visitedBwd.has(u)) {
          // Potential intersection met
          if (uCost + distBwd[u] < bestPathLen) {
            bestPathLen = uCost + distBwd[u];
            intersectNode = u;
          }
          // In strict Bidi Dijkstra we wait until top of PQ >= bestPathLen to stop
        }

        if (graph.adj[u]) {
          for (const v in graph.adj[u]) {
            const weight = graph.adj[u][v];
            const newDist = uCost + weight;
            if (newDist < (distFwd[v] ?? Infinity)) {
              distFwd[v] = newDist;
              parentFwd[v] = u;
              let priority = newDist;
              if (useAStar) priority += heuristic(graph.nodes[v], endNode); // Simple A* fwd
              pqFwd.push({ id: v, cost: newDist, priority });
            }
          }
        }
      }
    }

    // Backward Step
    if (pqBwd.length > 0) {
      const { id: u, cost: uCost } = pqBwd.pop();

      if (!visitedBwd.has(u)) {
        visitedBwd.add(u);
        if (parentBwd[u]) visitedEdges.push({ from: parentBwd[u], to: u });

        if (visitedFwd.has(u)) {
          if (uCost + distFwd[u] < bestPathLen) {
            bestPathLen = uCost + distFwd[u];
            intersectNode = u;
          }
        }

        if (graph.adj[u]) {
          for (const v in graph.adj[u]) {
            const weight = graph.adj[u][v];
            const newDist = uCost + weight;
            if (newDist < (distBwd[v] ?? Infinity)) {
              distBwd[v] = newDist;
              parentBwd[v] = u;
              let priority = newDist;
              if (useAStar) priority += heuristic(graph.nodes[v], startNode); // Valid for consistent heuristic
              pqBwd.push({ id: v, cost: newDist, priority });
            }
          }
        }
      }
    }

    // Stop condition (approximate for visualizer speed)
    // If intersect found and we are exploring nodes worse than best path, break
    if (intersectNode) {
      // Check tops
      const fMin = pqFwd.length ? pqFwd.peek().cost : Infinity;
      const bMin = pqBwd.length ? pqBwd.peek().cost : Infinity;
      if (fMin + bMin >= bestPathLen) break;
    }
  }

  // Reconstruct
  let path = [];
  if (intersectNode) {
    let curr = intersectNode;
    const p1 = [];
    while (curr !== startId) {
      p1.push(curr);
      curr = parentFwd[curr];
    }
    p1.push(startId);
    p1.reverse();

    const p2 = [];
    curr = intersectNode;
    while (curr !== endId) {
      curr = parentBwd[curr];
      if (curr) p2.push(curr);
    }

    path = p1.concat(p2);
  }

  return { visitedEdges, path };
}


function reconstructPath(parent, startId, endId, found) {
  if (!found) return [];
  const path = [];
  let curr = endId;
  while (curr !== startId) {
    path.push(curr);
    curr = parent[curr];
    if (!curr) break; // Should not happen if found is true
  }
  path.push(startId);
  return path.reverse();
}
