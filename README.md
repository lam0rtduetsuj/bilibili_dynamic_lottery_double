<p align="center">
    <img src="./vue/public/logo.png" width="250" height="250">
</p>

# B站在线抽奖工具
本工具可以从B站 (视频/动态) 中提取出 (评论/转发/点赞) 用户列表, 然后随机选出中奖者


# 新功能
1. 双链接合并抽取：支持同时输入两条同类型链接（两个视频或两个动态），合并抽取并去重。
2. 数量合并展示：筛选区的计数改为加和格式
3. 合并规则：对每条链接分别按勾选项做交集（评论/点赞/转发）；两个来源的交集结果再做并集，按 user.id 去重；每个用户打上 source_id 用于后续定位和标注。
4. 点赞状态标注（动态可用）：用户卡片显示「已点赞 / 未检测到点赞」。即使只勾选“评论”，也会后台补拉一次点赞列表（仅动态），不影响候选集合，仅用于 UI 标注；视频类型不提供他人点赞清单 → 可能显示“未检测到点赞”。


# 参考文档
[SocialSisterYi/bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect/tree/master "SocialSisterYi/bilibili-API-collect")

# 贡献名单
| 头像 | 用户名 |
| ---- | ------ |
| <a href="https://github.com/monoglo"><img src="https://avatars.githubusercontent.com/u/26409918?v=4" width="50" /></a> | [monoglo](https://github.com/monoglo) |
| <a href="https://github.com/sakmist"><img src="https://avatars.githubusercontent.com/u/123816165?v=4" width="50" /></a> | [sakmist](https://github.com/sakmist) |


# 后端的部署方法
1. 需要一台支持PHP环境的服务器
2. 把项目除了 `vue` 目录以外的文件部署到网站的目录下
3. 重命名`api`目录里的 `.env.example.php` 改成 `.env.php`
4. 重命名`config`目录里的 `cookie.example.txt` 改成 `cookie.txt` 
5. 然后创建一个B站小号登陆B站, 把账号使用的cookie字符串复制到 `cookie.txt` 文件内
6. 项目的访问入口为api目录里的 `index.php` , 部署完成后就能通过 api路径访问 例子: https://www.abcd/api/index.php

# 前端的部署方法
1. 安装Nodejs+npm
2. 在`vue`目录里打开命令行 运行 `npm install` 安装下载依赖文件
3. 重命名vue目录里的 `.env.example` 改成 `.env`
4. 根据注释 修改 `.env` 文件里的变量数值
4. 运行 `npm run dev` 可以本地调试前端项目
5. 运行  `npm run build` 可以生成 `dist` 目录, 里面包含构建好的前端代码
6. 把 `dist` 目录里的文件部署到前端的服务器

