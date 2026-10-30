# 素材工坊

一个可独立运行的素材制作网站：浏览模板、上传图片、提交任务，由 Java 后端异步执行三个阶段，前端跟踪多个任务的进度和结果。生成器是模拟实现，不调用真实 AI 服务。

## 快速开始

需要 Docker 和 Docker Compose。

```bash
docker compose up --build
```

启动后打开 <http://localhost:3000>。首次构建需要下载依赖，MySQL、建表、模板数据和示例封面都会自动准备好。

`samples/` 目录里有可直接上传的示例图片。

> 如果 3000 或 8080 端口被占用，复制 `.env.example` 为 `.env`，修改 `FRONTEND_PORT` / `BACKEND_PORT`。

## 1. 技术与结构

| 部分 | 技术 | 版本 |
| --- | --- | --- |
| 前端 | Next.js（App Router）、React、TypeScript | 15.5.28、19.2.7、5.9.3 |
| 前端测试 | Vitest、Testing Library | 5.0.5、16.3.3 |
| 后端 | Java、Spring Boot、MyBatis Starter | 17、3.5.16、3.0.5 |
| 数据库 | MySQL | 8.4 |
| 后端测试 | JUnit 5、Mockito、H2（MySQL 模式） | 随 Spring Boot 管理 |
| 运行环境 | Node.js、Maven | 24、3.9 |

```text
.
├── backend/                     Spring Boot 服务
│   └── src/main/
│       ├── java/.../auth/       注册、登录、会话
│       ├── java/.../template/   模板与分类
│       ├── java/.../asset/      素材上传与校验
│       ├── java/.../task/       任务受理、调度、执行、查询
│       ├── java/.../task/stage/ 三个制作阶段
│       ├── java/.../dev/        演示用开发接口
│       └── resources/           配置、建表、种子数据、示例封面
├── frontend/                    Next.js 应用
│   └── src/
│       ├── app/                 页面路由
│       ├── components/          页面组件
│       └── lib/taskTracker.ts   多任务状态与轮询
├── samples/                     可上传的示例图片
├── scripts/                     示例图片生成脚本
├── .github/workflows/ci.yml     CI
├── docker-compose.yml
└── .env.example
```

## 2. 操作命令

```bash
# 一键启动全部服务
docker compose up --build

# 后端（需要本地 JDK 17、Maven、MySQL）
cd backend
mvn test                 # 测试，使用 H2，无需 MySQL
mvn package -DskipTests  # 构建 target/studio-backend.jar
mvn spring-boot:run      # 启动

# 前端（需要 Node.js 24）
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run dev              # 开发模式，地址 http://localhost:3000
```

交付配置回归检查在仓库根目录执行（需要 Python 3 和 Docker Compose，不需要启动服务）：

```bash
python scripts/test_delivery_config.py
```

## 3. 连接方式

```text
浏览器 ──> Next.js :3000 ──/api/* 转发──> Spring Boot :8080 ──> MySQL :3306
```

- 浏览器只访问 Next.js。`next.config.mjs` 把 `/api/*` 转发给 Java，所以不需要 CORS，HttpOnly cookie 也能直接使用。
- 转发地址来自 `BACKEND_URL`，默认 `http://localhost:8080`。这个值在**构建时**固化，Compose 通过构建参数传入 `http://backend:8080`。
- 所有业务逻辑和持久化都在 Java 中，Next.js 只做页面和转发。

## 4. 配置

