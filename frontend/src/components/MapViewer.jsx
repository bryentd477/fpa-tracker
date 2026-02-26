import React, { useState, useEffect } from 'react';
import FPAOverlayMap from './FPAOverlayMap';

function MapViewer({ fpas = [] }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeTab, setActiveTab] = useState('split');
  const isMobile = windowWidth <= 768;
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Auto-switch to overlay on mobile
  useEffect(() => {
    if (isMobile && activeTab === 'split') {
      setActiveTab('overlay');
    }
  }, [isMobile, activeTab]);

  // Build ArcGIS URL
  const dfrMapUrl = 'https://data-wadnr.opendata.arcgis.com/datasets/cb0522525e86444496452496896f6c0d_6/explore?location=47.961908%2C-121.936043%2C12';

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden', 
      width: '100%',
      gap: '12px'
    }}>
      {/* Tab Controls */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '4px' : '8px',
        padding: isMobile ? '4px 6px' : '12px',
        background: 'var(--bg-secondary)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        flexShrink: 0,
        minHeight: 0
      }}>
        {!isMobile && (
          <button
            onClick={() => setActiveTab('split')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'split' ? 'var(--accent-color)' : 'rgba(111, 160, 80, 0.2)',
              border: 'none',
              borderRadius: '4px',
              color: activeTab === 'split' ? 'white' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === 'split' ? '600' : '500',
              transition: 'all 0.2s'
            }}
            title="View DNR map and overlay together"
          >
            📖 Split View
          </button>
        )}
        <button
          onClick={() => setActiveTab('dnr')}
          style={{
            padding: isMobile ? '4px 8px' : '8px 16px',
            background: activeTab === 'dnr' ? 'var(--accent-color)' : 'rgba(111, 160, 80, 0.2)',
            border: 'none',
            borderRadius: '4px',
            color: activeTab === 'dnr' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: isMobile ? '11px' : '13px',
            fontWeight: activeTab === 'dnr' ? '600' : '500',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
          title="View Washington DNR map in full screen"
        >
          {isMobile ? '🔍 DNR' : '🔍 DNR Map (Reference)'}
        </button>
        <button
          onClick={() => setActiveTab('overlay')}
          style={{
            padding: isMobile ? '4px 8px' : '8px 16px',
            background: activeTab === 'overlay' ? 'var(--accent-color)' : 'rgba(111, 160, 80, 0.2)',
            border: 'none',
            borderRadius: '4px',
            color: activeTab === 'overlay' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: isMobile ? '11px' : '13px',
            fontWeight: activeTab === 'overlay' ? '600' : '500',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
          title="View your FPAs with status colors"
        >
          {isMobile ? '📍 FPAs' : '📍 FPA Overlay'}
        </button>
      </div>

      {activeTab === 'split' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflow: 'hidden'
        }}>
          {/* DNR Map - Left */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            background: '#f0f0f0',
            height: '100%',
            minHeight: 0
          }}>
            <div style={{
              padding: '6px 12px',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              flexShrink: 0
            }}>
              🔍 DNR Reference Map
            </div>
            <iframe
              src={dfrMapUrl}
              style={{
                flex: 1,
                border: 'none',
                width: '100%'
              }}
              title="WADNR Forest Products Activity Map"
            />
          </div>

          {/* Overlay Map - Right */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            height: '100%',
            minHeight: 0
          }}>
            <div style={{
              padding: '6px 12px',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              flexShrink: 0
            }}>
              📍 Your FPA Overlay
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <FPAOverlayMap fpas={fpas} />
            </div>
          </div>
        </div>
      )}

      {/* DNR Map Full View */}
      {activeTab === 'dnr' && (
        <div style={{
          flex: 1,
          borderRadius: '8px',
          overflow: isMobile ? 'auto' : 'hidden',
          border: '1px solid var(--border-color)',
          minHeight: isMobile ? '50vh' : '600px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <iframe
            src={dfrMapUrl}
            style={{
              width: '100%',
              height: '100%',
              flex: 1,
              border: 'none'
            }}
            title="WADNR Forest Products Activity Map"
          />
        </div>
      )}

      {/* Overlay Map Full View */}
      {activeTab === 'overlay' && (
        <div style={{
          flex: 1,
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          minHeight: '400px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <FPAOverlayMap fpas={fpas} />
        </div>
      )}
    </div>
  );
}

export default MapViewer;
