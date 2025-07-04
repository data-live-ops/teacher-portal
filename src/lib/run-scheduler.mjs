import dotenv from 'dotenv';
import { triggerManualSync } from './auto-sync.mjs';

dotenv.config();

const isManual = process.argv.includes('--manual') || process.argv.includes('-m');

if (isManual) {
    console.log('🔧 Running manual sync...');

    triggerManualSync()
        .then(() => {
            console.log('✅ Manual sync completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Manual sync failed:', error);
            process.exit(1);
        });
} else {
    import('./auto-sync.mjs')
        .then(() => {
            console.log('🚀 Scheduler is running...');
        })
        .catch((error) => {
            console.error('❌ Failed to start scheduler:', error);
            process.exit(1);
        });
}