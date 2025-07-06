import { Header } from '@/components/header';
import { Translator } from '@/components/translator';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-body">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Translator />
      </main>
    </div>
  );
}
