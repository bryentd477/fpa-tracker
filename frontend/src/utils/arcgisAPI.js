// ArcGIS REST API utility for querying FP_ID data
// Washington DNR official GIS service endpoint
// Layer 6: FPA - All Harvest by Classification (contains active FPA/N harvest unit boundaries)
// Dataset: https://gis.dnr.wa.gov/site2/rest/services/Public_Forest_Practices/WADNR_PUBLIC_FP_FPA/MapServer/6

// Washington State DNR GIS MapServer endpoint - querying layer 6 (FPA - All Harvest by Classification)
const ARCGIS_API_URL = 'https://gis.dnr.wa.gov/site2/rest/services/Public_Forest_Practices/WADNR_PUBLIC_FP_FPA/MapServer/6/query';

// Map FPA number prefixes to DNR regions for faster filtering
// This reduces the number of records fetched from 6000+ to ~1000-2000 per region
const FPA_PREFIX_TO_REGION = {
  '28': 'NORTHWEST',
  '29': 'NORTHWEST', 
  '30': 'OLYMPIC',
  '31': 'PACIFIC_CASCADE',
  '32': 'SOUTH_PUGET_SOUND',
  '33': 'SOUTHEAST',
  '34': 'NORTHEAST'
  // Add more mappings as needed
};

/**
 * Determine region from FPA number based on prefix
 */
const getRegionFromFPA = (fpaId) => {
  if (!fpaId) return null;
  const cleanId = String(fpaId).replace(/[,\s]/g, '').trim();
  const prefix = cleanId.substring(0, 2);
  return FPA_PREFIX_TO_REGION[prefix] || null;
};

/**
 * Convert ESRI JSON geometry to GeoJSON geometry
 */
const esriToGeoJSON = (esriGeometry) => {
  if (!esriGeometry) return null;
  
  // Handle Polygon with rings
  if (esriGeometry.rings) {
    // ESRI rings: outer rings are clockwise, holes are counter-clockwise
    // GeoJSON: first ring is outer, subsequent rings are holes
    // For simplicity, treat each ring as a separate polygon coordinate
    if (esriGeometry.rings.length === 1) {
      return {
        type: 'Polygon',
        coordinates: esriGeometry.rings
      };
    } else {
      // Multiple rings - could be MultiPolygon or Polygon with holes
      // For now, treat as MultiPolygon
      return {
        type: 'MultiPolygon',
        coordinates: esriGeometry.rings.map(ring => [ring])
      };
    }
  }
  
  // Handle Point
  if (esriGeometry.x !== undefined && esriGeometry.y !== undefined) {
    return {
      type: 'Point',
      coordinates: [esriGeometry.x, esriGeometry.y]
    };
  }
  
  // Handle Polyline
  if (esriGeometry.paths) {
    return {
      type: 'LineString',
      coordinates: esriGeometry.paths[0]
    };
  }
  
  return null;
};

/**
 * Simple single query without pagination (fast, for direct lookups)
 */
const querySingleArcGIS = async (whereClause, maxRecords = 10) => {
  try {
    const params = new URLSearchParams({
      where: whereClause || '1=1',
      outFields: '*',
      returnGeometry: true,
      outSR: 4326,
      f: 'json',
      resultRecordCount: maxRecords
    });

    const url = `${ARCGIS_API_URL}?${params}`;
    const response = await fetch(url, { method: 'GET', mode: 'cors' });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`ArcGIS error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    return {
      type: 'FeatureCollection',
      features: (data.features || []).map(feature => ({
        type: 'Feature',
        geometry: esriToGeoJSON(feature.geometry),
        properties: feature.attributes
      }))
    };
  } catch (error) {
    console.error('ArcGIS query error:', error);
    throw error;
  }
};

/**
 * Call ArcGIS API directly with pagination to fetch all records
 * ArcGIS server has maxRecordCount limit of 1000, so we fetch in batches
 */
const callArcGISAPI = async (where) => {
  try {
    const maxRecordCount = 1000; // ArcGIS server limit
    let allFeatures = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        where: where || '1=1',
        outFields: '*',
        returnGeometry: true,
        outSR: 4326, // WGS84
        f: 'json',
        resultRecordCount: maxRecordCount,
        resultOffset: offset  // Pagination parameter
      });

      const url = `${ARCGIS_API_URL}?${params}`;

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`ArcGIS error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const features = data.features || [];
      allFeatures.push(...features);

      console.log(`[ArcGIS] Fetched ${features.length} records at offset ${offset} (total: ${allFeatures.length})`);

      // Stop if we got fewer records than requested (indicates last batch)
      hasMore = features.length === maxRecordCount;
      offset += maxRecordCount;
    }

    // Convert all accumulated features from ESRI JSON to GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: allFeatures.map(feature => ({
        type: 'Feature',
        geometry: esriToGeoJSON(feature.geometry),
        properties: feature.attributes
      }))
    };

    console.log(`[ArcGIS] ✓ Complete: Fetched ${allFeatures.length} total records`);
    return geojson;
  } catch (error) {
    console.error('ArcGIS API error:', error);
    throw error;
  }
};

/**
 * Search for FPA geometry by FP_ID
 * @param {string|number} fpaId - FPA number (e.g., 2411527 or 2,411,527)
 * @returns {Promise<Object>} GeoJSON FeatureCollection with geometry
 */
// Cache for FPA records by region to avoid repeated API calls
// Note: callArcGISAPI now uses pagination to fetch ALL records (not limited to 1000)
const cachedFPAsByRegion = new Map();
const cacheFetchPromises = new Map();

