const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Disable SSL certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { initializeDatabase, supabase } = require('../backend/supabase');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// API Routes
app.get('/api/fpas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fpas')
      .select('*')
      .order('id', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching FPAs:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fpas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('fpas')
      .select('*')
      .eq('id', parseInt(id))
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching FPA:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fpas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fpas')
      .insert([req.body])
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error('Error creating FPA:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/fpas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('fpas')
      .update(req.body)
      .eq('id', parseInt(id))
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error('Error updating FPA:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fpas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('fpas')
      .delete()
      .eq('id', parseInt(id));
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting FPA:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fpas/search', async (req, res) => {
  try {
    const { query } = req.query;
    const { data, error } = await supabase
      .from('fpas')
      .select('*')
      .or(`fpa_number.ilike.%${query}%,landowner.ilike.%${query}%,timber_sale_name.ilike.%${query}%`)
      .order('id', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error searching FPAs:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fpas/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('approved_activities')
      .select('*')
      .eq('fpa_id', parseInt(id))
      .order('id', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fpas/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('approved_activities')
      .insert([{ ...req.body, fpa_id: parseInt(id) }])
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error('Error adding activity:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/fpas/:id/activity/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { data, error } = await supabase
      .from('approved_activities')
      .update(req.body)
      .eq('id', parseInt(activityId))
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error('Error updating activity:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fpas/:id/activity/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { error } = await supabase
      .from('approved_activities')
      .delete()
      .eq('id', parseInt(activityId));
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting activity:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fpas/:id/renewals', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('renewal_history')
      .select('*')
      .eq('fpa_id', parseInt(id))
      .order('renewal_date', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching renewals:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fpas/:id/renewals', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('renewal_history')
      .insert([{ ...req.body, fpa_id: parseInt(id) }])
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error('Error adding renewal:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fpas')
      .select('*');
    
    if (error) throw error;

    const grouped = {
      'Not Started': [],
      'In Progress': [],
      'In Decision Window': [],
      'Approved': [],
      'Expired': [],
      'Withdrawn': []
    };

    data.forEach(fpa => {
      const status = fpa.application_status || 'Not Started';
      if (grouped[status]) {
        grouped[status].push(fpa);
      }
    });

    res.json({
      total: data.length,
      byStatus: grouped
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
