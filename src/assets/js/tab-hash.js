/*
 * 将当前激活标签页的页面路由同步到父窗口 URL 的 hash 中，
 * 刷新页面时按 hash 恢复标签页，避免回到后台首页。
 *
 * 依赖 base.js 暴露的 window.iframeTabParent，需在 base.js 之后加载。
 */
$(function () {
    var parent = window.iframeTabParent;
    if (!parent || !parent.iframeTab || !parent.iframeTabTemplate) {
        return;
    }

    var tab = parent.iframeTab;
    var template = parent.iframeTabTemplate;
    var swiper = parent.swiper;
    var elements = parent.elements;
    var TITLE_KEY_PREFIX = 'dcat-iframe-tab-title:';
    var MENU_SELECTOR = '.main-menu a[href], .main-sidebar a[href], .dropdown-menu a[href]';

    /* 只接受同源站内地址，避免外部页面/伪协议被写入 iframe */
    function safeUrl(raw) {
        if (!raw || typeof raw !== 'string') return '';
        raw = raw.trim();
        if (!raw || raw === '#' || raw.indexOf('//') === 0) return '';
        if (/^(javascript|data|vbscript):/i.test(raw)) return '';

        var parsed;
        try {
            parsed = new URL(raw, window.location.href);
        } catch (e) {
            return '';
        }
        if (parsed.origin !== window.location.origin) return '';
        if (parsed.pathname.indexOf('logout') !== -1) return '';

        return parsed.pathname + parsed.search + parsed.hash;
    }

    function pathOf(url) {
        return url.split('?')[0].split('#')[0];
    }

    /* 当前激活标签页对应的 iframe 地址与标题 */
    function activeUrl() {
        var $active = elements.iframe_tab.find('.nav-link.active').first();
        if (!$active.length) return '';
        var $iframe = $($active.attr('href')).find('> iframe').first();
        return safeUrl($iframe.attr('src'));
    }

    function activeTitle() {
        var $active = elements.iframe_tab.find('.nav-link.active').first();
        if (!$active.length) return '';
        return String($active.text() || '').trim();
    }

    /* 标签标题与路由一起缓存，刷新后恢复时不必退化成 URL slug */
    function cacheTitle(url, title) {
        if (!url || !title) return;
        try {
            window.sessionStorage.setItem(TITLE_KEY_PREFIX + url, title);
        } catch (e) {}
    }

    function cachedTitle(url) {
        try {
            return window.sessionStorage.getItem(TITLE_KEY_PREFIX + url) || '';
        } catch (e) {
            return '';
        }
    }

    function writeHash(url) {
        url = safeUrl(url);
        var hash = url ? '#' + encodeURI(url) : '';
        if (window.location.hash === hash) return;

        /* replaceState 不产生历史记录，避免后退时被 hash 淹没 */
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
        } else {
            window.location.hash = hash;
        }
    }

    /* 按规范化地址找菜单项：菜单 href 可能是绝对地址或带额外参数 */
    function findMenuLink(url) {
        var links = document.querySelectorAll(MENU_SELECTOR);
        var target = safeUrl(url);
        var targetPath = pathOf(target);
        var i, href, normalized;

        for (i = 0; i < links.length; i++) {
            href = links[i].getAttribute('href');
            normalized = safeUrl(href);
            if (normalized && normalized === target) return $(links[i]);
        }
        /* 退化为路径匹配，兼容 query 差异 */
        for (i = 0; i < links.length; i++) {
            href = links[i].getAttribute('href');
            normalized = safeUrl(href);
            if (normalized && pathOf(normalized) === targetPath) return $(links[i]);
        }
        return null;
    }

    function syncHash() {
        var url = activeUrl();
        cacheTitle(url, activeTitle());
        writeHash(url);
    }

    /* 按地址打开/激活标签页 */
    function openTab(url) {
        url = safeUrl(url);
        if (!url) return;

        var $menu = findMenuLink(url);
        var tabUrl = $menu ? ($menu.attr('href') || url) : url;
        var id = tab.generateID(tabUrl);

        var $exists = elements.iframe_tab.find('#iframe-home-' + id);
        if ($exists.length) {
            $exists.click();
            return;
        }
        /* 菜单里存在该路由时交给 base.js 创建，可复用菜单标题与高亮 */
        if ($menu) {
            $menu.click();
            return;
        }

        /* 无菜单项的路由：优先用刷新前缓存的标签标题，避免显示 URL slug */
        var title = cachedTitle(url);
        if (!title) title = url;

        swiper.appendSlide(template.tabItem(title, id));
        elements.iframe_tabContent.append(template.tabContentItem(url, id));

        tab.removeTabBarStyle();
        var $link = $('#iframe-home-' + id);
        var $pane = $('#iframe-' + id);
        $link.addClass('active').attr('aria-selected', 'true');
        $pane.addClass('active show');
        swiper.slideTo($link.parents('.nav-item').index());
        swiper.updateSlides();
        tab.cacheUpdateTabBar($link);
    }

    function readHash() {
        var raw = window.location.hash.slice(1);
        if (!raw) return '';
        try {
            return safeUrl(decodeURI(raw));
        } catch (e) {
            return '';
        }
    }

    /* 委托事件晚于 base.js 的同事件绑定，等 DOM 状态更新后再同步 */
    $(document).on('click', MENU_SELECTOR, function () {
        setTimeout(syncHash, 0);
    });
    $(document).on('click', '#iframe-tab .nav-link', function () {
        setTimeout(syncHash, 0);
    });
    $(document).on('click', '.iframe-tab-close-btn', function () {
        setTimeout(syncHash, 0);
    });

    /* 手动修改 hash / 浏览器前进后退 */
    $(window).on('hashchange', function () {
        var url = readHash();
        if (!url) {
            syncHash();
            return;
        }
        if (url !== activeUrl()) openTab(url);
    });

    /* 刷新恢复：此时 base.js 的 init() 已完成，首页标签已创建 */
    var restoreUrl = readHash();
    if (restoreUrl && restoreUrl !== activeUrl()) {
        openTab(restoreUrl);
    }
    syncHash();
});
