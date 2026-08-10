export class SettingsRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async get(key) {
    const rows = await this.persistence.query(
      'SELECT key, value, updated FROM SETTINGS WHERE key = ?',
      [key],
    );

    return rows[0] ?? null;
  }

  async upsert(key, value, updated) {
    await this.persistence.exec(
      `
      INSERT INTO SETTINGS (key, value, updated)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated = excluded.updated
      `,
      [key, value, updated],
    );
  }
}
