export function calculateJobTaxWithholding(
  finalPrice: number | null,
  materialsCost: number | null,
  withholdingPercentage: number
): { netProfit: number; recommendedWithholding: number; afterTaxProfit: number } {
  const revenue = finalPrice || 0;
  const expenses = materialsCost || 0;
  const netProfit = revenue - expenses;

  const recommendedWithholding = netProfit * (withholdingPercentage / 100);
  const afterTaxProfit = netProfit - recommendedWithholding;

  return {
    netProfit: Math.round(netProfit * 100) / 100,
    recommendedWithholding: Math.round(recommendedWithholding * 100) / 100,
    afterTaxProfit: Math.round(afterTaxProfit * 100) / 100,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
