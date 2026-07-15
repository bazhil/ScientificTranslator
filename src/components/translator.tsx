"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  Languages,
  FileText,
  Download,
  Sparkles,
  Clipboard,
  ClipboardCheck,
  Settings,
} from "lucide-react";
import { handleTranslation } from "@/app/actions";
import { TranslationManager } from "@/lib/services/translation-manager";
import { HuggingFaceTranslationService, HuggingFaceModel } from "@/lib/services/huggingface-translation-service";
import { getHuggingFaceLanguageCode } from "@/lib/services/language-mapper";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;


const languages = [
  "Spanish", "French", "German", "Japanese", "Chinese (Simplified)", "Russian", "Arabic", "Portuguese", "Italian", "Korean"
];

type TranslationProvider = 'yandex' | 'huggingface';

export function Translator() {
  const [originalText, setOriginalText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState(languages[0]);
  const [provider, setProvider] = useState<TranslationProvider>('yandex');
  const [huggingfaceModel, setHuggingfaceModel] = useState<string>('Helsinki-NLP/opus-mt-en-ru');
  const [huggingfaceApiKey, setHuggingfaceApiKey] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<HuggingFaceModel[]>([]);
  const [translationProgress, setTranslationProgress] = useState<{ progress: number; status: string; message?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  
  // Используем useMemo для создания сервисов один раз
  const translationManager = useMemo(() => new TranslationManager(), []);
  const huggingfaceService = useMemo(() => new HuggingFaceTranslationService(), []);

  // Загружаем доступные модели при монтировании
  useEffect(() => {
    huggingfaceService.getAvailableModels().then(models => {
      setAvailableModels(models);
    });
  }, [huggingfaceService]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        let text = "";
        if (file.type === "text/plain") {
          text = await file.text();
        } else if (file.type === "application/pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = pdf.numPages;
          const pageTexts = await Promise.all(
            Array.from({ length: numPages }, async (_, i) => {
              const page = await pdf.getPage(i + 1);
              const textContent = await page.getTextContent();
              return textContent.items.map((item: any) => item.str).join(" ");
            })
          );
          text = pageTexts.join("\n");
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else {
          toast({
            variant: "destructive",
            title: "Unsupported file type",
            description: "Currently, only .txt, .pdf, and .docx files are supported.",
          });
          return;
        }
        setOriginalText(text);
        toast({
          title: "File uploaded",
          description: "The content of the file has been loaded into the text area.",
        });
      } catch (error) {
        console.error("Error processing file:", error);
        toast({
          variant: "destructive",
          title: "Error processing file",
          description: "There was an issue extracting text from the file.",
        });
      } finally {
        // Reset file input value to allow re-uploading the same file
        event.target.value = "";
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (originalText.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Input Error",
        description: "Original text must be at least 10 characters long.",
      });
      return;
    }
    
    if (provider === 'yandex') {
      // Используем существующий серверный action для Yandex
      startTransition(async () => {
        const formData = new FormData();
        formData.append('text', originalText);
        formData.append('targetLanguage', targetLanguage);
        
        const result = await handleTranslation(formData);

        if (result.error) {
          const errorMessage = result.error.text?.[0] || result.error.server?.[0] || "An unexpected error occurred.";
          toast({
            variant: "destructive",
            title: "Translation Failed",
            description: errorMessage,
          });
          setTranslatedText("");
          setTranslationProgress(null);
        } else if (result.data) {
          setTranslatedText(result.data.translatedText);
          setTranslationProgress({ progress: 100, status: 'completed', message: 'Translation completed' });
          toast({
            title: "Success",
            description: "Text translated successfully.",
          });
        }
      });
    } else {
      // Используем HuggingFace через клиентский сервис
      setTranslationProgress({ progress: 0, status: 'loading', message: 'Starting translation...' });
      setTranslatedText('');
      
      try {
        const targetLangCode = getHuggingFaceLanguageCode(targetLanguage);
        const result = await translationManager.translate(
          originalText,
          targetLangCode,
          undefined, // sourceLanguage - автоопределение
          huggingfaceModel,
          {
            apiKey: huggingfaceApiKey || undefined,
            useInferenceAPI: true, // Используем Inference API по умолчанию
          },
          (progress) => {
            setTranslationProgress({
              progress: progress.progress,
              status: progress.status,
              message: progress.message,
            });
          }
        );
        
        setTranslatedText(result.translatedText);
        setTranslationProgress({ progress: 100, status: 'completed', message: 'Translation completed' });
        toast({
          title: "Success",
          description: "Text translated successfully using HuggingFace.",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Translation failed';
        setTranslationProgress({ progress: 0, status: 'error', message: errorMessage });
        toast({
          variant: "destructive",
          title: "Translation Failed",
          description: errorMessage,
        });
        setTranslatedText("");
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (translatedText && originalText) {
      try {
        await translationManager.exportToFile(originalText, translatedText, 'pdf');
        toast({
          title: "Success",
          description: "Translation exported to PDF.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Export Failed",
          description: error instanceof Error ? error.message : 'Failed to export PDF',
        });
      }
    }
  };
  
  const handleCopyToClipboard = async () => {
    if (translatedText) {
      try {
        await translationManager.copyToClipboard(translatedText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast({
          title: "Copied",
          description: "Translation copied to clipboard.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Copy Failed",
          description: "Failed to copy to clipboard.",
        });
      }
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <FileText className="text-primary" />
              Original Text
            </CardTitle>
            <CardDescription>
              Upload a .txt, .pdf, or .docx file, or paste your text below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <div className="relative border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors group">
                  <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    <label
                      htmlFor="file-upload"
                      className="relative font-semibold text-primary cursor-pointer hover:underline focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                    >
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".txt,.pdf,.docx" onChange={handleFileChange} />
                    </label>
                    {" "}or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">.txt, .pdf, and .docx files are supported</p>
                </div>
              </div>

              <Textarea
                placeholder="Paste your text here..."
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                className="min-h-[200px] text-base"
                required
              />

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Settings className="text-primary"/>
                    Translation Provider
                  </label>
                  <RadioGroup value={provider} onValueChange={(value) => setProvider(value as TranslationProvider)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yandex" id="yandex" />
                      <Label htmlFor="yandex" className="cursor-pointer">Yandex SpeechKit</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="huggingface" id="huggingface" />
                      <Label htmlFor="huggingface" className="cursor-pointer">HuggingFace</Label>
                    </div>
                  </RadioGroup>
                </div>

                {provider === 'huggingface' && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                      <Label htmlFor="hf-model" className="text-sm font-medium">HuggingFace Model</Label>
                      <Select value={huggingfaceModel} onValueChange={setHuggingfaceModel}>
                        <SelectTrigger id="hf-model">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hf-api-key" className="text-sm font-medium">
                        HuggingFace API Key (Optional)
                      </Label>
                      <Input
                        id="hf-api-key"
                        type="password"
                        placeholder="hf_..."
                        value={huggingfaceApiKey}
                        onChange={(e) => setHuggingfaceApiKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional: API key for faster inference and higher rate limits
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                   <label className="text-sm font-medium flex items-center gap-2">
                     <Languages className="text-primary"/>
                     Translate to
                   </label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {translationProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{translationProgress.message || 'Processing...'}</span>
                    <span className="text-muted-foreground">{translationProgress.progress}%</span>
                  </div>
                  <Progress value={translationProgress.progress} />
                </div>
              )}

              <Button type="submit" disabled={isPending || (translationProgress?.status === 'processing' || translationProgress?.status === 'loading')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                {isPending || translationProgress?.status === 'processing' || translationProgress?.status === 'loading' ? "Translating..." : "Translate"}
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Sparkles className="text-accent" />
              Translated Text
            </CardTitle>
            <CardDescription>
              The AI-powered translation will appear below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative min-h-[400px] rounded-md border bg-muted/50 p-4 printable-area">
              {isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : translatedText ? (
                <p className="text-base whitespace-pre-wrap">{translatedText}</p>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Translation results will be shown here.</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleCopyToClipboard} variant="outline" disabled={!translatedText || isPending} className="w-full">
                {isCopied ? <ClipboardCheck className="mr-2"/> : <Clipboard className="mr-2"/>}
                {isCopied ? "Copied!" : "Copy"}
              </Button>
              <Button onClick={handleDownloadPdf} disabled={!translatedText || isPending} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
                <Download className="mr-2 h-4 w-4" />
                Download as PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
