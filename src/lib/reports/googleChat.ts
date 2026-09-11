type GoogleChatWebhookResponse = {
  name?: string;
};

export async function sendGoogleChatMessage(
  text: string
): Promise<GoogleChatWebhookResponse> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("GOOGLE_CHAT_WEBHOOK_URL is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new Error(
      `Google Chat webhook failed with status ${response.status}: ${responseBody}`
    );
  }

  return (await response.json()) as GoogleChatWebhookResponse;
}
