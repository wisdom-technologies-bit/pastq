export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json' }, body: JSON.stringify({ sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'PastQ' }, to: [{ email: to }], subject, htmlContent: html, textContent: text }) })
  if (!response.ok) throw new Error('email_delivery_failed')
}
