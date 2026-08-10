const defaultSyncStatusId = 'singleton';

export class SyncStatusRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async ensureRow() {
    const rows = await this.persistence.query(
      'SELECT id FROM SYNC_STATUS WHERE id = ?',
      [defaultSyncStatusId],
    );

    if (rows.length > 0) {
      return;
    }

    await this.persistence.exec(
      `
      INSERT INTO SYNC_STATUS (
        id,
        last_status,
        last_started_at,
        last_finished_at,
        last_success_at,
        last_error_message,
        is_running,
        is_canceling,
        next_sync_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        defaultSyncStatusId,
        'Sincronización no iniciada',
        null,
        null,
        null,
        null,
        0,
        0,
        null,
      ],
    );
  }

  async getCurrent() {
    await this.ensureRow();

    const rows = await this.persistence.query(
      'SELECT * FROM SYNC_STATUS WHERE id = ?',
      [defaultSyncStatusId],
    );

    return rows[0] ?? null;
  }

  async updateStatus(partial) {
    await this.ensureRow();

    const current = await this.getCurrent();
    const next = { ...current, ...partial };

    await this.persistence.exec(
      `
      UPDATE SYNC_STATUS
      SET
        last_status = ?,
        last_started_at = ?,
        last_finished_at = ?,
        last_success_at = ?,
        last_error_message = ?,
        is_running = ?,
        is_canceling = ?,
        next_sync_at = ?
      WHERE id = ?
      `,
      [
        next.last_status ?? null,
        next.last_started_at ?? null,
        next.last_finished_at ?? null,
        next.last_success_at ?? null,
        next.last_error_message ?? null,
        next.is_running ? 1 : 0,
        next.is_canceling ? 1 : 0,
        next.next_sync_at ?? null,
        defaultSyncStatusId,
      ],
    );
  }
}
