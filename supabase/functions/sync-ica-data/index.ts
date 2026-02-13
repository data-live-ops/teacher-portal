import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Parse CSV with proper handling of quoted fields
function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n')
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const obj: { [key: string]: string } = {}
    headers.forEach((header, idx) => {
      obj[header.trim()] = values[idx]?.trim() || ''
    })
    return obj
  })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result.map(val => val.replace(/^"|"$/g, '').trim())
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

    console.log('Starting ICA data sync...')

    const metabaseBaseUrl = Deno.env.get('METABASE_BASE_URL')
    const metabaseUsername = Deno.env.get('METABASE_USERNAME')
    const metabasePassword = Deno.env.get('METABASE_PASSWORD')

    if (!metabaseBaseUrl || !metabaseUsername || !metabasePassword) {
      throw new Error('Missing Metabase environment variables')
    }

    // Step 1: Authenticate with Metabase
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
    console.log('Metabase authentication successful')

    // Step 2: Fetch Answer Keys (Question 4288)
    console.log('Fetching Answer Keys from Metabase question 4288...')
    const answerKeysResponse = await fetch(`${metabaseBaseUrl}api/card/4288/query/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Metabase-Session': sessionToken
      }
    })

    if (!answerKeysResponse.ok) {
      const errorText = await answerKeysResponse.text()
      throw new Error(`Metabase answer keys fetch failed: ${answerKeysResponse.status} - ${errorText}`)
    }

    const answerKeysCSV = await answerKeysResponse.text()
    const answerKeysData = parseCSV(answerKeysCSV)
    console.log(`Received ${answerKeysData.length} answer key records`)

    // Transform answer keys
    const transformedAnswerKeys = answerKeysData.map(item => ({
      question_id: item.question_id || '',
      reference_id: item.reference_id || '',
      options: item.options || '',
      ic_correct: item.ic_correct || '',
      student_answer_option: item.student_answer_option || '',
      understanding_types: item.understanding_types || ''
    }))

    // Step 3: Clear and insert answer keys
    console.log('Clearing ica_answer_keys table...')
    const { error: deleteAKError } = await supabase
      .from('ica_answer_keys')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteAKError) {
      console.error('Delete answer keys error:', deleteAKError)
    }

    console.log('Inserting answer keys...')
    const batchSize = 1000
    let answerKeysInserted = 0

    for (let i = 0; i < transformedAnswerKeys.length; i += batchSize) {
      const batch = transformedAnswerKeys.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('ica_answer_keys')
        .insert(batch)

      if (insertError) {
        console.error(`Answer keys batch ${i}-${i + batch.length} error:`, insertError)
      } else {
        answerKeysInserted += batch.length
        console.log(`Inserted answer keys batch: ${answerKeysInserted}/${transformedAnswerKeys.length}`)
      }
    }

    // Step 4: Fetch Student Data (Question 4289)
    console.log('Fetching Student Data from Metabase question 4289...')
    const studentDataResponse = await fetch(`${metabaseBaseUrl}api/card/4289/query/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Metabase-Session': sessionToken
      }
    })

    if (!studentDataResponse.ok) {
      const errorText = await studentDataResponse.text()
      throw new Error(`Metabase student data fetch failed: ${studentDataResponse.status} - ${errorText}`)
    }

    const studentDataCSV = await studentDataResponse.text()
    const studentDataRaw = parseCSV(studentDataCSV)
    console.log(`Received ${studentDataRaw.length} student data records`)

    // Step 5: Create answer keys lookup map
    console.log('Creating answer keys lookup map...')
    const answerKeyMap = new Map<string, string>()
    transformedAnswerKeys.forEach(ak => {
      const key = `${ak.reference_id}|${ak.options}`
      answerKeyMap.set(key, ak.understanding_types)
    })

    // Step 6: Transform and enrich student data
    console.log('Transforming and enriching student data...')
    const transformedStudentData = studentDataRaw.map(item => {
      const referenceId = item.reference_id || ''
      const studentAnswers = item.student_answers || ''

      // Lookup understanding_types
      const lookupKey = `${referenceId}|${studentAnswers}`
      let understandingTypes = answerKeyMap.get(lookupKey)

      if (!understandingTypes) {
        understandingTypes = 'No Attempt'
      }

      return {
        reference_id: referenceId,
        user_id: item.user_id || '',
        student_name: item.student_name || '',
        grade_list: item.grade_list || '',
        slot_name: item.slot_name || '',
        session_date: item.session_date || null,
        question_id: item.questid || item.question_id || '',
        student_answers: studentAnswers,
        understanding_types: understandingTypes
      }
    })

    // Step 7: Build and insert students roster
    console.log('Building students roster...')
    const studentsRosterMap = new Map<string, any>()
    transformedStudentData.forEach(item => {
      const key = `${item.user_id}|${item.grade_list}|${item.slot_name}`
      if (!studentsRosterMap.has(key)) {
        studentsRosterMap.set(key, {
          user_id: item.user_id,
          student_name: item.student_name,
          grade_list: item.grade_list,
          slot_name: item.slot_name
        })
      }
    })

    const rosterData = Array.from(studentsRosterMap.values())

    // Clear and insert roster
    console.log('Clearing ica_students_roster table...')
    await supabase
      .from('ica_students_roster')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (rosterData.length > 0) {
      console.log(`Inserting ${rosterData.length} roster records...`)
      for (let i = 0; i < rosterData.length; i += batchSize) {
        const batch = rosterData.slice(i, i + batchSize)
        const { error: rosterError } = await supabase
          .from('ica_students_roster')
          .insert(batch)

        if (rosterError) {
          console.error(`Roster batch error:`, rosterError)
        }
      }
    }

    // Step 8: Clear and insert student assessments
    console.log('Clearing ica_student_assessments table...')
    const { error: deleteSDError } = await supabase
      .from('ica_student_assessments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteSDError) {
      console.error('Delete student data error:', deleteSDError)
    }

    console.log('Inserting student assessments...')
    let studentDataInserted = 0

    for (let i = 0; i < transformedStudentData.length; i += batchSize) {
      const batch = transformedStudentData.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('ica_student_assessments')
        .insert(batch)

      if (insertError) {
        console.error(`Student data batch ${i}-${i + batch.length} error:`, insertError)
      } else {
        studentDataInserted += batch.length
        console.log(`Inserted student data batch: ${studentDataInserted}/${transformedStudentData.length}`)
      }
    }

    // Step 9: Verify counts
    console.log('Verifying data counts...')
    const { count: akCount } = await supabase
      .from('ica_answer_keys')
      .select('*', { count: 'exact', head: true })

    const { count: sdCount } = await supabase
      .from('ica_student_assessments')
      .select('*', { count: 'exact', head: true })

    const { count: rosterCount } = await supabase
      .from('ica_students_roster')
      .select('*', { count: 'exact', head: true })

    console.log(`Final counts: answer_keys=${akCount}, student_assessments=${sdCount}, roster=${rosterCount}`)

    const responseData = {
      success: true,
      answerKeysCount: akCount || answerKeysInserted,
      studentDataCount: sdCount || studentDataInserted,
      rosterCount: rosterCount || rosterData.length,
      message: `ICA sync completed. Answer Keys: ${akCount}, Student Data: ${sdCount}, Roster: ${rosterCount}`
    }

    console.log('ICA sync completed successfully:', responseData)

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
    console.error('Error in sync-ica-data:', error)

    const errorResponse = {
      success: false,
      answerKeysCount: 0,
      studentDataCount: 0,
      rosterCount: 0,
      error: error.message || 'Unknown error occurred',
      message: `ICA sync failed: ${error.message || 'Unknown error occurred'}`
    }

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
