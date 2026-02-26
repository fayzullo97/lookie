import sharp from 'sharp';

/**
 * Merges multiple base64 images into a single collage on a white background.
 * Images are arranged in a grid or vertical stack.
 */
export const mergeImages = async (imagesBase64: string[]): Promise<string> => {
    if (imagesBase64.length === 0) throw new Error("No images provided for merging");
    if (imagesBase64.length === 1) return imagesBase64[0];

    try {
        // 1. Prepare buffers from base64
        const buffers = await Promise.all(
            imagesBase64.map(async (b64) => {
                const data = b64.includes('base64,') ? b64.split('base64,')[1] : b64;
                return Buffer.from(data, 'base64');
            })
        );

        // 2. Get metadata for all images to determine layout
        const metadatas = await Promise.all(buffers.map(b => sharp(b).metadata()));

        // Determine target width (max of all images)
        const maxWidth = Math.max(...metadatas.map(m => m.width || 0));
        const totalHeight = metadatas.reduce((sum, m) => sum + (m.height || 0), 0) + (metadatas.length - 1) * 20; // 20px gaps

        // 3. Create a canvas with a white background
        const canvas = sharp({
            create: {
                width: maxWidth + 40, // 20px padding
                height: totalHeight + 40,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        });

        // 4. Composite images vertically
        let currentY = 20;
        const composites = metadatas.map((m, i) => {
            const x = Math.floor((maxWidth + 40 - (m.width || 0)) / 2);
            const composite = {
                input: buffers[i],
                top: currentY,
                left: x
            };
            currentY += (m.height || 0) + 20;
            return composite;
        });

        const resultBuffer = await canvas.composite(composites).png().toBuffer();
        return resultBuffer.toString('base64');

    } catch (error) {
        console.error("[IMAGE_MANIPULATION] Failed to merge images:", error);
        throw error;
    }
};
