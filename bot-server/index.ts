
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
    generateTryOnImage,
    isolateClothingItem
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
const USE_MOCK_AI = false; // Force real AI for now to debug 'original image' issue


const GEN_COST = 10;
const MONTHLY_GRANT = 30;

const TRANSLATIONS = {
    uz: {
        welcome_ask_lang: "Assalomu alaykum! Botga xush kelibsiz. 🤖\nIltimos, muloqot tilini tanlang:",
        welcome_start: "Salom! Men sizning AI stilistingizman. ✨\n\nSizga boshlash uchun 30 ta credit sovg'a qilindi! 🎁\nBoshlash uchun o'z rasmingizni yuboring (to'liq bo'y-bast bilan).",
        monthly_grant_msg: "Yangi oy muborak! 🌙 Sizga 30 ta bepul credit qo'shildi. 🎁",
        low_credits: "⚠️ Hisobingizda creditlar yetarli emas. Image yaratish uchun kamida 10 ta credit kerak.\n\nHozirgi balans: {balance} (Need 10)\n\n🎁 Quyidagi 5 ta qisqa savolga javob bering va 30 ta bepul credit oling!",
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
        gen_caption: "Mana sizning yangi lookingiz! ✨\n\n- O'zgartirish uchun yana look elementlarini yuboring.\n- Yoki 'Reset' tugmasini bosing.",
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
        cat_unknown: "Noma'lum",
        btn_free_credits: "🎁 Bepul credit olish",
        sq1_text: "1. Botdan foydalanish jarayoni sizga qanchalik yoqdi?",
        sq2_text: "2. Yaratilgan rasmlar qanchalik real va sifatli chiqdi?",
        sq3_text: "3. Qaysi bosqich siz uchun eng noqulay yoki qiyin bo'ldi?",
        sq3_opt1: "O'zimning rasmimni yuklash",
        sq3_opt2: "Kiyim rasmlarini yuklash",
        sq3_opt3: "Natijani kutish",
        sq3_opt4: "Natija xohlaganimdek chiqmadi",
        sq3_opt5: "Rasmlar sifatsiz yoki sun'iy chiqdi",
        sq3_opt6: "Hammasi a'lo darajada",
        sq3_opt7: "Boshqa",
        sq3_other_prompt: "Iltimos, qaysi qismi noqulay bo'lganini yozib yuboring:",
        sq4_text: "4. Agar bot mukammal ishlasa, u siz uchun qanchalik foydali bo'lar edi?",
        sq5_text: "5. Cheksiz va yuqori sifatli rasmlar yaratish uchun to'lov qilgan bo'larmidingiz?",
        sq5_opt1: "❌ Yo'q, faqat bepul versiyadan foydalanaman",
        sq5_opt2: "💰 Ha, agar narx arzon bo'lsa",
        sq5_opt3: "💎 Ha, agar sifati juda zo'r bo'lsa",
        sq5_opt4: "🛍️ Ha, ayniqsa kiyim sotib olishdan oldin tanlashga yordam bersa",
        sq_thanks: "Fikringiz uchun rahmat! 🎉 Hisobingizga 30 ta bepul credit qo'shildi.",
        sq_error: "Kechirasiz, so'rovnomani saqlashda xatolik yuz berdi. Iltimos keyinroq qayta urinib ko'ring."
    },
    ru: {
        welcome_ask_lang: "Здравствуйте! Добро пожаловать. 🤖\nПожалуйста, выберите язык общения:",
        welcome_start: "Привет! Я ваш ИИ-стилист. ✨\n\nВам начислено 30 приветственных кредитов! 🎁\nЧтобы начать, пожалуйста, отправьте мне ваше фото в полный рост.",
        monthly_grant_msg: "С новым месяцем! 🌙 Вам начислено 30 бесплатных кредитов. 🎁",
        low_credits: "⚠️ Недостаточно кредитов. Для генерации нужно минимум 10 кредитов.\n\nТекущий баланс: {balance} (Need 10)\n\n🎁 Ответьте на 5 коротких вопросов и получите 30 бесплатных кредитов!",
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
        gen_caption: "Вот ваш новый look! ✨\n\n- Отправьте еще элементы для изменения.\n- Или нажмите 'Reset'.",
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
        cat_unknown: "Неизвестно",
        btn_free_credits: "🎁 Получить бесплатные кредиты",
        sq1_text: "1. Насколько вы удовлетворены общим опытом использования бота?",
        sq2_text: "2. Насколько реалистичными и качественными были сгенерированные изображения?",
        sq3_text: "3. Какая часть была самой разочаровывающей или сложной?",
        sq3_opt1: "Загрузка фото модели",
        sq3_opt2: "Загрузка фото одежды",
        sq3_opt3: "Ожидание генерации",
        sq3_opt4: "Результат не соответствует моему запросу",
        sq3_opt5: "Проблемы с реалистичностью изображения",
        sq3_opt6: "Ничего — все прошло гладко",
        sq3_opt7: "Другое",
        sq3_other_prompt: "Пожалуйста, напишите, что было самым разочаровыющим:",
        sq4_text: "4. Если бы этот бот работал идеально, насколько он был бы ценен для вас?",
        sq5_text: "5. Готовы ли вы платить за безлимитные или премиальные генерации?",
        sq5_opt1: "❌ Нет, я буду использовать только бесплатную версию",
        sq5_opt2: "💰 Да, если цена будет низкой",
        sq5_opt3: "💎 Да, если качество будет очень высоким",
        sq5_opt4: "🛍️ Да, особенно если это поможет выбрать одежду перед покупкой",
        sq_thanks: "Спасибо за ваш отзыв! 🎉 30 бесплатных кредитов добавлены на ваш счет.",
        sq_error: "Извините, при сохранении опроса произошла ошибка. Пожалуйста, попробуйте позже."
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
    const buttons = [[{ text: t.btn_free_credits, callback_data: "start_survey" }]];

    // Send the merged low credits + survey prompt
    const msg = t.low_credits.replace('{balance}', session.credits.toString());
    await api.sendMessage(chatId, msg, { inlineKeyboard: buttons });
}

// Survey Question Senders
async function sendSurveyQuestion(chatId: number, messageId: number | null, state: AppState, language: string) {
    const t = TRANSLATIONS[language as Language] || TRANSLATIONS['uz'];
    let questionText = "";
    let buttons: { text: string, callback_data: string }[][] = [];

    if (state === AppState.SURVEY_Q1) {
        questionText = t.sq1_text;
        buttons = [[
            { text: "1", callback_data: "sq1_1" },
            { text: "2", callback_data: "sq1_2" },
            { text: "3", callback_data: "sq1_3" },
            { text: "4", callback_data: "sq1_4" },
            { text: "5", callback_data: "sq1_5" }
        ]];
    } else if (state === AppState.SURVEY_Q2) {
        questionText = t.sq2_text;
        buttons = [[
            { text: "1", callback_data: "sq2_1" },
            { text: "2", callback_data: "sq2_2" },
            { text: "3", callback_data: "sq2_3" },
            { text: "4", callback_data: "sq2_4" },
            { text: "5", callback_data: "sq2_5" }
        ]];
    } else if (state === AppState.SURVEY_Q3) {
        questionText = t.sq3_text;
        buttons = [
            [{ text: t.sq3_opt1, callback_data: "sq3_upload_model" }],
            [{ text: t.sq3_opt2, callback_data: "sq3_upload_outfit" }],
            [{ text: t.sq3_opt3, callback_data: "sq3_waiting" }],
            [{ text: t.sq3_opt4, callback_data: "sq3_bad_result" }],
            [{ text: t.sq3_opt5, callback_data: "sq3_fake_result" }],
            [{ text: t.sq3_opt6, callback_data: "sq3_nothing" }],
            [{ text: t.sq3_opt7, callback_data: "sq3_other" }]
        ];
    } else if (state === AppState.SURVEY_Q4) {
        questionText = t.sq4_text;
        buttons = [[
            { text: "1", callback_data: "sq4_1" },
            { text: "2", callback_data: "sq4_2" },
            { text: "3", callback_data: "sq4_3" },
            { text: "4", callback_data: "sq4_4" },
            { text: "5", callback_data: "sq4_5" }
        ]];
    } else if (state === AppState.SURVEY_Q5) {
        questionText = t.sq5_text;
        buttons = [
            [{ text: t.sq5_opt1, callback_data: "sq5_no" }],
            [{ text: t.sq5_opt2, callback_data: "sq5_yes_low_price" }],
            [{ text: t.sq5_opt3, callback_data: "sq5_yes_high_quality" }],
            [{ text: t.sq5_opt4, callback_data: "sq5_yes_shopping" }]
        ];
    }

    if (messageId) {
        await api.editMessageText(chatId, messageId, questionText, { inlineKeyboard: buttons });
    } else {
        await api.sendMessage(chatId, questionText, { inlineKeyboard: buttons });
    }
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
        const { error: delErr } = await supabase.from('outfit_queue').delete().eq('user_id', chatId);
        if (delErr) console.error(`[DB] Error deleting outfit queue for ${chatId}:`, delErr.message);

        await api.sendPhoto(chatId, restoreImage, t.reset_keep_model);
    } else {
        await sessionService.updateSession(chatId, {
            state: AppState.AWAITING_MODEL_IMAGE,
            modelImage: null,
            originalModelImage: null,
            outfitItems: []
        });

        // Cleanup DB
        const { error: delErr2 } = await supabase.from('outfit_queue').delete().eq('user_id', chatId);
        if (delErr2) console.error(`[DB] Error deleting outfit queue for ${chatId}:`, delErr2.message);
        const { error: updErr } = await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
        if (updErr) console.error(`[DB] Error resetting model images for ${chatId}:`, updErr.message);

        await api.sendMessage(chatId, t.reset_full);
    }
}

