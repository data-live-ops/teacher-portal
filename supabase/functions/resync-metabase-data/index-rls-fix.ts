import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Environment check:');
    console.log('- SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client with service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Starting resync process...')

    // Step 1: Use RPC function to clear data (bypasses RLS)
    console.log('Step 1: Clearing existing data...')
    
    try {
      // First try using the truncate function
      const { data: truncateResult, error: truncateError } = await supabase.rpc('truncate_raw_sessions')
      
      if (truncateError) {
        console.log('Truncate function failed, trying direct delete...')
        // If truncate fails, try direct delete with service role
        const { error: deleteError } = await supabase
          .from('raw_sessions')
          .delete()
          .gte('id', 0)
        
        if (deleteError) {
          console.error('Direct delete also failed:', deleteError)
          // As last resort, try raw SQL
          const { data: sqlResult, error: sqlError } = await supabase
            .rpc('exec_sql', { sql_query: 'DELETE FROM raw_sessions WHERE id >= 0' })
          
          if (sqlError) {
            throw new Error(`All delete methods failed. Last error: ${sqlError.message}`)
          }
        }
      }
      
      console.log('Data cleared successfully')
    } catch (clearError) {
      console.error('Error clearing data:', clearError)
      throw new Error(`Failed to clear existing data: ${clearError.message}`)
    }

    // Step 2: Insert test data
    console.log('Step 2: Inserting test data...')
    const testData = [{
      session_id: 'test-' + Date.now(),
      subject: 'Math',
      session_topic: 'Test Topic',
      slot_name: 'Test Slot',
      teacher_name: 'Test Teacher',
      grade: '5',
      class_date: '2024-01-01',
      class_time: '08:00-09:00',
      first_class_date: '2024-01-01',
      day: 'Senin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]

    console.log('Attempting insert with service role...')

    // Try using bulk insert function first
    try {
      const { data: bulkResult, error: bulkError } = await supabase.rpc('bulk_insert_raw_sessions', {
        data_json: testData
      })
      
      if (bulkError) {
        console.log('Bulk insert failed, trying direct insert...')
        // If bulk insert fails, try direct insert
        const { data: insertData, error: insertError } = await supabase
          .from('raw_sessions')
          .insert(testData)
          .select()
        
        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`)
        }
        
        console.log('Direct insert succeeded')
      } else {
        console.log('Bulk insert succeeded:', bulkResult)
      }
    } catch (insertError) {
      console.error('Insert error:', insertError)
      throw new Error(`Failed to insert test data: ${insertError.message}`)
    }

    // Step 3: Verify the data was inserted
    const { data: finalData, count: finalCount, error: countError } = await supabase
      .from('raw_sessions')
      .select('*', { count: 'exact' })

    if (countError) {
      console.error('Count error:', countError)
    }

    console.log(`Final count: ${finalCount || finalData?.length || 0}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        rows_processed: 1,
        total_rows: 1,
        final_count: finalCount || finalData?.length || 0,
        message: 'Resync test completed successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in resync process:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred',
        message: `Resync failed: ${error.message}`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 400
      }
    )
  }
})