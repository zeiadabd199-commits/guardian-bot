class Cache {
    constructor() {
        this.data = new Map();
    }

    get(key) {
        return this.data.get(key) || null;
    }

    set(key, value) {
        this.data.set(key, value);
        return true;
    }

    delete(key) {
        return this.data.delete(key);
    }

    clear() {
        this.data.clear();
    }
}

export const cache = new Cache();
