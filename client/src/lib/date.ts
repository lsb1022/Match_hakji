export function toSafeDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const datePart = String(value).split('T')[0];
  return new Date(`${datePart}T12:00:00`);
}

export function formatKoreanDate(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) {
  return toSafeDate(value).toLocaleDateString('ko-KR', options);
}

export function formatKSTDateTime(value: string | Date | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function getTodayInputDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${lookup('year')}-${lookup('month')}-${lookup('day')}`;
}
