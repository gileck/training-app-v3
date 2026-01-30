const isProduction = process.env.NODE_ENV === 'production';

export const appConfig = {
    appName: 'training-app-v3',
    cacheType: isProduction ? 's3' : 's3',
    dbName: 'training_app_v3_db',
    // Defaults to AGENT_TELEGRAM_CHAT_ID env var, then falls back to ownerTelegramChatId
    // If not set, uses the hardcoded fallback below
    ownerTelegramChatId: process.env.AGENT_TELEGRAM_CHAT_ID ||
                          process.env.ownerTelegramChatId ||
                          '5781511728'  // Fallback (private chat)
};
