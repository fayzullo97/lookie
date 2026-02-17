
import fetch from 'node-fetch';
import FormData from 'form-data';

const PIXLAB_API_URL = 'https://api.pixlab.io/bgremove';

export const removeBackgroundPixLab = async (
    apiKey: string,
    base64Image: string,
    mockMode: boolean = false
): Promise<string> => {
    if (mockMode) {
        console.log("[MOCK] PixLab: Removing background...");
        await new Promise(r => setTimeout(r, 1000));
        return base64Image;
    }

    if (!apiKey) throw new Error("MISSING_PIXLAB_KEY");

    try {
        const buffer = Buffer.from(base64Image, 'base64');
        const formData = new FormData();
        formData.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
        formData.append('key', apiKey);

        const response = await fetch(PIXLAB_API_URL, {
            method: 'POST',
            body: formData,
        });

        const data: any = await response.json();

        if (data.status !== 200) {
            throw new Error(data.error || `PixLab API Error: ${data.status}`);
        }

        return data.imgData;
    } catch (error) {
        console.error("PixLab Service Error:", error);
        throw error;
    }
};
