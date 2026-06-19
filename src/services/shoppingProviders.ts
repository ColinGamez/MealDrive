import { parseQuantity } from '../lib/ingredientUtils';
import { Language, ShoppingItem, ShoppingProviderId, ShoppingMarket } from '../types';

interface ShoppingProviderDefinition {
  id: ShoppingProviderId;
  name: string;
  market: ShoppingMarket;
  docsUrl: string;
  endpoint: string;
  method: 'GET' | 'POST';
  credentials: string[];
}

type ShoppingRequestPreview = {
  method: 'GET' | 'POST';
  endpoint: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number>;
  body?: Record<string, unknown>;
};

export interface ShoppingIntegrationPlan {
  provider: ShoppingProviderDefinition;
  activeItems: ShoppingItem[];
  combinedQuery: string;
  requestPreview: ShoppingRequestPreview;
  noteKeys: string[];
}

const SUPPORTED_INSTACART_UNITS = new Set([
  'each',
  'cup',
  'tbsp',
  'tsp',
  'oz',
  'lb',
  'g',
  'kg',
  'ml',
  'l',
  'package',
  'can',
  'bottle',
]);

const PROVIDERS: Record<Language, ShoppingProviderDefinition> = {
  en: {
    id: 'instacart',
    name: 'Instacart',
    market: 'northAmerica',
    docsUrl: 'https://docs.instacart.com/developer_platform_api/',
    endpoint: 'https://connect.instacart.com/idp/v1/products/products_link',
    method: 'POST',
    credentials: ['INSTACART_API_KEY'],
  },
  ja: {
    id: 'rakuten',
    name: 'Rakuten',
    market: 'japan',
    docsUrl: 'https://webservice.rakuten.co.jp/index.php/documentation/ichiba-item-search',
    endpoint: 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401',
    method: 'GET',
    credentials: ['RAKUTEN_APPLICATION_ID', 'RAKUTEN_ACCESS_KEY'],
  },
  ko: {
    id: 'naver',
    name: 'Naver Shopping',
    market: 'korea',
    docsUrl: 'https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md',
    endpoint: 'https://openapi.naver.com/v1/search/shop.json',
    method: 'GET',
    credentials: ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET'],
  },
};

function getActiveItems(items: ShoppingItem[]) {
  return items.filter((item) => !item.checked);
}

function buildCombinedQuery(items: ShoppingItem[]) {
  return items
    .map((item) => item.name.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}

function normalizeInstacartUnit(unit: string) {
  if (!unit) return 'each';

  if (unit === 'unit' || unit === 'units' || unit === 'count') {
    return 'each';
  }

  if (SUPPORTED_INSTACART_UNITS.has(unit)) {
    return unit;
  }

  return null;
}

function toInstacartLineItem(item: ShoppingItem) {
  const { value, unit } = parseQuantity(item.amount);
  const displayText = item.amount ? `${item.amount} ${item.name}` : item.name;
  const normalizedUnit = normalizeInstacartUnit(unit);

  if (value <= 0) {
    return {
      name: item.name,
      display_text: displayText,
    };
  }

  return {
    name: item.name,
    display_text: displayText,
    ...(normalizedUnit
      ? {
          line_item_measurements: [
            {
              quantity: value.toString(),
              unit: normalizedUnit,
            },
          ],
        }
      : {}),
  };
}

function buildInstacartPreview(items: ShoppingItem[], provider: ShoppingProviderDefinition): ShoppingRequestPreview {
  return {
    method: provider.method,
    endpoint: provider.endpoint,
    headers: {
      Authorization: 'Bearer <INSTACART_API_KEY>',
      'Content-Type': 'application/json',
    },
    body: {
      title: 'mealDrive Shopping List',
      line_items: items.map(toInstacartLineItem),
    },
  };
}

function buildRakutenPreview(query: string, provider: ShoppingProviderDefinition): ShoppingRequestPreview {
  return {
    method: provider.method,
    endpoint: provider.endpoint,
    headers: {
      accessKey: '<RAKUTEN_ACCESS_KEY>',
    },
    query: {
      applicationId: '<RAKUTEN_APPLICATION_ID>',
      keyword: query,
      format: 'json',
      formatVersion: 2,
      availability: 1,
      hits: 20,
    },
  };
}

function buildNaverPreview(query: string, provider: ShoppingProviderDefinition): ShoppingRequestPreview {
  return {
    method: provider.method,
    endpoint: provider.endpoint,
    headers: {
      'X-Naver-Client-Id': '<NAVER_CLIENT_ID>',
      'X-Naver-Client-Secret': '<NAVER_CLIENT_SECRET>',
    },
    query: {
      query,
      display: 20,
      sort: 'sim',
    },
  };
}

export function getShoppingProvider(language: Language) {
  return PROVIDERS[language] || PROVIDERS.en;
}

export function buildShoppingIntegrationPlan(language: Language, items: ShoppingItem[]): ShoppingIntegrationPlan {
  const provider = getShoppingProvider(language);
  const activeItems = getActiveItems(items);
  const combinedQuery = buildCombinedQuery(activeItems);

  switch (provider.id) {
    case 'instacart':
      return {
        provider,
        activeItems,
        combinedQuery,
        requestPreview: buildInstacartPreview(activeItems, provider),
        noteKeys: [
          'shopping.instacartNoteCaching',
          'shopping.instacartNoteMeasurement',
        ],
      };
    case 'rakuten':
      return {
        provider,
        activeItems,
        combinedQuery,
        requestPreview: buildRakutenPreview(combinedQuery, provider),
        noteKeys: [
          'shopping.rakutenNoteKeyword',
          'shopping.rakutenNoteGenre',
        ],
      };
    case 'naver':
      return {
        provider,
        activeItems,
        combinedQuery,
        requestPreview: buildNaverPreview(combinedQuery, provider),
        noteKeys: [
          'shopping.naverNoteDiscovery',
          'shopping.naverNoteSecret',
        ],
      };
    default:
      return {
        provider: PROVIDERS.en,
        activeItems,
        combinedQuery,
        requestPreview: buildInstacartPreview(activeItems, PROVIDERS.en),
        noteKeys: [],
      };
  }
}
