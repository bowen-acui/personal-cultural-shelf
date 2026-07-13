# 阿崔的精神地图

一个以 The Visible Shelf 为单一视觉参考的个人文化陈列网站。书、影、音各有独立界面；数据数量以每次构建输出为准。

首页支持散落、抖动、整理、漩涡、分类筛选、拖拽和选择五件生成分享图片；另有统一浏览页和关于页面。

## 本地运行

```bash
npm run build:data
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 数据边界

构建脚本只读本机 Obsidian 图书馆，并生成独立的静态数据和封面副本。公开数据只有：

- 作品名称
- 创作者
- 公开分类
- 本地封面
- 书籍完读年月

网站不会读取或发布重点摘抄、ISBN、出版社、完整日期、阅读天数、评分、来源和相关笔记。运行网站不需要 Obsidian、数据库、后台或网络接口。

## 更新收藏

在 Obsidian 中完成录入后重新运行：

```bash
npm run build:data
```

如果 Obsidian 不在默认位置，可以通过 `OBSIDIAN_VAULT=/path/to/阿崔 npm run build:data` 指定只读数据源。

生成结果位于 `data/media.json` 与 `public/covers/`。将代码推送到 GitHub 后，可以使用任意静态托管服务发布。

## 参考站扫描

公开页面、资源、交互状态与响应式规律记录在 `research/THE_VISIBLE_SHELF_AUDIT.md`。实现只复刻浏览器可观察的设计逻辑，不包含参考站私有后端、品牌内容或源码。
