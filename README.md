# 阿崔的精神地图

一个以 The Visible Shelf 为单一视觉参考的个人文化陈列网站。书、影、音各有独立界面；数据数量以每次构建输出为准。

首页支持散落、整理、漩涡、分类筛选、拖拽和选择五件生成分享图片；另有统一浏览页和关于页面。

## 本地运行

```bash
npm run data:check
npm run build:data
npm start
```

然后访问 `http://127.0.0.1:4173/`。`npm start` 只用于本地预览。

## GitHub Pages 部署

网站地址是 `https://bowen-acui.github.io/personal-cultural-shelf/`。代码合并到 `main` 后，GitHub Actions 先运行测试，成功后发布页面、脚本、样式、生成数据和公开资源。仓库的 Pages 发布来源须设为 **GitHub Actions**。

## 修改前端代码

本地服务器为 JS/CSS 与动态霞鹜文楷子集使用 `no-cache` 和 ETag；GitHub Pages 的缓存由平台控制。入口、模块、样式与字体文件彼此独立。若只给入口加版本号，用户可能加载到新旧资源混合的页面。

因此规则只有一条：**改任何前端静态资源后，全局搜索 `?v=` 并统一 +1。**

```bash
grep -rn '?v=' *.html *.css app.js catalog-page.js lib/
```

输出的每一处版本号必须一致——HTML 的脚本/样式引用、JS 的 `lib/` import 与 CSS 的字体 URL 使用同一个版本，一起改。

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

遇到确认没有正式封面的书籍时，在书籍笔记中运行下列命令，会按 `书名` 生成只显示书名的默认封面，并把图片路径写回该笔记的 `封面` 字段：

```bash
node scripts/generate-default-book-cover.mjs "Project：存放项目的必要信息/閱讀書單 Book Tracker/書櫃/书名.md"
```

只对明确确认没有正式封面的笔记使用；已有封面或路径损坏时先核对来源，不要用默认图覆盖。

评分使用 frontmatter 字段 `评分: 1` 到 `评分: 5`；不填写时，详情卡显示五个空点。

书籍按评分从 5 星到 1 星排列。音乐先按 frontmatter 字段 `艺人顺序:` 分组（陈奕迅 `0`、Gareth.T `1`、Billie Eilish `2`、陈娴静 `3`），同一艺人组内再按 `置顶:` 与标题排列；未填写艺人顺序的组排在后面。影、音的组内置顶顺序由 frontmatter 字段 `置顶:` 决定，数字越小越靠前，不填写的排在所有置顶之后。想换偏好只改笔记，不用改代码；这些字段只参与构建时排序，不会写进 `data/media.json`。

如果 Obsidian 不在默认位置，可以通过 `OBSIDIAN_VAULT=/path/to/阿崔 npm run build:data` 指定只读数据源。

生成结果位于 `data/media.json` 与 `public/covers/`。构建会为每张封面生成 320px 与 720px 的 WebP 响应式资源，并记录真实封面宽高比，页面通过 `srcset` 按设备选择尺寸。`npm run data:check` 只构建临时候选并在存在已完成但缺封面的 Obsidian 笔记时失败；`npm run build:data` 只有候选通过后才原子替换正式数据、封面与字体。完整霞鹜文楷及许可证保存在 `assets/fonts/`，仅用于构建；公开站点只提供子集 WOFF2，不依赖第三方字体 CDN。更新数据后须提交生成结果到 GitHub，合并到 `main` 才会发布到 Pages。

正式提升使用项目级 `.library-promotion.lock` 防止并发。若异常退出留下锁，先核对锁内 PID 和同步进程；确认无人运行后再处理锁。若同时存在 `.task2-library-backup`，先核对恢复状态，不要直接删除备份。

## 参考站扫描

公开页面、资源、交互状态与响应式规律记录在 `research/THE_VISIBLE_SHELF_AUDIT.md`。实现只复刻浏览器可观察的设计逻辑，不包含参考站私有后端、品牌内容或源码。
