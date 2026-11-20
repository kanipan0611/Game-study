import type { FieldId, LawMeta } from '../types';

export interface TopicNode {
  id: string;
  name: string;
  grade: 3 | 2;
  /** 前提となるノード（スキルツリーの枝） */
  requires: string[];
}

export interface FieldDef {
  id: FieldId;
  no: number;
  name: string;
  dungeon: string;
  boss: { name: string; emoji: string; hp: number; taunt: string };
  emoji: string;
  color: string;
  /** 世界地図上の座標（%） */
  map: { x: number; y: number };
  topics: TopicNode[];
}

export const FIELDS: FieldDef[] = [
  {
    id: 'life', no: 1, name: 'ライフプランニング', dungeon: '時の砂の神殿', emoji: '🏛️', color: '#4fa3ff',
    map: { x: 22, y: 30 },
    boss: { name: '浪費竜ガルドラ', emoji: '🐉', hp: 6, taunt: '計画なき者に未来の金貨はない！' },
    topics: [
      { id: 'life-ethics', name: 'FPの職業倫理と関連法規', grade: 3, requires: [] },
      { id: 'life-coef', name: '6つの係数', grade: 3, requires: ['life-ethics'] },
      { id: 'life-cf', name: 'キャッシュフロー表', grade: 3, requires: ['life-ethics'] },
      { id: 'life-loan', name: '住宅ローン', grade: 3, requires: ['life-coef'] },
      { id: 'life-edu', name: '教育資金計画', grade: 3, requires: ['life-cf'] },
      { id: 'life-shakai', name: '公的医療保険', grade: 3, requires: ['life-cf'] },
      { id: 'life-koyo', name: '雇用保険・労災保険', grade: 3, requires: ['life-shakai'] },
      { id: 'life-pension', name: '公的年金', grade: 3, requires: ['life-shakai'] },
      { id: 'life-pension2', name: '年金の繰上げ・繰下げ（応用）', grade: 2, requires: ['life-pension'] },
      { id: 'life-dc', name: '確定拠出年金', grade: 2, requires: ['life-pension'] },
      { id: 'life-corpfin', name: '中小法人の資金計画', grade: 2, requires: ['life-cf'] },
    ],
  },
  {
    id: 'risk', no: 2, name: 'リスク管理', dungeon: '守護の城塞', emoji: '🛡️', color: '#5fd38d',
    map: { x: 50, y: 18 },
    boss: { name: '災厄の騎士ハザード', emoji: '🗡️', hp: 6, taunt: '備えなき者を災いは選ぶ…' },
    topics: [
      { id: 'risk-basic', name: '保険の基本と契約者保護', grade: 3, requires: [] },
      { id: 'risk-life', name: '生命保険商品', grade: 3, requires: ['risk-basic'] },
      { id: 'risk-deduct', name: '保険料控除', grade: 3, requires: ['risk-life'] },
      { id: 'risk-third', name: '第三分野の保険', grade: 3, requires: ['risk-life'] },
      { id: 'risk-nonlife', name: '損害保険（火災・地震）', grade: 3, requires: ['risk-basic'] },
      { id: 'risk-auto', name: '自動車・傷害・賠償責任保険', grade: 3, requires: ['risk-nonlife'] },
      { id: 'risk-tax', name: '保険金の課税関係', grade: 2, requires: ['risk-deduct'] },
      { id: 'risk-corp', name: '法人契約の保険', grade: 2, requires: ['risk-tax'] },
    ],
  },
  {
    id: 'finance', no: 3, name: '金融資産運用', dungeon: '黄金の大迷宮', emoji: '💰', color: '#f2c14e',
    map: { x: 78, y: 30 },
    boss: { name: '相場魔人ボラティス', emoji: '👹', hp: 6, taunt: '分散を知らぬ者よ、我が値動きに沈め！' },
    topics: [
      { id: 'fin-econ', name: '経済指標とマーケット', grade: 3, requires: [] },
      { id: 'fin-deposit', name: '預金とセーフティネット', grade: 3, requires: ['fin-econ'] },
      { id: 'fin-bond', name: '債券', grade: 3, requires: ['fin-econ'] },
      { id: 'fin-stock', name: '株式と投資指標', grade: 3, requires: ['fin-econ'] },
      { id: 'fin-fund', name: '投資信託', grade: 3, requires: ['fin-stock'] },
      { id: 'fin-nisa', name: 'NISA・金融商品の税金', grade: 3, requires: ['fin-fund'] },
      { id: 'fin-portfolio', name: 'ポートフォリオ理論', grade: 2, requires: ['fin-fund'] },
    ],
  },
  {
    id: 'tax', no: 4, name: 'タックスプランニング', dungeon: '徴税の塔', emoji: '🗼', color: '#e7745b',
    map: { x: 22, y: 70 },
    boss: { name: '税吏王タクサリオン', emoji: '🤴', hp: 6, taunt: '所得を区分できぬ者に控除はやらぬ！' },
    topics: [
      { id: 'tax-basic', name: '所得税の仕組み', grade: 3, requires: [] },
      { id: 'tax-income', name: '10種類の所得', grade: 3, requires: ['tax-basic'] },
      { id: 'tax-retire', name: '退職所得', grade: 3, requires: ['tax-income'] },
      { id: 'tax-deduct', name: '所得控除', grade: 3, requires: ['tax-income'] },
      { id: 'tax-calc', name: '税額計算と申告', grade: 3, requires: ['tax-deduct'] },
      { id: 'tax-offset', name: '損益通算（応用）', grade: 2, requires: ['tax-income'] },
      { id: 'tax-corp', name: '法人税・消費税', grade: 2, requires: ['tax-calc'] },
    ],
  },
  {
    id: 'estate', no: 5, name: '不動産', dungeon: '大地の遺跡', emoji: '🏰', color: '#b48cff',
    map: { x: 50, y: 82 },
    boss: { name: '石像巨兵ゴーレムランド', emoji: '🗿', hp: 6, taunt: '容積も建蔽も知らぬ者は通さぬ！' },
    topics: [
      { id: 'est-register', name: '不動産登記と価格', grade: 3, requires: [] },
      { id: 'est-contract', name: '売買契約・借地借家法', grade: 3, requires: ['est-register'] },
      { id: 'est-law', name: '建築基準法', grade: 3, requires: ['est-register'] },
      { id: 'est-tax', name: '不動産の税金', grade: 3, requires: ['est-law'] },
      { id: 'est-transfer', name: '譲渡所得の特例', grade: 2, requires: ['est-tax'] },
      { id: 'est-invest', name: '不動産投資の判断', grade: 2, requires: ['est-transfer'] },
    ],
  },
  {
    id: 'inherit', no: 6, name: '相続・事業承継', dungeon: '継承の霊廟', emoji: '⚱️', color: '#ff8fb1',
    map: { x: 78, y: 70 },
    boss: { name: '冥府の執行者ネクロス', emoji: '💀', hp: 6, taunt: '相続人の順位すら知らぬのか？' },
    topics: [
      { id: 'inh-law', name: '相続の基本（民法）', grade: 3, requires: [] },
      { id: 'inh-will', name: '遺言と遺留分', grade: 3, requires: ['inh-law'] },
      { id: 'inh-tax', name: '相続税の計算', grade: 3, requires: ['inh-law'] },
      { id: 'inh-gift', name: '贈与税', grade: 3, requires: ['inh-law'] },
      { id: 'inh-value', name: '財産評価と小規模宅地等', grade: 2, requires: ['inh-tax'] },
      { id: 'inh-biz', name: '事業承継', grade: 2, requires: ['inh-value'] },
    ],
  },
];


