
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { TelegramService } from './services/telegramService';
import { sessionService } from './services/sessionService';
import { analytics } from './services/analyticsService';
import {
    AppState,
    ItemCategory,
    Language,
    OutfitItem,
    TelegramUpdate
} from './types';
import {
    validateModelImage,
    categorizeOutfitItemsBatch,
    generateTryOnImage
} from './services/geminiService';
import { removeBackgroundPixLab } from './services/pixlabService';
import { generatePromptChatGPT } from './services/openaiService';
import { supabase } from './services/supabaseClient';
import { SupabaseStorageService } from './services/supabaseStorage';

const PORT = process.env.PORT || 3001;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const PROVIDER_TOKEN = process.env.PROVIDER_TOKEN || '';
const OPENAI_KEY = process.env.OPENAI_KEY || '';
const GEMINI_KEY = process.env.GEMINI_KEY || '';
const PIXLAB_KEY = process.env.PIXLAB_KEY || '';
const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true';

const GEN_COST = 10;
const MONTHLY_GRANT = 30;

const TRANSLATIONS = {
    uz: {
        welcome_ask_lang: "Assalomu alaykum! Botga xush kelibsiz. 🤖\nIltimos, muloqot tilini tanlang:",
        welcome_start: "Salom! Men sizning AI stilistingizman. 🍌✨\n\nSizga boshlash uchun 30 ta credit sovg'a qilindi! 🎁\nBoshlash uchun o'z rasmingizni yuboring (to'liq bo'y-bast bilan).",
        monthly_grant_msg: "Yangi oy muborak! 🌙 Sizga 30 ta bepul credit qo'shildi. 🎁",
        low_credits: "⚠️ Hisobingizda creditlar yetarli emas. Image yaratish uchun kamida 10 ta credit kerak.\n\nHozirgi balans: ",
        buy_credits_btn: "💎 Credit sotib olish",
        balance_topup_msg: "Hisobingizni to'ldirish uchun paketni tanlang:",
        purchase_success: "To'lov qabul qilindi! 💎 {amount} credit hisobingizga qo'shildi.",
        payment_error: "⚠️ To'lov jarayonida xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
        change_model_msg: "Tushunarli, model rasmini o'zgartiramiz. 🔄\nIltimos, yangi rasm yuboring.",
        processing_model: "Rasm qayta ishlanmoqda... ⏳",
        model_saved: "Ajoyib! Rasmingiz saqlandi. 📸\n\nEndi look uchun kiyim, oyoq kiyim yoki aksessuarlar rasmini yuboring.",
        invalid_model: "🚫 Rasmni qabul qila olmadim. Iltimos, to'liq bo'y-bastli rasm ekanligiga ishonch hosil qiling.",
        item_received_prefix: "✅ Qabul qilindi",
        ready_btn: "🚀 Boshlash",
        reset_btn: "Reset",
        need_model_items: "⚠️ Avval model rasmi va kamida bitta look elementi kerak!",
        waiting_outfits: "Look uchun rasmlarni kutyapman. 👕\nRasmni yuklang yoki agar tayyor bo'lsangiz '🚀 Boshlash' tugmasini bosing.",
        upload_photo_prompt: "📸 Davom etish uchun rasm yuklang.",
        generating: "🎨 Look yaratilmoqda... (Sabr qiling, 15-20 soniya)",
        gen_caption: "Mana sizning yangi lookingiz! 🍌✨\n\n- O'zgartirish uchun yana look elementlarini yuboring.\n- Yoki 'Reset' tugmasini bosing.",
        gen_error: "⚠️ Kechirasiz, xatolik yuz berdi. Qayta urinib ko'ring.",
        openai_missing: "⚠️ Tizim xatosi: OpenAI kaliti kiritilmagan.",
        safety_error: "⚠️ Uzr, AI bu obrazni yarata olmadi. Iltimos, ochiq-sochiq kiyimlar yoki nomaqbul rasmlardan qoching.",
        reset_keep_model: "🔄 Reset qilindi. Keyingi look elementlarini kutyapman.",
        reset_full: "🔄 To'liq reset. Iltimos, yangi model rasmini yuklang.",
        need_item_alert: "⚠️ Iltimos, avval kamida bitta look elementini yuklang.",
        lang_updated: "🇺🇿 Til o'zgartirildi. Davom etishingiz mumkin!",
        processing_items: "📦 Kiyimlar tahlil qilinmoqda (bir vaqtning o'zida)...",
        quota_exceeded: "⚠️ Serverda kunlik limit tugadi yoki yuklama juda yuqori. Iltimos, birozdan keyin urinib ko'ring.",
        restore_menu: "📋 Menyu qayta tiklandi.",
        prohibited_content_error: "⚠️ Kechirasiz, tizim xavfsizlik qoidalariga ko'ra ichki kiyimlar, suzish kiyimlari va nomaqbul buyumlarni qabul qilmaydi.",
        gender_error: "⚠️ Tizim cheklovi: Sizning modelingiz ({model}) jinsida, lekin yuklangan kiyim ({item}) uchun mo'ljallangan.",
        existing_model_found: "Ajoyib! Sizning avvalgi rasmingiz saqlanib qolgan! 📸✨\n\nAgar shu rasm bilan davom ettirmoqchi bo'lsangiz, shunchaki kiyim rasmlarini yuboring.\n\nAgar yangi rasm yuklamoqchi bo'lsangiz, pastdagi tugmani bosing! 👇",
        btn_change_model: "🔄 Modelni o'zgartirish",
        menu_lang: "🌐 Tilni o'zgartirish",
        menu_reset: "🔄 Reset",
        menu_model: "👤 Modelni o'zgartirish",
        menu_balance: "💰 Balans",
        complex_processing: "⚠️ Kiyimlar fonini tozalash jarayoni ketmoqda...",
        gift_received: "🎁 Tabriklaymiz! Sizga admin tomonidan {amount} bonus credit berildi.",
        refund_msg: "⚠️ Kechirasiz, kiyimlarni tozalash (isolation) xizmati hozir ishlamayapti.\n↩️ 10 credit qaytarildi. Oddiy rejimda davom etamiz.",
        cat_outfit: "Kiyim",
        cat_shoes: "Oyoq kiyim",
        cat_handbag: "Sumka",
        cat_hat: "Bosh kiyim",
        cat_accessory: "Aksessuar",
        cat_background: "Fon",
        cat_unknown: "Noma'lum"
    },
    ru: {
        welcome_ask_lang: "Здравствуйте! Добро пожаловать. 🤖\nПожалуйста, выберите язык общения:",
        welcome_start: "Привет! Я ваш ИИ-стилист. 🍌✨\n\nВам начислено 30 приветственных кредитов! 🎁\nЧтобы начать, пожалуйста, отправьте мне ваше фото в полный рост.",
        monthly_grant_msg: "С новым месяцем! 🌙 Вам начислено 30 бесплатных кредитов. 🎁",
        low_credits: "⚠️ Недостаточно кредитов. Для генерации нужно минимум 10 кредитов.\n\nТекущий баланс: ",
        buy_credits_btn: "💎 Купить кредиты",
        balance_topup_msg: "Выберите пакет для пополнения счета:",
        purchase_success: "Платеж принят! 💎 {amount} кредитов зачислено на ваш счет.",
        payment_error: "⚠️ Произошла ошибка при оплате. Пожалуйста, попробуйте снова.",
        change_model_msg: "Хорошо, давайте изменим фото модели. 🔄\nПожалуйста, отправьте новое фото.",
        processing_model: "Обработка фото... ⏳",
        model_saved: "Отлично! Ваше фото сохранено. 📸\n\nТеперь отправьте фото для лука (одежду, обувь, аксессуары).",
        invalid_model: "🚫 Не удалось принять это фото. Пожалуйста, убедитесь, что это фото в полный рост.",
        item_received_prefix: "✅ Получено",
        ready_btn: "🚀 Начать",
        reset_btn: "Reset",
        need_model_items: "⚠️ Сначала нужно фото модели и хотя бы один элемент лука!",
        waiting_outfits: "Жду фото для лука. 👕\nЗагрузите фото или нажмите '🚀 Начать', если закончили.",
        upload_photo_prompt: "📸 Пожалуйста, загрузите фото для продолжения.",
        generating: "🎨 Создаю ваш look... (Подождите 15-20 секунд)",
        gen_caption: "Вот ваш новый look! 🍌✨\n\n- Отправьте еще элементы для изменения.\n- Или нажмите 'Reset'.",
        gen_error: "⚠️ Ошибка сервера. Пожалуйста, попробуйте снова.",
        openai_missing: "⚠️ Системная ошибка: Нет ключа OpenAI.",
        safety_error: "⚠️ Извините, ИИ не может создать этот образ. Пожалуйста, избегайте откровенных нарядов или неподобающих изображений.",
        reset_keep_model: "🔄 Reset выполнен. Жду следующий look.",
        reset_full: "🔄 Полный сброс. Пожалуйста, загрузите новое фото модели.",
        need_item_alert: "⚠️ Пожалуйста, сначала загрузите хотя бы один элемент лука.",
        lang_updated: "🇷🇺 Язык изменен. Вы можете продолжать!",
        processing_items: "📦 Анализ вещей (всех сразу)...",
        quota_exceeded: "⚠️ Лимит сервера исчерпан или высокая нагрузка. Пожалуйста, попробуйте чуть позже.",
        restore_menu: "📋 Меню восстановлено.",
        prohibited_content_error: "⚠️ Извините, система не обрабатывает нижнее белье, купальники и товары для взрослых из-за ограничений безопасности.",
        gender_error: "⚠️ Ограничение системы: Пол модели ({model}) не совпадает с категорией одежды ({item}).",
        existing_model_found: "Супер! Ваше предыдущее фото сохранено! 📸✨\n\nЕсли хотите продолжить с ним, просто отправляйте фото одежды.\n\nЕсли хотите загрузить новое фото, нажмите кнопку ниже! 👇",
        btn_change_model: "🔄 Сменить модель",
        menu_lang: "🌐 Сменить язык",
        menu_reset: "🔄 Reset",
        menu_model: "👤 Сменить модель",
        menu_balance: "💰 Баланс",
        complex_processing: "⚠️ Удаление фона с одежды...",
        gift_received: "🎁 Поздравляем! Администратор начислил вам {amount} бонусных кредитов.",
        refund_msg: "⚠️ Извините, сервис очистки одежды (isolation) временно недоступен.\n↩️ 10 кредитов возвращено. Продолжаем в обычном режиме.",
        cat_outfit: "Одежда",
        cat_shoes: "Обувь",
        cat_handbag: "Сумка",
        cat_hat: "Головной убор",
        cat_accessory: "Аксессуар",
        cat_background: "Фон",
        cat_unknown: "Неизвестно"
    }
};

