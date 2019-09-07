import {IncomingWebhook, IncomingWebhookSendArguments} from '@slack/client';

class Slack {
  private webhook: IncomingWebhook;

  constructor(webhookUrl: string) {
    this.webhook = new IncomingWebhook(webhookUrl);
  }

  async postMessage(message: IncomingWebhookSendArguments) {
    return await this.webhook.send(message);
  }
}

export default Slack;
