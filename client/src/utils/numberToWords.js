const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n) {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one ? ' ' + ONES[one] : '');
}

function below1000(n) {
  if (n < 100) return below100(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return ONES[hundred] + ' Hundred' + (rest ? ' ' + below100(rest) : '');
}

// Indian numbering: ... Crore, Lakh, Thousand, Hundred
export function numberToIndianWords(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '';
  if (num === 0) return 'Zero Rupees only';

  const sign = num < 0 ? 'Minus ' : '';
  const abs = Math.abs(num);

  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const parts = [];
  let n = rupees;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  if (crore) parts.push(below1000(crore) + ' Crore');

  const lakh = Math.floor(n / 100000);
  n %= 100000;
  if (lakh) parts.push(below100(lakh) + ' Lakh');

  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(below100(thousand) + ' Thousand');

  if (n) parts.push(below1000(n));

  let words = sign + (parts.length ? parts.join(' ') : 'Zero') + ' Rupees';
  if (paise) {
    words += ' and ' + below100(paise) + ' Paise';
  }
  return words + ' only';
}
