import assert from 'node:assert/strict';
import test from 'node:test';
import { Persistence } from '../src/main/persistence/persistence.js';

test('recovers a stale cancellation left after the synchronization process stopped', async () => {
  const persistence = new Persistence(':memory:');
  await persistence.initialize();

  await persistence.syncStatus.updateStatus({
    last_status: 'Deteniendo sincronizacion...',
    is_running: false,
    is_canceling: true,
  });

  const recoveredAt = '2026-09-02T21:10:00.000Z';
  const recovery = await persistence.syncStatus.recoverInterruptedState(recoveredAt);

  assert.equal(recovery.recovered, true);
  assert.equal(Number(recovery.status.is_running), 0);
  assert.equal(Number(recovery.status.is_canceling), 0);
  assert.equal(recovery.status.last_status, 'Sincronizacion detenida.');
  assert.equal(recovery.status.last_finished_at, recoveredAt);

  await persistence.close();
});

test('does not modify a completed synchronization state', async () => {
  const persistence = new Persistence(':memory:');
  await persistence.initialize();

  await persistence.syncStatus.updateStatus({
    last_status: 'Sincronizado correctamente.',
    is_running: false,
    is_canceling: false,
  });

  const recovery = await persistence.syncStatus.recoverInterruptedState();

  assert.equal(recovery.recovered, false);
  assert.equal(recovery.status.last_status, 'Sincronizado correctamente.');

  await persistence.close();
});
