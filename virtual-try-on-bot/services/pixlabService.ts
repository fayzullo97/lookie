
const PIXLAB_API_URL = 'https://api.pixlab.io/bgremove';

const base64ToBlob = (base64: string, mimeType: string = 'image/jpeg'): Blob => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: mimeType });
};

export const removeBackgroundPixLab = async (
  apiKey: string, 
  base64Image: string,
  mockMode: boolean = false
): Promise<string> => {
  if (mockMode) {
      console.log("[MOCK] PixLab: Removing background...");
      await new Promise(r => setTimeout(r, 1000));
      return base64Image; // Return original in mock
  }

  if (!apiKey) throw new Error("MISSING_PIXLAB_KEY");

  try {
    const blob = base64ToBlob(base64Image);
    const formData = new FormData();
    formData.append('file', blob, 'image.jpg');
    formData.append('key', apiKey);

    const response = await fetch(PIXLAB_API_URL, {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();

    if (data.status !== 200) {
        throw new Error(data.error || `PixLab API Error: ${data.status}`);
    }

    // PixLab returns the raw base64 string in 'imgData'
    return data.imgData; 
  } catch (error) {
    console.error("PixLab Service Error:", error);
    throw error;
  }
};
