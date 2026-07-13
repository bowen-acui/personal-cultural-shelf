# The Visible Shelf 运行时设计与架构审计

扫描日期：2026-07-12  
唯一参考：https://thevisibleshelf.com/

## 方法与边界

本次使用 LazyCodex 4.17.0 的 `clone-from-url` 工作流。该工作流采用 `JCodesMore/ai-website-cloner-template` 的 MIT 运行时侦察方法：真实浏览器导航、`getComputedStyle`、交互状态驱动、响应式扫描、资源清单和视觉截图。

扫描只读取浏览器能公开访问的客户端内容。没有获取服务端源码、部署凭据、私有数据或后台接口，也不复制原站品牌文案和书籍资源到个人项目。

原始证据位于 `research/reference/`：

- `home-runtime-1280.json`：首页运行时元素与样式
- `home-layout-states.json`：布局和操作状态
- `page-scans-1280.json`：公开页面模板
- `responsive-home.json`：375、768、1280 三档响应式
- `asset-manifest.json`：公开资源清单
- `inline-architecture.json`：客户端函数与事件结构
- `*.png`：各页面和状态截图

## 公开页面地图

| 页面 | 作用 | 结构特征 |
|---|---|---|
| `/` | 艺术入口 | 295 个绝对定位封面、固定头部、固定操作栏 |
| `/books` | 编辑式 Browse | Masonry 书桌、搜索、主题集合、分类、精选、新增 |
| `/library` | 高密度资料库 | 297 张图、317 个按钮、搜索和多维筛选 |
| `/lists.html` | 人工策展 | 七组编辑清单，文字优先 |
| `/stats` | 收藏统计 | 总量、主题、分类、最高评分 |
| `/timeline` | 阅读时间线 | 295 张封面按时间组织 |
| `/book/...` | 单品详情 | 封面、基础信息、评分、短评、Why it matters、Quick Take、音频、关联项 |
| `/about` | 收藏者叙事 | 项目说明、影响图谱、主题、书到项目的关系 |
| `/shelf-match` | 互动匹配 | 两步选择器与匹配结果 |
| `/quiz` | 推荐问答 | 极简问答流 |
| `/press` | 品牌传播 | 数据、故事角度、引用、新闻稿、链接 |

个人版本迁移收藏展示、浏览、时间线、统计和详情骨架。Shelf Match、Quiz、Press 属于原作者品牌运营层，不迁移。

## 首页信息架构

1. 固定头部：左侧品牌和收藏数量，右侧少量全站入口。
2. 主画布：所有封面都是可交互的真实 DOM 链接，不是背景截图。
3. 分类层：64 个分类按钮常驻 DOM，由 Filter 控制可见状态。
4. 固定操作栏：数量、Shake、Filter、Tidy、Scatter、Vortex、Share、Browse。
5. 分享层：选择五本书、生成分享图、下载 PNG、复制链接。
6. 页脚：策展者身份、邮件订阅、全站页面和其他项目。

## 操作逻辑

### Scatter

- 默认艺术形态。
- 封面绝对定位，宽度约 110-155px，旋转约正负 20 度，允许越出屏幕边缘。
- 默认转换：`box-shadow 0.3s, transform 0.3s`。
- Z 轴层级按对象顺序递增。

### Shake

- 重新生成随机位置、角度和尺寸。
- 不改变数据，只改变展示布局。
- 操作后保持 Scatter 语义。

### Tidy

- 封面整理成 80px 宽网格，首行 `top: 90px`，横向间距约 12px。
- 所有旋转归零。
- 动画：`0.7s cubic-bezier(0.34, 1.56, 0.64, 1)`，每本约 18ms 递增延迟。
- 激活按钮背景为 `rgb(196 93 62)`。

### Vortex

- 所有封面围绕画布中心形成旋涡。
- 缩放约 0.3，按序反向 Z 轴堆叠。
- 动画：`0.9s cubic-bezier(0.2, 1.6, 0.4, 1)`，每本约 8ms 递增延迟。
- 激活按钮使用同一陶土色。

### Filter

- 打开时显示 64 个胶囊标签。
- 标签色用于分类识别；胶囊半径 16px。
- 选中分类后，无关封面不会被删除，而是降至 `opacity: 0.12`。
- 堆叠状态同时转换位置、尺寸、透明度和滤镜。

