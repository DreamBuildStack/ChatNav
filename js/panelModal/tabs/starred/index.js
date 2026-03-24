/**
 * StarredTab - 收藏列表
 */

(function() {
    if (typeof BaseTab === 'undefined') return;
    if (typeof FolderManager === 'undefined') return;

    class StarredTab extends BaseTab {
        constructor() {
            super();
            this.id = 'starred';
            this.name = '\u6536\u85CF\u5939';
            this.icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

            this.folderManager = new FolderManager(StorageAdapter);
            this.searchTimer = null;
        }

        getInitialState() {
            return {
                transient: { searchQuery: '' },
                persistent: { folderStates: {} }
            };
        }

        render() {
            const container = document.createElement('div');
            container.className = 'starred-tab-container';

            const toolbar = document.createElement('div');
            toolbar.className = 'starred-toolbar';

            const addFolderBtn = document.createElement('button');
            addFolderBtn.className = 'starred-toolbar-btn';
            addFolderBtn.setAttribute('title', '\u65b0\u5efa\u6587\u4ef6\u5939');

            const addFolderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            addFolderSvg.setAttribute('width', '16');
            addFolderSvg.setAttribute('height', '16');
            addFolderSvg.setAttribute('viewBox', '0 0 24 24');
            addFolderSvg.setAttribute('fill', 'none');
            addFolderSvg.setAttribute('stroke', 'currentColor');
            addFolderSvg.setAttribute('stroke-width', '2');

            const folderPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            folderPath.setAttribute('d', 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z');
            addFolderSvg.appendChild(folderPath);

            const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            vLine.setAttribute('x1', '12');
            vLine.setAttribute('y1', '11');
            vLine.setAttribute('x2', '12');
            vLine.setAttribute('y2', '17');
            addFolderSvg.appendChild(vLine);

            const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hLine.setAttribute('x1', '9');
            hLine.setAttribute('y1', '14');
            hLine.setAttribute('x2', '15');
            hLine.setAttribute('y2', '14');
            addFolderSvg.appendChild(hLine);

            addFolderBtn.appendChild(addFolderSvg);
            this.addEventListener(addFolderBtn, 'click', this.handleCreateFolder.bind(this));
            toolbar.appendChild(addFolderBtn);

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'starred-toolbar-search';
            searchInput.placeholder = '搜索收藏...';
            searchInput.autocomplete = 'off';

            this.addEventListener(searchInput, 'input', (function(e) {
                clearTimeout(this.searchTimer);
                var self = this;
                this.searchTimer = setTimeout(function() {
                    self.setState('searchQuery', e.target.value.trim().toLowerCase());
                    self.updateList();
                }, 250);
            }).bind(this));

            this.addEventListener(searchInput, 'keydown', (function(e) {
                if (e.key === 'Escape') {
                    const input = this.getDomRef('searchInput');
                    if (input) input.value = '';
                    this.setState('searchQuery', '');
                    this.updateList();
                }
            }).bind(this));

            this.setDomRef('searchInput', searchInput);
            toolbar.appendChild(searchInput);
            container.appendChild(toolbar);

            const listContainer = document.createElement('div');
            listContainer.className = 'starred-list-tree';
            this.setDomRef('listContainer', listContainer);
            container.appendChild(listContainer);

            return container;
        }

        mounted() {
            super.mounted();
            this.updateList();

            this.addStorageListener((function() {
                if (window.panelModal && window.panelModal.currentTabId === 'starred') {
                    this.updateList();
                }
            }).bind(this));
        }

        unmounted() {
            super.unmounted();
        }

        async updateList() {
            const listContainer = this.getDomRef('listContainer');
            if (!listContainer) return;

            if (window.globalTooltipManager && typeof window.globalTooltipManager.forceHideAll === 'function') {
                try { window.globalTooltipManager.forceHideAll(); } catch(e) {}
            }

            const tree = await this.folderManager.getStarredByFolder();
            listContainer.innerHTML = '';

            const hasData = tree.folders.length > 0 || tree.uncategorized.length > 0;

            if (!hasData) {
                listContainer.innerHTML = '<div class="starred-empty">\u6682\u65e0\u6536\u85cf\u5185\u5bb9<br><span style="font-size:12px;color:#9ca3af">\u957f\u6309\u65f6\u95f4\u8f74\u4e0a\u7684\u5706\u70b9\u5373\u53ef\u6536\u85cf</span></div>';
                return;
            }

            this.renderUncategorized(tree.uncategorized, listContainer, tree.folders.length === 0);

            for (var i = 0; i < tree.folders.length; i++) {
                this.renderFolder(tree.folders[i], listContainer, 0);
            }

            var searchQuery = this.getState('searchQuery');
            if (searchQuery && listContainer.children.length === 0) {
                listContainer.innerHTML = '<div class="starred-empty">\u672a\u627e\u5230\u5339\u914d\u7684\u6536\u85cf<br><span style="font-size:12px;color:#9ca3af">\u5173\u952e\u8bcd\uff1a' + this.escapeHtml(searchQuery) + '</span></div>';
            }
        }

        renderFolder(folder, container, level) {
            level = level || 0;
            var searchQuery = this.getState('searchQuery');
            var folderStates = this.getPersistentState('folderStates');

            var folderNameMatches = searchQuery && folder.name.toLowerCase().indexOf(searchQuery) !== -1;

            var filteredItems = searchQuery
                ? (folderNameMatches ? folder.items : this.filterItems(folder.items, searchQuery))
                : folder.items;

            var hasMatchingChildren = false;
            if (folder.children) {
                for (var ci = 0; ci < folder.children.length; ci++) {
                    var child = folder.children[ci];
                    var childMatches = searchQuery && child.name.toLowerCase().indexOf(searchQuery) !== -1;
                    var childHasItems = this.filterItems(child.items || [], searchQuery).length > 0;
                    if (childMatches || childHasItems) {
                        hasMatchingChildren = true;
                        break;
                    }
                }
            }

            if (searchQuery && !folderNameMatches && filteredItems.length === 0 && !hasMatchingChildren) {
                return;
            }

            var isExpanded = searchQuery ? true : (folderStates[folder.id] === true);

            var folderElement = document.createElement('div');
            folderElement.className = 'ait-folder-item ait-folder-level-' + level;
            folderElement.dataset.folderId = folder.id;

            var folderHeader = document.createElement('div');
            folderHeader.className = 'ait-folder-header';

            var toggleIcon = document.createElement('span');
            toggleIcon.className = 'ait-folder-toggle' + (isExpanded ? ' expanded' : '');
            toggleIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"></polyline></svg>';
            toggleIcon.addEventListener('click', (function() { this.toggleFolder(folder.id); }).bind(this));
            folderHeader.appendChild(toggleIcon);

            var folderInfo = document.createElement('div');
            folderInfo.className = 'ait-folder-info';

            var totalItems = this._countAllItems(folder);

            folderInfo.innerHTML = '<span class="ait-folder-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></span>' +
                '<span class="ait-folder-name">' + this.escapeHtml(folder.name) + '</span>' +
                '<span class="ait-folder-count">(' + totalItems + ')</span>';

            folderInfo.style.cursor = 'pointer';
            folderInfo.addEventListener('click', (function() { this.toggleFolder(folder.id); }).bind(this));
            folderHeader.appendChild(folderInfo);

            var actionsBtn = document.createElement('button');
            actionsBtn.className = 'ait-folder-action-btn';
            actionsBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
            actionsBtn.addEventListener('click', (function(e) { e.stopPropagation(); this.showFolderActions(e, folder.id); }).bind(this));
            folderHeader.appendChild(actionsBtn);

            folderElement.appendChild(folderHeader);

            var folderBody = document.createElement('div');
            folderBody.className = 'ait-folder-body' + (isExpanded ? ' expanded' : '');

            for (var fi = 0; fi < filteredItems.length; fi++) {
                folderBody.appendChild(this.renderStarredItem(filteredItems[fi]));
            }

            if (folder.children) {
                for (var ci = 0; ci < folder.children.length; ci++) {
                    this.renderFolder(folder.children[ci], folderBody, level + 1);
                }
            }

            folderElement.appendChild(folderBody);
            container.appendChild(folderElement);
        }

        filterItems(items, query) {
            var result = [];
            for (var i = 0; i < items.length; i++) {
                if (this.matchesSearch(items[i], query)) {
                    result.push(items[i]);
                }
            }
            return result;
        }

        renderUncategorized(items, container, isOnlyDefault) {
            if (!items || items.length === 0) return;

            if (isOnlyDefault) {
                for (var i = 0; i < items.length; i++) {
                    container.appendChild(this.renderStarredItem(items[i]));
                }
                return;
            }

            var folderElement = document.createElement('div');
            folderElement.className = 'ait-folder-item ait-folder-level-0';

            var folderHeader = document.createElement('div');
            folderHeader.className = 'ait-folder-header';

            var folderInfo = document.createElement('div');
            folderInfo.className = 'ait-folder-info';
            folderInfo.innerHTML = '<span class="ait-folder-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></span>' +
                '<span class="ait-folder-name">\u9ed8\u8ba4\u6536\u85cf</span>' +
                '<span class="ait-folder-count">(' + items.length + ')</span>';

            folderHeader.appendChild(folderInfo);
            folderElement.appendChild(folderHeader);

            var folderBody = document.createElement('div');
            folderBody.className = 'ait-folder-body expanded';
            for (var i = 0; i < items.length; i++) {
                folderBody.appendChild(this.renderStarredItem(items[i]));
            }
            folderElement.appendChild(folderBody);
            container.appendChild(folderElement);
        }

        renderStarredItem(item) {
            var el = document.createElement('div');
            el.className = 'starred-item';
            el.dataset.turnId = item.turnId;
            el.dataset.url = item.url || '';

            var timeStr = '';
            if (item.timestamp) {
                try {
                    timeStr = new Date(item.timestamp).toLocaleDateString();
                } catch(e) { timeStr = ''; }
            }

            var themeText = item.theme || '\u6574\u4e2a\u5bf9\u8bdd';
            var platformText = this.getPlatformName(item.url);

            el.innerHTML =
                '<div class="starred-item-main">' +
                '<div class="starred-item-theme">' + this.escapeHtml(themeText) + '</div>' +
                '<div class="starred-item-meta">' +
                '<span class="starred-item-platform">' + this.escapeHtml(platformText) + '</span>' +
                '<span class="starred-item-time">' + this.escapeHtml(timeStr) + '</span>' +
                '</div></div>' +
                '<button class="starred-item-delete" title="\u53d6\u6d88\u6536\u85cf">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>' +
                '</button>';

            var self = this;
            el.addEventListener('click', function(e) {
                if (e.target.closest('.starred-item-delete')) return;
                self.handleNavigate(item);
            });

            el.querySelector('.starred-item-delete').addEventListener('click', function(e) {
                e.stopPropagation();
                self.handleUnstar(item);
            });

            return el;
        }

        getPlatformName(url) {
            if (!url) return 'AI';
            if (url.indexOf('chatgpt.com') !== -1 || url.indexOf('openai.com') !== -1) return 'ChatGPT';
            if (url.indexOf('gemini.google.com') !== -1) return 'Gemini';
            if (url.indexOf('deepseek.com') !== -1) return 'DeepSeek';
            if (url.indexOf('claude.ai') !== -1) return 'Claude';
            if (url.indexOf('perplexity.ai') !== -1) return 'Perplexity';
            if (url.indexOf('kimi.com') !== -1 || url.indexOf('moonshot.cn') !== -1) return 'Kimi';
            if (url.indexOf('qianwen.com') !== -1) return '\u901a\u4e49';
            if (url.indexOf('yiyan.baidu.com') !== -1) return '\u6587\u5fc3';
            if (url.indexOf('doubao.com') !== -1) return '\u8c46\u5305';
            if (url.indexOf('yuanbao.tencent.com') !== -1) return '\u5143\u5b9d';
            if (url.indexOf('grok.com') !== -1) return 'Grok';
            return 'AI';
        }

        matchesSearch(item, query) {
            if (!query) return true;
            var text = (item.theme || '');
            return text.toLowerCase().indexOf(query) !== -1;
        }

        _countAllItems(folder) {
            var count = (folder.items || []).length;
            if (folder.children) {
                for (var i = 0; i < folder.children.length; i++) {
                    count += this._countAllItems(folder.children[i]);
                }
            }
            return count;
        }

        toggleFolder(folderId) {
            var states = { ...this.getPersistentState('folderStates') };
            states[folderId] = !states[folderId];
            this.setPersistentState('folderStates', states);
            this.updateList();
        }

        handleCreateFolder() {
            var name = prompt('\u8bf7\u8f93\u5165\u6587\u4ef6\u5939\u540d\u79f0\uff1a');
            if (!name || !name.trim()) return;
            var self = this;
            this.folderManager.createFolder(name.trim()).then(function() {
                self.updateList();
                self.showToast('\u6587\u4ef6\u5939\u5df2\u521b\u5efa');
            }).catch(function(e) {
                self.showToast('\u521b\u5efa\u5931\u8d25\uff1a' + e.message);
            });
        }

        showFolderActions(e, folderId) {
            var existing = document.querySelector('.folder-context-menu');
            if (existing) existing.remove();

            var menu = document.createElement('div');
            menu.className = 'folder-context-menu';

            var renameBtn = document.createElement('button');
            renameBtn.textContent = '\u91cd\u547d\u540d';
            renameBtn.addEventListener('click', (function() {
                menu.remove();
                this.handleRenameFolder(folderId);
            }).bind(this));

            var deleteBtn = document.createElement('button');
            deleteBtn.textContent = '\u5220\u9664';
            deleteBtn.addEventListener('click', (function() {
                menu.remove();
                this.handleDeleteFolder(folderId);
            }).bind(this));

            menu.appendChild(renameBtn);
            menu.appendChild(deleteBtn);

            menu.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;z-index:2147483647';

            document.body.appendChild(menu);

            var self = this;
            setTimeout(function() {
                document.addEventListener('click', function handler() {
                    menu.remove();
                    document.removeEventListener('click', handler);
                });
            }, 0);
        }

        handleRenameFolder(folderId) {
            var self = this;
            this.folderManager.getFolders().then(function(folders) {
                var folder = null;
                for (var i = 0; i < folders.length; i++) {
                    if (folders[i].id === folderId) { folder = folders[i]; break; }
                }
                if (!folder) return;

                var newName = prompt('\u8bf7\u8f93\u5165\u65b0\u540d\u79f0\uff1a', folder.name);
                if (!newName || !newName.trim() || newName.trim() === folder.name) return;

                self.folderManager.updateFolder(folderId, newName.trim()).then(function() {
                    self.updateList();
                    self.showToast('\u5df2\u91cd\u547d\u540d');
                }).catch(function() {
                    self.showToast('\u91cd\u547d\u540d\u5931\u8d25');
                });
            });
        }

        handleDeleteFolder(folderId) {
            var self = this;
            if (!confirm('\u786e\u5b9a\u5220\u9664\u8be5\u6587\u4ef6\u5939\uff1f\u6587\u4ef6\u5939\u5185\u7684\u6536\u85cf\u5c06\u79fb\u81f3\u300c\u9ed8\u8ba4\u6536\u85cf\u300d\u3002')) return;

            this.folderManager.deleteFolder(folderId, null).then(function() {
                self.updateList();
                self.showToast('\u5df2\u5220\u9664');
            }).catch(function() {
                self.showToast('\u5220\u9664\u5931\u8d25');
            });
        }

        handleNavigate(item) {
            if (!item.url) return;
            var sameSite = item.url.indexOf(location.host) !== -1;
            if (sameSite) {
                window.location.href = item.url;
            } else {
                window.open(item.url, '_blank');
            }
        }

        handleUnstar(item) {
            var self = this;
            var key = 'chatTimelineStar:' + item.turnId;
            StarStorageManager.remove(key).then(function() {
                self.updateList();
                self.showToast('\u5df2\u53d6\u6d88\u6536\u85cf');
            }).catch(function() {
                self.showToast('\u53d6\u6d88\u5931\u8d25');
            });
        }

        showToast(message) {
            var existing = document.querySelector('.starred-toast');
            if (existing) existing.remove();

            var toast = document.createElement('div');
            toast.className = 'starred-toast';
            toast.textContent = message;
            document.body.appendChild(toast);

            var self = this;
            requestAnimationFrame(function() {
                toast.classList.add('visible');
            });

            setTimeout(function() {
                toast.classList.remove('visible');
                setTimeout(function() { toast.remove(); }, 300);
            }, 2000);
        }
    }

    window.StarredTab = StarredTab;
})();
