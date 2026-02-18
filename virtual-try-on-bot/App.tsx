
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TelegramService } from './services/telegramService';
import { 
  AppState, 
  UserSession, 
  TelegramUpdate,
  ItemCategory,
  OutfitItem,
  AnalyticsMetrics,
  Language,
  DateRangeFilter
} from './types';
import { 
  validateModelImage, 
  categorizeOutfitItemsBatch,
  generateTryOnImage
} from './services/geminiService';
import { removeBackgroundPixLab } from './services/pixlabService';
import { generatePromptChatGPT } from './services/openaiService';
import { analytics } from './services/analyticsService';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { ENV } from './config';

// --- Types ---
interface LogEntry {
  time: string;
  type: 'info' | 'error' | 'msg';
  text: string;
}

// --- Constants ---
const GEN_COST = 10;
const INITIAL_CREDITS = 30;
const MONTHLY_GRANT = 30;

// Payment Packages
const PAYMENT_PACKAGES = [
  { id: 'pkg_100', credits: 100, price: 10000, label: "10.000 so'm -> 100 credit" },
  { id: 'pkg_160', credits: 160, price: 15000, label: "15.000 so'm -> 160 credit" },
  { id: 'pkg_300', credits: 300, price: 25000, label: "25.000 so'm -> 300 credit" },
  { id: 'pkg_400', credits: 400, price: 30000, label: "30.000 so'm -> 400 credit" }
];

