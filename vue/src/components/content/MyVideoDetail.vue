<script setup>
import { API_ENDPOINT, API_ROOT_URL, REACTION_TYPE } from '@/constants/constants';
import { INJECTION_KEY } from '@/constants/injection-key';
import { get_by_fetch } from '@/utils/request-by-fetch';
import { get_random_int } from '@/utils/utils';
import { computed, inject, reactive, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faVideo, faListCheck } from '@fortawesome/free-solid-svg-icons';
import { User_Model } from '@/model/user-model';
import md5 from 'blueimp-md5';

const show_error_modal   = inject(INJECTION_KEY.SHOW_ERROR_MODAL)
const show_loading_modal = inject(INJECTION_KEY.SHOW_LOADING_MODAL)

// 合并上下文（App.vue provide）
const merge_ctx = inject(INJECTION_KEY.MERGE_CTX)

// —— 详情 & 选择项（第一条） —— //
const video_id            = inject(INJECTION_KEY.VIDEO_ID)
const video_detail        = inject(INJECTION_KEY.VIDEO_DETAIL)

// —— 详情（第二条，新增） —— //
const video_id_2          = inject(INJECTION_KEY.VIDEO_ID_2)
const video_detail_2      = inject(INJECTION_KEY.VIDEO_DETAIL_2)

const enable_comment_list = inject(INJECTION_KEY.ENABLE_COMMENT_LIST)
const enable_like_list    = inject(INJECTION_KEY.ENABLE_LIKE_LIST)
const enable_forward_list = inject(INJECTION_KEY.ENABLE_FORWARD_LIST)

// 列表容器
const show_list    = inject(INJECTION_KEY.SHOW_LIST);
const comment_list = inject(INJECTION_KEY.COMMENT_LIST);
const like_list    = inject(INJECTION_KEY.LIKE_LIST);
const forward_list = inject(INJECTION_KEY.FORWARD_LIST);
const user_list    = inject(INJECTION_KEY.USER_LIST);

// 进度轮询
const id_request = ref(0);
const array_request_queue = reactive([]);

// 是否启用“合并两条”
const isMergeOn = computed(() => !!(merge_ctx?.enabled && video_id_2))

// —— 数量展示：显示为 “第一条 + 第二条” —— //
const commentCountText = computed(() => {
  const a = Number(video_detail?.comment_count ?? 0)
  const b = Number(video_detail_2?.comment_count ?? 0)
  return isMergeOn.value ? `${a}+${b}` : String(a)
})
const likeCountText = computed(() => {
  const a = Number(video_detail?.like_count ?? 0)
  const b = Number(video_detail_2?.like_count ?? 0)
  return isMergeOn.value ? `${a}+${b}` : String(a)
})
const forwardCountText = computed(() => {
  const a = Number(video_detail?.forward_count ?? 0)
  const b = Number(video_detail_2?.forward_count ?? 0)
  return isMergeOn.value ? `${a}+${b}` : String(a)
})

// —— 开关禁用：合并时只在“两条都为0”才禁用（点赞/转发还要排除视频） —— //
const commentDisabled = computed(() => {
  const a = Number(video_detail?.comment_count ?? 0)
  const b = Number(video_detail_2?.comment_count ?? 0)
  return isMergeOn.value ? (a + b === 0) : (a === 0)
})
const likeDisabled = computed(() => {
  const typeIsVideo = video_detail?.source_type === 'video'
  const a = Number(video_detail?.like_count ?? 0)
  const b = Number(video_detail_2?.like_count ?? 0)
  return typeIsVideo || (isMergeOn.value ? (a + b === 0) : (a === 0))
})
const forwardDisabled = computed(() => {
  const typeIsVideo = video_detail?.source_type === 'video'
  const a = Number(video_detail?.forward_count ?? 0)
  const b = Number(video_detail_2?.forward_count ?? 0)
  return typeIsVideo || (isMergeOn.value ? (a + b === 0) : (a === 0))
})

// 禁用加载按钮条件
const disable_button_get_list = computed(() => {
  return !enable_comment_list.value && !enable_like_list.value && !enable_forward_list.value;
});

