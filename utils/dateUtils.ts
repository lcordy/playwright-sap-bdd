/**
 * Parses date strings and returns them in MM/dd/YYYY format
 * Supports:
 * - 'today': current date
 * - 'tomorrow': next day
 * - 'in X days': X days from today (e.g., 'in 5 days', 'in 10 days')
 * - ISO date strings or any valid date string
 */
export function parseDate(dateInput: string): string {
  let date: Date;

  const input = dateInput.toLowerCase();
  if (input === 'today') {
    date = new Date();
  } else if (input === 'tomorrow') {
    date = new Date();
    date.setDate(date.getDate() + 1);
  } else {
    const inDaysMatch = input.match(/^in\s+(\d+)\s+days?$/);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10);
      date = new Date();
      date.setDate(date.getDate() + days);
    } else {
      date = new Date(dateInput);
    }
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}
