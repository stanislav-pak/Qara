/**
 * Келесі итерацияларға арналған модуль каркасы (имплементация кейінге қалдырылды).
 */
export const plannedModules = {
  inventory: {
    id: 'inventory-2',
    features: ['multi-warehouse', 'qr-barcode'] as const,
  },
  crm: {
    id: 'crm',
    features: ['loyalty'] as const,
  },
  finance: {
    id: 'finance',
    features: ['kzt', 'tax-reporting'] as const,
  },
  ai: {
    id: 'ai-insights',
    features: ['stockout-prediction', 'sales-trends'] as const,
  },
} as const
