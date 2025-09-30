import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// CSV parsing function
function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const data = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // Simple CSV parsing - handle quoted fields
    const values = []
    let current = ''
    let inQuotes = false
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim()) // Last value
    
    if (values.length === headers.length) {
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || null
      })
      data.push(row)
    }
  }
  
  return data
}

// Transform function for Metabase data to raw_sessions format
function transformMetabaseData(data: any[]): any[] {
  return data.map(row => ({
    session_id: row.session_id || row.Session_ID || '',
    subject: row.subject || row.Subject || '',
    session_topic: row.session_topic || row.Session_Topic || '',
    slot_name: row.slot_name || row.Slot_Name || '',
    teacher_name: row.teacher_name || row.Teacher_Name || '',
    grade: row.grade || row.Grade || '',
    class_date: row.class_date || row.Class_Date || null,
    class_time: row.class_time || row.Class_Time || '',
    first_class_date: row.first_class_date || row.First_Class_Date || null,
    day: row.day || row.Day || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })).filter(row => row.session_id && row.session_id.trim() !== '')
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting Metabase data resync...')

    // Get Metabase credentials from environment
    const metabaseBaseUrl = Deno.env.get('METABASE_BASE_URL')
    const metabaseUsername = Deno.env.get('METABASE_USERNAME')
    const metabasePassword = Deno.env.get('METABASE_PASSWORD')

    if (!metabaseBaseUrl || !metabaseUsername || !metabasePassword) {
      throw new Error('Missing Metabase environment variables')
    }

    // Authenticate with Metabase
    console.log('Authenticating with Metabase...')
    const authResponse = await fetch(`${metabaseBaseUrl}api/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: metabaseUsername,
        password: metabasePassword
      })
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      throw new Error(`Metabase authentication failed: ${authResponse.status} - ${errorText}`)
    }

    const authData = await authResponse.json()
    const sessionToken = authData.id

    console.log('Fetching data from Metabase question 3815...')

    // Fetch data from Metabase question 3815
    const dataResponse = await fetch(`${metabaseBaseUrl}api/card/3815/query/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Metabase-Session': sessionToken
      }
    })

    if (!dataResponse.ok) {
      const errorText = await dataResponse.text()
      throw new Error(`Metabase data fetch failed: ${dataResponse.status} - ${errorText}`)
    }

    const csvData = await dataResponse.text()
    console.log(`Received CSV data: ${csvData.length} characters`)

    // Parse and transform CSV data
    console.log('Parsing and transforming CSV data...')
    const parsedData = parseCSV(csvData)
    const transformedData = transformMetabaseData(parsedData)

    console.log(`Parsed ${parsedData.length} rows, transformed to ${transformedData.length} valid rows`)

    if (transformedData.length === 0) {
      throw new Error('No valid data found after transformation')
    }

    // Clear existing data
    console.log('Clearing existing raw_sessions data...')
    const { error: deleteError } = await supabase
      .from('raw_sessions')
      .delete()
      .neq('id', 0)

    if (deleteError) {
      throw new Error(`Failed to clear existing data: ${deleteError.message}`)
    }

    // Insert new data in batches
    console.log('Inserting new data...')
    const batchSize = 100
    let totalProcessed = 0
    
    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('raw_sessions')
        .insert(batch)
      
      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`Failed to insert batch ${i / batchSize + 1}: ${insertError.message}`)
      }
      
      totalProcessed += batch.length
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}: ${totalProcessed}/${transformedData.length} rows`)
    }

    console.log(`Successfully processed ${totalProcessed} rows`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        rows_processed: totalProcessed,
        message: `Successfully processed ${totalProcessed} rows from Metabase question 3815`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in resync-metabase-data:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred'
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