配置示例见 `.env.example`，其中都是本地演示用的值，不含真实凭据。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_URL` | 本机 MySQL 的 `studio` 库 | JDBC 地址 |
| `DB_USERNAME` / `DB_PASSWORD` | `studio` / `studio_dev_password` | 数据库账号 |
| `MYSQL_ROOT_PASSWORD` | `studio_dev_root_password` | 仅 Compose 使用 |
| `STORAGE_ROOT` | `./data/storage`（容器内 `/data/storage`） | 素材和结果的存放目录 |
| `BACKEND_URL` | `http://localhost:8080` | 前端转发地址，构建时生效 |
| `TASK_WORKER_THREADS` | `2` | 同时执行的任务数 |
| `TASK_DISPATCH_INTERVAL_MS` | `500` | 调度器扫描等待任务的间隔 |
| `SIM_ASSET_CHECK_DELAY_MS` | `2000` | 素材检查耗时 |
| `SIM_GENERATE_DELAY_MS` | `6000` | 模拟生成耗时 |
| `SIM_RESULT_DELAY_MS` | `2000` | 结果整理耗时 |
| `SIM_FAIL_STAGE` | 空 | 指定失败阶段 |
| `DEV_API_ENABLED` | 应用默认 `false`，Compose 默认 `true` | 是否开放开发接口 |
| `COOKIE_SECURE` | `false` | HTTPS 部署时设为 `true` |
| `SESSION_TTL` | `P7D` | 登录有效期 |

## 5. 数据准备

- **建表与模板**：`backend/src/main/resources/db/schema.sql` 和 `data.sql` 在应用每次启动时执行，语句可重复运行，无需手动初始化。
- **模拟模板**：共 12 个，分 4 个类别，分别需要 1 到 4 张图片，由 `data.sql` 写入 MySQL，通过 Java 接口读取。
- **示例封面**：在 `backend/src/main/resources/demo/`，随 Java 服务提供。
- **本地不用 Docker 时**：先创建数据库和账号，再启动后端：

```sql
CREATE DATABASE studio CHARACTER SET utf8mb4;
CREATE USER 'studio'@'%' IDENTIFIED BY 'studio_dev_password';
GRANT ALL ON studio.* TO 'studio'@'%';
```

## 6. 接口文档

错误响应统一为 `{ "code": "错误码", "message": "可展示的说明" }`。模板接口、注册和登录公开；素材、任务、当前用户和退出接口需要登录。开发接口单独由配置开关控制，开放时没有鉴权，部署时必须关闭。

### 身份

| 方法与路径 | 请求 | 响应 |
| --- | --- | --- |
| `POST /api/auth/register` | `{ email, password }` | `201 { id, email }`，写入 cookie |
| `POST /api/auth/login` | `{ email, password }` | `200 { id, email }`，写入 cookie |
| `POST /api/auth/logout` | 无 | `204`，清除会话 |
| `GET /api/auth/me` | 无 | `200 { id, email }` |

### 模板

| 方法与路径 | 请求 | 响应 |
| --- | --- | --- |
| `GET /api/template-categories` | 无 | `string[]` |
| `GET /api/templates` | 可选查询参数 `category` | `Template[]` |
| `GET /api/templates/{id}` | 无 | `Template`，不存在时 `404` |

`Template` 字段：`id`、`title`、`category`、`coverUrl`、`description`、`requiredImageCount`、`acceptedMimeTypes`、`maxFileSizeBytes`。

### 素材

| 方法与路径 | 请求 | 响应 |
| --- | --- | --- |
| `POST /api/assets` | multipart：`templateId`、`file` | `201 { id, mimeType, sizeBytes }` |

服务端按模板校验大小，并读取文件头判断真实类型，不信任请求里的 Content-Type。

### 任务

| 方法与路径 | 请求 | 响应 |
| --- | --- | --- |
| `POST /api/tasks` | `{ templateId, assetIds: string[] }` | `202 Task`，状态为 `PENDING` |
| `GET /api/tasks` | 可选查询参数 `templateId` | `Task[]`，最新 100 条记录，加上该用户全部未结束任务，去重后按创建时间倒序；可能超过 100 条 |
| `GET /api/tasks/batch?ids=a,b` | 逗号分隔的任务 ID，最多 100 个 | `Task[]`，忽略不属于当前用户的 ID |
| `GET /api/tasks/{id}` | 无 | `{ task: Task, stages: StageRun[] }` |
| `GET /api/tasks/{id}/result` | 无 | PNG 图片 |

`Task` 字段：

