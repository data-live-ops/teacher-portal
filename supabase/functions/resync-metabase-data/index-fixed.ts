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

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting simple resync test...')

    // Step 1: Clear existing data using DELETE with a WHERE clause
    console.log('Step 1: Clearing data...')
    
    // First, let's count how many records we have
    const { count: initialCount } = await supabase
      .from('raw_sessions')
      .select('*', { count: 'exact', head: true })
    
    console.log(`Found ${initialCount} existing records`)
    
    // Now delete all records using a WHERE clause that matches all records
    const { data: deleteData, error: deleteError } = await supabase
      .from('raw_sessions')
      .delete()
      .gte('id', 0) // This WHERE clause will match all records since id is always >= 0
    
    if (deleteError) {
      console.error('Delete error:', deleteError)
      throw new Error(`Failed to clear data: ${deleteError.message}`)
    }
    
    console.log('Delete completed successfully')

    // Step 2: Simple insert without using .select()
    console.log('Step 2: Testing simple insert...')
    const testData = [{
      session_id: 'test-edge-' + Date.now(),
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

    console.log('Attempting insert with data:', testData)

    const { data: insertData, error: insertError } = await supabase
      .from('raw_sessions')
      .insert(testData)

    if (insertError) {
      console.error('Insert error:', insertError)
      console.error('Error details:', JSON.stringify(insertError, null, 2))
      throw new Error(`Insert failed: ${insertError.message}`)
    } else {
      console.log('Insert succeeded:', insertData)
    }

    // Step 3: Count records
    const { count: finalCount } = await supabase
      .from('raw_sessions')
      .select('*', { count: 'exact', head: true })

    console.log('Final count:', finalCount)

    return new Response(
      JSON.stringify({ 
        success: true,
        rows_processed: 1,
        total_rows: 1,
        test_mode: true,
        initial_count: initialCount,
        final_count: finalCount,
        message: 'Simple test completed successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in simple test:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred',
        test_mode: true,
        message: `Simple test failed: ${error.message}`
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