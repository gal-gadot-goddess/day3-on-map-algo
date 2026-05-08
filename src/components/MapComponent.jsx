import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchGraphData } from '../utils/graphBuilder';
import { algorithms } from '../utils/algorithms';
import ControlPanel from './ControlPanel';
import soundManager from '../utils/sounds';
import currentTopic from '../data/current_topic.json';

// Fix leafet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Default location - can be changed dynamically
const DEFAULT_CENTER = [34.0195, -118.4912]; // Santa Monica
const START_ZOOM = 15;

const MapEvents = ({ onMapClick }) => {
    const map = useMap();
    useEffect(() => {
        window.mapInstance = map;
    }, [map]);

    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng);
        },
    });
    return null;
};



const MapComponent = () => {
    // State
    const [graph, setGraph] = useState(null);
    const [startNode, setStartNode] = useState(null);
    const [endNode, setEndNode] = useState(null);
    const [algorithm, setAlgorithm] = useState('Bidirectional BFS');
    const [isVisualizing, setIsVisualizing] = useState(false);
    const [visitedCount, setVisitedCount] = useState(0);
    const [visitedEdges, setVisitedEdges] = useState([]); // Array of {from, to}
    const [finalPath, setFinalPath] = useState(null);
    const [status, setStatus] = useState('Pan to any city, then click to load map!');
    const [visitedColor, setVisitedColor] = useState('#39ff14'); // NEON GREEN for Visited
    const [pathColor, setPathColor] = useState('#ffff00'); // NEON YELLOW for Final Path
    const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

    // Audio Context - now using soundManager
    const audioCtxRef = useRef(null);

    // Animation Refs
    const requestRef = useRef();
    const startTimeRef = useRef(null);

    // Initialize Audio
    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Also ensure soundManager is ready
        if (!soundManager.audioContext) {
            soundManager.loadSounds();
        }
    };

    // Start continuous background sound during visualization
    // Start continuous background sound AND ticks during visualization
    const startBackgroundSound = () => {
        soundManager.startAmbientSound();
        soundManager.startTickLoop(120); // Play piano tick every 120ms
    };

    // Stop background sound smoothly
    const stopBackgroundSound = () => {
        soundManager.stopTickLoop();
    };

    const playSound = (freq, duration = 0.05, type = 'sine') => {
        soundManager.generateBeep(freq, duration * 1000, 0.05);
    };

    // Play completion sound (triumphant chord)
    const playCompletionSound = () => {
        soundManager.playSuccess();
    };

    // No initial load - we load data when user clicks anywhere on the map

    // Canvas Renderer for base mesh
    const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

    // List of iconic cities for variety
    const CITIES = [
        { name: 'New York (SoHo)', lat: 40.7233, lng: -73.9988 },
        { name: 'London (Soho)', lat: 51.5134, lng: -0.1305 },
        { name: 'San Francisco (Market St)', lat: 37.7833, lng: -122.4167 },
        { name: 'Tokyo (Shibuya)', lat: 35.6580, lng: 139.7016 },
        { name: 'Paris (Marais)', lat: 48.8584, lng: 2.3551 },
        { name: 'Barcelona (Eixample)', lat: 41.3934, lng: 2.1643 }
    ];

    const automationStartedRef = useRef(false);
    const [round, setRound] = useState(1); // Track automation round (1 or 2)

    // NEON PALETTES (Visited / Path) - High Visibility 100%
    const NEON_PALETTES = [
        { visited: '#39ff14', path: '#ffff00', name: 'Toxic Sludge' },   // Neon Green / Yellow
        { visited: '#d900ff', path: '#00eaff', name: 'Cyberpunk' },      // Magenta / Cyan
        { visited: '#9900ff', path: '#39ff14', name: 'Joker' },          // Purple / Green
        { visited: '#00bfff', path: '#ff3300', name: 'Fire & Ice' },     // Deep Sky Blue / Red-Orange
        { visited: '#ff0055', path: '#ffee00', name: 'Hotrod' },         // Hot Pink / Gold
        { visited: '#ffeb3b', path: '#f44336', name: 'Magma' }           // Yellow / Red
    ];

    const ALGO_DESCRIPTIONS = {
        'BFS': "Breadth-First Search explores equally in all directions, like a ripple in a pond. It's thorough but slow.",
        'DFS': "Depth-First Search plunges deep into a path before backtracking. It can get lost easily but is fast!",
        'Dijkstra': "Dijkstra's Algorithm calculates the exact shortest path by weighing every road. The gold standard for GPS.",
        'A*': "A* (A-Star) uses a smart heuristic to guess the direction, finding the shortest path much faster than Dijkstra.",
        'Greedy Best-First': "Greedy Best-First runs straight towards the target! It's super fast but doesn't always find the best route.",
        'Bidirectional BFS': "Two searches starting from both ends! They meet in the middle, cutting the search time in half.",
        'Bidirectional Dijkstra': "The ultimate optimizer. Two weighted searches meet in the middle for the fastest guaranteed shortest path.",
        'Bidirectional A*': "The speed king. Two smart searches racing towards each other. Extremely efficient for maps."
    };

    // AVAILABLE ALGORITHMS
    const ALGOS = Object.keys(algorithms);

    // Automation logic - Uses current_topic.json if available
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('automate') === 'true' && !window.automationStarted) {
            window.automationStarted = true;
            const setupAutomate = async () => {
                console.log("[AUTO] Automation starting with Topic Mode...");
                // Clear state
                window.currentGraph = null;
                window.graphDataLoaded = false;
                window.readyToRecord = false;
                window.isSortingCompleted = false;
                setGraph(null);
                setStartNode(null);
                setEndNode(null);

                // Use currentTopic from JSON
                const topic = currentTopic || { 
                    lat: 34.0195, 
                    lng: -118.4912, 
                    city: "Santa Monica", 
                    algorithm: "A*", 
                    palette: "Cyberpunk",
                    title: "A* in Santa Monica" 
                };
                
                console.log(`[AUTO] Selected Topic: ${topic.title || topic.city}`);

                // 1. Load City Center from Topic
                const center = L.latLng(topic.lat, topic.lng);
                await handleMapClick(center, 0.015);

                let checkLoadCount = 0;
                let checkLoad = setInterval(() => {
                    checkLoadCount++;
                    const currentG = window.currentGraph;
                    if (currentG && window.graphDataLoaded) {
                        clearInterval(checkLoad);
                        console.log(`[AUTO] Graph loaded with ${Object.keys(currentG.nodes).length} nodes`);

                        setTimeout(() => {
                            const nodes = Object.values(currentG.nodes);
                            if (nodes.length < 2) {
                                console.error("[AUTO] Not enough nodes in graph");
                                window.isSortingCompleted = true; 
                                return;
                            }
                            
                            // Get Algo and Palette from Topic
                            const selectedAlgo = topic.algorithm || ALGOS[Math.floor(Math.random() * ALGOS.length)];
                            const selectedPalette = NEON_PALETTES.find(p => p.name === topic.palette) || NEON_PALETTES[0];

                            console.log(`[AUTO] Algo: ${selectedAlgo}, Palette: ${selectedPalette.name}`);

                            // Apply Settings
                            setAlgorithm(selectedAlgo);
                            setVisitedColor(selectedPalette.visited);
                            setPathColor(selectedPalette.path);

                            // Store for metadata generation
                            window.metaData = {
                                city: topic.city,
                                algorithm: selectedAlgo,
                                description: ALGO_DESCRIPTIONS[selectedAlgo] || "Pathfinding on real maps.",
                                theme: selectedPalette.name,
                                title: topic.title
                            };

                            // Function to run a single round
                            const runRound = () => {
                                const nodes = Object.values(window.currentGraph.nodes);
                                // Pick a random start node
                                const start = nodes[Math.floor(Math.random() * nodes.length)];
                                // Sort remaining by distance to find a far point
                                const sorted = [...nodes].sort((a, b) => {
                                    const distA = Math.hypot(a.lat - start.lat, a.lon - start.lon);
                                    const distB = Math.hypot(b.lat - start.lat, b.lon - start.lon);
                                    return distB - distA;
                                });
                                // Pick one of the top 50 furthest nodes
                                const end = sorted[Math.min(sorted.length - 1, Math.floor(Math.random() * 50))];

                                console.log(`[AUTO] Round ${window.roundRef || 1}: Setting Points`);
                                setStartNode(null); setEndNode(null); // Reset

                                handleMapClick(L.latLng(start.lat, start.lon));
                                setTimeout(() => {
                                    handleMapClick(L.latLng(end.lat, end.lon));
                                    setTimeout(() => {
                                        const bounds = L.latLngBounds([start.lat, start.lon], [end.lat, end.lon]);
                                        window.mapInstance.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });

                                        setTimeout(() => {
                                            if (!window.readyToRecord) window.readyToRecord = true; 
                                            console.log("[AUTO] Starting visualization");
                                            startVisualization(selectedAlgo);
                                        }, 2000);
                                    }, 1000);
                                }, 1000);
                            };

                            // Start Round 1
                            window.roundRef = 1;
                            runRound();

                            // Listen for completion to trigger Round 2
                            window.onRoundComplete = () => {
                                if (window.roundRef === 1) {
                                    console.log("[AUTO] Round 1 Complete. Preparing Round 2...");
                                    window.roundRef = 2;
                                    setRound(2);
                                    setTimeout(() => {
                                        setFinalPath(null);
                                        setVisitedEdges([]);
                                        setVisitedCount(0);
                                        runRound();
                                    }, 2000);
                                } else {
                                    console.log("[AUTO] Sequence Complete.");
                                    window.isSortingCompleted = true; 
                                }
                            };
                        }, 2000);
                    } else if (checkLoadCount > 60) { 
                        clearInterval(checkLoad);
                        console.error("[AUTO] Graph load timeout");
                        window.isSortingCompleted = true; 
                    }
                }, 500);
            };
            setupAutomate();
        }
        window.soundManager = soundManager;
    }, []);

    // Derived: All Edges
    const allEdges = useMemo(() => {
        if (!graph) return [];
        const edges = [];
        const processed = new Set();
        Object.keys(graph.adj).forEach(u => {
            Object.keys(graph.adj[u]).forEach(v => {
                const key = u < v ? `${u}-${v}` : `${v}-${u}`;
                if (!processed.has(key)) {
                    processed.add(key);
                    if (graph.nodes[u] && graph.nodes[v]) {
                        edges.push([
                            [graph.nodes[u].lat, graph.nodes[u].lon],
                            [graph.nodes[v].lat, graph.nodes[v].lon]
                        ]);
                    }
                }
            });
        });
        return edges;
    }, [graph]);

    // Animation Loop (Time-based for smoothness)
    const animate = (timestamp) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const elapsed = timestamp - startTimeRef.current;

        // Dynamic duration: larger graphs take longer, but cap at 8s. Min 2s.
        const duration = Math.min(8000, Math.max(2000, visitedEdges.length * 2));

        const progress = Math.min(elapsed / duration, 1);
        const nextCount = Math.floor(progress * visitedEdges.length);

        setVisitedCount(nextCount);

        // CRITICAL: Keep sound playing continuously during entire visualization
        if (progress < 1 && visitedEdges.length > 0) {
            // Ensure ambient sound is still playing
            if (!soundManager.ambientOscillators || soundManager.ambientOscillators.length === 0) {
                startBackgroundSound();
            }
            requestRef.current = requestAnimationFrame(animate);
        } else {
            stopBackgroundSound();
            setIsVisualizing(false);
            if (finalPath && finalPath.length > 0) {
                setStatus('Path Found!');
            } else {
                setStatus('No Path Found!');
            }
            
            // Handle automation rounds
            if (window.onRoundComplete) {
                window.onRoundComplete();
            } else {
                window.isSortingCompleted = true;
            }
        }
    };

    useEffect(() => {
        window.startSorting = startVisualization;
        window.isSortingCompleted = false;
    }, []);

    useEffect(() => {
        if (isVisualizing) {
            startTimeRef.current = null;
            startBackgroundSound(); // Start continuous background sound
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => {
            cancelAnimationFrame(requestRef.current);
            stopBackgroundSound(); // Clean up sound on unmount
        };
    }, [isVisualizing, visitedEdges]);

    const handleMapClick = async (latlng, customDelta = null) => {
        if (isVisualizing) return;
        initAudio();

        // Use window.currentGraph as a fallback to handle React's async state updates during automation
        const activeGraph = graph || window.currentGraph;

        // If no graph loaded yet, load it for this location
        if (!activeGraph) {
            setStatus('Loading map data...');
            const delta = customDelta || 0.015;
            const bounds = {
                south: latlng.lat - delta,
                west: latlng.lng - (delta * 1.3),
                north: latlng.lat + delta,
                east: latlng.lng + (delta * 1.3)
            };

            // Use the improved fetchGraphData with multi-server fallback
            const graphData = await fetchGraphData(bounds);

            if (!graphData) {
                setStatus('Server busy (429). Please wait a moment or try another spot.');
                window.graphDataLoaded = false;
                return;
            }

            if (!graphData.nodes || Object.keys(graphData.nodes).length === 0) {
                setStatus('No roads found in this area. Try a denser area.');
                window.graphDataLoaded = false;
                return;
            }

            setGraph(graphData);
            window.currentGraph = graphData;
            window.graphDataLoaded = true;
            setStatus('Map loaded! Click to set points.');
            return;
        }

        // Find nearest node in the loaded graph
        let nearestDist = Infinity;
        let nearestId = null;

        if (!activeGraph || !activeGraph.nodes) {
            console.error("[MAP] No graph nodes available for nearest search");
            return;
        }

        Object.values(activeGraph.nodes).forEach(node => {
            const d = Math.pow(node.lat - latlng.lat, 2) + Math.pow(node.lon - latlng.lng, 2);
            if (d < nearestDist) {
                nearestDist = d;
                nearestId = node.id;
            }
        });

        console.log(`[MAP] Nearest node found: ${nearestId} at dist ${nearestDist}`);

        // Threshold for clicking "near" a road (approx 500m)
        if (!nearestId || nearestDist > 0.01) { // Relaxed to 0.01 for automation safety
            console.warn(`[MAP] Click rejected: dist ${nearestDist}`);
            setStatus('Too far from a road! Click closer to a street.');
            return;
        }

        // Set start or end node
        const s = startNode || window.startNode;
        const e = endNode || window.endNode;

        if (!s || (s && e)) {
            setStartNode(nearestId);
            window.startNode = nearestId;
            setEndNode(null);
            window.endNode = null;
            setFinalPath(null);
            setVisitedCount(0);
            setVisitedEdges([]);
            setStatus('Start point set. Click for end point.');
        } else {
            setEndNode(nearestId);
            window.endNode = nearestId;
            setStatus('Ready to Visualize');
        }
    };

    const startVisualization = async (algoOverride = null) => {
        const activeGraph = graph || window.currentGraph;
        const sNode = startNode || window.startNode;
        const eNode = endNode || window.endNode;

        if (!sNode || !eNode || !activeGraph) {
            console.warn(`[AUTO] Start/End/Graph missing. Start: ${sNode}, End: ${eNode}, Graph: ${!!activeGraph}`);
            return;
        }

        // FIX: Resume audio context if suspended (browser autoplay policy)
        if (soundManager.audioContext && soundManager.audioContext.state === 'suspended') {
            await soundManager.audioContext.resume();
        }

        initAudio();

        const activeAlgo = algoOverride || algorithm;
        const algorithmFn = algorithms[activeAlgo];
        if (!algorithmFn) {
            console.error(`Algorithm "${activeAlgo}" not found!`);
            setStatus('Error: Algorithm not found');
            return;
        }

        try {
            console.log(`[AUTO] Computing algorithm: ${activeAlgo}`);
            const result = algorithmFn(activeGraph, sNode, eNode);

            setVisitedCount(0);
            setFinalPath(result.path);
            setVisitedEdges(result.visitedEdges);
            setIsVisualizing(true);

            console.log(`[AUTO] Visualization started with ${result.visitedEdges.length} visited edges`);
            setStatus(`Running ${activeAlgo}...`);
        } catch (err) {
            console.error(`[AUTO] Algorithm Error: ${err.message}`);
            setStatus('Error in Algorithm');
            window.isSortingCompleted = true;
        }
    };

    const clear = () => {
        setStartNode(null);
        setEndNode(null);
        setVisitedCount(0);
        setVisitedEdges([]);
        setFinalPath(null);
        setIsVisualizing(false);
        setGraph(null); // Clear graph so user can load new location
        setStatus('Pan to any city, then click to load map!');
    };

    const pathPositions = useMemo(() => {
        if (!finalPath || !graph || visitedCount < visitedEdges.length) return [];
        const positions = finalPath.map(id => [graph.nodes[id].lat, graph.nodes[id].lon]);

        // Play completion sound when path is actually rendered
        if (positions.length > 0 && visitedCount >= visitedEdges.length) {
            setTimeout(() => playCompletionSound(), 100);
        }

        return positions;
    }, [finalPath, graph, visitedCount, visitedEdges]);

    // Default colors are now in state
    const vColor = visitedColor;
    const pColor = pathColor;

    return (
        <>
            <MapContainer
                center={mapCenter}
                zoom={START_ZOOM}
                // Filter removed here - applied to .leaflet-tile-pane in CSS instead
                style={{ width: '100%', height: '100%' }}
                zoomControl={false}
                className="map-container"
                preferCanvas={true}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <ZoomControl position="bottomleft" style={{ display: 'none' }} />

                <MapEvents onMapClick={handleMapClick} />

                {/* Base Mesh */}
                {allEdges.length > 0 && (
                    <Polyline
                        positions={allEdges}
                        pathOptions={{ color: '#222222', weight: 1, opacity: 0.5 }}
                        renderer={canvasRenderer}
                    />
                )}

                {/* Custom Visited Edges Layer */}
                {graph && (
                    <VisitedEdgesLayer
                        graph={graph}
                        edges={visitedEdges}
                        count={visitedCount}
                        color={vColor}
                    />
                )}

                {/* Start/End Markers */}
                {startNode && graph && (
                    <CircleMarker
                        center={[graph.nodes[startNode].lat, graph.nodes[startNode].lon]}
                        pathOptions={{ color: '#00ff00', fillColor: '#00ff00', fillOpacity: 1 }}
                        radius={6}
                    />
                )}
                {endNode && graph && (
                    <CircleMarker
                        center={[graph.nodes[endNode].lat, graph.nodes[endNode].lon]}
                        pathOptions={{ color: '#ff0000', fillColor: '#ff0000', fillOpacity: 1 }}
                        radius={6}
                    />
                )}

                {/* Result Path with Enhanced Neon Glow Effect - Mobile Responsive */}
                {pathPositions.length > 0 && (
                    <>
                        {/* Outer Glow Layer 1 */}
                        <Polyline
                            positions={pathPositions}
                            pathOptions={{
                                color: pColor,
                                weight: 12,
                                opacity: 0.2,
                                lineCap: 'round',
                                className: 'neon-path-glow-outer'
                            }}
                            pane="overlayPane"
                        />
                        {/* Outer Glow Layer 2 - INCREASED WEIGHT */}
                        <Polyline
                            positions={pathPositions}
                            pathOptions={{
                                color: pColor,
                                weight: 12, // Increased from 8
                                opacity: 0.6, // Increased from 0.4
                                lineCap: 'round',
                                className: 'neon-path-glow'
                            }}
                            pane="overlayPane"
                        />
                        {/* Core Line - On top - INCREASED WEIGHT */}
                        <Polyline
                            positions={pathPositions}
                            pathOptions={{
                                color: pColor,
                                weight: 6, // Increased from 4
                                opacity: 1,
                                lineCap: 'round',
                                className: 'neon-path-core'
                            }}
                            pane="markerPane"
                        />
                    </>
                )}

            </MapContainer>

            {/* Control Panel: Hidden by default styled in CSS, but ensure it receives className for capture script to hide if needed */}
            <ControlPanel
                algorithm={algorithm}
                setAlgorithm={setAlgorithm}
                onVisualize={startVisualization}
                onClear={clear}
                onReloadLocation={() => {
                    if (currentBounds) {
                        loadGraphForBounds(currentBounds);
                        clear();
                    }
                }}
                stats={{
                    visitedCount: visitedCount,
                    pathLength: pathPositions.length > 0 ? pathLength(pathPositions) : 0
                }}
                status={status}
                visitedColor={visitedColor}
                setVisitedColor={setVisitedColor}
                pathColor={pathColor}
                setPathColor={setPathColor}
                className="control-panel"
            />
        </>
    );
};