| 字段 | 说明 |
| --- | --- |
| `id`、`templateId`、`templateTitle`、`templateCoverUrl` | 任务和模板信息 |
| `status` | `PENDING` / `PROCESSING` / `SUCCEEDED` / `FAILED` |
| `currentStage` | `ASSET_CHECK` / `GENERATE` / `RESULT`，未开始或已结束时为 `null` |
| `failureStage`、`failureReason` | 失败阶段和原因 |
| `resultUrl` | 成功后的图片地址 |
| `createdAt`、`updatedAt`、`finishedAt` | ISO 8601 UTC 时间 |

`StageRun` 字段：`stage`、`status`（`RUNNING` / `SUCCEEDED` / `FAILED`）、`message`、`startedAt`、`finishedAt`。

### 开发接口

仅在 `DEV_API_ENABLED=true` 时存在。

| 方法与路径 | 请求 | 响应 |
| --- | --- | --- |
| `GET /api/dev/simulation` | 无 | 当前配置 |
| `PUT /api/dev/simulation` | `{ assetCheckDelayMs, generateDelayMs, resultDelayMs, failStage }` | 更新后的配置 |

## 7. 任务执行

```text
POST /api/tasks ──> 校验后写入 PENDING ──> 立即返回 202
                             │
           TaskDispatcher 定时扫描，抢占为 PROCESSING
                             │
             固定大小线程池中的 TaskRunner 依次执行
         ┌───────────────────┼───────────────────┐
     素材检查 ───────────> 模拟生成 ───────────> 结果整理
         │                   │                   │
         └── 任一阶段失败：写入 FAILED，后续阶段不再执行 ──┘
                             │
                     全部通过：写入 SUCCEEDED
```

- **队列**：MySQL 任务表就是队列。线程都忙时，任务留在 `PENDING`，所以提交不受执行速度影响，也不需要额外的消息队列。
- **阶段边界**：每个阶段是一个 `TaskStage` 实现。进入阶段时更新 `task.current_stage`，并在 `task_stage_run` 记录开始时间；结束时写入结果和结束时间。
- **阶段内容**：素材检查确认文件存在且能解码；模拟生成把用户图片拼成竖版 PNG；结果整理把文件移入结果目录。
- **只读查询**：查询接口只读数据库，不触发也不推进任务。
- **终态保护**：所有状态更新都带前置状态条件（例如 `WHERE status = 'PROCESSING'`），成功或失败的任务不会被改回去。
- **失败配置固化**：耗时和失败阶段在受理时写入任务记录，修改配置不影响已受理的任务，多任务演示时不会互相干扰。

## 8. 演示步骤

以下命令在 Windows PowerShell 中请用 `curl.exe`。

**成功任务**

1. 打开 <http://localhost:3000>，注册账号。
2. 选择“旅行明信片”，上传 `samples/` 里的两张图片，点击“开始制作”。
3. 卡片会依次显示等待处理、素材检查中、模拟生成中、结果整理中，最后显示图片。点击图片可以看大图。

**调整处理耗时**

```bash
curl -X PUT http://localhost:3000/api/dev/simulation \
  -H "Content-Type: application/json" \
  -d '{"assetCheckDelayMs":1000,"generateDelayMs":20000,"resultDelayMs":1000,"failStage":null}'
```

**指定阶段失败**

把 `failStage` 改为 `ASSET_CHECK`、`GENERATE` 或 `RESULT`，之后提交的任务都会在该阶段失败，后续阶段不会执行。例如：

```bash
curl -X PUT http://localhost:3000/api/dev/simulation \
  -H "Content-Type: application/json" \
  -d '{"assetCheckDelayMs":1000,"generateDelayMs":3000,"resultDelayMs":1000,"failStage":"GENERATE"}'
```

也可以在启动时设置 `SIM_FAIL_STAGE`。演示结束后把 `failStage` 改回 `null`。

**多任务**

1. 把生成耗时调到 20 秒，连续提交 3 个任务。
2. 默认两个线程同时执行，第 3 个任务显示等待处理，导航栏徽标显示进行中的任务数。
3. 每张卡片的状态互不影响。把 `TASK_WORKER_THREADS` 设为 `1` 可以看到严格排队。

