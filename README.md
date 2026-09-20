# 招聘实验室：从问卷推断候选人能力

这是一个单页互动教学游戏。玩家的目标始终是：只根据候选人的 9 道四选一问卷答案，推断言语理解、逻辑判断和数量关系三项潜在能力。

这一版的教学流程按 John Winn《Model-Based Machine Learning》第 2 章 *Assessing people's skills* 的建模思路重构：先明确假设，先在简单数据上测试模型，再移动到真实样本；当真实结果不理想时，区分数据、模型和推断问题；用模型生成的合成数据检查推断；再用近似 ground truth 定位模型假设；最后把 guess probability 变成可学习、可逐题变化的参数并重新评价。

在书中流程之上，本项目保留了一个额外的独立检验集：240 条模拟历史记录随机分成 160 条建模/调试数据和 80 条最终 holdout。后 80 条直到两个模型都定型后才第一次使用。

## 运行

直接打开 `dist/index.html` 即可。项目为纯静态 HTML/CSS/JS，可部署到 GitHub Pages。

## 主要教学点

- 模型就是一组关于数据生成过程的假设。
- 四选一完全随机猜中正确答案的概率为 25%；第一版模型直接把这个常识作为“不会时仍可能答对”的规则。
- 自评能力仅作为开发期近似 ground truth；它不会被模型用于能力推断，也不会用于学习 guess probability。
- 基础模型先不学习 guess probability：具备所需能力时按 90% 答对，缺少能力时按四选一的 25% 答对。
- 真实数据出现问题后，先用模型生成的合成数据确认推断过程基本正常。
- 随后把参考能力暂时固定，比较每道题的“模型预计答对比例”和“实际答对比例”，让玩家从逐题差异回头检查“不会时每道题都按 25% 处理”这条规则。
- 调整后的模型给每道题一个 `alpha_j`，每个参数使用相同的 `Beta(2.5, 7.5)` 先验，先验均值为 0.25；参数只从建模问卷答案中学习。
- 最终用独立 holdout 比较负对数概率、AUC，以及同一候选人在两种模型下的能力后验差异。

## 教学边界

数据为模拟数据。真实招聘模型还需要独立效标、测量可靠性与效度、公平性、隐私、合规性和持续监控。本项目不能直接用于真实录用决策。

## 玩家成绩与留言

本版加入了与课程参考项目相同思路的公开社区功能：

1. 游戏记录 9 个关键选择题的**第一次选择**。
2. 首次选对记 100 分；收到反馈后修正记 60 分；最终成绩为 9 个判断的平均分。
3. 玩家在最后一页可以填写显示名、1–5 星和留言。
4. 点击提交后，游戏只会打开一个**预填好的 GitHub Issue 草稿**；玩家需要自己登录 GitHub、检查内容并点击发布。
5. `.github/workflows/community.yml` 会读取仍然打开的公开 Issues，重新计算成绩，并生成根目录的 `community.json`。
6. 游戏页面直接读取这个公开快照，显示排行榜和最近留言。
7. 同一个 GitHub 账号只保留最高成绩；留言显示最近一条。关闭 Issue 后，该记录会在下一次更新中撤回。

这个流程不需要数据库、服务器或前端 GitHub Token。成绩属于玩家自报互动记录，只用于课程交流。

### GitHub Pages 部署

仓库已经包含 `.github/workflows/pages.yml`，它会把 `dist/` 发布到 GitHub Pages。因此推荐：

1. 新建一个 GitHub 仓库，把本项目**所有文件**上传到仓库根目录（包括隐藏的 `.github` 文件夹）。
2. 在 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**。
3. 在 `Settings → Actions → General → Workflow permissions` 允许 **Read and write permissions**，这样排行榜工作流才能更新 `community.json`。
4. 确认仓库的 **Issues** 功能已启用。
5. 推送到 `main` 后，等待 `Deploy static site to Pages` 工作流完成，再从 `Settings → Pages` 打开站点。

部署在标准的 `用户名.github.io/仓库名/` 地址时，游戏会自动识别当前仓库，不需要改代码。

如果以后使用自定义域名，请在 `dist/index.html` 中设置：

```html
<meta name="github-repository" content="你的用户名/你的仓库名">
```

### 社区功能的文件

```text
community.json
community/
  community.mjs
  community.test.mjs
  sync.mjs
.github/
  ISSUE_TEMPLATE/
    score.md
    config.yml
  workflows/
    community.yml
    pages.yml
dist/
  community.js
  app.js
  index.html
```

### 本地检查

```sh
node --check dist/app.js
node --check dist/community.js
node --test community/community.test.mjs
```

本地直接打开 `dist/index.html` 时，成绩提交按钮会保持禁用，因为页面无法自动知道目标 GitHub 仓库；部署到 GitHub Pages 后会自动启用。
