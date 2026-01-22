const isProduction = process.env.NODE_ENV === 'production';

export const appConfig = {
    appName: 'training-app-v3',
    cacheType: isProduction ? 's3' : 's3',
    dbName: 'training_app_v3_db',
    ownerTelegramChatId: '5781511728'
};
