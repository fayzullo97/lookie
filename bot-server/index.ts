
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
    isolateClothingItem,
    ensureBase64
} from './services/geminiService';
import { removeBackgroundPixLab } from './services/pixlabService';
import { removeImageBackground } from './services/backgroundRemovalService';
import { mergeImages } from './services/imageManipulationService';
import sharp from 'sharp';
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
const PROMO_CREDIT = 20;
let botUsername = ''; // Fetched at startup via getMe()

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
        bg_preview_caption: "🔍 Fon tozalangan natija. Davom etish uchun '✅ Tasdiqlash' tugmasini bosing.",
        bg_preview_confirm_btn: "✅ Tasdiqlash",
        bg_preview_cancel_btn: "❌ Bekor qilish",
        bg_preview_processing: "⏳ Fon tozalanmoqda... Iltimos, biroz kuting.",
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
        sq_error: "Kechirasiz, so'rovnomani saqlashda xatolik yuz berdi. Iltimos keyinroq qayta urinib ko'ring.",
        menu_promo: "🎟 Promo kod",
        promo_msg: "🎉 Tabriklaymiz! Sizning shaxsiy promo kodingiz:\n\n🎟 <code>{code}</code>\n\nBu kodni do'stlaringiz bilan ulashing! Ular bot orqali ro'yxatdan o'tganda, siz ham, do'stingiz ham 20 ta bepul credit olasiz!\n\n👉 Bot havolasi: https://t.me/{bot}?start={code}",
        promo_redeemed: "🎉 Promo kod qabul qilindi! Sizga va do'stingizga 20 ta credit berildi!",
        promo_owner_notify: "🎉 Kimdir sizning promo kodingizdan foydalandi! 20 ta credit qo'shildi!",
        promo_already_used: "⚠️ Siz allaqachon promo koddan foydalangansiz. Har bir foydalanuvchi faqat bitta promo kodni ishlatishi mumkin.",
        promo_own_code: "⚠️ O'z promo kodingizni ishlata olmaysiz.",
        promo_invalid: "⚠️ Noto'g'ri promo kod.",
        promo_share_suggestion: "💡 Do'stlaringizga promo kodingizni ulashing va har biri uchun 20 ta bepul credit oling!\n\n'🎟 Promo kod' tugmasini bosing."
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
        bg_preview_caption: "🔍 Результат удаления фона. Нажмите '✅ Подтвердить', чтобы продолжить генерацию.",
        bg_preview_confirm_btn: "✅ Подтвердить",
        bg_preview_cancel_btn: "❌ Отменить",
        bg_preview_processing: "⏳ Удаление фона... Пожалуйста, подождите.",
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
        sq_error: "Извините, при сохранении опроса произошла ошибка. Пожалуйста, попробуйте позже.",
        menu_promo: "🎟 Промо код",
        promo_msg: "🎉 Поздравляем! Ваш персональный промо-код:\n\n🎟 <code>{code}</code>\n\nПоделитесь этим кодом с друзьями! Когда они зарегистрируются через бот, и вы, и ваш друг получите 20 бесплатных кредитов!\n\n👉 Ссылка на бот: https://t.me/{bot}?start={code}",
        promo_redeemed: "🎉 Промо-код принят! Вам и вашему другу начислено по 20 кредитов!",
        promo_owner_notify: "🎉 Кто-то использовал ваш промо-код! 20 кредитов начислено!",
        promo_already_used: "⚠️ Вы уже использовали промо-код. Каждый пользователь может использовать только один промо-код.",
        promo_own_code: "⚠️ Вы не можете использовать свой собственный промо-код.",
        promo_invalid: "⚠️ Неверный промо-код.",
        promo_share_suggestion: "💡 Поделитесь промо-кодом с друзьями и получите 20 бесплатных кредитов за каждого!\n\nНажмите кнопку '🎟 Промо код'."
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
        [{ text: t.menu_promo }, { text: t.menu_lang }],
        [{ text: t.menu_reset }, { text: t.menu_model }]
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

// --- PROMO CODE HELPERS ---

function generatePromoCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function ensurePromoCode(chatId: number): Promise<string> {
    // Check if user already has a promo code
    const { data: existing } = await supabase
        .from('promo_codes')
        .select('code')
        .eq('user_id', chatId)
        .single();

    if (existing?.code) return existing.code;

    // Generate a unique code (retry if collision)
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generatePromoCode();
        const { error } = await supabase
            .from('promo_codes')
            .insert([{ user_id: chatId, code }]);

        if (!error) {
            console.log(`[PROMO] Created promo code ${code} for user ${chatId}`);
            return code;
        }
        if (error.code === '23505') { // Unique constraint violation
            console.log(`[PROMO] Code ${code} collision, retrying...`);
            continue;
        }
        console.error(`[PROMO] Error creating promo code for ${chatId}:`, error.message);
        break;
    }
    throw new Error('Failed to generate promo code');
}

