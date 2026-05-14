import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    const { name, email, message, location, buildingName, loanData } = await req.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const lines = [];
    lines.push(`お名前: ${name || '（未入力）'}`);
    lines.push(`返信先: ${email || '（未入力）'}`);
    if (location)      lines.push(`検索エリア: ${location}`);
    if (buildingName)  lines.push(`マンション名: ${buildingName}`);

    if (loanData) {
      lines.push('');
      lines.push('── 物件コストシミュレーター ──');
      if (loanData.price)      lines.push(`  物件価格: ${loanData.price.toLocaleString()}万円`);
      if (loanData.area)       lines.push(`  専有面積: ${loanData.area}㎡`);
      if (loanData.builtYear)  lines.push(`  築年: ${loanData.builtYear}年`);
      if (loanData.down)       lines.push(`  頭金: ${loanData.down.toLocaleString()}万円`);
      if (loanData.loanAmount) lines.push(`  借入額: ${loanData.loanAmount.toLocaleString()}万円`);
      if (loanData.totalMisc)  lines.push(`  諸費用: 約${loanData.totalMisc.toLocaleString()}万円`);
      if (loanData.monthlyVar) lines.push(`  月返済（変動${loanData.varRate}%／${loanData.varYears}年）: ${loanData.monthlyVar.toLocaleString()}円`);
      if (loanData.monthlyFix) lines.push(`  月返済（固定${loanData.fixRate}%／${loanData.fixYears}年）: ${loanData.monthlyFix.toLocaleString()}円`);
      if (loanData.mgmt)       lines.push(`  管理費: ${loanData.mgmt.toLocaleString()}円/月`);
      if (loanData.reserve)    lines.push(`  修繕積立金: ${loanData.reserve.toLocaleString()}円/月`);
    }

    lines.push('');
    lines.push('──────────────────');
    lines.push(message.trim());
    lines.push('──────────────────');
    lines.push('');
    lines.push(`送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

    const subject = `【イエスコア】コメントが届きました${location ? `（${location}）` : ''}`;

    await transporter.sendMail({
      from: '"イエスコア フィードバック" <noreply@iescore.com>',
      to: 'takuya.kishimoto@iescore.com',
      replyTo: email || undefined,
      subject,
      text: lines.join('\n'),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('feedback email error:', e);
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 });
  }
}
