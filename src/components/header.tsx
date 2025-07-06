import { BeakerIcon } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center">
          <BeakerIcon className="h-6 w-6 text-primary" />
          <h1 className="ml-3 text-2xl font-headline font-bold text-primary">
            ScientificTranslator
          </h1>
        </div>
      </div>
    </header>
  );
}
