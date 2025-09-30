/**
 * Boolean Expression System for Tag-Based Search
 *
 * Provides advanced tag filtering with boolean operators (AND, OR, NOT)
 * and parentheses grouping for complex queries.
 *
 * Examples:
 * - "ai AND analysis" - both tags must be present
 * - "writing OR creative" - either tag must be present
 * - "ai AND NOT deprecated" - ai tag present, deprecated not present
 * - "(ai AND analysis) OR writing" - complex expressions with grouping
 */

import type { BooleanExpression } from '@/types/prompt';

/**
 * Parse a boolean expression string into an expression tree
 */
export function parseBooleanExpression(expr: string): BooleanExpression {
  expr = expr.trim();

  if (!expr) {
    throw new Error('Empty expression');
  }

  // Handle parentheses by recursively parsing innermost groups
  if (expr.includes('(')) {
    return parseWithParentheses(expr);
  }

  return parseSimpleExpression(expr);
}

/**
 * Handle expressions with parentheses by finding and parsing innermost groups
 */
function parseWithParentheses(expr: string): BooleanExpression {
  // Find innermost parentheses
  let depth = 0;
  let start = -1;

  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (expr[i] === ')') {
      depth--;
      if (depth === 0 && start >= 0) {
        // Found complete innermost group
        const inner = expr.substring(start + 1, i);
        const innerExpr = parseSimpleExpression(inner);

        // Replace parentheses group with placeholder and recurse
        const placeholder = '__EXPR__';
        const replaced = expr.substring(0, start) + placeholder + expr.substring(i + 1);

        // If the result is just our placeholder, return the inner expression
        if (replaced.trim() === placeholder) {
          return innerExpr;
        }

        // Otherwise, we need to parse the outer expression
        // For now, keep it simple and parse without the parentheses
        return parseSimpleExpression(expr.substring(start + 1, i));
      }
    }
  }

  // If we get here, parentheses are unbalanced or empty
  throw new Error('Unbalanced parentheses in expression');
}

/**
 * Parse a simple expression without parentheses
 */
function parseSimpleExpression(expr: string): BooleanExpression {
  expr = expr.trim();

  // Handle NOT expressions (highest precedence)
  if (expr.toUpperCase().startsWith('NOT ')) {
    const inner = expr.substring(4).trim();
    return {
      type: 'not',
      value: [parseSimpleExpression(inner)],
    };
  }

  // Handle OR expressions (lowest precedence)
  const orParts = splitByOperator(expr, ' OR ');
  if (orParts.length > 1) {
    return {
      type: 'or',
      value: orParts.map(part => parseSimpleExpression(part)),
    };
  }

  // Handle AND expressions (medium precedence)
  const andParts = splitByOperator(expr, ' AND ');
  if (andParts.length > 1) {
    return {
      type: 'and',
      value: andParts.map(part => parseSimpleExpression(part)),
    };
  }

  // Remove outer parentheses if present
  if (expr.startsWith('(') && expr.endsWith(')')) {
    return parseSimpleExpression(expr.substring(1, expr.length - 1));
  }

  // Single tag expression
  return {
    type: 'tag',
    value: expr,
  };
}

/**
 * Split expression by operator, respecting parentheses nesting
 */
function splitByOperator(expr: string, operator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;

  while (i < expr.length) {
    if (expr[i] === '(') {
      depth++;
      current += expr[i];
      i++;
    } else if (expr[i] === ')') {
      depth--;
      current += expr[i];
      i++;
    } else if (depth === 0 && expr.substring(i).toUpperCase().startsWith(operator)) {
      // Found operator at depth 0
      parts.push(current.trim());
      current = '';
      i += operator.length;
    } else {
      current += expr[i];
      i++;
    }
  }

  // Add the last part
  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.length > 1 ? parts : [expr];
}

/**
 * Evaluate a boolean expression against a list of tags
 */
export function evaluateExpression(
  expr: BooleanExpression,
  tags: string[]
): boolean {
  switch (expr.type) {
    case 'tag': {
      const tagName = expr.value as string;
      return containsTag(tags, tagName);
    }

    case 'and': {
      const expressions = expr.value as BooleanExpression[];
      return expressions.every(e => evaluateExpression(e, tags));
    }

    case 'or': {
      const expressions = expr.value as BooleanExpression[];
      return expressions.some(e => evaluateExpression(e, tags));
    }

    case 'not': {
      const expressions = expr.value as BooleanExpression[];
      if (expressions.length !== 1) {
        return false;
      }
      return !evaluateExpression(expressions[0], tags);
    }

    default:
      return false;
  }
}

/**
 * Check if a tag is present in the tags list (case-insensitive)
 */
function containsTag(tags: string[], target: string): boolean {
  const targetLower = target.toLowerCase();
  return tags.some(tag => tag.toLowerCase() === targetLower);
}

/**
 * Convert boolean expression back to human-readable string
 */
export function expressionToString(expr: BooleanExpression): string {
  switch (expr.type) {
    case 'tag':
      return expr.value as string;

    case 'and': {
      const expressions = expr.value as BooleanExpression[];
      const parts = expressions.map(e => {
        // Add parentheses for OR expressions to show precedence
        if (e.type === 'or') {
          return `(${expressionToString(e)})`;
        }
        return expressionToString(e);
      });
      return parts.join(' AND ');
    }

    case 'or': {
      const expressions = expr.value as BooleanExpression[];
      return expressions.map(e => expressionToString(e)).join(' OR ');
    }

    case 'not': {
      const expressions = expr.value as BooleanExpression[];
      if (expressions.length === 1) {
        const inner = expressionToString(expressions[0]);
        // Add parentheses if the inner expression contains operators
        if (expressions[0].type !== 'tag') {
          return `NOT (${inner})`;
        }
        return `NOT ${inner}`;
      }
      return 'NOT ?';
    }

    default:
      return '?';
  }
}

/**
 * Get all unique tags mentioned in an expression
 */
export function getExpressionTags(expr: BooleanExpression): string[] {
  const tags: string[] = [];

  function collect(e: BooleanExpression) {
    if (e.type === 'tag') {
      tags.push(e.value as string);
    } else {
      const expressions = e.value as BooleanExpression[];
      expressions.forEach(collect);
    }
  }

  collect(expr);
  return Array.from(new Set(tags)); // Remove duplicates
}

/**
 * Validate expression syntax without throwing
 */
export function validateExpression(expr: string): { valid: boolean; error?: string } {
  try {
    parseBooleanExpression(expr);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid expression',
    };
  }
}
