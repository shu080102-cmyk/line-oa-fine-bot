import { messagingApi } from '@line/bot-sdk';
import { config } from '../config';
export const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineToken || 'dummy' });
export async function pushGroup(messages: messagingApi.Message[]) {
  if (!config.lineToken || !config.groupId) { console.log('[dry-run push]', JSON.stringify(messages)); return; }
  await lineClient.pushMessage({ to: config.groupId, messages });
}
export async function pushAdmin(messages: messagingApi.Message[]) {
  if (!config.lineToken || !config.adminIds.length) { console.log('[dry-run pushAdmin]', JSON.stringify(messages)); return; }
  for (const to of config.adminIds) await lineClient.pushMessage({ to, messages });
}
