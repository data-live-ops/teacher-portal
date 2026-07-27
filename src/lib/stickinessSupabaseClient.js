import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_STICKINESS_SUPABASE_URL;
const key = process.env.REACT_APP_STICKINESS_SUPABASE_KEY;

export const stickinessSupabase = createClient(url, key);
