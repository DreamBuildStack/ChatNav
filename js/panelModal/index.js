/**
 * Panel Modal - 右侧弹出的面板模态框
 */

(function() {
    if (window._panelModalInitialized) return;
    window._panelModalInitialized = true;

    class PanelModal {
        constructor() {
            this.container = null;
            this.overlay = null;
            this.content = null;
            this.tabsContainer = null;
            this.closeBtn = null;
            this.titleElement = null;

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
            this._registerDefaultTabs();
        }

        _registerDefaultTabs() {
            if (typeof StarredTab !== 'undefined' && this.tabs.size === 0) {
                this.registerTab(new StarredTab());
            }
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
            this.closeBtn.setAttribute('aria-label', 'Close');

            const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            closeSvg.setAttribute('width', '20');
            closeSvg.setAttribute('height', '20');
            closeSvg.setAttribute('viewBox', '0 0 24 24');
            closeSvg.setAttribute('fill', 'none');
            closeSvg.setAttribute('stroke', 'currentColor');
            closeSvg.setAttribute('stroke-width', '2');

            const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line1.setAttribute('x1', '18');
            line1.setAttribute('y1', '6');
            line1.setAttribute('x2', '6');
            line1.setAttribute('y2', '18');

            const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line2.setAttribute('x1', '6');
            line2.setAttribute('y1', '6');
            line2.setAttribute('x2', '18');
            line2.setAttribute('y2', '18');

            closeSvg.appendChild(line1);
            closeSvg.appendChild(line2);
            this.closeBtn.appendChild(closeSvg);

            const sidebarTitle = document.createElement('span');
            sidebarTitle.className = 'ait-panel-modal-sidebar-title';
            sidebarTitle.textContent = 'ChatNav';

            sidebarHeader.appendChild(this.closeBtn);
            sidebarHeader.appendChild(sidebarTitle);

            this.tabsContainer = document.createElement('div');
            this.tabsContainer.className = 'ait-panel-modal-tabs';

            const footer = document.createElement('div');
            footer.className = 'ait-panel-modal-footer';
            const footerItem = document.createElement('div');
            footerItem.className = 'ait-panel-modal-footer-item';
            let version = '1.0';
            try { version = chrome.runtime.getManifest().version; } catch (e) {}
            footerItem.textContent = 'v' + version;
            footer.appendChild(footerItem);

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
            this.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
            });
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
            } catch (error) {}
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

            if (typeof tab.icon === 'string' && tab.icon.indexOf('<svg') === 0) {
                const temp = document.createElement('div');
                temp.innerHTML = tab.icon;
                const svgEl = temp.firstChild;
                if (svgEl) {
                    icon.appendChild(svgEl);
                } else {
                    icon.textContent = tab.icon;
                }
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

        show(tabId) {
            let targetTabId = tabId || null;

            if (!targetTabId || !this.tabs.has(targetTabId)) {
                targetTabId = this.currentTabId && this.tabs.has(this.currentTabId)
                    ? this.currentTabId
                    : (this.tabs.keys().next().value || null);
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

            if (this.currentTabId && this.currentTabId !== tabId) {
                const currentTab = this.tabs.get(this.currentTabId);
                if (currentTab && typeof currentTab.unmounted === 'function') {
                    try { currentTab.unmounted(); } catch(e) {}
                }
                const currentButton = this.tabsContainer.querySelector('[data-tab-id="' + this.currentTabId + '"]');
                if (currentButton) currentButton.classList.remove('active');
            }

            if (this.content) this.content.innerHTML = '';
            const tabContent = tab.render();
            if (tabContent && this.content) {
                this.content.appendChild(tabContent);
            }

            if (this.titleElement) this.titleElement.textContent = tab.name;
            this.currentTabId = tabId;

            const newButton = this.tabsContainer.querySelector('[data-tab-id="' + tabId + '"]');
            if (newButton) newButton.classList.add('active');

            if (typeof tab.mounted === 'function') {
                try { tab.mounted(); } catch(e) { console.error('[PanelModal] mounted error:', e); }
            }
        }

        hide() {
            if (this.container) this.container.classList.remove('visible');
            this.isVisible = false;
            document.body.style.overflow = '';

            if (window.globalTooltipManager && typeof window.globalTooltipManager.forceHideAll === 'function') {
                try { window.globalTooltipManager.forceHideAll(); } catch(e) {}
            }

            if (this.currentTabId) {
                const tab = this.tabs.get(this.currentTabId);
                if (tab && typeof tab.unmounted === 'function') {
                    try { tab.unmounted(); } catch(e) {}
                }
                const currentButton = this.tabsContainer.querySelector('[data-tab-id="' + this.currentTabId + '"]');
                if (currentButton) currentButton.classList.remove('active');
            }

            if (this.content) this.content.innerHTML = '';
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

    window.panelModal = new PanelModal();

    window._showPanelModal = function(tabId) {
        if (window.panelModal) {
            window.panelModal.show(tabId);
        }
    };
})();
