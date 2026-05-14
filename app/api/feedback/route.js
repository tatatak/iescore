import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req) {
  try {
    const { name, email, message, location } = await req.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 });
    }

    const locationLine = location ? `\n検索エリア: ${location}` : '';
    const nameLine = name ? `お名前: ${name}` : 'お名前: （未入力）';
    const emailLine = email ? `返信先: ${email}` : '返信先: （未入力）';

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'イエスコア フィードバック <feedback@iescore.com>',
      to: 'takuya.kishimoto@iescore.com',
      replyTo: email || undefined,
      subject: `【イエスコア】コメントが届きました${location ? `（${location}）` : ''}`,
      text: `${nameLine}\n${emailLine}${locationLine}\n\n---\n${message.trim()}\n---\n\n送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('feedback email error:', e);
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 });
  }
}
