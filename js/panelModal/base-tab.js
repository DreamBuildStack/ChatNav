/**
 * BaseTab - Tab 基类
 * 提供自动状态管理机制
 */

class BaseTab {
    constructor() {
        this.id = '';
        this.name = '';
        this.icon = '';
        
        this._transientState = {};
        this._persistentState = {};
        this._persistentStateInitialized = false;
        this._domRefs = {};
        this._listeners = [];
    }
    
    getInitialState() {
        return {
            transient: {},
            persistent: {}
        };
    }
    
    _initializeState() {
        const initialState = this.getInitialState();
        this._transientState = { ...initialState.transient };
        
        if (!this._persistentStateInitialized) {
            this._persistentState = { ...initialState.persistent };
            this._persistentStateInitialized = true;
        }
    }
    
    getState(key) {
        return this._transientState[key];
    }
    
    setState(key, value) {
        this._transientState[key] = value;
    }
    
    getPersistentState(key) {
        return this._persistentState[key];
    }
    
    setPersistentState(key, value) {
        this._persistentState[key] = value;
    }
    
    setDomRef(key, element) {
        this._domRefs[key] = element;
    }
    
    getDomRef(key) {
        return this._domRefs[key];
    }
    
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        this._listeners.push({ element, event, handler, options });
    }
    
    addStorageListener(handler) {
        if (window.StorageAdapter) {
            window.StorageAdapter.addChangeListener(handler);
            this._listeners.push({ type: 'storage', handler });
        }
    }
    
    render() {
        throw new Error('子类必须实现 render() 方法');
    }
    
    mounted() {
        this._initializeState();
    }
    
    unmounted() {
        this._transientState = {};
        this._domRefs = {};
        
        for (const listener of this._listeners) {
            try {
                if (listener.type === 'storage') {
                    if (window.StorageAdapter) {
                        window.StorageAdapter.removeChangeListener(listener.handler);
                    }
                } else {
                    listener.element.removeEventListener(listener.event, listener.handler, listener.options);
                }
            } catch {}
        }
        this._listeners = [];
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