/**
 * 点击「加载」
 */
function on_click_get_list() {
  // 隐藏列表、清空数据
  show_list.value = false;
  comment_list.length = 0;
  like_list.length    = 0;
  forward_list.length = 0;
  user_list.length    = 0;

  // 组装请求队列
  array_request_queue.length = 0;
  if (enable_comment_list.value) array_request_queue.push(API_ENDPOINT.GET_COMMENT_LIST);
//   if (enable_like_list.value || enable_forward_list.value) array_request_queue.push(API_ENDPOINT.GET_REACTION_LIST);

    // ✅ 新增：只勾选评论时也拉一次点赞/转发列表，用于「已点赞」标注（仅动态可用）
    // 不会影响抽奖集合：create_user_list 只有在 enable_like_list 为 true 时才会把点赞并入交集
    if (!enable_like_list.value && !enable_forward_list.value && video_detail?.source_type !== 'video') {
        array_request_queue.push(API_ENDPOINT.GET_REACTION_LIST);
    }

    // 原逻辑：勾选点赞/转发时照常拉
    if (enable_like_list.value || enable_forward_list.value) {
        // 避免重复 push
        if (!array_request_queue.includes(API_ENDPOINT.GET_REACTION_LIST)) {
        array_request_queue.push(API_ENDPOINT.GET_REACTION_LIST);
        }
    }

  // 拉取
  get_list();
}

/**
 * 拉取一个 action + 一个 id
 * - 维持你原有的进度轮询
 * - 给每个用户打上 source_id（区分来自第一条还是第二条）
 * - 点赞/转发按 (source_id + user.id) 去重
 */
function fetch_for_id(action, id) {
  return new Promise((resolve) => {
    id_request.value = get_random_int(1, 10000000);
    get_by_fetch(
      API_ROOT_URL,
      { action, id, id_request: id_request.value },
      () => {
        show_loading_modal(true);
        set_timeout_get_request_status();
      },
      (response_data) => {
        const arr = Array.isArray(response_data) ? response_data : (response_data?.data ?? []);
        const array_user_model = arr.map((element) => new User_Model(element));
        for (const user_model of array_user_model) {
          // 标记来源
          user_model.source_id = String(id);

          if (action === API_ENDPOINT.GET_COMMENT_LIST) {
            // 评论保留多条
            comment_list.push(user_model);
          } else if (action === API_ENDPOINT.GET_REACTION_LIST) {
            // 点赞/转发：按 (source_id + id) 去重
            if (user_model.action === REACTION_TYPE.LIKE) {
              const exists = like_list.some(u => String(u.source_id) === String(id) && u.id === user_model.id);
              if (!exists) like_list.push(user_model);
            } else if (user_model.action === REACTION_TYPE.FORWARD) {
              const exists = forward_list.some(u => String(u.source_id) === String(id) && u.id === user_model.id);
              if (!exists) forward_list.push(user_model);
            } else {
              console.error('未知的互动类型');
            }
          }
        }
      },
      (error) => show_error_modal(true, error.message),
      () => {
        show_loading_modal(false);
        id_request.value = 0;
        resolve();
      }
    )
  })
}

/**
 * 顺序消费 action 队列
 * - 若启用合并：对 id1 -> id2 依次拉取，再进入下一个 action
 * - 否则：只对单个 video_id 拉取
 */
async function get_list() {
  if (array_request_queue.length === 0) {
    create_user_list();
    return;
  }
  const action = array_request_queue.pop();

  if (merge_ctx?.enabled && merge_ctx.id1 && merge_ctx.id2) {
    await fetch_for_id(action, String(merge_ctx.id1));
    await fetch_for_id(action, String(merge_ctx.id2));
  } else {
    await fetch_for_id(action, String(video_id.value));
  }

  await get_list();
}

/**
 * 轮询请求进度
 */
function set_timeout_get_request_status() {
  if (id_request.value) {
    get_by_fetch(
      API_ROOT_URL,
      { action: API_ENDPOINT.GET_REQUEST_STATUS, id_request: id_request.value },
      null,
      (response_data) => show_loading_modal(null, response_data.data),
      null,
      () => setTimeout(set_timeout_get_request_status, 3000)
    )
  }
}

