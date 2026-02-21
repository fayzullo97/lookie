
import { GoogleGenAI, Type } from "@google/genai";
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

      const cleanedImage = cleanBase64(base64Image);
      if (!cleanedImage) throw new Error("Image data is empty or invalid");

      return await retryOperation(async () => {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: cleanedImage } },
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
      base64Images.forEach(img => {
        const cleaned = cleanBase64(img);
        if (cleaned) {
          parts.push({ inlineData: { mimeType: "image/jpeg", data: cleaned } });
        }
      });
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
      const cleanImage = cleanBase64(base64Image);
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
  outfitItems: OutfitItem[],
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
      const cleanModel = cleanBase64(modelImageBase64);
      if (!cleanModel) throw new Error("Invalid model image data");

      // Image 1: The Model
      parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanModel } });

      // Image 2..N: The Items
      outfitItems.forEach(item => {
        const cleanItem = cleanBase64(item.base64);
        if (cleanItem) {
          parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanItem } });
        }
      });

      // Prepare Consolidated Description
      const allDescriptions = outfitItems.map(i => i.description).join("; ");
      const hasBackgroundItem = outfitItems.some(i => i.category === ItemCategory.BACKGROUND);

      // SYSTEM PROMPT (STRICT IDENTITY RULE + MULTI-ITEM LOGIC)
      const systemInstruction = `You are a professional virtual try-on image generation engine.

CRITICAL IDENTITY RULE:
The ONLY human identity that must appear in the final generated image is the USER MODEL IMAGE ([IMAGE 1]).
[IMAGE 1] IS SACRED. DO NOT CHANGE THE FACE OR BODY SHAPE of [IMAGE 1].

CRITICAL BACKGROUND RULE:
ALWAYS preserve the original background of the USER MODEL IMAGE ([IMAGE 1]) EXACTLY AS IT IS.
NEVER change, blur, or replace the background of [IMAGE 1] EVEN IF the outfit images ([IMAGE 2+]) have removed backgrounds or different backgrounds. The only exception is if the user provides an explicit 'background' category item, but otherwise, the background must remain identical to [IMAGE 1].

HANDLING REFERENCE IMAGES ([IMAGE 2+]):
- These images contain fashion items. A single image may contain a full outfit (top, bottom, shoes, accessories).
- EXTRACT AND USE ALL VISIBLE ITEMS from [IMAGE 2+].
- IGNORE any persons/models in [IMAGE 2+].

CONFLICT RESOLUTION:
- If [IMAGE 2+] contains multiple items of the SAME TYPE (e.g., two different skirts, two different coats):
  -> INTELLIGENTLY CHOOSE ONE that best matches the overall style. Do not apply both.
- If items overlap (e.g. a dress and a separate top):
  -> Layer them logically or choose the most complete look.

STRICT EXECUTION:
1. Identify ALL clothing/accessories in [IMAGE 2+].
2. "Cut out" these items mentally.
3. Apply them onto the USER MODEL ([IMAGE 1]), replacing the original clothes.
4. Preserve [IMAGE 1]'s face, head, hair, body, AND BACKGROUND exactly as they are.
5. If [IMAGE 2+] includes shoes, replace [IMAGE 1]'s shoes.

If a conflict exists between model image and outfit image:
→ ALWAYS prioritize the USER MODEL IMAGE ([IMAGE 1]) for identity/body AND exact background environment.
→ ALWAYS prioritize [IMAGE 2+] for clothing/style.`;

      // USER PROMPT (GENERATION TASK)
      const userInstruction = `Generate a professional full-body fashion photograph.

INPUT MAPPING:
- [IMAGE 1]: USER MODEL (Source Identity - MUST BE PRESERVED)
- [IMAGE 2+]: OUTFIT REFERENCES (Source Clothing - Apply ALL items found here)

PRIMARY SUBJECT:
The person in the final image MUST be the person from [IMAGE 1].
Maintain [IMAGE 1]'s exact face, identity, and body structure.

OUTFIT APPLICATION:
Apply the fashion items described below (found in [IMAGE 2+]):
${allDescriptions}

INSTRUCTIONS:
1. Use ALL distinct items found in the reference images (Top, Bottom, Shoes, Hat, Bag, etc.).
2. If multiple images provide items for the same body part (e.g. 2 shirts), Pick ONE best option.
3. Dress the model naturally.

WARNING:
Do NOT produce an image that looks like the models in [IMAGE 2+].
Do NOT change the user's face.

STYLE:
Professional fashion editorial. Realistic fit. High detail.

The final image must clearly be the USER MODEL ([IMAGE 1]) wearing the selected items.
${hasBackgroundItem ? "REPLACE the background with the provided background image." : "Keep the original background."}
`;

      // Add text part with prompt
      parts.push({ text: `${userInstruction}\n\nAdditional Details: ${prompt}` });

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
        if (candidate?.finishReason === 'SAFETY') throw new Error("Safety Block");

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) return part.inlineData.data;
          }
        }
        throw new Error("No image generated");
      });

    } catch (error) {
      console.error("Generation error:", error);
      throw error;
    }
  });
};
