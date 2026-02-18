
import { supabase } from "./supabaseClient";
import { decode } from 'base64-arraybuffer';

export class SupabaseStorageService {
    public static async uploadImage(bucket: string, path: string, base64Data: string, mimeType: string): Promise<string | null> {
        try {
            // Remove data:image/jpeg;base64, prefix if present
            const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

            if (!cleanBase64 || cleanBase64.length < 100) {
                console.error(`[STORAGE] ❌ Image data too small or empty for path: ${path} (length: ${cleanBase64.length})`);
                return null;
            }

            console.log(`[STORAGE] Uploading to bucket '${bucket}', path: '${path}' (${Math.round(cleanBase64.length / 1024)}KB)...`);

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, decode(cleanBase64), {
                    contentType: mimeType,
                    upsert: true
                });

            if (error) {
                console.error(`[STORAGE] ❌ Upload failed for ${bucket}/${path}:`, error.message, error.name);
                if (error.message.includes('Bucket not found')) {
                    console.error(`[STORAGE] 💡 Bucket '${bucket}' does not exist. Create it in Supabase Dashboard → Storage.`);
                }
                if (error.message.includes('row-level security') || error.message.includes('Unauthorized')) {
                    console.error(`[STORAGE] 💡 RLS or auth issue. Check that SUPABASE_SERVICE_ROLE_KEY is the service_role key, not the anon key.`);
                }
                return null;
            }

            // Return the public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            console.log(`[STORAGE] ✅ Uploaded successfully: ${publicUrl}`);
            return publicUrl;
        } catch (err: any) {
            console.error("[STORAGE] ❌ Upload exception:", err.message || err);
            return null;
        }
    }
}
