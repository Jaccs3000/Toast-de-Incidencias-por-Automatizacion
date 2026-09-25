self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};

  // An alert click must never activate or navigate the Jira Notifications tab.
  event.preventDefault();
  notification.close();

  if (!data.alertId || !data.readUrl) {
    return;
  }

  event.waitUntil(
    fetch(data.readUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.alertId }),
    }).catch(() => {
      // The UI polling can retry visibility, but the notification must not open a page.
    }),
  );
});
