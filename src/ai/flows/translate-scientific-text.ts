'use server';

/**
 * @fileOverview This file defines a Genkit flow for translating scientific text from one language to another,
 * preserving the original formatting and layout of the document.
 *
 * - translateScientificText - A function that takes the document text and target language as input and returns the translated text.
 * - TranslateScientificTextInput - The input type for the translateScientificText function.
 * - TranslateScientificTextOutput - The return type for the translateScientificText function.
 */

// Import necessary libraries
import {genkit} from 'genkit';
import {z} from 'genkit';
import GigaChat from 'gigachat';
import {ai} from '@/ai/genkit'; // <-- Added back the requested import

// Create an instance of GigaChat with your API Token
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

// Main function to handle translation using GigaChat
export async function translateScientificText(
  input: TranslateScientificTextInput
): Promise<TranslateScientificTextOutput> {
  return translateScientificTextFlow(input);
}

// Define a custom prompt for translation task
const promptTemplate = `
You are a professional translator specializing in scientific documents.
Translate the following text into "{{input.targetLanguage}}", preserving the original formatting and layout as much as possible.

Original Text:
{{input.text}}
`;

// Flow definition for processing translations through GigaChat
const translateScientificTextFlow = ai.defineFlow(
  {
    name: 'translateScientificTextFlow',
    inputSchema: TranslateScientificTextInputSchema,
    outputSchema: TranslateScientificTextOutputSchema,
  },
  async input => {
    // Render the prompt template with actual values
    const renderedPrompt = promptTemplate.replace(/\{\{\{(.+?)\}\}\}/g, (_, key) => input[key]);

    // Send the request to GigaChat
    const {output} = await gigaChatInstance.chat({
      messages: [{role: 'user', content: renderedPrompt}]
    });

    return output!;
  }
);
