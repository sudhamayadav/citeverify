import {
  TavilySearchRequest,
  TavilySearchResponse,
  TavilySearchResponseSchema,
  TavilyExtractRequest,
  TavilyExtractResponse,
  TavilyExtractResponseSchema,
  TavilyResearchRequest,
  TavilyResearchCreateResponseSchema,
  TavilyResearchStatusResponse,
  TavilyResearchStatusResponseSchema,
} from './tavilySchemas';

export class TavilyApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TavilyApiError';
  }
}

export interface TavilyClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class TavilyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: TavilyClientConfig = {}) {
    this.apiKey = config.apiKey || process.env.TAVILY_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.tavily.com';
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new TavilyApiError(401, 'MISSING_API_KEY', 'TAVILY_API_KEY is not configured on the server');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * POST /search
   */
  async search(req: TavilySearchRequest): Promise<TavilySearchResponse> {
    const url = `${this.baseUrl}/search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new TavilyApiError(res.status, `HTTP_${res.status}`, `Tavily Search failed with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return TavilySearchResponseSchema.parse(data);
  }

  /**
   * POST /extract
   */
  async extract(req: TavilyExtractRequest): Promise<TavilyExtractResponse> {
    const url = `${this.baseUrl}/extract`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new TavilyApiError(res.status, `HTTP_${res.status}`, `Tavily Extract failed with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return TavilyExtractResponseSchema.parse(data);
  }

  /**
   * POST /research
   */
  async createResearch(req: TavilyResearchRequest): Promise<{ request_id: string }> {
    const url = `${this.baseUrl}/research`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new TavilyApiError(res.status, `HTTP_${res.status}`, `Tavily Research creation failed with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return TavilyResearchCreateResponseSchema.parse(data);
  }

  /**
   * GET /research/:request_id
   */
  async getResearchStatus(requestId: string): Promise<TavilyResearchStatusResponse> {
    const url = `${this.baseUrl}/research/${encodeURIComponent(requestId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new TavilyApiError(res.status, `HTTP_${res.status}`, `Tavily Research status failed with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return TavilyResearchStatusResponseSchema.parse(data);
  }
}
