/**
 * NotepadManager - 闪记管理器（单条模式）
 * 全局共享、持久化到 chrome.storage，纯文本
 * 拖拽 / 调整大小交互逻辑与 FloatingRunnerContainer 保持一致
 *
 * [多笔记模式已注释，后续可放开]
 */
class NotepadManager {
    constructor() {
        this.panel = null;
        this.textarea = null;
        this.isOpen = false;
        this.saveTimeout = null;

        this.activeNoteId = null;

        // 笔记数组 [{id, content, updatedAt}]（单条模式下始终只有 1 条）
        this.notes = [];

        // 存储 key
        this.NOTES_KEY = 'aitNotepadNotes';
        this.STATE_KEY = 'aitNotepadState';

        // 兼容旧版单笔记数据迁移
        this.OLD_STORAGE_KEY = 'aitNotepadContent';

        // 默认尺寸
        this.DEFAULT_WIDTH = 260;
        this.DEFAULT_HEIGHT = 370;
        this.MIN_WIDTH = 240;
        this.MIN_HEIGHT = 280;

        // 位置（右下角锚定：距视口右边/底部的距离）& 大小
        this.position = { right: null, bottom: null };
        this.size = { width: this.DEFAULT_WIDTH, height: this.DEFAULT_HEIGHT };

        // 拖动状态
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };

        // 调整大小状态
        this.isResizing = false;
        this.resizeDirection = null;
        this.resizeStart = null;

        this._onMouseMove = null;
        this._onMouseUp = null;
        this._onFocusCheck = null;
        this._onStorageChange = null;
        this._onWindowResize = null;
        this._isSaving = false;

