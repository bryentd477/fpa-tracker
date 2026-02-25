/**
 * Simple local CORS proxy for ArcGIS API
 * Run this alongside your frontend dev server
 * Then update arcgisAPI.js to call http://localhost:3001
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const https = require('https');

// Ignore SSL certificate errors for corporate proxy/firewall
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const app = express();

// Washington DNR Open Data API for Forest Practices Applications
const ARCGIS_API_URL = 'https://data-wadnr.opendata.arcgis.com/api/v3/datasets/cb0522525e86444496452496896f6c0d_6/query';

app.use(cors());
app.use(express.json());

/**
 * POST /arcgis/query
 * Proxy for ArcGIS REST API queries
 */
app.post('/arcgis/query', async (req, res) => {
  const { where } = req.body;

  if (!where) {
    return res.status(400).json({ error: 'WHERE clause is required' });
  }

  try {
    const params = new URLSearchParams({
      where: where,
      outFields: '*',
      returnGeometry: true,
      resultRecordCount: 10, // Limit to 10 for testing
      f: 'json'
    });

    console.log(`[ArcGIS Proxy] Query: ${where}`);
    console.log(`[ArcGIS Proxy] Full URL: ${ARCGIS_API_URL}?${params}`);

    const response = await fetch(`${ARCGIS_API_URL}?${params}`, {
      agent: httpsAgent
    });

    console.log(`[ArcGIS Proxy] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ArcGIS Proxy] Error response:`, errorText);
      return res.status(response.status).json({ 
        error: `ArcGIS API returned ${response.status}: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`[ArcGIS Proxy] Response data:`, JSON.stringify(data).substring(0, 500));

    if (data.error) {
      console.error(`[ArcGIS Proxy] ArcGIS error:`, data.error);
      return res.status(400).json({ error: `ArcGIS error: ${data.error.message}` });
    }

    // Convert to GeoJSON format
    const geojson = {
      type: 'FeatureCollection',
      features: (data.features || []).map(feature => ({
        type: 'Feature',
        geometry: feature.geometry,
        properties: feature.attributes
      }))
    };

    console.log(`[ArcGIS Proxy] Success: ${geojson.features.length} features returned`);
    res.json(geojson);
  } catch (error) {
    console.error('[ArcGIS Proxy] Error:', error.message);
    res.status(500).json({ error: `Proxy error: ${error.message}` });
  }
});

/**
 * GET /test - Test endpoint to fetch a few records and see field names
 */
app.get('/test', async (req, res) => {
  try {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      returnGeometry: false,
      resultRecordCount: 5,
      f: 'json'
    });

    console.log(`[ArcGIS Test] Fetching sample records...`);
    const response = await fetch(`${ARCGIS_API_URL}?${params}`, {
      agent: httpsAgent
    });

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      console.log(`[ArcGIS Test] Sample record fields:`, Object.keys(data.features[0].attributes));
      res.json({
        fieldNames: Object.keys(data.features[0].attributes),
        sampleRecords: data.features.slice(0, 3).map(f => f.attributes)
      });
    } else {
      res.json({ error: 'No features returned', data });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ArcGIS Proxy running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ ArcGIS CORS Proxy running at http://localhost:${PORT}`);
  console.log(`📍 Endpoint: POST http://localhost:${PORT}/arcgis/query`);
  console.log(`💡 Frontend dev server should be running on http://localhost:3000\n`);
});
