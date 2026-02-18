
import { supabase } from "./supabaseClient";
import { decode } from 'base64-arraybuffer';

export class SupabaseStorageService {
    public static async uploadImage(bucket: string, path: string, base64Data: string, mimeType: string): Promise<{ url: string | null, error: string | null }> {
        try {
            // Remove data:image/jpeg;base64, prefix if present
            const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

            if (!cleanBase64 || cleanBase64.length < 100) {
                const msg = `Image data too small (len=${cleanBase64?.length})`;
                console.error(`[STORAGE] ❌ ${msg}`);
                return { url: null, error: msg };
            }

            console.log(`[STORAGE] Uploading to bucket '${bucket}', path: '${path}'...`);

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, decode(cleanBase64), {
                    contentType: mimeType,
                    upsert: true
                });

            if (error) {
                console.error(`[STORAGE] ❌ Upload failed:`, error.message);
                let userError = `Upload failed: ${error.message}`;
                if (error.message.includes('Bucket not found')) userError += " (Check Supabase Dashboard)";
                if (error.message.includes('security')) userError += " (Check .env Key)";
                return { url: null, error: userError };
            }

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            console.log(`[STORAGE] ✅ Uploaded: ${publicUrl}`);
            return { url: publicUrl, error: null };
        } catch (err: any) {
            console.error("[STORAGE] ❌ Exception:", err.message);
            return { url: null, error: err.message || "Unknown storage error" };
        }
    }
}
