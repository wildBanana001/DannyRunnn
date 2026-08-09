export function isMysqlBackedAdminOrderRequest(path: string, method: string) {
  if (method === 'GET') {
    return path === '/admin-mini/registrations'
      || path.startsWith('/admin-mini/registrations/')
      || path === '/admin-mini/fulfillment-tasks';
  }

  if (method === 'POST') {
    return /^\/admin-mini\/fulfillment-tasks\/(shop|activity)\/[^/]+\/complete$/.test(path);
  }

  return false;
}
