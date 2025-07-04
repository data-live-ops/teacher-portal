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