const PAYMENT_PACKAGES = [
    { id: 'pkg_100', credits: 100, price: 10000, label: "10.000 so'm -> 100 credit" },
    { id: 'pkg_160', credits: 160, price: 15000, label: "15.000 so'm -> 160 credit" },
    { id: 'pkg_300', credits: 300, price: 25000, label: "25.000 so'm -> 300 credit" },
    { id: 'pkg_400', credits: 400, price: 30000, label: "30.000 so'm -> 400 credit" }
];

const getMenuKeyboard = (lang: Language, credits: number) => {
    const t = TRANSLATIONS[lang];
    return [
        [{ text: `${t.menu_balance}: ${credits}` }],
        [{ text: t.menu_reset }, { text: t.menu_model }],
        [{ text: t.menu_lang }]
    ];
};

const getCategoryName = (lang: Language, category: ItemCategory) => {
    const t = TRANSLATIONS[lang];
    switch (category) {
        case ItemCategory.OUTFIT: return t.cat_outfit;
        case ItemCategory.SHOES: return t.cat_shoes;
        case ItemCategory.HANDBAG: return t.cat_handbag;
        case ItemCategory.HAT: return t.cat_hat;
        case ItemCategory.ACCESSORY: return t.cat_accessory;
        case ItemCategory.BACKGROUND: return t.cat_background;
        default: return t.cat_unknown;
    }
};

