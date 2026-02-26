import sharp from 'sharp';

/**
 * Merges multiple base64 images into a single collage on a white background.
 * Images are arranged in a grid or vertical stack.
 */
/**
 * Merges multiple base64 images into a single 1:1 SQUARE collage on a white background.
 * Arranges images in a grid (e.g., 1x1, 2x2, 3x3) to achieve a balanced square ratio.
 */
export const mergeImages = async (imagesBase64: string[]): Promise<string> => {
    if (imagesBase64.length === 0) throw new Error("No images provided for merging");
    if (imagesBase64.length === 1) return imagesBase64[0];

    try {
        const CANVAS_SIZE = 1024;
        const PADDING = 20;

        // 1. Prepare buffers from base64
        const buffers = await Promise.all(
            imagesBase64.map(async (b64) => {
                const data = b64.includes('base64,') ? b64.split('base64,')[1] : b64;
                return Buffer.from(data, 'base64');
            })
        );

        // 2. Determine grid size
        const numImages = imagesBase64.length;
        const gridSize = Math.ceil(Math.sqrt(numImages)); // 2 for 2-4 images, 3 for 5-9 etc.
        const cellSize = Math.floor((CANVAS_SIZE - (gridSize + 1) * PADDING) / gridSize);

        // 3. Create white square canvas
        const canvas = sharp({
            create: {
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        });

        // 4. Arrange in grid
        const composites = await Promise.all(buffers.map(async (buf, i) => {
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;

            // Resize image to fit in cell while maintaining aspect ratio
            const resized = await sharp(buf)
                .resize(cellSize, cellSize, { fit: 'inside' })
                .toBuffer();

            const meta = await sharp(resized).metadata();

            // Center within its cell
            const xOffset = col * (cellSize + PADDING) + PADDING + Math.floor((cellSize - (meta.width || 0)) / 2);
            const yOffset = row * (cellSize + PADDING) + PADDING + Math.floor((cellSize - (meta.height || 0)) / 2);

            return {
                input: resized,
                top: yOffset,
                left: xOffset
            };
        }));

        const resultBuffer = await canvas.composite(composites).jpeg({ quality: 90 }).toBuffer();
        return resultBuffer.toString('base64');

    } catch (error) {
        console.error("[IMAGE_MANIPULATION] Failed to merge images:", error);
        throw error;
    }
};
