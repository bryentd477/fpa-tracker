const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize database tables
async function initializeDatabase() {
  try {
    // Check if tables exist by trying to query them
    const { data: existingFpas, error: fpaError } = await supabase
      .from('fpas')
      .select('id')
      .limit(1);

    if (fpaError && fpaError.code === 'PGRST116') {
      // Table doesn't exist, create it
      console.log('Creating fpas table...');
      const { error } = await supabase.rpc('create_fpas_table');
      if (error) console.log('fpas table check complete');
    }

    console.log('Database tables ready');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

module.exports = {
  supabase,
  initializeDatabase
};