const api = new TelegramService(TELEGRAM_TOKEN);

async function checkMonthlyGrant(chatId: number) {
    const session = await sessionService.getSession(chatId);
    if (!session || !session.language) return;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const isFirstDay = now.getDate() === 1;

    if (isFirstDay && session.lastMonthlyGrant !== currentMonthKey) {
        const t = TRANSLATIONS[session.language];
        const newCredits = session.credits + MONTHLY_GRANT;
        await sessionService.updateSession(chatId, {
            credits: newCredits,
            lastMonthlyGrant: currentMonthKey
        });
        await api.sendMessage(chatId, t.monthly_grant_msg, { keyboard: getMenuKeyboard(session.language, newCredits) });
    }
}

async function handleShowBalanceOptions(chatId: number) {
    const session = await sessionService.getSession(chatId);
    if (!session || !session.language) return;
    const t = TRANSLATIONS[session.language];

    const buttons = PAYMENT_PACKAGES.map(pkg => ([{
        text: pkg.label,
        callback_data: `buy_${pkg.id}`
    }]));

    await api.sendMessage(chatId, t.balance_topup_msg, { inlineKeyboard: buttons });
}

async function handleSendInvoice(chatId: number, packageId: string) {
    const session = await sessionService.getSession(chatId);
    if (!session || !session.language || !PROVIDER_TOKEN) return;

    const pkg = PAYMENT_PACKAGES.find(p => `buy_${p.id}` === packageId || p.id === packageId);
    if (!pkg) return;

    await api.sendInvoice({
        chatId,
        title: `${pkg.credits} Credits`,
        description: `Virtual Try-On Bot Credits - ${pkg.credits} units`,
        payload: pkg.id,
        providerToken: PROVIDER_TOKEN,
        currency: 'UZS',
        prices: [{ label: `${pkg.credits} credits`, amount: pkg.price * 100 }]
    });
}

