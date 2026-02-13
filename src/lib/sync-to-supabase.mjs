import dotenv from 'dotenv'
import { retrieveQuestionMetabase } from './connect-to-metabase.mjs';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_KEY
);

async function insertToSupabase(table, data) {
    const { error, status } = await supabase.from(table).insert(data);
    if (error) throw new Error(error.message);
    console.info(`Insertation Success to ${table}: ${status}`);
}

async function syncTable(fileName, fileUrl) {
    try {
        console.log(`start inserting data to ${fileName}...`);
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`)
        };

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error(`Expected data is in array`)
        }

        const { error: deleteError } = await supabase
            .from(fileName)
            .delete()
            .gte('created_at', '1900-01-01');

        if (deleteError) {
            throw new Error(`Failed to clear records on ${fileName}: ${deleteError.message}`)
        }

        const { error: insertError, status } = await supabase
            .from(fileName)
            .insert(data);

        if (insertError) console.error(`Failed to insert records to ${fileName}: ${insertError.message}`);
        console.info(`Insertation Success to ${fileName}: ${status}`);

    } catch (e) {
        console.error(`Sync ${fileName} error: ${e.message}`);
        throw new Error(e)
    }
}

const transformMetabaseData = (data) => {
    return data.map(item => {
        return {
            user_id: item.id,
            first_name: item.first_name,
            last_name: item.last_name,
            email: item.email,
            url: item.avatar_img,
            gender: item.gender
        };
    });
};

const parseCSV = (csv) => {
    const [headerLine, ...lines] = csv.trim().split('\n');
    const headers = headerLine.split(',');
    return lines.map(line => {
        const values = line.split(',');
        return headers.reduce((obj, key, idx) => {
            obj[key] = values[idx];
            return obj;
        }, {});
    });
};

export async function syncTeacherSchedules() {
    return syncTable('teacher_schedules', process.env.REACT_APP_TEACHER_SCHEDULES);
};

export async function syncPiketSchedules() {
    try {
        const response = await fetch(process.env.REACT_APP_PIKET_SCHEDULES);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`)
        };

        const piketData = await response.json();
        if (!Array.isArray(piketData)) {
            throw new Error(`Expected data is in array`)
        }

        const { data: teacherSchedules } = await supabase
            .from('teacher_schedules')
            .select('teacher_email, day, first_class_date')
            .not('first_class_date', 'is', null);

        const firstClassDateMap = {};
        if (teacherSchedules) {
            teacherSchedules.forEach(schedule => {
                const key = schedule.teacher_email;
                const currentDate = firstClassDateMap[key];
                const newDate = new Date(schedule.first_class_date);

                if (!currentDate || newDate < new Date(currentDate)) {
                    firstClassDateMap[key] = schedule.first_class_date;
                }
            });
        }

        const { error: deleteError } = await supabase
            .from('piket_schedule')
            .delete()
            .gte('created_at', '1900-01-01');

        if (deleteError) {
            throw new Error(`Failed to clear piket_schedule: ${deleteError.message}`)
        }

        const enrichedPiketData = piketData.map(piket => {
            const key = piket.email;
            return {
                ...piket,
                first_class_date: firstClassDateMap[key] || null
            };
        });

        const { error: insertError, status } = await supabase
            .from('piket_schedule')
            .insert(enrichedPiketData);

        if (insertError) console.error(`Failed to insert piket_schedule: ${insertError.message}`);
        console.info(`Insertation Success to piket_schedule: ${status}`);

    } catch (e) {
        console.error(`Sync piket_schedule error: ${e.message}`);
        throw new Error(e)
    }
}

export async function syncTeacherPageItems() {
    return syncTable('file_links', process.env.REACT_APP_CATEGORIES);
};

export async function syncKeywords() {
    return syncTable('keywords', process.env.REACT_APP_KEYWORDS);
};

export async function syncTeacherAvatar() {
    try {
        const rawData = await retrieveQuestionMetabase(3960);
        const transformedData = transformMetabaseData(parseCSV(rawData));
        await supabase.from('avatars').delete().gte('created_at', '1900-01-01');
        return insertToSupabase('avatars', transformedData);
    }
    catch (e) {
        console.error(`Sync teacher avatar error: ${e.message}`);
        throw new Error(e);
    }
}

// =============================================
// In Class Assessment (ICA) Sync Functions
// =============================================

/**
 * Parse CSV with proper handling of quoted fields containing commas
 */
const parseCSVAdvanced = (csv) => {
    const lines = csv.trim().split('\n');
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        return headers.reduce((obj, key, idx) => {
            obj[key.trim()] = values[idx]?.trim() || '';
            return obj;
        }, {});
    });
};

/**
 * Parse a single CSV line handling quoted fields
 */
const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result.map(val => val.replace(/^"|"$/g, '').trim());
};

/**
 * Sync ICA Answer Keys from Metabase Question 4288
 * Stores answer keys for determining understanding types
 */
