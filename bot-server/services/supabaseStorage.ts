
import { supabase } from "./supabaseClient";
import { decode } from 'base64-arraybuffer';

export class SupabaseStorageService {
    public static async uploadImage(bucket: string, path: string, base64Data: string, mimeType: string, retries = 2): Promise<{ url: string | null, error: string | null }> {
        try {
            // Remove data:image/jpeg;base64, prefix if present
            const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

            if (!cleanBase64 || cleanBase64.length < 100) {
                const msg = `Image data too small (len=${cleanBase64?.length})`;
                console.error(`[STORAGE] ❌ ${msg}`);
                return { url: null, error: msg };
            }

            console.log(`[STORAGE] Uploading to bucket '${bucket}', path: '${path}'...`);

            const uploadTask = async () => {
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .upload(path, decode(cleanBase64), {
                        contentType: mimeType,
                        upsert: true
                    });

                if (error) throw error;
                return data;
            };

            let lastError: any = null;
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const data = await uploadTask();
                    const { data: { publicUrl } } = supabase.storage
                        .from(bucket)
                        .getPublicUrl(data.path);

                    console.log(`[STORAGE] ✅ Uploaded on attempt ${attempt + 1}: ${publicUrl}`);
                    return { url: publicUrl, error: null };
                } catch (error: any) {
                    lastError = error;
                    const isRetryable = error.message.includes('Bad Gateway') ||
                        error.message.includes('timeout') ||
                        error.status === 502 ||
                        error.status === 504;

                    if (isRetryable && attempt < retries) {
                        const delay = Math.pow(2, attempt) * 1000;
                        console.warn(`[STORAGE] ⚠️ Upload failed (${error.message}). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries + 1})`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                    break;
                }
            }

            console.error(`[STORAGE] ❌ Upload failed after ${retries + 1} attempts:`, lastError.message);
            let userError = `Upload failed: ${lastError.message}`;
            if (lastError.message.includes('Bucket not found')) userError += " (Check Supabase Dashboard)";
            return { url: null, error: userError };

        } catch (err: any) {
            console.error("[STORAGE] ❌ Exception:", err.message);
            return { url: null, error: err.message || "Unknown storage error" };
        }
    }
}