**刷新恢复**

1. 任务执行时刷新页面，或关闭页面再打开。
2. 记录从后端恢复，未完成的任务继续更新。“我的记录”展示最新 100 条的历史窗口，并补齐全部未结束任务；较老的成功/失败记录没有分页入口。

**查询异常**

1. 任务执行时运行 `docker compose stop backend`。
2. 页面显示连接异常，卡片保持处理中，不会显示为失败。连续 5 次失败后自动查询暂停。
3. 运行 `docker compose start backend`，点击“重新查询”恢复。此时后端已重启，被中断的任务会显示原因，见第 11 节。

## 9. 身份方案

- **方式**：邮箱加密码注册登录。密码用 BCrypt 哈希保存。
- **会话**：登录后生成随机 token，放在 HttpOnly、SameSite=Lax 的 cookie 中。数据库只保存 token 的 SHA-256 哈希，退出登录时删除，可以立即失效。
- **数据隔离**：用户 ID 只从 cookie 解析，接口不接受前端传入。任务和素材都有 `user_id`，每次查询都带上用户条件。访问他人任务返回 404，不暴露任务是否存在。提交他人素材会被拒绝。结果图片也经过相同的归属校验。
- **前端隔离**：切换用户时清空任务数据并取消进行中的查询；提交响应绑定提交时的跟踪会话，认证响应也校验请求代次，避免旧响应覆盖新用户。仅同一用户站内导航时，已受理的任务仍可加入根布局中的跟踪器。

**演示**：用账号 A 提交任务，退出后注册账号 B。B 的“我的记录”为空，直接访问 A 的任务接口返回 404。

## 10. 完成度

**已完成**：R-01 到 R-14 的全部必做项，以及 Docker Compose 一键启动。

**验证情况**

| 项目 | 结果 |
| --- | --- |
| 后端测试与构建 | 通过，24 条测试，使用 H2 MySQL 模式 |
| 前端 lint、类型检查、测试、构建 | 通过，52 条测试 |
| Compose 默认配置及环境覆盖 | 通过 `scripts/test_delivery_config.py` 检查 |
| 容器与真实 MySQL | 独立 Compose 环境从零构建通过；验证成功任务、三阶段失败、排队、用户隔离、102 个未结束任务恢复和强制重启收尾 |
| 浏览器全流程 | 本机 Edge 无头模式通过，含上传、多任务、查询异常、实际停止后端、刷新恢复、切换用户和 390px 小屏 |
| GitHub Actions | 通过，前端、后端和交付配置三个任务均成功 |

**已知限制**

- 历史窗口只取最新 100 条任务，另补齐该用户全部未结束任务；较老终态记录没有分页。前端轮询按每批最多 100 个 ID 拆分，不以历史窗口限制未结束任务恢复。
- 自动查询暂停后，新提交的任务要点“重新查询”才会继续自动更新。
- 尚未增加请求超时；始终不返回的请求可能需要手动刷新或切换会话解除等待，已经返回的成功批次仍会独立更新。
- 上传后未被任务使用的素材不会自动清理，过期会话也不会自动删除。
- 注册和登录没有频率限制，也没有邮箱验证。
- 开发接口没有鉴权，只靠配置开关控制，线上必须关闭。
- 调度器依赖单个进程的线程池。抢占逻辑可以防止重复执行，但启动时的中断清理假设只有一个实例，多实例部署前需要调整。
- 上传时只检查文件头，内容损坏的图片会在素材检查阶段失败，而不是在上传时被拒绝。
- 后端自动化测试用 H2 模拟 MySQL，真实 MySQL 验证情况单独记录，CI 中没有 MySQL 集成测试这一层。

**实际投入时间与取舍**

实际投入约 2 小时，集中使用 AI 编程工具：初版开发约 40 分钟，其余时间用于审查修复、补充测试和回归验证。不含开工前的需求阅读。

