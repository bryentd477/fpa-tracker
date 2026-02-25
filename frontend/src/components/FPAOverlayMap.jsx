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
  const [errorMsg, setErrorMsg] = useState('');
  const [region] = useState('NORTHWEST');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState({
    pending: true,
    approved: true,
    denied: true,
    expired: true
  });
  const [approvedSubFilters, setApprovedSubFilters] = useState({
    'Not Started': true,
    'Started': true,
    'Harvest Complete': true,
    'Activity Complete': true
  });
  const [showApprovedExpanded, setShowApprovedExpanded] = useState(false);
  const [selectedUserJurisdictions, setSelectedUserJurisdictions] = useState(['Show All']);
  const [filtersCollapsed, setFiltersCollapsed] = useState(window.innerWidth <= 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const isMobile = windowWidth <= 768;

  // Watch for window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      // Invalidate map size on resize
      if (map.current) {
        setTimeout(() => {
          map.current.invalidateSize();
        }, 50);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Invalidate map size when filters collapse/expand
  useEffect(() => {
    if (map.current) {
      setTimeout(() => {
        map.current.invalidateSize();
      }, 100);
    }
  }, [filtersCollapsed]);

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
      setErrorMsg('');
      try {
        const data = await searchArcGISByRegion(region);
        setArcGisData(data);

        // Extract unique jurisdictions
        const jurisdictionSet = new Set();
        
        data.features.forEach(feature => {
          const props = feature.properties || {};
          // Try different variations of the jurisdiction field name
          const jurisdiction = props.FP_JURISDICT_NM || props.FP_Jurisdic_NM || props.JURISDICT_NM || props.Jurisdic_NM;
          if (jurisdiction) {
            jurisdictionSet.add(jurisdiction);
          }
        });
        
        const jurisdictionList = Array.from(jurisdictionSet).sort();
        console.log('Found jurisdictions:', jurisdictionList);
        
        if (jurisdictionList.length === 0) {
          console.warn('No jurisdictions found! Field names in data:', Object.keys(data.features[0]?.properties || {}));
          // Show the actual field names to help debug
          if (data.features[0]?.properties) {
            console.warn('First feature properties:', data.features[0].properties);
          }
          // Still set empty jurisdiction list to allow map to load
          setJurisdictions([]);
          setVisibleJurisdictions([]);
        } else {
          setJurisdictions(jurisdictionList);

          // Load saved filter preferences
          const savedVisibility = localStorage.getItem(`mapJurisdictions_${region}`);
          if (savedVisibility) {
            try {
              const saved = JSON.parse(savedVisibility);
              // Only use saved if it has overlapping jurisdictions
              const validSaved = saved.filter(j => jurisdictionList.includes(j));
              setVisibleJurisdictions(validSaved.length > 0 ? validSaved : jurisdictionList);
            } catch (e) {
              setVisibleJurisdictions(jurisdictionList);
            }
          } else {
            setVisibleJurisdictions(jurisdictionList);
          }
        }
      } catch (error) {
        setErrorMsg(error.message);
        console.error('Error loading ArcGIS data:', error);
      } finally {
        setIsLoading(false);
        // Fix map size after loading completes
        setTimeout(() => {
          if (map.current) {
            console.log('Invalidating map size after data load');
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
        console.error('Map container not available');
        return;
      }

      const containerHeight = mapContainer.current.offsetHeight;
      const containerWidth = mapContainer.current.offsetWidth;
      console.log(`Initializing Leaflet map... Container: ${containerWidth}x${containerHeight}px`);

      if (containerHeight === 0 || containerWidth === 0) {
        console.error('Map container has zero dimensions!', { containerHeight, containerWidth });
      }

      try {
        map.current = L.map(mapContainer.current, {
          preferCanvas: true,
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

        console.log('Leaflet map initialized successfully');

        // Fix map size for mobile after a short delay
        setTimeout(() => {
          if (map.current) {
            map.current.invalidateSize();
            console.log('Map size invalidated for proper rendering');
          }
        }, 200);
      } catch (err) {
        console.error('Failed to initialize Leaflet map:', err);
      }
    }, 100);

    return () => {
      if (map.current) {
        console.log('Cleaning up map');
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Only run once

  // Add/update legend when jurisdictions change
  useEffect(() => {
    if (!map.current || jurisdictions.length === 0) return;

    console.log('Updating map legend with jurisdictions:', jurisdictions);

    // Remove existing legend if any
    if (map.current.legendControl) {
      map.current.removeControl(map.current.legendControl);
    }

    // Add legend with jurisdiction toggle
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      div.style.background = 'var(--bg-secondary)';
      div.style.padding = '12px 15px';
      div.style.borderRadius = '6px';
      div.style.border = '1px solid var(--border-color)';
      div.style.fontSize = '11px';
      div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      div.style.maxHeight = '300px';
      div.style.overflowY = 'auto';

      let html = '<p style="margin: 0 0 8px 0; font-weight: bold; color: var(--text-primary);">Your FPA Status</p>';
      
      // User FPA status legend
      const statusColors = {
        'Pending': '#F59E0B',
        'Approved - Not Started': '#3B82F6',
        'Approved - Started': '#10B981',
        'Approved - Harvest Complete': '#8B5CF6',
        'Approved - Activity Complete': '#059669',
        'Denied': '#EF4444',
        'Expired': '#6B7280'
      };
      
      Object.entries(statusColors).forEach(([status, color]) => {
        html += `<div style="margin-bottom: 4px; display: flex; align-items: center;">
          <span style="display: inline-block; width: 12px; height: 2px; background-color: ${color}; margin-right: 8px; border: 1px solid rgba(0,0,0,0.2);"></span>
          <span style="color: var(--text-primary); font-size: 10px;">${status}</span>
        </div>`;
      });
      
      html += '<hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border-color);" />';
      html += '<p style="margin: 0 0 8px 0; font-weight: bold; color: var(--text-primary);">DNR Jurisdictions (NW)</p>';
      
      jurisdictions.forEach(jurisdiction => {
        const color = jurisdictionColors[jurisdiction] || '#CCCCCC';
        const isVisible = visibleJurisdictions.includes(jurisdiction);
        html += `<div style="margin-bottom: 6px; display: flex; align-items: center; cursor: pointer; opacity: ${isVisible ? '1' : '0.6'};" data-jurisdiction="${jurisdiction}">
          <span style="display: inline-block; width: 12px; height: 12px; background-color: ${color}; border-radius: 2px; margin-right: 8px; border: 1px solid rgba(0,0,0,0.2);"></span>
          <span style="color: var(--text-primary); user-select: none; flex: 1;">${jurisdiction}</span>
          <span style="font-size: 10px; color: var(--text-secondary);">✓</span>
        </div>`;
      });

      div.innerHTML = html;

      // Add click handlers for jurisdictions
      div.querySelectorAll('[data-jurisdiction]').forEach(el => {
        el.addEventListener('click', () => {
          const jurisdiction = el.getAttribute('data-jurisdiction');
          toggleJurisdictionVisibility(jurisdiction);
        });
      });

      return div;
    };
    
    legend.addTo(map.current);
    map.current.legendControl = legend;

    console.log('Legend added to map');
  }, [jurisdictions, visibleJurisdictions, jurisdictionColors]);

  // Update map when visible jurisdictions change
  useEffect(() => {
    if (!map.current || !arcgisData) return;

    // Clear existing layers
    Object.values(arcgisLayersRef.current).forEach(layer => {
      map.current.removeLayer(layer);
    });
    arcgisLayersRef.current = {};

    // Add layers for visible jurisdictions
    const bounds = L.latLngBounds();
    let hasBounds = false;

    visibleJurisdictions.forEach(jurisdiction => {
      const color = jurisdictionColors[jurisdiction] || '#CCCCCC';
      const filteredFeatures = arcgisData.features.filter(f => {
        return f.properties?.FP_JURISDICT_NM === jurisdiction;
      });

      console.log(`Rendering ${filteredFeatures.length} features for jurisdiction: ${jurisdiction}`);

      if (filteredFeatures.length > 0) {
        // Log first feature for debugging
        console.log(`Sample feature geometry for ${jurisdiction}:`, filteredFeatures[0].geometry);
        console.log(`Sample feature properties:`, filteredFeatures[0].properties);
        
        try {
          const layer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
            style: {
              color: color,
              weight: 2,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.35,
            },
            onEachFeature: (feature, layer) => {
              const props = feature.properties || {};
              const fpId = props.FP_ID || 'N/A';
              const decision = props.DECISION || 'N/A';
              const regionName = props.REGION_NM || 'N/A';
              
              layer.bindPopup(`
                <div style="font-size: 11px;">
                  <strong>FP_ID: ${fpId}</strong><br/>
                  <strong>Jurisdiction: ${jurisdiction}</strong><br/>
                  Region: ${regionName}<br/>
                  Decision: ${decision}<br/>
                  Received: ${props.RECEIVED_DT || 'N/A'}
                </div>
              `);
            }
          });

          layer.addTo(map.current);
          arcgisLayersRef.current[jurisdiction] = layer;
          console.log(`Successfully added layer for ${jurisdiction} to map`);
        } catch (err) {
          console.error(`Error creating layer for ${jurisdiction}:`, err);
          console.log('Failed features:', filteredFeatures.slice(0, 2));
        }

        // Extend bounds
        filteredFeatures.forEach(feature => {
          if (feature.geometry && feature.geometry.coordinates && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
            try {
              const featureLayer = L.geoJSON(feature);
              bounds.extend(featureLayer.getBounds());
              hasBounds = true;
            } catch (err) {
              console.warn('Failed to add feature to bounds:', err, feature);
            }
          }
        });
      }
    });

    if (hasBounds) {
      console.log('Fitting map to bounds:', bounds);
      map.current.fitBounds(bounds, { padding: [50, 50] });
    } else {
      console.warn('No valid bounds found, keeping default map view');
      // Zoom to Washington state as fallback
      map.current.setView([47.5, -121.5], 8);
    }

    // Fix map size after rendering layers (helps with mobile)
    setTimeout(() => {
      if (map.current) {
        map.current.invalidateSize();
      }
    }, 100);
  }, [visibleJurisdictions, arcgisData, jurisdictionColors]);

  // Display user's FPAs with geometry
  useEffect(() => {
    if (!map.current) {
      console.log('Skipping FPA update - map not initialized yet');
      return;
    }

    console.log('=== FPA Overlay Map Update ===');
    console.log('Total FPAs received:', fpas.length);
    console.log('FPAs with geometry:', fpas.filter(f => f.geometry).length);
    console.log('FPAs without geometry:', fpas.filter(f => !f.geometry).map(f => f.fpaNumber));
    console.log('Active status filters:', statusFilters);
    console.log('Search query:', searchQuery);
    console.log('Map bounds:', map.current?.getBounds());

    // Remove existing user FPA layers
    userFPALayersRef.current.forEach(layer => {
      map.current.removeLayer(layer);
    });
    userFPALayersRef.current = [];

    // Filter FPAs based on search and status filters
    const filteredFpas = fpas.filter(fpa => {
      if (!fpa.geometry) {
        console.log(`FPA ${fpa.fpaNumber} - NO GEOMETRY`);
        return false;
      }

      // Check status filter
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
      
      let isExpired = false;
      if (fpa.expirationDate) {
        const expDate = new Date(fpa.expirationDate);
        expDate.setHours(0, 0, 0, 0); // Reset to start of day
        isExpired = expDate < today;
        console.log(`FPA ${fpa.fpaNumber} - ExpirationDate: ${fpa.expirationDate}, Parsed: ${expDate.toLocaleDateString()}, Today: ${today.toLocaleDateString()}, isExpired: ${isExpired}`);
      }
      
      let baseStatus = isExpired ? 'expired' : (fpa.applicationStatus || 'pending');
      // Normalize to lowercase for filter comparison
      baseStatus = baseStatus.toLowerCase();
      
      console.log(`FPA ${fpa.fpaNumber} - Status: ${fpa.applicationStatus}, baseStatus: ${baseStatus}, filterEnabled: ${statusFilters[baseStatus]}`);
      
      if (!statusFilters[baseStatus]) return false;

      // If approved, check sub-filters
      if (baseStatus === 'approved') {
        const activityStatus = fpa.activity?.status || 'Not Started';
        if (!approvedSubFilters[activityStatus]) {
          console.log(`FPA ${fpa.fpaNumber} - Approved activity ${activityStatus} filtered out`);
          return false;
        }
      }

      // Check jurisdiction filter if not "Show All"
      if (!selectedUserJurisdictions.includes('Show All')) {
        // For user FPAs, we don't have jurisdiction data, so we need to determine from FPA number
        // or just show all if filtered (for now, just show all user FPAs regardless of jurisdiction filter)
        // In future, you could add a jurisdiction field to your FPA form
      }

      // Check search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = 
          (fpa.fpaNumber && fpa.fpaNumber.toLowerCase().includes(query)) ||
          (fpa.landowner && fpa.landowner.toLowerCase().includes(query)) ||
          (fpa.timberSaleName && fpa.timberSaleName.toLowerCase().includes(query));
        
        if (!matches) return false;
      }

      return true;
    });

    console.log('Filtered FPAs to display:', filteredFpas.length);
    console.log('Map available:', !!map.current);

    // Check if search matched FPAs without geometry
    if (searchQuery) {
      const matchedWithoutGeometry = fpas.filter(fpa => {
        if (fpa.geometry) return false; // Skip FPAs with geometry
        const query = searchQuery.toLowerCase();
        return (fpa.fpaNumber && fpa.fpaNumber.toLowerCase().includes(query)) ||
               (fpa.landowner && fpa.landowner.toLowerCase().includes(query)) ||
               (fpa.timberSaleName && fpa.timberSaleName.toLowerCase().includes(query));
      });

      if (matchedWithoutGeometry.length > 0 && filteredFpas.length === 0) {
        const fpaNumbers = matchedWithoutGeometry.map(f => f.fpaNumber).join(', ');
        console.warn(`⚠️ Found FPA(s) matching search but without geometry: ${fpaNumbers}`);
        setErrorMsg(`Found FPA ${fpaNumbers} but it has no boundary drawn. Edit the FPA to add a map boundary.`);
      } else {
        setErrorMsg('');
      }
    }

    // Add filtered FPAs to map
    filteredFpas.forEach((fpa) => {
      if (!fpa.geometry) return;

      try {
        // Parse geometry if it's a string
        const geometry = typeof fpa.geometry === 'string' 
          ? JSON.parse(fpa.geometry) 
          : fpa.geometry;

        // Check if expired
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let isExpired = false;
        if (fpa.expirationDate) {
          const expDate = new Date(fpa.expirationDate);
          expDate.setHours(0, 0, 0, 0);
          isExpired = expDate < today;
        }

        // Determine color based on status and activity
        let color = '#3B82F6';
        if (isExpired) {
          color = '#6B7280';
        } else if (fpa.applicationStatus === 'Approved') {
          const activityStatus = fpa.activity?.status || 'Not Started';
          switch (activityStatus) {
            case 'Started':
              color = '#10B981';
              break;
            case 'Harvest Complete':
              color = '#F59E0B';
              break;
            case 'Activity Complete':
              color = '#8B5CF6';
              break;
            default:
              color = '#3B82F6';
          }
        } else if (fpa.applicationStatus === 'Pending') {
          color = '#EF4444';
        }

        // Add polygon to map
        L.geoJSON(geometry, {
          style: {
            color: color,
            weight: 2,
            opacity: 0.8,
            fillColor: color,
            fillOpacity: 0.5
          },
          onEachFeature: (feature, layer) => {
            layer.bindPopup(`
              <div>
                <strong>FPA: ${fpa.fpaNumber}</strong><br/>
                Status: ${fpa.applicationStatus}<br/>
                ${fpa.landowner ? `Landowner: ${fpa.landowner}<br/>` : ''}
              </div>
            `);
          }
        }).addTo(map.current);

        userFPALayersRef.current.push(fpa.fpaNumber);
      } catch (error) {
        console.error(`Error rendering FPA ${fpa.fpaNumber}:`, error);
      }
    });
  }, [fpas, searchQuery, statusFilters, approvedSubFilters, selectedUserJurisdictions]);

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

  const toggleAllJurisdictions = () => {
    if (visibleJurisdictions.length === jurisdictions.length) {
      setVisibleJurisdictions([]);
      localStorage.removeItem(`mapJurisdictions_${region}`);
    } else {
      setVisibleJurisdictions(jurisdictions);
      localStorage.setItem(`mapJurisdictions_${region}`, JSON.stringify(jurisdictions));
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      gap: '0',
      minHeight: isMobile ? '600px' : 'auto'
    }}>
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
        flexShrink: 0
      }}>
        <div>
          {isLoading ? '⏳ Loading DNR ArcGIS data...' : `📍 DNR Reference: ${visibleJurisdictions.length}/${jurisdictions.length} jurisdictions (${arcgisData?.features.length || 0} units) | Your FPAs: ${
            (() => {
              const totalWithGeometry = fpas.filter(f => f.geometry).length;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const filteredCount = fpas.filter(f => {
                if (!f.geometry) return false;
                
                let isExpired = false;
                if (f.expirationDate) {
                  const expDate = new Date(f.expirationDate);
                  expDate.setHours(0, 0, 0, 0);
                  isExpired = expDate < today;
                }
                
                const baseStatus = (isExpired ? 'expired' : (f.applicationStatus || 'pending')).toLowerCase();
                if (!statusFilters[baseStatus]) return false;
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  return (f.fpaNumber && f.fpaNumber.toLowerCase().includes(query)) ||
                         (f.landowner && f.landowner.toLowerCase().includes(query)) ||
                         (f.timberSaleName && f.timberSaleName.toLowerCase().includes(query));
                }
                return true;
              }).length;
              return searchQuery || Object.values(statusFilters).some(v => !v) ? `${filteredCount}/${totalWithGeometry}` : totalWithGeometry;
            })()
          }`}
        </div>
        {!isLoading && jurisdictions.length > 0 && (
          <button
            onClick={toggleAllJurisdictions}
            style={{
              padding: '4px 8px',
              background: 'rgba(111, 160, 80, 0.3)',
              border: '1px solid rgba(111, 160, 80, 0.5)',
              borderRadius: '3px',
              fontSize: '10px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(111, 160, 80, 0.5)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(111, 160, 80, 0.3)'}
          >
            {visibleJurisdictions.length === jurisdictions.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Search and Filter Controls */}
      <div style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        {/* Mobile: Toggle Button */}
        {isMobile && (
          <div 
            onClick={() => setFiltersCollapsed(!filtersCollapsed)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-secondary)',
              borderBottom: filtersCollapsed ? 'none' : '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 'bold',
              fontSize: '12px',
              color: 'var(--text-primary)'
            }}
          >
            <span>{filtersCollapsed ? '▶' : '▼'} Filters & Search</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>
              {(() => {
                const activeFilters = Object.values(statusFilters).filter(v => v).length;
                return `${activeFilters}/4 active`;
              })()}
            </span>
          </div>
        )}
        
        {/* Filter Content */}
        {(!isMobile || !filtersCollapsed) && (
          <div style={{
            padding: isMobile ? '8px' : '8px 12px',
            display: 'flex',
            gap: isMobile ? '8px' : '12px',
            alignItems: 'flex-start',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap'
          }}>
            {/* Search Input */}
            <div style={{ flex: isMobile ? '1' : '1 1 200px', minWidth: isMobile ? 'auto' : '200px', width: isMobile ? '100%' : 'auto' }}>
              <input
                type="text"
                placeholder={isMobile ? "Search FPAs..." : "Search FPAs (number, landowner, timber sale)..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: isMobile ? '8px 10px' : '6px 10px',
                  fontSize: isMobile ? '14px' : '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Status Filters */}
            <div style={{
              display: 'flex',
              gap: isMobile ? '6px' : '8px',
              fontSize: isMobile ? '12px' : '11px',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              width: isMobile ? '100%' : 'auto'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', lineHeight: '24px', width: isMobile ? '100%' : 'auto' }}>Status:</span>
              <div style={{
                display: 'flex',
                gap: isMobile ? '6px' : '8px',
                flexWrap: 'wrap',
                width: isMobile ? '100%' : 'auto'
              }}>
                {['pending', 'approved', 'denied', 'expired'].map(status => (
                  <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        opacity: statusFilters[status] ? 1 : 0.5,
                        padding: isMobile ? '4px' : '0'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={statusFilters[status]}
                        onChange={(e) => setStatusFilters(prev => ({
                          ...prev,
                          [status]: e.target.checked
                        }))}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{status}</span>
                      {status === 'approved' && !isMobile && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setShowApprovedExpanded(!showApprovedExpanded);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '10px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {showApprovedExpanded ? '▼' : '▶'}
                        </button>
                      )}
                    </label>
                    {status === 'approved' && showApprovedExpanded && !isMobile && statusFilters.approved && (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '2px',
                        marginLeft: '20px',
                        fontSize: '10px'
                      }}>
                        {Object.keys(approvedSubFilters).map(subStatus => (
                          <label 
                            key={subStatus}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                              opacity: approvedSubFilters[subStatus] ? 1 : 0.5
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={approvedSubFilters[subStatus]}
                              onChange={(e) => setApprovedSubFilters(prev => ({
                                ...prev,
                                [subStatus]: e.target.checked
                              }))}
                              style={{ cursor: 'pointer' }}
                            />
                            <span>{subStatus}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* FP Unit/Jurisdiction Filter */}
            <div style={{
              display: 'flex',
              gap: '8px',
              fontSize: isMobile ? '12px' : '11px',
              flexWrap: 'wrap',
              alignItems: 'center',
              width: isMobile ? '100%' : 'auto'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>FP Unit:</span>
              <select
                value={selectedUserJurisdictions[0] || 'Show All'}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'Show All') {
                    setSelectedUserJurisdictions(['Show All']);
                  } else {
                    setSelectedUserJurisdictions([value]);
                  }
                }}
                style={{
                  padding: isMobile ? '6px 10px' : '4px 8px',
                  fontSize: isMobile ? '12px' : '11px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  flex: isMobile ? '1' : 'none'
                }}
              >
                <option value="Show All">Show All</option>
                {jurisdictions.map(juris => (
                  <option key={juris} value={juris}>{juris}</option>
                ))}
              </select>
            </div>

            {/* Clear Search */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  padding: isMobile ? '6px 12px' : '4px 8px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '3px',
                  fontSize: isMobile ? '12px' : '10px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          fontSize: '11px',
          flexShrink: 0
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div
        ref={mapContainer}
        style={{
          flex: 1,
          minHeight: isMobile ? '500px' : '400px',
          height: isMobile ? 'calc(100vh - 350px)' : '100%',
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
