export function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

export function formatPercentage(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)

  const intervals: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ]

  for (const [secondsInInterval, label] of intervals) {
    const interval = Math.floor(seconds / secondsInInterval)
    if (interval >= 1) {
      return `${interval} ${label}${interval === 1 ? '' : 's'} ago`
    }
  }

  return 'just now'
}
