export class ToastService {
  constructor({ enabled = true, logs } = {}) {
    this.enabled = enabled;
    this.logs = logs;
  }

  async show(payload = {}) {
    if (!this.enabled) {
      await this.logs?.warn?.('Toast skipped: notifications disabled', {
        alertId: payload.alertId ?? null,
      });
      return { ok: false, skipped: true };
    }

    if (this.logs?.info) {
      await this.logs.info('Toast requested', {
        alertId: payload.alertId ?? null,
        ruleId: payload.ruleId ?? null,
        issueId: payload.issueId ?? null,
        requestedAt: new Date().toISOString(),
      });
    }

    return { ok: true };
  }
}