- 用 MySQL 表当队列，不引入 MQ 或 Redis：题目规模不需要，也更容易解释。
- 用轮询而不是 SSE：终态后停止的逻辑最清晰，出错时恢复也简单。
- 没有做幂等、自动重试、断点续跑、任务删除和分页，时间优先给异步可靠性和状态管理。

## 11. 边界说明

- **服务重启**：不恢复执行中的任务。启动时在事务中结束遗留 `PROCESSING` 任务及其 `RUNNING` 阶段记录，保留失败阶段、原因和结束时间，原因是“服务重启，任务已中断，请重新提交”。`PENDING` 任务不受影响，重启后继续执行。
- **关闭页面**：任务在 Java 中执行，与页面无关。
- **切换页面**：任务跟踪放在根布局，站内切换页面时继续。退出登录、切换用户或没有未完成任务时停止查询。
- **查询异常**：只影响显示，不改变任务状态。
- **重复提交**：前端在提交中禁用按钮，后端没有做幂等。
- **文件存储**：保存在本地目录，Compose 中是 `storage-data` 数据卷。

## 12. 部署与回滚

**部署**

1. 准备 `.env`，修改所有密码，设置 `DEV_API_ENABLED=false`。使用 HTTPS 时设置 `COOKIE_SECURE=true`。
2. 备份数据库和 `storage-data` 数据卷。
3. 运行 `docker compose up --build -d`。
4. 确认 `docker compose ps` 中的服务都已启动，并走一遍成功任务。

**回滚**

1. 记录要回滚到的 commit，运行 `git checkout <commit>`。
2. 运行 `docker compose up --build -d`。
3. `schema.sql` 只用 `CREATE TABLE IF NOT EXISTS`，不会回退表结构。如果新版本改过表结构，需要恢复部署前的数据库备份。

运行 `docker compose down` 保留数据，`docker compose down -v` 会删除数据库和上传文件。

## 13. AI 使用披露

本项目使用了 AI 编程工具 Claude Code（Claude Opus 5.5）。绝大部分代码、测试和文档由 AI 生成，由开发者确定需求和时间约束，并审核结果。

需求符合性审查后的修复使用 Hermes Agent：先用延迟响应、超出历史窗口的任务和缺参请求复现问题，再补充应通过但先失败的回归测试，修复后运行测试及构建，并由独立审查复核。

**工作流**

1. **任务拆解**：先让 AI 通读需求文档，按考察重点分层，列出容易出错的地方。结合参考截图确定页面结构和取舍，再按后端、前端、容器和文档的顺序实现。
2. **上下文提供**：需求整理文档、四张参考截图、截止时间。
3. **生成与修改**：AI 直接在项目中写代码、运行命令。每个阶段结束后在本地提交。
4. **验证与纠错**：不只看单元测试，还用 `docker compose` 启动真实环境，用脚本走接口全流程，再用无头浏览器走页面流程并人工查看截图。

**实际例子**

第一次运行后端测试时，“终态不能被覆盖”这条测试失败了。排查发现，两个测试类共用同一个 H2 内存库，而带调度器的 Spring 上下文被缓存后仍在运行，抢走了另一个测试刚创建的等待任务。这也意味着“查询不推进任务”这条测试可能是碰巧通过的。修复方式是给关闭调度器的测试类单独配置数据库，而不是重跑或放宽断言。

另一个例子：写建表脚本时发现 `CREATE INDEX` 不能重复执行，而脚本每次启动都会运行，第二次启动就会失败，于是把索引移进了 `CREATE TABLE`。

## 14. 复用来源

- **脚手架**：没有使用模板仓库，项目结构由人工结合ai创建。依赖见 `frontend/package.json`（含 `package-lock.json`）和 `backend/pom.xml`，版本由 Spring Boot 父 POM 和锁文件固定。
- **开源代码**：除上述依赖外，没有复制第三方代码。
- **图片素材**：模板封面和 `samples/` 中的示例图由 `scripts/generate_demo_assets.py` 绘制，不含第三方素材。
- **界面**：参考题目提供的截图布局，未使用其中的图片和品牌。
