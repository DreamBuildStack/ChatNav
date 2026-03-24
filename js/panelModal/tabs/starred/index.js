/**
 * StarredTab - 收藏列表
 */

class StarredTab extends BaseTab {
    constructor() {
        super();
        this.id = 'starred';
        this.name = '收藏夹';
        this.icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`;
        
        this.folderManager = new FolderManager(StorageAdapter);
    }
    
    getInitialState() {
        return {
            transient: {
                searchQuery: ''
            },
            persistent: {
                folderStates: {}
            }
        };
    }
    
    render() {
        const container = document.createElement('div');
        container.className = 'starred-tab-container';
        
        const toolbar = document.createElement('div');
        toolbar.className = 'starred-toolbar';
        
        const addFolderBtn = document.createElement('button');
        addFolderBtn.className = 'starred-toolbar-btn';
        addFolderBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
        `;
        this.addEventListener(addFolderBtn, 'click', () => this.handleCreateFolder());
        toolbar.appendChild(addFolderBtn);
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'starred-toolbar-search';
        searchInput.placeholder = '搜索收藏...';
        searchInput.autocomplete = 'off';
        searchInput.value = '';
        
        this.addEventListener(searchInput, 'input', (e) => {
            this.setState('searchQuery', e.target.value.trim().toLowerCase());
            this.updateList();
        });
        
        this.addEventListener(searchInput, 'keydown', (e) => {
            if (e.key === 'Escape') {
                const input = this.getDomRef('searchInput');
                if (input) { input.value = ''; }
                this.setState('searchQuery', '');
                this.updateList();
            }
        });
        
        this.setDomRef('searchInput', searchInput);
        toolbar.appendChild(searchInput);
        container.appendChild(toolbar);
        
        const listContainer = document.createElement('div');
        listContainer.className = 'starred-list-tree';
        this.setDomRef('listContainer', listContainer);
        container.appendChild(listContainer);
        
        return container;
    }
    
    async mounted() {
        super.mounted();
        await this.updateList();
        
        this.addStorageListener(async () => {
            if (window.panelModal && window.panelModal.currentTabId === 'starred') {
                await this.updateList();
            }
        });
    }
    
    unmounted() {
        super.unmounted();
    }
    
    async updateList() {
        const listContainer = this.getDomRef('listContainer');
        if (!listContainer) return;
        
        if (window.globalTooltipManager) {
            window.globalTooltipManager.forceHideAll();
        }
        
        const tree = await this.folderManager.getStarredByFolder();
        listContainer.innerHTML = '';
        
        const hasData = tree.folders.length > 0 || tree.uncategorized.length > 0;
        
        if (!hasData) {
            listContainer.innerHTML = `<div class="starred-empty">暂无收藏内容<br><span style="font-size:12px;color:#9ca3af">长按时间轴上的圆点即可收藏</span></div>`;
            return;
        }
        
        this.renderUncategorized(tree.uncategorized, listContainer, tree.folders.length === 0);
        
        for (const folder of tree.folders) {
            this.renderFolder(folder, listContainer);
        }
        
        const searchQuery = this.getState('searchQuery');
        if (searchQuery && listContainer.children.length === 0) {
            listContainer.innerHTML = `<div class="starred-empty">未找到匹配的收藏<br><span style="font-size:12px;color:#9ca3af">关键词：${this.escapeHtml(searchQuery)}</span></div>`;
        }
    }
    
