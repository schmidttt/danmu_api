// =====================
// 源注册表 (Source Registry)
// =====================
// 集中管理所有弹幕源的元数据与实例化，消除散落在 dandan-api.js 中的
// import + new + if/else 分发三段重复代码。
//
// 新增一个源只需：
//   1. 在 sources/ 下新建 xxx.js 并 export default class XxxSource extends BaseSource
//   2. 在下方 SOURCE_REGISTRY 数组里加一条 { key, factory, ... } 配置
//
// 所有"按 sourceKey 查实例"的分发点改为调用 getSourceByKey(key) 即可，
// 无需再改动 dandan-api.js 的 import 区、实例化区或通用分发链。
// 若新增源需要独有的 URL 识别或分片协议，仍需在对应的专用路由中显式接入。
// =====================

import Kan360Source from './kan360.js';
import VodSource from './vod.js';
import TmdbSource from './tmdb.js';
import DoubanSource from './douban.js';
import RenrenSource from './renren.js';
import HanjutvSource from './hanjutv.js';
import BahamutSource from './bahamut.js';
import DandanSource from './dandan.js';
import CustomSource from './custom.js';
import TencentSource from './tencent.js';
import IqiyiSource from './iqiyi.js';
import MangoSource from './mango.js';
import BilibiliSource from './bilibili.js';
import MiguSource from './migu.js';
import YoukuSource from './youku.js';
import SohuSource from './sohu.js';
import LeshiSource from './leshi.js';
import XiguaSource from './xigua.js';
import MaiduiduiSource from './maiduidui.js';
import AiyifanSource from './aiyifan.js';
import HongguoSource from './hongguo.js';
import AnimekoSource from './animeko.js';
import OtherSource from './other.js';