export const FIELD_MAP: Record<FieldId, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.id, f]),
) as Record<FieldId, FieldDef>;

export const ALL_TOPICS = FIELDS.flatMap((f) => f.topics.map((t) => ({ ...t, field: f.id })));

/** ステージ定義 */
export const STAGES = [
  { kind: 'basic', name: '基礎ステージ', grade: 3, desc: 'FP3級の基礎知識' },
  { kind: 'calc', name: '計算ステージ', grade: 3, desc: '頻出計算を手を動かして' },
  { kind: 'review', name: '総合演習', grade: 3, desc: '分野内のランダム演習（3級＋解放済み2級）' },
  { kind: 'boss', name: 'ボス戦', grade: 3, desc: 'HPを削り切れ！ ミス3回で敗北' },
  { kind: 'applied', name: '応用ステージ', grade: 2, desc: 'FP2級レベル。基礎ステージ制覇で解放' },
] as const;

// ------------------------------------------------------------
// 法令メタ（適用年度・根拠・出典）
// 2026年6月〜2027年5月の試験は 2026年4月1日 法令基準日。
// ------------------------------------------------------------
export const BASIS_DATE = '2026-04-01';

export const law = (basis: string, source: string, status: LawMeta['status'] = 'verified', note?: string): LawMeta => ({
  basisDate: BASIS_DATE,
  basis,
  source,
  status,
  note,
});

export const SRC = {
  nta: '国税庁「タックスアンサー」',
  nenkin: '日本年金機構',
  mhlw: '厚生労働省',
  kyoukai: '全国健康保険協会（協会けんぽ）',
  fsa: '金融庁',
  dic: '預金保険機構',
  mlit: '国土交通省',
  minpo: '民法（e-Gov法令検索）',
  jafp: '日本FP協会「試験概要」',
  kinzai: '金融財政事情研究会「試験概要」',
  math: '数学的定義（制度改正の影響なし）',
};
