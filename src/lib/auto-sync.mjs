import cron from 'node-cron';
import { syncTeacherSchedules, syncPiketSchedules, syncKeywords, syncTeacherPageItems, syncTeacherAvatar } from './sync-to-supabase.mjs';

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const emoji = {
        'info': '💡',
        'success': '✅',
        'error': '❌',
        'start': '🚀',
        'sync': '🔄'
    }[type] || '📝';

    console.log(`[${timestamp}] ${emoji} ${message}`);
}

async function syncTable(tableName, syncFunction) {
    try {
        log(`Starting sync: ${tableName}`, 'sync');
        await syncFunction();
    } catch (error) {
        log(`${tableName} sync error: ${error.message}`, 'error');
        return { table: tableName, success: false, error: error.message };
    }
}

async function runAutoSync(withAvatar = false) {
    log('=== AUTO SYNC STARTED ===', 'start');

    const syncTasks = [
        { name: 'Teacher Schedules', fn: syncTeacherSchedules },
        { name: 'Keywords', fn: syncKeywords },
        { name: 'Teacher Page Items', fn: syncTeacherPageItems }
    ];

    if (withAvatar) {
        syncTasks.push({ name: 'Teacher Avatar', fn: syncTeacherAvatar });
    }

    const startTime = Date.now();

    for (const task of syncTasks) {
        await syncTable(task.name, task.fn);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('=== SYNC SUMMARY ===', 'info');
    log(`Duration: ${duration}s`, 'info');

    log('=== AUTO SYNC COMPLETED ===', 'success');
}

console.log('🚀 Setting up cron jobs...');

cron.schedule('*/15 * * * *', async () => {
    await runAutoSync(false);
}, {
    scheduled: true,
    timezone: "Asia/Jakarta"
});

cron.schedule('0 1 * * 0', async () => {
    log('Weekly avatar sync started', 'start');
    await runAutoSync(true);
}, {
    scheduled: true,
    timezone: "Asia/Jakarta"
});

async function triggerManualSync() {
    log('Manual sync triggered', 'start');
    return await runAutoSync(true);
}

export { triggerManualSync };

// Graceful shutdown
process.on('SIGINT', () => {
    log('Shutting down auto-sync scheduler...', 'info');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Shutting down auto-sync scheduler...', 'info');
    process.exit(0);
});

log('Auto-sync scheduler started successfully!', 'start');
log('Current schedule: Regular tables every 15 minutes, avatars weekly (Sunday 01:00)', 'info');
log('Timezone: Asia/Jakarta', 'info');
log('Press Ctrl+C to stop', 'info');