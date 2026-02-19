// Disable SSL certificate verification for Supabase (development only)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { supabase, initializeDatabase } = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Initialize database
initializeDatabase().catch(err => {
  console.error('Database initialization error:', err);
  process.exit(1);
});

// ==================== FPA Endpoints ====================

// Get all FPAs
app.get('/api/fpas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fpas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching FPAs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single FPA with activity and renewal history
app.get('/api/fpas/:id', async (req, res) => {
  try {
    const { data: fpa, error: fpaError } = await supabase
      .from('fpas')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fpaError) {
      return res.status(404).json({ error: 'FPA not found' });
    }

    const { data: activity } = await supabase
      .from('approved_activities')
      .select('*')
      .eq('fpa_id', req.params.id)
      .single();

    const { data: renewals } = await supabase
      .from('renewal_history')
      .select('*')
      .eq('fpa_id', req.params.id)
      .order('renewal_date', { ascending: false });

    res.json({
      ...fpa,
      activity: activity || null,
      renewals: renewals || []
    });
  } catch (error) {
    console.error('Error fetching FPA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search FPAs
app.get('/api/fpas/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from('fpas')
      .select('*')
      .or(`fpa_number.ilike.%${query}%,landowner.ilike.%${query}%,timber_sale_name.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error searching FPAs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create FPA
app.post('/api/fpas', async (req, res) => {
  try {
    const { fpaNumber, landowner, timberSaleName, landownerType } = req.body;

    if (!fpaNumber || !landowner || !timberSaleName || !landownerType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('fpas')
      .insert([{
        fpa_number: fpaNumber,
        landowner,
        timber_sale_name: timberSaleName,
        landowner_type: landownerType,
        application_status: ''
      }])
      .select()
      .single();

    if (error) {
      if (error.message.includes('unique')) {
        return res.status(400).json({ error: 'FPA Number must be unique' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating FPA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update FPA
app.put('/api/fpas/:id', async (req, res) => {
  try {
    const { landowner, timberSaleName, landownerType, applicationStatus, decisionDeadline, expirationDate } = req.body;

    const { data, error } = await supabase
      .from('fpas')
      .update({
        landowner,
        timber_sale_name: timberSaleName,
        landowner_type: landownerType,
        application_status: applicationStatus,
        decision_deadline: decisionDeadline,
        expiration_date: expirationDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating FPA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete FPA
app.delete('/api/fpas/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('fpas')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting FPA:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Approved Activity Endpoints ====================

// Create/Update approved activity
app.post('/api/fpas/:id/activity', async (req, res) => {
  try {
    const { status, startDate, harvestCompleteDate, activityCompleteDate, comments, reforestationRequired } = req.body;

    // Check if activity exists
    const { data: existing } = await supabase
      .from('approved_activities')
      .select('id')
      .eq('fpa_id', req.params.id)
      .single();

    let result;
    if (existing) {
      // Update
      result = await supabase
        .from('approved_activities')
        .update({
          status,
          start_date: startDate,
          harvest_complete_date: harvestCompleteDate,
          activity_complete_date: activityCompleteDate,
          comments,
          reforestation_required: reforestationRequired,
          updated_at: new Date().toISOString()
        })
        .eq('fpa_id', req.params.id)
        .select()
        .single();
    } else {
      // Insert
      result = await supabase
        .from('approved_activities')
        .insert([{
          fpa_id: req.params.id,
          status,
          start_date: startDate,
          harvest_complete_date: harvestCompleteDate,
          activity_complete_date: activityCompleteDate,
          comments,
          reforestation_required: reforestationRequired
        }])
        .select()
        .single();
    }

    if (result.error) throw result.error;
    res.json(result.data);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get approved activity
app.get('/api/fpas/:id/activity', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('approved_activities')
      .select('*')
      .eq('fpa_id', req.params.id)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.json(null);
    }
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Renewal History Endpoints ====================

// Add renewal date
app.post('/api/fpas/:id/renewals', async (req, res) => {
  try {
    const { renewalDate, notes } = req.body;

    if (!renewalDate) {
      return res.status(400).json({ error: 'Renewal date is required' });
    }

    const { data, error } = await supabase
      .from('renewal_history')
      .insert([{
        fpa_id: req.params.id,
        renewal_date: renewalDate,
        notes: notes || ''
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding renewal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get renewal history
app.get('/api/fpas/:id/renewals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('renewal_history')
      .select('*')
      .eq('fpa_id', req.params.id)
      .order('renewal_date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching renewals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete renewal
app.delete('/api/renewals/:renewalId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('renewal_history')
      .delete()
      .eq('id', req.params.renewalId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting renewal:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Dashboard Endpoint ====================

// Get FPAs grouped by status with summaries
app.get('/api/dashboard', async (req, res) => {
  try {
    const { data: fpas, error } = await supabase
      .from('fpas')
      .select('*')
      .order('application_status', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const grouped = {
      '': [],
      'In Decision Window': [],
      'Approved': [],
      'Withdrawn': [],
      'Disapproved': [],
      'Closed Out': []
    };

    (fpas || []).forEach(fpa => {
      const status = fpa.application_status || '';
      if (grouped.hasOwnProperty(status)) {
        grouped[status].push({
          id: fpa.id,
          fpaNumber: fpa.fpa_number,
          timberSaleName: fpa.timber_sale_name,
          landowner: fpa.landowner,
          landownerType: fpa.landowner_type,
          applicationStatus: fpa.application_status
        });
      }
    });

    res.json({
      summary: Object.entries(grouped).map(([status, items]) => ({
        status: status || 'Unassigned',
        count: items.length,
        fpas: items
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`FPA Tracker server running on http://localhost:${PORT}`);
  console.log('Cloud-synced with Supabase ☁️');
});

// Get single FPA with activity and renewal history
app.get('/api/fpas/:id', async (req, res) => {
  try {
    const fpa = await db.getAsync('SELECT * FROM fpas WHERE id = ?', [req.params.id]);
    
    if (!fpa) {
      return res.status(404).json({ error: 'FPA not found' });
    }

    const activity = await db.getAsync('SELECT * FROM approved_activities WHERE fpaId = ?', [req.params.id]);
    const renewals = await db.allAsync('SELECT * FROM renewal_history WHERE fpaId = ? ORDER BY renewalDate DESC', [req.params.id]);

    res.json({
      ...fpa,
      activity: activity || null,
      renewals: renewals || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search FPAs
app.get('/api/fpas/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }

    const searchTerm = `%${query}%`;
    const fpas = await db.allAsync(`
      SELECT * FROM fpas 
      WHERE fpaNumber LIKE ? OR landowner LIKE ? OR timberSaleName LIKE ?
      ORDER BY createdAt DESC
    `, [searchTerm, searchTerm, searchTerm]);

    res.json(fpas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create FPA
app.post('/api/fpas', async (req, res) => {
  try {
    const { fpaNumber, landowner, timberSaleName, landownerType } = req.body;

    if (!fpaNumber || !landowner || !timberSaleName || !landownerType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.runAsync(`
      INSERT INTO fpas (fpaNumber, landowner, timberSaleName, landownerType)
      VALUES (?, ?, ?, ?)
    `, [fpaNumber, landowner, timberSaleName, landownerType]);

    const fpa = await db.getAsync('SELECT * FROM fpas WHERE id = ?', [result.id]);
    res.status(201).json(fpa);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'FPA Number must be unique' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Update FPA
app.put('/api/fpas/:id', async (req, res) => {
  try {
    const { landowner, timberSaleName, landownerType, applicationStatus, decisionDeadline, expirationDate } = req.body;

    await db.runAsync(`
      UPDATE fpas 
      SET landowner = ?, timberSaleName = ?, landownerType = ?, 
          applicationStatus = ?, decisionDeadline = ?, expirationDate = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [landowner, timberSaleName, landownerType, applicationStatus, decisionDeadline, expirationDate, req.params.id]);

    const fpa = await db.getAsync('SELECT * FROM fpas WHERE id = ?', [req.params.id]);
    res.json(fpa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete FPA
app.delete('/api/fpas/:id', async (req, res) => {
  try {
    await db.runAsync('DELETE FROM fpas WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Approved Activity Endpoints ====================

// Create/Update approved activity
app.post('/api/fpas/:id/activity', async (req, res) => {
  try {
    const { status, startDate, harvestCompleteDate, activityCompleteDate, comments, reforestationRequired } = req.body;

    const existing = await db.getAsync('SELECT * FROM approved_activities WHERE fpaId = ?', [req.params.id]);

    if (existing) {
      await db.runAsync(`
        UPDATE approved_activities
        SET status = ?, startDate = ?, harvestCompleteDate = ?, activityCompleteDate = ?,
            comments = ?, reforestationRequired = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE fpaId = ?
      `, [status, startDate, harvestCompleteDate, activityCompleteDate, comments, reforestationRequired, req.params.id]);

      const activity = await db.getAsync('SELECT * FROM approved_activities WHERE fpaId = ?', [req.params.id]);
      res.json(activity);
    } else {
      const result = await db.runAsync(`
        INSERT INTO approved_activities (fpaId, status, startDate, harvestCompleteDate, activityCompleteDate, comments, reforestationRequired)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [req.params.id, status, startDate, harvestCompleteDate, activityCompleteDate, comments, reforestationRequired]);

      const activity = await db.getAsync('SELECT * FROM approved_activities WHERE id = ?', [result.id]);
      res.status(201).json(activity);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get approved activity
app.get('/api/fpas/:id/activity', async (req, res) => {
  try {
    const activity = await db.getAsync('SELECT * FROM approved_activities WHERE fpaId = ?', [req.params.id]);
    res.json(activity || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Renewal History Endpoints ====================

// Add renewal date
app.post('/api/fpas/:id/renewals', async (req, res) => {
  try {
    const { renewalDate, notes } = req.body;

    if (!renewalDate) {
      return res.status(400).json({ error: 'Renewal date is required' });
    }

    const result = await db.runAsync(`
      INSERT INTO renewal_history (fpaId, renewalDate, notes)
      VALUES (?, ?, ?)
    `, [req.params.id, renewalDate, notes || '']);

    const renewal = await db.getAsync('SELECT * FROM renewal_history WHERE id = ?', [result.id]);
    res.status(201).json(renewal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get renewal history
app.get('/api/fpas/:id/renewals', async (req, res) => {
  try {
    const renewals = await db.allAsync(
      'SELECT * FROM renewal_history WHERE fpaId = ? ORDER BY renewalDate DESC',
      [req.params.id]
    );
    res.json(renewals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete renewal
app.delete('/api/renewals/:renewalId', async (req, res) => {
  try {
    await db.runAsync('DELETE FROM renewal_history WHERE id = ?', [req.params.renewalId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Dashboard Endpoint ====================

// Get FPAs grouped by status with summaries
app.get('/api/dashboard', async (req, res) => {
  try {
    const fpas = await db.allAsync('SELECT * FROM fpas ORDER BY applicationStatus, createdAt DESC');

    const grouped = {
      '': [],
      'In Decision Window': [],
      'Approved': [],
      'Withdrawn': [],
      'Disapproved': [],
      'Closed Out': []
    };

    fpas.forEach(fpa => {
      const status = fpa.applicationStatus || '';
      if (grouped.hasOwnProperty(status)) {
        grouped[status].push({
          id: fpa.id,
          fpaNumber: fpa.fpaNumber,
          timberSaleName: fpa.timberSaleName,
          landowner: fpa.landowner,
          landownerType: fpa.landownerType,
          applicationStatus: fpa.applicationStatus
        });
      }
    });

    res.json({
      summary: Object.entries(grouped).map(([status, items]) => ({
        status: status || 'Unassigned',
        count: items.length,
        fpas: items
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});
