export class GridsRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async list() {
    return this.persistence.query(`
      SELECT id, name, page_size, columns_json, conditions_json, is_visible, created, updated
      FROM GRID_DEFINITIONS
      ORDER BY name COLLATE NOCASE
    `);
  }

  async get(id) {
    const rows = await this.persistence.query(
      'SELECT id, name, page_size, columns_json, conditions_json, is_visible, created, updated FROM GRID_DEFINITIONS WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  }

  async save(grid) {
    await this.persistence.exec(`
      INSERT INTO GRID_DEFINITIONS (
        id, name, page_size, columns_json, conditions_json, is_visible, created, updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        page_size = excluded.page_size,
        columns_json = excluded.columns_json,
        conditions_json = excluded.conditions_json,
        is_visible = excluded.is_visible,
        updated = excluded.updated
    `, [
      grid.id,
      grid.name,
      grid.pageSize,
      JSON.stringify(grid.columns),
      JSON.stringify(grid.conditions),
      grid.visible === false ? 0 : 1,
      grid.created,
      grid.updated,
    ]);
  }

  async remove(id) {
    await this.persistence.exec('DELETE FROM GRID_DEFINITIONS WHERE id = ?', [id]);
  }
}
