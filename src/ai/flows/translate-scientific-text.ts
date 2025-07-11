'use server';

/**
 * @fileOverview This file defines a Genkit flow for translating scientific text from one language to another,
 * preserving the original formatting and layout of the document.
 */

// Import necessary libraries
import { genkit } from 'genkit';
import { z } from 'genkit';
import GigaChat from 'gigachat';
import { ai } from '@/ai/genkit';

// Create an instance of GigaChat
const gigaChatInstance = new GigaChat({
  credentials: process.env.GIGA_CHAT_AUTH_KEY,
  scope: process.env.GIGA_CHAT_SCOPE,
  model: process.env.GIGA_CHAT_MODEL,
});

// Input schema definition
const TranslateScientificTextInputSchema = z.object({
  text: z.string().describe('The scientific text to translate.'),
  targetLanguage: z.string().describe('The target language for translation.'),
});
export type TranslateScientificTextInput = z.infer<typeof TranslateScientificTextInputSchema>;

// Output schema definition
const TranslateScientificTextOutputSchema = z.object({
  translatedText: z.string().describe('The translated scientific text.'),
});
export type TranslateScientificTextOutput = z.infer<typeof TranslateScientificTextOutputSchema>;

// Custom prompt for translation
const promptTemplate = `
You are a professional translator specializing in scientific documents.
Translate the following text into "{{input.targetLanguage}}", preserving the original formatting and layout as much as possible.

Original Text:
{{input.text}}
`;

// Main translation function
export async function translateScientificText(
  input: TranslateScientificTextInput
): Promise<TranslateScientificTextOutput> {
  try {
    // Render the prompt template
    const renderedPrompt = promptTemplate
      .replace('{{input.targetLanguage}}', input.targetLanguage)
      .replace('{{input.text}}', input.text);

    // Process translation sequentially
    const response = await gigaChatInstance.chat({
      messages: [{ role: 'user', content: renderedPrompt }]
    });
    return {
      translatedText: response.choices[0]?.message?.content || ''
    };
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Failed to translate text');
  }
}

// Flow definition (non-promise version)
export const translateScientificTextFlow = ai.defineFlow(
  {
    name: 'translateScientificTextFlow',
    inputSchema: TranslateScientificTextInputSchema,
    outputSchema: TranslateScientificTextOutputSchema,
  },
  async (input) => {
    return await translateScientificText(input);
  }
);