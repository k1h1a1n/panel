import { formatDate } from '@angular/common';

export class DateUtils {

  // ✔ Check if valid date
  isValidDate(date: any) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  // ✔ Today
  today() {
    return new Date();
  }

  // ✔ Add years
  addCalendarYears(years: number): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d;
  }

  // ✔ Add months
  addCalendarMonths(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d;
  }

  // ✔ Add days
  addCalendarDays(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  // ✔ Add any unit
  addToDate(dateVal: any, amount: number, unit: 'days'|'months'|'years'): Date {
    const d = this.toDate(dateVal);

    switch (unit) {
      case 'years':
        d.setFullYear(d.getFullYear() + amount);
        break;
      case 'months':
        d.setMonth(d.getMonth() + amount);
        break;
      default:
        d.setDate(d.getDate() + amount);
    }

    return d;
  }

  // ✔ Difference from today
  diffCalendar(dateStr: string, unit: 'days'|'months'|'years'): number {
    const target = this.toDate(dateStr);
    const now = new Date();

    const diffMs = now.getTime() - target.getTime();

    switch (unit) {
      case 'years':
        return now.getFullYear() - target.getFullYear();
      case 'months':
        return (
          (now.getFullYear() - target.getFullYear()) * 12 +
          (now.getMonth() - target.getMonth())
        );
      default:
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  // ✔ Convert string to Date
  toDate(dateStr: any, year?: number, month?: number): Date {
    if (dateStr instanceof Date) return dateStr;

    try {
      // Handle dd/MM/yyyy
      if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/').map(Number);
        const dt = new Date(y, (month ?? m) - 1, d);
        return dt;
      }

      // Handle dd-MM-yyyy
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const [d, m, y] = dateStr.split('-').map(Number);
        const dt = new Date(y, (month ?? m) - 1, d);
        return dt;
      }

      return new Date(dateStr);
    } catch {
      return new Date();
    }
  }

  // ✔ Format date
  getFormatDate(date?: any, format: string = 'yyyy-MM-dd') {
    const d = this.toDate(date || new Date());
    return formatDate(d, format, 'en');
  }

  // ✔ Get date part
  getDatePart(part: 'D' | 'M' | 'Y', date?: any): string {
    const d = this.toDate(date || new Date());

    switch (part) {
      case 'M': return `${d.getMonth() + 1}`;
      case 'Y': return `${d.getFullYear()}`;
      default: return `${d.getDate()}`;
    }
  }

  // ✔ Convert format dd-MM-yyyy → MM-dd-yyyy
  toDateFormat(dateStr: string, sourceFormat: string) {
    if (dateStr.includes('-') && sourceFormat === 'dd-MM-yyyy') {
      const [d, m, y] = dateStr.split('-');
      return `${m}-${d}-${y}`;
    }
    return dateStr;
  }

  // ✔ Calculate difference in Y/M/D
  CalcDateDiffInYMD(startDateStr: string, endDateStr?: string) {
    let start = new Date(startDateStr);
    let end = endDateStr ? new Date(endDateStr) : new Date();

    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return { Y: years, M: months, D: days };
  }

  // ✔ Calculate age
  calcAge(birthDate: any, albFlag: number = 1, tillDate?: any): number {
    const start = this.toDate(birthDate);
    const end = tillDate ? this.toDate(tillDate) : new Date();

    if (!this.isValidDate(start) || start > end) return 0;

    const diff = this.CalcDateDiffInYMD(start.toString(), end.toString());

    if (diff.Y > 255) return 0;

    return albFlag === 1
      ? diff.Y
      : diff.M < 6 ? diff.Y : diff.Y + 1;
  }
}
