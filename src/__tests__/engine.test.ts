import { describe, expect, it } from 'vitest';
import { applyAnswer, DAY } from '../engine/srs';
import { levelInfo, xpForAnswer } from '../engine/xp';
import { CALC_KINDS, checkNumber, coefficients, incomeTax, inheritTaxYen, parseNumber, retireDeduction, seeded } from '../engine/calcGenerators';
import { bookToCsv, csvToBook, csvToQuestions, parseCsv } from '../engine/csv';
import { BUILTIN_QUESTIONS } from '../data/questions';
import { streakOf } from '../engine/dates';

const q = BUILTIN_QUESTIONS.find((x) => x.id === 'life-3-001')!;

describe('間隔反復と XP 稼ぎ防止', () => {
  it('初回正解のみ基本XP、期限前の再正解は0XP', () => {
    const t0 = 1_000_000;
    const a = applyAnswer(undefined, true, t0);
    const xp1 = xpForAnswer(q, undefined, a.record, true, a.boxUp, 1);
    expect(xp1.xp).toBeGreaterThan(0);
    const rec1 = { ...a.record, firstClearXp: true, lastXpBox: a.record.box };
    // 直後にもう一度正解 → 期限前なので箱は上がらず XP 0
    const b = applyAnswer(rec1, true, t0 + 1000);
    expect(b.boxUp).toBe(false);
    expect(xpForAnswer(q, rec1, b.record, true, b.boxUp, 2).xp).toBe(0);
    // 期限後の復習で正解 → 箱が上がり復習XP
    const c = applyAnswer(rec1, true, t0 + 2 * DAY);
    expect(c.boxUp).toBe(true);
    expect(xpForAnswer(q, rec1, c.record, true, c.boxUp, 1).xp).toBeGreaterThan(0);
  });

  it('不正解で箱0に戻り10分後に再出題', () => {
    const r = applyAnswer({ attempts: 3, correct: 3, box: 3, due: 0, lastAnswered: 0, firstClearXp: true, lastXpBox: 3, wrongStreak: 0 }, false, 5000);
    expect(r.record.box).toBe(0);
    expect(r.record.due).toBe(5000 + 10 * 60 * 1000);
  });

  it('レベル曲線は単調増加', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(100000).level).toBeGreaterThan(levelInfo(1000).level);
  });
});

describe('計算エンジン（制度の数値）', () => {
  it('6つの係数（一般的な係数表の値と一致）', () => {
    expect(coefficients(2, 10).減債基金係数).toBeCloseTo(0.0913, 4);
    expect(coefficients(1, 20).年金現価係数).toBeCloseTo(18.0456, 4);
    expect(coefficients(2, 10).終価係数).toBeCloseTo(1.219, 3);
  });
  it('所得税の速算表', () => {
    expect(incomeTax(5_000_000).tax).toBe(572_500);
    expect(incomeTax(1_950_000).tax).toBe(97_500);
    expect(incomeTax(10_000_000).tax).toBe(1_764_000);
  });
  it('退職所得控除', () => {
    expect(retireDeduction(1)).toBe(80);
    expect(retireDeduction(20)).toBe(800);
    expect(retireDeduction(26)).toBe(1220);
  });
  it('相続税の総額（課税遺産1.2億・妻と子2人＝1,900万円）', () => {
    expect(inheritTaxYen(60_000_000) + inheritTaxYen(30_000_000) * 2).toBe(19_000_000);
  });
  it('全ジェネレーターが有限の答えと途中過程を生成', () => {
    for (const k of CALC_KINDS) {
      for (let s = 1; s < 60; s++) {
        const p = k.gen(seeded(s * 31));
        expect(Number.isFinite(p.answer)).toBe(true);
        expect(p.steps.length).toBeGreaterThan(0);
        expect(checkNumber(String(p.answer), p.answer, p.tolerance)).toBe(true);
      }
    }
  });
  it('数値入力の正規化（全角・カンマ・単位）', () => {
    expect(parseNumber('４５６，５００円')).toBe(456500);
    expect(parseNumber('1.43%')).toBe(1.43);
    expect(parseNumber('')).toBeNull();
  });
});

describe('CSV', () => {
  it('引用符・改行を含むセルを解析', () => {
    expect(parseCsv('a,"b,""c""",d\n1,"x\ny",3')).toEqual([['a', 'b,"c"', 'd'], ['1', 'x\ny', '3']]);
  });
  it('学習記録の往復変換', () => {
    const { entries } = csvToBook('book,chapter,page,problemNo,field,grade,status,understanding,weak,linkedStage,memo,correctCount,wrongCount\n史上最強のFP3級問題集,第1章,10,問1,ライフ,3,review,2,1,life-basic,メモ,1,2');
    expect(entries).toHaveLength(1);
    expect(entries[0].field).toBe('life');
    expect(entries[0].attempts.filter((a) => !a.correct)).toHaveLength(2);
    const back = csvToBook(bookToCsv(entries)).entries[0];
    expect(back.problemNo).toBe('問1');
    expect(back.weak).toBe(true);
  });
  it('取込問題は「要確認」扱い', () => {
    const { questions } = csvToQuestions('field,grade,format,prompt,choiceA,choiceB,answer\ntax,3,truefalse,テスト,,,o');
    expect(questions[0].law.status).toBe('needs-review');
  });
});

describe('連続学習日数', () => {
  it('今日未学習でも昨日まで連続ならカウント', () => {
    const now = new Date(2026, 10, 19, 12);
    const log = (d: string) => ({ date: d, answered: 1, correct: 1, reviews: 0, seconds: 0, xp: 0 });
    expect(streakOf({ '2026-11-18': log('2026-11-18'), '2026-11-17': log('2026-11-17') }, now)).toBe(2);
    expect(streakOf({ '2026-11-16': log('2026-11-16') }, now)).toBe(0);
  });
});
