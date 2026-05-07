const state = {
    following: [],
    followers: [],
    results: {
        followOnly: [],
        followerOnly: [],
        mutual: [],
    },
    activeList: 'followOnly',
};

const labels = {
    followOnly: 'あなたはフォロー中・相手からはフォローされていないアカウント',
    followerOnly: '相手はあなたをフォロー中・あなたはフォローしていないアカウント',
    mutual: '相互フォローのアカウント',
};

const fileInputs = {
    zip: document.getElementById('zipFileInput'),
    following: document.getElementById('followingFileInput'),
    followers: document.getElementById('followersFileInput'),
};

const statuses = {
    zip: document.getElementById('zipStatus'),
    following: document.getElementById('followingStatus'),
    followers: document.getElementById('followersStatus'),
};

const message = document.getElementById('ErrorMessage');
const compareButton = document.getElementById('compareButton');
const resetButton = document.getElementById('resetButton');
const searchInput = document.getElementById('searchInput');
const userList = document.getElementById('userList');
const listHeader = document.getElementById('activeListHeader');
const copyButton = document.getElementById('copyButton');
const exportButton = document.getElementById('exportButton');
const dropZone = document.getElementById('dropZone');

document.getElementById('pageTitle')?.addEventListener('click', () => {
    window.location.href = './home.html';
});

Object.entries(fileInputs).forEach(([type, input]) => {
    input?.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        if (type === 'zip') {
            readZipFile(file);
            return;
        }
        readJsonFile(file, type);
    });
});

compareButton?.addEventListener('click', compareFiles);
resetButton?.addEventListener('click', resetAll);
searchInput?.addEventListener('input', renderActiveList);
copyButton?.addEventListener('click', copyActiveList);
exportButton?.addEventListener('click', exportCsv);

document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        state.activeList = tab.dataset.list;
        document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
        tab.classList.add('active');
        renderActiveList();
    });
});

if (dropZone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.add('is-dragging');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.remove('is-dragging');
        });
    });

    dropZone.addEventListener('drop', (event) => {
        Array.from(event.dataTransfer.files).forEach((file) => {
            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith('.zip')) {
                readZipFile(file);
                return;
            }
            if (lowerName.endsWith('.json')) {
                const type = lowerName.includes('following') && !lowerName.includes('followers') ? 'following' : 'followers';
                readJsonFile(file, type);
            }
        });
    });
}

async function readZipFile(file) {
    if (!window.JSZip) {
        setMessage('ZIP解析ライブラリを読み込めませんでした。ページを再読み込みしてください。', 'error');
        return;
    }

    setMessage('ZIPを解析しています。ファイルサイズによっては少し時間がかかります。', 'success');

    try {
        const zip = await JSZip.loadAsync(file);
        const followingEntry = findZipEntry(zip, 'following');
        const followersEntry = findZipEntry(zip, 'followers');

        if (!followingEntry || !followersEntry) {
            throw new Error('ZIP内に following.json と followers_1.json が見つかりませんでした。');
        }

        const [followingJson, followersJson] = await Promise.all([
            followingEntry.async('string'),
            followersEntry.async('string'),
        ]);

        state.following = extractAccounts(JSON.parse(followingJson), 'following');
        state.followers = extractAccounts(JSON.parse(followersJson), 'followers');

        if (!state.following.length || !state.followers.length) {
            throw new Error('フォロー情報を読み取れませんでした。エクスポート形式がJSONになっているか確認してください。');
        }

        statuses.zip.textContent = `${file.name} / 自動検出OK`;
        statuses.zip.classList.add('is-ready');
        statuses.following.textContent = `following.json / ${state.following.length.toLocaleString()}件`;
        statuses.followers.textContent = `followers_1.json / ${state.followers.length.toLocaleString()}件`;
        statuses.following.classList.add('is-ready');
        statuses.followers.classList.add('is-ready');
        compareFiles('ZIPから必要なJSONを読み込み、比較まで完了しました。');
    } catch (error) {
        state.following = [];
        state.followers = [];
        statuses.zip.textContent = '読み込み失敗';
        statuses.zip.classList.remove('is-ready');
        setMessage(`${file.name} を確認してください。${error.message}`, 'error');
        updateCounts();
    }
}

function findZipEntry(zip, type) {
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const exactName = type === 'following' ? 'following.json' : 'followers_1.json';
    const preferredPath = `connections/followers_and_following/${exactName}`;

    return entries.find((entry) => normalizePath(entry.name).endsWith(preferredPath))
        || entries.find((entry) => normalizePath(entry.name).endsWith(`/followers_and_following/${exactName}`))
        || entries.find((entry) => normalizePath(entry.name).endsWith(`/${exactName}`))
        || entries.find((entry) => normalizePath(entry.name) === exactName);
}

function normalizePath(path) {
    return path.replaceAll('\\', '/').toLowerCase();
}

