import { Page, Locator } from '@playwright/test';
import type { UI5Table, UI5Column } from '../../types/ui5';

type TableKind = 'grid' | 'responsive';

/**
 * UI5 Table class for interacting with SAP UI5 table controls.
 * Uses direct SAPUI5 Core/control API to handle virtualized rows.
 * Supports sap.ui.table.Table (grid), sap.m.Table (responsive), and
 * SmartTable wrappers around either (unwrapped via SmartTable.getTable()).
 */
export class Table {
  readonly page: Page;
  readonly locator: Locator;
  private tableId: string | null = null;
  private tableKind: TableKind | null = null;

  constructor(page: Page, tableLocatorOrId: Locator | string) {
    this.page = page;

    if (typeof tableLocatorOrId === 'string') {
      this.locator = page.locator(`[id="${tableLocatorOrId}"]`);
      this.tableId = tableLocatorOrId;
    } else {
      this.locator = tableLocatorOrId;
    }
  }

  /**
   * Resolves the actual data-bearing table control (sap.ui.table.Table or
   * sap.m.Table) behind this.locator.
   *
   * BUG FIXED: the original implementation walked UP the DOM from the
   * located element looking for a control with getRows(). For a SmartTable
   * locator (as in `getByRoleUI5('SmartTable', { header: 'Items' })`), the
   * real grid/responsive table is a CHILD of the SmartTable, not an
   * ancestor — walking up can never find it. SmartTable is a composite
   * control that exposes its inner table via the documented
   * `smartTable.getTable()` API; that's what must be called, not a generic
   * aggregation crawl.
   *
   * Also polls briefly: SmartTable builds its inner table asynchronously
   * after OData metadata resolves, so getTable() can legitimately return
   * undefined for a short window right after the SmartTable becomes visible.
   */
  private async resolveTable(): Promise<{ id: string; kind: TableKind }> {
    if (this.tableId && this.tableKind) {
      return { id: this.tableId, kind: this.tableKind };
    }

    await this.locator.waitFor({ state: 'visible' });
    const rootId = await this.locator.evaluate((el: Element) => {
      if (!el.id) {
        throw new Error('Located element has no id attribute — cannot resolve its UI5 control.');
      }
      return el.id;
    });

    const handle = await this.page.waitForFunction(
      (rootId: string) => {
        const sap = (window as any).sap;
        const byId = (id: string) =>
          sap.ui.core?.Element?.getElementById
            ? sap.ui.core.Element.getElementById(id)
            : sap.ui.getCore().byId(id);

        // Require getColumns() too — getRows()/getItems() alone also match
        // non-table controls (e.g. an sap.m.List used internally by the
        // Object Page/anchor bar) that can sit as ancestors above a
        // SmartTable whose inner table hasn't finished initializing yet.
        // Without this, a transient getTable() === null during the async
        // build window lets the walk-up-the-DOM loop lock onto that wrong
        // ancestor control on an early poll, well before the real table
        // exists.
        const unwrap = (control: any): any => {
          if (!control) return null;
          if (typeof control.getTable === 'function') {
            const inner = control.getTable();
            return inner ? unwrap(inner) : null;
          }
          const isRealTable =
            typeof control.getColumns === 'function' &&
            (typeof control.getRows === 'function' || typeof control.getItems === 'function');
          return isRealTable ? control : null;
        };

        let current: Element | null = document.getElementById(rootId);
        while (current) {
          if (current.id) {
            const resolved = unwrap(byId(current.id));
            if (resolved) {
              return {
                id: resolved.getId(),
                kind: typeof resolved.getRows === 'function' ? 'grid' : 'responsive',
              };
            }
          }
          current = current.parentElement;
        }
        return null;
      },
      rootId,
      { timeout: 15_000 }
    );

    const value = (await handle.jsonValue()) as { id: string; kind: TableKind } | null;
    if (!value) {
      throw new Error(
        `Could not resolve a UI5 table control from element "${rootId}" or its ancestors, ` +
          `including via SmartTable.getTable(). The table may not have finished initializing — ` +
          `ensure the SmartTable/table locator is visible and has received data before calling this.`
      );
    }

    this.tableId = value.id;
    this.tableKind = value.kind;
    return value;
  }

