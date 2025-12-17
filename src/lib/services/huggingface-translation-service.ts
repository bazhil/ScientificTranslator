// huggingface-translation-service.ts
// Модуль для работы с HuggingFace моделями перевода (TypeScript only)

export interface TranslationConfig {
  sourceLanguage?: string;
  targetLanguage: string;
  model?: string;
  provider: 'yandex' | 'huggingface';
  apiKey?: string; // HuggingFace API токен (опционально)
  useInferenceAPI?: boolean; // true = Inference API, false = Transformers.js
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  model?: string;
  processingTime?: number;
}

export interface TranslationProgress {
  progress: number; // 0-100
  status: 'loading' | 'processing' | 'completed' | 'error';
  message?: string;
}

export interface HuggingFaceModel {
  id: string;
  name: string;
  languages: string[];
  task: 'translation' | 'text2text-generation';
}

export class HuggingFaceTranslationService {
  private inferenceApiUrl = 'https://api-inference.huggingface.co/models';
  private defaultModel = 'facebook/m2m100_418M';
  private cache = new Map<string, string>(); // Простое кэширование

  /**
   * Переводит текст используя HuggingFace Inference API
   */
  async translateWithInferenceAPI(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    model?: string,
    apiKey?: string,
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationResponse> {
    const modelId = model || this.defaultModel;
    const cacheKey = `${modelId}:${sourceLanguage || 'auto'}:${targetLanguage}:${text.substring(0, 100)}`;
    
    // Проверяем кэш
    const cached = this.cache.get(cacheKey);
    if (cached) {
      onProgress?.({
        progress: 100,
        status: 'completed',
        message: 'Translation from cache'
      });
      return {
        translatedText: cached,
        targetLanguage,
        sourceLanguage,
        model: modelId
      };
    }

    onProgress?.({
      progress: 0,
      status: 'loading',
      message: 'Connecting to HuggingFace API...'
    });

    try {
      const startTime = Date.now();
      
      // Формируем промпт для модели перевода
      const prompt = this.formatTranslationPrompt(text, sourceLanguage, targetLanguage, modelId);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      onProgress?.({
        progress: 30,
        status: 'processing',
        message: 'Sending request to HuggingFace...'
      });

      // Формируем параметры в зависимости от модели
      const parameters: any = {
        max_length: 512,
      };

      // Для моделей M2M100 и mBART нужны специальные параметры
      if (modelId.includes('m2m100')) {
        parameters.src_lang = sourceLanguage || 'en';
        parameters.tgt_lang = targetLanguage;
      } else if (modelId.includes('mbart')) {
        // mBART использует специальные коды языков
        parameters.src_lang = sourceLanguage || 'en_XX';
        parameters.tgt_lang = this.getMBartLanguageCode(targetLanguage);
      } else if (modelId.includes('mt5')) {
        // mT5 использует промпт с указанием языков
        const promptWithLang = `translate ${sourceLanguage || 'English'} to ${this.getLanguageName(targetLanguage)}: ${prompt}`;
        const response = await fetch(`${this.inferenceApiUrl}/${modelId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            inputs: promptWithLang,
            parameters,
          }),
        });
        
        if (!response.ok) {
          if (response.status === 503) {
            const retryAfter = response.headers.get('Retry-After') || '20';
            throw new Error(`Model is loading. Please wait ${retryAfter} seconds and try again.`);
          }
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const translatedText = this.extractTranslationFromResponse(data, modelId);
        const processingTime = Date.now() - startTime;
        this.cache.set(cacheKey, translatedText);
        
        onProgress?.({
          progress: 100,
          status: 'completed',
          message: 'Translation completed'
        });
        
        return {
          translatedText,
          sourceLanguage,
          targetLanguage,
          model: modelId,
          processingTime,
        };
      }

      const response = await fetch(`${this.inferenceApiUrl}/${modelId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: prompt,
          parameters,
        }),
      });

      if (!response.ok) {
        if (response.status === 503) {
          // Модель загружается, ждем
          const retryAfter = response.headers.get('Retry-After') || '20';
          throw new Error(`Model is loading. Please wait ${retryAfter} seconds and try again.`);
        }
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      onProgress?.({
        progress: 70,
        status: 'processing',
        message: 'Processing translation...'
      });

      const data = await response.json();
      const translatedText = this.extractTranslationFromResponse(data, modelId);
      const processingTime = Date.now() - startTime;

      // Сохраняем в кэш
      this.cache.set(cacheKey, translatedText);

      onProgress?.({
        progress: 100,
        status: 'completed',
        message: 'Translation completed'
      });

      return {
        translatedText,
        sourceLanguage,
        targetLanguage,
        model: modelId,
        processingTime,
      };
    } catch (error) {
      onProgress?.({
        progress: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Translation failed'
      });
      throw error;
    }
  }

  /**
   * Переводит текст используя Transformers.js (локально)
   */
  async translateWithTransformersJS(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    model?: string,
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationResponse> {
    try {
      // Динамический импорт @xenova/transformers
      const { pipeline, env } = await import('@xenova/transformers');
      
      onProgress?.({
        progress: 10,
        status: 'loading',
        message: 'Loading translation model...'
      });

      const modelId = model || this.defaultModel;
      
      // Настраиваем кэш для моделей
      env.allowLocalModels = false;
      env.allowRemoteModels = true;

      onProgress?.({
        progress: 30,
        status: 'loading',
        message: `Downloading model ${modelId}...`
      });

      // Создаем пайплайн для перевода
      const translator = await pipeline('translation', modelId, {
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            onProgress?.({
              progress: 30 + Math.round(progress.progress * 0.3),
              status: 'loading',
              message: `Downloading model: ${Math.round(progress.progress * 100)}%`
            });
          }
        }
      });

      onProgress?.({
        progress: 70,
        status: 'processing',
        message: 'Translating text...'
      });

      const startTime = Date.now();
      
      // Выполняем перевод
      const result = await translator(text, {
        src_lang: sourceLanguage || 'auto',
        tgt_lang: targetLanguage,
      });

      const processingTime = Date.now() - startTime;
      const translatedText = Array.isArray(result) 
        ? result[0]?.translation_text || result[0]?.generated_text || text
        : result.translation_text || result.generated_text || text;

      onProgress?.({
        progress: 100,
        status: 'completed',
        message: 'Translation completed'
      });

      return {
        translatedText,
        sourceLanguage,
        targetLanguage,
        model: modelId,
        processingTime,
      };
    } catch (error) {
      onProgress?.({
        progress: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Translation failed'
      });
      throw error;
    }
  }