function readJsonFile(file, type) {
    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            state[type] = extractAccounts(data, type);

            if (!state[type].length) {
                throw new Error('アカウント情報が見つかりませんでした。');
            }

            statuses[type].textContent = `${file.name} / ${state[type].length.toLocaleString()}件`;
            statuses[type].classList.add('is-ready');
            setMessage(`${file.name} を読み込みました。`, 'success');
            updateCounts();

            if (state.following.length && state.followers.length) {
                compareFiles('2つのJSONを読み込み、比較まで完了しました。');
            }
        } catch (error) {
            state[type] = [];
            statuses[type].textContent = '読み込み失敗';
            statuses[type].classList.remove('is-ready');
            setMessage(`${file.name} を確認してください。${error.message}`, 'error');
        }
    };

    reader.onerror = () => setMessage('ファイルを読み込めませんでした。', 'error');
    reader.readAsText(file);
}

function extractAccounts(data, type) {
    const source = type === 'following' ? data.relationships_following : data;
    if (!Array.isArray(source)) {
        throw new Error(type === 'following' ? 'following.jsonではない可能性があります。' : 'followers_1.jsonではない可能性があります。');
    }

    return [...new Set(source
        .map(getAccountName)
        .filter(Boolean)
        .map((name) => name.trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'en'));
}

function getAccountName(entry) {
    const data = entry?.string_list_data?.[0];
    return data?.value || entry?.title || getUsernameFromHref(data?.href);
}

function getUsernameFromHref(href) {
    if (!href) return '';

    try {
        const url = new URL(href);
        const parts = url.pathname.split('/').filter(Boolean);
        return parts[0] === '_u' ? parts[1] || '' : parts[0] || '';
    } catch {
        return href.split('/').filter(Boolean).pop() || '';
    }
}

function compareFiles(successMessage = '比較が完了しました。ユーザー名をクリックするとInstagramを開きます。') {
    if (!state.following.length || !state.followers.length) {
        setMessage('following.json と followers_1.json の両方を選択してください。', 'error');
        return;
    }

    const followingMap = createAccountMap(state.following);
    const followersMap = createAccountMap(state.followers);
    const followingSet = new Set(followingMap.keys());
    const followersSet = new Set(followersMap.keys());

    state.results.followOnly = state.following.filter((id) => !followersSet.has(normalizeUsername(id)));
    state.results.followerOnly = state.followers.filter((id) => !followingSet.has(normalizeUsername(id)));
    state.results.mutual = [...followingSet]
        .filter((key) => followersSet.has(key))
        .map((key) => followingMap.get(key));

    searchInput.disabled = false;
    copyButton.disabled = false;
    exportButton.disabled = false;
    setMessage(successMessage, 'success');
    updateCounts();
    renderActiveList();
}

function updateCounts() {
    setText('followingCount', state.following.length);
    setText('followersCount', state.followers.length);
    setText('followOnlyCount', state.results.followOnly.length);
    setText('followerOnlyCount', state.results.followerOnly.length);
    setText('mutualCount', state.results.mutual.length);
}

function createAccountMap(accounts) {
    const map = new Map();
    accounts.forEach((name) => {
        const key = normalizeUsername(name);
        if (key && !map.has(key)) {
            map.set(key, name);
        }
    });
    return map;
}

function normalizeUsername(name) {
    return String(name || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();
}

function renderActiveList() {
    const query = searchInput.value.trim().toLowerCase();
    const accounts = state.results[state.activeList] || [];
    const filtered = query ? accounts.filter((id) => id.toLowerCase().includes(query)) : accounts;

    listHeader.textContent = `${labels[state.activeList]}: ${filtered.length.toLocaleString()}件`;
    userList.innerHTML = '';

    if (!accounts.length) {
        userList.appendChild(createEmptyItem('表示できるアカウントがありません。'));
        return;
    }

    if (!filtered.length) {
        userList.appendChild(createEmptyItem('検索条件に一致するアカウントはありません。'));
        return;
    }

    filtered.forEach((id) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `https://www.instagram.com/${encodeURIComponent(id)}`;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = `@${id}`;
        item.appendChild(link);
        userList.appendChild(item);
    });
}

function createEmptyItem(text) {
    const item = document.createElement('li');
    item.className = 'empty-item';
    item.textContent = text;
    return item;
}

async function copyActiveList() {
    const accounts = state.results[state.activeList] || [];
    if (!accounts.length) return;

    await navigator.clipboard.writeText(accounts.map((id) => `@${id}`).join('\n'));
    setMessage('現在の一覧をクリップボードにコピーしました。', 'success');
}

function exportCsv() {
    const rows = [['category', 'username']];
    Object.entries(state.results).forEach(([category, accounts]) => {
        accounts.forEach((id) => rows.push([category, id]));
    });

    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'instagram-follow-checker-result.csv';
    link.click();
    URL.revokeObjectURL(url);
}

function escapeCsv(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
}

function resetAll() {
    state.following = [];
    state.followers = [];
    state.results = { followOnly: [], followerOnly: [], mutual: [] };
    Object.values(fileInputs).forEach((input) => {
        if (input) input.value = '';
    });
    Object.values(statuses).forEach((status) => {
        if (!status) return;
        status.textContent = '未選択';
        status.classList.remove('is-ready');
    });
    searchInput.value = '';
    searchInput.disabled = true;
    copyButton.disabled = true;
    exportButton.disabled = true;
    userList.innerHTML = '';
    listHeader.textContent = 'まだ比較されていません';
    setMessage('', '');
    updateCounts();
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(value).toLocaleString();
}

function setMessage(text, type) {
    message.textContent = text;
    message.className = type ? `message ${type}` : 'message';
}
