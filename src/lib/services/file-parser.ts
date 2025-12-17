// file-parser.ts
// Парсинг файлов на клиенте

export class FileParser {
  async extractText(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'txt':
        return this.extractTextFromTxt(file);
      case 'pdf':
        return this.extractTextFromPdf(file);
      case 'docx':
        return this.extractTextFromDocx(file);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  private async extractTextFromTxt(file: File): Promise<string> {
    return await file.text();
  }

  private async extractTextFromPdf(file: File): Promise<string> {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Настраиваем worker для pdfjs-dist
      if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      
      return text;
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractTextFromDocx(file: File): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

