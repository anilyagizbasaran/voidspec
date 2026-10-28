import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

// Container'ları kullanıcının elle oluşturduğu gruplara atamak için küçük bir
// JSON deposu. Atama container ADINA göre tutulur: compose yeniden oluşturunca
// container ID'si değişir ama adı (wordpick-api-1 gibi) aynı kalır.
// Atanmamış container'lar arayüzde compose projesine göre gruplanır; bu dosya
// sadece o varsayılanı ezmek için var.

export const MAX_NAME = 40;
export const MAX_GROUPS = 50;

export function cleanGroupName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > MAX_NAME) return null;
  return trimmed;
}

// Docker container adları: [a-zA-Z0-9][a-zA-Z0-9_.-]*
export function isContainerName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name);
}

function emptyState() {
  return { groups: [], assign: {} };
}

// Diskten okunan veriyi beklenen şekle zorla — bozuk dosya paneli düşürmesin.
function normalize(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
    const name = cleanGroupName(g?.name);
    if (typeof g?.id === 'string' && name) state.groups.push({ id: g.id, name });
  }
  const ids = new Set(state.groups.map(g => g.id));
  for (const [container, groupId] of Object.entries(raw.assign || {})) {
    if (isContainerName(container) && ids.has(groupId)) state.assign[container] = groupId;
  }
  return state;
}

export class GroupError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createGroupStore(file) {
  let state = emptyState();
  let writing = Promise.resolve();

  async function persist() {
    // Yazmaları sırala ve önce geçici dosyaya yaz: yarım kalan yazma JSON'u bozmasın.
    const snapshot = JSON.stringify(state, null, 2);
    writing = writing.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, snapshot);
      await rename(tmp, file);
    });
    await writing;
  }

  function findGroup(id) {
    const g = state.groups.find(x => x.id === id);
    if (!g) throw new GroupError(404, 'Group not found');
    return g;
  }

  function assertUniqueName(name, exceptId) {
    const lower = name.toLocaleLowerCase('tr');
    if (state.groups.some(g => g.id !== exceptId && g.name.toLocaleLowerCase('tr') === lower)) {
      throw new GroupError(409, 'A group with this name already exists');
    }
  }

  return {
    async load() {
      try {
        state = normalize(JSON.parse(await readFile(file, 'utf8')));
      } catch {
        state = emptyState();
      }
    },

    get() {
      return structuredClone(state);
    },

    async create(rawName) {
      const name = cleanGroupName(rawName);
      if (!name) throw new GroupError(400, `Group name must be 1-${MAX_NAME} characters`);
      if (state.groups.length >= MAX_GROUPS) throw new GroupError(400, 'Group limit reached');
      assertUniqueName(name);
      const group = { id: randomUUID(), name };
      state.groups.push(group);
      await persist();
      return group;
    },

    async rename(id, rawName) {
      const group = findGroup(id);
      const name = cleanGroupName(rawName);
      if (!name) throw new GroupError(400, `Group name must be 1-${MAX_NAME} characters`);
      assertUniqueName(name, id);
      group.name = name;
      await persist();
      return group;
    },

    async remove(id) {
      findGroup(id);
      state.groups = state.groups.filter(g => g.id !== id);
      for (const [c, gid] of Object.entries(state.assign)) {
        if (gid === id) delete state.assign[c];
      }
      await persist();
    },

    // groupId null → container varsayılan (compose projesi) grubuna döner.
    async assign(container, groupId) {
      if (!isContainerName(container)) throw new GroupError(400, 'Invalid container name');
      if (groupId == null) {
        delete state.assign[container];
      } else {
        findGroup(groupId);
        state.assign[container] = groupId;
      }
      await persist();
    },
  };
}
