
import fetch from 'node-fetch';
import { OutfitItem, ItemCategory } from "../types";

export const generatePromptChatGPT = async (
    apiKey: string,
    items: OutfitItem[],
    userRefinement?: string
): Promise<string> => {
    if (!apiKey) throw new Error("OpenAI API Key is missing");

    const itemsDesc = items.map(i => `[${i.category.toUpperCase()}]: ${i.description}`).join("\n");
    const hasBackgroundItem = items.some(i => i.category === ItemCategory.BACKGROUND);

    const backgroundInstruction = hasBackgroundItem
        ? "Describe the new background based on the provided background item."
        : "Explicitly state: 'Keep the original background, lighting, and setting exactly as they are in the source image.' Do not describe a new location.";

    const systemPrompt = `You are an Expert Fashion Stylist Agent.
Your task is to write a rigid, descriptive prompt for an AI Image Editor (Inpainting task).

Inputs: A list of new items to apply to an existing image.

Rules:
1. FORCE "WEARING" LANGUAGE: 
   - Instead of "White shoes", say "The model is wearing white shoes on her feet".
   - Instead of "Red bag", say "She is holding a red bag" or "A red bag draped over her shoulder".
2. PURE ITEM DESCRIPTION: If the input item description mentions a person (e.g. "Man in blue suit"), ignore the person. Describe only the item (e.g. "A blue suit") being worn by the subject of the FIRST image (the user).
3. If pants/shoes/accessories are NOT in the input list, explicitly say "Keep the original pants/shoes/accessories".
4. BACKGROUND: ${backgroundInstruction}
5. Focus on integration: How the new item sits on the body.
6. Output ONLY the raw prompt text. No "Here is the prompt" prefix.`;

    const userMessage = `INPUT ITEMS:
${itemsDesc}

USER REFINEMENT:
${userRefinement || "None"}

Write the prompt.`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.5
            })
        });

        const data: any = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "OpenAI API Error");
        }

        return data.choices[0]?.message?.content?.trim() || "A model wearing fashion items.";
    } catch (error) {
        console.error("OpenAI Error:", error);
        throw error;
    }
};
