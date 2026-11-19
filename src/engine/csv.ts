import type { BookEntry, FieldId, Grade, Question, QuestionFormat } from '../types';

// ============================================================
// CSV 入出力。Excel / Google スプレッドシートで編集できるよう UTF-8(BOM付) で出力。
// 将来の OCR 取込は「OCR → この CSV 形式の行」に変換して同じ経路で取り込む。
// ============================================================

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');

/** ヘッダー名で列を引けるようにする */
function table(text: string) {
  const [head, ...body] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])) as Record<string, string>);
}

const FIELD_ALIASES: Record<string, FieldId> = {
  life: 'life', ライフ: 'life', ライフプランニング: 'life', 'ライフプランニングと資金計画': 'life',
  risk: 'risk', リスク: 'risk', リスク管理: 'risk',
  finance: 'finance', 金融: 'finance', 金融資産運用: 'finance',
  tax: 'tax', タックス: 'tax', タックスプランニング: 'tax',
  estate: 'estate', 不動産: 'estate',
  inherit: 'inherit', 相続: 'inherit', '相続・事業承継': 'inherit',
};
export const toField = (s: string): FieldId | null => FIELD_ALIASES[s.trim()] ?? null;
const toGrade = (s: string): Grade => (s.includes('2') ? 2 : 3);

// ---------------- 史上最強シリーズ 学習記録 ----------------
export const BOOK_HEADERS = [
  'book', 'chapter', 'page', 'problemNo', 'field', 'grade', 'status', 'understanding', 'weak', 'linkedStage', 'memo', 'correctCount', 'wrongCount',
];

export function bookToCsv(entries: BookEntry[]) {
  return toCsv([
    BOOK_HEADERS,
    ...entries.map((e) => [
      e.book, e.chapter, e.page ?? '', e.problemNo, e.field, e.grade, e.status, e.understanding, e.weak ? 1 : 0, e.linkedStage ?? '', e.memo,
      e.attempts.filter((a) => a.correct).length, e.attempts.filter((a) => !a.correct).length,
    ]),
  ]);
}

export function csvToBook(text: string, origin: BookEntry['origin'] = 'csv'): { entries: BookEntry[]; errors: string[] } {
  const errors: string[] = [];
  const entries: BookEntry[] = [];
  table(text).forEach((r, i) => {
    const field = toField(r.field ?? '');
    if (!field) {
      errors.push(`${i + 2}行目：分野「${r.field}」を認識できません`);
      return;
    }
    const c = Number(r.correctCount) || 0;
    const w = Number(r.wrongCount) || 0;
    const now = Date.now();
    entries.push({
      id: `bk-${now.toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      book: r.book || '史上最強のFP問題集',
      chapter: r.chapter ?? '',
      page: r.page ? Number(r.page) : null,
      problemNo: r.problemNo ?? '',
      field,
      grade: toGrade(r.grade ?? '3'),
      status: (['untouched', 'solved', 'review', 'mastered'].includes(r.status) ? r.status : 'untouched') as BookEntry['status'],
      understanding: Math.max(0, Math.min(5, Number(r.understanding) || 0)) as BookEntry['understanding'],
      weak: r.weak === '1' || r.weak === 'true',
      linkedStage: r.linkedStage || null,
      memo: r.memo ?? '',
      attempts: [...Array(c).fill(true), ...Array(w).fill(false)].map((correct) => ({ date: now, correct })),
      origin,
      createdAt: now,
    });
  });
  return { entries, errors };
}

// ---------------- 問題データ（ユーザー作成のオリジナル問題） ----------------
export const QUESTION_HEADERS = [
  'id', 'field', 'grade', 'format', 'topic', 'prompt', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'whyA', 'whyB', 'whyC', 'whyD',
  'answer', 'unit', 'explanation', 'steps', 'basisDate', 'basis', 'source',
];

export function csvToQuestions(text: string): { questions: Question[]; errors: string[] } {
  const errors: string[] = [];
  const questions: Question[] = [];
  table(text).forEach((r, i) => {
    const line = i + 2;
    const field = toField(r.field ?? '');
    const format = (r.format || 'single') as QuestionFormat;
    if (!field) return errors.push(`${line}行目：分野が不正`);
    if (!r.prompt) return errors.push(`${line}行目：問題文が空`);
    if (!['truefalse', 'single', 'multi', 'numeric', 'case'].includes(format)) return errors.push(`${line}行目：形式が不正`);
    const grade = toGrade(r.grade ?? '3');
    const letters = ['A', 'B', 'C', 'D'];
    const choices =
      format === 'truefalse'
        ? [
            { id: 'o', text: '○（適切）', why: r.whyA ?? '' },
            { id: 'x', text: '×（不適切）', why: r.whyB ?? '' },
          ]
        : format === 'numeric'
          ? undefined
          : letters
              .map((L) => ({ id: L.toLowerCase(), text: r[`choice${L}`], why: r[`why${L}`] ?? '' }))
              .filter((c) => c.text);
    const ans = (r.answer ?? '').toLowerCase().replace(/○/g, 'o').replace(/×/g, 'x');
    const q: Question = {
      id: r.id || `user-${field}-${Date.now().toString(36)}-${i}`,
      field, grade,
      stage: format === 'numeric' ? 'calc' : grade === 3 ? 'basic' : 'applied',
      format,
      topic: r.topic || `${field}-user`,
      prompt: r.prompt,
      choices,
      answer: format === 'multi' ? ans.split(/[|;\s]+/).filter(Boolean) : ans,
      numeric: format === 'numeric' ? { value: Number(ans), unit: r.unit || '', tolerance: 0.5 } : undefined,
      explanation: r.explanation ?? '',
      steps: r.steps ? r.steps.split('|') : undefined,
      difficulty: 2,
      law: {
        basisDate: r.basisDate || '',
        basis: r.basis || '未登録',
        source: r.source || '未登録',
        // ユーザー登録問題は検証済みと表示しない
        status: 'needs-review',
      },
    };
    if (format === 'numeric' && !Number.isFinite(q.numeric!.value)) return errors.push(`${line}行目：数値の正答が不正`);
    questions.push(q);
  });
  return { questions, errors };
}

export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