  /**
   * Attaches a pending-request counter to this table's OData V2 model, once.
   * v2.ODataModel doesn't expose a simple "is anything in flight" property,
   * so we track it ourselves via the model's own request lifecycle events —
   * confirmed this app uses sap.ui.model.odata.v2.ODataModel from the
   * network trace (Dataserviceversion: 2.0, .../MM_PUR_PO_MAINT_V2_SRV
   * $batch endpoint).
   */
  private async ensureRequestTrackerAttached(): Promise<void> {
    const { id } = await this.resolveTable();
    await this.page.evaluate((id) => {
      const sap = (window as any).sap;
      const byId = (i: string) =>
        sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
      const table = byId(id);
      const model = table?.getModel?.();
      if (!model || (model as any).__pwTrackerAttached) return;

      (model as any).__pwPendingRequests = 0;
      model.attachRequestSent(() => {
        (model as any).__pwPendingRequests++;
      });
      const onSettled = () => {
        (model as any).__pwPendingRequests = Math.max(0, (model as any).__pwPendingRequests - 1);
      };
      model.attachRequestCompleted(onSettled);
      model.attachRequestFailed(onSettled);
      (model as any).__pwTrackerAttached = true;
    }, id);
  }

  /**
   * Waits for this table's OData model to have no pending requests, plus
   * the table's own busy state and common SAPUI5 busy-indicator DOM markers
   * to clear. Use this BETWEEN sequential setCellValue()/
   * setCellValueByColumnIndex() calls on the same row.
   *
   * Why this matters: firing change/liveChange on one field can kick off a
   * backend round trip (e.g. entering Material triggers server-side
   * defaulting of Plant/Price/UoM for that line item). If the next field is
   * set before that round trip completes, the eventual OData response can
   * refresh the row's bound values and silently overwrite whatever was
   * just written — the write appears to succeed at the time (no error,
   * setCellValue resolves normally) but the value doesn't persist. This is
   * the most likely explanation if setCellValue() reports success yet a
   * later getRowData()/getCellValue() shows the original/default value
   * instead of what was set.
   */
  async waitForStable(timeoutMs = 15_000): Promise<void> {
    await this.ensureRequestTrackerAttached();
    const { id } = await this.resolveTable();

    // Bounded debounce, not a synchronization primitive: attachRequestSent
    // fires asynchronously relative to the change/liveChange event that
    // triggers it, so checking "pending === 0" immediately after firing
    // change could pass trivially before the request has even been queued.
    // This just gives that queueing a moment to happen before the real
    // wait condition below starts polling.
    await this.page.waitForTimeout(150);

    await this.page.waitForFunction(
      (id) => {
        const sap = (window as any).sap;
        const byId = (i: string) =>
          sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
        const table = byId(id);
        const model = table?.getModel?.();
        if (((model as any)?.__pwPendingRequests ?? 0) > 0) return false;
        if (table?.getBusy?.()) return false;
        // Backend calls triggered by this table's edit can show busy state
        // on an ancestor (e.g. the whole Object Page) rather than on the
        // table control itself — check for that too.
        const globalBusy = document.querySelector(
          '.sapMBusyDialog, .sapUiLocalBusyIndicator, .sapMBusyIndicator'
        );
        return !globalBusy;
      },
      id,
      { timeout: timeoutMs }
    );
  }

  async getRowCount(): Promise<number> {
    const { id, kind } = await this.resolveTable();
    return this.page.evaluate(
      ({ id, kind }) => {
        const sap = (window as any).sap;
        const byId = (i: string) =>
          sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
        const table = byId(id);
        // BUG FIXED: for a grid table, getRows() returns only the currently
        // RENDERED window (row recycling), not the total data set — a
        // 500-row OData result reports as ~10-20 here. Use the binding's
        // length for the true total, falling back to getRows() only if
        // there is no binding (e.g. a client-side/JSON-model test table).
        if (kind === 'grid') {
          const binding = table.getBinding('rows');
          return binding ? binding.getLength() : table.getRows().length;
        }
        const binding = table.getBinding('items');
        return binding ? binding.getLength() : table.getItems().length;
      },
      { id, kind }
    );
  }

