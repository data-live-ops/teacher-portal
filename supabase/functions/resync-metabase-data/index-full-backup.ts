import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Teacher name calibration mapping
function getActualNameTeacher(e: string): string {
  const teachers: { [key: string]: string } = {
    "Eka Damayanti": "Eka Kartika Damayanti",
    "Eva Limanta": "Eva Edina Limanta",
    "Indah": "Indah Permatasari",
    "Razieq Ilham Amali": "Razieq Ilham Amali",
    "Razieq Amali": "Razieq Ilham Amali",
    "Ulfatus Sa'adah Sumarna": "Ulfatus Saadah Sumarna",
    "Gracia Setyaputri": "Gracia Evelyn Setyaputri",
    "Farah Devi": "Farah Kusuma Devi",
    "Allifia Oktaviani":"Allifia Nindya Oktaviani",
    "Benedictus Kurniawan":"Benedictus Aditya Kurniawan",
    "Benedictus Aditya": "Benedictus Aditya Kurniawan",
    "Auryn Setiadi":"Auryn Sela Setiadi",
    "Egi Nurjanah":"Egi Annisa Nurjanah",
    "Mohamad Handri": "Mohamad Handri Tuloli",
    "Luthfi Suryadi": "Luthfi Yuliyanthi Suryadi",
    "Indah Mirantih": "Indah Islam Mirantih",
    "Dewi Lestari": "Dewi Kartini Lestari",
    "Yulia Sari": "Yulia Arum Sari",
    "Katherine Kosim": "Katherine Himawati Kosim",
    "Ulfatus Sumarna": "Ulfatus Saadah Sumarna",
    "Pranitha Budi": "Pranitha Septiana Budi",
    "Febri Sari": "Febri Rahmedia Sari",
    "Herdiana Amalia": "Herdiana Rizki Amalia",
    "Tansa A'Yuna": "Tansa Qurrota A'Yuna",
    "Indri Fatmi": "Indriyani Fatmi",
    "Windi Getti": "Windi Getti Nurasti Dewik",
    "Yunias Wati": "Yunias Sila Wati",
    "Alvito Idham": "Alvito Ahmad Cannavaro Idham",
    "Nabilah Fahrani": "Raden Nabilah Fahrani",
    "Asih Ningtias": "Asih Inpriawati Ningtias",
    "Nanda Jannah": "Nanda Nabila Al Jannah",
    "Freya Mertosono": "Freya Rana Mertosono",
    "Hana Baihaki": "Hana Wibawanty Baihaki",
    "Meilysa Putri": "Meilysa Ajeng Kartika Putri",
    "Nuratiqoh Nuratiqoh": "Nuratiqoh",
    "Victoria Yama": "Victoria Henniwuriyama",
    "Sinatrya Budikusuma": "Sinatrya Nisa Budikusuma",
    "Cut Intan": "Cut Zara Khalishah Intan",
    "Yufrida Nindya": "Yufrida Septi Nindya",
    "Alfi Supardi": "Alfi Fani Supardi",
    "Herdiana Rizki": "Herdiana Rizki Amalia",
    "Egi Annisa": "Egi Annisa Nurjanah",
    "Syifa Putri": "Syifa Fauziah Widyana Putri",
    "Zuhairia": "Zuhairia Zuhairia",
    "Tansa Yuna": "Tansa Qurrota Ayuna",
    "Alvito Idham": "Alvito Ahmad Cannavaro Idham"
  };

  return teachers[e] || e;
}

// Calibrate teacher names in the data
function calibrateTeacherNames(data: any[]): any[] {
  console.log('Starting teacher name calibration...');
  let calibrationCount = 0;

  const result = data.map((record, index) => {
    try {
      const calibratedRecord = { ...record };

      if (calibratedRecord.teacher_name) {
        const originalName = calibratedRecord.teacher_name;
        const actualName = getActualNameTeacher(originalName);

        calibratedRecord.teacher_name = actualName;

        if (originalName !== actualName) {
          console.log(`Record ${index}: "${originalName}" -> "${actualName}"`);
          calibrationCount++;
        }
      }

      return calibratedRecord;

    } catch (error) {
      console.error(`Error calibrating record ${index}:`, error);
      return record;
    }
  });

  console.log(`Teacher name calibration completed. ${calibrationCount} names calibrated out of ${data.length} records.`);
  return result;
}

