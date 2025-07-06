"use server";

import { translateScientificText } from "@/ai/flows/translate-scientific-text";
import { z } from 'zod';

const translateSchema = z.object({
  text: z.string().min(10, { message: "Text must be at least 10 characters long." }),
  targetLanguage: z.string(),
});

type TranslationState = {
  data?: { translatedText: string };
  error?: {
    text?: string[];
    targetLanguage?: string[];
    server?: string[];
  }
}

export async function handleTranslation(formData: FormData): Promise<TranslationState> {
  const rawData = {
    text: formData.get('text'),
    targetLanguage: formData.get('targetLanguage'),
  };

  const validatedFields = translateSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await translateScientificText({
      text: validatedFields.data.text,
      targetLanguage: validatedFields.data.targetLanguage,
    });
    return { data: result };
  } catch (error) {
    console.error("Translation error:", error);
    return {
      error: { server: ['An error occurred during translation. Please try again later.'] }
    };
  }
}
