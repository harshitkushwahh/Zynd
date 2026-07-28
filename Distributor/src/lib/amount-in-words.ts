const BELOW_TWENTY = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return BELOW_TWENTY[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${BELOW_TWENTY[ones]}` : TENS[tens];
}

function threeDigits(n: number): string {
  if (n === 0) return "";
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundred ? `${BELOW_TWENTY[hundred]} Hundred` : "";
  const tail = rest ? twoDigits(rest) : "";
  if (head && tail) return `${head} ${tail}`;
  return head || tail;
}

function integerToWords(n: number): string {
  if (n === 0) return BELOW_TWENTY[0];

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (remainder) parts.push(threeDigits(remainder));

  return parts.join(" ");
}

/** Indian Rupee amount in words (whole rupees; paise optional). */
export function amountInWordsInr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);

  let words = `${integerToWords(whole)} Rupee${whole === 1 ? "" : "s"}`;
  if (paise > 0) {
    words += ` and ${integerToWords(paise)} Paise`;
  }
  words += " Only";
  return words;
}
