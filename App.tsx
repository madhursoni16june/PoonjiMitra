
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { InputForm } from './components/InputForm.tsx';
import { AnalysisDisplay } from './components/AnalysisDisplay.tsx';
import { LoadingSpinner } from './components/LoadingSpinner.tsx';
import { ErrorDisplay } from './components/ErrorDisplay.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { PortfolioView } from './components/PortfolioView.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { getPoonjiMitraAnalysis, fetchCurrentPrices } from './lib/gemini.ts';
import type { Analysis, GroundingSource, Client } from './types.ts';
import { initialPortfolioData } from './data/portfolioData.ts';
import { isMarketOpen } from './lib/marketStatus.ts';

type Tab = 'analysis' | 'portfolio';

export default function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [portfolios, setPortfolios] = useState<Client[]>(initialPortfolioData);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleAnalyze = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPriceError("Query cannot be empty.");
      return;
    }
    setIsLoading(true);
    setPriceError(null);
    setAnalysis(null);
    setSources([]);
    try {
      const { analysis: result, sources: resultSources } = await getPoonjiMitraAnalysis(query);
      setAnalysis(result);
      setSources(resultSources);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setPriceError(`Failed to get analysis: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUpdateClient = (updatedClient: Client) => {
    setPortfolios(prev => prev.map(p => p.id === updatedClient.id ? updatedClient : p));
  };

  const handleFetchPrices = useCallback(async () => {
    const uniqueTickers = [...new Set(portfolios.flatMap(p => p.holdings.map(h => h.ticker)))];
    if (uniqueTickers.length === 0) return;
    
    if (!isMarketOpen()) {
        console.log("Market is closed. Skipping price refresh.");
        return;
    }

    setIsRefreshingPrices(true);
    setPriceError(null);
    try {
      const priceMap = await fetchCurrentPrices(uniqueTickers);
      if (Object.keys(priceMap).length === 0) {
        throw new Error("AI did not return any price data. Please try again.");
      }
      setPortfolios(prev => 
        prev.map(client => ({
          ...client,
          holdings: client.holdings.map(h => ({
            ...h,
            currentPrice: priceMap[h.ticker.toUpperCase()] ?? h.currentPrice,
          }))
        }))
      );
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch prices:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setPriceError(errorMessage);
    } finally {
      setIsRefreshingPrices(false);
    }
  }, [portfolios]);

  useEffect(() => {
    if (activeTab === 'portfolio') {
      const marketNowOpen = isMarketOpen();
      if (marketNowOpen) {
        handleFetchPrices();
        const interval = setInterval(handleFetchPrices, 30000); // 30 seconds for live updates
        return () => clearInterval(interval);
      }
    }
  }, [activeTab, handleFetchPrices]);


  const TabButton = ({ tab, children }: { tab: Tab, children: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
        activeTab === tab
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/70'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-slate-200">
      <div className="absolute inset-0 -z-10 h-full w-full bg-black bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      <Header onShareClick={() => setIsShareModalOpen(true)} />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center space-x-4 mb-8">
            <TabButton tab="analysis">AI Analysis</TabButton>
            <TabButton tab="portfolio">Client Portfolios</TabButton>
          </div>

          {activeTab === 'analysis' && (
            <div className="max-w-3xl mx-auto">
              <InputForm onSubmit={handleAnalyze} isLoading={isLoading} />
              <div className="mt-8">
                {isLoading && <LoadingSpinner />}
                {priceError && <ErrorDisplay message={priceError} />}
                {analysis && <AnalysisDisplay result={analysis} sources={sources} />}
                {!isLoading && !priceError && !analysis && <WelcomeScreen />}
              </div>
            </div>
          )}

          {activeTab === 'portfolio' && <PortfolioView portfolios={portfolios} onUpdateClient={handleUpdateClient} onRefreshPrices={handleFetchPrices} onSetPortfolios={setPortfolios} isRefreshingPrices={isRefreshingPrices} lastUpdated={lastUpdated} priceError={priceError} />}
        </div>
      </main>
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />
    </div>
  );
}