async function runGeneration(chatId: number, refinement?: string) {
    const session = await sessionService.getSession(chatId);
    if (!session || !session.modelImage || !session.language) return;
    const t = TRANSLATIONS[session.language];

    if (session.credits < GEN_COST) {
        await handleShowBalanceOptions(chatId);
        return;
    }

    const newCredits = session.credits - GEN_COST;
    await sessionService.updateSession(chatId, { state: AppState.GENERATING });

    await analytics.trackFunnelStep('gen_req');

    const processingMsg = await api.sendMessage(chatId, t.generating);

    try {
        let processedItems = [...session.outfitItems];

        // Isolate clothing for items that contain a person
        for (let i = 0; i < processedItems.length; i++) {
            if (processedItems[i].containsPerson) {
                try {
                    console.log(`[GENERATE] Item ${i} contains a person. Isolating clothing...`);
                    const isolatedBase64 = await isolateClothingItem(GEMINI_KEY, processedItems[i].base64, processedItems[i].description, USE_MOCK_AI);
                    processedItems[i].base64 = isolatedBase64;
                } catch (isoErr) {
                    console.error(`[GENERATE] Failed to isolate clothing for item ${i}. Proceeding with original.`, isoErr);
                }
            }
        }

        let prompt = "";
        if (USE_MOCK_AI) {
            prompt = "Mock Prompt";
        } else {
            if (!OPENAI_KEY) throw new Error("MISSING_OPENAI_KEY");
            prompt = await generatePromptChatGPT(OPENAI_KEY, processedItems, refinement);
        }

        let base64Model = session.modelImage;
        if (base64Model?.startsWith('http')) {
            try {
                const modelRes = await fetch(base64Model);
                if (modelRes.ok) {
                    const arrBuff = await modelRes.arrayBuffer();
                    base64Model = Buffer.from(arrBuff).toString('base64');
                } else {
                    console.error(`[GENERATE] Failed to fetch model image from URL: ${base64Model}`);
                }
            } catch (fetchErr) {
                console.error(`[GENERATE] Exception fetching model image:`, fetchErr);
            }
        }

        // Convert outfit item URLs to base64 (items are stored as Supabase public URLs)
        const base64Items = await Promise.all(processedItems.map(async (item, i) => {
            if (item.base64?.startsWith('http')) {
                try {
                    const res = await fetch(item.base64);
                    if (res.ok) {
                        const buf = await res.arrayBuffer();
                        return { ...item, base64: Buffer.from(buf).toString('base64'), mimeType: 'image/jpeg' };
                    } else {
                        console.error(`[GENERATE] Failed to fetch outfit item ${i} from URL: ${item.base64}`);
                    }
                } catch (fetchErr) {
                    console.error(`[GENERATE] Exception fetching outfit item ${i}:`, fetchErr);
                }
            }
            return item;
        }));

        const generatedBase64 = await generateTryOnImage(GEMINI_KEY, base64Model, base64Items, prompt, USE_MOCK_AI);

        if (!generatedBase64) throw new Error("Generated image is empty");
        if (!USE_MOCK_AI && generatedBase64 === base64Model) {
            console.error("[GENERATE] ⚠️ WARNING: Generated image is IDENTICAL to input model!");
        }

        console.log(`[GENERATE] Success. Updating session credits: ${session.credits} -> ${newCredits}`);

        if (isNaN(newCredits)) {
            console.error("[GENERATE] ❌ Critical: newCredits is NaN!", { old: session.credits, cost: GEN_COST });
            throw new Error("Credit calculation error");
        }

        await sessionService.updateSession(chatId, {
            state: AppState.COMPLETED,
            modelImage: generatedBase64,
            outfitItems: [],
            credits: newCredits
        });

        // Verify update
        const verifySession = await sessionService.getSession(chatId);
        console.log(`[GENERATE] Session verified credits: ${verifySession?.credits}`);

        // Clear queue in DB
        const { error: clearErr } = await supabase.from('outfit_queue').delete().eq('user_id', chatId);
        if (clearErr) console.error(`[DB] Error clearing outfit queue after generation for ${chatId}:`, clearErr.message);

        // Send photo with inline buttons
        const buttons = [[{ text: t.reset_btn, callback_data: "reset_session" }]];
        await api.sendPhoto(chatId, generatedBase64, t.gen_caption, buttons);

        // Send an invisible/menu-updating system message to refresh the custom keyboard Balance digits
        await api.sendMessage(chatId, t.restore_menu, { keyboard: getMenuKeyboard(session.language, newCredits) });

    } catch (error) {
        console.error("Generation error:", error);
        await analytics.trackGeneration(chatId, false, {
            prompt: 'N/A',
            costUsd: 0,
            costCredits: 0,
            error: (error as any).message
        });
        const errSettings = (error as any);
        await api.sendMessage(chatId, `⚠️ Generation Error (Debug): ${errSettings.message || JSON.stringify(error)}`);
    }
}

