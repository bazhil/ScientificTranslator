'use server';

/**
 * @fileOverview This file defines a Genkit flow for translating scientific text from one language to another,
 * preserving the original formatting and layout of the document.
 *
 * - translateScientificText - A function that takes the document text and target language as input and returns the translated text.
 * - TranslateScientificTextInput - The input type for the translateScientificText function.
 * - TranslateScientificTextOutput - The return type for the translateScientificText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranslateScientificTextInputSchema = z.object({
  text: z.string().describe('The scientific text to translate.'),
  targetLanguage: z.string().describe('The target language for translation.'),
});
export type TranslateScientificTextInput = z.infer<typeof TranslateScientificTextInputSchema>;

const TranslateScientificTextOutputSchema = z.object({
  translatedText: z.string().describe('The translated scientific text.'),
});
export type TranslateScientificTextOutput = z.infer<typeof TranslateScientificTextOutputSchema>;

export async function translateScientificText(
  input: TranslateScientificTextInput
): Promise<TranslateScientificTextOutput> {
  return translateScientificTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateScientificTextPrompt',
  input: {schema: TranslateScientificTextInputSchema},
  output: {schema: TranslateScientificTextOutputSchema},
  prompt: `You are a professional translator specializing in scientific documents.  
Translate the following text into {{{targetLanguage}}}, preserving the original formatting and layout as much as possible.

Original Text:
{{{text}}}`,
});

const translateScientificTextFlow = ai.defineFlow(
  {
    name: 'translateScientificTextFlow',
    inputSchema: TranslateScientificTextInputSchema,
    outputSchema: TranslateScientificTextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
