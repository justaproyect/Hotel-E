import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/hermes',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
  },

  facebook: {
    appId: process.env.FB_APP_ID || '',
    appSecret: process.env.FB_APP_SECRET || '',
    accessToken: process.env.FB_ACCESS_TOKEN || '',
    pageId: process.env.FB_PAGE_ID || '',
    marketplaceCategoryId: process.env.FB_MARKETPLACE_CATEGORY_ID || '',
  },

  instagram: {
    businessAccountId: process.env.IG_BUSINESS_ACCOUNT_ID || '',
    accessToken: process.env.IG_ACCESS_TOKEN || '',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  },

  whatsapp: {
    appId: process.env.WA_APP_ID || '',
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
    accessToken: process.env.WA_ACCESS_TOKEN || '',
    webhookToken: process.env.WA_WEBHOOK_TOKEN || 'hermes_webhook_2024',
    businessAccountId: process.env.WA_BUSINESS_ACCOUNT_ID || '',
  },

  hotel: {
    name: process.env.HOTEL_NAME || 'Hotel Hermes',
    address: process.env.HOTEL_ADDRESS || '',
    phone: process.env.HOTEL_PHONE || '',
    email: process.env.HOTEL_EMAIL || '',
    currency: process.env.HOTEL_CURRENCY || 'MXN',
    timezone: process.env.HOTEL_TIMEZONE || 'America/Mexico_City',
  },
};
