import { GoogleGenAI, Type } from "@google/genai";
import fetch from "node-fetch";
import { ValidationResult, CategorizationResult, ItemCategory, OutfitItem } from "../types";

// --- GLOBAL RATE LIMITER / QUEUE ---
const MIN_REQUEST_INTERVAL_MS = 5000;
let lastRequestTimestamp = 0;
let queuePromise: Promise<any> = Promise.resolve();

function enqueueExclusively<T>(operation: () => Promise<T>): Promise<T> {
  const nextOperation = queuePromise.then(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTimestamp;

    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
      const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    try {
      const result = await operation();
      lastRequestTimestamp = Date.now();
      return result;
    } catch (e) {
      lastRequestTimestamp = Date.now();
      throw e;
    }
  });

  queuePromise = nextOperation.catch(() => { });
  return nextOperation;
}

// --- HELPERS ---

const cleanJsonString = (str: string | undefined | null): string => {
  if (!str) return "[]";
  let cleaned = str.replace(/```json\n?|```/g, "");
  const firstOpen = cleaned.indexOf('[');
  const lastClose = cleaned.lastIndexOf(']');
  if (firstOpen !== -1 && lastClose !== -1) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  } else {
    const fObj = cleaned.indexOf('{');
    const lObj = cleaned.lastIndexOf('}');
    if (fObj !== -1 && lObj !== -1) cleaned = cleaned.substring(fObj, lObj + 1);
  }
  return cleaned.trim();
};

const cleanBase64 = (str: string | undefined | null): string => {
  if (!str) return "";
  return str.replace(/[\r\n\s]+/g, "");
};

/**
 * Ensures that the provided image data is a clean base64 string.
 * If the input is a URL (starts with http), it downloads the image first.
 */
export async function ensureBase64(imageData: string | undefined | null): Promise<string> {
  if (!imageData) return "";

  if (imageData.startsWith('http')) {
    try {
      const res = await fetch(imageData);
      if (!res.ok) throw new Error(`Failed to fetch image from URL: ${imageData} (Status: ${res.status})`);
      const buffer = await res.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    } catch (err: any) {
      console.error(`[ensureBase64] Error fetching URL:`, err.message);
      return "";
    }
  }

  return cleanBase64(imageData);
}

const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  if (error.status === 429) return true;
  if (error.error?.code === 429) return true;
  if (error.error?.status === 'RESOURCE_EXHAUSTED') return true;
  const msg = error.message || error.error?.message || '';
  if (typeof msg === 'string') {
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) return true;
  }
  try {
    const dump = JSON.stringify(error);
    if (dump.includes('"code":429') || dump.includes('RESOURCE_EXHAUSTED')) return true;
  } catch (e) { }
  return false;
};

