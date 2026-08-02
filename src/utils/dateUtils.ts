/**
 * Utility functions for Asia/Riyadh local timezone date management
 */

export function getRiyadhNow(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  const second = parseInt(parts.find(p => p.type === 'second')!.value, 10);
  
  return new Date(year, month, day, hour, minute, second);
}

export function parseBookingDateTimeToRiyadhDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 0;
  let minutes = 0;
  
  const cleanedTime = timeStr.trim().toUpperCase();
  const isPM = cleanedTime.includes('PM');
  const isAM = cleanedTime.includes('AM');
  
  if (isPM || isAM) {
    const numericPart = cleanedTime.replace(/[AP]M/, '').trim();
    const [hStr, mStr] = numericPart.split(':');
    hours = parseInt(hStr, 10);
    minutes = parseInt(mStr, 10);
    
    if (isPM && hours < 12) {
      hours += 12;
    }
    if (isAM && hours === 12) {
      hours = 0;
    }
  } else {
    const [hStr, mStr] = cleanedTime.split(':');
    hours = parseInt(hStr, 10);
    minutes = parseInt(mStr, 10);
  }
  
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function getRiyadhDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function getRiyadhFormattedDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  return formatter.format(date);
}

export function getRelativeRiyadhDateStr(daysOffset: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  return getRiyadhDateString(d);
}

export function getMinBirthdayBookingDateStr(noticeDays: number = 4, baseDate: Date = new Date()): string {
  return getRelativeRiyadhDateStr(noticeDays, baseDate);
}
