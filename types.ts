
export interface GroundingSource {
  uri: string;
  title: string;
}

export interface Analysis {
  stock: string;
  newsSummary: string;
  technicalSignals: string;
  probability: 'High' | 'Medium' | 'Low';
  traderNote: string;
}

export interface AnalysisResponse {
    analysis: Analysis;
    sources: GroundingSource[];
}

export interface Holding {
  id: string;
  ticker: string;
  quantity: number;
  buyingPrice: number;
  currentPrice?: number;
}

export interface Client {
  id: string;
  name: string;
  holdings: Holding[];
}
