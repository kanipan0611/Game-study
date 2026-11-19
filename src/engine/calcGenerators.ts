import type { FieldId } from '../types';

// ============================================================
// 計算特訓：数値をランダムに変えて無限に出題できるジェネレーター。
// すべて途中過程（steps）を生成し、答えだけで終わらせない。
// 税率・控除額は 2026年4月1日 法令基準日で確認済みの値のみを使用。
// ============================================================

export interface CalcProblem {
  kind: string;
  field: FieldId;
  title: string;
  prompt: string;
  /** 本試験で資料として与えられる表など */
  table?: string[][];
  answer: number;
  unit: string;
  tolerance: number;
  steps: string[];
  formula: string;
}

export interface CalcKind {
  id: string;
  name: string;
  field: FieldId;
  emoji: string;
  gen: (r: Rand) => CalcProblem;
}

export type Rand = () => number;

/** 再現可能な乱数（シード付き） */
export function seeded(seed: number): Rand {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: Rand, min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
const pick = <T,>(r: Rand, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
export const yen = (n: number) => n.toLocaleString('ja-JP');
const man = (n: number) => `${yen(n)}万円`;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

// ---------------- 6つの係数 ----------------
export function coefficients(rate: number, n: number) {
  const i = rate / 100;
  const fv = Math.pow(1 + i, n);
  return {
    終価係数: r4(fv),
    現価係数: r4(1 / fv),
    年金終価係数: r4((fv - 1) / i),
    減債基金係数: r4(i / (fv - 1)),
    資本回収係数: r4((i * fv) / (fv - 1)),
    年金現価係数: r4((fv - 1) / (i * fv)),
  };
}

type CoefName = keyof ReturnType<typeof coefficients>;

const COEF_CASES: { coef: CoefName; make: (amt: number, n: number, rate: number) => string; given: string }[] = [
  { coef: '終価係数', given: '現在の元本 → n年後の元利合計', make: (a, n, r) => `${man(a)}を年利${r}％で${n}年間複利運用した場合の元利合計額はいくらか。` },
  { coef: '現価係数', given: 'n年後の目標額 → 現在必要な元本', make: (a, n, r) => `${n}年後に${man(a)}を準備するため、年利${r}％で複利運用する場合、現在いくら必要か。` },
  { coef: '年金終価係数', given: '毎年の積立額 → n年後の合計', make: (a, n, r) => `毎年末に${man(a)}ずつ年利${r}％で複利運用しながら${n}年間積み立てた場合、${n}年後の元利合計額はいくらか。` },
  { coef: '減債基金係数', given: 'n年後の目標額 → 毎年の積立額', make: (a, n, r) => `${n}年後に${man(a)}を準備するため、年利${r}％で複利運用しながら毎年末に積み立てる場合、毎年の積立額はいくらか。` },
  { coef: '資本回収係数', given: '現在の元本 → 毎年の受取額（返済額）', make: (a, n, r) => `${man(a)}を年利${r}％で複利運用しながら、${n}年間にわたって毎年末に均等に取り崩す場合、毎年受け取れる額はいくらか。` },
  { coef: '年金現価係数', given: '毎年の受取額 → 現在必要な元本', make: (a, n, r) => `年利${r}％で複利運用しながら、${n}年間にわたって毎年末に${man(a)}ずつ受け取るために、現在いくら必要か。` },
];

const genCoef = (r: Rand): CalcProblem => {
  const rate = pick(r, [1, 2, 3]);
  const n = pick(r, [5, 10, 15, 20, 25]);
  const c = pick(r, COEF_CASES);
  const big = c.coef === '年金終価係数' || c.coef === '年金現価係数';
  const amt = big ? int(r, 5, 30) * 10 : int(r, 10, 100) * 50;
  const co = coefficients(rate, n);
  const ans = Math.round(amt * co[c.coef] * 10) / 10;
  return {
    kind: 'coef', field: 'life', title: '6つの係数',
    prompt: c.make(amt, n, rate) + '（下の係数表を使用。万円未満は小数第1位まで、第2位を四捨五入）',
    table: [['係数', `年利${rate}％・${n}年`], ...Object.entries(co).map(([k, v]) => [k, v.toFixed(4)])],
    answer: ans, unit: '万円', tolerance: 0.051,
    formula: `${c.given} ＝ ${c.coef}`,
    steps: [`求めたいもの：${c.given}`, `→ 使う係数は「${c.coef}」（${co[c.coef].toFixed(4)}）`, `${man(amt)} × ${co[c.coef].toFixed(4)} ＝ ${ans}万円`],
  };
};

// ---------------- 債券利回り ----------------
const genBond = (r: Rand): CalcProblem => {
  const coupon = pick(r, [0.5, 0.8, 1.0, 1.2, 1.5, 2.0]);
  const price = pick(r, [97, 98, 98.5, 99, 101, 102, 103]);
  const years = pick(r, [2, 3, 4, 5, 8, 10]);
  const kind = pick(r, ['最終利回り', '直接利回り'] as const);
  if (kind === '直接利回り') {
    const ans = Math.round((coupon / price) * 100 * 1000) / 1000;
    return {
      kind: 'bond', field: 'finance', title: '債券（直接利回り）',
      prompt: `表面利率${coupon}％の債券を額面100円あたり${price}円で購入した。直接利回りは何％か。（小数点以下第4位を四捨五入）`,
      answer: ans, unit: '％', tolerance: 0.0006,
      formula: '直接利回り ＝ 表面利率 ÷ 購入価格 × 100',
      steps: [`${coupon} ÷ ${price} × 100`, `＝ ${ans}％`],
    };
  }
  const gain = (100 - price) / years;
  const raw = ((coupon + gain) / price) * 100;
  const ans = Math.round(raw * 1000) / 1000;
  return {
    kind: 'bond', field: 'finance', title: '債券（最終利回り）',
    prompt: `表面利率${coupon}％、残存期間${years}年の固定利付債券を額面100円あたり${price}円で購入し、償還まで保有した。最終利回り（単利・年率）は何％か。（小数点以下第4位を四捨五入）`,
    answer: ans, unit: '％', tolerance: 0.0006,
    formula: '最終利回り ＝｛表面利率 ＋（額面 − 購入価格）÷ 残存年数｝÷ 購入価格 × 100',
    steps: [
      `年あたりの償還差損益：（100 − ${price}）÷ ${years} ＝ ${Math.round(gain * 10000) / 10000}`,
      `｛${coupon} ＋ ${Math.round(gain * 10000) / 10000}｝÷ ${price} × 100`,
      `＝ ${raw.toFixed(5)}… → ${ans}％`,
    ],
  };
};

// ---------------- 株式指標 ----------------
const genStock = (r: Rand): CalcProblem => {
  const price = int(r, 8, 60) * 100;
  const eps = int(r, 4, 40) * 10;
  const bps = int(r, 10, 80) * 50;
  const div = int(r, 2, 15) * 10;
  const kind = pick(r, ['PER', 'PBR', '配当利回り', '配当性向'] as const);
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const base = `X社：株価 ${yen(price)}円、1株当たり純利益 ${yen(eps)}円、1株当たり純資産 ${yen(bps)}円、1株当たり年間配当金 ${yen(div)}円。`;
  const table: Record<typeof kind, { f: string; v: number; u: string; s: string }> = {
    PER: { f: 'PER ＝ 株価 ÷ 1株当たり純利益', v: round2(price / eps), u: '倍', s: `${yen(price)} ÷ ${yen(eps)}` },
    PBR: { f: 'PBR ＝ 株価 ÷ 1株当たり純資産', v: round2(price / bps), u: '倍', s: `${yen(price)} ÷ ${yen(bps)}` },
    配当利回り: { f: '配当利回り ＝ 1株当たり配当金 ÷ 株価 × 100', v: round2((div / price) * 100), u: '％', s: `${div} ÷ ${yen(price)} × 100` },
    配当性向: { f: '配当性向 ＝ 1株当たり配当金 ÷ 1株当たり純利益 × 100', v: round2((div / eps) * 100), u: '％', s: `${div} ÷ ${yen(eps)} × 100` },
  };
  const t = table[kind];
  return {
    kind: 'stock', field: 'finance', title: `株式指標（${kind}）`,
    prompt: `${base} ${kind}はいくらか。（小数点以下第3位を四捨五入）`,
    answer: t.v, unit: t.u, tolerance: 0.006, formula: t.f,
    steps: [t.f, `${t.s} ＝ ${t.v}${t.u}`],
  };
};

// ---------------- 所得税（速算表） ----------------
export const INCOME_TAX_TABLE: [number, number, number][] = [
  // [上限(円), 税率, 控除額]
  [1_949_000, 0.05, 0],
  [3_299_000, 0.1, 97_500],
  [6_949_000, 0.2, 427_500],
  [8_999_000, 0.23, 636_000],
  [17_999_000, 0.33, 1_536_000],
  [39_999_000, 0.4, 2_796_000],
  [Infinity, 0.45, 4_796_000],
];
export function incomeTax(taxable: number) {
  const row = INCOME_TAX_TABLE.find(([max]) => taxable <= max)!;
  return { tax: Math.floor(taxable * row[1] - row[2]), rate: row[1], ded: row[2] };
}
const genIncomeTax = (r: Rand): CalcProblem => {
  const taxable = int(r, 150, 2500) * 10000;
  const { tax, rate, ded } = incomeTax(taxable);
  return {
    kind: 'incometax', field: 'tax', title: '所得税（速算表）',
    prompt: `課税総所得金額が${yen(taxable)}円である場合の所得税額（復興特別所得税を除く）はいくらか。`,
    table: [
      ['課税総所得金額', '税率', '控除額'],
      ['195万円以下', '5％', '0円'],
      ['195万円超 330万円以下', '10％', '97,500円'],
      ['330万円超 695万円以下', '20％', '427,500円'],
      ['695万円超 900万円以下', '23％', '636,000円'],
      ['900万円超 1,800万円以下', '33％', '1,536,000円'],
      ['1,800万円超 4,000万円以下', '40％', '2,796,000円'],
      ['4,000万円超', '45％', '4,796,000円'],
    ],
    answer: tax, unit: '円', tolerance: 0.5,
    formula: '所得税額 ＝ 課税総所得金額 × 税率 − 控除額',
    steps: [`該当する区分：税率${Math.round(rate * 100)}％・控除額${yen(ded)}円`, `${yen(taxable)} × ${Math.round(rate * 100)}％ − ${yen(ded)}`, `＝ ${yen(tax)}円`],
  };
};

// ---------------- 退職所得 ----------------
export function retireDeduction(years: number) {
  return years <= 20 ? Math.max(80, 40 * years) : 800 + 70 * (years - 20);
}
const genRetire = (r: Rand): CalcProblem => {
  const y = int(r, 3, 42);
  const m = int(r, 0, 11);
  const years = m > 0 ? y + 1 : y;
  const amt = int(r, 10, 80) * 50;
  const ded = retireDeduction(years);
  const ans = Math.max(0, ((amt - ded) * 1) / 2);
  return {
    kind: 'retire', field: 'tax', title: '退職所得',
    prompt: `勤続${y}年${m}か月で退職し、退職一時金${man(amt)}を受け取った（役員等・障害退職ではない）。退職所得の金額は何万円か。`,
    answer: ans, unit: '万円', tolerance: 0.01,
    formula: '退職所得 ＝（収入金額 − 退職所得控除額）× 1/2',
    steps: [
      `勤続年数：${y}年${m}か月 → ${m > 0 ? `1年未満切上げで${years}年` : `${years}年`}`,
      years <= 20
        ? `退職所得控除額：40万円 × ${years}年 ＝ ${40 * years}万円${40 * years < 80 ? ' → 最低80万円' : ''}`
        : `退職所得控除額：800万円 ＋ 70万円 ×（${years} − 20）＝ ${man(ded)}`,
      ans > 0 ? `（${man(amt)} − ${man(ded)}）× 1/2 ＝ ${man(ans)}` : `収入が控除額以下 → 退職所得 0円`,
    ],
  };
};

// ---------------- 相続税の総額 ----------------
export const INHERIT_TAX_TABLE: [number, number, number][] = [
  // [上限(万円), 税率, 控除額(万円)]
  [1000, 0.1, 0],
  [3000, 0.15, 50],
  [5000, 0.2, 200],
  [10000, 0.3, 700],
  [20000, 0.4, 1700],
  [30000, 0.45, 2700],
  [60000, 0.5, 4200],
  [Infinity, 0.55, 7200],
];
/** 法定相続分に応ずる取得金額（円）→ 税額（円） */
export const inheritTaxYen = (yenAmt: number) => {
  const row = INHERIT_TAX_TABLE.find(([max]) => yenAmt <= max * 10000)!;
  return Math.round(yenAmt * row[1] - row[2] * 10000);
};
const genInherit = (r: Rand): CalcProblem => {
  const kids = int(r, 1, 3);
  const heirs = 1 + kids;
  const estate = int(r, 12, 60) * 500; // 課税価格の合計（万円）
  const basic = 3000 + 600 * heirs;
  const taxable = estate - basic;
  if (taxable <= 0) return genInherit(r);
  // 実際の計算は円単位：法定相続分に応ずる取得金額は1,000円未満切捨て
  const taxableYen = taxable * 10000;
  const spouseShare = Math.floor(taxableYen / 2 / 1000) * 1000;
  const kidShare = Math.floor(taxableYen / 2 / kids / 1000) * 1000;
  const tS = inheritTaxYen(spouseShare);
  const tK = inheritTaxYen(kidShare);
  const total = tS + tK * kids;
  return {
    kind: 'inherit', field: 'inherit', title: '相続税の総額',
    prompt: `課税価格の合計額が${man(estate)}、相続人は配偶者と子${kids}人（全員実子・放棄者なし）。相続税の総額は何円か。（法定相続分に応ずる取得金額は1,000円未満切捨て）`,
    table: [
      ['法定相続分に応ずる取得金額', '税率', '控除額'],
      ['1,000万円以下', '10％', '−'],
      ['3,000万円以下', '15％', '50万円'],
      ['5,000万円以下', '20％', '200万円'],
      ['1億円以下', '30％', '700万円'],
      ['2億円以下', '40％', '1,700万円'],
      ['3億円以下', '45％', '2,700万円'],
      ['6億円以下', '50％', '4,200万円'],
      ['6億円超', '55％', '7,200万円'],
    ],
    answer: total, unit: '円', tolerance: 0.5,
    formula: '課税遺産総額 ＝ 課税価格 − 基礎控除（3,000万円＋600万円×法定相続人）→ 法定相続分で按分 → 速算表 → 合計',
    steps: [
      `基礎控除：3,000万円 ＋ 600万円 × ${heirs}人 ＝ ${man(basic)}`,
      `課税遺産総額：${man(estate)} − ${man(basic)} ＝ ${man(taxable)}`,
      `配偶者（1/2）：${yen(spouseShare)}円 → 税額 ${yen(tS)}円`,
      `子1人（1/${kids * 2}）：${yen(kidShare)}円 → 税額 ${yen(tK)}円 × ${kids}人 ＝ ${yen(tK * kids)}円`,
      `相続税の総額：${yen(tS)}円 ＋ ${yen(tK * kids)}円 ＝ ${yen(total)}円`,
    ],
  };
};

// ---------------- 不動産の譲渡所得 ----------------
const genTransfer = (r: Rand): CalcProblem => {
  const price = int(r, 20, 120) * 100;
  const known = r() < 0.5;
  const realCost = known ? int(r, 2, 40) * 100 : 0;
  const cost = known ? Math.max(realCost, price * 0.05) : price * 0.05;
  const exp = int(r, 2, 8) * 50;
  const residence = r() < 0.6;
  const gain = price - cost - exp;
  const ans = Math.max(0, gain - (residence ? 3000 : 0));
  return {
    kind: 'transfer', field: 'estate', title: '不動産の譲渡所得',
    prompt: `${residence ? '居住用財産（自宅）' : '賃貸用の土地建物'}を${man(price)}で譲渡した。取得費は${known ? man(realCost) : '不明'}、譲渡費用は${man(exp)}。${residence ? '居住用財産の3,000万円特別控除の適用を受ける。' : '特別控除の適用はない。'}課税譲渡所得金額は何万円か。`,
    answer: ans, unit: '万円', tolerance: 0.01,
    formula: '課税譲渡所得 ＝ 譲渡価額 −（取得費 ＋ 譲渡費用）− 特別控除',
    steps: [
      known
        ? realCost < price * 0.05
          ? `実際の取得費${man(realCost)} ＜ 概算取得費（${man(price)}×5％＝${man(price * 0.05)}）→ 有利な概算取得費を使用`
          : `取得費：実額 ${man(realCost)}`
        : `取得費不明 → 概算取得費：${man(price)} × 5％ ＝ ${man(price * 0.05)}`,
      `譲渡所得：${man(price)} −（${man(cost)} ＋ ${man(exp)}）＝ ${man(gain)}`,
      residence ? `3,000万円特別控除後：${ans > 0 ? man(ans) : '0円'}` : `特別控除なし：${man(ans)}`,
    ],
  };
};

// ---------------- 保険金の計算 ----------------
const genInsurance = (r: Rand): CalcProblem => {
  if (r() < 0.5) {
    const heirs = int(r, 2, 5);
    const benefit = int(r, 10, 60) * 100;
    const ex = 500 * heirs;
    const ans = Math.max(0, benefit - ex);
    return {
      kind: 'insurance', field: 'risk', title: '死亡保険金の非課税',
      prompt: `被相続人が契約者・被保険者の生命保険から、相続人が死亡保険金を合計${man(benefit)}受け取った。法定相続人は${heirs}人（放棄者なし）。相続税の課税対象となる死亡保険金は何万円か。`,
      answer: ans, unit: '万円', tolerance: 0.01,
      formula: '非課税限度額 ＝ 500万円 × 法定相続人の数',
      steps: [`非課税限度額：500万円 × ${heirs}人 ＝ ${man(ex)}`, `${man(benefit)} − ${man(ex)} ＝ ${ans > 0 ? man(ans) : '0円（全額非課税）'}`],
    };
  }
  const paid = int(r, 20, 80) * 10;
  const recv = paid + int(r, 6, 40) * 10;
  const ichiji = Math.max(0, recv - paid - 50);
  const ans = ichiji / 2;
  return {
    kind: 'insurance', field: 'risk', title: '満期保険金（一時所得）',
    prompt: `契約者・受取人が本人の養老保険（保険期間10年）の満期保険金${man(recv)}を受け取った。払込保険料総額は${man(paid)}、他に一時所得はない。総所得金額に算入される額は何万円か。`,
    answer: ans, unit: '万円', tolerance: 0.01,
    formula: '一時所得 ＝ 収入 − 支出 − 特別控除50万円、総所得金額へは1/2を算入',
    steps: [`一時所得：${man(recv)} − ${man(paid)} − 50万円 ＝ ${man(ichiji)}`, `総所得金額への算入額：${man(ichiji)} × 1/2 ＝ ${man(ans)}`],
  };
};

// ---------------- 建蔽率・容積率 ----------------
const genFar = (r: Rand): CalcProblem => {
  const area = int(r, 8, 30) * 10;
  const designated = pick(r, [200, 300, 400, 500]);
  const road = pick(r, [4, 5, 6, 8]);
  const residential = r() < 0.6;
  const mult = residential ? 0.4 : 0.6;
  const roadRate = Math.round(road * mult * 100);
  const rate = Math.min(designated, roadRate);
  const ans = (area * rate) / 100;
  return {
    kind: 'far', field: 'estate', title: '容積率と延べ面積',
    prompt: `${residential ? '第一種住居地域' : '商業地域'}内の敷地${area}㎡（指定容積率${designated}％）。前面道路の幅員は${road}m、法定乗数は10分の${residential ? 4 : 6}。延べ面積の最高限度は何㎡か。`,
    answer: ans, unit: '㎡', tolerance: 0.01,
    formula: '前面道路幅員12m未満：min（指定容積率、幅員×法定乗数）',
    steps: [`前面道路による容積率：${road}m × ${mult * 10}/10 ＝ ${roadRate}％`, `指定容積率${designated}％と比べ低い方 → ${rate}％`, `${area}㎡ × ${rate}％ ＝ ${ans}㎡`],
  };
};

export const CALC_KINDS: CalcKind[] = [
  { id: 'coef', name: '6つの係数', field: 'life', emoji: '🧮', gen: genCoef },
  { id: 'bond', name: '債券利回り', field: 'finance', emoji: '📜', gen: genBond },
  { id: 'stock', name: '株式指標', field: 'finance', emoji: '📈', gen: genStock },
  { id: 'incometax', name: '所得税', field: 'tax', emoji: '💴', gen: genIncomeTax },
  { id: 'retire', name: '退職所得', field: 'tax', emoji: '🎓', gen: genRetire },
  { id: 'inherit', name: '相続税', field: 'inherit', emoji: '⚱️', gen: genInherit },
  { id: 'transfer', name: '不動産の譲渡所得', field: 'estate', emoji: '🏠', gen: genTransfer },
  { id: 'far', name: '容積率', field: 'estate', emoji: '📐', gen: genFar },
  { id: 'insurance', name: '保険金の計算', field: 'risk', emoji: '🛡️', gen: genInsurance },
];

/** 全角数字・カンマ・単位を許容して数値化 */
export function parseNumber(input: string): number | null {
  const s = input
    .replace(/[０-９．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s円万％%㎡倍]/g, '')
    .replace(/ー/g, '-');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const checkNumber = (input: string, answer: number, tolerance = 0.5) => {
  const n = parseNumber(input);
  return n !== null && Math.abs(n - answer) <= tolerance;
};