// Transform function for Metabase data to raw_sessions format
function transformMetabaseData(data: any[]): any[] {
  console.log('Sample raw data:', data[0]); // Log first row to see structure
  
  // First calibrate teacher names
  const calibratedData = calibrateTeacherNames(data);
  
  return calibratedData.map(row => ({
    // Map field names - check exact field names from Metabase
    session_id: row.session_id || row.Session_ID || row['Session ID'] || '',
    subject: row.subject || row.Subject || '',
    session_topic: row.session_topic || row.Session_Topic || row['Session Topic'] || '',
    slot_name: row.slot_name || row.Slot_Name || row['Slot Name'] || '',
    teacher_name: row.teacher_name || row.Teacher_Name || row['Teacher Name'] || '',
    grade: row.grade || row.Grade || '',
    class_date: row.class_date || row.Class_Date || row['Class Date'] || null,
    class_time: row.class_time || row.Class_Time || row['Class Time'] || '',
    first_class_date: row.first_class_date || row.First_Class_Date || row['First Class Date'] || null,
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

    // Fetch data from Metabase question 3815 as JSON
    const dataResponse = await fetch(`${metabaseBaseUrl}api/card/3815/query/json`, {
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

    const jsonData = await dataResponse.json()
    console.log(`Received JSON data: ${jsonData.length} rows`)

    // Transform JSON data
    console.log('Transforming JSON data...')
    const transformedData = transformMetabaseData(jsonData)

    console.log(`Transformed to ${transformedData.length} valid rows`)

    if (transformedData.length === 0) {
      throw new Error('No valid data found after transformation')
    }

    // Clear existing data using RLS-safe function
    console.log('Clearing existing raw_sessions data...')
    const { data: truncateResult, error: truncateError } = await supabase.rpc('truncate_raw_sessions')
    
    if (truncateError) {
      console.error('Truncate error:', truncateError)
      throw new Error(`Failed to clear existing data: ${truncateError.message}`)
    }
    
    console.log('Truncate result:', truncateResult)

    // Insert new data using bulk insert function
    console.log('Inserting new data using bulk function...')
    const { data: insertResult, error: insertError } = await supabase.rpc(
      'bulk_insert_raw_sessions', 
      { data_json: transformedData }
    )
    
    let totalProcessed = 0
    let failedBatches = []
    
    if (insertError) {
      console.error('Bulk insert error, falling back to batch insert:', insertError)
      
      // Fallback to batch insert if bulk insert fails
      console.log('Using fallback batch insert method...')
      const batchSize = 500
      
      for (let i = 0; i < transformedData.length; i += batchSize) {
        const batch = transformedData.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        
        try {
          const { error: batchInsertError } = await supabase
            .from('raw_sessions')
            .insert(batch)
          
          if (batchInsertError) {
            console.error(`Batch ${batchNumber} insert error:`, batchInsertError)
            failedBatches.push({ batch: batchNumber, error: batchInsertError.message })
            continue
          }
          
          totalProcessed += batch.length
          console.log(`Processed batch ${batchNumber}: ${totalProcessed}/${transformedData.length} rows`)
          
        } catch (batchError) {
          console.error(`Batch ${batchNumber} unexpected error:`, batchError)
          failedBatches.push({ batch: batchNumber, error: batchError.message })
        }
      }
    } else {
      // Bulk insert succeeded
      totalProcessed = insertResult.inserted_rows || transformedData.length
      console.log('Bulk insert result:', insertResult)
    }

    console.log(`Successfully processed ${totalProcessed} rows`)
    
    // Prepare consistent response structure
    const responseData = {
      success: true,
      rows_processed: totalProcessed,
      total_rows: transformedData.length,
      failed_batches: failedBatches,
      calibration_applied: true,
      message: failedBatches.length > 0 
        ? `Partially successful. Processed ${totalProcessed} of ${transformedData.length} rows with teacher name calibration. ${failedBatches.length} batches failed.`
        : `Successfully processed ${totalProcessed} rows from Metabase question 3815 with teacher name calibration`
    };
    
    console.log('Sending response:', responseData);
    
    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in resync-metabase-data:', error)
    
    const errorResponse = {
      success: false,
      rows_processed: 0,
      total_rows: 0,
      error: error.message || 'Unknown error occurred',
      details: error.stack,
      message: `Resync failed: ${error.message || 'Unknown error occurred'}`
    };
    
    console.log('Sending error response:', errorResponse);
    
    return new Response(
      JSON.stringify(errorResponse),
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

// Helper SQL function to create if not exists
/*
CREATE OR REPLACE FUNCTION truncate_raw_sessions()
RETURNS void AS $$
BEGIN
  TRUNCATE TABLE raw_sessions RESTART IDENTITY;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/