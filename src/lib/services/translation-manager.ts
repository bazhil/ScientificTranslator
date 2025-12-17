// translation-manager.ts
// Координация процесса перевода

import { HuggingFaceTranslationService, TranslationResponse, TranslationProgress } from './huggingface-translation-service';
import { FileParser } from './file-parser';

export class TranslationManager {
  private translationService: HuggingFaceTranslationService;
  private fileParser: FileParser;

  constructor() {
    this.translationService = new HuggingFaceTranslationService();
    this.fileParser = new FileParser();
  }

  async translate(
    input: string | File,
    targetLanguage: string,
    sourceLanguage?: string,
    model?: string,
    config?: { apiKey?: string; useInferenceAPI?: boolean },
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationResponse> {
    let text: string;

    if (input instanceof File) {
      onProgress?.({
        progress: 0,
        status: 'loading',
        message: 'Extracting text from file...'
      });
      text = await this.fileParser.extractText(input);
      onProgress?.({
        progress: 10,
        status: 'processing',
        message: 'Text extracted, starting translation...'
      });
    } else {
      text = input;
    }

    return this.translationService.translate(
      text,
      targetLanguage,
      sourceLanguage,
      model,
      config,
      onProgress
    );
  }

  async exportToFile(
    originalText: string,
    translatedText: string,
    format: 'txt' | 'pdf' = 'txt',
    filename?: string
  ): Promise<void> {
    if (format === 'txt') {
      const content = `Original Text:\n${originalText}\n\nTranslated Text:\n${translatedText}`;
      this.downloadFile(content, filename || 'translation.txt', 'text/plain');
    } else if (format === 'pdf') {
      await this.exportToPdf(originalText, translatedText, filename);
    }
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async exportToPdf(originalText: string, translatedText: string, filename?: string): Promise<void> {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(12);
      doc.text('Original Text:', 10, 10);
      const lines1 = doc.splitTextToSize(originalText, 190);
      doc.text(lines1, 10, 20);
      
      const yPos = 20 + (lines1.length * 7) + 10;
      doc.text('Translated Text:', 10, yPos);
      const lines2 = doc.splitTextToSize(translatedText, 190);
      doc.text(lines2, 10, yPos + 10);
      
      doc.save(filename || 'translation.pdf');
    } catch (error) {
      throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }
}

