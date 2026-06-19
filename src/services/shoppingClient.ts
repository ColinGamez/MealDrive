import {
  Language,
  ShoppingExportErrorPayload,
  ShoppingExportRequest,
  ShoppingExportResponse,
  ShoppingItem,
} from '../types';

const CLIENT_TIMEOUT_MS = 30000;

export class ShoppingExportClientError extends Error {
  provider?: ShoppingExportErrorPayload['provider'];
  missingCredentials?: string[];

  constructor(payload: ShoppingExportErrorPayload) {
    super(payload.message);
    this.name = 'ShoppingExportClientError';
    this.provider = payload.provider;
    this.missingCredentials = payload.missingCredentials;
  }
}

export async function exportShoppingList(language: Language, items: ShoppingItem[]) {
  const payload: ShoppingExportRequest = {
    language,
    items,
  };

  let response: Response;
  try {
    response = await fetch('/api/shopping/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new ShoppingExportClientError({
      message: timedOut
        ? 'The shopping provider timed out. Please try again.'
        : 'Unable to reach the shopping provider.',
    });
  }

  const data = (await response.json().catch(() => null)) as
    | ShoppingExportResponse
    | ShoppingExportErrorPayload
    | null;

  if (!response.ok) {
    throw new ShoppingExportClientError(
      data && 'message' in data
        ? data
        : { message: 'Unable to load shopping export.' },
    );
  }

  return data as ShoppingExportResponse;
}
