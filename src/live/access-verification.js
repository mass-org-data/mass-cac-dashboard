export const isAuthorizationFailure = error => [401, 403].includes(Number(error?.status));

export function createAccessVerificationGate({root, onRestore, onRetry, onBlock}) {
  let blocked = false;
  return Object.freeze({
    block() {
      if (blocked) return;
      blocked = true;
      onBlock?.();
      const main = document.createElement('main');
      main.className = 'auth-page';
      const section = document.createElement('section');
      section.className = 'card auth-card';
      const heading = document.createElement('h1');
      heading.textContent = 'Rechecking your access';
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = 'The connection could not be verified. Protected records are hidden while the application retries.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry now';
      retry.addEventListener('click', onRetry);
      section.append(heading, status, retry);
      main.append(section);
      root.replaceChildren(main);
    },
    restore() {
      if (!blocked) return;
      blocked = false;
      onRestore();
    },
  });
}
