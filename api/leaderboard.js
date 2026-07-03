const { put, list } = require('@vercel/blob');

const FILE = 'leaderboard.json';
const MAX_ENTRIES = 100;
const MAX_NAME_LEN = 16;

async function readBoard() {
    const { blobs } = await list({ prefix: FILE, limit: 1 });
    const match = blobs.find((b) => b.pathname === FILE);
    if (!match) return [];
    const res = await fetch(match.url, { cache: 'no-store' });
    if (!res.ok) return [];
    try {
        return await res.json();
    } catch {
        return [];
    }
}

async function writeBoard(board) {
    await put(FILE, JSON.stringify(board), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 0,
    });
}

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        const board = await readBoard();
        board.sort((a, b) => b.score - a.score);
        res.status(200).json(board.slice(0, 20));
        return;
    }

    if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch { body = {}; }
        }
        const name = String(body?.name || '').trim().slice(0, MAX_NAME_LEN);
        const score = Number(body?.score);

        if (!name || !Number.isFinite(score) || score < 0) {
            res.status(400).json({ error: 'Invalid name or score' });
            return;
        }

        const board = await readBoard();
        const key = name.toLowerCase();
        const existing = board.find((e) => e.name.toLowerCase() === key);
        if (existing) {
            if (score > existing.score) {
                existing.score = score;
                existing.date = Date.now();
            }
        } else {
            board.push({ name, score, date: Date.now() });
        }
        board.sort((a, b) => b.score - a.score);
        const trimmed = board.slice(0, MAX_ENTRIES);
        await writeBoard(trimmed);
        res.status(200).json(trimmed.slice(0, 20));
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
};
