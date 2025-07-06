'use server';

/**
 * @fileOverview A Genkit flow for suggesting improvements to a translated text segment.
 *
 * - suggestTranslationImprovements - A function that suggests improvements to a translated text segment.
 * - SuggestTranslationImprovementsInput - The input type for the suggestTranslationImprovements function.
 * - SuggestTranslationImprovementsOutput - The return type for the suggestTranslationImprovements function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTranslationImprovementsInputSchema = z.object({
  originalText: z.string().describe('The original text segment.'),
  translatedText: z.string().describe('The translated text segment to improve.'),
  targetLanguage: z.string().describe('The target language of the translation.'),
});
export type SuggestTranslationImprovementsInput = z.infer<typeof SuggestTranslationImprovementsInputSchema>;

const SuggestTranslationImprovementsOutputSchema = z.object({
  improvedTranslation: z.string().describe('The improved translation of the text segment.'),
  explanation: z.string().describe('An explanation of the improvements made.'),
});
export type SuggestTranslationImprovementsOutput = z.infer<typeof SuggestTranslationImprovementsOutputSchema>;

export async function suggestTranslationImprovements(input: SuggestTranslationImprovementsInput): Promise<SuggestTranslationImprovementsOutput> {
  return suggestTranslationImprovementsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTranslationImprovementsPrompt',
  input: {schema: SuggestTranslationImprovementsInputSchema},
  output: {schema: SuggestTranslationImprovementsOutputSchema},
  prompt: `You are a professional translator. You are provided with an original text segment, its translation, and the target language of the translation. Your task is to improve the translated text segment and provide an explanation of the improvements you made.

Original Text: {{{originalText}}}
Translated Text: {{{translatedText}}}
Target Language: {{{targetLanguage}}}

Improve the translated text and provide an explanation of the improvements.
`,}
);

const suggestTranslationImprovementsFlow = ai.defineFlow(
  {
    name: 'suggestTranslationImprovementsFlow',
    inputSchema: SuggestTranslationImprovementsInputSchema,
    outputSchema: SuggestTranslationImprovementsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
