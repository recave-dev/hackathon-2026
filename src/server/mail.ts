/**
 * Server-only: Bolek's mailbox over SMTP (nodemailer). Configuration comes
 * from SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.
 */

export const mailConfigured = (): boolean => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

export async function sendMail(msg: { to: string[]; subject: string; text: string }): Promise<{ messageId: string }> {
  if (!mailConfigured()) throw new Error('Skrzynka nie jest skonfigurowana (SMTP_* w .env).')
  const nodemailer = await import('nodemailer')
  const port = Number(process.env.SMTP_PORT ?? 465)
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: msg.to.join(', '),
    subject: msg.subject,
    text: msg.text,
  })
  return { messageId: String(info.messageId ?? '') }
}
