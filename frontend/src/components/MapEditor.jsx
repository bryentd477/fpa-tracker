import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { searchArcGISByFPID } from '../utils/arcgisAPI';

function MapEditor({ geometry, onGeometryChange, applicationStatus }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const drawnItems = useRef(new L.FeatureGroup());
  const drawControl = useRef(null);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const getStatusColor = (status) => {
    const colors = {
      '': '#9ca3af',
      'In Decision Window': '#f59e0b',
      'Approved': '#10b981',
      'Withdrawn': '#6b7280',
      'Disapproved': '#ef4444',
      'Closed Out': '#6366f1'
    };
    return colors[status] || '#9ca3af';
  };

  useEffect(() => {
    if (map.current) return; // Prevent re-initialization

    // Initialize map centered on Washington State
    map.current = L.map(mapContainer.current).setView([47.5, -120.5], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add the feature group for drawn items
    map.current.addLayer(drawnItems.current);

    // Initialize Leaflet Draw
    drawControl.current = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: true,
        polyline: false,
        rectangle: true,
        circle: false,
        marker: false,
      },
      edit: {
        featureGroup: drawnItems.current,
        edit: true,
        remove: true,
      },
    });
    map.current.addControl(drawControl.current);

    // Load existing geometry if available
    if (geometry && geometry.features && geometry.features.length > 0) {
      geometry.features.forEach((feature) => {
        const layer = L.geoJSON(feature, {
          style: {
            color: getStatusColor(applicationStatus),
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.4,
          },
        });
        layer.addTo(drawnItems.current);
      });
      if (drawnItems.current.getLayers().length > 0) {
        map.current.fitBounds(drawnItems.current.getBounds());
      }
    }

    // Handle draw events
    map.current.on('draw:created', handleDrawCreated);
    map.current.on('draw:edited', handleDrawEdited);
    map.current.on('draw:deleted', handleDrawDeleted);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update polygon colors when status changes
  useEffect(() => {
    if (!map.current) return;
    const color = getStatusColor(applicationStatus);
    drawnItems.current.eachLayer((layer) => {
      if (layer.setStyle) {
        layer.setStyle({
          color: color,
          fillColor: color,
        });
      }
    });
  }, [applicationStatus]);

  const handleDrawCreated = (e) => {
    const layer = e.layer;
    drawnItems.current.addLayer(layer);
    saveGeometry();
  };

  const handleDrawEdited = (e) => {
    saveGeometry();
  };

  const handleDrawDeleted = (e) => {
    saveGeometry();
  };

  const saveGeometry = () => {
    const geojsonData = drawnItems.current.toGeoJSON();
    onGeometryChange(geojsonData.features.length > 0 ? geojsonData : null);
  };

  const clearAll = () => {
    drawnItems.current.clearLayers();
    onGeometryChange(null);
  };

  const handleLoadFromArcGIS = async () => {
    if (!searchInput.trim()) {
      setErrorMsg('Please enter an FPA number');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const geojson = await searchArcGISByFPID(searchInput);
      
      // Clear existing features
      drawnItems.current.clearLayers();

      // Add ArcGIS features to map
      const color = getStatusColor(applicationStatus);
      L.geoJSON(geojson, {
        style: {
          color: color,
          weight: 2,
          opacity: 0.8,
          fillColor: color,
          fillOpacity: 0.4,
        },
      }).eachLayer((layer) => {
        drawnItems.current.addLayer(layer);
      });

      // Fit bounds to loaded geometry
      if (drawnItems.current.getLayers().length > 0) {
        map.current.fitBounds(drawnItems.current.getBounds(), { padding: [50, 50] });
      }

      saveGeometry();
      setSearchInput('');
    } catch (error) {
      setErrorMsg(error.message);
      console.error('ArcGIS load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '13px',
        color: 'var(--text-secondary)'
      }}>
        <p style={{ margin: '0 0 8px 0' }}>
          📍 <strong>Draw areas</strong> or <strong>load from ArcGIS</strong> to define FPA boundaries
        </p>
        
        {/* ArcGIS Search Section */}
        <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>
            Load from ArcGIS by FP_ID:
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setErrorMsg('');
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleLoadFromArcGIS();
              }}
              placeholder="e.g., 2411527 or 2,411,527"
              style={{
                flex: 1,
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '12px'
              }}
              disabled={isLoading}
            />
            <button
              onClick={handleLoadFromArcGIS}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                background: isLoading ? '#888' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
              onMouseOver={(e) => {
                if (!isLoading) e.currentTarget.style.background = '#059669';
              }}
              onMouseOut={(e) => {
                if (!isLoading) e.currentTarget.style.background = '#10b981';
              }}
            >
              {isLoading ? '⏳ Loading...' : '📥 Load'}
            </button>
          </div>
          {errorMsg && (
            <p style={{ margin: '6px 0 0 0', color: '#ef4444', fontSize: '11px' }}>
              ⚠️ {errorMsg}
            </p>
          )}
        </div>

        <p style={{ margin: '0 0 8px 0' }}>
          Or use the tools in the top-right to draw polygons and rectangles manually
        </p>
        <button
          onClick={clearAll}
          style={{
            padding: '6px 12px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            marginTop: '8px'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
          onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
        >
          Clear All Areas
        </button>
      </div>
      <div
        ref={mapContainer}
        style={{
          flex: 1,
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)'
        }}
      />
    </div>
  );
}

export default MapEditor;