  /**
   * Главный метод перевода (выбирает API или Transformers.js)
   */
  async translate(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    model?: string,
    config?: { apiKey?: string; useInferenceAPI?: boolean },
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationResponse> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Для больших текстов разбиваем на части
    const chunks = this.splitTextIntoChunks(text, 500); // 500 символов на чанк для API
    
    if (chunks.length === 1) {
      return this.translateChunk(
        chunks[0],
        targetLanguage,
        sourceLanguage,
        model,
        config,
        onProgress
      );
    }

    // Для больших текстов переводим по частям
    onProgress?.({
      progress: 0,
      status: 'processing',
      message: `Translating ${chunks.length} chunks...`
    });

    const translatedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = await this.translateChunk(
        chunk,
        targetLanguage,
        sourceLanguage,
        model,
        config,
        (progress) => {
          const chunkProgress = progress.progress || 0;
          const overallProgress = Math.round(
            ((i / chunks.length) * 100) + (chunkProgress / chunks.length)
          );
          onProgress?.({
            progress: overallProgress,
            status: progress.status,
            message: `Translating chunk ${i + 1} of ${chunks.length}...`
          });
        }
      );
      translatedChunks.push(result.translatedText);
      
      // Небольшая задержка между запросами для избежания rate limits
      if (i < chunks.length - 1 && config?.useInferenceAPI !== false) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    onProgress?.({
      progress: 100,
      status: 'completed',
      message: 'Translation completed'
    });

    return {
      translatedText: translatedChunks.join(' '),
      targetLanguage,
      sourceLanguage,
      model: model || this.defaultModel
    };
  }

