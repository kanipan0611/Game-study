import { useState } from 'react';
import type { FieldId } from '../types';
import { useGame } from '../state/store';
import { FIELD_MAP } from '../data/fields';
import { bossUnlocked, shuffle, stagePool } from '../engine/stages';
import { QuestionCard } from '../components/QuestionCard';
import { Back, Bar, Celebrate } from '../components/ui';
import { go } from '../router';

const PLAYER_HP = 3;

export function Boss({ field, grade }: { field: FieldId; grade: 2 | 3 }) {
  const { state, questions, actions } = useGame();
  const f = FIELD_MAP[field];
  const maxHp = grade === 3 ? f.boss.hp : f.boss.hp + 2;
  const [deck] = useState(() => {
    const pool = stagePool(field, 'boss', questions, state);
    // 2級ボスは2級問題を優先、3級ボスは3級のみ
    const main = pool.filter((q) => q.grade === grade);
    const sub = grade === 2 ? pool.filter((q) => q.grade === 3) : [];
    return [...shuffle(main), ...shuffle(sub)].slice(0, maxHp + PLAYER_HP + 2);
  });
  const [i, setI] = useState(0);
  const [hp, setHp] = useState(maxHp);
  const [php, setPhp] = useState(PLAYER_HP);
  const [combo, setCombo] = useState(0);
  const [anim, setAnim] = useState<'' | 'hit'>('');
  const [slash, setSlash] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [lastDmg, setLastDmg] = useState<{ dmg: number; xp: number } | null>(null);
  const [end, setEnd] = useState<null | 'win' | 'lose'>(null);
  const [rewardXp, setRewardXp] = useState(0);
  const unlocked = bossUnlocked(field, grade, questions, state) || !!state.bossCleared[`${field}-${grade}`];

  if (!unlocked) {
    return (
      <div>
        <Back to={`dungeon/${field}`} />
        <div className="panel">このボスはまだ封印されています。ステージを制覇して封印を解きましょう。</div>
      </div>
    );
  }

  const q = deck[i];
  const outOfCards = !q && !end;

  const onSubmit = (correct: boolean) => {
    setAnswered(true);
    const nc = correct ? combo + 1 : 0;
    setCombo(nc);
    const out = actions.answer(q, correct, { combo: nc, mode: 'boss' });
    if (correct) {
      const dmg = nc >= 3 ? 2 : 1;
      const nh = Math.max(0, hp - dmg);
      setHp(nh);
      setAnim('hit');
      setSlash((x) => x + 1);
      setTimeout(() => setAnim(''), 450);
      setLastDmg({ dmg, xp: out.xp });
    } else {
      setPhp((p) => p - 1);
      setLastDmg({ dmg: 0, xp: 0 });
    }
  };

  const next = () => {
    if (hp <= 0) {
      setRewardXp(actions.bossVictory(field, grade));
      setEnd('win');
      return;
    }
    if (php <= 0) {
      setEnd('lose');
      return;
    }
    setI(i + 1);
    setAnswered(false);
    setLastDmg(null);
  };

  if (end === 'win') {
    return (
      <Celebrate emoji="👑" title={`${f.boss.name} 撃破！`} onClose={() => go(`dungeon/${field}`)}>
        <div>FP{grade}級 {f.name}のボスを倒した！</div>
        {rewardXp > 0 ? <div className="xpgain">初回撃破ボーナス +{rewardXp} XP</div> : <div className="muted small">再戦のため撃破ボーナスはありません</div>}
        {grade === 3 && rewardXp > 0 && <div className="infobox">📕 2級「応用ステージ」が解放された！</div>}
      </Celebrate>
    );
  }

  if (end === 'lose' || outOfCards) {
    return (
      <div>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 60 }}>💫</div>
          <h2>{outOfCards ? '時間切れ…ボスは撤退した' : '力尽きた…'}</h2>
          <p className="muted">間違えた問題は復習リストに入りました。解説を読み直してから再挑戦しよう。</p>
          <div className="grid2">
            <button className="btn ghost" onClick={() => go(`dungeon/${field}`)}>撤退する</button>
            <button className="btn" onClick={() => window.location.reload()}>再挑戦</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Back to={`dungeon/${field}`} label="撤退" />
      <div className="arena">
        {slash > 0 && anim === 'hit' && <div className="slash" key={slash} />}
        <div className="small" style={{ fontWeight: 800 }}>
          {grade === 2 ? '真・' : ''}
          {f.boss.name}
        </div>
        <div style={{ margin: '4px auto 8px', maxWidth: 260 }}>
          <Bar value={hp / maxHp} tone="red" />
          <div className="small muted">
            HP {hp}/{maxHp}
          </div>
        </div>
        <div className={`boss ${anim} ${hp <= 0 ? 'dead' : ''}`}>{f.boss.emoji}</div>
        <div className="taunt">「{f.boss.taunt}」</div>
        <div className="row between" style={{ marginTop: 6 }}>
          <span className="hearts">{'❤️'.repeat(Math.max(0, php))}{'🖤'.repeat(PLAYER_HP - Math.max(0, php))}</span>
          {combo >= 2 && <span className={`combo ${combo >= 3 ? 'big' : ''}`}>🔥{combo} {combo >= 3 ? '会心！' : ''}</span>}
        </div>
      </div>
      <QuestionCard
        key={q.id}
        q={q}
        onSubmit={onSubmit}
        xpNote={
          lastDmg && (
            <div style={{ textAlign: 'center', fontWeight: 800 }}>
              {lastDmg.dmg > 0 ? `⚔️ ${lastDmg.dmg}ダメージ！${lastDmg.dmg > 1 ? '（3連続正解の会心の一撃）' : ''}` : '💥 ボスの反撃！ HP−1'}
              {lastDmg.xp > 0 && <span className="xpgain"> +{lastDmg.xp} XP</span>}
            </div>
          )
        }
        footer={
          answered && (
            <button className="btn block" style={{ marginTop: 14 }} onClick={next}>
              {hp <= 0 ? 'とどめを刺す！' : php <= 0 ? '……' : '次のターンへ ▶'}
            </button>
          )
        }
      />
    </div>
  );
}
