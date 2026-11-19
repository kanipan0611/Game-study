import { describe, expect, it } from 'vitest';
import { BUILTIN_QUESTIONS } from '../data/questions';
import { ALL_TOPICS, FIELDS } from '../data/fields';
import { SCENARIOS } from '../data/scenarios';

describe('問題データの整合性', () => {
  it('IDが一意', () => {
    const ids = BUILTIN_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BUILTIN_QUESTIONS.map((q) => [q.id, q] as const))('%s は正答・解説・出典を持つ', (_id, q) => {
    expect(q.explanation.length).toBeGreaterThan(10);
    expect(q.law.basisDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(q.law.basis).toBeTruthy();
    expect(q.law.source).toBeTruthy();
    expect(ALL_TOPICS.some((t) => t.id === q.topic)).toBe(true);
    if (q.format === 'numeric') {
      expect(q.numeric).toBeDefined();
      expect(q.steps?.length ?? 0).toBeGreaterThan(0);
    } else {
      const ids = q.choices!.map((c) => c.id);
      const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
      ans.forEach((a) => expect(ids).toContain(a));
      q.choices!.forEach((c) => expect(c.why.length).toBeGreaterThan(3));
    }
    // 本試験形式：3級は三答択一、2級は四答択一
    if (q.format === 'single') expect(q.choices!.length).toBe(q.grade === 3 ? 3 : 4);
  });

  it('全分野に3級・2級・計算問題がある', () => {
    for (const f of FIELDS) {
      const qs = BUILTIN_QUESTIONS.filter((q) => q.field === f.id);
      expect(qs.some((q) => q.grade === 3 && q.format !== 'numeric')).toBe(true);
      expect(qs.some((q) => q.grade === 2)).toBe(true);
      expect(qs.some((q) => q.format === 'numeric')).toBe(true);
    }
  });

  it('○×問題の正解が○に偏っていない（当て推量で合格できない）', () => {
    const tf = BUILTIN_QUESTIONS.filter((q) => q.format === 'truefalse');
    const o = tf.filter((q) => q.answer === 'o').length / tf.length;
    expect(o).toBeGreaterThan(0.35);
    expect(o).toBeLessThan(0.65);
  });

  it('全形式（○×・択一・複数・計算・事例）を収録', () => {
    const formats = new Set(BUILTIN_QUESTIONS.map((q) => q.format));
    for (const f of ['truefalse', 'single', 'multi', 'numeric']) expect(formats.has(f as never)).toBe(true);
  });

  it('実務シミュレーションの各ステップに最適解がちょうど1つ', () => {
    for (const s of SCENARIOS) for (const st of s.steps) expect(st.choices.filter((c) => c.good).length).toBe(1);
  });
});
