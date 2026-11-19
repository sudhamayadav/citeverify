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

export type TavilySearchRequest = z.infer<typeof TavilySearchRequestSchema>;
export type TavilySearchResponse = z.infer<typeof TavilySearchResponseSchema>;
export type TavilyExtractRequest = z.infer<typeof TavilyExtractRequestSchema>;
export type TavilyExtractResponse = z.infer<typeof TavilyExtractResponseSchema>;
export type TavilyResearchRequest = z.infer<typeof TavilyResearchRequestSchema>;
export type TavilyResearchStatusResponse = z.infer<typeof TavilyResearchStatusResponseSchema>;
