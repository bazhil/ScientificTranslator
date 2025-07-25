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

const CHUNK_SIZE = 4000; // characters

function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  if (text.length <= chunkSize) {
    return [text];
  }

  // Split by newlines to respect paragraph structure
  const parts = text.split(/(\n+)/);
  let currentChunk = '';

  for (const part of parts) {
    if (part.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      // Split large part into smaller chunks
      for (let i = 0; i < part.length; i += chunkSize) {
        chunks.push(part.substring(i, i + chunkSize));
      }
    } else if (currentChunk.length + part.length > chunkSize) {
      chunks.push(currentChunk);
      currentChunk = part;
    } else {
      currentChunk += part;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
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
    const textToTranslate = validatedFields.data.text;
    const targetLanguage = validatedFields.data.targetLanguage;
    const chunks = splitTextIntoChunks(textToTranslate, CHUNK_SIZE);

    let translatedText = '';

    // Process chunks sequentially
    for (const chunk of chunks) {
      const result = await translateScientificText({
        text: chunk,
        targetLanguage: targetLanguage,
      });

      translatedText += result.translatedText;
    }

    return { data: { translatedText } };
  } catch (error) {
    console.error("Translation error:", error);
    return {
      error: { server: ['An error occurred during translation. Please try again later.'] }
    };
  }
}