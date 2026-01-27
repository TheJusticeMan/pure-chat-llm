/**
 * ToolOutputBuilder provides a consistent, structured format for tool outputs
 * to enhance LLM understanding and decision-making capabilities.
 */
export class ToolOutputBuilder {
  private sections: string[] = [];

  /**
   * Add a header with optional status indicator
   * @param title - Title of the operation
   * @param status - Optional status (e.g., "Recoverable", "Success")
   */
  addHeader(title: string, status?: string): this {
    const statusPart = status ? ` (${status})` : '';
    this.sections.push(`${title}${statusPart}`);
    this.sections.push('━'.repeat(45));
    return this;
  }

  /**
   * Add a key-value pair
   * @param label - The label/key
   * @param value - The value
   */
  addKeyValue(label: string, value: string): this {
    this.sections.push(`${label}: ${value}`);
    return this;
  }

  /**
   * Add a visual separator line
   */
  addSeparator(): this {
    this.sections.push('━'.repeat(45));
    return this;
  }

  /**
   * Add a titled section with content
   * @param title - Section title
   * @param content - Section content
   */
  addSection(title: string, content: string): this {
    this.sections.push(`\n${title}:\n${content}`);
    return this;
  }

  /**
   * Add a formatted markdown table
   * @param headers - Column headers
   * @param rows - Data rows
   */
  addTable(headers: string[], rows: string[][]): this {
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => (r[i] || '').length)),
    );

    const formatRow = (cells: string[]) =>
      '| ' + cells.map((c, i) => c.padEnd(colWidths[i])).join(' | ') + ' |';

    this.sections.push(formatRow(headers));
    this.sections.push('|' + colWidths.map(w => '-'.repeat(w + 2)).join('|') + '|');
    rows.forEach(row => this.sections.push(formatRow(row)));

    return this;
  }

  /**
   * Add suggested actions for the LLM to consider
   * @param actions - Array of suggested actions
   */
  addSuggestions(...actions: string[]): this {
    this.sections.push('\nSUGGESTED ACTIONS:');
    actions.forEach((action, i) => {
      this.sections.push(`${i + 1}. ${action}`);
    });
    return this;
  }

  /**
   * Add a structured error message with recovery options
   * @param type - Error type (e.g., "FileNotFoundError")
   * @param message - Detailed error message
   * @param recovery - Array of recovery suggestions
   */
  addError(type: string, message: string, recovery: string[]): this {
    this.addHeader(`ERROR: ${type}`, 'Recoverable');
    this.sections.push(`Reason: ${message}\n`);
    this.sections.push('RECOVERY OPTIONS:');
    recovery.forEach((opt, i) => this.sections.push(`${i + 1}. ${opt}`));
    return this;
  }

  /**
   * Build and return the final formatted string
   */
  build(): string {
    return this.sections.join('\n');
  }
}
