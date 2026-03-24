/**
 * Tab Registry - Tab 注册管理
 */

function getTabClass(name) {
    switch (name) {
        case 'StarredTab': return typeof StarredTab !== 'undefined' ? StarredTab : null;
        default: return null;
    }
}

const TAB_CONFIG = [
    { id: 'starred', className: 'StarredTab' }
];

function registerAllTabs() {
    if (!window.panelModal) return;
    
    const pm = window.panelModal;
    
    for (const config of TAB_CONFIG) {
        if (pm.tabs.has(config.id)) continue;
        
        const TabClass = getTabClass(config.className);
        if (!TabClass) continue;
        
        pm.registerTab(new TabClass());
    }
}
