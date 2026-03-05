import { handleMessage } from './message-handler';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessage);
  console.log('[StreamLens] Background script loaded');
});
