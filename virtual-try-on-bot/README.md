
# NanoBanana Bot Admin 🍌

A client-side React application for managing the Virtual Try-On Telegram Bot. This dashboard allows you to view analytics, manage user sessions, and configure API tokens.

## Features

- **Dashboard**: Real-time analytics (Active users, Generations, Costs).
- **Settings**: Configure Telegram, OpenAI, and Gemini API tokens directly in the browser.
- **Bot Logic**: Runs entirely in the browser (Serverless architecture).

## Setup & Development

This project uses ES Modules via `esm.sh` and does not require a build step.

### 1. Clone & Configure
```bash
git clone <your-repo-url>
cd nanobanana-bot-admin

# Create your local config file
cp config.example.ts config.ts
```

### 2. Add API Keys
Open `config.ts` and add your keys:
- **Telegram Bot Token** (from @BotFather)
- **Payment Provider Token** (Optional)
- **OpenAI API Key** (for prompt generation)
- **Gemini API Key** (for image analysis and generation)

*Note: `config.ts` is ignored by Git to keep your secrets safe.*

### 3. Run Locally
You can use any static file server.
```bash
npx serve .
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration (Runtime)

You can also override keys in the **Settings** tab of the dashboard. These overrides are saved to your browser's `localStorage` and take precedence over `config.ts`.

## Tech Stack

- React 19
- Tailwind CSS
- Google GenAI SDK (@google/genai)
- Telegram Bot API (via direct fetch)