async function handleResetLook(chatId: number) {
    const session = await sessionService.getSession(chatId);
    if (!session) return;
    const lang = session.language || 'uz';
    const t = TRANSLATIONS[lang];
    const restoreImage = session.originalModelImage || session.modelImage;

    if (restoreImage) {
        await sessionService.updateSession(chatId, {
            state: AppState.AWAITING_OUTFITS,
            modelImage: restoreImage,
            outfitItems: []
        });

        // Delete from outfit queue in DB
        await supabase.from('outfit_queue').delete().eq('user_id', chatId);

        await api.sendPhoto(chatId, restoreImage, t.reset_keep_model);
    } else {
        await sessionService.updateSession(chatId, {
            state: AppState.AWAITING_MODEL_IMAGE,
            modelImage: null,
            originalModelImage: null,
            outfitItems: []
        });

        // Cleanup DB
        await supabase.from('outfit_queue').delete().eq('user_id', chatId);
        await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);

        await api.sendMessage(chatId, t.reset_full);
    }
}

async function runGeneration(chatId: number, refinement?: string) {
    const session = await sessionService.getSession(chatId);
    if (!session || !session.modelImage || !session.language) return;
    const t = TRANSLATIONS[session.language];

    if (session.credits < GEN_COST) {
        await handleShowBalanceOptions(chatId);
        await api.sendMessage(chatId, `${t.low_credits} ${session.credits} (Need ${GEN_COST})`);
        return;
    }

    const newCredits = session.credits - GEN_COST;
    await sessionService.updateSession(chatId, { state: AppState.GENERATING });

    await analytics.trackFunnelStep('gen_req');

    const processingMsg = await api.sendMessage(chatId, t.generating);

    try {
        const processedItems = [...session.outfitItems];
        let itemsUpdated = false;

        for (let i = 0; i < processedItems.length; i++) {
            const item = processedItems[i];
            if ([ItemCategory.OUTFIT, ItemCategory.SHOES, ItemCategory.HAT, ItemCategory.ACCESSORY, ItemCategory.HANDBAG].includes(item.category)) {
                try {
                    const cleanBase64 = await removeBackgroundPixLab(PIXLAB_KEY, item.base64, USE_MOCK_AI);
                    processedItems[i] = {
                        ...item,
                        base64: cleanBase64,
                        mimeType: 'image/png'
                    };
                    itemsUpdated = true;
                } catch (pixError) {
                    console.error(`PixLab failed for item ${i}. Using original.`, pixError);
                }
            }
        }

        if (itemsUpdated) {
            await sessionService.updateSession(chatId, { outfitItems: processedItems });
        }

        let prompt = "";
        if (USE_MOCK_AI) {
            prompt = "Mock Prompt";
        } else {
            if (!OPENAI_KEY) throw new Error("MISSING_OPENAI_KEY");
            prompt = await generatePromptChatGPT(OPENAI_KEY, processedItems, refinement);
        }

        const generatedBase64 = await generateTryOnImage(GEMINI_KEY, session.modelImage, processedItems, prompt, USE_MOCK_AI);

        if (processingMsg?.result?.message_id) {
            await api.deleteMessage(chatId, processingMsg.result.message_id);
        }

        await analytics.trackGeneration(chatId, true, {
            prompt,
            costUsd: 0.04,
            costCredits: GEN_COST
        });
        await analytics.trackFunnelStep('complete');

        await sessionService.updateSession(chatId, {
            state: AppState.COMPLETED,
            modelImage: generatedBase64,
            outfitItems: [],
            credits: newCredits
        });

        // Clear queue in DB
        await supabase.from('outfit_queue').delete().eq('user_id', chatId);

        const buttons = [[{ text: t.reset_btn, callback_data: "reset_session" }]];
        await api.sendPhoto(chatId, generatedBase64, t.gen_caption, buttons);

    } catch (error) {
        console.error("Generation error:", error);
        await analytics.trackGeneration(chatId, false, {
            prompt: 'N/A',
            costUsd: 0,
            costCredits: 0,
            error: (error as any).message
        });
        await api.sendMessage(chatId, t.gen_error);
    }
}

