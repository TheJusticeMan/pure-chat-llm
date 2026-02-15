/**
 * Simple Boolean Search Parser for enhanced text search capabilities
 * Supports basic AND, OR, NOT operators
 */

export interface ParsedQuery {
  type: 'term' | 'operator';
  value: string;
  operator?: 'AND' | 'OR' | 'NOT';
  children?: ParsedQuery[];
  negated?: boolean;
}

/**
 * Boolean search query parser with support for AND, OR, NOT operators
 */
export class BooleanSearchParser {
  /**
   * Parse a boolean search query into an AST
   * @param query - The search query string to parse
   * @returns Parsed query tree structure
   */
  static parse(query: string): ParsedQuery {
    // Simple approach: split by OR first, then handle AND/NOT

    // Handle OR at top level (not in quotes)
    const orParts = this.splitTopLevel(query, 'OR');

    if (orParts.length > 1) {
      return {
        type: 'operator',
        value: 'OR',
        operator: 'OR',
        children: orParts.map(part => this.parse(part.trim())),
      };
    }

    // Handle AND at top level
    const andParts = this.splitTopLevel(query, 'AND');

    if (andParts.length > 1) {
      return {
        type: 'operator',
        value: 'AND',
        operator: 'AND',
        children: andParts.map(part => this.parse(part.trim())),
      };
    }

    // Handle NOT
    const trimmed = query.trim();
    if (trimmed.toUpperCase().startsWith('NOT ')) {
      const term = trimmed.substring(4).trim();
      const parsedTerm = this.parse(term);
      parsedTerm.negated = !parsedTerm.negated;
      return parsedTerm;
    }

    // Handle quoted phrases
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return {
        type: 'term',
        value: trimmed.slice(1, -1).toLowerCase(),
        negated: false,
      };
    }

    // Simple term
    return {
      type: 'term',
      value: trimmed.toLowerCase(),
      negated: false,
    };
  }

  /**
   * Split string by operator but only at top level (outside quotes)
   * @param query - The query string to split
   * @param operator - The operator to split by (AND, OR, NOT)
   * @returns Array of query parts split by the operator
   */
  private static splitTopLevel(query: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let parenLevel = 0;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if (char === '"' && (i === 0 || query[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (!inQuotes && char === '(') {
        parenLevel++;
      } else if (!inQuotes && char === ')') {
        parenLevel--;
      }

      // Check for operator at top level (ensure it's a separate word)
      if (!inQuotes && parenLevel === 0) {
        const upperSegment = query.substring(i).toUpperCase();
        if (upperSegment.startsWith(operator)) {
          // Make sure operator is a complete word (not part of another word)
          const nextCharIndex = i + operator.length;
          const prevCharIndex = i - 1;
          const isWordBoundary =
            (prevCharIndex < 0 || /\s/.test(query[prevCharIndex])) &&
            (nextCharIndex >= query.length || /\s/.test(query[nextCharIndex]));

          if (isWordBoundary) {
            parts.push(current.trim());
            current = '';
            i += operator.length - 1; // Skip the operator
            continue;
          }
        }
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * Evaluate parsed query against text
   * @param node - The parsed query node to evaluate
   * @param text - The text to search in
   * @returns True if the query matches the text, false otherwise
   */
  static evaluate(node: ParsedQuery, text: string): boolean {
    if (!node) return false;

    const textLower = text.toLowerCase();

    switch (node.type) {
      case 'term':
        return textLower.includes(node.value) !== (node.negated ?? false);

      case 'operator':
        if (!node.children || node.children.length === 0) return false;

        if (node.operator === 'AND') {
          return node.children.every(child => this.evaluate(child, text));
        } else if (node.operator === 'OR') {
          return node.children.some(child => this.evaluate(child, text));
        }

        return false;

      default:
        return false;
    }
  }

  /**
   * Check if query contains boolean operators
   * @param query - The query string to check
   * @returns True if the query contains AND, OR, or NOT operators
   */
  static isBooleanQuery(query: string): boolean {
    const upperQuery = query.toUpperCase();
    return (
      upperQuery.includes(' AND ') || upperQuery.includes(' OR ') || upperQuery.includes(' NOT ')
    );
  }
}
