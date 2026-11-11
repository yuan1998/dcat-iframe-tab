# dcat-iframe-tab

## 介绍

这个扩展包基于laravel框架和dcat-admin框架，为解决dcat-admin没有自带兼容iframe架构。使用此扩展包可以构建出一个iframe架构并带有标签页管理的后台框架。

## 功能

1. 双击关闭标签页
2. 当标签页过多时，可通过鼠标滚轮选择或者按住鼠标拖动
3. 支持右键操作（目前支持的操作有：关闭所有标签、关闭其他标签、刷新当前标签、复制标签页链接）

## 安装

运行以下命令：

```
$ composer require mosiboom/dcat-iframe-tab
```

然后运行：

```
# 发布扩展必备文件
$ php artisan vendor:publish --tag=iframe-tab
# 发布扩展配置文件
$ php artisan vendor:publish --tag=iframe-tab.config
# 发布扩展的视图文件(如想自定义某些内容可发布出去，建议不要使用)
$ php artisan vendor:publish --tag=iframe-tab.view
```

`php artisan vendor:publish --tag=iframe-tab` 会将css和js发布`public/vendor/iframe-tab`

## 更新
相关更新内容请关注github的`tag`，里面有每个版本详细的更新：[https://github.com/mosiboom/dcat-iframe-tab/releases](https://github.com/mosiboom/dcat-iframe-tab/releases)

基本迭代更新命令：
```apacheconfig
composer remove mosiboom/dcat-iframe-tab
composer require mosiboom/dcat-iframe-tab:版本号
php artisan vendor:publish --tag=iframe-tab --force
```

其他文件覆盖更新：
```
$ php artisan vendor:publish --tag=iframe-tab --force
$ php artisan vendor:publish --tag=iframe-tab.config --force
```

This will override css and js files to `/public/vendor/laravel-admin-ext/iframe-tabs/`

此操作会覆盖css和js还有配置文件，配置文件可以根据自己的需要来选择是否强制覆盖

## 配置

配置文件在 `config/iframe_tab.php`下dcat-Iframe-tab可提供的配置并不多，根据自己的需要去配置：

```php
return [
    # 是否开启iframe_tab
    'enable'                => env('START_IFRAME_TAB', true),
    # 底部设置
    'footer_setting'        => [
        'copyright'         => env('APP_NAME', ''),
        'app_version'       => env('APP_VERSION', ''),
        # 是否将底部置于菜单下
        'use_menu'          => false
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

## 新增扩展接口和扩展功能

1. 用户可以在子页面引入 `public/vendor/iframe-tab/js/extend.js`文件，或者通过调用`window.iframeTabParent`全局对象来调用父级页面的iframe-tab
2. 引入新功能：超链接监听打开新页面加入iframe-tab：用户可自行定义超链接按钮，以此来打开新标签页页面，通过添加`iframe-extends=true` 和 `iframe-tab=true` 两个属性
```html
<a iframe-extends=true iframe-tab=true href="https://github.com/mosiboom/dcat-iframe-tab">添加新的标签页</a>
```

## 本 Fork 的改动：标签页路由 hash

上游 1.2.1 在未开启标签缓存时，每次刷新父窗口只重建首页标签，会回到后台首页。本 Fork 新增 `tab-hash.js`：

- 打开/切换/关闭标签后，把当前标签 iframe 的路由写入父窗口 URL 的 hash（`#/admin/users?x=1`），使用 `history.replaceState`，不产生多余历史记录
- 刷新时读取 hash 恢复标签：优先复用左侧菜单点击；菜单里没有的深层路由直接构造标签
- 标签标题随路由缓存到 `sessionStorage`，刷新后恢复中文标题（如「广告主账号」），不会退化成 `advertiser_users` 之类的 URL slug
- 菜单匹配按同源归一化地址比较，兼容绝对 URL 与 query 差异
- 监听 `hashchange`，支持手动改 hash / 前进后退
- 只接受同源站内路径，拒绝 `javascript:`、`data:`、`//外部域`、跨源地址与 `logout`

相关文件：

- `src/assets/js/tab-hash.js`：源码
- `src/assets/js/compress/tab-hash.js`：`vendor:publish` 发布到 `public/vendor/iframe-tab/js/tab-hash.js`
- `src/resource/views/vertical.blade.php`：在 `base.js` 之后引入补丁
- `tests/tab-hash.node.js`：无浏览器逻辑测试，`node tests/tab-hash.node.js [JS路径]`

更新项目已发布资源：`php artisan vendor:publish --tag=iframe-tab --force`。该命令会覆盖 `resources/views/vendor/iframe-tab/` 下自定义过的视图，需要重新合并自定义内容。
    
