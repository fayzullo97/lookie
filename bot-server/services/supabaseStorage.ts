
import { supabase } from "./supabaseClient";
import { decode } from 'base64-arraybuffer';

export class SupabaseStorageService {
    public static async uploadImage(bucket: string, path: string, base64Data: string, mimeType: string): Promise<string | null> {
        try {
            // Remove data:image/jpeg;base64, prefix if present
            const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, decode(cleanBase64), {
                    contentType: mimeType,
                    upsert: true
                });

            if (error) {
                console.error(`Error uploading to ${bucket}:`, error);
                return null;
            }

            // Return the public URL or the path
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            return publicUrl;
        } catch (err) {
            console.error("Storage upload failed:", err);
            return null;
        }
    }
}
