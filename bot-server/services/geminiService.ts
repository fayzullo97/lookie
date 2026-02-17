
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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
    const msg = error.message || "";
    if (typeof msg === 'string') {
        if (msg.includes('429') || msg.includes('Quota') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) return true;
    }
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
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    valid: { type: SchemaType.BOOLEAN },
                    reason: { type: SchemaType.STRING },
                    gender: { type: SchemaType.STRING, enum: ["male", "female"], format: "enum" }
                },
                required: ["valid"],
            }
        }
    });

    return enqueueExclusively(async () => {
        try {
            const cleanedImage = cleanBase64(base64Image);
            if (!cleanedImage) throw new Error("Image data is empty or invalid");

            return await retryOperation(async () => {
                const result = await model.generateContent([
                    { inlineData: { mimeType: "image/jpeg", data: cleanedImage } },
                    { text: "Is this a photo of a human? Respond valid:true if a person is clearly visible and it is suitable for a virtual try-on (ideally head to knees, but waist-up is also okay). Also detect the gender of the person (male or female)." },
                ]);

                const response = await result.response;
                const text = response.text();
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
        const mocks = [ItemCategory.OUTFIT, ItemCategory.SHOES, ItemCategory.HANDBAG, ItemCategory.HAT];
        return base64Images.map((_, i) => ({
            category: mocks[i % mocks.length],
            description: `Mock Item ${i + 1} Description (Red/Blue)`,
            isProhibited: false,
            gender: 'female',
            containsPerson: i % 2 === 0
        }));
    }

    if (!apiKey) throw new Error("MISSING_GEMINI_KEY");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        index: { type: SchemaType.INTEGER },
                        category: { type: SchemaType.STRING },
                        description: { type: SchemaType.STRING },
                        isProhibited: { type: SchemaType.BOOLEAN },
                        gender: { type: SchemaType.STRING, enum: ["male", "female", "unisex"], format: "enum" },
                        containsPerson: { type: SchemaType.BOOLEAN }
                    },
                    required: ["index", "category", "description", "isProhibited", "gender", "containsPerson"]
                }
            }
        }
    });

    return enqueueExclusively(async () => {
        try {
            const prompt = `
        Analyze these ${base64Images.length} fashion items. 
        1. Identify the category (outfit, shoes, handbag, hat, accessory, background).
        2. Write a short description of the ITEM ITSELF. **IMPORTANT**: Describe ONLY the clothing. Do not mention "model" or "person" in the description.
        3. SAFETY CHECK: Check if the item is PROHIBITED (Underwear, Lingerie, Swimwear, etc).
        4. GENDER CHECK: Identify if the item is for 'male', 'female', or 'unisex'.
        5. HUMAN CHECK: Set containsPerson=true if the image shows a real human wearing the item.
        
        Return an ARRAY of objects.
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
                const result = await model.generateContent(parts);
                const response = await result.response;
                const text = response.text();
                if (!text) throw new Error("No response");

                const rawResults = JSON.parse(cleanJsonString(text)) as any[];

                return rawResults.map((res: any) => {
                    let category = ItemCategory.UNKNOWN;
                    const rc = res.category?.toLowerCase() || "";
                    if (Object.values(ItemCategory).includes(rc)) category = rc as ItemCategory;
                    return {
                        category,
                        description: res.description || "Item",
                        isProhibited: res.isProhibited || false,
                        gender: res.gender || 'unisex',
                        containsPerson: res.containsPerson || false
                    };
                });
            });
        } catch (error: any) {
            console.error("Batch Categorization error:", error);
            if (isQuotaError(error)) return base64Images.map(() => ({ category: ItemCategory.UNKNOWN, description: "429_QUOTA_EXCEEDED", isProhibited: false, gender: 'unisex', containsPerson: false } as CategorizationResult));
            return base64Images.map(() => ({ category: ItemCategory.UNKNOWN, description: "Error analyzing", isProhibited: false, gender: 'unisex', containsPerson: false } as CategorizationResult));
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
        console.log("[MOCK] Generating image...");
        await new Promise(r => setTimeout(r, 2000));
        return modelImageBase64;
    }

    if (!apiKey) throw new Error("MISSING_GEMINI_KEY");
    const genAI = new GoogleGenerativeAI(apiKey);

    return enqueueExclusively(async () => {
        try {
            const parts: any[] = [];
            const cleanModel = cleanBase64(modelImageBase64);
            if (!cleanModel) throw new Error("Invalid model image data");

            parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanModel } });

            outfitItems.forEach(item => {
                const cleanItem = cleanBase64(item.base64);
                if (cleanItem) {
                    parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanItem } });
                }
            });

            const outfitDesc = outfitItems.filter(i => i.category === ItemCategory.OUTFIT).map(i => i.description).join(", ") || "Fashion Item";
            const shoesDesc = outfitItems.filter(i => i.category === ItemCategory.SHOES).map(i => i.description).join(", ") || "Matching Shoes";
            const accDesc = outfitItems.filter(i => [ItemCategory.ACCESSORY, ItemCategory.HAT, ItemCategory.HANDBAG].includes(i.category)).map(i => i.description).join(", ");
            const hasBackgroundItem = outfitItems.some(i => i.category === ItemCategory.BACKGROUND);

            const systemInstruction = `You are a professional virtual try-on image generation engine.
[IMAGE 1] is the user. Keep their face and body identity identical.
[IMAGE 2+] are outfit items. Use ONLY the clothes, ignore models in those images.
Result must be the user from [IMAGE 1] wearing the clothes from [IMAGE 2+].`;

            const userInstruction = `Generate a photograph.
User: [IMAGE 1]
Clothes: ${outfitDesc}, ${shoesDesc}, ${accDesc}
${hasBackgroundItem ? "Replace background with background from provided item." : "Keep original background."}
Additional Info: ${prompt}`;

            parts.push({ text: userInstruction });

            const modelWithSystem = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: systemInstruction
            });

            return await retryOperation(async () => {
                const result = await modelWithSystem.generateContent({
                    contents: [{ role: "user", parts }],
                });

                const response = await result.response;
                const candidate = response.candidates?.[0];

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
