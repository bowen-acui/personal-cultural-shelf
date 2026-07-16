# 阿崔的精神地图

一个以 The Visible Shelf 为单一视觉参考的个人文化陈列网站。书、影、音各有独立界面；数据数量以每次构建输出为准。

首页支持散落、抖动、整理、漩涡、分类筛选、拖拽和选择五件生成分享图片；另有统一浏览页和关于页面。

## 本地运行

```bash
npm run build:data
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

Railway 使用 `npm start` 启动同一个静态站点，并自动读取平台提供的 `PORT` 环境变量。

## 修改前端代码

浏览器对 JS 的缓存是 `max-age=3600`，页面脚本和 `lib/` 模块各自独立缓存。若只给入口加版本号，发版后一小时内用户可能加载到「新 app.js + 旧 lib」的混合版本。

因此规则只有一条：**改任何 JS 后，全局搜索 `?v=` 并统一 +1。**

```bash
grep -rn '?v=' *.html app.js catalog-page.js lib/
```

输出的每一处版本号必须一致——HTML 里的 `<script src>` 与 `app.js` / `catalog-page.js` 顶部的 `lib/` import 是同一个版本，一起改。

## 数据边界

构建脚本只读本机 Obsidian 图书馆，并生成独立的静态数据和封面副本。公开数据只有：

- 作品名称
- 创作者
- 公开分类
- 本地封面
- 书籍完读年月
- 可选的个人评分（1–5）

网站不会读取或发布重点摘抄、ISBN、出版社、完整日期、阅读天数、来源和相关笔记。运行网站不需要 Obsidian、数据库、后台或网络接口。

## 更新收藏

在 Obsidian 中完成录入后重新运行：

```bash
npm run build:data
```

评分使用 frontmatter 字段 `评分: 1` 到 `评分: 5`；不填写时，详情卡显示五个空点。

影、音的置顶顺序由 frontmatter 字段 `置顶:` 决定，数字越小越靠前，不填写的排在所有置顶之后（书按评分排序，不看这个字段）。想换偏好只改笔记，不用改代码。该字段只参与构建时排序，不会写进 `data/media.json`。

如果 Obsidian 不在默认位置，可以通过 `OBSIDIAN_VAULT=/path/to/阿崔 npm run build:data` 指定只读数据源。

生成结果位于 `data/media.json` 与 `public/covers/`。构建会为每张封面生成 320px 与 720px 的 WebP 响应式资源，页面通过 `srcset` 按设备选择尺寸。字体文件（包含详情背面的霞鹜文楷）与 favicon 也随站点本地发布，因此运行时不依赖第三方字体 CDN。将代码推送到 GitHub 后，可以使用任意静态托管服务发布。

## 参考站扫描

公开页面、资源、交互状态与响应式规律记录在 `research/THE_VISIBLE_SHELF_AUDIT.md`。实现只复刻浏览器可观察的设计逻辑，不包含参考站私有后端、品牌内容或源码。
