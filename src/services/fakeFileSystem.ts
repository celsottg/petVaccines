// Test-only. A small in-memory stand-in for the `expo-file-system` classes this
// app uses (`File`, `Directory`, `Paths`), because the real module is native.
// Tests mount it with `jest.mock('expo-file-system', () => require('./fakeFileSystem').fakeModule)`.

type Part = string | { uri: string };

const files = new Map<string, { size: number; failDelete?: boolean; base64?: string }>();
const dirs = new Set<string>();

function join(parts: Part[]): string {
  return parts
    .map((part, index) => {
      const text = typeof part === 'string' ? part : part.uri;
      return index === 0 ? text.replace(/\/+$/, '') : text.replace(/^\/+|\/+$/g, '');
    })
    .join('/');
}

const nameOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

class FakeFile {
  readonly uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get name() {
    return nameOf(this.uri);
  }
  get exists() {
    return files.has(this.uri);
  }
  get size() {
    return files.get(this.uri)?.size ?? 0;
  }
  base64() {
    const entry = files.get(this.uri);
    if (!entry) return Promise.reject(new Error(`File does not exist: ${this.uri}`));
    if (entry.base64 === undefined) return Promise.reject(new Error(`Cannot read: ${this.uri}`));
    return Promise.resolve(entry.base64);
  }
  delete() {
    const entry = files.get(this.uri);
    if (!entry) throw new Error(`File does not exist: ${this.uri}`);
    if (entry.failDelete) throw new Error(`Cannot delete: ${this.uri}`);
    files.delete(this.uri);
  }
  move(destination: FakeFile) {
    const entry = files.get(this.uri);
    if (!entry) throw new Error(`File does not exist: ${this.uri}`);
    if (files.has(destination.uri)) throw new Error(`Destination already exists: ${destination.uri}`);
    files.delete(this.uri);
    files.set(destination.uri, entry);
    return Promise.resolve();
  }
}

class FakeDirectory {
  readonly uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get name() {
    return nameOf(this.uri);
  }
  get exists() {
    return dirs.has(this.uri);
  }
  create(options: { intermediates?: boolean; idempotent?: boolean } = {}) {
    if (dirs.has(this.uri) && !options.idempotent) throw new Error(`Directory exists: ${this.uri}`);
    dirs.add(this.uri);
  }
  list() {
    if (!dirs.has(this.uri)) throw new Error(`Directory does not exist: ${this.uri}`);
    const prefix = `${this.uri}/`;
    const children: (FakeFile | FakeDirectory)[] = [];
    for (const uri of files.keys()) {
      if (uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/')) children.push(new FakeFile(uri));
    }
    for (const uri of dirs) {
      if (uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/')) children.push(new FakeDirectory(uri));
    }
    return children;
  }
}

export const fakeModule = {
  File: FakeFile,
  Directory: FakeDirectory,
  Paths: { document: new FakeDirectory('file:///docs'), cache: new FakeDirectory('file:///cache') },
};

export const fakeFs = {
  reset() {
    files.clear();
    dirs.clear();
  },
  addFile(uri: string, size = 100, options: { failDelete?: boolean; base64?: string } = {}) {
    files.set(uri, { size, failDelete: options.failDelete, base64: options.base64 });
  },
  addDir(uri: string) {
    dirs.add(uri);
  },
  has: (uri: string) => files.has(uri),
  /** Names of the files directly inside a directory, sorted. */
  names(dirUri: string) {
    return [...files.keys()]
      .filter((uri) => uri.startsWith(`${dirUri}/`) && !uri.slice(dirUri.length + 1).includes('/'))
      .map(nameOf)
      .sort();
  },
};
