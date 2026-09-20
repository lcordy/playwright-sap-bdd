import { DataTable } from 'playwright-bdd';

/**
 * Creates a typed object from a two-column Gherkin table.
 *
 * Table field labels are conventionally mapped to camel-case property names:
 * "Purchasing Doc Type" becomes "purchasingDocType".
 */
export function createInstance<T extends object>(dataTable: DataTable): T {
  const values: Record<string, string> = {};
  const rows = dataTable.raw();
  const dataRows = hasFieldValueHeader(rows) ? rows.slice(1) : rows;

  for (const row of dataRows) {
    if (row.length !== 2) {
      throw new Error('createInstance requires a data table with exactly two columns.');
    }

    const [field, value] = row;
    const propertyName = toCamelCase(field);

    if (!propertyName) {
      throw new Error('Data table fields must have a name.');
    }

    if (propertyName in values) {
      throw new Error(`Data table contains more than one value for "${propertyName}".`);
    }

    values[propertyName] = value;
  }

  return values as T;
}

function hasFieldValueHeader(rows: string[][]): boolean {
  const [firstRow] = rows;

  return firstRow?.length === 2
    && firstRow[0].trim().toLowerCase() === 'field'
    && firstRow[1].trim().toLowerCase() === 'value';
}

function toCamelCase(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g);

  if (!words) {
    return '';
  }

  return words
    .map((word, index) => {
      const normalized = word.toLowerCase();
      return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
    })
    .join('');
}
