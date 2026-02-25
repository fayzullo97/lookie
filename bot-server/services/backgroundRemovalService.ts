import { removeBackground } from '@imgly/background-removal-node';

/**
 * Removes the background from an image using a local AI model (free, no API cost).
 * Accepts a base64-encoded image string and returns a base64 string with the background removed.
 */
export async function removeImageBackground(base64Image: string): Promise<string> {
    try {
        // Convert base64 to Buffer (Uint8Array compatible)
        const imageBuffer = Buffer.from(base64Image, 'base64');

        console.log(`[BG-REMOVAL] Processing image (${Math.round(imageBuffer.length / 1024)}KB)...`);
        const startTime = Date.now();

        // removeBackground accepts Uint8Array/ArrayBuffer and returns a Blob
        const resultBlob: Blob = await removeBackground(imageBuffer, {
            output: {
                format: 'image/png',
                quality: 0.9
            }
        });

        // Convert the result Blob back to base64
        const arrayBuffer = await resultBlob.arrayBuffer();
        const resultBase64 = Buffer.from(arrayBuffer).toString('base64');

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[BG-REMOVAL] ✅ Done in ${elapsed}s (output: ${Math.round(arrayBuffer.byteLength / 1024)}KB)`);

        return resultBase64;
    } catch (error: any) {
        console.error(`[BG-REMOVAL] ❌ Failed:`, error.message || error);
        // Return original image if background removal fails
        return base64Image;
    }
}
