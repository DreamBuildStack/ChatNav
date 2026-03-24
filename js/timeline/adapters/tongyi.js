/**
 * Tongyi (通义千问) Adapter
 * 
 * Supports: qianwen.com
 * Features: 使用 class 前缀识别用户消息和文本内容
 */

class TongyiAdapter extends SiteAdapter {
    constructor() {
        super();
    }

    matches(url) {
        return matchesPlatform(url, 'tongyi');
    }

    getUserMessageSelector() {
        // 基于 class 前缀 "questionItem" 识别用户消息容器
        return '[class*="questionItem"]';
    }

    generateTurnId(element, index) {
        return `tongyi-${index}`;
    }

    extractText(element) {
        // 文本在 bubble-- 开头的 class 中
        const bubble = element.querySelector('[class*="bubble"]');
        const text = (bubble?.textContent || element.textContent || '').trim();
        return text || '[图片或文件]';
    }
    
    getTextContainer(element) {
        return element.querySelector('[class*="bubble"]') || element;
    }

    isConversationRoute(pathname) {
        // 通义千问对话 URL:
        // 对话: /chat/{id}
        // 分享: /share?shareId={id}
        return pathname.startsWith('/chat/') || 
               (pathname.startsWith('/share') && location.search.includes('shareId='));
    }

    extractConversationId(pathname) {
        try {
            // 对话 URL: /chat/{id}
            if (pathname.startsWith('/chat/')) {
                const id = pathname.replace('/chat/', '').split('/')[0];
                if (id) return id;
            }
            // 分享 URL: /share?shareId={id}
            if (pathname.startsWith('/share')) {
                const params = new URLSearchParams(location.search);
                return params.get('shareId');
            }
            return null;
        } catch {
            return null;
        }
    }

    findConversationContainer(firstMessage) {
        // 查找对话容器 - 使用 LCA（最近共同祖先）算法
        return ContainerFinder.findConversationContainer(firstMessage, {
            messageSelector: this.getUserMessageSelector()
        });
    }

    getTimelinePosition() {
        // 通义千问位置配置
        return {
            top: '120px',       // 避开顶部导航栏
            right: '22px',     // 右侧边距
            bottom: '120px',    // 避开底部输入框
        };
    }
    
    getStarChatButtonTarget() {
        // 找到分享图标（通过 data-icon-type 属性），然后找到它的祖先 button 元素，收藏按钮插入到它前面（左边）
        const shareIcon = document.querySelector('[data-icon-type="pcicon-transmission-line"]');
        if (shareIcon) {
            const button = shareIcon.closest('button');
            return button;
        }
        return null;
    }
    
    getDefaultChatTheme() {
        // 从 text-primary text-title-attachment 元素中获取对话标题
        try {
            const titleElement = document.querySelector('.text-primary.text-title-attachment');
            if (titleElement) {
                const title = titleElement.textContent?.trim() || '';
                return title;
            }
            return '';
        } catch {
            return '';
        }
    }
    
    /**
     * 检测 AI 是否正在生成回答
     * 通义千问: 当存在 class 包含 "stop-" 的元素时，表示正在生成
     * @returns {boolean}
     */
    isAIGenerating() {
        const stopElement = document.querySelector('[class*="stop-"]');
        return !!stopElement;
    }
    
}