### Share

- 进入 Pick Mode 后，所有封面透明度降至 0.6。
- 顶部提示“选择五本”，提供 Cancel。
- 选满五本后生成方形分享图，可下载 PNG 或复制链接。
- 原站使用 `html2canvas` 完成客户端图片生成。

### 单品操作

- 鼠标拖动：`mousedown/mousemove/mouseup`。
- 触摸拖动：`touchstart/touchmove/touchend`。
- 双击进入详情：`dblclick`。
- 窗口变化重新计算布局：`resize`。
- 客户端入口函数包括 `initTablePile`、`seededRandom`、`layout`、`endDrag`、`toggleCategory`、`restoreFromUrl`、`enterPickMode`、`updatePickCount` 和 `showToast`。

## 运行时设计令牌

### 字体

- 标识与大标题：Instrument Serif。
- 正文和元数据：Inter。
- 控制器、标签和小字：Space Mono。
- 字重只使用 400、500、600 和 Mono 700。

### 颜色

- 纸面：`rgb(232 226 216)`。
- 主文字：`rgb(26 26 26)`。
- 次文字：`rgb(92 92 92)`。
- 控制栏：接近 `rgb(26 26 26)`。
- 激活陶土色：`rgb(196 93 62)`。
- 头部半透明纸面：`rgba(232 226 216 / 85%)`。

### 形状与深度

- 封面圆角：4px。
- 标签圆角：16px。
- 控制按钮圆角：20px。
- 整体控制栏圆角：40px。
- 封面阴影：`2px 4px 12px rgb(0 0 0 / 15%), 0 1px 3px rgb(0 0 0 / 10%)`。
- 分类标签阴影：`0 2px 8px rgb(0 0 0 / 15%)`。

## 响应式规律

| 视口 | 页面高度 | 头部 | 底部控制栏 | 页脚 |
|---:|---:|---|---|---|
| 375×812 | 3808px | 16px 横向边距，高度 167px，品牌文字纵向换行 | 295px 宽，底部 32px | 284px |
| 768×900 | 2924px | 16px 横向边距，高度 84px | 295px 宽，底部 32px | 250px |
| 1280×800 | 2209px | 32px 横向边距，高度 88px | 682px 宽，底部 32px | 215px |

移动端不是把桌面缩小，而是延长画布，让封面继续保持可触摸尺寸；控制栏隐藏文字，只保留图标和 Browse。

## 资源与技术形态

- 首页运行时共有 2824 个元素、295 个封面对象、77 个按钮和 296 张图片。
- 资源清单发现 4 个字体、242 个当前已加载图片、1 个字体样式表、2 个外部脚本。
- 外部脚本只有 Plausible 统计和 `html2canvas`；首页主要交互写在约 31KB 的内联 JavaScript 中。
- 页面是静态生成结构，不依赖前端框架运行时。
- 原站公开说明其生成方式是 Python 读取单一 JSON 并生成静态页面。个人版本继续采用“本地资料源 → 构建期公开 JSON → 静态页面”的同构逻辑。

## 个人版本迁移决策

### 迁移

- 三字体编辑系统与纸面材质。
- Scatter、Shake、Tidy、Vortex、Filter、Share、Browse。
- 可拖动封面与键盘可访问状态。
- Browse、Stats、Timeline、About 页面骨架。
- 数据派生页面，不公开私人笔记。
- 书、影、音最终共享同一套布局引擎和组件；影与音当前没有记录，先使用共享视觉系统的空架页面，数据适配器完成后再启用布局引擎。

### 不复制

- 原站名称、Logo、文案、作者身份和其他项目链接。
- 原站书籍图片、评分、音频和推荐数据。
- Quiz、Shelf Match 和 Press 的品牌营销内容。
- Plausible 统计或任何第三方跟踪。

### 本地数据接口

统一公开条目结构：

```json
{
  "id": "stable-id",
  "type": "book",
  "title": "黑天鹅",
  "creator": "纳西姆·塔勒布",
  "year": "2024",
  "cover": "public/covers/example.jpg",
  "categories": ["投资"]
}
```

电影与音乐以后只需要提供同一结构，分别把 `creator` 解释为导演或音乐人，布局和页面无需重写。
