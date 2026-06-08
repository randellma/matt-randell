const KEY = 'inventory-secret';

export interface SecretStore {
  get(): string | null;
  set(secret: string): void;
}

export class LocalStorageSecretStore implements SecretStore {
  get(): string | null {
    return localStorage.getItem(KEY);
  }

  set(secret: string): void {
    localStorage.setItem(KEY, secret);
  }
}
