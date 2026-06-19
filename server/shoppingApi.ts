import { Request, Response } from 'express';
import {
  Language,
  ShoppingExportErrorPayload,
  ShoppingExportRequest,
  ShoppingExportResponse,
  ShoppingItem,
  ShoppingProviderSummary,
  ShoppingSearchResult,
} from '../src/types';
import { buildShoppingIntegrationPlan } from '../src/services/shoppingProviders';

const REQUEST_TIMEOUT_MS = 15000;

class MissingCredentialsError extends Error {
  constructor(
    message: string,
    readonly provider: ShoppingProviderSummary,
    readonly missingCredentials: string[],
  ) {
    super(message);
    this.name = 'MissingCredentialsError';
  }
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ja' || value === 'ko';
}

function isShoppingItem(value: unknown): value is ShoppingItem {
  if (!value || typeof value !== 'object') return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.amount === 'string' &&
    typeof item.checked === 'boolean'
  );
}

function toProviderSummary(provider: {
  id: ShoppingProviderSummary['id'];
  name: string;
  market: ShoppingProviderSummary['market'];
}) {
  return {
    id: provider.id,
    name: provider.name,
    market: provider.market,
  } satisfies ShoppingProviderSummary;
}

function getMissingCredentials(keys: string[]) {
  return keys.filter((key) => !process.env[key]);
}

function assertProviderCredentials(provider: {
  id: ShoppingProviderSummary['id'];
  name: string;
  market: ShoppingProviderSummary['market'];
  credentials: string[];
}) {
  const missingCredentials = getMissingCredentials(provider.credentials);

  if (missingCredentials.length > 0) {
    throw new MissingCredentialsError(
      `Missing provider credentials for ${provider.name}. Add ${missingCredentials.join(', ')} to your environment before requesting live shopping exports.`,
      toProviderSummary(provider),
      missingCredentials,
    );
  }
}

function toLocale(language: Language) {
  switch (language) {
    case 'ja':
      return 'ja-JP';
    case 'ko':
      return 'ko-KR';
    default:
      return 'en-US';
  }
}

