export class ToastService {
  constructor({ enabled = true, logs } = {}) {
    this.enabled = enabled;
    this.logs = logs;
  }

  async show(payload = {}) {
    if (!this.enabled) {
      return { ok: false, skipped: true };
    }

    if (this.logs?.info) {
      await this.logs.info('Toast requested', payload);
    }

    return { ok: true };
  }
}
