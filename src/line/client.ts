import { messagingApi } from '@line/bot-sdk';
import { config } from '../config';
export const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineToken || 'dummy' });
export async function pushGroup(messages: messagingApi.Message[]) {
  if (!config.lineToken || !config.groupId) { console.log('[dry-run push]', JSON.stringify(messages)); return; }
  await lineClient.pushMessage({ to: config.groupId, messages });
}
