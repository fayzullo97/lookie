
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase credentials in environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

// Warn if anon key is used instead of service_role key
try {
    const payload = JSON.parse(Buffer.from(supabaseServiceRoleKey.split('.')[1], 'base64').toString());
    if (payload.role === 'anon') {
        console.error("⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY contains the ANON key, not the service_role key!");
        console.error("⚠️ This will cause all DB operations to fail if RLS is enabled.");
        console.error("⚠️ Go to Supabase Dashboard → Settings → API → Copy the 'service_role' key.");
    } else {
        console.log(`✅ Supabase key role: ${payload.role}`);
    }
} catch {
    console.warn("Could not decode Supabase key to verify role.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    }
});
