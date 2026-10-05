# v1.21.4 上游更新审查

生产基线 `135485f1776aeda88e5ff1daef5d6eb5050be4eb`（v1.21.3），完整合入 `fc1b7ff..afc8b8119f981492a5caee52f1e1ebf756bd0d41`，保留真实合并历史。

## 完整上游范围

- `e8851c5`：独立 Forward widget 隔离服务端本地弹幕存储，并覆盖搜索至弹幕流程。
- `d91079e`：NipaPlay 关联链接仅向 SOURCE_ORDER 已开启的源分发。
- `f994b6d`：GitHub 与请求参数图标统一使用图标库，更新背景弹幕词库。
- `b4901e4`：芒果综艺末尾上中下分部排序。
- `3aba4ad`：外文检索词保留正确命中，TMDB 结果交给详情别名池判定。
- `7f44d1a`：版本 1.21.4；缓存后端隔离、Local Redis 优先恢复、查询及收藏读取失败保护、ID 上界与原子分配、清理部分失败反馈、文件备份及开关、连接切换隔离、Redis 等待预算。
- `afc8b81`：项目结构文档与 Forward 手动测试数据同步。

已审查全部 25 个上游变更文件，解决 dandan-api、envs、cache-util、worker、worker.test 五处冲突；同时复核自动合并内容。

## 下游补丁处置

- MATCH-001：保留既有正片偏好、来源前缀与偏移；采用上游外文筛选和芒果排序。
- AUTH-001：保留管理员路由门槛、凭据脱敏、NipaPlay HTTPS 和禁止重定向。新缓存初始化与收藏写保护在管理员检查后执行。
- CACHE-001：采用上游分后端 hash、统一恢复与失败只读保护，保留收藏及瞬态缓存隔离回归；缓存清理仅写选中查询键，不清收藏。
- SOURCE-001、PERF-001：保留惰性注册、能力验证、失败隔离、腾讯截止时间及优酷默认并发 16。
- SEARCH-001：适配。保留总预算、兜底预留、取消后禁止写入、完整结果才缓存；把上游 addAnime 失败提示透传到隔离管道，并在无结果时返回；addEpisode 与批次内 allocateEpisode 均保留取消检查。
- COLOR-001、HONGGUO-001、LOCAL-001：保留；上游未提供等价替代。
- FORWARD-001：实现退役。构建文件采用上游同等隔离机制，移除已无调用的 forward/local-source.js，保留 standalone smoke 回归。

## 验证及上线门槛

- 不含配置凭据和运行缓存的临时副本中，Node 回归 227/227，通过，无跳过；覆盖上游新缓存、Redis 超时、关联源筛选、芒果排序及 release/debug Forward 端到端模拟。
- 运行完整回归需本机回环监听；沙箱禁止监听造成的首轮失败已在临时副本解除该限制后全量重跑通过。旧版本断言同步为 1.21.4。
- 继续要求最终候选的 GitHub Test、原生 amd64/arm64 Docker build/import 及 Ready Vercel Preview。
- 不修改生产环境变量、账号或凭据；正式切换后只读核对版本、页面、配置白名单及匿名权限。
- 真实账号登录、带凭据播放器和第三方源、生产 Redis 上传及 Node/Docker 真实持久化不属于本轮模拟测试证明；生产 Redis 不执行清理或上传验收。

## 回滚

升级前已核实原生产部署 `2253KBTUY6SxzzJb5w5vkVV3sWhC` Ready，代码为 `135485f1776aeda88e5ff1daef5d6eb5050be4eb`。需要回滚时优先恢复此部署，再通过 revert PR 撤销本轮合并，不重置或强推 main。最终 PR、部署和上线证据见工作区发布记录。
