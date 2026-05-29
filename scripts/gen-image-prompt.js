#!/usr/bin/env node
/**
 * Note記事のサムネイル画像用Geminiプロンプトを自動生成し、クリップボードにコピーする
 *
 * 使い方:
 *   node scripts/gen-image-prompt.js 42
 *   node scripts/gen-image-prompt.js note-articles/42_hoseiyosan-kinri.md
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function findArticleFile(arg) {
  if (/^\d+$/.test(arg)) {
    const dir = path.join(process.cwd(), 'note-articles');
    const files = fs.readdirSync(dir);
    const n = parseInt(arg, 10);
    const match = files.find(f => {
      const prefix = f.match(/^(\d+)_/);
      return prefix && parseInt(prefix[1], 10) === n && f.endsWith('.md');
    });
    if (match) return path.join(dir, match);
    throw new Error(`記事番号 ${arg} に一致するmdファイルが見つかりません`);
  }
  const resolved = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  if (!fs.existsSync(resolved)) throw new Error(`ファイルが見つかりません: ${resolved}`);
  return resolved;
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : '（タイトル不明）';
}

function extractBody(content) {
  return content
    .replace(/^#{1,3}\s+/gm, '')        // 見出し記号を除去（テキストは残す）
    .replace(/\*\*(.+?)\*\*/g, '$1')     // **太字** → テキストだけ
    .replace(/^\s*---+\s*$/gm, '------') // --- 区切り線を統一
    .replace(/🏠 \*\*イエスコアで無料エリア診断\*\*/g, '') // フッター除去
    .replace(/👉 https?:\/\/\S+/g, '')   // URL除去
    .replace(/^#[^\S\n]+.*$/gm, '')      // ハッシュタグ行除去
    .replace(/\n{3,}/g, '\n\n')          // 連続空行を整理
    .trim();
}

function buildPrompt(title, body) {
  return `「${title}」←このタイトルをゴシック調文字で入れた、下記の内容に合うNote記事むけ画像を生成して欲しい。人物は不要。


------


${body}`;
}

// --- メイン ---
const arg = process.argv[2];
if (!arg) {
  console.error('使い方: node scripts/gen-image-prompt.js <記事番号 or mdファイルパス>');
  console.error('例: node scripts/gen-image-prompt.js 42');
  process.exit(1);
}

try {
  const filePath = findArticleFile(arg);
  const content = fs.readFileSync(filePath, 'utf8');
  const title = extractTitle(content);
  const body = extractBody(content);
  const prompt = buildPrompt(title, body);

  execSync('pbcopy', { input: prompt });

  const numMatch = path.basename(filePath).match(/^(\d+)/);
  const numStr = numMatch ? numMatch[1].padStart(3, '0') : arg.padStart(3, '0');

  console.log('━'.repeat(60));
  console.log('✅ プロンプトをクリップボードにコピーしました');
  console.log('━'.repeat(60));
  console.log(`📄 記事: ${path.basename(filePath)}`);
  console.log(`📝 タイトル: ${title}`);
  console.log(`💾 画像保存名: iescore記事${numStr}_image.png`);
  console.log('━'.repeat(60));
  console.log('\n👉 Gemini (gemini.google.com) を開いて Cmd+V で貼り付けてください');

  execSync('open https://gemini.google.com');
} catch (e) {
  console.error('エラー:', e.message);
  process.exit(1);
}
