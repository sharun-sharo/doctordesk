const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

function threeDigits(n) {
  if (n === 0) return '';
  if (n < 100) return twoDigits(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return rest ? `${ONES[h]} Hundred ${twoDigits(rest)}` : `${ONES[h]} Hundred`;
}

/** Integer to words using Indian numbering (Lakh, Crore). */
function integerToWordsIndian(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  let num = Math.floor(n);

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (num) parts.push(threeDigits(num));

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert invoice amount to words, e.g. "Two Hundred Rupees Only" or with paise.
 * @param {number|string} amount
 * @returns {string}
 */
function amountInWords(amount) {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const parts = [];
  if (rupees > 0) {
    parts.push(`${integerToWordsIndian(rupees)} ${rupees === 1 ? 'Rupee' : 'Rupees'}`);
  }
  if (paise > 0) {
    parts.push(`${integerToWordsIndian(paise)} ${paise === 1 ? 'Paise' : 'Paise'}`);
  }

  return `${parts.join(' and ')} Only`;
}

module.exports = { amountInWords, integerToWordsIndian };
