// Son mesajdaki yapım kartı normalde o başlık hakkındaki cevabı zorlar.
// Benzer öneri isteğinde aynı kart yalnız referanstır; öneri türü serbest kalır.
export function resolveAiMediaContext(messages, lastUserMessage) {
  const attachment = lastUserMessage?.attachment;
  const similarityRequest = Boolean(attachment?.title && attachment.referenceOnly);
  const targetMedia = attachment?.title && !attachment.referenceOnly ? attachment : null;
  const focusMedia = targetMedia
    ? null
    : [...(messages || [])].reverse().find((item) => item.role === "user" && item.attachment?.title)?.attachment || null;
  return { targetMedia, focusMedia, similarityRequest };
}