/**
 * Get FPAs for a specific region (with caching)
 * @param {string|null} region - Region name (e.g., 'NORTHWEST') or null for all records
 * @param {boolean} fresh - Force fresh fetch instead of using cache
 */
const getFPAsByRegion = async (region, fresh = false) => {
  const cacheKey = region || 'ALL';
  
  // Return cached data if available and not requesting fresh
  if (!fresh && cachedFPAsByRegion.has(cacheKey)) {
    console.log(`[ArcGIS] Using cached data for region: ${cacheKey}`);
    return cachedFPAsByRegion.get(cacheKey);
  }

  // If already fetching, wait for that promise
  if (cacheFetchPromises.has(cacheKey)) {
    console.log(`[ArcGIS] Fetch in progress for region ${cacheKey}, waiting...`);
    return cacheFetchPromises.get(cacheKey);
  }
  
  // Build WHERE clause to filter on server-side (much faster than fetching 42k records)
  const whereClause = region ? `REGION_NM = '${region}'` : '1=1';
  console.log(`[ArcGIS] Starting fetch for region: ${cacheKey}, WHERE: ${whereClause}`);
  
  const promise = callArcGISAPI(whereClause).then(result => {
    console.log(`[ArcGIS] Fetched ${result.features.length} records for region ${cacheKey}`);
    cachedFPAsByRegion.set(cacheKey, result);
    return result;
  }).catch(error => {
    cacheFetchPromises.delete(cacheKey);
    throw error;
  }).finally(() => {
    cacheFetchPromises.delete(cacheKey);
  });
  
  cacheFetchPromises.set(cacheKey, promise);
  return promise;
};

export const searchArcGISByFPID = async (fpaId) => {
  if (!fpaId) throw new Error('FPA ID is required');

  const cleanId = String(fpaId).replace(/[,\s]/g, '').trim();
  if (!cleanId) throw new Error('Invalid FPA ID');

  try {
    console.log(`[ArcGIS] Searching for FPA: ${cleanId}`);
    
    // Step 1: Get field structure from 1 sample record (fast)
    console.log(`[ArcGIS] Fetching 1 sample record...`);
    const sample = await querySingleArcGIS('1=1', 1);
    
    if (sample.features && sample.features.length > 0) {
      const sampleProps = sample.features[0].properties;
      console.log(`[ArcGIS] ====== FIELD STRUCTURE ======`);
      console.log(`[ArcGIS] Fields:`, Object.keys(sampleProps));
      console.log(`[ArcGIS] FP_ID:`, sampleProps.FP_ID, `(type: ${typeof sampleProps.FP_ID})`);
      console.log(`[ArcGIS] ==============================`);
    }
    
    // Step 2: Try direct query for the specific FPA in multiple fields
    const numericId = parseInt(cleanId, 10);
    if (!isNaN(numericId)) {
      // Try FP_ID field
      let whereClause = `FP_ID = ${numericId}`;
      console.log(`[ArcGIS] Direct query: ${whereClause}`);
      
      let result = await querySingleArcGIS(whereClause, 10);
      
      if (result.features && result.features.length > 0) {
        console.log(`✓ Found ${result.features.length} matching FPA(s) in FP_ID field`);
        return result;
      }
      
      // Try APPLICANT_ACT_ID field as fallback
      whereClause = `APPLICANT_ACT_ID = ${numericId}`;
      console.log(`[ArcGIS] Trying APPLICANT_ACT_ID: ${whereClause}`);
      
      result = await querySingleArcGIS(whereClause, 10);
      
      if (result.features && result.features.length > 0) {
        console.log(`✓ Found ${result.features.length} matching FPA(s) in APPLICANT_ACT_ID field`);
        return result;
      }
      
      console.warn(`[ArcGIS] Not found in FP_ID or APPLICANT_ACT_ID`);
      console.warn(`[ArcGIS] This FPA may be in a different MapServer layer`);
      console.warn(`[ArcGIS] Current layer: ${ARCGIS_API_URL}`);
    }
    
    throw new Error(`FPA ${cleanId} not found. It may be in a different layer or marked as inactive.`);
  } catch (error) {
    console.error('[ArcGIS Error]', error.message);
    throw error;
  }
};

/**
 * Search for all FPA polygons by Region
 * @param {string} region - Region name (e.g., "NorthWest")
 * @returns {Promise<Object>} GeoJSON FeatureCollection with all FPAs
 */
export const searchArcGISByRegion = async (region) => {
  if (!region) throw new Error('Region is required');

  try {
    // Get FPA records for specific region (use cached if available)
    console.log(`Fetching FPA records for region: ${region}`);
    
    const result = await getFPAsByRegion(region, false);
    
    if (result.features && result.features.length > 0) {
      console.log(`Total features loaded for ${region}: ${result.features.length}`);
      
      return {
        type: 'FeatureCollection',
        features: result.features
      };
    }
    
    console.log(`Loaded ${result.features.length} features`);
    return result;
  } catch (error) {
    console.error('Error querying ArcGIS by region:', error);
    throw error;
  }
};

/**
 * Get all available jurisdictions in a region
 */
export const getJurisdictionsInRegion = async (region) => {
  try {
    // Use region-specific cached data
    const result = await getFPAsByRegion(region, false);

    const jurisdictions = new Set();
    result.features.forEach(f => {
      const jurisdiction = f.properties?.FP_Jurisdic_NM;
      if (jurisdiction) {
        jurisdictions.add(jurisdiction);
      }
    });

    return Array.from(jurisdictions).sort();
  } catch (error) {
    console.error('Error fetching jurisdictions:', error);
    return [];
  }
};
