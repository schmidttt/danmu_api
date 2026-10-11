# v1.21.5 上游更新审查

生产基线 `e499481f48d4d46496aa1e0b6116a1c49e03acab`（v1.21.4），完整合入 `afc8b81..f47b786`，保留真实上游历史。核对日期：2026-10-11，Asia/Shanghai。

## 完整上游范围

- `d0735c1` chore(release): bump VERSION from 1.21.4 to 1.21.5
- `4624891` fix(cache): 备份成功日志改为 info 并每进程仅提示一次 (#504)
- `cc8b27e` fix(merge): 合并映射表规则对两侧标题一致剥离季度与类型噪声，修复特定规则匹配不上 (#506)
- `c519139` feat(dandan): 详情集缺失时支持 NipaPlay 中转弹弹play服务端兜底与 Bangumi Data 补全 (#507)
- `ffdbd24` fix(hanjutv): 修复首次搜索偶发无结果并区分正常空结果日志 (#508)
- `249cbe5` fix(tmdb-util): 日语原名检索词剥离季与分部标记并修正副标题分隔判定 (#510)
- `fdd85fb` feat(aiyifan): 切换到 App 接口链路，年份用旧网页搜索接口补齐 (#511)
- `5ccfc66` fix(merge): 优化合并工具年份与配音版判断逻辑，修复相关误合并 (#512)
- `1c9340f` fix(dandan-model): 数据模型对 null 缺省值取默认值并让类型校验错误可定位 (#513)
- `f393604` test: 将单文件测试拆分为按源码模块镜像的目录结构并更新 README 与 npm test 入口
- `f47b786` test(ci): 新增 GitHub Actions 自动化测试工作流与离线测试用例并完善文档说明

共 11 个提交、72 个变更路径。运行时涉及模型、缓存日志、合并映射与年份/配音判断、日语检索、韩剧 TV 首次重试、爱壹帆 App 链路和弹弹详情补全。其余主要是测试拆分、离线用例、CI 和文档。

## 合并与下游保护

- 解决 envs、registry、package.json、Test workflow 和旧单文件测试五处冲突；复核自动合并文件。
- MATCH-001：保留正片偏好、来源前缀和偏移，采用上游合并规则、年份与配音版、TMDB 日语检索修复。
- AUTH-001：适配。原管理员门槛、脱敏、HTTPS 限制及禁止重定向均保留；新增 NipaPlay 详情请求也禁止自动重定向，并新增模拟凭据回归。
- CACHE-001：保留收藏与瞬态缓存隔离、读取失败保护、取消后禁止写入；采用上游每进程一次 info 备份提示和 Bangumi Data 缓存字段升级。
- SOURCE-001、PERF-001、SEARCH-001：保留惰性注册、能力验证、同步失败隔离、优酷默认并发 16、腾讯截止时间、总搜索预算及兜底预留。
- COLOR-001、HONGGUO-001、LOCAL-001：保留，未被本轮上游替代。
- FORWARD-001：继续使用上游构建隔离，保留独立 smoke 和 release/debug 模拟验收。

## 测试适配

- 接受上游模块测试目录，删除旧 worker.test.js。对旧测试按语法树比对共同上游基线：94 个顶层/第一层用例中，保留 26 个新增或增强的下游回归，其他 68 个已确认由新上游测试覆盖。
- 额外保护放入 downstream.test.js，搜索预算保护仍在 search-reliability.test.js；更新版本断言。保留增强用例中的所有子测试。
- 自动测试仅显式选择 *.test.js，排除手动真实联网巡检；串行执行，Node 24；保留 npm ci、已跟踪锁文件、workflow_dispatch 和 Forward smoke。
- 上游夹具适配下游默认源、无 Redis 云收藏的 503 行为；收藏和空候选匹配使用独立临时存储与明确的空兜底源，避免读到其他测试的持久数据或请求真实数据源。
- 全量回归、原生 amd64/arm64 Docker build/load/import、Ready Vercel Preview 为本轮发布门槛。最终运行结果写入工作区发布记录。

## 同步邮件诊断

失败运行 `38097694241`（2026-10-11）在 Report merge conflicts 阶段按预期退出：当时 envs.js 和 worker.test.js 有冲突。远端 main 未改变、没有自动发布；前几次无更新运行均成功。这是人工审查保护，不是生产故障。
本轮人工解决完整最新上游冲突；不删除或弱化同步保护。合并后手动运行 Fork Sync Pull Request，确认新版上游已是 main 祖先，流程以无更新成功结束。

## 发布与回滚

用户已明确授权“弄完后直接上线”，本轮检查与 Preview 通过后直接普通 merge。生产配置与凭据不修改，验收只读核对版本、原配置白名单、首页及匿名权限，不进行生产缓存清理或上传。
升级前生产版本 v1.21.4，原生产部署 `8CqPsLLt7iysD3ec95mKcwwZKFwr`、main `e499481`。需要回滚时先恢复该部署，再用 revert PR，不重置或强推 main。
真实账号登录、带凭据播放器、第三方源端到端、生产 Redis 上传和 Node/Docker 长期持久化不在模拟测试证明范围内。
