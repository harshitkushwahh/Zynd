const FINANCE_QUOTES = [
  "Small, consistent investments can build extraordinary wealth over time.",
  "Time in the market is more powerful than timing the market.",
  "Invest regularly. Stay patient. Let compounding do the heavy lifting.",
  "Every SIP is a step toward your financial freedom.",
  "A diversified portfolio is built for the future, not for today's headlines.",
  "Market volatility is temporary. Financial discipline is permanent.",
  "The best day to start investing was yesterday. The next best day is today.",
  "Wealth is created through consistency, not prediction.",
  "Your financial goals deserve a long-term plan, not short-term reactions.",
  "Invest with confidence. Grow with patience.",
] as const;

export type FinanceQuote = (typeof FINANCE_QUOTES)[number];

/** Returns one finance quote chosen at random from the curated set. */
export function getRandomFinanceQuote(): FinanceQuote {
  const index = Math.floor(Math.random() * FINANCE_QUOTES.length);
  return FINANCE_QUOTES[index];
}

export function getFinanceQuotes(): readonly FinanceQuote[] {
  return FINANCE_QUOTES;
}
