const FINANCE_QUOTES = [
  "Do not save what is left after spending; spend what is left after saving. — Warren Buffett",
  "The stock market is a device for transferring money from the impatient to the patient. — Warren Buffett",
  "An investment in knowledge pays the best interest. — Benjamin Franklin",
  "Risk comes from not knowing what you are doing. — Warren Buffett",
  "Wealth is the ability to fully experience life. — Henry David Thoreau",
  "It's not how much money you make, but how much you keep. — Robert Kiyosaki",
  "The four most dangerous words in investing are: this time it's different. — Sir John Templeton",
  "Compound interest is the eighth wonder of the world. — Albert Einstein",
  "Know what you own, and know why you own it. — Peter Lynch",
  "Financial peace isn't the acquisition of stuff. It's learning to live on less than you make. — Dave Ramsey",
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
