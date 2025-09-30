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

    // Test 1: Clear existing data
    console.log('Step 1: Clearing data...')
    const { data: truncateResult, error: truncateError } = await supabase.rpc('truncate_raw_sessions')
    
    if (truncateError) {
      console.error('Truncate error:', truncateError)
      throw new Error(`Failed to clear data: ${truncateError.message}`)
    }
    
    console.log('Truncate result:', truncateResult)

    // Test 2: Simple insert without using .select()
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
      
      // Try alternative: direct SQL insert
      console.log('Trying alternative SQL insert...')
      const { data: sqlResult, error: sqlError } = await supabase
        .rpc('direct_insert_test')
      
      if (sqlError) {
        console.error('SQL insert also failed:', sqlError)
        throw new Error(`Both insert methods failed. Insert error: ${insertError.message}, SQL error: ${sqlError.message}`)
      } else {
        console.log('SQL insert succeeded:', sqlResult)
      }
    } else {
      console.log('Insert succeeded:', insertData)
    }

    console.log('Insert result:', insertData)

    // Test 3: Count records
    const { data: countData, error: countError } = await supabase
      .from('raw_sessions')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Count error:', countError)
      throw new Error(`Failed to count records: ${countError.message}`)
    }

    console.log('Final count:', countData)

    return new Response(
      JSON.stringify({ 
        success: true,
        rows_processed: 1,
        total_rows: 1,
        test_mode: true,
        truncate_result: truncateResult,
        insert_result: insertData,
        final_count: countData,
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