        this.loadState();
    }

    async init() {
        this.createPanel();
        await this.loadNotes();
        this._ensureSingleNote();
        this._openSingleNote();
        this.bindEvents();
    }

    // ─── DOM ─────────────────────────────────────────────────────────────────

    createPanel() {
        if (this.panel) return;

        const panel = document.createElement('div');
        panel.className = 'ait-notepad-panel';

        panel.innerHTML = `
            <div class="ait-notepad-header">
                <span class="ait-notepad-title">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        width="16" height="16">
                        <path d="M9 18h6"/>
                        <path d="M10 22h4"/>
                        <path d="M12 2a7 7 0 0 0-4 12.7V16a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.3A7 7 0 0 0 12 2Z"/>
                    </svg>
                    ${chrome.i18n.getMessage('notepadTitle') || '闪记'}
                </span>
                <div class="ait-notepad-header-right">
                    <!-- [多笔记模式] 列表/新增按钮，暂时隐藏
                    <button class="ait-notepad-list-btn" title="${chrome.i18n.getMessage('notepadAllNotes') || '全部笔记'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            width="16" height="16">
                            <line x1="8" y1="6" x2="21" y2="6"/>
                            <line x1="8" y1="12" x2="21" y2="12"/>
                            <line x1="8" y1="18" x2="21" y2="18"/>
                            <line x1="3" y1="6" x2="3.01" y2="6"/>
                            <line x1="3" y1="12" x2="3.01" y2="12"/>
                            <line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                    </button>
                    <button class="ait-notepad-add-btn" title="${chrome.i18n.getMessage('notepadNewNote') || '新建笔记'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                            width="16" height="16">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                    -->
                    <button class="ait-notepad-close-btn" title="${chrome.i18n.getMessage('notepadClose') || '关闭'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            width="14" height="14">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="ait-notepad-body">
                <textarea class="ait-notepad-editor" placeholder="${chrome.i18n.getMessage('notepadPlaceholder') || '想到什么就写什么，无需排版…'}"></textarea>
            </div>
            <div class="ait-notepad-resize-handle" data-direction="se"></div>
            <div class="ait-notepad-resize-handle" data-direction="sw"></div>
            <div class="ait-notepad-resize-handle" data-direction="ne"></div>
            <div class="ait-notepad-resize-handle" data-direction="nw"></div>
            <div class="ait-notepad-resize-handle" data-direction="e"></div>
            <div class="ait-notepad-resize-handle" data-direction="w"></div>
            <div class="ait-notepad-resize-handle" data-direction="n"></div>
            <div class="ait-notepad-resize-handle" data-direction="s"></div>
        `;

        document.body.appendChild(panel);
        this.panel = panel;
        this.textarea = panel.querySelector('.ait-notepad-editor');
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    bindEvents() {
        const header = this.panel.querySelector('.ait-notepad-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            this.startDrag(e);
        });

        this.panel.querySelectorAll('.ait-notepad-resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                this.startResize(e, handle.dataset.direction);
            });
        });

        this._onMouseMove = (e) => this.onMouseMove(e);
        this._onMouseUp = () => this.onMouseUp();
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);

        this.textarea.addEventListener('input', () => this.scheduleSave());

        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                const val = this.textarea.value;
                this.textarea.value = val.substring(0, start) + '    ' + val.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
                this.scheduleSave();
            }
        });

        this.panel.querySelector('.ait-notepad-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });

        /* [多笔记模式] 列表/新增按钮事件，暂时注释
        this.listBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showListView();
        });

        this.addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNote();
        });

        this.listContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.ait-notepad-item-delete');
            if (deleteBtn) {
                e.stopPropagation();
                const id = deleteBtn.closest('.ait-notepad-item').dataset.id;
                this.deleteNote(id);
                return;
            }
            const item = e.target.closest('.ait-notepad-item');
            if (item) {
                this.openNote(item.dataset.id);
            }
        });
        */

        this._onFocusCheck = (e) => {
            if (!this.isOpen || !this.panel) return;
            if (e.target.closest('.ait-notepad-btn')) return;
            const rect = this.panel.getBoundingClientRect();
            const inside = e.clientX >= rect.left && e.clientX <= rect.right
                        && e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (inside) {
                this.panel.classList.add('ait-notepad-focused');
            } else {
                this.panel.classList.remove('ait-notepad-focused');
            }
        };
        document.addEventListener('mousedown', this._onFocusCheck, true);

        this._onStorageChange = (changes, area) => {
            if (area !== 'local') return;

            if (changes[this.NOTES_KEY] && !this._isSaving) {
                const newNotes = changes[this.NOTES_KEY].newValue;
                if (!newNotes || !newNotes.length) return;

                this.notes = newNotes;
                if (!this.isOpen || !this.activeNoteId) return;

                const note = this._getNoteById(this.activeNoteId);
                if (note && note.content !== this.textarea.value) {
                    this.textarea.value = note.content;
                    const len = note.content.length;
                    this.textarea.selectionStart = this.textarea.selectionEnd = len;
                }
            }
        };
        chrome.storage.onChanged.addListener(this._onStorageChange);

        this._onWindowResize = () => {
            if (!this.isOpen || !this.panel) return;
            this.applyState();
        };
        window.addEventListener('resize', this._onWindowResize);
    }

    // ─── 单条模式 ─────────────────────────────────────────────────────────────

    _ensureSingleNote() {
        if (!this.notes.length) {
            this.notes.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                content: '',
                updatedAt: Date.now()
            });
        }
    }

    _openSingleNote() {
        const note = this.notes[0];
        this.activeNoteId = note.id;
        this.textarea.value = note.content;
    }

    /* ─── [多笔记模式] 视图切换 / 列表渲染，暂时注释 ──────────────────────────

    async renderCurrentView() {
        this._updateListBtnVisibility();
        if (this.currentView === 'list') {
            await this.showListView();
        } else {
            this._showEditView();
        }
    }

    async showListView() {
        this._flushCurrentNote();
        await this.loadNotes();
        this._updateListBtnVisibility();

        this.currentView = 'list';
        this.activeNoteId = null;
        this.textarea.style.display = 'none';
        this.listContainer.style.display = '';
        this._renderList();
    }

    _showEditView() {
        this.currentView = 'edit';
        this.listContainer.style.display = 'none';
        this.textarea.style.display = '';
        this._updateListBtnVisibility();
    }

    _updateListBtnVisibility() {
        if (this.listBtn) {
            this.listBtn.style.display = this.notes.length >= 1 ? 'flex' : 'none';
        }
    }

    _renderList() {
        if (!this.notes.length) {
            this.listContainer.innerHTML = '';
            return;
        }

        const sorted = [...this.notes].sort((a, b) => b.updatedAt - a.updatedAt);

        this.listContainer.innerHTML = sorted.map(note => {
            const title = this._extractTitle(note.content) || (chrome.i18n.getMessage('notepadUntitled') || '无标题');
            const preview = this._extractPreview(note.content);
            const time = this._formatTime(note.updatedAt);
            return `
                <div class="ait-notepad-item" data-id="${note.id}">
                    <div class="ait-notepad-item-content">
                        <div class="ait-notepad-item-title">${this._escapeHtml(title)}</div>
                        <div class="ait-notepad-item-meta">
                            <span class="ait-notepad-item-time">${time}</span>
                            ${preview ? `<span class="ait-notepad-item-preview">${this._escapeHtml(preview)}</span>` : ''}
                        </div>
                    </div>
                    <button class="ait-notepad-item-delete" title="${chrome.i18n.getMessage('mzxvkp') || '删除'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            width="14" height="14">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>`;
        }).join('');
    }

    ─── [多笔记模式] 笔记 CRUD ────────────────────────────────────────────────

    createNote() {
        if (this.notes.length >= this.MAX_NOTES) {
            const sorted = [...this.notes].sort((a, b) => a.updatedAt - b.updatedAt);
            this.notes = this.notes.filter(n => n.id !== sorted[0].id);
        }

        const note = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            content: '',
            updatedAt: Date.now()
        };
        this.notes.push(note);
        this.openNote(note.id);
    }

    openNote(id) {
        this._flushCurrentNote();

        const note = this._getNoteById(id);
        if (!note) return;

        this.activeNoteId = id;
        this.textarea.value = note.content;
        this._showEditView();

        requestAnimationFrame(() => {
            this.textarea.focus();
            const len = this.textarea.value.length;
            this.textarea.setSelectionRange(len, len);
        });
    }

    async deleteNote(id) {
        const confirmed = await window.globalPopconfirmManager?.show({
            title: chrome.i18n.getMessage('notepadConfirmDeleteTitle') || '确认删除',
            content: chrome.i18n.getMessage('notepadConfirmDeleteContent') || '删除后将无法恢复，确定要继续吗？',
            confirmText: chrome.i18n.getMessage('mzxvkp') || '删除',
            cancelText: chrome.i18n.getMessage('pxvkmz') || '取消'
        });
        if (!confirmed) return;

        this.notes = this.notes.filter(n => n.id !== id);
        this.saveNotes();

        if (this.activeNoteId === id) {
            this.activeNoteId = null;
        }
        this._updateListBtnVisibility();

        if (!this.notes.length) {
            this.createNote();
        } else {
            this._renderList();
        }
    }

    ─── [多笔记模式] 文本工具 ─────────────────────────────────────────────────

    _extractTitle(content) {
        if (!content) return '';
        const firstLine = content.split('\n')[0].trim();
        return firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine;
    }

    _extractPreview(content) {
        if (!content) return '';
        const lines = content.split('\n').filter(l => l.trim());
        const secondLine = lines.length > 1 ? lines[1].trim() : '';
        return secondLine.length > 50 ? secondLine.slice(0, 50) + '…' : secondLine;
    }

    _formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');

        if (d.toDateString() === now.toDateString()) {
            return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
            return `${chrome.i18n.getMessage('notepadYesterday') || '昨天'} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        if (d.getFullYear() === now.getFullYear()) {
            return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    _escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    ────────────────────────────────── [多笔记模式] END ──────────────────────── */

    _flushCurrentNote() {
        if (!this.activeNoteId || !this.textarea) return;
        const note = this._getNoteById(this.activeNoteId);
        if (!note) return;

        const newContent = this.textarea.value;
        if (note.content !== newContent) {
            note.content = newContent;
            note.updatedAt = Date.now();
            this.saveNotes();
        }
    }

    _getNoteById(id) {
        return this.notes.find(n => n.id === id) || null;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    scheduleSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this._flushCurrentNote();
        }, 600);
    }

    saveNotes() {
        this._isSaving = true;
        try {
            chrome.storage.local.set({ [this.NOTES_KEY]: this.notes }, () => {
                this._isSaving = false;
            });
        } catch (e) {
            this._isSaving = false;
        }
    }

    async loadNotes() {
        try {
            const result = await chrome.storage.local.get([this.NOTES_KEY, this.OLD_STORAGE_KEY]);

            if (result[this.NOTES_KEY] && result[this.NOTES_KEY].length) {
                this.notes = result[this.NOTES_KEY];
            } else if (result[this.OLD_STORAGE_KEY]) {
                const oldContent = result[this.OLD_STORAGE_KEY];
                if (oldContent.trim()) {
                    this.notes = [{
                        id: Date.now().toString(36),
                        content: oldContent,
                        updatedAt: Date.now()
                    }];
                    this.saveNotes();
                    try { chrome.storage.local.remove(this.OLD_STORAGE_KEY); } catch (e) {}
                }
            }
        } catch (e) {}
    }

    saveState() {
        try {
            chrome.storage.local.set({
                [this.STATE_KEY]: { position: this.position, size: this.size }
            });
        } catch (e) {}
    }

    loadState() {
        try {
            chrome.storage.local.get(this.STATE_KEY, (result) => {
                const state = result[this.STATE_KEY];
                if (state) {
                    if (state.position) {
                        if (state.position.right !== undefined) {
                            this.position = state.position;
                        } else if (state.position.x !== null && state.position.x !== undefined) {
                            this.position = {
                                right: window.innerWidth - state.position.x - (state.size?.width || this.DEFAULT_WIDTH),
                                bottom: window.innerHeight - state.position.y - (state.size?.height || this.DEFAULT_HEIGHT)
                            };
                        }
                    }
                    if (state.size) this.size = state.size;
                }
            });
        } catch (e) {}
    }

    // ─── 拖动（与 runner 完全一致）────────────────────────────────────────────

    startDrag(e) {
        this.isDragging = true;
        const rect = this.panel.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        document.body.style.userSelect = 'none';
    }

    // ─── 调整大小（与 runner 完全一致）───────────────────────────────────────

    startResize(e, direction) {
        this.isResizing = true;
        this.resizeDirection = direction;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: this.panel.offsetWidth,
            height: this.panel.offsetHeight,
            left: this.panel.offsetLeft,
            top: this.panel.offsetTop
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = this.getCursorForDirection(direction);
    }

    getCursorForDirection(dir) {
        const cursors = {
            'n': 'ns-resize',   's': 'ns-resize',
            'e': 'ew-resize',   'w': 'ew-resize',
            'ne': 'nesw-resize', 'sw': 'nesw-resize',
            'nw': 'nwse-resize', 'se': 'nwse-resize'
        };
        return cursors[dir] || 'default';
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            this.setPosition(x, y);
        }
        if (this.isResizing) {
            this.doResize(e);
        }
    }

    doResize(e) {
        const { x, y, width, height, left, top } = this.resizeStart;
        const dx = e.clientX - x;
        const dy = e.clientY - y;
        const dir = this.resizeDirection;

        let newWidth = width;
        let newHeight = height;
        let newLeft = left;
        let newTop = top;

        if (dir.includes('e')) newWidth  = Math.max(this.MIN_WIDTH,  width  + dx);
        if (dir.includes('w')) {
            newWidth = Math.max(this.MIN_WIDTH, width - dx);
            newLeft  = left + (width - newWidth);
        }
        if (dir.includes('s')) newHeight = Math.max(this.MIN_HEIGHT, height + dy);
        if (dir.includes('n')) {
            newHeight = Math.max(this.MIN_HEIGHT, height - dy);
            newTop    = top + (height - newHeight);
        }

        this.panel.style.width  = newWidth  + 'px';
        this.panel.style.height = newHeight + 'px';
        this.panel.style.left   = newLeft   + 'px';
        this.panel.style.top    = newTop    + 'px';

        this.size     = { width: newWidth, height: newHeight };
        this.position = { right: window.innerWidth - newLeft - newWidth, bottom: window.innerHeight - newTop - newHeight };
    }

    onMouseUp() {
        if (this.isDragging || this.isResizing) {
            this.isDragging  = false;
            this.isResizing  = false;
            document.body.style.userSelect = '';
            document.body.style.cursor     = '';
            this.saveState();
        }
    }

    // ─── 位置（与 runner 完全一致）────────────────────────────────────────────

    setPosition(x, y) {
        const w = this.panel.offsetWidth;
        const h = this.panel.offsetHeight;
        const maxX = window.innerWidth  - w;
        const maxY = window.innerHeight - h;
        x = Math.max(0, Math.min(maxX, x));
        y = Math.max(0, Math.min(maxY, y));

        this.panel.style.left = x + 'px';
        this.panel.style.top  = y + 'px';
        this.position = { right: window.innerWidth - x - w, bottom: window.innerHeight - y - h };
    }

    _toLeftTop() {
        const x = window.innerWidth - this.position.right - this.size.width;
        const y = window.innerHeight - this.position.bottom - this.size.height;
        return {
            x: Math.max(0, Math.min(window.innerWidth - this.size.width, x)),
            y: Math.max(0, Math.min(window.innerHeight - this.size.height, y))
        };
    }

    applyState() {
        if (!this.panel) return;
        const { x, y } = this._toLeftTop();
        this.panel.style.width  = this.size.width  + 'px';
        this.panel.style.height = this.size.height + 'px';
        this.panel.style.left   = x + 'px';
        this.panel.style.top    = y + 'px';
    }

    // ─── Open / Close / Toggle ────────────────────────────────────────────────

    async open() {
        if (this.isOpen) return;
        this.isOpen = true;

        if (this.position.right === null) {
            this.position = this._calcDefaultPosition();
        }

        this.applyState();
        this.panel.classList.add('ait-notepad-visible', 'ait-notepad-focused');
        this._syncBtnActive();

        await this.loadNotes();
        if (!this.isOpen) return;

        this._ensureSingleNote();
        this._openSingleNote();

        requestAnimationFrame(() => {
            if (!this.isOpen) return;
            this.textarea.focus();
            const len = this.textarea.value.length;
            this.textarea.setSelectionRange(len, len);
        });
    }

    _calcDefaultPosition() {
        const wrapper = document.querySelector('.ait-chat-timeline-wrapper');
        const W = this.size.width;
        const H = this.size.height;

        let right, bottom;
        if (wrapper) {
            const wRect = wrapper.getBoundingClientRect();
            right = (window.innerWidth - wRect.left) + 8;
            const notepadBtn = document.querySelector('.ait-notepad-btn');
            if (notepadBtn) {
                const btnRect = notepadBtn.getBoundingClientRect();
                bottom = window.innerHeight - btnRect.bottom;
            } else {
                bottom = window.innerHeight - wRect.bottom;
            }
        } else {
            right = 20;
            bottom = window.innerHeight - H - 100;
        }

        right  = Math.max(0, right);
        bottom = Math.max(0, bottom);
        return { right, bottom };
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this._flushCurrentNote();
        this.panel.classList.remove('ait-notepad-visible', 'ait-notepad-focused');
        clearTimeout(this.saveTimeout);
        this._syncBtnActive();
    }

    toggle() {
        if (!this.isOpen) {
            this.open();
        } else if (this.panel.classList.contains('ait-notepad-focused')) {
            this.close();
        } else {
            this.panel.classList.add('ait-notepad-focused');
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    _syncBtnActive() {
        const btn = document.querySelector('.ait-notepad-btn');
        if (btn) btn.classList.toggle('active', this.isOpen);
    }

    destroy() {
        this.isOpen = false;
        if (this._onMouseMove) {
            document.removeEventListener('mousemove', this._onMouseMove);
            document.removeEventListener('mouseup', this._onMouseUp);
            this._onMouseMove = null;
            this._onMouseUp = null;
        }
        if (this._onFocusCheck) {
            document.removeEventListener('mousedown', this._onFocusCheck, true);
            this._onFocusCheck = null;
        }
        if (this._onStorageChange) {
            chrome.storage.onChanged.removeListener(this._onStorageChange);
            this._onStorageChange = null;
        }
        if (this._onWindowResize) {
            window.removeEventListener('resize', this._onWindowResize);
            this._onWindowResize = null;
        }
        clearTimeout(this.saveTimeout);
        this._flushCurrentNote();
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        this.textarea = null;
    }
}

// Auto-initialize as singleton
window.notepadManager = new NotepadManager();
window.notepadManager.init().catch(() => {});
