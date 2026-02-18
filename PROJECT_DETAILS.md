
# NanoBanana Bot - Virtual Try-On AI

**NanoBanana Bot** is a sophisticated "AI Stylist" Telegram bot that allows users to virtually try on clothes. Unlike traditional bot architectures, the logic for this bot runs entirely within a **client-side React application** that acts as the administration dashboard and the bot runner simultaneously.

## 🏗 Architecture

The project utilizes a **Serverless / Browser-Based** architecture. The React application (`nanobanana-bot-admin`) serves two purposes:
1.  **Bot Engine**: It polls the Telegram API (`getUpdates`), processes messages, maintains user state in memory, and orchestrates AI services.
2.  **Admin Dashboard**: It provides a UI for monitoring analytics, viewing logs, managing credits, and configuring API keys.

*Note: For the bot to function, this web application must be running in a browser tab or a Node.js-based browser runner.*

## 🛠 Tech Stack

### Core
*   **Frontend**: React 19, Tailwind CSS.
*   **Build Tool**: None (ES Modules via `esm.sh` for instant prototyping).
*   **State Management**: React State & Refs (In-memory session management).

### AI Services
1.  **Google Gemini (GenAI SDK)**:
    *   **Vision Analysis**: Validates user photos (ensures full-body visibility).
    *   **Categorization**: Identifies clothing types (Shirt, Pants, Shoes) and detects gender/prohibited content.
    *   **Image Generation**: The core "Try-On" engine (`gemini-2.5-flash-image`) that merges the user's model with the outfit.
2.  **OpenAI (GPT-4o-mini)**:
    *   **Prompt Engineering**: Converts a list of clothing items into a highly detailed, rigid prompt for the image generator.
3.  **PixLab**:
    *   **Background Removal**: Pre-processes outfit images to remove backgrounds before sending them to the generation engine.

### Integrations
*   **Telegram Bot API**: Direct HTTP polling and message sending.
*   **Telegram Payments**: Integration with providers (Click/Payme) for selling credits.
*   **Supabase (Planned)**: For persistent database and file storage (replacing current `localStorage` solution).

## 🔄 User Flow

1.  **Onboarding**:
    *   User starts the bot (`/start`).
    *   Selects language (Uzbek `uz` or Russian `ru`).
    *   Receives 30 free welcome credits.

2.  **Model Upload**:
    *   User uploads a full-body photo.
    *   **AI Check**: Gemini verifies the photo contains a visible human from head to toe.
    *   If valid, the photo is saved as the "Model".

3.  **Outfit Selection**:
    *   User uploads images of clothing (shirt, shoes, accessories).
    *   **AI Analysis**: Gemini categorizes the item (e.g., "Red Dress") and checks for safety violations (e.g., swimwear/underwear restrictions).
    *   **Processing**: PixLab removes the background from the clothing item to ensure clean generation.

4.  **Generation**:
    *   User clicks "🚀 Start".
    *   **Cost**: 10 Credits are deducted.
    *   **Pipeline**:
        1.  OpenAI generates a specific prompt based on the items.
        2.  Gemini receives the Model Image + Processed Outfit Images + Prompt.
        3.  The result is sent back to the user.

5.  **Economy**:
    *   Users get 30 free credits monthly.
    *   Users can purchase credit packages via Telegram Invoices.

## 📊 Admin Dashboard Features

*   **Real-time Analytics**:
    *   Daily Active Users (DAU).
    *   Total Generations (Success/Fail rates).
    *   Financials (Total UZS earned, Estimated USD API costs).
*   **Funnel Visualization**: Tracks conversion from "Start" -> "Model Upload" -> "Generation".
*   **User Management**: List of users with ability to **Gift Credits**.
*   **Configuration**: UI to input/update API Keys without restarting the server.
*   **Live Console**: View bot logs and errors in real-time.

## 📂 Project Structure

*   `App.tsx`: Main entry point. Handles the Telegram polling loop and state delegation.
*   `services/`:
    *   `telegramService.ts`: Wrappers for Telegram HTTP API.
    *   `geminiService.ts`: Logic for validation, categorization, and generation.
    *   `openaiService.ts`: Prompt generation logic.
    *   `pixlabService.ts`: Background removal API integration.
    *   `analyticsService.ts`: Tracks metrics to `localStorage`.
*   `types.ts`: TypeScript definitions for User Sessions, Bot State, and Analytics.
*   `config.ts`: Fallback configuration file.

## 💾 Database Schema (Supabase)

*Currently, the app runs on `localStorage`. The migration plan involves:*

*   **`users`**: Persistent user profiles and credit balances.
*   **`model_images`**: Links to stored user photos.
*   **`outfit_queue`**: Temporary holding for uploaded items.
*   **`generations`**: History of all AI requests.
*   **`transactions`**: Ledger for payments and credit usage.
*   **Storage Buckets**: `user-uploads` (raw assets) and `generated-results` (outputs).