async function processBufferedPhotos(chatId: number) {
    try {
        const session = await sessionService.getSession(chatId);
        if (!session || !session.photoBuffer || session.photoBuffer.length === 0) return;

        const t = TRANSLATIONS[session.language || 'uz'];

        if (session.state === AppState.AWAITING_MODEL_IMAGE || session.state === AppState.NEW_USER) {
            const lastImage = session.photoBuffer[session.photoBuffer.length - 1];
            const processingMsg = await api.sendMessage(chatId, t.processing_model);
            const validation = await validateModelImage(GEMINI_KEY, lastImage, USE_MOCK_AI);

            if (processingMsg?.result?.message_id) await api.deleteMessage(chatId, processingMsg.result.message_id);

            if (validation.valid) {
                await analytics.trackModelValidation(chatId, true);
                await analytics.trackFunnelStep('model');

                // Upload to Supabase Storage
                const path = `models/${chatId}/${Date.now()}.jpg`;
                const publicUrl = await SupabaseStorageService.uploadImage('user-uploads', path, lastImage, 'image/jpeg');

                if (publicUrl) {
                    // Save to DB
                    await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
                    await supabase.from('model_images').insert([{
                        user_id: chatId,
                        storage_path: publicUrl,
                        is_current: true
                    }]);

                    await sessionService.updateSession(chatId, {
                        modelImage: publicUrl,
                        originalModelImage: publicUrl,
                        modelGender: validation.gender,
                        state: AppState.AWAITING_OUTFITS,
                        photoBuffer: []
                    });
                    await api.sendMessage(chatId, t.model_saved);
                } else {
                    await api.sendMessage(chatId, "Error saving image to cloud storage.");
                }
            } else {
                await analytics.trackModelValidation(chatId, false);
                await sessionService.updateSession(chatId, { photoBuffer: [] });

                if (validation.reason === "429_QUOTA_EXCEEDED") {
                    await api.sendMessage(chatId, t.quota_exceeded);
                } else {
                    await api.sendMessage(chatId, t.invalid_model);
                }
            }
        }
        else if (session.state === AppState.AWAITING_OUTFITS || session.state === AppState.COMPLETED) {
            const imagesToProcess = session.photoBuffer.slice(0, 4);
            const statusMsg = await api.sendMessage(chatId, t.processing_items);
            const batchResults = await categorizeOutfitItemsBatch(GEMINI_KEY, imagesToProcess, USE_MOCK_AI);

            if (statusMsg?.result?.message_id) await api.deleteMessage(chatId, statusMsg.result.message_id);

            if (batchResults.length > 0 && batchResults[0].description === "429_QUOTA_EXCEEDED") {
                await sessionService.updateSession(chatId, { photoBuffer: [] });
                await api.sendMessage(chatId, t.quota_exceeded);
                return;
            }

            const prohibitedItem = batchResults.find(r => r.isProhibited);
            if (prohibitedItem) {
                await sessionService.updateSession(chatId, { photoBuffer: [] });
                await api.sendMessage(chatId, t.prohibited_content_error);
                return;
            }

            if (session.modelGender) {
                const mismatchItem = batchResults.find(r => r.gender !== 'unisex' && r.gender !== session.modelGender);
                if (mismatchItem) {
                    await sessionService.updateSession(chatId, { photoBuffer: [] });
                    const errorMsg = t.gender_error
                        .replace('{model}', session.modelGender === 'male' ? 'Male' : 'Female')
                        .replace('{item}', mismatchItem.gender === 'male' ? 'Male' : 'Female');
                    await api.sendMessage(chatId, errorMsg);
                    return;
                }
            }

            const newItems: OutfitItem[] = [];
            for (let i = 0; i < batchResults.length; i++) {
                const res = batchResults[i];
                const path = `items/${chatId}/${Date.now()}_${i}.jpg`;
                const publicUrl = await SupabaseStorageService.uploadImage('user-uploads', path, imagesToProcess[i], 'image/jpeg');

                if (publicUrl) {
                    const { data: queueItem } = await supabase.from('outfit_queue').insert([{
                        user_id: chatId,
                        storage_path: publicUrl,
                        category: res.category,
                        description: res.description,
                        mime_type: 'image/jpeg'
                    }]).select().single();

                    newItems.push({
                        id: queueItem?.id || Date.now().toString(),
                        category: res.category,
                        description: res.description,
                        base64: publicUrl, // Using URL as base64 for now since Gemini service can handle it
                        mimeType: 'image/jpeg',
                        containsPerson: res.containsPerson
                    });
                }
            }

            const currentItems = [...session.outfitItems, ...newItems];
            let nextState = session.state;
            let nextModelImage = session.modelImage;

            if (session.state === AppState.COMPLETED) {
                nextState = AppState.AWAITING_OUTFITS;
                if (session.originalModelImage) {
                    nextModelImage = session.originalModelImage;
                }
            }

            await sessionService.updateSession(chatId, {
                outfitItems: currentItems,
                photoBuffer: [],
                state: nextState,
                modelImage: nextModelImage
            });

            await analytics.trackFunnelStep('outfit');

            const categoryNames = newItems.map(i => {
                let name = getCategoryName(session.language!, i.category);
                if (i.containsPerson) name += " (👤 Human)";
                return name;
            }).join(', ');

            const buttons = [[
                { text: t.ready_btn, callback_data: "generate_look" }
            ]];

            await api.sendMessage(
                chatId,
                `${t.item_received_prefix}: ${categoryNames}`,
                { inlineKeyboard: buttons }
            );
        } else {
            console.log(`[PROCESS] Ignoring photos for ${chatId} due to state: ${session.state}`);
            // If state is AWAITING_LANGUAGE, maybe remind user?
            if (session.state === AppState.AWAITING_LANGUAGE) {
                const t = TRANSLATIONS[session.language || 'uz'];
                await api.sendMessage(chatId, t.welcome_ask_lang, {
                    inlineKeyboard: [[
                        { text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" },
                        { text: "🇷🇺 Русский", callback_data: "lang_ru" }
                    ]]
                });
            }
            await sessionService.updateSession(chatId, { photoBuffer: [] });
        }
    } catch (err) {
        console.error(`[PROCESS] Global error in processBufferedPhotos for ${chatId}:`, err);
        // Try to notify the user if possible
        try {
            const session = await sessionService.getSession(chatId);
            if (session && session.language) {
                const t = TRANSLATIONS[session.language];
                await api.sendMessage(chatId, t.gen_error);
            }
            await sessionService.updateSession(chatId, { photoBuffer: [] });
        } catch (innerErr) {
            console.error("[PROCESS] Error recovery failed:", innerErr);
        }
    }
}

async function processUpdate(update: TelegramUpdate) {
    if (update.pre_checkout_query) {
        await api.answerPrecheckoutQuery(update.pre_checkout_query.id, true);
        return;
    }

    if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message?.chat.id;
        if (chatId) {
            await api.answerCallbackQuery(cb.id);
            const session = await sessionService.getOrCreateSession(chatId, { username: (cb.from as any).username });

            if (cb.data === 'lang_uz' || cb.data === 'lang_ru') {
                const selectedLang = cb.data === 'lang_uz' ? 'uz' : 'ru';
                const t = TRANSLATIONS[selectedLang];
                const credits = session.credits;

                await sessionService.updateSession(chatId, { language: selectedLang });

                if (session.modelImage) {
                    await api.sendMessage(chatId, t.lang_updated, { keyboard: getMenuKeyboard(selectedLang, credits) });
                    const inlineBtns = [[{ text: t.btn_change_model, callback_data: 'change_model_inline' }]];
                    await api.sendPhoto(chatId, session.modelImage, t.existing_model_found, inlineBtns);
                } else {
                    await sessionService.updateSession(chatId, { state: AppState.AWAITING_MODEL_IMAGE });
                    await api.sendMessage(chatId, t.welcome_start, { keyboard: getMenuKeyboard(selectedLang, credits) });
                }
                return;
            }

            if (cb.data === 'change_model_inline') {
                const t = TRANSLATIONS[session.language || 'uz'];
                await sessionService.updateSession(chatId, {
                    state: AppState.AWAITING_MODEL_IMAGE,
                    modelImage: null,
                    originalModelImage: null,
                    outfitItems: []
                });
                // Cleanup DB
                await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
                await supabase.from('outfit_queue').delete().eq('user_id', chatId);

                await api.sendMessage(chatId, t.change_model_msg);
                return;
            }

            if (cb.data.startsWith('buy_pkg_')) {
                await handleSendInvoice(chatId, cb.data);
                return;
            }

            if (!session.language) return;
            const t = TRANSLATIONS[session.language];

            if (cb.data === 'reset_session') {
                await handleResetLook(chatId);
            } else if (cb.data === 'generate_look') {
                if (session.outfitItems.length > 0) {
                    await runGeneration(chatId);
                } else {
                    await api.sendMessage(chatId, t.need_item_alert);
                }
            }
        }
        return;
    }

    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text;
    const photos = msg.photo;

    const session = await sessionService.getOrCreateSession(chatId, { username: msg.from.username });
    await checkMonthlyGrant(chatId);
    await analytics.trackUserActivity(chatId, { username: msg.from.username, firstName: msg.from.first_name });

    if (msg.successful_payment) {
        const payload = msg.successful_payment.invoice_payload;
        const pkg = PAYMENT_PACKAGES.find(p => p.id === payload);
        if (pkg && session.language) {
            const newCredits = session.credits + pkg.credits;
            await sessionService.updateSession(chatId, { credits: newCredits });
            await analytics.trackPayment(chatId, msg.successful_payment.total_amount / 100, pkg.credits, msg.successful_payment.invoice_payload);

            const t = TRANSLATIONS[session.language];
            await api.sendMessage(chatId, t.purchase_success.replace('{amount}', pkg.credits.toString()), {
                keyboard: getMenuKeyboard(session.language, newCredits)
            });
        }
        return;
    }

    if (text === '/start' || text === '/reset') {
        await sessionService.updateSession(chatId, { state: AppState.AWAITING_LANGUAGE });
        const keyboard = [[
            { text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" },
            { text: "🇷🇺 Русский", callback_data: "lang_ru" }
        ]];
        await api.sendMessage(chatId, TRANSLATIONS['uz'].welcome_ask_lang, { inlineKeyboard: keyboard, removeKeyboard: true });
        return;
    }

    if (!session.language) return;
    const t = TRANSLATIONS[session.language];

    if (text === '/menu') {
        await api.sendMessage(chatId, t.restore_menu, { keyboard: getMenuKeyboard(session.language, session.credits) });
        return;
    }

    if (text?.startsWith(t.menu_balance)) {
        await handleShowBalanceOptions(chatId);
        return;
    }

    if (text === t.menu_reset) {
        await handleResetLook(chatId);
        return;
    }
    if (text === t.menu_model) {
        await sessionService.updateSession(chatId, {
            state: AppState.AWAITING_MODEL_IMAGE,
            modelImage: null,
            originalModelImage: null,
            outfitItems: []
        });
        // Cleanup DB
        await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
        await supabase.from('outfit_queue').delete().eq('user_id', chatId);

        await api.sendMessage(chatId, t.change_model_msg);
        return;
    }
    if (text === t.menu_lang) {
        await sessionService.updateSession(chatId, { state: AppState.AWAITING_LANGUAGE });
        const keyboard = [[
            { text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" },
            { text: "🇷🇺 Русский", callback_data: "lang_ru" }
        ]];
        await api.sendMessage(chatId, TRANSLATIONS['uz'].welcome_ask_lang, { inlineKeyboard: keyboard, removeKeyboard: true });
        return;
    }

    if (photos && photos.length > 0) {
        const largestPhoto = photos[photos.length - 1];
        const base64Image = await api.getFile(largestPhoto.file_id);

        if (!base64Image) {
            await api.sendMessage(chatId, "⚠️ Error downloading image. Please try again.");
            return;
        }

        const currentBuffer = session.photoBuffer || [];
        currentBuffer.push(base64Image);
        if (session.bufferTimeout) clearTimeout(session.bufferTimeout);
        const timeoutId = setTimeout(async () => {
            try {
                await processBufferedPhotos(chatId);
            } catch (err) {
                console.error("Timeout handler error:", err);
            }
        }, 3000);

        await sessionService.updateSession(chatId, { photoBuffer: currentBuffer, bufferTimeout: timeoutId });
        return;
    }

    if (text) {
        if (text.toLowerCase().includes('generate') || text.toLowerCase().includes('start')) {
            if (!session.modelImage || session.outfitItems.length === 0) {
                await api.sendMessage(chatId, t.need_model_items);
                return;
            }
            await runGeneration(chatId);
        }
    }
}

let offset = 0;
async function poll() {
    while (true) {
        try {
            const updates = await api.getUpdates(offset);
            if (updates.ok && updates.result.length > 0) {
                for (const update of updates.result) {
                    await processUpdate(update);
                    offset = update.update_id + 1;
                }
            }
        } catch (e) {
            console.error("Poll error", e);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

// REST API for Dashboard
const app = express();
app.use(cors());
app.use(express.json());

app.get('/metrics', async (req: express.Request, res: express.Response) => {
    const filter = (req.query.filter as any) || 'all';
    res.json(await analytics.getMetrics(filter));
});

app.get('/profiles', async (_req: express.Request, res: express.Response) => {
    res.json(await analytics.getUserProfiles());
});

app.post('/gift', async (req: express.Request, res: express.Response) => {
    const { chatId, amount } = req.body;
    const session = await sessionService.getSession(chatId);
    if (session) {
        const newCredits = session.credits + amount;
        await sessionService.updateSession(chatId, { credits: newCredits });

        await analytics.trackPayment(chatId, 0, amount, 'GIFT_FROM_ADMIN');

        const lang = session.language || 'uz';
        const t = TRANSLATIONS[lang];
        const msg = t.gift_received.replace('{amount}', amount.toString());
        await api.sendMessage(chatId, msg, { keyboard: getMenuKeyboard(lang, newCredits) });

        res.json({ success: true, newCredits });
    } else {
        res.status(404).json({ error: "Session not found" });
    }
});

app.listen(PORT, () => {
    console.log(`Bot analytics server running on port ${PORT}`);
    poll();
});
