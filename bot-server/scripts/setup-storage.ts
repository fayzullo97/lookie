
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from bot-server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in bot-server/.env");
    process.exit(1);
}

// Check key role
try {
    const payload = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64').toString());
    if (payload.role !== 'service_role') {
        console.error("❌ ERROR: Your SUPABASE_SERVICE_ROLE_KEY is the 'anon' key!");
        console.error("   You MUST use the 'service_role' key to create buckets.");
        console.error("   Go to Supabase Dashboard → Settings → API to get it.");
        process.exit(1);
    }
} catch (e) {
    console.warn("⚠️ Could not verify key role (invalid JWT format?)");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createBucket(name: string) {
    console.log(`\nChecking bucket '${name}'...`);
    const { data: bucket, error } = await supabase.storage.getBucket(name);

    if (error && error.message.includes('not found')) {
        console.log(`   Bucket not found. Creating '${name}'...`);
        const { data, error: createErr } = await supabase.storage.createBucket(name, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png']
        });

        if (createErr) {
            console.error(`   ❌ Failed to create bucket:`, createErr.message);
        } else {
            console.log(`   ✅ Bucket '${name}' created successfully!`);
        }
    } else if (bucket) {
        console.log(`   ✅ Bucket '${name}' already exists.`);
        // Ensure public
        if (!bucket.public) {
            console.log(`   ⚠️ Bucket is private. Updating to public...`);
            await supabase.storage.updateBucket(name, { public: true });
            console.log(`   ✅ Updated to public.`);
        }
    } else {
        console.error(`   ❌ Error checking bucket:`, error?.message);
    }
}

async function main() {
    console.log("🛠️  Setting up Supabase Storage...");
    await createBucket('user-uploads');
    await createBucket('generated-results');
    console.log("\nDone!");
}

main();