// 源注册表：每条记录描述一个源的调度身份与实例化方式。
// 字段说明：
//   key             —— sourceOrderArr 中的调度键名（如 "360"、"imgo"、"tencent"）
//   logName         —— 日志标签规范名称；为空时默认等于 key。处理 360→360kan、imgo→mango 这类别名
//   factory         —— 实例工厂 (ctx) => instance。ctx 是已建好实例的 Map（key->instance），供有依赖的源取依赖
//   searchArgs      —— 构造 search 参数；默认只传 queryTitle，vod 会额外传偏好参数
//   deps            —— 该源依赖的其他源 key 列表（用于排序），无依赖为空
//   canSearch       —— 是否允许进入 SOURCE_ORDER 搜索管道；默认 true
//   canHandle       —— 是否允许把搜索结果转换为 Anime；默认 true
//   canMerge        —— 是否允许进入 MERGE_SOURCE_PAIRS 聚合弹幕管道
//   canDirect       —— 是否允许通过 source:id 结构化 ID 直接取弹幕
//   handleAdapter   —— 把各源签名不一致的 handleAnimes 统一为
//                      (searchResult, queryTitle, isolatedAnimes, isolatedDetailStore, targetSeason) 的适配器；
//                      未提供时默认调用 instance.handleAnimes(searchResult, queryTitle, isolatedAnimes, isolatedDetailStore, targetSeason)
//                      新增源若 handleAnimes 签名标准（5 参），可不提供 handleAdapter
const SOURCE_REGISTRY = [
  { key: '360',       logName: '360kan',  factory: () => new Kan360Source(), deps: [] },
  { key: 'vod',       logName: '',        factory: () => new VodSource(), deps: [],
    searchArgs: (queryTitle, preferAnimeId, preferSource) => [queryTitle, preferAnimeId, preferSource],
    handleAdapter: async (instance, searchResult, queryTitle, isolatedAnimes, isolatedDetailStore, targetSeason) => {
      // vod 源: search 返回多服务器结果数组，需逐个遍历并传入 serverName
      if (searchResult && Array.isArray(searchResult)) {
        for (const vodResult of searchResult) {
          if (vodResult && vodResult.list && vodResult.list.length > 0) {
            await instance.handleAnimes(vodResult.list, queryTitle, isolatedAnimes, vodResult.serverName, isolatedDetailStore, targetSeason);
          }
        }
      }
    } },
  { key: 'tmdb',      logName: '',        factory: (ctx) => new TmdbSource(ctx.get('douban')), deps: ['douban'] },
  { key: 'douban',    logName: '',        factory: (ctx) => new DoubanSource(ctx.get('tencent'), ctx.get('iqiyi'), ctx.get('youku'), ctx.get('bilibili'), ctx.get('migu')), deps: ['tencent', 'iqiyi', 'youku', 'bilibili', 'migu'] },
  { key: 'renren',    logName: '',        factory: () => new RenrenSource(), deps: [], canMerge: true, canDirect: true },
  { key: 'hanjutv',   logName: '',        factory: () => new HanjutvSource(), deps: [], canMerge: true, canDirect: true },
  { key: 'bahamut',   logName: '',        factory: () => new BahamutSource(), deps: [], canMerge: true, canDirect: true },
  { key: 'dandan',    logName: '',        factory: () => new DandanSource(), deps: [], canMerge: true, canDirect: true },
  { key: 'custom',    logName: '',        factory: () => new CustomSource(), deps: [], canDirect: true,
    handleAdapter: (instance, searchResult, queryTitle, isolatedAnimes, isolatedDetailStore) =>
      instance.handleAnimes(searchResult, queryTitle, isolatedAnimes, isolatedDetailStore) },
  { key: 'tencent',   logName: '',        factory: () => new TencentSource(), deps: [], canMerge: true },
  { key: 'iqiyi',     logName: '',        factory: () => new IqiyiSource(), deps: [], canMerge: true },
  { key: 'imgo',      logName: 'mango',   factory: () => new MangoSource(), deps: [], canMerge: true },
  { key: 'bilibili',  logName: '',        factory: () => new BilibiliSource(), deps: [], canMerge: true },
  { key: 'migu',      logName: '',        factory: () => new MiguSource(), deps: [], canMerge: true },
  { key: 'youku',     logName: '',        factory: () => new YoukuSource(), deps: [], canMerge: true },
  { key: 'sohu',      logName: '',        factory: () => new SohuSource(), deps: [], canMerge: true },
  { key: 'leshi',     logName: '',        factory: () => new LeshiSource(), deps: [], canMerge: true },
  { key: 'xigua',     logName: '',        factory: () => new XiguaSource(), deps: [], canMerge: true },
  { key: 'maiduidui', logName: '',        factory: () => new MaiduiduiSource(), deps: [], canMerge: true },
  { key: 'aiyifan',   logName: '',        factory: () => new AiyifanSource(), deps: [], canMerge: true },
  { key: 'hongguo',   logName: '',        factory: () => new HongguoSource(), deps: [], canMerge: true, canDirect: true },
  { key: 'animeko',   logName: '',        factory: () => new AnimekoSource(), deps: [], canMerge: true, canDirect: true },
  { key: 'other',     logName: '',        factory: () => new OtherSource(), deps: [], canSearch: false, canHandle: false },
];

// ---- 定义与实例缓存（按 key 索引）----
const definitionMap = new Map();
const instanceMap = new Map();
const metaMap = new Map();
const buildingKeys = new Set();
let definitionsValidated = false;

function validateRegistryDefinitions() {
  if (definitionsValidated) return;
  const keys = new Set();
  definitionMap.clear();
  for (const entry of SOURCE_REGISTRY) {
    if (!entry.key || typeof entry.factory !== 'function') {
      throw new Error('[registry] 每个源都必须提供非空 key 和 factory');
    }
    if (keys.has(entry.key)) {
      throw new Error(`[registry] 存在重复源键: ${entry.key}`);
    }
    keys.add(entry.key);
    definitionMap.set(entry.key, entry);
  }

  for (const entry of SOURCE_REGISTRY) {
    if (!Array.isArray(entry.deps)) {
      throw new Error(`[registry] 源 "${entry.key}" 的 deps 必须是数组`);
    }
    const invalidDependency = entry.deps.find(dep => dep === entry.key || !keys.has(dep));
    if (invalidDependency) {
      throw new Error(`[registry] 源 "${entry.key}" 存在无效依赖: ${invalidDependency}`);
    }
  }
  definitionsValidated = true;
}

