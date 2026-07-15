import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLanguage, sourceLanguage, model, apiKey } = body;

    if (!text || !targetLanguage || !model) {
      return NextResponse.json(
        { error: 'Missing required parameters: text, targetLanguage, model' },
        { status: 400 }
      );
    }

    const inferenceApiUrl = `https://router.huggingface.co/hf-inference/models/${model}`;
    
    // Формируем параметры в зависимости от модели
    const parameters: any = {
      max_length: Math.min(text.length * 2, 1024), // Увеличиваем max_length в зависимости от длины текста
    };

    let inputs = text;

    // Для моделей M2M100 и mBART нужны специальные параметры
    if (model.includes('m2m100')) {
      parameters.src_lang = sourceLanguage || 'en';
      parameters.tgt_lang = targetLanguage;
    } else if (model.includes('mbart')) {
      // mBART использует специальные коды языков
      parameters.src_lang = sourceLanguage || 'en_XX';
      parameters.tgt_lang = getMBartLanguageCode(targetLanguage);
    } else if (model.includes('mt5')) {
      // mT5 использует промпт с указанием языков
      inputs = `translate ${sourceLanguage || 'English'} to ${getLanguageName(targetLanguage)}: ${text}`;
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = apiKey || process.env.HF_TOKEN;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }

        const response = await fetch(inferenceApiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            inputs,
            parameters,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 503 && attempt < maxAttempts) {
            lastError = new Error(`Model is loading`);
            continue;
          }

          if (response.status === 503) {
            const retryAfter = response.headers.get('Retry-After') || '20';
            return NextResponse.json(
              { error: `Model is loading. Please wait ${retryAfter} seconds and try again.` },
              { status: 503 }
            );
          }

          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `HTTP ${response.status}` };
          }

          console.error('HuggingFace API error', {
            status: response.status,
            model,
            textLength: text.length,
            error: errorData,
          });

          return NextResponse.json(
            { error: errorData.error || errorData.message || `HTTP ${response.status}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        const translatedText = extractTranslationFromResponse(data, model);

        return NextResponse.json({
          translatedText,
          sourceLanguage,
          targetLanguage,
          model,
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        lastError = fetchError;
        if (fetchError.name === 'AbortError' && attempt < maxAttempts) {
          continue;
        }
        if (fetchError.name === 'AbortError') {
          return NextResponse.json(
            { error: 'Request timeout. The translation took too long.' },
            { status: 504 }
          );
        }
        throw fetchError;
      }
    }

    if (lastError instanceof Error && lastError.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout. The translation took too long.' },
        { status: 504 }
      );
    }
    throw lastError instanceof Error ? lastError : new Error('Translation failed');
  } catch (error) {
    console.error('HuggingFace translation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Translation failed' },
      { status: 500 }
    );
  }
}

function getMBartLanguageCode(lang: string): string {
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

function getLanguageName(lang: string): string {
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

function extractTranslationFromResponse(data: any, modelId: string): string {
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
