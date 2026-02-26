import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchArcGISByRegion } from '../utils/arcgisAPI';

function FPAOverlayMap({ fpas = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const arcgisLayersRef = useRef({});
  const userFPALayersRef = useRef([]);
  const [arcgisData, setArcGisData] = useState(null);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [visibleJurisdictions, setVisibleJurisdictions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [region] = useState('NORTHWEST');
  const [mapReady, setMapReady] = useState(false);
  const [showJurisdictionDropdown, setShowJurisdictionDropdown] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState(['Approved - Not Started', 'Approved - Started', 'Approved - Harvest Complete', 'Approved - Activity Complete']);
  const [showLegend, setShowLegend] = useState(true);

  // Map FPA status to color
  const statusColors = {
    'Pending': '#F59E0B',
    'Approved - Not Started': '#3B82F6',
    'Approved - Started': '#10B981',
    'Approved - Harvest Complete': '#8B5CF6',
    'Approved - Activity Complete': '#0F766E',
    'Denied': '#EF4444',
    'Expired': '#6B7280'
  };

  const approvedStatuses = [
    'Approved - Not Started',
    'Approved - Started',
    'Approved - Harvest Complete',
    'Approved - Activity Complete'
  ];

  // Get display status from FPA data
  const getFPAStatus = (fpa) => {
    if (fpa.applicationStatus === 'Denied') return 'Denied';
    if (fpa.applicationStatus === 'Expired') return 'Expired';
    if (fpa.applicationStatus !== 'Approved') {
      return 'Pending';
    }
    // If Approved, check activity status
    const activityStatus = fpa.activity?.status || 'Not Started';
    if (activityStatus === 'Not Started') return 'Approved - Not Started';
    if (activityStatus === 'Started') return 'Approved - Started';
    if (activityStatus === 'Harvest Complete') return 'Approved - Harvest Complete';
    if (activityStatus === 'Activity Complete') return 'Approved - Activity Complete';
    return 'Approved - Started';
  };

  const getStatusColor = (fpa) => {
    const status = getFPAStatus(fpa);
    return statusColors[status] || '#FF0000';
  };




  const jurisdictionColors = {
    'Samish': '#FF6B6B',
    'Islands': '#4ECDC4',
    'Stillaguamish': '#45B7D1',
    'Nooksack': '#96CEB4',
    'Skagit': '#FFEAA7',
    'Skykomish': '#DDA0DD',
    'Chuckanut': '#F08080'
  };

  // Load ArcGIS data on mount
  useEffect(() => {
    const loadArcGISData = async () => {
      setIsLoading(true);
      try {
        const data = await searchArcGISByRegion(region);
        setArcGisData(data);

        // Extract unique jurisdictions
        const jurisdictionSet = new Set();
        data.features.forEach(feature => {
          const props = feature.properties || {};
          const jurisdiction = props.FP_JURISDICT_NM || props.FP_Jurisdic_NM || props.JURISDICT_NM || props.Jurisdic_NM;
          if (jurisdiction) {
            jurisdictionSet.add(jurisdiction);
          }
        });
        
        const jurisdictionList = Array.from(jurisdictionSet).sort();
        setJurisdictions(jurisdictionList);
        setVisibleJurisdictions(jurisdictionList);
      } catch (error) {
        console.error('Error loading ArcGIS data:', error);
      } finally {
        setIsLoading(false);
        setTimeout(() => {
          if (map.current) {
            map.current.invalidateSize();
          }
        }, 150);
      }
    };

    loadArcGISData();
  }, [region]);

  // Initialize map (once)
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Wait a tick to ensure container is sized
    setTimeout(() => {
      if (!mapContainer.current) {
        return;
      }

      const containerHeight = mapContainer.current.offsetHeight;
      const containerWidth = mapContainer.current.offsetWidth;

      if (containerHeight === 0 || containerWidth === 0) {
        console.error('Map container has zero dimensions!', { containerHeight, containerWidth });
      }

      try {
        map.current = L.map(mapContainer.current, {
          preferCanvas: false,  // Use SVG rendering so panes and z-index work properly
          zoomControl: false,
          scrollWheelZoom: true,
          touchZoom: false,
          doubleClickZoom: true,
          dragging: true,
          tap: false
        }).setView([47.5, -120.5], 7);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map.current);

        // Create a custom pane for user FPAs with higher z-index
        map.current.createPane('userFPAPane');
        const pane = map.current.getPane('userFPAPane');
        pane.style.zIndex = 1000; // WAY above default overlays (400) and DNR layers
        const popupPane = map.current.getPane('popupPane');
        if (popupPane) {
          popupPane.style.zIndex = 1200; // Ensure popups stay above polygons
        }
        setMapReady(true); // Signal that map is ready

        // Fix map size for mobile after a short delay
        setTimeout(() => {
          if (map.current) {
            map.current.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.error('Failed to initialize Leaflet map:', err);
      }
    }, 100);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Only run once

  // Add/update legend (FPA statuses only)
  useEffect(() => {
    if (!map.current) return;

    // Remove existing legend
    if (map.current.legendControl) {
      map.current.removeControl(map.current.legendControl);
    }

    // Add legend with toggle
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      div.style.background = 'var(--bg-secondary)';
      div.style.borderRadius = '6px';
      div.style.border = '1px solid var(--border-color)';
      div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      div.style.fontSize = '11px';

      // Create toggle button
      const toggleBtn = L.DomUtil.create('button', '', div);
      toggleBtn.innerHTML = showLegend ? '📊 Legend ▼' : '📊 Legend ▶';
      toggleBtn.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        background: var(--accent-color);
        color: white;
        border: none;
        border-radius: ${showLegend ? '6px 6px 0 0' : '6px'};
        cursor: pointer;
        font-weight: 600;
        font-size: 11px;
        text-align: left;
      `;
      
      // Prevent map interactions when clicking legend
      L.DomEvent.disableClickPropagation(toggleBtn);
      L.DomEvent.on(toggleBtn, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        setShowLegend(!showLegend);
      });

      // Create content container
      if (showLegend) {
        const content = L.DomUtil.create('div', '', div);
        content.style.padding = '12px 15px';
        content.style.maxHeight = '250px';
        content.style.overflowY = 'auto';

        let html = '<p style="margin: 0 0 8px 0; font-weight: bold; color: var(--text-primary);">Your FPA Status</p>';
        
        // User FPA status legend
        const statusColors = {
          'Pending': '#F59E0B',
          'Approved - Not Started': '#3B82F6',
          'Approved - Started': '#10B981',
          'Approved - Harvest Complete': '#8B5CF6',
          'Approved - Activity Complete': '#0F766E',
          'Denied': '#EF4444',
          'Expired': '#6B7280'
        };

        Object.entries(statusColors).forEach(([status, color]) => {
          html += `<div style="margin-bottom: 4px; display: flex; align-items: center;">
            <span style="display: inline-block; width: 12px; height: 2px; background-color: ${color}; margin-right: 8px; border: 1px solid rgba(0,0,0,0.2);"></span>
            <span style="color: var(--text-primary); font-size: 10px;">${status}</span>
          </div>`;
        });

        content.innerHTML = html;
      }

      return div;
    };
    
    legend.addTo(map.current);
    map.current.legendControl = legend;
  }, [mapReady, showLegend]);

  // Update map when visible jurisdictions change
  useEffect(() => {
    if (!map.current || !arcgisData) return;

    // Clear existing layers
    Object.values(arcgisLayersRef.current).forEach(layer => {
      map.current.removeLayer(layer);
    });
    arcgisLayersRef.current = {};

    // NOTE: NOT rendering ArcGIS features - only showing user-added FPAs
    // The jurisdiction dropdown is just for informational purposes
    // If needed in future, features can be added back here
  }, [visibleJurisdictions, arcgisData, jurisdictionColors]);

  // Display user's FPAs with geometry (FILTERED by status)
  useEffect(() => {
    if (!map.current) {
      return;
    }

    // Remove existing user FPA layers
    userFPALayersRef.current.forEach(layer => {
      map.current.removeLayer(layer);
    });
    userFPALayersRef.current = [];

    // Track bounds for all user FPAs
    const bounds = L.latLngBounds();
    let hasBounds = false;

    // Add FPAs with geometry (filtered by visible statuses)
    fpas.forEach((fpa, idx) => {
      if (!fpa.geometry) {
        return;
      }

      // Check if this FPA's status should be visible
      const fpaStatus = getFPAStatus(fpa);
      if (!visibleStatuses.includes(fpaStatus)) {
        return; // Skip this FPA if its status is not visible
      }

      try {
        const geometry = typeof fpa.geometry === 'string' 
          ? JSON.parse(fpa.geometry) 
          : fpa.geometry;

        const color = getStatusColor(fpa);
        
        let layer;
        try {
          layer = L.geoJSON(geometry, {
            pane: 'userFPAPane', // Use custom pane to render on top
            style: {
              color: color,
              weight: 5,
              opacity: 1,
              fillColor: color,
              fillOpacity: 0.8
            },
            onEachFeature: (feature, featureLayer) => {
              featureLayer.bindPopup(`
                <div>
                  <strong>FPA: ${fpa.fpaNumber}</strong><br/>
                  Status: ${fpaStatus}<br/>
                  ${fpa.landowner ? `Landowner: ${fpa.landowner}<br/>` : ''}
                </div>
              `);
            }
          });
        } catch (e) {
          console.error('Error creating L.geoJSON layer:', e.message);
          throw e;
        }
        
        layer.addTo(map.current);
        
        // Bring layer to front to ensure it's on top of DNR layers
        if (layer.bringToFront) {
          layer.bringToFront();
        }
        userFPALayersRef.current.push(layer);

        // Extend bounds to include this FPA
        try {
          const layerBounds = layer.getBounds();
          bounds.extend(layerBounds);
          hasBounds = true;
        } catch (e) {
          console.error('Could not get bounds for FPA', fpa.fpaNumber, ':', e);
        }
      } catch (error) {
        console.error(`Error rendering FPA ${fpa.fpaNumber}:`, error);
      }
    });

    // If we have user FPAs, zoom to them
    if (hasBounds && userFPALayersRef.current.length > 0) {
      map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [fpas, mapReady, visibleStatuses]);

  // Keep user FPA layers on top after DNR layers load
  useEffect(() => {
    if (!map.current || userFPALayersRef.current.length === 0) return;
    
    userFPALayersRef.current.forEach((layer) => {
      if (layer.bringToFront) {
        layer.bringToFront();
      }
    });
  }, [arcgisData]); // Re-run whenever DNR data changes

  const toggleJurisdictionVisibility = (jurisdiction) => {
    let newVisibility;
    if (visibleJurisdictions.includes(jurisdiction)) {
      newVisibility = visibleJurisdictions.filter(j => j !== jurisdiction);
    } else {
      newVisibility = [...visibleJurisdictions, jurisdiction];
    }
    setVisibleJurisdictions(newVisibility);
    localStorage.setItem(`mapJurisdictions_${region}`, JSON.stringify(newVisibility));
  };

  const toggleStatusFilter = (status) => {
    if (visibleStatuses.includes(status)) {
      setVisibleStatuses(visibleStatuses.filter(s => s !== status));
    } else {
      setVisibleStatuses([...visibleStatuses, status]);
    }
  };

  const toggleApprovedFilter = () => {
    const allApprovedVisible = approvedStatuses.every(s => visibleStatuses.includes(s));
    
    if (allApprovedVisible) {
      // Remove all approved statuses
      setVisibleStatuses(visibleStatuses.filter(s => !approvedStatuses.includes(s)));
    } else {
      // Add all approved statuses
      const newStatuses = new Set(visibleStatuses);
      approvedStatuses.forEach(s => newStatuses.add(s));
      setVisibleStatuses(Array.from(newStatuses));
    }
  };

  const toggleAllJurisdictions = () => {
    if (visibleJurisdictions.length === jurisdictions.length) {
      setVisibleJurisdictions([]);
      localStorage.removeItem(`mapJurisdictions_${region}`);
    } else {
      setVisibleJurisdictions(jurisdictions);
      localStorage.setItem(`mapJurisdictions_${region}`, JSON.stringify(jurisdictions));
    }
  };

  // Invalidate map size when filters are toggled
  useEffect(() => {
    if (map.current) {
      setTimeout(() => {
        map.current.invalidateSize();
      }, 100);
    }
  }, [showJurisdictionDropdown]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      gap: '0',
      flex: 1,
      minHeight: 0
    }}>
      {/* Status Bar */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
        flexWrap: 'wrap'
      }}>
        <div>
          {isLoading ? '⏳ Loading...' : `📍 FPAs: ${fpas.filter(f => f.geometry && visibleStatuses.includes(getFPAStatus(f))).length} visible`}
        </div>
        <button
          onClick={() => setShowJurisdictionDropdown(!showJurisdictionDropdown)}
          style={{
            padding: '4px 8px',
            background: 'rgba(59, 130, 246, 0.3)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '3px',
            fontSize: '10px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.5)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'}
        >
          🗂️ Filters
        </button>
      </div>

      {/* Filter Panel - Mobile Friendly Collapsible */}
      {showJurisdictionDropdown && (
        <div style={{
          padding: '12px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 10,
          flexShrink: 0
        }}>
          {/* Status Filters */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '8px',
              color: 'var(--text-primary)'
            }}>FPA Status Filters:</div>
            
            {/* Approved - Checkbox for all approved variants */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--text-primary)',
              fontWeight: '500'
            }}>
              <input
                type="checkbox"
                checked={approvedStatuses.some(s => visibleStatuses.includes(s))}
                onChange={toggleApprovedFilter}
                style={{ cursor: 'pointer' }}
              />
              <span>✓ Approved</span>
            </label>

            {/* Approved sub-options (only show when Approved is selected) */}
            {approvedStatuses.some(s => visibleStatuses.includes(s)) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 12px',
                paddingLeft: '16px',
                marginBottom: '10px'
              }}>
                {approvedStatuses.map(status => (
                  <label key={status} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--text-primary)'
                  }}>
                    <input
                      type="checkbox"
                      checked={visibleStatuses.includes(status)}
                      onChange={() => toggleStatusFilter(status)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      backgroundColor: statusColors[status]
                    }} />
                    {status.replace('Approved - ', '')}
                  </label>
                ))}
              </div>
            )}

            {/* Individual status filters (horizontal) */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px 16px'
            }}>
              {['Pending', 'Denied', 'Expired'].map(status => (
                <label key={status} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--text-primary)'
                }}>
                  <input
                    type="checkbox"
                    checked={visibleStatuses.includes(status)}
                    onChange={() => toggleStatusFilter(status)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    backgroundColor: statusColors[status]
                  }} />
                  {status}
                </label>
              ))}
            </div>
          </div>

          {/* Jurisdiction Dropdown */}
          {jurisdictions.length > 0 && (
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                marginBottom: '8px',
                color: 'var(--text-primary)'
              }}>DNR Jurisdictions:</div>
              
              <button
                onClick={toggleAllJurisdictions}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'rgba(111, 160, 80, 0.3)',
                  border: '1px solid rgba(111, 160, 80, 0.5)',
                  borderRadius: '3px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  marginBottom: '8px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(111, 160, 80, 0.5)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(111, 160, 80, 0.3)'}
              >
                {visibleJurisdictions.length === jurisdictions.length ? '✓ Deselect All' : '◻ Select All'}
              </button>

              <div style={{
                maxHeight: '150px',
                overflowY: 'auto',
                background: 'var(--bg-primary)',
                borderRadius: '3px',
                padding: '6px'
              }}>
                {jurisdictions.map(jurisdiction => (
                  <label key={jurisdiction} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--text-primary)',
                    padding: '4px'
                  }}>
                    <input
                      type="checkbox"
                      checked={visibleJurisdictions.includes(jurisdiction)}
                      onChange={() => {
                        const updated = visibleJurisdictions.includes(jurisdiction)
                          ? visibleJurisdictions.filter(j => j !== jurisdiction)
                          : [...visibleJurisdictions, jurisdiction];
                        setVisibleJurisdictions(updated);
                        localStorage.setItem(`mapJurisdictions_${region}`, JSON.stringify(updated));
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    {jurisdiction}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainer}
        style={{
          flex: 1,
          width: '100%',
          borderRadius: '0px',
          overflow: 'hidden',
          border: 'none',
          position: 'relative',
          touchAction: 'manipulation',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none'
        }}
      />
    </div>
  );
}

export default FPAOverlayMap;
