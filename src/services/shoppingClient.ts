import {
  Language,
  ShoppingExportErrorPayload,
  ShoppingExportRequest,
  ShoppingExportResponse,
  ShoppingItem,
} from '../types';

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

  const response = await fetch('/api/shopping/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

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
