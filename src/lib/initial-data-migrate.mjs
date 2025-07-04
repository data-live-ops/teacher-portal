import { syncTeacherSchedules, syncPiketSchedules, syncKeywords, syncTeacherPageItems } from './sync-to-supabase.mjs';

async function runMigrations() {
    console.log(`Starting data migration...`);
    const migrations = [
        { name: 'Teacher Schedules', fn: syncTeacherSchedules },
        { name: 'Piket Schedules', fn: syncPiketSchedules },
        { name: 'Keywords', fn: syncKeywords },
        { name: 'Teacher Page Items', fn: syncTeacherPageItems }
    ];
    const results = [];

    for (const migration of migrations) {
        try {
            console.log(`Processing: ${migration.name}`);
            const result = await migration.fn();
            results.push({ name: migration.name, ...result })
        } catch (e) {
            console.error(`❌ ${migration.name} failed: ${e.message}`);
            results.push({ name: migration.name, success: false, error: e.message });
        }
    }

    console.log('\n📊 Migration Summary:');
    console.log('========================');
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const count = result.count ? `(${result.count} records)` : '';
        console.log(`${status} ${result.name} ${count}`);
        if (!result.success) {
            console.log(`   Error: ${result.error}`);
        }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n🎯 ${successCount}/${results.length} migrations completed successfully`);

}

runMigrations().catch(console.error);