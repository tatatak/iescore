#!/usr/bin/env node
/**
 * Note記事からXの投稿スレッドと検索・返信テンプレートを自動生成する
 *
 * 使い方:
 *   node scripts/gen-x-post.js 42          # 記事番号
 *   node scripts/gen-x-post.js             # 記事を選ばず「今日の発信セット」を出力
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ---- 検索ワードマスター（Gemini推奨の検索軸） ----
const SEARCH_SETS = [
  { theme: '地盤・液状化',     words: ['地盤 土地 不安', '液状化 リスク', '地盤調査 結果 心配'] },
  { theme: 'ハザードマップ',   words: ['ハザードマップ 見方 分からない', '洪水リスク 家 大丈夫か', '土砂災害 近い 不安'] },
  { theme: '成約価格・相場',   words: ['マンション 適正価格 分からない', '中古マンション 高い 相場', '不動産 割高 損した'] },
  { theme: '住宅ローン・金利', words: ['変動金利 不安 上がる', '住宅ローン 返済 きつい', '固定金利 変動 迷ってる'] },
  { theme: '補正予算・経済',   words: ['金利 上昇 マイホーム 影響', '国債 住宅ローン 関係', '物価高 家購入 タイミング'] },
];

// ---- 返信テンプレートマスター ----
const REPLY_TEMPLATES = [
  {
    trigger: '地盤・液状化',
    template: `液状化リスクは地名や見た目だけでは判断できないんですよね。
防災科研J-SHISの「表層地盤増幅率」を見ると、同じ市内でも数倍の差があります。
住所を入れるだけで地盤スコアを確認できる無料ツールを作ったので、よかったらどうぞ👇
https://iescore.com`,
  },
  {
    trigger: 'ハザードマップ',
    template: `ハザードマップ、実は「色がついていないから安全」ではないんです。
浸水0〜0.5m未満でも家財がほぼ全滅するケースがあります。
住所を入れると洪水・土砂・津波リスクをまとめてスコア化できる無料ツールを作ったので参考に👇
https://iescore.com`,
  },
  {
    trigger: '相場・成約価格',
    template: `国交省の実際の成約価格データで確認するのが一番正確です。
同じ駅・同じ築年数でも㎡単価で30〜40万円の差があることも珍しくないので。
住所や駅名を入れると過去の成約価格をスコア表示できる無料ツール、よかったらどうぞ👇
https://iescore.com`,
  },
  {
    trigger: '変動金利・住宅ローン',
    template: `5年ルール・125%ルールの盲点で、返済額が変わらないまま未払い利息が積み上がるケースがあります。
まずエリアの適正価格を把握して「借りすぎない」ことが金利リスクへの最初の防御になります。
住所から成約価格・ハザード・地盤をまとめて確認できる無料ツール👇
https://iescore.com`,
  },
];

// ---- ユーティリティ ----
function findArticleFile(arg) {
  const dir = path.join(process.cwd(), 'note-articles');
  if (!arg) {
    // 引数なし: 最新のmdファイルを使用
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.md') && /^\d/.test(f))
      .sort()
      .reverse();
    if (!files.length) throw new Error('note-articles/ にmdファイルが見つかりません');
    return path.join(dir, files[0]);
  }
  if (/^\d+$/.test(arg)) {
    const n = parseInt(arg, 10);
    const match = fs.readdirSync(dir).find(f => {
      const prefix = f.match(/^(\d+)_/);
      return prefix && parseInt(prefix[1], 10) === n && f.endsWith('.md');
    });
    if (match) return path.join(dir, match);
    throw new Error(`記事番号 ${arg} に一致するファイルが見つかりません`);
  }
  const resolved = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  if (!fs.existsSync(resolved)) throw new Error(`ファイルが見つかりません: ${resolved}`);
  return resolved;
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)/m);
  return m ? m[1].replace(/\*\*/g, '').trim() : '';
}

// 記事内の「数字＋単位」を含む最初の文を抽出（インパクト用）
// フッター除去後のコンテンツを渡すこと
function extractKeyFact(content) {
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  // 億・兆・%・bpなど「大きな数」を含む行を優先
  const highImpact = lines.find(l =>
    /[0-9０-９]+[億兆%％bpBP]/.test(l) &&
    l.length > 20 && l.length < 120 &&
    !l.includes('iescore') && !l.includes('https')
  );
  if (highImpact) return highImpact.replace(/\*\*/g, '').replace(/^[-・]\s*/, '').trim();
  // フォールバック: 万・倍・円を含む行
  const fallback = lines.find(l =>
    /[0-9０-９]+[万倍円]/.test(l) &&
    l.length > 20 && l.length < 120 &&
    !l.includes('iescore') && !l.includes('https')
  );
  return fallback ? fallback.replace(/\*\*/g, '').replace(/^[-・]\s*/, '').trim() : null;
}

