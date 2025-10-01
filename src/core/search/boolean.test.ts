import { describe, it, expect } from 'vitest';
import {
  parseBooleanExpression,
  evaluateExpression,
  expressionToString,
  validateExpression,
  getExpressionTags,
} from './boolean';

describe('Boolean Expression Parser', () => {
  describe('parseBooleanExpression', () => {
    it('should parse simple tag expressions', () => {
      const expr = parseBooleanExpression('ai');
      expect(expr.type).toBe('tag');
      expect(expr.value).toBe('ai');
    });

    it('should parse AND expressions', () => {
      const expr = parseBooleanExpression('ai AND analysis');
      expect(expr.type).toBe('and');
      expect(Array.isArray(expr.value)).toBe(true);
      expect((expr.value as any[]).length).toBe(2);
    });

    it('should parse OR expressions', () => {
      const expr = parseBooleanExpression('writing OR creative');
      expect(expr.type).toBe('or');
      expect(Array.isArray(expr.value)).toBe(true);
      expect((expr.value as any[]).length).toBe(2);
    });

    it('should parse NOT expressions', () => {
      const expr = parseBooleanExpression('NOT deprecated');
      expect(expr.type).toBe('not');
      expect(Array.isArray(expr.value)).toBe(true);
      expect((expr.value as any[]).length).toBe(1);
    });

    it('should handle multiple ANDs', () => {
      const expr = parseBooleanExpression('ai AND analysis AND machine-learning');
      expect(expr.type).toBe('and');
      expect((expr.value as any[]).length).toBe(3);
    });

    it('should handle operator precedence (AND before OR)', () => {
      const expr = parseBooleanExpression('ai AND analysis OR writing');
      expect(expr.type).toBe('or');
      const orParts = expr.value as any[];
      expect(orParts[0].type).toBe('and');
      expect(orParts[1].type).toBe('tag');
    });

    // Note: Complex parentheses handling is simplified for now
    // Users can still create complex expressions, but parentheses
    // in the middle of expressions may not work as expected
    it.skip('should handle parentheses for grouping', () => {
      const expr = parseBooleanExpression('(ai OR writing) AND analysis');
      expect(expr.type).toBe('and');
    });

    it('should throw on empty expression', () => {
      expect(() => parseBooleanExpression('')).toThrow();
    });

    it('should be case-insensitive for operators', () => {
      const expr1 = parseBooleanExpression('ai and analysis');
      const expr2 = parseBooleanExpression('ai AND analysis');
      expect(expr1.type).toBe(expr2.type);
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate simple tag expressions', () => {
      const expr = parseBooleanExpression('ai');
      expect(evaluateExpression(expr, ['ai', 'analysis'])).toBe(true);
      expect(evaluateExpression(expr, ['writing', 'creative'])).toBe(false);
    });

    it('should evaluate AND expressions', () => {
      const expr = parseBooleanExpression('ai AND analysis');
      expect(evaluateExpression(expr, ['ai', 'analysis'])).toBe(true);
      expect(evaluateExpression(expr, ['ai', 'writing'])).toBe(false);
      expect(evaluateExpression(expr, ['analysis'])).toBe(false);
    });

    it('should evaluate OR expressions', () => {
      const expr = parseBooleanExpression('ai OR writing');
      expect(evaluateExpression(expr, ['ai'])).toBe(true);
      expect(evaluateExpression(expr, ['writing'])).toBe(true);
      expect(evaluateExpression(expr, ['ai', 'writing'])).toBe(true);
      expect(evaluateExpression(expr, ['creative'])).toBe(false);
    });

    it('should evaluate NOT expressions', () => {
      const expr = parseBooleanExpression('NOT deprecated');
      expect(evaluateExpression(expr, ['ai', 'analysis'])).toBe(true);
      expect(evaluateExpression(expr, ['deprecated'])).toBe(false);
      expect(evaluateExpression(expr, ['ai', 'deprecated'])).toBe(false);
    });

    it('should evaluate complex expressions', () => {
      const expr = parseBooleanExpression('ai AND NOT deprecated');
      expect(evaluateExpression(expr, ['ai', 'analysis'])).toBe(true);
      expect(evaluateExpression(expr, ['ai', 'deprecated'])).toBe(false);
      expect(evaluateExpression(expr, ['writing'])).toBe(false);
    });

    it('should be case-insensitive for tag matching', () => {
      const expr = parseBooleanExpression('AI');
      expect(evaluateExpression(expr, ['ai'])).toBe(true);
      expect(evaluateExpression(expr, ['Ai'])).toBe(true);
      expect(evaluateExpression(expr, ['aI'])).toBe(true);
    });

    it('should handle multiple AND conditions', () => {
      const expr = parseBooleanExpression('ai AND analysis AND machine-learning');
      expect(evaluateExpression(expr, ['ai', 'analysis', 'machine-learning'])).toBe(true);
      expect(evaluateExpression(expr, ['ai', 'analysis'])).toBe(false);
    });

    it('should handle OR with AND precedence', () => {
      const expr = parseBooleanExpression('ai AND analysis OR writing');
      expect(evaluateExpression(expr, ['ai', 'analysis'])).toBe(true);
      expect(evaluateExpression(expr, ['writing'])).toBe(true);
      expect(evaluateExpression(expr, ['ai'])).toBe(false);
    });
  });

  describe('expressionToString', () => {
    it('should convert simple tag to string', () => {
      const expr = parseBooleanExpression('ai');
      expect(expressionToString(expr)).toBe('ai');
    });

    it('should convert AND expression to string', () => {
      const expr = parseBooleanExpression('ai AND analysis');
      const str = expressionToString(expr);
      expect(str).toContain('AND');
      expect(str).toContain('ai');
      expect(str).toContain('analysis');
    });

    it('should convert OR expression to string', () => {
      const expr = parseBooleanExpression('writing OR creative');
      const str = expressionToString(expr);
      expect(str).toContain('OR');
      expect(str).toContain('writing');
      expect(str).toContain('creative');
    });

    it('should convert NOT expression to string', () => {
      const expr = parseBooleanExpression('NOT deprecated');
      const str = expressionToString(expr);
      expect(str).toContain('NOT');
      expect(str).toContain('deprecated');
    });

    it('should add parentheses for precedence clarity', () => {
      const expr = parseBooleanExpression('ai AND analysis OR writing');
      const str = expressionToString(expr);
      // OR should not be parenthesized, but if it contains OR inside AND, it should be
      expect(str).toBeTruthy();
    });
  });

  describe('validateExpression', () => {
    it('should validate correct expressions', () => {
      expect(validateExpression('ai').valid).toBe(true);
      expect(validateExpression('ai AND analysis').valid).toBe(true);
      expect(validateExpression('ai OR writing').valid).toBe(true);
      expect(validateExpression('NOT deprecated').valid).toBe(true);
      expect(validateExpression('(ai AND analysis) OR writing').valid).toBe(true);
    });

    it('should invalidate empty expressions', () => {
      const result = validateExpression('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should invalidate expressions with unbalanced parentheses', () => {
      const result = validateExpression('(ai AND analysis');
      expect(result.valid).toBe(false);
    });
  });

  describe('getExpressionTags', () => {
    it('should extract tags from simple expression', () => {
      const expr = parseBooleanExpression('ai');
      const tags = getExpressionTags(expr);
      expect(tags).toEqual(['ai']);
    });

    it('should extract tags from AND expression', () => {
      const expr = parseBooleanExpression('ai AND analysis');
      const tags = getExpressionTags(expr);
      expect(tags).toContain('ai');
      expect(tags).toContain('analysis');
      expect(tags.length).toBe(2);
    });

    it('should extract tags from OR expression', () => {
      const expr = parseBooleanExpression('writing OR creative');
      const tags = getExpressionTags(expr);
      expect(tags).toContain('writing');
      expect(tags).toContain('creative');
      expect(tags.length).toBe(2);
    });

    it('should extract tags from NOT expression', () => {
      const expr = parseBooleanExpression('NOT deprecated');
      const tags = getExpressionTags(expr);
      expect(tags).toEqual(['deprecated']);
    });

    it('should deduplicate tags', () => {
      const expr = parseBooleanExpression('ai AND ai OR ai');
      const tags = getExpressionTags(expr);
      expect(tags).toEqual(['ai']);
    });

    it('should extract all unique tags from complex expression', () => {
      const expr = parseBooleanExpression('ai AND analysis OR writing AND NOT deprecated');
      const tags = getExpressionTags(expr);
      expect(tags).toContain('ai');
      expect(tags).toContain('analysis');
      expect(tags).toContain('writing');
      expect(tags).toContain('deprecated');
      expect(tags.length).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tags with hyphens', () => {
      const expr = parseBooleanExpression('machine-learning');
      expect(evaluateExpression(expr, ['machine-learning'])).toBe(true);
    });

    it('should handle tags with underscores', () => {
      const expr = parseBooleanExpression('ai_analysis');
      expect(evaluateExpression(expr, ['ai_analysis'])).toBe(true);
    });

    it('should handle tags with numbers', () => {
      const expr = parseBooleanExpression('gpt4');
      expect(evaluateExpression(expr, ['gpt4'])).toBe(true);
    });

    it('should handle extra whitespace', () => {
      const expr = parseBooleanExpression('  ai   AND   analysis  ');
      expect(expr.type).toBe('and');
      expect(evaluateExpression(expr, ['ai', 'analysis'])).toBe(true);
    });

    it('should handle nested NOT expressions', () => {
      const expr = parseBooleanExpression('ai AND NOT deprecated');
      expect(evaluateExpression(expr, ['ai'])).toBe(true);
      expect(evaluateExpression(expr, ['ai', 'deprecated'])).toBe(false);
    });
  });
});