  private async translateChunk(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    model?: string,
    config?: { apiKey?: string; useInferenceAPI?: boolean },
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationResponse> {
    const useAPI = config?.useInferenceAPI !== false; // По умолчанию используем API
    
    if (useAPI) {
      return this.translateWithInferenceAPI(
        text,
        targetLanguage,
        sourceLanguage,
        model,
        config?.apiKey,
        onProgress
      );
    } else {
      return this.translateWithTransformersJS(
        text,
        targetLanguage,
        sourceLanguage,
        model,
        onProgress
      );
    }
  }

  /**
   * Форматирует промпт для модели перевода
   */
  private formatTranslationPrompt(
    text: string,
    sourceLanguage?: string,
    targetLanguage: string,
    modelId: string
  ): string {
    // Для моделей M2M100 и mBART нужен специальный формат
    if (modelId.includes('m2m100') || modelId.includes('mbart')) {
      const srcLang = sourceLanguage || 'en';
      return text; // Модель сама определит языки из параметров
    }
    
    // Для моделей Helsinki-NLP формат может отличаться
    if (modelId.includes('opus-mt')) {
      return text;
    }
    
    return text;
  }

  /**
   * Извлекает переведенный текст из ответа API
   */
  private extractTranslationFromResponse(data: any, modelId: string): string {
    if (Array.isArray(data)) {
      if (data[0]?.translation_text) {
        return data[0].translation_text;
      }
      if (data[0]?.generated_text) {
        return data[0].generated_text;
      }
      return data[0]?.text || data[0] || '';
    }
    
    if (data.translation_text) {
      return data.translation_text;
    }
    
    if (data.generated_text) {
      return data.generated_text;
    }
    
    if (typeof data === 'string') {
      return data;
    }
    
    throw new Error('Unable to extract translation from API response');
  }

  /**
   * Разбивает текст на чанки для обработки больших текстов
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    // Разбиваем по предложениям для лучшего качества перевода
    const sentences = text.match(/[^.!?]+[.!?]+/g) || text.match(/[^\n]+/g) || [text];
    
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Получает список доступных моделей перевода
   */
  async getAvailableModels(): Promise<HuggingFaceModel[]> {
    // Список популярных моделей перевода
    return [
      {
        id: 'facebook/m2m100_418M',
        name: 'M2M100 418M (Multilingual)',
        languages: ['en', 'ru', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'it', 'pt', 'pl', 'nl'],
        task: 'translation'
      },
      {
        id: 'facebook/mbart-large-50',
        name: 'mBART Large 50',
        languages: ['en', 'ru', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'it', 'pt', 'pl', 'nl'],
        task: 'translation'
      },
      {
        id: 'Helsinki-NLP/opus-mt-en-ru',
        name: 'Helsinki-NLP English-Russian',
        languages: ['en', 'ru'],
        task: 'translation'
      },
      {
        id: 'Helsinki-NLP/opus-mt-ru-en',
        name: 'Helsinki-NLP Russian-English',
        languages: ['ru', 'en'],
        task: 'translation'
      },
      {
        id: 'google/mt5-base',
        name: 'mT5 Base (Multilingual)',
        languages: ['en', 'ru', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi'],
        task: 'text2text-generation'
      }
    ];
  }

  /**
   * Получает список поддерживаемых языков для модели
   */
  async getSupportedLanguages(model?: string): Promise<string[]> {
    const models = await this.getAvailableModels();
    const selectedModel = models.find(m => m.id === (model || this.defaultModel));
    return selectedModel?.languages || [];
  }

  /**
   * Получает код языка для mBART
   */
  private getMBartLanguageCode(lang: string): string {
    const langMap: Record<string, string> = {
      'en': 'en_XX',
      'ru': 'ru_RU',
      'es': 'es_XX',
      'fr': 'fr_XX',
      'de': 'de_DE',
      'zh': 'zh_CN',
      'ja': 'ja_XX',
      'ko': 'ko_KR',
      'ar': 'ar_AR',
      'hi': 'hi_IN',
      'it': 'it_IT',
      'pt': 'pt_XX',
      'pl': 'pl_PL',
      'nl': 'nl_XX',
    };
    return langMap[lang] || `${lang}_XX`;
  }

  /**
   * Получает название языка для промпта
   */
  private getLanguageName(lang: string): string {
    const langMap: Record<string, string> = {
      'en': 'English',
      'ru': 'Russian',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'it': 'Italian',
      'pt': 'Portuguese',
      'pl': 'Polish',
      'nl': 'Dutch',
    };
    return langMap[lang] || lang;
  }

  /**
   * Проверяет доступность модели через API
   */
  async checkModelAvailability(modelId: string, apiKey?: string): Promise<boolean> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${this.inferenceApiUrl}/${modelId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: 'test',
          parameters: { max_length: 10 }
        }),
      });

      return response.status !== 404;
    } catch {
      return false;
    }
  }
}