// 「まとめ」セクションを抽出
function extractSummary(content) {
  const m = content.match(/^#{1,3}\s*まとめ[^\n]*\n+([\s\S]+?)(?=\n#{1,3}|\n---|\n#|$)/m);
  if (!m) return null;
  const lines = m[1].split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.slice(0, 3).map(l => l.replace(/\*\*/g, '').replace(/^[-・]\s*/, '').trim()).join('\n');
}

// フッター（イエスコア共通PR文）を除去して本文のみ返す
function stripFooter(content) {
  return content.split(/\n---+\n🏠/)[0];
}

// 記事のテーマから返信テンプレートを選ぶ
function pickReplyTemplate(content, title) {
  const body = stripFooter(content);
  // タイトル優先、次に本文（フッター除去後）
  if (/液状化|地盤/.test(title)) return REPLY_TEMPLATES[0];
  if (/ハザード|洪水|浸水|津波/.test(title)) return REPLY_TEMPLATES[1];
  if (/成約価格|相場|適正/.test(title)) return REPLY_TEMPLATES[2];
  if (/金利|ローン|変動|固定|補正|国債/.test(title)) return REPLY_TEMPLATES[3];
  if (/液状化|地盤/.test(body)) return REPLY_TEMPLATES[0];
  if (/ハザード|洪水|浸水|津波/.test(body)) return REPLY_TEMPLATES[1];
  if (/成約価格|相場|適正/.test(body)) return REPLY_TEMPLATES[2];
  if (/金利|ローン|変動|固定|補正|国債/.test(body)) return REPLY_TEMPLATES[3];
  return REPLY_TEMPLATES[2]; // デフォルト: 相場テンプレート
}

// 記事テーマに近い検索セットを選ぶ
function pickSearchSet(content, title) {
  const body = stripFooter(content);
  if (/液状化|地盤/.test(title)) return SEARCH_SETS[0];
  if (/ハザード|洪水/.test(title)) return SEARCH_SETS[1];
  if (/成約価格|相場/.test(title)) return SEARCH_SETS[2];
  if (/金利|ローン|補正|国債/.test(title)) return SEARCH_SETS.slice(3);
  if (/液状化|地盤/.test(body)) return SEARCH_SETS[0];
  if (/ハザード|洪水/.test(body)) return SEARCH_SETS[1];
  if (/成約価格|相場/.test(body)) return SEARCH_SETS[2];
  if (/金利|ローン|補正|国債/.test(body)) return SEARCH_SETS.slice(3);
  return [SEARCH_SETS[1], SEARCH_SETS[2]];
}

function truncate(str, max) {
  return str && str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ---- スレッド生成 ----
function buildThread(title, keyFact, summary, noteUrl) {
  const hook = truncate(title, 100);

  const post1 = `【知らないと損する不動産の話】

${hook}

→ 数千万の買い物で、見落としがちなリスクを整理しました🧵(1/3)`;

  const post2_lines = [];
  if (keyFact) post2_lines.push(`📌 ${truncate(keyFact, 100)}`);
  if (summary) {
    summary.split('\n').slice(0, 2).forEach(l => {
      if (l.trim()) post2_lines.push(`・${truncate(l, 80)}`);
    });
  }
  if (!post2_lines.length) post2_lines.push('詳しくは下のリンクから記事をどうぞ。');
  const post2 = post2_lines.join('\n') + '\n\n(2/3)';

  const post3 = `この問題、住所を入力するだけで確認できます。

✅ 地盤スコア
✅ ハザードリスク（洪水・土砂・津波）
✅ 過去の成約価格
✅ 利便性

すべて公的データ・完全無料👇
https://iescore.com

${noteUrl ? `📝 詳細記事: ${noteUrl}` : ''}
(3/3)`;

  return [post1, post2, post3];
}

// ---- メイン ----
const arg = process.argv[2];

try {
  const filePath = findArticleFile(arg);
  const content = fs.readFileSync(filePath, 'utf8');
  const title = extractTitle(content);
  const keyFact = extractKeyFact(content);
  const summary = extractSummary(content);
  const replyTpl = pickReplyTemplate(content, title);
  const searchSets = [].concat(pickSearchSet(content, title));
  const thread = buildThread(title, keyFact, summary, '');

  // ---- クリップボード: スレッド投稿文 ----
  const clipText = thread.map((p, i) => `--- ポスト${i + 1}/3 ---\n${p}`).join('\n\n');
  execSync('pbcopy', { input: clipText });

  // ---- 出力 ----
  const hr = '━'.repeat(60);
  console.log(hr);
  console.log('📋 X投稿スレッド（クリップボードにコピー済み）');
  console.log(hr);
  thread.forEach((p, i) => {
    console.log(`\n【ポスト ${i + 1}/3】（${p.length}文字）`);
    console.log(p);
    console.log();
  });

  console.log(hr);
  console.log('🔍 今日の検索ワード（X検索窓にコピペして悩んでいる人を探す）');
  console.log(hr);
  searchSets.forEach(s => {
    console.log(`\n▶ ${s.theme}`);
    s.words.forEach(w => console.log(`  → "${w}"`));
  });

  console.log('\n' + hr);
  console.log('💬 返信テンプレート（「' + replyTpl.trigger + '」系の投稿に使う）');
  console.log(hr);
  console.log(replyTpl.template);

  console.log('\n' + hr);
  console.log('👉 次のアクション');
  console.log('  1. Cmd+V でスレッドを X に貼り付けて投稿');
  console.log('  2. 上の検索ワードで悩んでいる人を探す');
  console.log('  3. 見つけたら返信テンプレートを参考にリプライ');
  console.log(hr);

  execSync('open https://x.com/compose/post');
} catch (e) {
  console.error('エラー:', e.message);
  process.exit(1);
}
