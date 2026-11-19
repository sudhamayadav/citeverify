import { z } from 'zod';

export const TavilySearchRequestSchema = z.object({
  query: z.string().min(1),
  search_depth: z.enum(['basic', 'advanced']).default('basic'),
  max_results: z.number().int().min(1).max(20).default(5),
  include_domains: z.array(z.string()).optional(),
  exclude_domains: z.array(z.string()).optional(),
});

export const TavilySearchResultItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  content: z.string(),
  score: z.number().optional(),
  published_date: z.string().optional(),
});

export const TavilySearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(TavilySearchResultItemSchema),
  response_time: z.number().optional(),
});

export const TavilyExtractRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20),
});

export const TavilyExtractResultItemSchema = z.object({
  url: z.string().url(),
  raw_content: z.string(),
});

export const TavilyExtractFailedItemSchema = z.object({
  url: z.string().url(),
  error: z.string(),
});

export const TavilyExtractResponseSchema = z.object({
  results: z.array(TavilyExtractResultItemSchema),
  failed_results: z.array(TavilyExtractFailedItemSchema).optional().default([]),
  response_time: z.number().optional(),
});

export const TavilyResearchRequestSchema = z.object({
  input: z.string(),
  model: z.enum(['mini', 'pro']).default('mini'),
  stream: z.literal(false).default(false),
  output_schema: z.record(z.any()).optional(),
});

export const TavilyResearchCreateResponseSchema = z.object({
  request_id: z.string(),
});

export const TavilyResearchStatusResponseSchema = z.object({
  request_id: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  output: z.any().optional(),
  content: z.any().optional(),
});

export type TavilySearchRequest = z.input<typeof TavilySearchRequestSchema>;
export type TavilySearchResponse = z.infer<typeof TavilySearchResponseSchema>;
export type TavilyExtractRequest = z.input<typeof TavilyExtractRequestSchema>;
export type TavilyExtractResponse = z.infer<typeof TavilyExtractResponseSchema>;
export type TavilyResearchRequest = z.input<typeof TavilyResearchRequestSchema>;
export type TavilyResearchStatusResponse = z.infer<typeof TavilyResearchStatusResponseSchema>;

export class TavilyApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public retryAfter?: number,
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

  private handleErrorResponse(res: Response, errText: string, context: string): never {
    const retryAfterHeader = res.headers?.get?.('Retry-After');
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    let errorCode = `HTTP_${res.status}`;
    if (res.status === 400) errorCode = 'INVALID_REQUEST';
    else if (res.status === 401) errorCode = 'INVALID_API_KEY';
    else if (res.status === 422) errorCode = 'VALIDATION_ERROR';
    else if (res.status === 429) errorCode = 'RATE_LIMIT_EXCEEDED';
    else if (res.status === 432 || res.status === 433) errorCode = 'USAGE_LIMIT_EXCEEDED';
    else if (res.status === 434) errorCode = 'LIVE_CONTENT_FETCH_ERROR';

    throw new TavilyApiError(
      res.status,
      errorCode,
      `${context} failed with status ${res.status}: ${errText}`,
      retryAfter,
      { status: res.status, errorText: errText }
    );
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
      this.handleErrorResponse(res, errText, 'Tavily Search');
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
      this.handleErrorResponse(res, errText, 'Tavily Extract');
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
      this.handleErrorResponse(res, errText, 'Tavily Research creation');
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
      this.handleErrorResponse(res, errText, 'Tavily Research status');
    }

    const data = await res.json();
    return TavilyResearchStatusResponseSchema.parse(data);
  }

  /**
   * Polls research status until completed, failed, or max attempts reached
   */
  async pollResearchStatus(
    requestId: string,
    options: { maxAttempts?: number; delayMs?: number } = {}
  ): Promise<TavilyResearchStatusResponse> {
    const maxAttempts = options.maxAttempts ?? 10;
    const delayMs = options.delayMs ?? 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusRes = await this.getResearchStatus(requestId);
      if (statusRes.status === 'completed' || statusRes.status === 'failed') {
        return statusRes;
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return this.getResearchStatus(requestId);
  }
}