/**
 * 根据勾选项合成最终用户列表
 * 目标：对每个 source（链接）分别求交集，再把两个 source 的结果并集后去重
 */
function create_user_list() {
  // 分组工具：Array<User> -> Map<source_id, Map<uid, User>>
  const groupBySource = (arr) => {
    const bySrc = new Map();
    for (const u of arr) {
      const src = String(u?.source_id || '');
      if (!bySrc.has(src)) bySrc.set(src, new Map());
      bySrc.get(src).set(String(u.id), u);
    }
    return bySrc;
  };

  const C = groupBySource(comment_list);
  const L = groupBySource(like_list);
  const F = groupBySource(forward_list);

  const sources = new Set([...C.keys(), ...L.keys(), ...F.keys()]);

  const interIds = (maps) => {
    if (!maps.length) return new Set();
    let s = new Set([...maps[0].keys()]);
    for (let i = 1; i < maps.length; i++) {
      const si = new Set([...maps[i].keys()]);
      s = new Set([...s].filter(x => si.has(x)));
    }
    return s;
  };

  // 对每个来源各自求交集，最后把不同来源的结果并起来并去重（按 uid）
  const resultMap = new Map(); // uid -> User
  for (const src of sources) {
    const buckets = [];
    if (enable_comment_list.value) buckets.push(C.get(src) || new Map());
    if (enable_like_list.value)    buckets.push(L.get(src) || new Map());
    if (enable_forward_list.value) buckets.push(F.get(src) || new Map());
    if (!buckets.length) continue;

    const ids = interIds(buckets);
    for (const uid of ids) {
      // 优先选择信息更全的对象（评论 > 点赞 > 转发）
      const u =
        (C.get(src)?.get(uid)) ||
        (L.get(src)?.get(uid)) ||
        (F.get(src)?.get(uid));
      if (u && !resultMap.has(uid)) resultMap.set(uid, u);
    }
  }

  // 写入最终池
  user_list.splice(0, user_list.length, ...Array.from(resultMap.values()));
  set_comment_duplicate_info(); // 标注是否原创评论（按来源）
  show_list.value = true;
}

/**
 * 检测评论是否为原创评论，并设置相关信息（按 source_id 避免跨链接误判）
 */
function set_comment_duplicate_info() {
  const map_hash_to_original = {};

  user_list.slice().reverse().map((user) => {
    const content = (user.content || '').trim();
    const src = String(user?.source_id || '');
    const key = src + '|' + md5(content);

    let original = map_hash_to_original[key] || null;

    if (original) {
      // 非原创评论
      original.count++;
      user.original_comment_id     = original.id;
      user.duplicate_comment_count = original.count;
    } else {
      // 原创
      original = { id: user.reply_id, count: 0 };
    }

    map_hash_to_original[key] = original;
  });
}

// 当切换第一条视频/动态时，清空状态
watch(video_id, () => {
  enable_comment_list.value = false;
  enable_like_list.value    = false;
  enable_forward_list.value = false;

  show_list.value = false;
  comment_list.length = 0;
  like_list.length    = 0;
  forward_list.length = 0;
  user_list.length    = 0;
});
</script>

