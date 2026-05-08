import React from 'react';
import MapComponent from './components/MapComponent';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <MapComponent />

      {/* Optional: GitHub/Credit Link Overlay */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        zIndex: 1000,
        opacity: 0.5,
        fontSize: '0.8rem',
        pointerEvents: 'none'
      }}>
        Real Map Algorithms
      </div>
    </div>
  );
}

export default App;