export async function syncICAAnswerKeys() {
    try {
        console.log('📊 Starting ICA Answer Keys sync from Metabase Q4288...');

        const rawData = await retrieveQuestionMetabase(4288);
        const parsedData = parseCSVAdvanced(rawData);

        console.log(`📝 Parsed ${parsedData.length} answer key records`);

        // Transform data to match table schema
        const transformedData = parsedData.map(item => ({
            question_id: item.question_id || '',
            reference_id: item.reference_id || '',
            options: item.options || '',
            ic_correct: item.ic_correct || '',
            student_answer_option: item.student_answer_option || '',
            understanding_types: item.understanding_types || ''
        }));

        // Clear existing data
        const { error: deleteError } = await supabase
            .from('ica_answer_keys')
            .delete()
            .gte('created_at', '1900-01-01');

        if (deleteError) {
            throw new Error(`Failed to clear ica_answer_keys: ${deleteError.message}`);
        }

        // Insert in batches of 1000
        const batchSize = 1000;
        for (let i = 0; i < transformedData.length; i += batchSize) {
            const batch = transformedData.slice(i, i + batchSize);
            const { error: insertError } = await supabase
                .from('ica_answer_keys')
                .insert(batch);

            if (insertError) {
                console.error(`Failed to insert batch ${i}-${i + batch.length}:`, insertError.message);
            } else {
                console.log(`✅ Inserted batch ${i}-${i + batch.length}`);
            }
        }

        console.log(`✅ ICA Answer Keys sync completed: ${transformedData.length} records`);
        return { success: true, count: transformedData.length };
    }
    catch (e) {
        console.error(`❌ Sync ICA Answer Keys error: ${e.message}`);
        throw new Error(e);
    }
}

/**
 * Sync ICA Student Data from Metabase Question 4289
 * Enriches with understanding_types based on answer keys
 */
export async function syncICAStudentData() {
    try {
        console.log('📊 Starting ICA Student Data sync from Metabase Q4289...');

        // Step 1: Fetch student data from Metabase
        const rawData = await retrieveQuestionMetabase(4289);
        const parsedData = parseCSVAdvanced(rawData);

        console.log(`📝 Parsed ${parsedData.length} student assessment records`);

        // Step 2: Fetch answer keys from Supabase for lookup
        const { data: answerKeys, error: akError } = await supabase
            .from('ica_answer_keys')
            .select('reference_id, options, understanding_types');

        if (akError) {
            throw new Error(`Failed to fetch answer keys: ${akError.message}`);
        }

        // Create lookup map: reference_id + options -> understanding_types
        const answerKeyMap = new Map();
        answerKeys.forEach(ak => {
            const key = `${ak.reference_id}|${ak.options}`;
            answerKeyMap.set(key, ak.understanding_types);
        });

        console.log(`📚 Loaded ${answerKeys.length} answer keys for lookup`);

        // Step 3: Transform and enrich data
        const transformedData = parsedData.map(item => {
            const referenceId = item.reference_id || '';
            const studentAnswers = item.student_answers || '';

            // Lookup understanding_types
            const lookupKey = `${referenceId}|${studentAnswers}`;
            let understandingTypes = answerKeyMap.get(lookupKey);

            // If not found in answer keys, mark as "No Attempt"
            if (!understandingTypes && studentAnswers) {
                understandingTypes = 'No Attempt';
            } else if (!understandingTypes) {
                understandingTypes = 'No Attempt';
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
            };
        });

        // Step 4: Update students roster (for ABSENT detection)
        const studentsRoster = new Map();
        transformedData.forEach(item => {
            const key = `${item.user_id}|${item.grade_list}|${item.slot_name}`;
            if (!studentsRoster.has(key)) {
                studentsRoster.set(key, {
                    user_id: item.user_id,
                    student_name: item.student_name,
                    grade_list: item.grade_list,
                    slot_name: item.slot_name
                });
            }
        });

        // Clear and insert roster
        await supabase
            .from('ica_students_roster')
            .delete()
            .gte('created_at', '1900-01-01');

        const rosterData = Array.from(studentsRoster.values());
        if (rosterData.length > 0) {
            const { error: rosterError } = await supabase
                .from('ica_students_roster')
                .insert(rosterData);

            if (rosterError) {
                console.error(`Failed to insert roster: ${rosterError.message}`);
            } else {
                console.log(`✅ Inserted ${rosterData.length} students to roster`);
            }
        }

        // Step 5: Clear existing assessment data
        const { error: deleteError } = await supabase
            .from('ica_student_assessments')
            .delete()
            .gte('created_at', '1900-01-01');

        if (deleteError) {
            throw new Error(`Failed to clear ica_student_assessments: ${deleteError.message}`);
        }

        // Step 6: Insert in batches
        const batchSize = 1000;
        for (let i = 0; i < transformedData.length; i += batchSize) {
            const batch = transformedData.slice(i, i + batchSize);
            const { error: insertError } = await supabase
                .from('ica_student_assessments')
                .insert(batch);

            if (insertError) {
                console.error(`Failed to insert batch ${i}-${i + batch.length}:`, insertError.message);
            } else {
                console.log(`✅ Inserted batch ${i}-${i + batch.length}`);
            }
        }

        console.log(`✅ ICA Student Data sync completed: ${transformedData.length} records`);
        return { success: true, count: transformedData.length, rosterCount: rosterData.length };
    }
    catch (e) {
        console.error(`❌ Sync ICA Student Data error: ${e.message}`);
        throw new Error(e);
    }
}

/**
 * Sync all ICA data (answer keys first, then student data)
 */
export async function syncAllICAData() {
    try {
        console.log('🚀 Starting full ICA data sync...');

        // Sync answer keys first
        const akResult = await syncICAAnswerKeys();

        // Then sync student data (which depends on answer keys)
        const sdResult = await syncICAStudentData();

        console.log('✅ Full ICA sync completed successfully');
        return {
            success: true,
            answerKeys: akResult.count,
            studentAssessments: sdResult.count,
            studentsRoster: sdResult.rosterCount
        };
    }
    catch (e) {
        console.error(`❌ Full ICA sync error: ${e.message}`);
        throw new Error(e);
    }
}