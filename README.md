# dcat-iframe-tab（维护 fork）

基于 [mosiboom/dcat-iframe-tab](https://github.com/mosiboom/dcat-iframe-tab) 1.2.1 的维护 fork，包名 **`yuan1998/dcat-iframe-tab`**。

上游为 dcat-admin 提供 iframe 架构与标签页管理。本 fork 在此基础上修复了「刷新父窗口回到后台首页」和「刷新后标签标题变成 URL slug」两个问题，并改用自己的 composer 包名独立发版。

- 本仓库：https://github.com/yuan1998/dcat-iframe-tab
- Packagist：https://packagist.org/packages/yuan1998/dcat-iframe-tab
- 上游仓库：https://github.com/mosiboom/dcat-iframe-tab

## 功能

原有功能：

1. 双击关闭标签页
2. 标签页过多时，可用鼠标滚轮选择或按住拖动
3. 右键菜单：关闭所有/其他标签、刷新当前标签、复制标签页链接、新标签页中打开
4. 子页面超链接通过 `iframe-extends=true` / `iframe-tab=true` 打开新标签页

本 fork 新增：

- 标签页路由写入父窗口 URL 的 hash，刷新后恢复当前标签，不再回到 `/admin`
- 标签标题随路由缓存，刷新后保留中文标题（如「广告主账号」），不会退化成 `advertiser_users`
- 菜单匹配按同源归一化地址比较，兼容绝对 URL 与 query 差异
- 改为自有 vendor 名，可独立发布到 Packagist

## 安装

```bash
composer require yuan1998/dcat-iframe-tab:^1.2.4
php artisan vendor:publish --tag=iframe-tab
php artisan vendor:publish --tag=iframe-tab.config   # 可选：配置文件
php artisan vendor:publish --tag=iframe-tab.view     # 可选：自定义视图，建议不要使用
```

从上游 `mosiboom/dcat-iframe-tab` 迁移：

```bash
composer remove mosiboom/dcat-iframe-tab
composer require yuan1998/dcat-iframe-tab:^1.2.4
php artisan vendor:publish --tag=iframe-tab --force
```

`--tag=iframe-tab` 会把 css/js 发布到 `public/vendor/iframe-tab`。`--force` 会覆盖已发布的 css/js；若另外用 `--tag=iframe-tab.view --force` 覆盖过视图，需要重新合并项目自定义内容（如 `sidebar-dark-white`）。

PHP 命名空间、ServiceProvider（`Mosiboom\DcatIframeTab\IframeTabProvider`）与 helper 保持上游不变——Laravel 自动发现按类名工作，与 composer 包名无关，所以视图、配置、helper 均无需改动。

## 更新

版本记录见 [Releases](https://github.com/yuan1998/dcat-iframe-tab/releases) 或 [Packagist](https://packagist.org/packages/yuan1998/dcat-iframe-tab)。

```bash
composer update yuan1998/dcat-iframe-tab
php artisan vendor:publish --tag=iframe-tab --force
```

升级后如浏览器仍加载旧的 `tab-hash.js`，请强刷（Ctrl+F5）或给脚本 URL 加版本号。

## 配置

配置文件在 `config/iframe_tab.php`：

```php
return [
    # 是否开启iframe_tab
    'enable'                => env('START_IFRAME_TAB', true),
    # 底部设置
    'footer_setting'        => [
        'copyright'         => env('APP_NAME', ''),
        'app_version'       => env('APP_VERSION', ''),
        # 是否将底部置于菜单下
        'use_menu'          => true
    ],
    # 是否开启标签页缓存
    'cache'                 => env('IFRAME_TAB_CACHE', false),
    # 更改dialog表单默认宽高
    'dialog_area_width'     => env('IFRAME_TAB_DIALOG_AREA_WIDTH', '50%'),
    'dialog_area_height'    => env('IFRAME_TAB_DIALOG_AREA_HEIGHT', '90vh'),
    # iframe-tab占用的路由 默认 '/'
    'router'                => '/',
    'domain'                => null,
    # 是否开启懒加载模式
    'lazy_load'              => true
];
```

## 扩展接口

1. 子页面可引入 `public/vendor/iframe-tab/js/extend.js`，或调用父窗口的 `window.iframeTabParent` 全局对象
2. 超链接打开新标签页：

```html
<a iframe-extends=true iframe-tab=true href="/admin/users">添加新的标签页</a>
```

## 标签页路由 hash（本 fork 改动详情）

上游 1.2.1 在未开启标签缓存时，每次刷新父窗口只重建首页标签，会回到后台首页。本 fork 新增 `tab-hash.js`：

- 打开/切换/关闭标签后，把当前标签 iframe 的路由写入父窗口 URL 的 hash（`#/admin/users?x=1`），使用 `history.replaceState`，不产生多余历史记录
- 刷新时读取 hash 恢复标签：优先复用左侧菜单点击（归一化匹配，兼容绝对 URL 与 query 差异）；菜单里没有的深层路由直接构造标签
- 标签标题随路由缓存到 `sessionStorage`，恢复无菜单项路由时保留中文标题，不退化成 URL slug
- 监听 `hashchange`，支持手动改 hash / 前进后退
- 只接受同源站内路径，拒绝 `javascript:`、`data:`、`//外部域`、跨源地址与 `logout`

相关文件：

- `src/assets/js/tab-hash.js`：源码
- `src/assets/js/compress/tab-hash.js`：`vendor:publish` 发布到 `public/vendor/iframe-tab/js/tab-hash.js`
- `src/resource/views/vertical.blade.php`：在 `base.js` 之后引入补丁
- `tests/tab-hash.node.js`：无浏览器逻辑测试

```bash
node tests/tab-hash.node.js                 # 默认测源码
node tests/tab-hash.node.js <JS文件路径>    # 也可指定发布产物
```

## 维护

- `upstream` remote 指向上游仓库，`origin` 指向本仓库
- 同步上游：`git fetch upstream && git merge upstream/master`，注意处理 `tab-hash.js` 与 `vertical.blade.php` 的冲突
- 发版：提交改动后打 semver tag（如 `1.2.5`），`git push origin master && git push origin 1.2.5`；Packagist 通过 GitHub webhook 自动更新，未配置 webhook 时需在 Packagist 手动点 `Update`