async function processBufferedPhotos(chatId: number) {
    try {
        const session = await sessionService.getSession(chatId);
        if (!session || !session.photoBuffer || session.photoBuffer.length === 0) return;

        const t = TRANSLATIONS[session.language || 'uz'];

        if (session.state === AppState.AWAITING_MODEL_IMAGE || session.state === AppState.NEW_USER || session.state === AppState.AWAITING_LANGUAGE) {
            const lastImage = session.photoBuffer[session.photoBuffer.length - 1];
            const processingMsg = await api.sendMessage(chatId, t.processing_model);
            const validation = await validateModelImage(GEMINI_KEY, lastImage, USE_MOCK_AI);

            if (processingMsg?.result?.message_id) await api.deleteMessage(chatId, processingMsg.result.message_id);

            if (validation.valid) {
                await analytics.trackModelValidation(chatId, true);
                await analytics.trackFunnelStep('model');

                // Upload to Supabase Storage
                const path = `models/${chatId}/${Date.now()}.jpg`;
                const { url: publicUrl, error: uploadErr } = await SupabaseStorageService.uploadImage('user-uploads', path, lastImage, 'image/jpeg');

                if (publicUrl) {
                    // Save to DB
                    const { error: updateError } = await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
                    if (updateError) console.error(`[DB] Error resetting old model images for ${chatId}:`, updateError);

                    const { error: insertError } = await supabase.from('model_images').insert([{
                        user_id: chatId,
                        storage_path: publicUrl,
                        is_current: true
                    }]);

                    if (insertError) {
                        console.error(`[DB] Error saving model image for ${chatId}:`, insertError);
                        throw new Error("Failed to save model image to DB");
                    }

                    console.log(`[DB] Model image saved to DB for ${chatId}.`);

                    await sessionService.updateSession(chatId, {
                        modelImage: publicUrl,
                        originalModelImage: publicUrl,
                        modelGender: validation.gender,
                        state: AppState.AWAITING_OUTFITS,
                        photoBuffer: []
                    });
                    await api.sendMessage(chatId, t.model_saved);
                } else {
                    await api.sendMessage(chatId, `⚠️ Error saving image: ${uploadErr || 'Unknown error'}`);
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
                const originalImageBase64 = imagesToProcess[res.imageIndex] || imagesToProcess[0];
                let finalImageBase64 = originalImageBase64;
                let containsPerson = res.containsPerson;

                // Move isolation step here from generation to save time.
                // If it contains a person, isolate it immediately before saving.
                if (containsPerson) {
                    try {
                        console.log(`[PROCESS] Isolating item ${i} (${res.category})...`);
                        finalImageBase64 = await isolateClothingItem(GEMINI_KEY, originalImageBase64, res.description, USE_MOCK_AI);
                        containsPerson = false; // Isolated now
                    } catch (isoErr) {
                        console.error(`[PROCESS] Isolation failed for ${i}, using original.`, isoErr);
                    }
                } else if (PIXLAB_KEY && [ItemCategory.OUTFIT, ItemCategory.TOP, ItemCategory.BOTTOM, ItemCategory.SHOES, ItemCategory.HANDBAG, ItemCategory.HAT, ItemCategory.ACCESSORY].includes(res.category as ItemCategory)) {
                    // Start of legacy PixLab support (Optional)
                    try {
                        console.log(`[PROCESS] Clearing background for item ${i} (${res.category})...`);
                        finalImageBase64 = await removeBackgroundPixLab(PIXLAB_KEY, originalImageBase64, USE_MOCK_AI);
                    } catch (pixError) {
                        console.error(`[PROCESS] PixLab failed for item ${i}. Using original.`, pixError);
                    }
                }

                const path = `items/${chatId}/${Date.now()}_${i}.jpg`;
                const { url: publicUrl, error: uploadErr } = await SupabaseStorageService.uploadImage('user-uploads', path, finalImageBase64, containsPerson || !PIXLAB_KEY ? 'image/jpeg' : 'image/png');

                if (publicUrl) {
                    const { data: queueItem, error: queueError } = await supabase.from('outfit_queue').insert([{
                        user_id: chatId,
                        storage_path: publicUrl,
                        category: res.category,
                        description: res.description,
                        mime_type: containsPerson || !PIXLAB_KEY ? 'image/jpeg' : 'image/png'
                    }]).select().single();

                    if (queueError) {
                        console.error(`[DB] ❌ Failed to insert outfit queue item for ${chatId}:`, queueError.message);
                    } else {
                        console.log(`[DB] ✅ Outfit item queued for ${chatId}: ${res.category}`);
                    }

                    newItems.push({
                        id: queueItem?.id || Date.now().toString(),
                        category: res.category as ItemCategory,
                        description: res.description,
                        base64: publicUrl,
                        mimeType: containsPerson || !PIXLAB_KEY ? 'image/jpeg' : 'image/png',
                        containsPerson: containsPerson
                    });
                } else {
                    console.error(`[PROCESS] Failed to upload outfit item ${i}: ${uploadErr}`);
                    if (i === 0) await api.sendMessage(chatId, `⚠️ Error saving item: ${uploadErr}`);
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
            await sessionService.updateSession(chatId, { photoBuffer: [] });
        }
    } catch (err: any) {
        console.error(`[PROCESS] Global error in processBufferedPhotos for ${chatId}:`, err);
        // Try to notify the user if possible
        try {
            const session = await sessionService.getSession(chatId);
            // Send EXACT error for debugging
            await api.sendMessage(chatId, `⚠️ Xatolik (Debug): ${err.message || 'Unknown error'}`);

            // Fallback to generic message if needed later
            // if (session && session.language) {
            //     const t = TRANSLATIONS[session.language];
            //     await api.sendMessage(chatId, t.gen_error);
            // }
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

                console.log(`[FLOW] Lang set to ${selectedLang}. Model image: ${session.modelImage}`);

                let sentModel = false;
                if (session.modelImage) {
                    try {
                        // Merge language + state update into one atomic call
                        await sessionService.updateSession(chatId, { language: selectedLang, state: AppState.AWAITING_OUTFITS });
                        await api.sendMessage(chatId, t.lang_updated, { keyboard: getMenuKeyboard(selectedLang, credits) });
                        const inlineBtns = [[{ text: t.btn_change_model, callback_data: 'change_model_inline' }]];
                        await api.sendPhoto(chatId, session.modelImage, t.existing_model_found, inlineBtns);
                        sentModel = true;
                    } catch (sendErr) {
                        console.error(`[FLOW] Failed to send existing model image:`, sendErr);
                        // Fallback to asking for new image
                    }
                }

                if (!sentModel) {
                    // Merge language + state update into one atomic call
                    await sessionService.updateSession(chatId, { language: selectedLang, state: AppState.AWAITING_MODEL_IMAGE });
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
                const { error: e1 } = await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
                if (e1) console.error(`[DB] Error resetting model images:`, e1.message);
                const { error: e2 } = await supabase.from('outfit_queue').delete().eq('user_id', chatId);
                if (e2) console.error(`[DB] Error clearing outfit queue:`, e2.message);

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

            // Survey Handlers
            if (cb.data === 'start_survey') {
                await sessionService.updateSession(chatId, { state: AppState.SURVEY_Q1, surveyAnswers: {} });
                await sendSurveyQuestion(chatId, cb.message?.message_id || null, AppState.SURVEY_Q1, session.language || 'uz');
                return;
            }

            if (cb.data.startsWith('sq1_')) {
                const ans = parseInt(cb.data.split('_')[1], 10);
                const answers = session.surveyAnswers || {};
                answers.q1 = ans;
                await sessionService.updateSession(chatId, { state: AppState.SURVEY_Q2, surveyAnswers: answers });
                await sendSurveyQuestion(chatId, cb.message?.message_id || null, AppState.SURVEY_Q2, session.language || 'uz');
                return;
            }
            if (cb.data.startsWith('sq2_')) {
                const ans = parseInt(cb.data.split('_')[1], 10);
                const answers = session.surveyAnswers || {};
                answers.q2 = ans;
                await sessionService.updateSession(chatId, { state: AppState.SURVEY_Q3, surveyAnswers: answers });
                await sendSurveyQuestion(chatId, cb.message?.message_id || null, AppState.SURVEY_Q3, session.language || 'uz');
                return;
            }
            if (cb.data.startsWith('sq3_')) {
                const ansKey = cb.data.replace('sq3_', '');
                let ansStr = ansKey;
                const t = TRANSLATIONS[session.language || 'uz'] as any;
                if (ansKey === 'upload_model') ansStr = t.sq3_opt1;
                else if (ansKey === 'upload_outfit') ansStr = t.sq3_opt2;
                else if (ansKey === 'waiting') ansStr = t.sq3_opt3;
                else if (ansKey === 'bad_result') ansStr = t.sq3_opt4;
                else if (ansKey === 'fake_result') ansStr = t.sq3_opt5;
                else if (ansKey === 'nothing') ansStr = t.sq3_opt6;
                else if (ansKey === 'other') ansStr = t.sq3_opt7;

                const answers = session.surveyAnswers || {};
                answers.q3 = ansStr;

                if (ansKey === 'other') {
                    // We need text input. Leave state at Q3_OTHER (implicit) or just WAIT for text.
                    answers.q3_other_pending = true;
                    await sessionService.updateSession(chatId, { surveyAnswers: answers });

                    if (cb.message?.message_id) {
                        await api.deleteMessage(chatId, cb.message.message_id);
                    }
                    await api.sendMessage(chatId, t.sq3_other_prompt);
                    return;
                } else {
                    await sessionService.updateSession(chatId, { state: AppState.SURVEY_Q4, surveyAnswers: answers });
                    await sendSurveyQuestion(chatId, cb.message?.message_id || null, AppState.SURVEY_Q4, session.language || 'uz');
                    return;
                }
            }
            if (cb.data.startsWith('sq4_')) {
                const ans = parseInt(cb.data.split('_')[1], 10);
                const answers = session.surveyAnswers || {};
                answers.q4 = ans;
                await sessionService.updateSession(chatId, { state: AppState.SURVEY_Q5, surveyAnswers: answers });
                await sendSurveyQuestion(chatId, cb.message?.message_id || null, AppState.SURVEY_Q5, session.language || 'uz');
                return;
            }
            if (cb.data.startsWith('sq5_')) {
                const ansKey = cb.data.replace('sq5_', '');
                const t = TRANSLATIONS[session.language || 'uz'] as any;
                let ansStr = ansKey;
                if (ansKey === 'no') ansStr = t.sq5_opt1;
                else if (ansKey === 'yes_low_price') ansStr = t.sq5_opt2;
                else if (ansKey === 'yes_high_quality') ansStr = t.sq5_opt3;
                else if (ansKey === 'yes_shopping') ansStr = t.sq5_opt4;

                const answers = session.surveyAnswers || {};
                answers.q5 = ansStr;

                if (cb.message?.message_id) {
                    await api.deleteMessage(chatId, cb.message.message_id);
                }

                // End of Survey!
                try {
                    await analytics.saveSurveyResponse({
                        user_id: chatId,
                        username: session.username || undefined,
                        q1_satisfaction: answers.q1 || 0,
                        q2_realism: answers.q2 || 0,
                        q3_frustration: answers.q3 || '',
                        q3_frustration_other: answers.q3_other || '',
                        q4_value: answers.q4 || 0,
                        q5_payment: answers.q5 || ''
                    });

                    // Add credits and reset to idle/model state
                    const newCredits = session.credits + 30;
                    await sessionService.updateSession(chatId, {
                        state: AppState.AWAITING_OUTFITS, // Put them back so they can generate
                        credits: newCredits,
                        surveyAnswers: {}
                    });

                    await api.sendMessage(chatId, "🎉");
                    await api.sendMessage(chatId, t.sq_thanks, {
                        keyboard: getMenuKeyboard(session.language || 'uz', newCredits)
                    });
                } catch (saveError) {
                    console.error("Failed to save survey:", saveError);
                    await api.sendMessage(chatId, t.sq_error);
                }
                return;
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
        await sessionService.updateSession(chatId, {
            state: AppState.AWAITING_LANGUAGE,
            modelImage: null,
            originalModelImage: null,
            outfitItems: []
        });

        // Cleanup DB to ensure a fresh start
        try {
            const { error: eStart1 } = await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
            if (eStart1) console.error(`[FLOW] Error resetting model images during /start:`, eStart1.message);

            const { error: eStart2 } = await supabase.from('outfit_queue').delete().eq('user_id', chatId);
            if (eStart2) console.error(`[FLOW] Error clearing outfit queue during /start:`, eStart2.message);
        } catch (dbErr) {
            console.error(`[FLOW] DB Cleanup failed during /start:`, dbErr);
        }

        const keyboard = [[
            { text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" },
            { text: "🇷🇺 Русский", callback_data: "lang_ru" }
        ]];
        await api.sendMessage(chatId, TRANSLATIONS['uz'].welcome_ask_lang, { inlineKeyboard: keyboard, removeKeyboard: true });
        return;
    }

    // Handle Survey "Other" Text Input
    if (session.state === AppState.SURVEY_Q3 && session.surveyAnswers?.q3_other_pending && text) {
        const answers = session.surveyAnswers || {};
        answers.q3_other = text;
        delete answers.q3_other_pending;
        await sessionService.updateSession(chatId, { state: AppState.SURVEY_Q4, surveyAnswers: answers });
        await sendSurveyQuestion(chatId, null, AppState.SURVEY_Q4, session.language || 'uz');
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
        const { error: e3 } = await supabase.from('model_images').update({ is_current: false }).eq('user_id', chatId);
        if (e3) console.error(`[DB] Error resetting model images:`, e3.message);
        const { error: e4 } = await supabase.from('outfit_queue').delete().eq('user_id', chatId);
        if (e4) console.error(`[DB] Error clearing outfit queue:`, e4.message);

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

app.get('/surveys', async (_req: express.Request, res: express.Response) => {
    try {
        const surveys = await analytics.getSurveyResponses();
        res.json(surveys);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, async () => {
    console.log(`Bot analytics server running on port ${PORT}`);

    // Check DB connection
    const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if (error) {
        console.error("❌ CRITICAL: Could not connect to Supabase!", error);
    } else {
        console.log("✅ Supabase connection verified.");
    }

    poll();
});
