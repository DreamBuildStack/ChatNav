/**
 * NotebookLM Adapter
 * 
 * Google NotebookLM 平台适配器
 * 仅用于支持追问功能，不支持时间线
 */

class NotebookLMAdapter extends SiteAdapter {
    /**
     * 检测是否为 NotebookLM 页面
     */
    matches(url) {
        return url.includes('notebooklm.google.com');
    }

    /**
     * 检测是否在对话页面
     * NotebookLM 的对话页面 URL 格式：/notebook/xxx
     */
    isConversationRoute(pathname) {
        return pathname.includes('/notebook/');
    }

    /**
     * 提取对话 ID
     */
    extractConversationId(pathname) {
        const match = pathname.match(/\/notebook\/([^/?]+)/);
        return match ? match[1] : null;
    }

    // 以下方法不需要实现，因为 timeline 功能不启用
    getUserMessageSelector() {
        return '';
    }
}