/**
 * 按需构建一个源及其依赖。构造失败只影响当前调用，且错误包含源键，
 * 避免无关源的构造问题在模块加载阶段拖垮整个服务。
 */
function buildSource(key, dependencyPath = []) {
  validateRegistryDefinitions();
  if (instanceMap.has(key)) return instanceMap.get(key);

  const entry = definitionMap.get(key);
  if (!entry) return null;
  if (buildingKeys.has(key)) {
    throw new Error(`[registry] 源实例化存在循环依赖: ${[...dependencyPath, key].join(' -> ')}`);
  }

  buildingKeys.add(key);
  try {
    for (const dependencyKey of entry.deps) {
      buildSource(dependencyKey, [...dependencyPath, key]);
    }

    let instance;
    try {
      instance = entry.factory(instanceMap);
    } catch (error) {
      throw new Error(`[registry] 初始化源 "${entry.key}" 失败: ${error?.message || error}`);
    }

    const handleAdapter = entry.handleAdapter || ((inst, searchResult, queryTitle, isolatedAnimes, isolatedDetailStore, targetSeason) =>
      inst.handleAnimes(searchResult, queryTitle, isolatedAnimes, isolatedDetailStore, targetSeason));
    const buildSearchArgs = entry.searchArgs || ((queryTitle) => [queryTitle]);
    const meta = Object.freeze({
      key: entry.key,
      logName: entry.logName || entry.key,
      instance,
      deps: Object.freeze([...entry.deps]),
      canSearch: entry.canSearch !== false,
      canHandle: entry.canHandle !== false,
      canMerge: entry.canMerge === true,
      canDirect: entry.canDirect === true,
      buildSearchArgs,
      handleAdapter,
    });
    instanceMap.set(entry.key, instance);
    metaMap.set(entry.key, meta);
    return instance;
  } finally {
    buildingKeys.delete(key);
  }
}

/**
 * 显式初始化全部源，保留上游 API；正常请求路径应使用按键懒初始化。
 */
export function initSources() {
  validateRegistryDefinitions();
  for (const entry of SOURCE_REGISTRY) buildSource(entry.key);
}

/**
 * 按 sourceKey 取源实例。未注册返回 null。
 * @param {string} key sourceOrderArr 中的调度键名
 * @returns {BaseSource|null}
 */
export function getSourceByKey(key) {
  return buildSource(key);
}

/**
 * 按 sourceKey 取源元数据。未注册返回 null。
 * 用于分发点同时需要实例与日志标签的场景。
 */
export function getSourceMetaByKey(key) {
  const instance = buildSource(key);
  return instance ? metaMap.get(key) : null;
}

/**
 * 按 sourceKey 取日志标签规范名称。未注册时返回安全的 system 标签，
 * 避免把外部输入直接写入异步日志上下文。
 */
export function getLogNameByKey(key) {
  validateRegistryDefinitions();
  const entry = definitionMap.get(key);
  return entry ? (entry.logName || entry.key) : 'system';
}

/**
 * 取所有已注册源的元数据列表，按注册顺序。
 * 用于需要遍历全部源的场景。
 */
export function getAllSourceMetas() {
  initSources();
  return SOURCE_REGISTRY.map(entry => metaMap.get(entry.key));
}

/**
 * 取所有已注册源实例，按注册顺序。
 */
export function getAllSourceInstances() {
  initSources();
  return SOURCE_REGISTRY.map(entry => instanceMap.get(entry.key));
}

/**
 * 判断某 sourceKey 是否已注册。
 */
export function isRegisteredSource(key) {
  validateRegistryDefinitions();
  return definitionMap.has(key);
}

/**
 * 返回已经完成构造的源键，仅供健康检查和测试验证懒初始化行为。
 */
export function getInitializedSourceKeys() {
  return SOURCE_REGISTRY.filter(entry => instanceMap.has(entry.key)).map(entry => entry.key);
}
