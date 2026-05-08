import React, { useState } from 'react';
import { Play, RotateCcw, Palette, MapPin } from 'lucide-react';
import './ControlPanel.css';

const ControlPanel = ({
    algorithm,
    setAlgorithm,
    onVisualize,
    onClear,
    onReloadLocation,
    stats,
    status,
    visitedColor,
    setVisitedColor,
    pathColor,
    setPathColor
}) => {
    const [showColors, setShowColors] = useState(false);

    return (
        <>
            {/* 1. ABSOLUTE TOP FLOATING HEADER (Stats & Info) */}
            <div className="top-stats-bar glass-panel">
                <div className="algo-display">
                    <span className="algo-label">ALGORITHM</span>
                    <span className="algo-name">{algorithm}</span>
                </div>

                <div className="stats-divider"></div>

                <div className="stat-item">
                    <span className="stat-label">EXP</span>
                    <span className="stat-value" style={{ color: visitedColor }}>
                        {stats.visitedCount}
                    </span>
                </div>

                <div className="stat-item">
                    <span className="stat-label">DIST</span>
                    <span className="stat-value" style={{ color: pathColor }}>
                        {stats.pathLength > 0 ? (stats.pathLength / 1000).toFixed(1) + ' km' : '-'}
                    </span>
                </div>
            </div>

            {/* 2. BOTTOM CONTROL BAR (Buttons Only) */}
            <div className="control-panel glass-panel">
                {/* Status Message (Small, above controls) */}
                <div className="status-container">
                    {status}
                </div>

                <div className="controls-row">
                    {/* Algorithm Selector (Hidden visual, accessible via dropdown if needed, 
                        but effectively we show current algo at top. 
                        We keep select here for changing it) */}
                    <div className="algorithm-select-wrapper">
                        <select
                            value={algorithm}
                            onChange={(e) => setAlgorithm(e.target.value)}
                            className="algo-select"
                        >
                            <option value="BFS">BFS</option>
                            <option value="DFS">DFS</option>
                            <option value="Dijkstra">Dijkstra</option>
                            <option value="A*">A*</option>
                            <option value="Greedy Best-First">Greedy</option>
                            <option value="Bidirectional BFS">Bi-BFS</option>
                            <option value="Bidirectional Dijkstra">Bi-Dijkstra</option>
                            <option value="Bidirectional A*">Bi-A*</option>
                        </select>
                    </div>

                    <button
                        className={`btn-icon ${showColors ? 'active' : ''}`}
                        onClick={() => setShowColors(!showColors)}
                        title="Colors"
                    >
                        <Palette size={16} />
                    </button>

                    {showColors && (
                        <div className="color-popover">
                            <div className="color-field">
                                <label>Visited</label>
                                <input
                                    type="color"
                                    value={visitedColor}
                                    onChange={(e) => setVisitedColor(e.target.value)}
                                />
                            </div>
                            <div className="color-field">
                                <label>Path</label>
                                <input
                                    type="color"
                                    value={pathColor}
                                    onChange={(e) => setPathColor(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="separator"></div>

                    <button
                        onClick={onVisualize}
                        disabled={status.includes('Running')}
                        className="btn-visualize"
                    >
                        <Play size={16} fill="currentColor" />
                        <span>VISUALIZE</span>
                    </button>

                    <button
                        onClick={onReloadLocation}
                        className="btn-icon"
                        title="Reload Map Area"
                    >
                        <MapPin size={16} />
                    </button>

                    <button
                        onClick={onClear}
                        className="btn-icon danger"
                        title="Reset"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};

export default ControlPanel;