    renderFolder(folder, container, level = 0) {
        const searchQuery = this.getState('searchQuery');
        const folderStates = this.getPersistentState('folderStates');
        
        const folderNameMatches = searchQuery && folder.name.toLowerCase().includes(searchQuery);
        
        const filteredItems = searchQuery 
            ? (folderNameMatches ? folder.items : folder.items.filter(item => this.matchesSearch(item, searchQuery)))
            : folder.items;
        
        const hasMatchingChildren = (folder.children || []).some(child => {
            const childFolderNameMatches = searchQuery && child.name.toLowerCase().includes(searchQuery);
            const childHasItems = child.items.some(item => this.matchesSearch(item, searchQuery));
            return childFolderNameMatches || childHasItems;
        });
        
        if (searchQuery && !folderNameMatches && filteredItems.length === 0 && !hasMatchingChildren) {
            return;
        }
        
        const isExpanded = searchQuery ? true : (folderStates[folder.id] === true);
        
        const folderElement = document.createElement('div');
        folderElement.className = `ait-folder-item ait-folder-level-${level}`;
        folderElement.dataset.folderId = folder.id;
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'ait-folder-header';
        
        const toggleIcon = document.createElement('span');
        toggleIcon.className = `ait-folder-toggle ${isExpanded ? 'expanded' : ''}`;
        toggleIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
        toggleIcon.addEventListener('click', () => this.toggleFolder(folder.id));
        
        const folderInfo = document.createElement('div');
        folderInfo.className = 'ait-folder-info';
        
        const totalItems = this._countAllItems(folder);
        const folderIconSvg = isExpanded
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
        
        folderInfo.innerHTML = `
            <span class="ait-folder-icon">${folderIconSvg}</span>
            <span class="ait-folder-name">${this.escapeHtml(folder.name)}</span>
            <span class="ait-folder-count">(${totalItems})</span>
        `;
        folderInfo.style.cursor = 'pointer';
        folderInfo.addEventListener('click', () => this.toggleFolder(folder.id));
        
        const actionsBtn = document.createElement('button');
        actionsBtn.className = 'ait-folder-action-btn';
        actionsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
        actionsBtn.addEventListener('click', (e) => { e.stopPropagation(); this.showFolderActions(e, folder.id); });
        
        folderHeader.appendChild(toggleIcon);
        folderHeader.appendChild(folderInfo);
        folderHeader.appendChild(actionsBtn);
        folderElement.appendChild(folderHeader);
        
        const folderBody = document.createElement('div');
        folderBody.className = `ait-folder-body ${isExpanded ? 'expanded' : ''}`;
        
        for (const item of filteredItems) {
            folderBody.appendChild(this.renderStarredItem(item));
        }
        
        for (const child of (folder.children || [])) {
            this.renderFolder(child, folderBody, level + 1);
        }
        
        folderElement.appendChild(folderBody);
        container.appendChild(folderElement);
    }
    
    renderUncategorized(items, container, isOnlyDefault) {
        if (items.length === 0) return;
        
        if (isOnlyDefault) {
            for (const item of items) {
                container.appendChild(this.renderStarredItem(item));
            }
            return;
        }
        
        const folderElement = document.createElement('div');
        folderElement.className = 'ait-folder-item ait-folder-level-0';
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'ait-folder-header';
        
        const folderInfo = document.createElement('div');
        folderInfo.className = 'ait-folder-info';
        folderInfo.innerHTML = `
            <span class="ait-folder-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></span>
            <span class="ait-folder-name">默认收藏</span>
            <span class="ait-folder-count">(${items.length})</span>
        `;
        
        folderHeader.appendChild(folderInfo);
        folderElement.appendChild(folderHeader);
        
        const folderBody = document.createElement('div');
        folderBody.className = 'ait-folder-body expanded';
        for (const item of items) {
            folderBody.appendChild(this.renderStarredItem(item));
        }
        folderElement.appendChild(folderBody);
        container.appendChild(folderElement);
    }
    
    renderStarredItem(item) {
        const el = document.createElement('div');
        el.className = 'starred-item';
        el.dataset.turnId = item.turnId;
        el.dataset.url = item.url;
        
        const time = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '';
        
        el.innerHTML = `
            <div class="starred-item-main">
                <div class="starred-item-theme">${this.escapeHtml(item.theme || '整个对话')}</div>
                <div class="starred-item-meta">
                    <span class="starred-item-platform">${this.getPlatformName(item.url)}</span>
                    <span class="starred-item-time">${time}</span>
                </div>
            </div>
            <button class="starred-item-delete" title="取消收藏">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            </button>
        `;
        
        el.addEventListener('click', (e) => {
            if (e.target.closest('.starred-item-delete')) return;
            this.handleNavigate(item);
        });
        
        el.querySelector('.starred-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleUnstar(item);
        });
        