async function retryOperation<T>(operation: () => Promise<T>, retries = 1, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (isQuotaError(error)) {
      console.warn("Quota exceeded (429) detected in retry loop. Aborting.");
      throw { status: 429, message: "Quota exceeded" };
    }
    if (retries > 0) {
      console.log(`Retrying operation... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- SERVICES ---

export const validateModelImage = async (apiKey: string, base64Image: string, mockMode = false): Promise<ValidationResult> => {
  const finalBase64 = await ensureBase64(base64Image);
  if (mockMode) {
    console.log("[MOCK] Validating image...");
    await new Promise(r => setTimeout(r, 500));
    return { valid: true, gender: 'female' };
  }

  if (!apiKey) throw new Error("MISSING_GEMINI_KEY");
  const ai = new GoogleGenAI({ apiKey });

  return enqueueExclusively(async () => {
    try {
      const schema = {
        type: Type.OBJECT,
        properties: {
          valid: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
          gender: { type: Type.STRING, enum: ["male", "female"] }
        },
        required: ["valid"],
      };

      if (!finalBase64) throw new Error("Image data is empty or invalid");

      return await retryOperation(async () => {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: finalBase64 } },
              { text: "Is this a photo of a human? Respond valid:true if user is visible from head to knees/ankles. Also detect the gender of the person (male or female)." },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        });

        const text = response.text;
        if (!text) throw new Error("No response");
        const cleaned = cleanJsonString(text);
        return JSON.parse(cleaned) as ValidationResult;
      });
    } catch (error: any) {
      console.error("Validation error:", error);
      if (isQuotaError(error)) return { valid: false, reason: "429_QUOTA_EXCEEDED" };
      return { valid: false, reason: "Error validating image." };
    }
  });
};

export const categorizeOutfitItemsBatch = async (apiKey: string, base64Images: string[], mockMode = false): Promise<CategorizationResult[]> => {
  if (base64Images.length === 0) return [];

  if (mockMode) {
    console.log("[MOCK] Categorizing items...");
    await new Promise(r => setTimeout(r, 1000));
    const mocks = [ItemCategory.TOP, ItemCategory.BOTTOM, ItemCategory.SHOES, ItemCategory.HANDBAG, ItemCategory.HAT];
    return base64Images.map((_, i) => ({
      category: mocks[i % mocks.length],
      description: `Mock Item ${i + 1} Description (Red/Blue)`,
      isProhibited: false,
      gender: 'female',
      containsPerson: i % 2 === 0, // Mock every second item as having a person
      imageIndex: i
    }));
  }

  if (!apiKey) throw new Error("MISSING_GEMINI_KEY");
  const ai = new GoogleGenAI({ apiKey });

  return enqueueExclusively(async () => {
    try {
      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            imageIndex: { type: Type.INTEGER, description: "The 0-based index of the image these items belong to (from the provided list of images)." },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            isProhibited: { type: Type.BOOLEAN, description: "True if item is underwear, bikini, bra, lingerie, swimwear or adult toy" },
            gender: { type: Type.STRING, enum: ["male", "female", "unisex"], description: "The target gender for this item" },
            containsPerson: { type: Type.BOOLEAN, description: "True if the image contains a real human person, model, or visible body parts wearing the clothes. Mannequins are false." }
          },
          required: ["imageIndex", "category", "description", "isProhibited", "gender", "containsPerson"]
        }
      };

      const prompt = `
        Analyze these ${base64Images.length} images containing fashion items.
        CRITICAL TASK: For EACH distinct clothing item or accessory you see across all images, create ONE separate object in the array.
        If a single image contains a person wearing a top, pants, and shoes, YOU MUST OUTPUT 3 SEPARATE OBJECTS for that same imageIndex.
        
        1. Identify the specific category: 'top', 'bottom', 'outfit' (only for full-body one-piece items like dresses), 'shoes', 'handbag', 'hat', 'accessory', 'background'.
        2. Write a detailed description of EACH SPECIFIC ITEM. Do not describe the whole outfit in one object unless it's a dress. **IMPORTANT**: IGNORE humans/models. Describe ONLY the piece of clothing.
        3. SAFETY CHECK: Check if the item is PROHIBITED (Bikini, Underwear, etc.).
        4. GENDER CHECK: 'male', 'female', or 'unisex'.
        5. HUMAN CHECK: containsPerson=true if a real human wearing the item is visible.
        6. imageIndex: Indicate which input image (0 to ${base64Images.length - 1}) this item was found in.
        
        Return an ARRAY of objects, with one object for EACH DISTINCT IDENTIFIABLE FASHION ITEM across all images.
      `;

      const parts: any[] = [];
      for (const img of base64Images) {
        const cleaned = await ensureBase64(img);
        if (cleaned) {
          parts.push({ inlineData: { mimeType: "image/jpeg", data: cleaned } });
        }
      }
      parts.push({ text: prompt });

      return await retryOperation(async () => {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        });

        const text = response.text;
        if (!text) throw new Error("No response");

        const rawResults = JSON.parse(cleanJsonString(text)) as any[];

        return rawResults.map((res: any) => {
          let category = ItemCategory.UNKNOWN;
          const rc = res.category?.toLowerCase() || "";
          if (Object.values(ItemCategory).includes(rc as ItemCategory)) category = rc as ItemCategory;
          return {
            category,
            description: res.description || "Item",
            isProhibited: res.isProhibited || false,
            gender: res.gender || 'unisex',
            containsPerson: res.containsPerson || false,
            imageIndex: res.imageIndex !== undefined ? res.imageIndex : 0
          };
        });
      });
    } catch (error: any) {
      console.error("Batch Categorization error:", error);
      if (isQuotaError(error)) return base64Images.map((_, i) => ({ category: ItemCategory.UNKNOWN, description: "429_QUOTA_EXCEEDED", isProhibited: false, gender: 'unisex', containsPerson: false, imageIndex: i }));
      return base64Images.map((_, i) => ({ category: ItemCategory.UNKNOWN, description: "Error analyzing", isProhibited: false, gender: 'unisex', containsPerson: false, imageIndex: i }));
    }
  });
}

export const isolateClothingItem = async (apiKey: string, base64Image: string, description: string, mockMode = false): Promise<string> => {
  if (mockMode) {
    console.log("[MOCK] Isolating clothing item...");
    await new Promise(r => setTimeout(r, 2000));
    return base64Image;
  }

  if (!apiKey) throw new Error("MISSING_GEMINI_KEY");
  const ai = new GoogleGenAI({ apiKey });

  return enqueueExclusively(async () => {
    try {
      const cleanImage = await ensureBase64(base64Image);
      if (!cleanImage) throw new Error("Invalid image data");

      // Using gemini-2.5-flash-image instead of gemini-3-pro-image-preview
      // to avoid 403 PERMISSION_DENIED errors for users without Pro access.
      const prompt = `Crop and extract the [${description}] from this image. 
            Place it on a pure white background. 
            Remove the human model, body parts, skin, and face completely. 
            Keep the original shape, texture, and lighting of the clothing. 
            Return ONLY the isolated clothing image.`;

      const parts = [
        { inlineData: { mimeType: "image/jpeg", data: cleanImage } },
        { text: prompt }
      ];

      return await retryOperation(async () => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts },
          config: {
            temperature: 0.1
          }
        });

        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) return part.inlineData.data;
          }
        }
        throw new Error("No isolated image generated");
      });

    } catch (error) {
      console.error("Isolation error:", error);
      throw error;
    }
  });
};

export const generateTryOnImage = async (
  apiKey: string,
  modelImageBase64: string,
  outfitImageBase64: string,
  outfitDescriptions: string,
  prompt: string,
  mockMode = false
): Promise<string> => {
  if (mockMode) {
    console.log("[MOCK] Generating image... Returning original model image.");
    await new Promise(r => setTimeout(r, 2000));
    return modelImageBase64;
  }

  if (!apiKey) throw new Error("MISSING_GEMINI_KEY");
  const ai = new GoogleGenAI({ apiKey });

  return enqueueExclusively(async () => {
    try {
      const parts: any[] = [];
      const cleanModel = await ensureBase64(modelImageBase64);
      if (!cleanModel) throw new Error("Invalid model image data");

      const cleanOutfit = await ensureBase64(outfitImageBase64);
      if (!cleanOutfit) throw new Error("Invalid outfit image data");

      // Image 1: The Model
      parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanModel } });

      // Image 2: The Merged Isolated Outfit Elements (1:1 Collage)
      parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanOutfit } });

      console.log(`[GEMINI] Prepared generation with ${parts.filter(p => p.inlineData).length} images.`);

      // Safety check: ensure no other images leaked in
      if (parts.length > 2) {
        console.warn(`[GEMINI] ⚠️ WARNING: parts array has ${parts.length} items. Expected exactly 2 images before text.`);
      }

      const systemInstruction = `You are a professional virtual try-on image generation engine.

CRITICAL IDENTITY RULE:
The ONLY human identity that must appear in the final generated image is the USER MODEL IMAGE ([IMAGE 1]).
[IMAGE 1] IS SACRED. DO NOT CHANGE THE FACE OR BODY SHAPE of [IMAGE 1].

CRITICAL ASPECT RATIO RULE:
YOU MUST ENTIRELY PRESERVE THE INITIAL ASPECT RATIO AND ORIENTATION OF [IMAGE 1].
The generated output must have the same width-to-height proportion as the original model photo.

CRITICAL BACKGROUND RULE:
ALWAYS preserve the original background of the USER MODEL IMAGE ([IMAGE 1]) EXACTLY AS IT IS.
NEVER change, blur, or replace the background of [IMAGE 1].

HIJAB/HEAD-COVERING APPLICATION:
- If [IMAGE 2] contains a hijab, scarf, or any head covering, YOU MUST apply it to the model in [IMAGE 1].
- If the model in [IMAGE 1] has exposed hair and [IMAGE 2] includes a head covering, COVER THE HAIR AND HEAD accurately as shown in [IMAGE 2].
- Ensure the face remains identical to [IMAGE 1] while the head-covering is placed around it.

HANDLING OUTFIT REFERENCE IMAGE ([IMAGE 2]):
- [IMAGE 2] is a 1:1 SQUARE COLLAGE of ISOLATED fashion items on a white background.
- COMPLETELY IGNORE any residue, outlines, or white space in [IMAGE 2].
- EXTRACT AND APPLY ALL CLOTHING ITEMS shown in [IMAGE 2] onto the person in [IMAGE 1].
- Do not swap faces or transfer skin tone from any small parts in [IMAGE 2].

IDENTITY PRESERVATION:
- Maintain the exact facial features, skin tone, and body structure of the person in [IMAGE 1].
- Only change the clothing and accessories by applying items from [IMAGE 2].
- Always prioritize the USER MODEL IMAGE ([IMAGE 1]) for identity preservation.`;

      const userInstruction = `Generate a professional high-quality fashion editorial photograph.

INPUT MAPPING:
- [IMAGE 1]: TARGET MODEL (Source Identity - MUST BE PRESERVED)
- [IMAGE 2]: ISOLATED OUTFIT ELEMENTS (1:1 Collage - Apply ALL items found here)

PRIMARY SUBJECT:
The person in the final image MUST be the person from [IMAGE 1].
Maintain [IMAGE 1]'s exact face, identity, gender, and posture.

ASPECT RATIO:
The final image MUST maintain the same aspect ratio as [IMAGE 1]. Do not crop or stretch.

OUTFIT & MODESTY APPLICATION:
1. Dress the subject in [IMAGE 1] using ALL items extracted from [IMAGE 2]:
${outfitDescriptions}
2. **HIJAB/HEAD-COVERING**: If a hijab or headscarf is visible in [IMAGE 2], apply it to cover the hair and head of the subject in [IMAGE 1], even if they were hair-exposed in the source.

REFINEMENT INSTRUCTIONS:
${prompt || "Ensure a natural fit and photorealistic textures."}

WARNING:
Do NOT change the user's face. [IMAGE 1] is SACRED.
Do NOT create a new background. The background of [IMAGE 1] must be RETAINED EXACTLY.`;

      parts.push({ text: userInstruction });

      return await retryOperation(async () => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts },
          config: {
            temperature: 0.2,
            systemInstruction: systemInstruction
          }
        });

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') throw new Error("Safety Blocked");

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) return part.inlineData.data;
          }
        }
        throw new Error("No image generated by AI");
      });

    } catch (error) {
      console.error("Try-on generation error:", error);
      throw error;
    }
  });
};