<template>
  <div>
    <!-- 第一条：视频/动态详情 -->
    <div class="row justify-content-center align-items-center gy-3 mt-3 border-bottom">
      <div class="col-12 text-center">
        <h3><font-awesome-icon :icon="faVideo" class="me-1" /> 视频/动态详情</h3>
      </div>

      <div class="col-auto">
        <img :src="video_detail.author_avatar" class="rounded-circle" style="width:50px; height:50px;"
             referrerpolicy="no-referrer" crossorigin="anonymous" />
      </div>
      <div class="col-auto">
        <div class="text-pink fw-bold">{{ video_detail.author_name }}</div>
      </div>
      <div class="col-auto">
        <div class="">{{ video_detail.description }}</div>
      </div>

      <div></div>
    </div>

    <!-- ✅ 第二条详情：紧跟第一条下面（只读显示） -->
    <div v-if="isMergeOn && video_id_2" class="row justify-content-center align-items-center gy-3 mt-3 border-bottom">
      <div class="col-12 text-center">
        <h3>第二条 视频/动态详情</h3>
      </div>

      <div class="col-auto">
        <img :src="video_detail_2.author_avatar" class="rounded-circle" style="width:50px; height:50px;"
             referrerpolicy="no-referrer" crossorigin="anonymous" />
      </div>
      <div class="col-auto">
        <div class="text-pink fw-bold">{{ video_detail_2.author_name }}</div>
      </div>
      <div class="col-auto">
        <div class="">{{ video_detail_2.description }}</div>
      </div>

      <div></div>
    </div>

    <!-- 选择提取条件（显示合并后的数量文案） -->
    <div class="row justify-content-center align-items-center gy-3 mt-3 border-bottom">
      <div class="col-12 text-center">
        <h3><font-awesome-icon :icon="faListCheck" class="me-1" /> 请勾选提取条件</h3>
      </div>

      <div class="col-auto text-center ">
        <div class="border p-2 rounded-start">

          <div class="form-check form-check-inline">
            <input
              v-model="enable_comment_list"
              :disabled="commentDisabled"
              class="form-check-input me-3"
              type="checkbox"
              id="enable_comment_list">
            <label :class="{ 'opacity-25': commentDisabled }" class="form-check-label fs-5" for="enable_comment_list">
              评论用户 ({{ commentCountText }})
            </label>
          </div>

          <div class="form-check form-check-inline">
            <input
              v-model="enable_like_list"
              :disabled="likeDisabled"
              class="form-check-input me-3"
              type="checkbox"
              id="enable_like_list">
            <label :class="{ 'opacity-25': likeDisabled }" class="form-check-label fs-5" for="enable_like_list">
              点赞用户 ({{ likeCountText }})
            </label>
          </div>

          <div class="form-check form-check-inline">
            <input
              v-model="enable_forward_list"
              :disabled="forwardDisabled"
              class="form-check-input me-3"
              type="checkbox"
              id="enable_forward_list">
            <label :class="{ 'opacity-25': forwardDisabled }" class="form-check-label fs-5" for="enable_forward_list">
              转发用户 ({{ forwardCountText }})
            </label>
          </div>

        </div>
      </div>

      <div class="col-auto">
        <div class="">
          <button :disabled="disable_button_get_list" class="btn btn-lg btn-miku px-4"
                  @click="on_click_get_list">加载</button>
        </div>
      </div>

      <div class="col-12 text-center">
        <div v-if="enable_comment_list && (enable_like_list || enable_forward_list)" class="my-2 alert alert-warning">
          <span class="badge text-bg-danger">注意</span>
          勾选了 (评论+点赞 / 评论+转发 / 点赞+转发 / 评论+点赞+转发), 会因为
          <strong>点赞</strong> 和 <strong>转发</strong> 的数量限制, 在点赞+转发=总数超过1500的情况, 有可能只获取到一小部分的用户列表 (B站接口限制),
          这种情况建议 只使用评论用户列表来抽奖
        </div>

        <div class="my-2">
          视频地址只支持加载 <strong>评论用户</strong> | 动态地址支持加载同时
          <strong>评论</strong>+<strong>点赞</strong>+<strong>转发</strong> 的用户
        </div>
        <div class="my-2">
          <span class="badge text-bg-danger">注意</span> <strong>评论</strong> 加载只能读取到一级评论和回复评论的二级子评论,
          不包含回复二级子评论的三级子评论
        </div>
        <div class="my-2">
          <span class="badge text-bg-danger">注意</span> <strong>点赞</strong> 和 <strong>转发</strong> 加载有数量限制,
          在点赞+转发=总数超过1500的情况, 有可能只获取到一小部分的用户列表 (B站接口限制), 这种情况建议 只使用评论用户列表来抽奖
        </div>
      </div>

      <div></div>
    </div>
  </div>
</template>

<style scoped>
.form-check-input { width: 25px; height: 25px; }
</style>