function formatCurrency(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function parseErrorResponse(response: globalThis.Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

async function requireOk(response: globalThis.Response) {
  if (response.ok) return;

  const errorBody = await parseErrorResponse(response);
  const detail = typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody);
  throw new Error(`Provider request failed with ${response.status}: ${detail}`);
}

async function fetchInstacartExport(payload: ShoppingExportRequest): Promise<ShoppingExportResponse> {
  const plan = buildShoppingIntegrationPlan(payload.language, payload.items);
  assertProviderCredentials(plan.provider);

  const requestBody = {
    ...(plan.requestPreview.body as Record<string, unknown>),
    landing_page_configuration: {
      enable_pantry_items: true,
      ...(process.env.APP_URL ? { partner_linkback_url: process.env.APP_URL } : {}),
    },
  };

  const response = await fetch(plan.provider.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.INSTACART_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  await requireOk(response);
  const data = (await response.json()) as { products_link_url?: string };

  if (!data.products_link_url) {
    throw new Error('Instacart did not return a shopping list URL.');
  }

  return {
    provider: toProviderSummary(plan.provider),
    mode: 'link',
    query: plan.combinedQuery,
    url: data.products_link_url,
    message: 'Shopping link ready.',
  };
}

function mapRakutenItem(item: Record<string, unknown>, index: number, locale: string): ShoppingSearchResult | null {
  const title = typeof item.itemName === 'string' ? item.itemName : null;
  const url = typeof item.itemUrl === 'string' ? item.itemUrl : null;

  if (!title || !url) {
    return null;
  }

  const mediumImages = Array.isArray(item.mediumImageUrls) ? item.mediumImageUrls : [];
  const firstImage = mediumImages.find(
    (entry): entry is { imageUrl: string } =>
      Boolean(entry) && typeof entry === 'object' && typeof (entry as { imageUrl?: unknown }).imageUrl === 'string',
  );

  return {
    id: typeof item.itemCode === 'string' ? item.itemCode : `rakuten-${index}`,
    title,
    url,
    imageUrl: firstImage?.imageUrl,
    merchant: typeof item.shopName === 'string' ? item.shopName : undefined,
    price:
      typeof item.itemPrice === 'number'
        ? formatCurrency(item.itemPrice, 'JPY', locale)
        : undefined,
  };
}

async function fetchRakutenResults(payload: ShoppingExportRequest): Promise<ShoppingExportResponse> {
  const plan = buildShoppingIntegrationPlan(payload.language, payload.items);
  assertProviderCredentials(plan.provider);

  const url = new URL(plan.provider.endpoint);
  Object.entries(plan.requestPreview.query || {}).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    headers: {
      accessKey: process.env.RAKUTEN_ACCESS_KEY!,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  await requireOk(response);
  const data = (await response.json()) as { items?: Record<string, unknown>[] };
  const results = Array.isArray(data.items)
    ? data.items
        .map((item, index) => mapRakutenItem(item, index, toLocale(payload.language)))
        .filter((item): item is ShoppingSearchResult => Boolean(item))
    : [];

  return {
    provider: toProviderSummary(plan.provider),
    mode: 'results',
    query: plan.combinedQuery,
    results,
    message: results.length > 0 ? 'Live results ready.' : 'No results found.',
  };
}

function mapNaverItem(item: Record<string, unknown>, index: number, locale: string): ShoppingSearchResult | null {
  const title = typeof item.title === 'string' ? stripHtml(item.title) : null;
  const url = typeof item.link === 'string' ? item.link : null;

  if (!title || !url) {
    return null;
  }

  const lowPrice = typeof item.lprice === 'string' ? Number(item.lprice) : Number.NaN;

  return {
    id: typeof item.productId === 'string' ? item.productId : `naver-${index}`,
    title,
    url,
    imageUrl: typeof item.image === 'string' ? item.image : undefined,
    merchant: typeof item.mallName === 'string' ? item.mallName : undefined,
    price: Number.isFinite(lowPrice) ? formatCurrency(lowPrice, 'KRW', locale) : undefined,
  };
}

async function fetchNaverResults(payload: ShoppingExportRequest): Promise<ShoppingExportResponse> {
  const plan = buildShoppingIntegrationPlan(payload.language, payload.items);
  assertProviderCredentials(plan.provider);

  const url = new URL(plan.provider.endpoint);
  Object.entries(plan.requestPreview.query || {}).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID!,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET!,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  await requireOk(response);
  const data = (await response.json()) as { items?: Record<string, unknown>[] };
  const results = Array.isArray(data.items)
    ? data.items
        .map((item, index) => mapNaverItem(item, index, toLocale(payload.language)))
        .filter((item): item is ShoppingSearchResult => Boolean(item))
    : [];

  return {
    provider: toProviderSummary(plan.provider),
    mode: 'results',
    query: plan.combinedQuery,
    results,
    message: results.length > 0 ? 'Live results ready.' : 'No results found.',
  };
}

async function createShoppingExport(payload: ShoppingExportRequest) {
  const plan = buildShoppingIntegrationPlan(payload.language, payload.items);

  switch (plan.provider.id) {
    case 'instacart':
      return fetchInstacartExport(payload);
    case 'rakuten':
      return fetchRakutenResults(payload);
    case 'naver':
      return fetchNaverResults(payload);
    default:
      throw new Error('Unsupported shopping provider.');
  }
}

export async function handleShoppingExport(req: Request, res: Response) {
  const body = req.body as Partial<ShoppingExportRequest> | undefined;
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!isLanguage(body?.language)) {
    const error: ShoppingExportErrorPayload = {
      message: 'Invalid language provided for shopping export.',
    };
    res.status(400).json(error);
    return;
  }

  if (!Array.isArray(body?.items) || items.some((item) => !isShoppingItem(item))) {
    const error: ShoppingExportErrorPayload = {
      message: 'Shopping export expects a list of shopping items.',
    };
    res.status(400).json(error);
    return;
  }

  if (items.every((item) => item.checked)) {
    const error: ShoppingExportErrorPayload = {
      message: 'There are no unchecked shopping items to export.',
    };
    res.status(400).json(error);
    return;
  }

  try {
    const result = await createShoppingExport({
      language: body.language,
      items,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof MissingCredentialsError) {
      const payload: ShoppingExportErrorPayload = {
        message: error.message,
        provider: error.provider,
        missingCredentials: error.missingCredentials,
      };
      res.status(503).json(payload);
      return;
    }

    const payload: ShoppingExportErrorPayload = {
      message: error instanceof Error ? error.message : 'Unable to create a shopping export.',
    };
    res.status(502).json(payload);
  }
}