// --- Translations ---
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(analytics.getMetrics('all'));

  // Config State - Initialize from Config File first, then LocalStorage
  const [telegramToken, setTelegramToken] = useState(() => localStorage.getItem('bot_cfg_telegram') || ENV.TELEGRAM_TOKEN);
  const [providerToken, setProviderToken] = useState(() => localStorage.getItem('bot_cfg_provider') || ENV.PROVIDER_TOKEN); 
  const [openaiToken, setOpenaiToken] = useState(() => localStorage.getItem('bot_cfg_openai') || ENV.OPENAI_KEY);
  const [geminiToken, setGeminiToken] = useState(() => localStorage.getItem('bot_cfg_gemini') || ENV.GEMINI_KEY);
  const [pixlabToken, setPixlabToken] = useState(() => localStorage.getItem('bot_cfg_pixlab') || ENV.PIXLAB_KEY);
  const [isBotRunning, setIsBotRunning] = useState(false);
  
  // Use config default only if not in localstorage, otherwise standard check
  const [useMockAI, setUseMockAI] = useState(() => {
    const stored = localStorage.getItem('bot_cfg_mock');
    return stored !== null ? stored === 'true' : ENV.USE_MOCK_AI;
  });
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<number>(0);
  
  const isRunningRef = useRef(false);
  const offsetRef = useRef(0);
  const sessionsRef = useRef<Record<number, UserSession>>({});
  const telegramRef = useRef<TelegramService | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll for metrics updates every 5s, respecting the filter
  useEffect(() => {
    // Initial fetch on filter change
    setMetrics(analytics.getMetrics(dateFilter));

    const interval = setInterval(() => {
        setMetrics(analytics.getMetrics(dateFilter));
    }, 5000);
    return () => clearInterval(interval);
  }, [dateFilter]);

  // Persist Config Changes
  useEffect(() => { localStorage.setItem('bot_cfg_telegram', telegramToken); }, [telegramToken]);
  useEffect(() => { localStorage.setItem('bot_cfg_provider', providerToken); }, [providerToken]);
  useEffect(() => { localStorage.setItem('bot_cfg_openai', openaiToken); }, [openaiToken]);
  useEffect(() => { localStorage.setItem('bot_cfg_gemini', geminiToken); }, [geminiToken]);
  useEffect(() => { localStorage.setItem('bot_cfg_pixlab', pixlabToken); }, [pixlabToken]);
  useEffect(() => { localStorage.setItem('bot_cfg_mock', String(useMockAI)); }, [useMockAI]);

  const log = useCallback((text: string, type: 'info' | 'error' | 'msg' = 'info') => {
    const entry: LogEntry = {
      time: new Date().toLocaleTimeString(),
      type,
      text
    };
    setLogs(prev => [...prev.slice(-99), entry]); 
    analytics.trackError('log_' + type); // rough tracking
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- ADMIN ACTIONS ---
  
  const handleGiftCredits = async (chatId: number, amount: number) => {
    const session = sessionsRef.current[chatId];
    if (session) {
      const newBalance = session.credits + amount;
      updateSession(chatId, { credits: newBalance });
      
      // Update analytics (mock payment for tracking, or just simple log)
      // Here we won't track it as revenue, just user balance update.
      log(`Admin gifted ${amount} credits to User ${chatId}. New Balance: ${newBalance}`, 'msg');
      
      // Notify User
      if (telegramRef.current && session.language) {
          const t = TRANSLATIONS[session.language];
          const msg = t.gift_received.replace('{amount}', amount.toString());
          await telegramRef.current.sendMessage(chatId, msg, {
              keyboard: getMenuKeyboard(session.language, newBalance)
          });
      }
    } else {
        log(`Failed to gift credits. User ${chatId} session not found in memory.`, 'error');
    }
  };

  // --- BOT LOGIC HANDLERS ---

  const checkMonthlyGrant = async (chatId: number, api: TelegramService) => {
    const session = sessionsRef.current[chatId];
    if (!session || !session.language) return;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const isFirstDay = now.getDate() === 1;

    if (isFirstDay && session.lastMonthlyGrant !== currentMonthKey) {
        const t = TRANSLATIONS[session.language];
        const newCredits = session.credits + MONTHLY_GRANT;
        updateSession(chatId, { 
            credits: newCredits, 
            lastMonthlyGrant: currentMonthKey 
        });
        await api.sendMessage(chatId, t.monthly_grant_msg, { keyboard: getMenuKeyboard(session.language, newCredits) });
        log(`Monthly grant given to User ${chatId}`, 'info');
    }
  };

  const getOrCreateSession = (chatId: number, userInfo?: { username?: string, first_name?: string }): UserSession => {
    if (!sessionsRef.current[chatId]) {
      sessionsRef.current[chatId] = {
        chatId,
        username: userInfo?.username,
        state: AppState.NEW_USER,
        modelImage: null,
        originalModelImage: null,
        outfitItems: [],
        lastActivity: Date.now(),
        credits: INITIAL_CREDITS,
        photoBuffer: [],
        bufferTimeout: null
      };
      setActiveSessions(Object.keys(sessionsRef.current).length);
      log(`New user ${chatId} initialized with ${INITIAL_CREDITS} credits`, 'info');
      
      // Analytics Track: New User & Funnel Start
      analytics.trackUserActivity(chatId, { username: userInfo?.username, firstName: userInfo?.first_name });
      analytics.trackFunnelStep('start');
    } else {
      // Analytics Track: Active User
      analytics.trackUserActivity(chatId, { username: userInfo?.username, firstName: userInfo?.first_name });
    }
    return sessionsRef.current[chatId];
  };

  const updateSession = (chatId: number, updates: Partial<UserSession>) => {
    if (sessionsRef.current[chatId]) {
      sessionsRef.current[chatId] = { ...sessionsRef.current[chatId], ...updates };
    }
  };

  const handleShowBalanceOptions = async (chatId: number, api: TelegramService) => {
    const session = sessionsRef.current[chatId];
    if (!session || !session.language) return;
    const t = TRANSLATIONS[session.language];
    
    const buttons = PAYMENT_PACKAGES.map(pkg => ([{
      text: pkg.label,
      callback_data: `buy_${pkg.id}`
    }]));

    await api.sendMessage(chatId, t.balance_topup_msg, { inlineKeyboard: buttons });
  };

  const handleSendInvoice = async (chatId: number, api: TelegramService, packageId: string) => {
    const session = sessionsRef.current[chatId];
    if (!session || !session.language || !providerToken) {
      if (!providerToken) log(`Provider Token missing for invoice!`, 'error');
      return;
    }

    const pkg = PAYMENT_PACKAGES.find(p => `buy_${p.id}` === packageId || p.id === packageId);
    if (!pkg) return;

    const res = await api.sendInvoice({
      chatId,
      title: `${pkg.credits} Credits`,
      description: `Virtual Try-On Bot Credits - ${pkg.credits} units`,
      payload: pkg.id,
      providerToken: providerToken,
      currency: 'UZS',
      prices: [{ label: `${pkg.credits} credits`, amount: pkg.price * 100 }]
    });

    if (!res.ok) {
      log(`Invoice failed: ${JSON.stringify(res)}`, 'error');
      analytics.trackError('invoice_failed');
    }
  };

  const handleResetLook = async (chatId: number, api: TelegramService) => {
    const session = sessionsRef.current[chatId];
    const lang = session.language || 'uz';
    const t = TRANSLATIONS[lang];
    const restoreImage = session.originalModelImage || session.modelImage;
    
    if (restoreImage) {
        updateSession(chatId, { 
            state: AppState.AWAITING_OUTFITS, 
            modelImage: restoreImage, 
            outfitItems: [] 
        });
        await api.sendPhoto(chatId, restoreImage, t.reset_keep_model);
    } else {
        updateSession(chatId, { 
            state: AppState.AWAITING_MODEL_IMAGE,
            modelImage: null,
            originalModelImage: null,
            outfitItems: []
        });
        await api.sendMessage(chatId, t.reset_full);
    }
  };

  const processBufferedPhotos = async (chatId: number) => {
    const session = sessionsRef.current[chatId];
    const api = telegramRef.current;
    if (!session || !api || session.photoBuffer.length === 0) return;

    const t = TRANSLATIONS[session.language || 'uz'];
    
    if (session.state === AppState.AWAITING_MODEL_IMAGE || session.state === AppState.NEW_USER) {
         const lastImage = session.photoBuffer[session.photoBuffer.length - 1];
         const processingMsg = await api.sendMessage(chatId, t.processing_model);
         const validation = await validateModelImage(geminiToken, lastImage, useMockAI);
         
         if (processingMsg?.result?.message_id) await api.deleteMessage(chatId, processingMsg.result.message_id);

         if (validation.valid) {
             // Analytics
             analytics.trackModelValidation(chatId, true);
             analytics.trackFunnelStep('model');

             updateSession(chatId, { 
                 modelImage: lastImage, 
                 originalModelImage: lastImage, 
                 modelGender: validation.gender,
                 state: AppState.AWAITING_OUTFITS,
                 photoBuffer: [] 
             });
             await api.sendMessage(chatId, t.model_saved);
         } else {
             analytics.trackModelValidation(chatId, false);
             analytics.trackError('model_validation_failed');
             updateSession(chatId, { photoBuffer: [] });
             await api.sendMessage(chatId, t.invalid_model);
         }
    }
    else if (session.state === AppState.AWAITING_OUTFITS || session.state === AppState.COMPLETED) {
        const imagesToProcess = session.photoBuffer.slice(0, 4); 
        const statusMsg = await api.sendMessage(chatId, t.processing_items);
        const batchResults = await categorizeOutfitItemsBatch(geminiToken, imagesToProcess, useMockAI);

        if (statusMsg?.result?.message_id) await api.deleteMessage(chatId, statusMsg.result.message_id);

        if (batchResults.length > 0 && batchResults[0].description === "429_QUOTA_EXCEEDED") {
            updateSession(chatId, { photoBuffer: [] }); 
            await api.sendMessage(chatId, t.quota_exceeded);
            analytics.trackError('quota_exceeded');
            return;
        }

        // Restriction Checks
        const prohibitedItem = batchResults.find(r => r.isProhibited);
        if (prohibitedItem) {
           analytics.trackError('prohibited_content');
           updateSession(chatId, { photoBuffer: [] });
           await api.sendMessage(chatId, t.prohibited_content_error);
           return;
        }

        if (session.modelGender) {
            const mismatchItem = batchResults.find(r => r.gender !== 'unisex' && r.gender !== session.modelGender);
            if (mismatchItem) {
               analytics.trackError('gender_mismatch');
               updateSession(chatId, { photoBuffer: [] });
               const errorMsg = t.gender_error
                    .replace('{model}', session.modelGender === 'male' ? 'Male' : 'Female')
                    .replace('{item}', mismatchItem.gender === 'male' ? 'Male' : 'Female');
               await api.sendMessage(chatId, errorMsg);
               return;
            }
        }
        
        const newItems: OutfitItem[] = batchResults.map((res, index) => ({
            id: Date.now().toString() + Math.random(),
            category: res.category,
            description: res.description,
            base64: imagesToProcess[index],
            mimeType: 'image/jpeg',
            containsPerson: res.containsPerson // Save this for later
        }));

        const currentItems = [...session.outfitItems, ...newItems];
        let nextState = session.state;
        let nextModelImage = session.modelImage;

        if (session.state === AppState.COMPLETED) {
             nextState = AppState.AWAITING_OUTFITS;
             if (session.originalModelImage) {
                nextModelImage = session.originalModelImage;
             }
        }

        updateSession(chatId, { 
            outfitItems: currentItems, 
            photoBuffer: [],
            state: nextState,
            modelImage: nextModelImage
        });

        // Analytics
        analytics.trackFunnelStep('outfit');

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
        updateSession(chatId, { photoBuffer: [] });
    }
  };

  const processUpdate = async (update: TelegramUpdate) => {
    if (!telegramRef.current) return;
    const api = telegramRef.current;

    // Handle Pre-Checkout Query
    if (update.pre_checkout_query) {
      log(`Processing Pre-Checkout: ${update.pre_checkout_query.id}`, 'info');
      await api.answerPrecheckoutQuery(update.pre_checkout_query.id, true);
      return;
    }

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat.id;
      if (chatId) {
        await api.answerCallbackQuery(cb.id);
        const session = getOrCreateSession(chatId, cb.from);

        if (cb.data === 'lang_uz' || cb.data === 'lang_ru') {
            const selectedLang = cb.data === 'lang_uz' ? 'uz' : 'ru';
            const t = TRANSLATIONS[selectedLang];
            const credits = session.credits;

            updateSession(chatId, { language: selectedLang });
            
            // Check fresh state from Ref to ensure we handle modelImage correctly
            const freshSession = sessionsRef.current[chatId];
            
            if (freshSession.modelImage) {
                 await api.sendMessage(chatId, t.lang_updated, { keyboard: getMenuKeyboard(selectedLang, credits) });
                 const inlineBtns = [[{ text: t.btn_change_model, callback_data: 'change_model_inline' }]];
                 await api.sendPhoto(chatId, freshSession.modelImage, t.existing_model_found, inlineBtns);
            } else {
                 updateSession(chatId, { state: AppState.AWAITING_MODEL_IMAGE });
                 await api.sendMessage(chatId, t.welcome_start, { keyboard: getMenuKeyboard(selectedLang, credits) });
            }
            return;
        }
        
        if (cb.data === 'change_model_inline') {
            const t = TRANSLATIONS[session.language || 'uz'];
            updateSession(chatId, { 
                state: AppState.AWAITING_MODEL_IMAGE, 
                modelImage: null, 
                originalModelImage: null, 
                outfitItems: [] 
            });
            await api.sendMessage(chatId, t.change_model_msg);
            return;
        }

        // Handle Package Selection
        if (cb.data.startsWith('buy_pkg_')) {
            await handleSendInvoice(chatId, api, cb.data);
            return;
        }

        if (!session.language) return;
        const t = TRANSLATIONS[session.language];

        if (cb.data === 'reset_session') {
           await handleResetLook(chatId, api);
        } else if (cb.data === 'generate_look') {
           if (session.outfitItems.length > 0) {
             await runGeneration(chatId, session, api);
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

    const session = getOrCreateSession(chatId, msg.from);
    await checkMonthlyGrant(chatId, api);

    // Handle Successful Payment
    if (msg.successful_payment) {
        const payload = msg.successful_payment.invoice_payload;
        const pkg = PAYMENT_PACKAGES.find(p => p.id === payload);
        if (pkg && session.language) {
            const newCredits = session.credits + pkg.credits;
            updateSession(chatId, { credits: newCredits });
            
            // Track payment
            analytics.trackPayment(chatId, msg.successful_payment.total_amount / 100, pkg.credits);

            const t = TRANSLATIONS[session.language];
            await api.sendMessage(chatId, t.purchase_success.replace('{amount}', pkg.credits.toString()), { 
                keyboard: getMenuKeyboard(session.language, newCredits) 
            });
            log(`User ${chatId} paid for ${pkg.credits} credits. Total: ${newCredits}`, 'msg');
        }
        return;
    }

    // Special restart command (doesn't require language check)
    if (text?.toLowerCase() === 'restart the bot') {
       updateSession(chatId, { 
           state: AppState.AWAITING_LANGUAGE, 
           modelImage: null, 
           originalModelImage: null, 
           outfitItems: [],
           photoBuffer: []
       });
       await api.sendMessage(chatId, "Bot restarted. Please choose language / Bot qayta ishga tushdi.", {
          inlineKeyboard: [
             [{ text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" }],
             [{ text: "🇷🇺 Русский", callback_data: "lang_ru" }]
          ],
          removeKeyboard: true
       });
       log(`User ${chatId} forced hard restart`, 'info');
       return;
    }

    if (text === '/start' || text === '/reset') {
      updateSession(chatId, { state: AppState.AWAITING_LANGUAGE });
      const keyboard = [[
        { text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" },
        { text: "🇷🇺 Русский", callback_data: "lang_ru" }
      ]];
      await api.sendMessage(chatId, TRANSLATIONS['uz'].welcome_ask_lang, { inlineKeyboard: keyboard, removeKeyboard: true });
      return;
    }

    if (!session.language) return;

    const t = TRANSLATIONS[session.language];

    // Handle Menu Command / restore keyboard
    if (text === '/menu') {
        await api.sendMessage(chatId, t.restore_menu, { 
            keyboard: getMenuKeyboard(session.language, session.credits) 
        });
        return;
    }
    
    // Check if Balance button clicked
    if (text?.startsWith(t.menu_balance)) {
        await handleShowBalanceOptions(chatId, api);
        return;
    }

    if (text === t.menu_reset) {
        await handleResetLook(chatId, api);
        return;
    }
    if (text === t.menu_model) {
        updateSession(chatId, { 
            state: AppState.AWAITING_MODEL_IMAGE, 
            modelImage: null, 
            originalModelImage: null, 
            outfitItems: [] 
        });
        await api.sendMessage(chatId, t.change_model_msg);
        return;
    }
    if (text === t.menu_lang) {
         updateSession(chatId, { state: AppState.AWAITING_LANGUAGE });
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
         const t = TRANSLATIONS[session.language || 'uz'];
         await api.sendMessage(chatId, "⚠️ Rasm yuklashda xatolik yuz berdi. Iltimos, qayta yuboring.\n\n⚠️ Error downloading image. Please try again.");
         log(`Image download failed for user ${chatId}`, 'error');
         return;
      }

      const currentBuffer = session.photoBuffer || [];
      currentBuffer.push(base64Image);
      if (session.bufferTimeout) clearTimeout(session.bufferTimeout);
      const timeoutId = setTimeout(() => { processBufferedPhotos(chatId); }, 3000); 

      updateSession(chatId, { photoBuffer: currentBuffer, bufferTimeout: timeoutId });
      return;
    }

    if (text) {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('generate') || lowerText.includes('boshlash') || lowerText.includes('start')) {
        if (!session.modelImage || session.outfitItems.length === 0) {
           await api.sendMessage(chatId, t.need_model_items);
           return;
        }
        await runGeneration(chatId, session, api);
      } else {
         if (session.state === AppState.COMPLETED) {
            await runGeneration(chatId, session, api, text);
         } else if (session.state === AppState.AWAITING_OUTFITS) {
            await api.sendMessage(chatId, t.waiting_outfits);
         }
      }
    }
  };

  const runGeneration = async (chatId: number, session: UserSession, api: TelegramService, refinement?: string) => {
      if (!session.modelImage || !session.language) return;
      const t = TRANSLATIONS[session.language];

      const currentCost = GEN_COST;

      if (session.credits < currentCost) {
          const buyButtons = [[{ text: t.buy_credits_btn, callback_data: "show_balance_packages" }]];
          await handleShowBalanceOptions(chatId, api);
          await api.sendMessage(chatId, `${t.low_credits} ${session.credits} (Need ${currentCost})`);
          log(`User ${chatId} blocked: Low credits (${session.credits})`, 'error');
          return;
      }

      const newCredits = session.credits - currentCost;
      updateSession(chatId, { state: AppState.GENERATING });
      
      // Analytics
      analytics.trackFunnelStep('gen_req');

      const processingMsg = await api.sendMessage(chatId, t.generating, { 
          keyboard: getMenuKeyboard(session.language, newCredits) 
      });

      // Special handling: Clean Backgrounds via PixLab
      await api.sendMessage(chatId, t.complex_processing); // Reuse existing "processing" msg or create new key
      log(`User ${chatId} started generation. Pre-processing images with PixLab...`, 'info');

      try {
          // 1. Prepare items by removing backgrounds via PixLab
          const processedItems = [...session.outfitItems];
          let itemsUpdated = false;

          for (let i = 0; i < processedItems.length; i++) {
              const item = processedItems[i];
              // Only remove background for outfit pieces, shoes, etc. 
              // Skip background items or unknown
              if ([ItemCategory.OUTFIT, ItemCategory.SHOES, ItemCategory.HAT, ItemCategory.ACCESSORY, ItemCategory.HANDBAG].includes(item.category)) {
                 try {
                     const cleanBase64 = await removeBackgroundPixLab(pixlabToken, item.base64, useMockAI);
                     processedItems[i] = {
                         ...item,
                         base64: cleanBase64,
                         mimeType: 'image/png' // PixLab returns PNG for transparency
                     };
                     itemsUpdated = true;
                 } catch (pixError) {
                     console.error(`PixLab failed for item ${i}. Using original.`, pixError);
                     // Allow to continue with original image if PixLab fails (graceful degradation)
                 }
              }
          }
          
          if (itemsUpdated) {
              updateSession(chatId, { outfitItems: processedItems });
          }

          // 2. Prepare Prompt
          let prompt = "";
          if (useMockAI) {
              prompt = "Mock Prompt: Model wearing specified items.";
          } else {
              if (!openaiToken) throw new Error("MISSING_OPENAI_KEY");
              prompt = await generatePromptChatGPT(openaiToken, processedItems, refinement);
          }
          
          // 3. Generate Look
          const generatedBase64 = await generateTryOnImage(geminiToken, session.modelImage, processedItems, prompt, useMockAI);
          
          if (processingMsg && processingMsg.result?.message_id) {
             await api.deleteMessage(chatId, processingMsg.result.message_id);
          }

          // Analytics Success
          analytics.trackGeneration(chatId, true);
          analytics.trackFunnelStep('complete');

          updateSession(chatId, { 
              state: AppState.COMPLETED,
              modelImage: generatedBase64, 
              outfitItems: [], // Clear session after success
              credits: newCredits
          });

          const buttons = [[{ text: t.reset_btn, callback_data: "reset_session" }]];
          await api.sendPhoto(chatId, generatedBase64, t.gen_caption, buttons);
          
          log(`User ${chatId} spent ${currentCost} credits. Remaining: ${newCredits}`, 'info');

      } catch (error: any) {
          console.error(error);
          
          // Analytics Failure
          analytics.trackGeneration(chatId, false);
          analytics.trackError(error.message || 'gen_error');

          if (processingMsg && processingMsg.result?.message_id) {
             await api.deleteMessage(chatId, processingMsg.result.message_id);
          }

          if (error.message === "MISSING_OPENAI_KEY") {
              await api.sendMessage(chatId, t.openai_missing, { keyboard: getMenuKeyboard(session.language, session.credits) });
          } else if (error.message === "MISSING_GEMINI_KEY") {
              await api.sendMessage(chatId, "⚠️ System Error: Admin has not configured the AI engine (Gemini).", { keyboard: getMenuKeyboard(session.language, session.credits) });
          } else if (error.message === "MISSING_PIXLAB_KEY") {
              await api.sendMessage(chatId, "⚠️ System Error: Admin has not configured the Image Processor (PixLab).", { keyboard: getMenuKeyboard(session.language, session.credits) });
          } else if (error.message && error.message.includes("Safety Block")) {
             await api.sendMessage(chatId, t.safety_error, { keyboard: getMenuKeyboard(session.language, session.credits) });
          } else {
             await api.sendMessage(chatId, t.gen_error, { keyboard: getMenuKeyboard(session.language, session.credits) });
          }
          
          updateSession(chatId, { state: AppState.COMPLETED });
      }
  };

  const registerCommands = async () => {
    if (!telegramRef.current) return;
    const btnRes = await telegramRef.current.setChatMenuButton();
    if (!btnRes?.ok) {
        log(`SetChatMenuButton Error: ${btnRes?.description}`, 'error');
    } else {
        log(`Chat Menu Button Set: Default`, 'info');
    }

    const cmdRes = await telegramRef.current.setMyCommands([
        { command: 'menu', description: 'Show main menu / Asosiy menyu' },
        { command: 'reset', description: 'Reset session / Qayta boshlash' },
        { command: 'start', description: 'Restart bot / Botni yangilash' }
    ]);

    if (cmdRes?.ok) {
        log(`Commands registered successfully!`, 'msg');
    } else {
        log(`Command Register Error: ${cmdRes?.description}`, 'error');
    }
  };

  const startBot = async () => {
    if (!telegramToken) return alert("Please enter a bot token");
    if (!useMockAI) {
        if (!openaiToken) return alert("Please enter OpenAI API Key");
        if (!geminiToken) return alert("Please enter Gemini API Key");
        // PixLab is technically optional if user hasn't configured it, but code expects it. 
        // We will just alert if it's missing during generation or here.
        if (!pixlabToken) alert("Warning: PixLab Key is missing. Background removal will fail.");
    }
    
    telegramRef.current = new TelegramService(telegramToken);
    try {
        const me = await telegramRef.current.getMe();
        if (!me.ok) { alert("Invalid Telegram Token"); return; }
        
        await registerCommands();
        
        log(`Bot Started: @${me.result.username}`, 'info');
    } catch (e) { alert("Connection failed"); return; }
    setIsBotRunning(true);
    isRunningRef.current = true;
    poll();
  };

  const stopBot = () => {
    setIsBotRunning(false);
    isRunningRef.current = false;
    log("Bot Stopped", 'error');
  };

  const poll = async () => {
    if (!isRunningRef.current || !telegramRef.current) return;
    try {
        const updates = await telegramRef.current.getUpdates(offsetRef.current + 1);
        if (updates.ok && updates.result.length > 0) {
            for (const update of updates.result) {
                offsetRef.current = update.update_id;
                await processUpdate(update);
            }
        }
    } catch (e) {}
    if (isRunningRef.current) setTimeout(poll, 1000);
  };

  // --- UI RENDER ---

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-mono">
      {/* HEADER */}
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold">NB</div>
            <h1 className="font-bold text-lg hidden md:block">NanoBanana Bot Admin</h1>
          </div>
          
          {/* NAVIGATION */}
          <div className="flex bg-slate-900 rounded-lg p-1 gap-1">
             <button 
                onClick={() => setActiveTab('home')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'home' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
             >
                Home / Metrics
             </button>
             <button 
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
             >
                Settings / Config
             </button>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isBotRunning ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {isBotRunning ? '● RUNNING' : '● STOPPED'}
            </div>
            
            {!isBotRunning ? (
               <button onClick={startBot} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold text-xs transition-all shadow-lg shadow-green-500/20">
                  START BOT
               </button>
            ) : (
               <button onClick={stopBot} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold text-xs transition-all shadow-lg shadow-red-500/20">
                  STOP BOT
               </button>
            )}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-auto p-6">
         <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'home' ? (
                <Dashboard 
                  metrics={metrics} 
                  dateFilter={dateFilter}
                  setDateFilter={setDateFilter}
                  onGiftCredits={handleGiftCredits}
                />
            ) : (
                <Settings 
                  telegramToken={telegramToken}
                  setTelegramToken={setTelegramToken}
                  providerToken={providerToken}
                  setProviderToken={setProviderToken}
                  openaiToken={openaiToken}
                  setOpenaiToken={setOpenaiToken}
                  geminiToken={geminiToken}
                  setGeminiToken={setGeminiToken}
                  pixlabToken={pixlabToken}
                  setPixlabToken={setPixlabToken}
                  useMockAI={useMockAI}
                  setUseMockAI={setUseMockAI}
                  isBotRunning={isBotRunning}
                  logs={logs}
                  logsEndRef={logsEndRef}
                />
            )}
         </div>
      </div>
    </div>
  );
};

export default App;