async function handlePromoCodeButton(chatId: number) {
    const session = await sessionService.getSession(chatId);
    if (!session || !session.language) return;

    const t = TRANSLATIONS[session.language] as any;
    try {
        const code = await ensurePromoCode(chatId);
        const msg = t.promo_msg
            .replace('{code}', code)
            .replace(/{bot}/g, botUsername)
            .replace('{code}', code); // Second occurrence in the URL
        await api.sendMessage(chatId, msg, { parseMode: 'HTML' });
    } catch (err) {
        console.error(`[PROMO] Error fetching promo code for ${chatId}:`, err);
        await api.sendMessage(chatId, '⚠️ Error generating promo code.');
    }
}

async function handlePromoRedemption(chatId: number, promoCode: string) {
    const session = await sessionService.getOrCreateSession(chatId);
    const lang = session.language || 'uz';
    const t = TRANSLATIONS[lang] as any;

    try {
        // 1. Check if code exists
        const { data: codeData } = await supabase
            .from('promo_codes')
            .select('user_id, code')
            .eq('code', promoCode.toUpperCase())
            .single();

        if (!codeData) {
            await api.sendMessage(chatId, t.promo_invalid);
            return;
        }

        // 2. Can't use own code
        if (codeData.user_id === chatId) {
            await api.sendMessage(chatId, t.promo_own_code);
            return;
        }

        // 3. Check if user already redeemed ANY promo code
        const { data: existingRedemption } = await supabase
            .from('promo_redemptions')
            .select('id')
            .eq('redeemed_by', chatId)
            .single();

        if (existingRedemption) {
            await api.sendMessage(chatId, t.promo_already_used);
            return;
        }

        // 4. Redeem: insert redemption record
        const { error: redeemError } = await supabase
            .from('promo_redemptions')
            .insert([{
                code: codeData.code,
                redeemed_by: chatId,
                owner_id: codeData.user_id
            }]);

        if (redeemError) {
            if (redeemError.code === '23505') { // UNIQUE constraint on redeemed_by
                await api.sendMessage(chatId, t.promo_already_used);
            } else {
                console.error(`[PROMO] Redemption insert error:`, redeemError.message);
                await api.sendMessage(chatId, '⚠️ Error redeeming promo code.');
            }
            return;
        }

        // 5. Award credits to BOTH users
        // Award to redeemer
        const newRedeemerCredits = session.credits + PROMO_CREDIT;
        await sessionService.updateSession(chatId, { credits: newRedeemerCredits });
        await api.sendMessage(chatId, t.promo_redeemed, {
            keyboard: getMenuKeyboard(lang, newRedeemerCredits)
        });

        // Award to code owner
        const ownerSession = await sessionService.getSession(codeData.user_id);
        if (ownerSession) {
            const newOwnerCredits = ownerSession.credits + PROMO_CREDIT;
            await sessionService.updateSession(codeData.user_id, { credits: newOwnerCredits });
            const ownerLang = ownerSession.language || 'uz';
            const ownerT = TRANSLATIONS[ownerLang] as any;
            await api.sendMessage(codeData.user_id, ownerT.promo_owner_notify, {
                keyboard: getMenuKeyboard(ownerLang, newOwnerCredits)
            });
        }

        console.log(`[PROMO] Code ${promoCode} redeemed by ${chatId}. Owner: ${codeData.user_id}. Both got ${PROMO_CREDIT} credits.`);

    } catch (err) {
        console.error(`[PROMO] Error during redemption:`, err);
        await api.sendMessage(chatId, '⚠️ Error processing promo code.');
    }
}