// Optimized Custom Layer for Visited Edges with Incremental Rendering
const VisitedEdgesLayer = ({ graph, edges, count, color }) => {
    const map = useMap();
    const canvasRef = useRef(null);
    const prevCountRef = useRef(0);

    // Handle Resize / Move (Full Redraw)
    useEffect(() => {
        const canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated');
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = 400;
        canvas.style.mixBlendMode = 'normal'; // NORMAL BLEND to show true color

        const pane = map.getPanes().overlayPane;
        pane.appendChild(canvas);
        canvasRef.current = canvas;

        const resize = () => {
            const size = map.getSize();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = size.x * dpr;
            canvas.height = size.y * dpr;
            canvas.style.width = size.x + 'px';
            canvas.style.height = size.y + 'px';

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const bounds = map.getBounds();
            const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
            L.DomUtil.setPosition(canvas, topLeft);

            // Full redraw on resize/move
            drawBatch(ctx, 0, count, true);
        };

        const onMoveEnd = () => resize();

        map.on('moveend', onMoveEnd);
        map.on('resize', resize);

        // Initial sizing
        resize();

        return () => {
            if (canvas) canvas.remove();
            map.off('moveend', onMoveEnd);
            map.off('resize', resize);
        };
    }, [map, graph]); // Re-init on graph change

    // Incremental Draw
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !graph) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // If count Reset (0), clear canvas
        if (count === 0) {
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
            prevCountRef.current = 0;
            return;
        }

        // Only draw NEW edges if we moved forward
        if (count > prevCountRef.current) {
            drawBatch(ctx, prevCountRef.current, count, false);
            prevCountRef.current = count;
        } else if (count < prevCountRef.current) {
            // If we shouted backwards (rare, maybe clear?), full redraw recommended
            // But usually count only goes up.
        }
    }, [count, edges, graph, color]);

    const drawBatch = (ctx, start, end, clear = false) => {
        if (!graph || start >= end) return;

        const dpr = window.devicePixelRatio || 1;
        if (clear && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width / dpr, canvasRef.current.height / dpr);
        }

        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // "Younger" Look: Strong core, subtle glow, no heavy shadowBlur (performance killer)

        // 1. Wide subtle glow (simulated by opacity) 
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.5; // Visible color
        ctx.beginPath();
        for (let i = start; i < end; i++) {
            const e = edges[i];
            if (!e) continue;
            const n1 = graph.nodes[e.from];
            const n2 = graph.nodes[e.to];
            if (!n1 || !n2) continue;

            const p1 = map.latLngToContainerPoint([n1.lat, n1.lon]);
            const p2 = map.latLngToContainerPoint([n2.lat, n2.lon]);

            // Skip huge jumps (wrap around artifacts)
            if (Math.abs(p1.x - p2.x) > 2000 || Math.abs(p1.y - p2.y) > 2000) continue;

            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();

        // 2. Sharp core line
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1.0; // Solid color
        ctx.beginPath();
        for (let i = start; i < end; i++) {
            const e = edges[i];
            if (!e) continue;
            const n1 = graph.nodes[e.from];
            const n2 = graph.nodes[e.to];
            if (!n1 || !n2) continue;

            const p1 = map.latLngToContainerPoint([n1.lat, n1.lon]);
            const p2 = map.latLngToContainerPoint([n2.lat, n2.lon]);

            if (Math.abs(p1.x - p2.x) > 2000 || Math.abs(p1.y - p2.y) > 2000) continue;

            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();

        ctx.globalAlpha = 1.0;
    };

    return null;
};

function pathLength(positions) {
    if (positions.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < positions.length - 1; i++) {
        dist += L.latLng(positions[i]).distanceTo(positions[i + 1]);
    }
    return dist; // in meters
}

export default MapComponent;