        return el;
    }
    
    getPlatformName(url) {
        if (!url) return '';
        if (url.includes('chatgpt.com') || url.includes('openai.com')) return 'ChatGPT';
        if (url.includes('gemini.google.com')) return 'Gemini';
        if (url.includes('deepseek.com')) return 'DeepSeek';
        if (url.includes('claude.ai')) return 'Claude';
        if (url.includes('perplexity.ai')) return 'Perplexity';
        if (url.includes('kimi.com') || url.includes('moonshot.cn')) return 'Kimi';
        if (url.includes('qianwen.com')) return '通义';
        if (url.includes('yiyan.baidu.com')) return '文心';
        if (url.includes('doubao.com')) return '豆包';
        if (url.includes('yuanbao.tencent.com')) return '元宝';
        if (url.includes('grok.com')) return 'Grok';
        return 'AI';
    }
    
    matchesSearch(item, query) {
        if (!query) return true;
        const text = (item.theme || '').toLowerCase();
        return text.includes(query);
    }
    
    _countAllItems(folder) {
        let count = (folder.items || []).length;
        for (const child of (folder.children || [])) {
            count += this._countAllItems(child);
        }
        return count;
    }
    
    toggleFolder(folderId) {
        const states = { ...this.getPersistentState('folderStates') };
        states[folderId] = !states[folderId];
        this.setPersistentState('folderStates', states);
        this.updateList();
    }
    
    async handleCreateFolder() {
        const name = prompt('请输入文件夹名称：');
        if (!name || !name.trim()) return;
        
        try {
            await this.folderManager.createFolder(name.trim());
            await this.updateList();
            this.showToast('文件夹已创建');
        } catch (e) {
            this.showToast('创建失败：' + e.message);
        }
    }
    
    async showFolderActions(e, folderId) {
        const existing = document.querySelector('.folder-context-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.className = 'folder-context-menu';
        menu.innerHTML = `
            <button data-action="rename">重命名</button>
            <button data-action="delete">删除</button>
        `;
        
        menu.style.position = 'fixed';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        
        document.body.appendChild(menu);
        
        const closeMenu = () => menu.remove();
        setTimeout(() => document.addEventListener('click', closeMenu, { once: true });
        
        menu.addEventListener('click', async (ev) => {
            const action = ev.target.dataset.action;
            if (action === 'rename') {
                closeMenu();
                await this.handleRenameFolder(folderId);
            } else if (action === 'delete') {
                closeMenu();
                await this.handleDeleteFolder(folderId);
            }
        });
    }
    
    async handleRenameFolder(folderId) {
        const folders = await this.folderManager.getFolders();
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return;
        
        const newName = prompt('请输入新名称：', folder.name);
        if (!newName || !newName.trim() || newName.trim() === folder.name) return;
        
        try {
            await this.folderManager.updateFolder(folderId, newName.trim());
            await this.updateList();
            this.showToast('已重命名');
        } catch (e) {
            this.showToast('重命名失败');
        }
    }
    
    async handleDeleteFolder(folderId) {
        if (!confirm('确定删除该文件夹？文件夹内的收藏将移至「默认收藏」。')) return;
        
        try {
            await this.folderManager.deleteFolder(folderId, null);
            await this.updateList();
            this.showToast('已删除');
        } catch (e) {
            this.showToast('删除失败');
        }
    }
    
    handleNavigate(item) {
        if (!item.url) return;
        
        const sameSite = item.url.includes(location.host);
        
        if (sameSite) {
            window.location.href = item.url;
        } else {
            window.open(item.url, '_blank');
        }
    }
    
    async handleUnstar(item) {
        try {
            const key = `chatTimelineStar:${item.turnId}`;
            await StarStorageManager.remove(key);
            await this.updateList();
            this.showToast('已取消收藏');
        } catch (e) {
            this.showToast('取消失败');
        }
    }
    
    showToast(message) {
        const existing = document.querySelector('.starred-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'starred-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('visible'));
        
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}
