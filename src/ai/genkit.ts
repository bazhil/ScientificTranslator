// Подключаем основную библиотеку GenKit
import {genkit} from 'genkit';

// Подключаем библиотеку GigaChat
import GigaChat from 'gigachat';

// Создаем инстанс GigaChat с API-токеном
const gigaChatInstance = new GigaChat({
  credentials: process.env.GIGA_CHAT_AUTH_KEY,
  scope: process.env.GIGA_CHAT_SCOPE,
  model: process.env.GIGA_CHAT_MODEL,
});

// Генерируем интерфейс для взаимодействия с GigaChat
export const ai = genkit({
  plugins: [],
  model: async () => {
    return gigaChatInstance.chat.bind(gigaChatInstance);
  },
});