async function handleShowBalanceOptions(chatId: number) {
    const session = await sessionService.getSession(chatId);
    if (!session || !session.language) return;

    const t = TRANSLATIONS[session.language] as any;

    // Check if user has already completed the survey
    const { data: surveyData } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('user_id', chatId)
        .limit(1);

    const hasTakenSurvey = surveyData && surveyData.length > 0;

    if (!hasTakenSurvey) {
        // Offer survey first (gives 30 credits)
        const buttons = [[{ text: t.btn_free_credits, callback_data: "start_survey" }]];
        const msg = t.low_credits.replace('{balance}', session.credits.toString());
        await api.sendMessage(chatId, msg, { inlineKeyboard: buttons });
    } else {
        // Already took survey → suggest sharing promo code
        const msg = t.low_credits.replace('{balance}', session.credits.toString());
        await api.sendMessage(chatId, msg);
        await api.sendMessage(chatId, t.promo_share_suggestion);
    }
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
    const t = TRANSLATIONS[session.language] as any;

    if (session.credits < GEN_COST) {
        await handleShowBalanceOptions(chatId);
        return;
    }

    const newCredits = session.credits - GEN_COST;
    await sessionService.updateSession(chatId, { state: AppState.GENERATING });
    await analytics.trackFunnelStep('gen_req');

    const processingMsg = await api.sendMessage(chatId, t.generating);

    try {
        // Step 1: Filter to keep only the FIRST item of each category (User request: 2 tshirt -> 1 tshirt)
        const seenCategories = new Set<string>();
        const dedupedByCat = session.outfitItems.filter(item => {
            if (seenCategories.has(item.category)) return false;
            seenCategories.add(item.category);
            return true;
        });
        console.log(`[GENERATE] Processing ${dedupedByCat.length} unique category items...`);

        // Step 2: Deep copy to avoid mutating the original session state if user cancels
        let processedItems: OutfitItem[] = JSON.parse(JSON.stringify(dedupedByCat));

        // Step 3: Background removal for unique source images
        const uniqueUrls = [...new Set(processedItems.map(i => i.base64))];
        const bgRemovedCache = new Map<string, string>(); // sourceUrl -> bgRemovedBase64
        const originalBase64Map = new Map<string, string>(); // sourceUrl -> originalBase64

        // Step 3: Background removal for unique source images (Parallelized)
        await Promise.all(uniqueUrls.map(async (url) => {
            try {
                const base64Data = await ensureBase64(url);
                if (!base64Data) return;
                originalBase64Map.set(url, base64Data);

                const bgRemoved = await removeImageBackground(base64Data);
                bgRemovedCache.set(url, bgRemoved || base64Data);
            } catch (e) {
                console.error(`[GENERATE] BG removal failed for ${url}. Using original.`, e);
                const originalBase64 = originalBase64Map.get(url) || await ensureBase64(url);
                originalBase64Map.set(url, originalBase64);
                bgRemovedCache.set(url, originalBase64);
            }
        }));

        // Step 4: Isolation (Extracting the specific item and removing the person)
        // Aggressive isolation: run it for all clothing/accessory categories to ensure snippets
        const categoriesToIsolate = [
            ItemCategory.TOP, ItemCategory.BOTTOM, ItemCategory.SHOES,
            ItemCategory.HANDBAG, ItemCategory.HAT, ItemCategory.ACCESSORY,
            ItemCategory.OUTFIT
        ];

        const isolationSuccess = new Set<string>(); // item ID -> boolean
        // Step 4: Isolation (Parallelized - the service will still sequence them but without loop overhead)
        await Promise.all(processedItems.map(async (item, i) => {
            const sourceBase64 = bgRemovedCache.get(item.base64);
            if (!sourceBase64) return;

            if (categoriesToIsolate.includes(item.category)) {
                try {
                    console.log(`[GENERATE] Dispatching isolation for item ${i + 1}/${processedItems.length} (${item.category})...`);
                    const isolated = await isolateClothingItem(GEMINI_KEY, sourceBase64, item.description, USE_MOCK_AI);
                    item.base64 = isolated;
                    item.mimeType = 'image/png';
                    isolationSuccess.add(item.id);
                } catch (e) {
                    console.error(`[GENERATE] Isolation failed for ${item.category}, using bg-removed full photo.`, e);
                    item.base64 = sourceBase64;
                    item.mimeType = 'image/png';
                }
            } else {
                item.base64 = sourceBase64;
                item.mimeType = 'image/png';
            }
        }));

        // Step 5: Filter to only successfully isolated items
        const isolatedItems = processedItems.filter(item => isolationSuccess.has(item.id));

        if (isolatedItems.length === 0) {
            console.error("[GENERATE] No items were successfully isolated. Cannot generate.");
            if (processingMsg?.result?.message_id) await api.deleteMessage(chatId, processingMsg.result.message_id);
            await api.sendMessage(chatId, t.gen_error || '⚠️ Could not isolate any outfit items. Please try again.');
            await sessionService.updateSession(chatId, { state: AppState.AWAITING_OUTFITS });
            return;
        }

        // Step 6: Create the merged collage for generation
        const isolatedBase64s = isolatedItems.map(i => i.base64);
        console.log(`[GENERATE] Creating final merged collage from ${isolatedBase64s.length} items...`);
        const finalMergedOutfit = await mergeImages(isolatedBase64s);

        // Step 7: Prepare prompt and descriptions
        let prompt = "";
        if (USE_MOCK_AI) {
            prompt = "Mock Prompt";
        } else {
            if (!OPENAI_KEY) throw new Error("MISSING_OPENAI_KEY");
            prompt = await generatePromptChatGPT(OPENAI_KEY, isolatedItems, refinement);
        }

        const consolidatedDescriptions = isolatedItems.map(i => `[${i.category}]: ${i.description}`).join('\n');

        // Step 8: Get model image dimensions for aspect ratio preservation
        const modelBase64 = await ensureBase64(session.modelImage!);
        const modelMeta = await sharp(Buffer.from(modelBase64, 'base64')).metadata();
        const aspectRatio = { width: modelMeta.width || 1024, height: modelMeta.height || 1024 };
        console.log(`[GENERATE] Model image aspect ratio: ${aspectRatio.width}x${aspectRatio.height}`);

        // Step 9: Call generation with precisely two images (Model + Collage)
        const generatedBase64 = await generateTryOnImage(
            GEMINI_KEY,
            session.modelImage!,
            finalMergedOutfit,
            consolidatedDescriptions,
            prompt,
            aspectRatio,
            USE_MOCK_AI
        );

        if (!generatedBase64) throw new Error("Generated image is empty");
        if (!USE_MOCK_AI && generatedBase64 === session.modelImage) {
            console.error("[GENERATE] ⚠️ WARNING: Generated image is IDENTICAL to input model!");
        }

        console.log(`[GENERATE] Success. Updating session credits: ${session.credits} -> ${newCredits}`);

        if (isNaN(newCredits)) {
            console.error("[GENERATE] ❌ Critical: newCredits is NaN!", { old: session.credits, cost: GEN_COST });
            throw new Error("Credit calculation error");
        }

        // Delete the processing message
        if (processingMsg?.result?.message_id) {
            await api.deleteMessage(chatId, processingMsg.result.message_id);
        }

        await sessionService.updateSession(chatId, {
            state: AppState.COMPLETED,
            modelImage: generatedBase64,
            outfitItems: [],
            credits: newCredits,
            bgPreviewItems: undefined
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

        // Refresh the custom keyboard Balance digits
        await api.sendMessage(chatId, t.restore_menu, { keyboard: getMenuKeyboard(session.language, newCredits) });

    } catch (error) {
        console.error("Generation error:", error);
        if (processingMsg?.result?.message_id) {
            try { await api.deleteMessage(chatId, processingMsg.result.message_id); } catch (e) { }
        }
        await analytics.trackGeneration(chatId, false, {
            prompt: 'N/A',
            costUsd: 0,
            costCredits: 0,
            error: (error as any).message
        });
        await api.sendMessage(chatId, `⚠️ Generation Error (Debug): ${(error as any).message || JSON.stringify(error)}`);
        await sessionService.updateSession(chatId, { state: AppState.AWAITING_OUTFITS });
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

                // NOTE: Isolation and background removal are now handled in the generation step
                // (runGeneration -> bg removal preview -> continueGenerationAfterPreview -> isolation)

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
            } else if (cb.data === 'confirm_bg_preview') {
                // Legacy: preview step removed, generation runs directly now
                console.log('[FLOW] Received legacy confirm_bg_preview callback, ignoring.');
            } else if (cb.data === 'cancel_bg_preview') {
                // Legacy: preview cancellation
                await sessionService.updateSession(chatId, {
                    state: AppState.AWAITING_OUTFITS,
                    bgPreviewItems: undefined
                });
                await api.sendMessage(chatId, t.reset_keep_model);
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

    if (text === '/start' || text === '/reset' || text?.startsWith('/start ')) {
        // Check for deep link promo code: /start PROMOCODE
        const deepLinkParam = text?.startsWith('/start ') ? text.substring(7).trim() : null;

        // Ensure promo code is generated for this user
        try {
            await ensurePromoCode(chatId);
        } catch (e) {
            console.error(`[PROMO] Failed to ensure promo code for ${chatId} during /start:`, e);
        }

        // If deep link contains a promo code, try to redeem it
        if (deepLinkParam && deepLinkParam.length >= 4 && deepLinkParam !== 'credits_topup') {
            await handlePromoRedemption(chatId, deepLinkParam);
        }

        await sessionService.updateSession(chatId, {
            state: AppState.AWAITING_LANGUAGE,
            modelImage: null,
            originalModelImage: null,
            outfitItems: []
        });

        // Cleanup DB: only clear the outfit queue so the user starts a fresh look with their saved model
        try {
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
    if (text === t.menu_promo) {
        await handlePromoCodeButton(chatId);
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

    // Fetch bot username for promo code links
    try {
        const me: any = await api.getMe();
        if (me?.result?.username) {
            botUsername = me.result.username;
            console.log(`✅ Bot username: @${botUsername}`);
        } else {
            console.error('❌ Could not fetch bot username from getMe()');
        }
    } catch (e) {
        console.error('❌ Failed to call getMe():', e);
    }

    // Check DB connection
    const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if (error) {
        console.error("❌ CRITICAL: Could not connect to Supabase!", error);
    } else {
        console.log("✅ Supabase connection verified.");
    }

    poll();
});
