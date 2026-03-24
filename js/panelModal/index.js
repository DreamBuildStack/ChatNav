/**
 * Panel Modal - 右侧弹出的面板模态框
 * 
 * 功能：
 * - 从右侧滑入/滑出
 * - 支持多个 tab 切换
 * - tab 只显示 icon，悬停显示 tooltip
 * - 点击遮罩层或关闭按钮关闭
 * 
 * 使用方式：
 * window.panelModal.show('starred'); // 打开并显示 starred tab
 * window.panelModal.hide();          // 关闭
 * window.panelModal.registerTab(tab); // 注册新 tab
 */

class PanelModal {
    constructor() {
        this.container = null;
        this.overlay = null;
        this.content = null;
        this.tabsContainer = null;
        this.closeBtn = null;
        
        this.tabs = new Map();
        this.currentTabId = null;
        this.isVisible = false;
        
        this._currentUrl = location.href;
        this._boundHandleUrlChange = this._handleUrlChange.bind(this);
        
        this.init();
    }
    
    init() {
        this.createDOM();
        this.bindEvents();
        this._attachUrlListeners();
    }
    
    createDOM() {
        this.container = document.createElement('div');
        this.container.className = 'ait-panel-modal';
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'ait-panel-modal-overlay';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'ait-panel-modal-wrapper';
        
        const sidebar = document.createElement('div');
        sidebar.className = 'ait-panel-modal-sidebar';
        
        const sidebarHeader = document.createElement('div');
        sidebarHeader.className = 'ait-panel-modal-sidebar-header';
        
        this.closeBtn = document.createElement('button');
        this.closeBtn.className = 'ait-panel-modal-close';
        this.closeBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        
        const sidebarTitle = document.createElement('span');
        sidebarTitle.className = 'ait-panel-modal-sidebar-title';
        sidebarTitle.textContent = 'ChatNav';
        
        sidebarHeader.appendChild(this.closeBtn);
        sidebarHeader.appendChild(sidebarTitle);
        
        this.tabsContainer = document.createElement('div');
        this.tabsContainer.className = 'ait-panel-modal-tabs';
        
        const footer = document.createElement('div');
        footer.className = 'ait-panel-modal-footer';
        let version = '';
        try { version = chrome.runtime.getManifest().version; } catch (e) { version = ''; }
        footer.innerHTML = `<div class="ait-panel-modal-footer-item">v${version}</div>`;
        
        sidebar.appendChild(sidebarHeader);
        sidebar.appendChild(this.tabsContainer);
        sidebar.appendChild(footer);
        
        const main = document.createElement('div');
        main.className = 'ait-panel-modal-main';
        
        const header = document.createElement('div');
        header.className = 'ait-panel-modal-header';
        
        this.titleElement = document.createElement('h2');
        this.titleElement.className = 'ait-panel-modal-title';
        this.titleElement.textContent = 'Panel';
        
        header.appendChild(this.titleElement);
        
        this.content = document.createElement('div');
        this.content.className = 'ait-panel-modal-content';
        
        main.appendChild(header);
        main.appendChild(this.content);
        
        wrapper.appendChild(sidebar);
        wrapper.appendChild(main);
        
        this.container.appendChild(this.overlay);
        this.container.appendChild(wrapper);
        
        document.body.appendChild(this.container);
    }
    
    bindEvents() {
        this.overlay.addEventListener('click', () => { this.hide(); });
        this.closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.hide(); });
    }
    
    _attachUrlListeners() {
        try {
            window.addEventListener('popstate', this._boundHandleUrlChange);
            window.addEventListener('hashchange', this._boundHandleUrlChange);
        } catch (error) {
            console.error('[PanelModal] Failed to attach URL listeners:', error);
        }
    }
    
    _detachUrlListeners() {
        try {
            window.removeEventListener('popstate', this._boundHandleUrlChange);
            window.removeEventListener('hashchange', this._boundHandleUrlChange);
        } catch (error) {
            console.error('[PanelModal] Failed to detach URL listeners:', error);
        }
    }
    
    _handleUrlChange() {
        const newUrl = location.href;
        if (newUrl !== this._currentUrl) {
            this._currentUrl = newUrl;
            if (this.isVisible) {
                this.hide();
            }
        }
    }
    
    registerTab(tab) {
        if (!tab || !tab.id) return;
        if (this.tabs.has(tab.id)) return;
        
        this.tabs.set(tab.id, tab);
        
        const tabButton = document.createElement('button');
        tabButton.className = 'panel-tab';
        tabButton.setAttribute('data-tab-id', tab.id);
        tabButton.setAttribute('aria-label', tab.name);
        
        const icon = document.createElement('span');
        icon.className = 'tab-icon';
        if (typeof tab.icon === 'string' && tab.icon.trim().startsWith('<')) {
            icon.innerHTML = tab.icon;
        } else {
            icon.textContent = tab.icon;
        }
        
        tabButton.appendChild(icon);
        
        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = tab.name;
        tabButton.appendChild(label);
        
        tabButton.addEventListener('click', () => {
            this.switchTab(tab.id);
        });
        
        this.tabsContainer.appendChild(tabButton);
    }
    
    show(tabId = null) {
        if (typeof registerAllTabs === 'function') {
            registerAllTabs();
        }
        
        let targetTabId = tabId;
        
        if (targetTabId && !this.tabs.has(targetTabId)) {
            targetTabId = null;
        }
        
        if (!targetTabId) {
            targetTabId = this.currentTabId && this.tabs.has(this.currentTabId) 
                ? this.currentTabId 
                : this.tabs.keys().next().value;
        }
        
        if (!targetTabId) {
            console.warn('[PanelModal] No tabs registered');
            return;
        }
        
        this.switchTab(targetTabId);
        this.container.classList.add('visible');
        this.isVisible = true;
        document.body.style.overflow = 'hidden';
    }
    
    switchTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        if (this.currentTabId === tabId) return;
        
        if (this.currentTabId) {
            const currentTab = this.tabs.get(this.currentTabId);
            if (currentTab && currentTab.unmounted) {
                currentTab.unmounted();
            }
            
            const currentButton = this.tabsContainer.querySelector(`[data-tab-id="${this.currentTabId}"]`);
            if (currentButton) {
                currentButton.classList.remove('active');
            }
        }
        
        this.content.innerHTML = '';
        const tabContent = tab.render();
        if (tabContent) {
            this.content.appendChild(tabContent);
        }
        
        this.titleElement.textContent = tab.name;
        this.currentTabId = tabId;
        
        const newButton = this.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
        if (newButton) {
            newButton.classList.add('active');
        }
        
        if (tab.mounted) {
            tab.mounted();
        }
    }
    
    hide() {
        this.container.classList.remove('visible');
        this.isVisible = false;
        document.body.style.overflow = '';
        
        if (window.globalTooltipManager) {
            window.globalTooltipManager.forceHideAll();
        }
        
        if (this.currentTabId) {
            const tab = this.tabs.get(this.currentTabId);
            if (tab && tab.unmounted) {
                tab.unmounted();
            }
            
            const currentButton = this.tabsContainer.querySelector(`[data-tab-id="${this.currentTabId}"]`);
            if (currentButton) {
                currentButton.classList.remove('active');
            }
        }
        
        this.content.innerHTML = '';
        this.currentTabId = null;
    }
    
    destroy() {
        this._detachUrlListeners();
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.tabs.clear();
        this.container = null;
        this.overlay = null;
        this.content = null;
        this.tabsContainer = null;
        this.closeBtn = null;
    }
}

if (typeof window !== 'undefined') {
    window.panelModal = new PanelModal();
}
