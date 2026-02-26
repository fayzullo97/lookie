
const API_BASE = 'https://api.telegram.org/bot';
const FILE_BASE = 'https://api.telegram.org/file/bot';

export interface SendMessageOptions {
  inlineKeyboard?: any[];
  keyboard?: any[][];
  removeKeyboard?: boolean;
}

export interface InvoiceOptions {
  chatId: number;
  title: string;
  description: string;
  payload: string;
  providerToken: string;
  currency: string;
  prices: { label: string; amount: number }[];
}

export interface BotCommand {
  command: string;
  description: string;
}

export class TelegramService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getMe() {
    const res = await fetch(`${API_BASE}${this.token}/getMe`);
    return res.json();
  }

  async setMyCommands(commands: BotCommand[]) {
    try {
      const res = await fetch(`${API_BASE}${this.token}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands })
      });
      return await res.json();
    } catch (e) {
      console.error("SetMyCommands error", e);
      return { ok: false, description: e instanceof Error ? e.message : "Unknown error" };
    }
  }

  async setChatMenuButton() {
    try {
      // type: 'default' restores the standard menu button that opens the commands list
      const res = await fetch(`${API_BASE}${this.token}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_button: { type: 'default' } })
      });
      return await res.json();
    } catch (e) {
      console.error("SetChatMenuButton error", e);
      return { ok: false, description: e instanceof Error ? e.message : "Unknown error" };
    }
  }

  async getUpdates(offset: number) {
    try {
        const res = await fetch(`${API_BASE}${this.token}/getUpdates?offset=${offset}&timeout=10`);
        return await res.json();
    } catch (e) {
        // Suppress "Failed to fetch" errors which are common in polling when network blips occur
        if (e instanceof Error && e.message === 'Failed to fetch') {
            console.warn("Polling network error (retrying...)");
        } else {
            console.error("Polling error", e);
        }
        return { ok: false };
    }
  }

  async sendMessage(chatId: number, text: string, options?: SendMessageOptions) {
    try {
      const body: any = { chat_id: chatId, text: text };
      
      if (options) {
        if (options.inlineKeyboard) {
          body.reply_markup = JSON.stringify({ inline_keyboard: options.inlineKeyboard });
        } else if (options.keyboard) {
          body.reply_markup = JSON.stringify({ 
            keyboard: options.keyboard, 
            resize_keyboard: true,
            is_persistent: true 
          });
        } else if (options.removeKeyboard) {
           body.reply_markup = JSON.stringify({ remove_keyboard: true });
        }
      }

      const res = await fetch(`${API_BASE}${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      console.error("SendMessage error", e);
      return null;
    }
  }

  async sendInvoice(options: InvoiceOptions) {
    try {
      const body = {
        chat_id: options.chatId,
        title: options.title,
        description: options.description,
        payload: options.payload,
        provider_token: options.providerToken,
        currency: options.currency,
        prices: JSON.stringify(options.prices),
        start_parameter: 'credits_topup'
      };

      const res = await fetch(`${API_BASE}${this.token}/sendInvoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      console.error("SendInvoice error", e);
      return null;
    }
  }

  async answerPrecheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string) {
    try {
      const body = {
        pre_checkout_query_id: preCheckoutQueryId,
        ok: ok,
        error_message: errorMessage
      };
      await fetch(`${API_BASE}${this.token}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.error("AnswerPrecheckoutQuery error", e);
    }
  }

  async sendPhoto(chatId: number, base64Image: string, caption?: string, inlineKeyboard?: any[]) {
    try {
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('chat_id', chatId.toString());
      formData.append('photo', blob, 'image.jpg');
      if (caption) formData.append('caption', caption);
      
      if (inlineKeyboard) {
        formData.append('reply_markup', JSON.stringify({
          inline_keyboard: inlineKeyboard
        }));
      }

      const res = await fetch(`${API_BASE}${this.token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      return await res.json();
    } catch (e) {
      console.error("SendPhoto error", e);
      return null;
    }
  }
  
  async deleteMessage(chatId: number, messageId: number) {
    try {
      await fetch(`${API_BASE}${this.token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
    } catch (e) {
      console.error("DeleteMessage error", e);
    }
  }
  
  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    try {
      await fetch(`${API_BASE}${this.token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
      });
    } catch (e) {
      console.error("AnswerCallbackQuery error", e);
    }
  }

  async getFile(fileId: string): Promise<string | null> {
    const fetchImageWithProxy = async (proxyUrl: string): Promise<string | null> => {
        try {
            const imageRes = await fetch(proxyUrl);
            if (!imageRes.ok) return null;

            const contentType = imageRes.headers.get('content-type');
            if (contentType && !contentType.startsWith('image/') && !contentType.includes('application/octet-stream')) {
                return null;
            }

            const imageBlob = await imageRes.blob();
            if (imageBlob.size === 0) return null;

            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                if (result.includes(',')) {
                   resolve(result.split(',')[1]);
                } else {
                   resolve(result);
                }
              };
              reader.readAsDataURL(imageBlob);
            });
        } catch (e) {
            return null;
        }
    };

    try {
      const res = await fetch(`${API_BASE}${this.token}/getFile?file_id=${fileId}`);
      const data = await res.json();
      
      if (data.ok && data.result.file_path) {
        const fileUrl = `${FILE_BASE}${this.token}/${data.result.file_path}`;
        
        // Attempt 1: CorsProxy.io
        let base64 = await fetchImageWithProxy(`https://corsproxy.io/?${encodeURIComponent(fileUrl)}`);
        
        // Attempt 2: CodeTabs (Fallback)
        if (!base64) {
            console.log("Primary proxy failed, trying fallback...");
            base64 = await fetchImageWithProxy(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fileUrl)}`);
        }

        return base64;
      }
    } catch (e) {
      console.error("GetFile catch error", e);
    }
    return null;
  }
}
