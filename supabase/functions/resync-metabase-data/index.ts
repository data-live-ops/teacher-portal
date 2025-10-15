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
    "Allifia Oktaviani": "Allifia Nindya Oktaviani",
    "Benedictus Kurniawan": "Benedictus Aditya Kurniawan",
    "Benedictus Aditya": "Benedictus Aditya Kurniawan",
    "Auryn Setiadi": "Auryn Sela Setiadi",
    "Egi Nurjanah": "Egi Annisa Nurjanah",
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
  let calibrationCount = 0;

  const result = data.map((record, index) => {
    try {
      const calibratedRecord = { ...record };

      if (calibratedRecord.teacher_name) {
        const originalName = calibratedRecord.teacher_name;
        const actualName = getActualNameTeacher(originalName);

        calibratedRecord.teacher_name = actualName;

        if (originalName !== actualName) {
          calibrationCount++;
        }
      }

      return calibratedRecord;

    } catch (error) {
      console.error(`Error calibrating record ${index}:`, error);
      return record;
    }
  });

  return result;
}

function transformMetabaseData(data: any[]): any[] {
  console.log('Sample raw data:', data[0]);
  const calibratedData = calibrateTeacherNames(data);

  return calibratedData.map(row => {
    // Extract and clean grade value
    const gradeValue = row.grade || row.Grade || '';
    const cleanGrade = String(gradeValue).trim();

    // Extract and clean other fields
    const sessionId = (row.session_id || row.Session_ID || row['Session ID'] || '').toString().trim();

    return {
      session_id: sessionId,
      subject: row.subject || row.Subject || '',
      session_topic: row.session_topic || row.Session_Topic || row['Session Topic'] || '',
      slot_name: row.slot_name || row.Slot_Name || row['Slot Name'] || '',
      teacher_name: row.teacher_name || row.Teacher_Name || row['Teacher Name'] || '',
      grade: cleanGrade, // Already as string, will be handled by database
      class_date: row.class_date || row.Class_Date || row['Class Date'] || null,
      class_time: row.class_time || row.Class_Time || row['Class Time'] || '',
      first_class_date: row.first_class_date || row.First_Class_Date || row['First Class Date'] || null,
      day: row.day || row.Day || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }).filter(row => {
    // Filter out invalid rows
    const hasSessionId = row.session_id && row.session_id.trim() !== '';
    const hasValidGrade = row.grade && row.grade.trim() !== '';

    if (!hasSessionId) {
      console.log('Skipping row: missing session_id');
      return false;
    }

    if (!hasValidGrade) {
      console.log(`Skipping row ${row.session_id}: missing or empty grade`);
      return false;
    }

    return true;
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting Metabase data resync...')

    const metabaseBaseUrl = Deno.env.get('METABASE_BASE_URL')
    const metabaseUsername = Deno.env.get('METABASE_USERNAME')
    const metabasePassword = Deno.env.get('METABASE_PASSWORD')

    if (!metabaseBaseUrl || !metabaseUsername || !metabasePassword) {
      throw new Error('Missing Metabase environment variables')
    }

    console.log('Authenticating with Metabase...')
    const authResponse = await fetch(`${metabaseBaseUrl}api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    console.log('Transforming JSON data...')
    const transformedData = transformMetabaseData(jsonData)
    console.log(`Transformed to ${transformedData.length} valid rows`)

    if (transformedData.length === 0) {
      throw new Error('No valid data found after transformation')
    }

    // === NEW APPROACH: Direct Insert with Trigger Disabled ===

    console.log('Step 1: Disabling trigger...')
    const { error: disableTriggerError } = await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE raw_sessions DISABLE TRIGGER sync_raw_session_trigger'
    })

    // Fallback: Jika execute_sql tidak ada, kita langsung insert (trigger akan jalan)
    const triggerDisabled = !disableTriggerError

    console.log('Step 2: Clearing raw_sessions...')
    const { error: deleteRawError } = await supabase
      .from('raw_sessions')
      .delete()
      .neq('id', 0) // Delete all rows

    if (deleteRawError) {
      console.error('Delete raw_sessions error:', deleteRawError)
      throw new Error(`Failed to clear raw_sessions: ${deleteRawError.message}`)
    }

    console.log('Step 3: Inserting to raw_sessions in batches...')
    const batchSize = 500
    let totalInserted = 0

    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1

      const { error: insertError } = await supabase
        .from('raw_sessions')
        .insert(batch)

      if (insertError) {
        console.error(`Batch ${batchNumber} insert error:`, insertError)
        throw new Error(`Batch ${batchNumber} failed: ${insertError.message}`)
      }

      totalInserted += batch.length
      console.log(`Inserted batch ${batchNumber}: ${totalInserted}/${transformedData.length} rows`)
    }

    console.log('Step 4: Re-enabling trigger and syncing to class_schedules...')

    if (triggerDisabled) {
      // Re-enable trigger
      await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE raw_sessions ENABLE TRIGGER sync_raw_session_trigger'
      })
    }

    // Clear and resync class_schedules
    console.log('Step 5: Clearing class_schedules...')
    const { error: deleteClassError } = await supabase
      .from('class_schedules')
      .delete()
      .neq('id', 0)

    if (deleteClassError) {
      console.error('Delete class_schedules error:', deleteClassError)
    }

    console.log('Step 6: Syncing to class_schedules via SQL function...')
    const { error: syncError } = await supabase.rpc('sync_all_raw_sessions_to_class_schedules')

    if (syncError) {
      console.error('Sync error:', syncError)
      // Continue even if sync fails - we'll check counts
    }

    // Verify final counts
    console.log('Step 7: Verifying data...')
    const { count: rawCount } = await supabase
      .from('raw_sessions')
      .select('*', { count: 'exact', head: true })

    const { count: classCount } = await supabase
      .from('class_schedules')
      .select('*', { count: 'exact', head: true })

    console.log(`Final counts: raw_sessions=${rawCount}, class_schedules=${classCount}`)

    const responseData = {
      success: true,
      rows_processed: totalInserted,
      total_rows: transformedData.length,
      raw_sessions_count: rawCount || 0,
      class_schedules_count: classCount || 0,
      calibration_applied: true,
      message: `Successfully processed ${totalInserted} rows. Raw sessions: ${rawCount}, Class schedules: ${classCount}`
    }

    console.log('Sending response:', responseData)

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
    }

    console.log('Sending error response:', errorResponse)

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