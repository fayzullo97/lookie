
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class StorageService {
    private getPath(key: string): string {
        return path.join(DATA_DIR, `${key}.json`);
    }

    getItem(key: string): string | null {
        const filePath = this.getPath(key);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return null;
    }

    setItem(key: string, value: string): void {
        const filePath = this.getPath(key);
        fs.writeFileSync(filePath, value, 'utf-8');
    }

    removeItem(key: string): void {
        const filePath = this.getPath(key);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

export const storage = new StorageService();