  /**
   * Waits for at least one row to exist in the table (without hard-coded sleep).
   * Polls the row count until it's > 0 or timeout is reached.
   */
  async waitForRowsToExist(timeoutMs: number = 15000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const count = await this.getRowCount();
      if (count > 0) {
        return;
      }
      await this.page.waitForTimeout(100);
    }
    throw new Error(`No rows found in table after ${timeoutMs}ms`);
  }

  async getColumnCount(): Promise<number> {
    const { id } = await this.resolveTable();
    return this.page.evaluate((id) => {
      const sap = (window as any).sap;
      const byId = (i: string) =>
        sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
      const table = byId(id);
      return table.getColumns().length;
    }, id);
  }

  async getColumnNames(): Promise<string[]> {
    const { id } = await this.resolveTable();
    return this.page.evaluate((id) => {
      const sap = (window as any).sap;
      const byId = (i: string) =>
        sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
      const table = byId(id) as UI5Table;

      // BUG FIXED: sap.ui.table.Column exposes its header via getLabel(),
      // but sap.m.Column (used by sap.m.Table / ResponsiveTable) has no
      // getLabel() at all — its header control is retrieved via
      // getHeader(). The original code called getLabel().getText()
      // unconditionally, which throws on a ResponsiveTable despite the
      // class docstring claiming ResponsiveTable support.
      const getLabelText = (col: UI5Column): string => {
        const labelCtrl: any =
          typeof (col as any).getLabel === 'function'
            ? (col as any).getLabel()
            : typeof (col as any).getHeader === 'function'
            ? (col as any).getHeader()
            : null;
        return labelCtrl && typeof labelCtrl.getText === 'function' ? labelCtrl.getText() : '';
      };

      return table.getColumns().map((col: UI5Column) => getLabelText(col));
    }, id);
  }

  async getCellValue(rowIndex: number, columnName: string): Promise<string | null> {
    return this.readCell(rowIndex, { columnName });
  }

  async getCellValueByColumnIndex(rowIndex: number, columnIndex: number): Promise<string | null> {
    return this.readCell(rowIndex, { columnIndex });
  }

  /**
   * Shared read path for both column-name and column-index lookups.
   * Runs entirely inside a single page.evaluate — resolving the row,
   * scrolling if needed, and reading the cell — so a virtualized grid
   * table can't recycle the target row between separate round trips.
   */
  private async readCell(
    rowIndex: number,
    column: { columnName?: string; columnIndex?: number }
  ): Promise<string | null> {
    const { id, kind } = await this.resolveTable();
    return this.page.evaluate(
      async ({ id, kind, rowIndex, column }) => {
        const sap = (window as any).sap;
        const byId = (i: string) =>
          sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
        const table = byId(id);

        const getLabelText = (col: any): string => {
          const labelCtrl =
            typeof col.getLabel === 'function' ? col.getLabel() : typeof col.getHeader === 'function' ? col.getHeader() : null;
          return labelCtrl && typeof labelCtrl.getText === 'function' ? labelCtrl.getText() : '';
        };

        const columns = table.getColumns();
        const columnIndex =
          column.columnIndex ?? columns.findIndex((c: any) => getLabelText(c) === column.columnName);
        if (columnIndex === -1 || columnIndex == null) return null;

        // BUG FIXED: the original code read `table.getRows()[rowIndex]`,
        // treating array position as the absolute data row index. For a
        // virtualized sap.ui.table.Table, getRows() only ever contains the
        // currently rendered window (e.g. indices 0-19), so any rowIndex
        // outside whatever happens to be on screen silently resolved to
        // undefined or to the WRONG row. Each Row control's real position
        // is `row.getIndex()`, not its position in the getRows() array —
        // that's what must be matched, scrolling the window if necessary.
        let row: any = null;
        if (kind === 'responsive') {
          row = table.getItems()[rowIndex] ?? null;
        } else {
          const findInWindow = () => (table.getRows() as any[]).find((r) => r.getIndex() === rowIndex);
          row = findInWindow();
          if (!row) {
            await new Promise<void>((resolve) => {
              table.attachEventOnce('rowsUpdated', () => resolve());
              if (typeof table.setFirstVisibleRow === 'function') table.setFirstVisibleRow(rowIndex);
              else if (typeof table.scrollToIndex === 'function') table.scrollToIndex(rowIndex);
              else resolve();
            });
            row = findInWindow();
          }
        }
        if (!row) return null;

        const cell = row.getCells()[columnIndex];
        if (!cell) return null;

        // BUG FIXED: in this app, table cells are NOT plain Input/Text —
        // they're wrapped Row -> SmartToggle -> SmartField -> actual leaf
        // control (sap.m.Text for display-only fields, sap.m.Input /
        // sap.m.ComboBox for editable ones, sometimes with a value-help
        // icon alongside). SmartToggle/SmartField are internal wrapper
        // controls; calling getText()/getValue() on them directly is not
        // reliable. Recurse through the control's aggregations to find the
        // actual leaf control and read from that instead.
        const LEAF_TYPES = [
          'sap.m.Input', 'sap.m.ComboBox', 'sap.m.MultiComboBox', 'sap.m.Select',
          'sap.m.DatePicker', 'sap.m.TimePicker', 'sap.m.StepInput', 'sap.m.CheckBox',
          'sap.m.Text', 'sap.m.ObjectStatus', 'sap.m.Link',
        ];
        const resolveLeaf = (control: any): any => {
          if (!control) return null;
          const name = control.getMetadata?.()?.getName?.() || '';
          if (LEAF_TYPES.includes(name)) return control;
          const aggs = control.getMetadata?.()?.getAllAggregations?.() || {};
          for (const aggName of Object.keys(aggs)) {
            try {
              const child = control.getAggregation?.(aggName);
              if (!child) continue;
              for (const c of Array.isArray(child) ? child : [child]) {
                const found = resolveLeaf(c);
                if (found) return found;
              }
            } catch {
              /* aggregation not applicable to this control, skip */
            }
          }
          return null;
        };
        const getLeafValue = (leaf: any): string | null => {
          if (!leaf) return null;
          const name = leaf.getMetadata().getName();
          if (name === 'sap.m.CheckBox') return String(leaf.getSelected());
          if (['sap.m.ComboBox', 'sap.m.Select', 'sap.m.MultiComboBox'].includes(name) && leaf.getSelectedKey) {
            return leaf.getSelectedKey() || leaf.getValue?.() || null;
          }
          return leaf.getValue?.() ?? leaf.getText?.() ?? null;
        };

        return getLeafValue(resolveLeaf(cell));
      },
      { id, kind, rowIndex, column }
    );
  }

  async setCellValue(rowIndex: number, columnName: string, value: string): Promise<void> {
    const result = await this.writeCell(rowIndex, { columnName }, value);
    // BUG FIXED: this previously discarded writeCell()'s result entirely.
    // A skipped write (read-only field, no leaf control resolved) or an
    // outright failure looked identical to success from the caller's
    // point of view — the test would log "Setting X" and move on with
    // nothing actually written. Surface it loudly instead.
    if (!result.success) {
      throw new Error(
        `setCellValue(row ${rowIndex}, "${columnName}") did not take effect — ` +
          `${result.skipped ? `skipped: ${result.skipped}` : 'write failed'} ` +
          `(resolved control type: ${result.controlType ?? 'unknown'})`
      );
    }
  }

  async setCellValueByColumnIndex(rowIndex: number, columnIndex: number, value: string): Promise<void> {
    const result = await this.writeCell(rowIndex, { columnIndex }, value);
    if (!result.success) {
      throw new Error(
        `setCellValueByColumnIndex(row ${rowIndex}, col ${columnIndex}) did not take effect — ` +
          `${result.skipped ? `skipped: ${result.skipped}` : 'write failed'} ` +
          `(resolved control type: ${result.controlType ?? 'unknown'})`
      );
    }
  }

  /**
   * Shared write path. Resolves the row/column to the cell's DOM anchor via
   * the UI5 API (still the only reliable way to map a row index + column
   * name to the right cell, including scrolling a virtualized row into
   * view) — then hands off to a real Playwright interaction against the
   * rendered DOM.
   *
   * BUG FIXED: the previous version wrote via the UI5 control API
   * (leaf.setValue() + fireChange/fireLiveChange) after resolving a "leaf"
   * control by walking the cell's aggregation tree. That broke in practice:
   * a SmartField can hold BOTH a display Text and an edit Input
   * simultaneously instantiated as children (only one actually rendered),
   * and a depth-first "first LEAF_TYPES match wins" search has no way to
   * tell which one is currently live — it found the hidden Text for
   * Material and reported the field read-only, even though it was a
   * visible, editable textbox on screen. The DOM doesn't have this
   * ambiguity: only the actually-rendered control has a visible element.
   * Scoping to the cell's DOM and picking the first VISIBLE editable
   * element sidesteps the problem entirely, and fires real input/change/
   * blur events the app is already listening for, rather than synthetic
   * UI5 events.
   *
   * Known limitation: this targets `input`/`select`/`textarea` elements,
   * which covers Input, ComboBox, and MultiComboBox (all render a native
   * `<input>`). sap.m.CheckBox and sap.m.Select render custom widgets
   * around a visually-hidden native control, so they need dedicated
   * handling (e.g. `cellScope.getByRole('checkbox').setChecked(...)` /
   * `getByRole('button').click()` + option selection) rather than this
   * generic sweep — flagging rather than silently mishandling them.
   */
  private async writeCell(
    rowIndex: number,
    column: { columnName?: string; columnIndex?: number },
    value: string
  ): Promise<{ success: boolean; skipped?: string; controlType?: string }> {
    const { id, kind } = await this.resolveTable();

    const resolved = await this.page.evaluate(
      async ({ id, kind, rowIndex, column }) => {
        const sap = (window as any).sap;
        const byId = (i: string) =>
          sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
        const table = byId(id);

        const getLabelText = (col: any): string => {
          const labelCtrl =
            typeof col.getLabel === 'function' ? col.getLabel() : typeof col.getHeader === 'function' ? col.getHeader() : null;
          return labelCtrl && typeof labelCtrl.getText === 'function' ? labelCtrl.getText() : '';
        };

        const columns = table.getColumns();
        const columnIndex =
          column.columnIndex ?? columns.findIndex((c: any) => getLabelText(c) === column.columnName);
        if (columnIndex === -1 || columnIndex == null) {
          throw new Error(`Column "${column.columnName ?? column.columnIndex}" not found`);
        }

        let row: any = null;
        if (kind === 'responsive') {
          row = table.getItems()[rowIndex] ?? null;
        } else {
          const findInWindow = () => (table.getRows() as any[]).find((r) => r.getIndex() === rowIndex);
          row = findInWindow();
          if (!row) {
            await new Promise<void>((resolve) => {
              table.attachEventOnce('rowsUpdated', () => resolve());
              if (typeof table.setFirstVisibleRow === 'function') table.setFirstVisibleRow(rowIndex);
              else if (typeof table.scrollToIndex === 'function') table.scrollToIndex(rowIndex);
              else resolve();
            });
            row = findInWindow();
          }
        }
        if (!row) throw new Error(`Row ${rowIndex} could not be scrolled into view / not found`);

        const cell = row.getCells()[columnIndex];
        if (!cell) throw new Error(`Cell not found at row ${rowIndex}, column ${JSON.stringify(column)}`);

        const domRef = cell.getDomRef?.();
        if (!domRef?.id) {
          throw new Error(
            `Cell control has no rendered DOM element (row ${rowIndex}, column ${JSON.stringify(column)}) — ` +
              `it may be scrolled out of view or not yet rendered.`
          );
        }
        return { cellDomId: domRef.id };
      },
      { id, kind, rowIndex, column }
    );

    const cellScope = this.page.locator(`[id="${resolved.cellDomId}"]`);
    const editable = cellScope.locator('input:visible, select:visible, textarea:visible').first();

    if ((await editable.count()) === 0) {
      return { success: false, skipped: 'read-only-field', controlType: 'no visible editable DOM control in cell' };
    }

    const tagName = await editable.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      await editable.selectOption(value);
    } else {
      await editable.fill(value);
    }
    // SAPUI5 Input/ComboBox fire `change` on blur, not on every keystroke —
    // commit the value the same way a real user tabbing to the next field
    // would.
    await editable.press('Tab');

    return { success: true, controlType: tagName };
  }

  /**
   * Reads the underlying OData entity for a row directly from its binding
   * context — no scrolling required, even for an absolute row index outside
   * the currently rendered window.
   *
   * For a grid table, sap.ui.table.Table#getContextByIndex(index) queries
   * the row binding directly by absolute index; it does not depend on the
   * row actually being rendered, so this sidesteps the virtualization
   * scroll-and-match logic used in readCell()/writeCell() entirely. It also
   * bypasses the SmartToggle/SmartField/leaf-control resolution needed for
   * UI reads, since it reads the model's raw values instead of whatever is
   * currently displayed.
   *
   * Trade-off: this returns technical OData field values (e.g. a raw key),
   * not the formatted/rendered display text a user sees on screen — use
   * getCellValue()/getRowData() instead when the test needs to assert what
   * is actually shown in the UI.
   */
  async getRowEntity(rowIndex: number): Promise<Record<string, unknown> | null> {
    const { id, kind } = await this.resolveTable();
    return this.page.evaluate(
      ({ id, kind, rowIndex }) => {
        const sap = (window as any).sap;
        const byId = (i: string) =>
          sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
        const table = byId(id);

        const ctx =
          kind === 'grid'
            ? table.getContextByIndex(rowIndex)
            : table.getItems()[rowIndex]?.getBindingContext();

        return ctx ? ctx.getObject() : null;
      },
      { id, kind, rowIndex }
    );
  }

  async getRowData(rowIndex: number): Promise<{ [key: string]: string | null }> {
    const columnNames = await this.getColumnNames();
    const rowData: { [key: string]: string | null } = {};
    for (let i = 0; i < columnNames.length; i++) {
      rowData[columnNames[i]] = await this.readCell(rowIndex, { columnIndex: i });
    }
    return rowData;
  }

  /**
   * Reads the whole table in a single page.evaluate rather than one round
   * trip per cell — both faster and avoids the row-recycling race that
   * separate evaluate calls could hit while scrolling a virtualized table.
   */
  async getTableData(): Promise<Array<{ [key: string]: string | null }>> {
    const { id, kind } = await this.resolveTable();
    return this.page.evaluate(
      async ({ id, kind }) => {
        const sap = (window as any).sap;
        const byId = (i: string) =>
          sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
        const table = byId(id);

        const getLabelText = (col: any): string => {
          const labelCtrl =
            typeof col.getLabel === 'function' ? col.getLabel() : typeof col.getHeader === 'function' ? col.getHeader() : null;
          return labelCtrl && typeof labelCtrl.getText === 'function' ? labelCtrl.getText() : '';
        };

        const columnNames: string[] = table.getColumns().map(getLabelText);

        // Same wrapper problem as readCell()/writeCell(): cells here are
        // Row -> SmartToggle -> SmartField -> leaf control, not plain
        // Input/Text — resolve to the leaf before reading.
        const LEAF_TYPES = [
          'sap.m.Input', 'sap.m.ComboBox', 'sap.m.MultiComboBox', 'sap.m.Select',
          'sap.m.DatePicker', 'sap.m.TimePicker', 'sap.m.StepInput', 'sap.m.CheckBox',
          'sap.m.Text', 'sap.m.ObjectStatus', 'sap.m.Link',
        ];
        const resolveLeaf = (control: any): any => {
          if (!control) return null;
          const name = control.getMetadata?.()?.getName?.() || '';
          if (LEAF_TYPES.includes(name)) return control;
          const aggs = control.getMetadata?.()?.getAllAggregations?.() || {};
          for (const aggName of Object.keys(aggs)) {
            try {
              const child = control.getAggregation?.(aggName);
              if (!child) continue;
              for (const c of Array.isArray(child) ? child : [child]) {
                const found = resolveLeaf(c);
                if (found) return found;
              }
            } catch {
              /* aggregation not applicable to this control, skip */
            }
          }
          return null;
        };
        const getLeafValue = (leaf: any): string | null => {
          if (!leaf) return null;
          const name = leaf.getMetadata().getName();
          if (name === 'sap.m.CheckBox') return String(leaf.getSelected());
          if (['sap.m.ComboBox', 'sap.m.Select', 'sap.m.MultiComboBox'].includes(name) && leaf.getSelectedKey) {
            return leaf.getSelectedKey() || leaf.getValue?.() || null;
          }
          return leaf.getValue?.() ?? leaf.getText?.() ?? null;
        };

        const readRow = (row: any) => {
          const cells = row.getCells();
          const data: { [key: string]: string | null } = {};
          columnNames.forEach((name, i) => {
            data[name] = getLeafValue(resolveLeaf(cells[i]));
          });
          return data;
        };

        if (kind === 'responsive') {
          return (table.getItems() as any[]).map(readRow);
        }

        const rowCount = table.getBinding('rows')?.getLength() ?? table.getRows().length;
        const results: Array<{ [key: string]: string | null }> = [];
        for (let idx = 0; idx < rowCount; idx++) {
          const findInWindow = () => (table.getRows() as any[]).find((r) => r.getIndex() === idx);
          let row = findInWindow();
          if (!row) {
            await new Promise<void>((resolve) => {
              table.attachEventOnce('rowsUpdated', () => resolve());
              if (typeof table.setFirstVisibleRow === 'function') table.setFirstVisibleRow(idx);
              else if (typeof table.scrollToIndex === 'function') table.scrollToIndex(idx);
              else resolve();
            });
            row = findInWindow();
          }
          results.push(row ? readRow(row) : {});
        }
        return results;
      },
      { id, kind }
    );
  }

  /**
   * Clicks the RowAction (chevron) button for a specific row.
   * The RowAction is typically used to expand/drill-down into a row.
   */
  async clickRowAction(rowIndex: number): Promise<void> {
    const { id, kind } = await this.resolveTable();

    const rowActionElement = await this.page.evaluate(
      async ({ id, kind, rowIndex }) => {
        const sap = (window as any).sap;
        const byId = (i: string) =>
          sap.ui.core?.Element?.getElementById ? sap.ui.core.Element.getElementById(i) : sap.ui.getCore().byId(i);
        const table = byId(id);

        let row: any = null;
        if (kind === 'responsive') {
          row = table.getItems()[rowIndex] ?? null;
        } else {
          const findInWindow = () => (table.getRows() as any[]).find((r) => r.getIndex() === rowIndex);
          row = findInWindow();
          if (!row) {
            await new Promise<void>((resolve) => {
              table.attachEventOnce('rowsUpdated', () => resolve());
              if (typeof table.setFirstVisibleRow === 'function') table.setFirstVisibleRow(rowIndex);
              else if (typeof table.scrollToIndex === 'function') table.scrollToIndex(rowIndex);
              else resolve();
            });
            row = findInWindow();
          }
        }
        if (!row) throw new Error(`Row ${rowIndex} not found`);

        // Get the RowAction control for this row
        const rowAction = row.getRowAction?.();
        if (!rowAction) {
          throw new Error(`No RowAction found for row ${rowIndex}`);
        }

        const actionId = rowAction.getId?.();
        if (!actionId) {
          throw new Error(`Could not get ID for RowAction at row ${rowIndex}`);
        }

        return actionId;
      },
      { id, kind, rowIndex }
    );

    if (!rowActionElement) {
      throw new Error(`Failed to get RowAction element for row ${rowIndex}`);
    }

    // Click the RowAction by its ID
    await this.page.locator(`id=${rowActionElement}`).click();
  }
}
