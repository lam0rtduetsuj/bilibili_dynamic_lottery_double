<script setup>
import { API_ENDPOINT, API_ROOT_URL } from '@/constants/constants';
import { INJECTION_KEY } from '@/constants/injection-key';
import { get_by_fetch } from '@/utils/request-by-fetch';
import { clear_object } from '@/utils/utils';
import { inject, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faGift } from '@fortawesome/free-solid-svg-icons';

const emit = defineEmits(['get_list', 'clear_list'])

const show_error_modal = inject(INJECTION_KEY.SHOW_ERROR_MODAL)
const show_loading_modal = inject(INJECTION_KEY.SHOW_LOADING_MODAL)

// 第1条
const video_id = inject(INJECTION_KEY.VIDEO_ID)
const video_detail = inject(INJECTION_KEY.VIDEO_DETAIL)
const video_url = inject(INJECTION_KEY.VIDEO_URL)

// 第2条（新增）
const video_id_2 = inject(INJECTION_KEY.VIDEO_ID_2)
const video_detail_2 = inject(INJECTION_KEY.VIDEO_DETAIL_2)
const video_url_2 = inject(INJECTION_KEY.VIDEO_URL_2)

// 输入
const url  = ref('')
const url2 = ref('')

// 合并上下文
const merge = ref(false)
const merge_ctx = inject(INJECTION_KEY.MERGE_CTX)

/**
 * 统一入口：支持“单条”或“合并两条”
 */
function on_click_search() {
  if (!url.value) return;

  // 未合并：走旧流程 + 清理第二条状态与上下文
  if (!merge.value || !url2.value) {
    if (merge_ctx) Object.assign(merge_ctx, { enabled: false, type: '', id1: '', id2: '' });
    // 清空第二条（避免残留）
    if (video_id_2) video_id_2.value = '';
    if (video_url_2) video_url_2.value = '';
    if (video_detail_2) clear_object(video_detail_2);
    on_click_get_detail();
    return;
  }

  // —— 合并模式 —— //
  const id1 = extra_url_id(url.value);
  const id2 = extra_url_id(url2.value);
  if (!id1 || !id2) {
    const error_message = `
    无法识别链接（至少一条无效）。目前支持: <br/> 
    https://www.bilibili.com/video/BV1XXXXX, <br/> 
    https://www.bilibili.com/opus/XXX, <br/> 
    https://t.bilibili.com/XXXXX
    `;
    show_error_modal(true, error_message);
    return;
  }

  // 类型一致性校验（基于 URL）
  const t1 = detect_type_from_url(url.value);
  const t2 = detect_type_from_url(url2.value);
  if (!t1 || !t2) {
    show_error_modal(true, '无法判断链接类型，请检查两条链接是否为视频/动态常见格式');
    return;
  }
  if (t1 !== t2) {
    show_error_modal(true, '两条链接类型不同（一个视频一个动态），无法合并');
    return;
  }

  // 规范化两个 URL
  try {
    const u1 = new URL(url.value);
    video_url.value = u1.origin + u1.pathname;
    const u2 = new URL(url2.value);
    video_url_2.value = u2.origin + u2.pathname;
  } catch (error) {
    show_error_modal(true, '无法把链接转换成URL对象');
    return;
  }

  // 写入全局合并上下文
  if (merge_ctx) {
    Object.assign(merge_ctx, {
      enabled: true,
      type: t1, // 'video' | 'dynamic'
      id1,
      id2
    });
  }

  // 分别加载两条详情（第一条 + 第二条）
  set_video_id_and_video_detail(id1);
  set_video_id_and_video_detail_2(id2);
}

/**
 * 搜索按钮点击事件（旧：单条）
 */
function on_click_get_detail() {
  //如果链接为空, 中断运行
  if (!url.value) return;

  const _id = extra_url_id(url.value);

  //如果无法提取出数据ID
  if (!_id) {
    const error_message = `
    无法识别链接, 工具目前支持的格式为: <br/> 
    https://www.bilibili.com/video/BV1XXXXX, <br/> 
    https://www.bilibili.com/opus/XXX, <br/> 
    https://t.bilibili.com/XXXXX
    `;
    show_error_modal(true, error_message);
    return;
  }

  //提取保存 纯净的视频/动态地址, 移除其他额外参数
  try {
    const url_object = new URL(url.value);
    video_url.value = url_object.origin + url_object.pathname;
  } catch (error) {
    const error_message = '无法把链接转换成URL对象';
    show_error_modal(true, error_message);
    return;
  }

  set_video_id_and_video_detail(_id);
}

/**
 * 从URL地址中提取ID
 */
function extra_url_id(url) {
  let url_id = '';

  // BV视频：https://www.bilibili.com/video/BVxxxx
  let match = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  url_id = match ? match[1] : null;

  // 动态（新）：https://www.bilibili.com/opus/123...
  if (!url_id) {
    match = url.match(/\/opus\/([0-9]+)/);
    url_id = match ? match[1] : null;
  }

  // 动态（旧）：https://t.bilibili.com/123...
  if (!url_id) {
    match = url.match(/t\.bilibili\.com\/([0-9]+)/);
    url_id = match ? match[1] : null;
  }

  return url_id;
}

/** 类型判定：'video' | 'dynamic' | '' */
function detect_type_from_url(u) {
  if (!u) return '';
  if (/\/video\/BV[a-zA-Z0-9]+/i.test(u)) return 'video';
  if (/\/opus\/\d+/i.test(u)) return 'dynamic';
  if (/t\.bilibili\.com\/\d+/i.test(u)) return 'dynamic';
  return '';
}

/**
 * 拉取详情（第1条）
 */
function set_video_id_and_video_detail(id) {
  get_by_fetch(
    API_ROOT_URL,
    { action: API_ENDPOINT.GET_DETAIL, id },
    () => { show_loading_modal(true); },
    (response_data) => {
      video_id.value = id;
      video_detail.assign(response_data);
    },
    (error) => {
      video_id.value = '';
      clear_object(video_detail);
      show_error_modal(true, error.message);
    },
    () => { show_loading_modal(false); }
  )
}

/**
 * 拉取详情（第2条）
 */
function set_video_id_and_video_detail_2(id) {
  get_by_fetch(
    API_ROOT_URL,
    { action: API_ENDPOINT.GET_DETAIL, id },
    () => { show_loading_modal(true); },
    (response_data) => {
      video_id_2.value = id;
      video_detail_2.assign(response_data);
    },
    (error) => {
      video_id_2.value = '';
      clear_object(video_detail_2);
      show_error_modal(true, error.message);
    },
    () => { show_loading_modal(false); }
  )
}
</script>

<template>
  <div class="row justify-content-center gy-3 border-bottom">
    <div class="col-12 text-center">
      <img src="/logo.png" style="width: 150px">
    </div>

    <div class="col-12 text-center">
      <h3>
        <font-awesome-icon :icon="faGift" class="me-1" />
        请输入B站网页版里的视频地址/动态地址 (不支持 b23.tv 短链)
      </h3>
    </div>

    <div class="col-12">
      <!-- 合并开关 -->
      <div class="form-check my-2 text-center">
        <input class="form-check-input" type="checkbox" id="mergeCheck" v-model="merge">
        <label class="form-check-label" for="mergeCheck">合并两条链接</label>
      </div>

      <!-- 链接1 -->
      <div class="input-group input-group-lg mb-2">
        <input
          class="form-control text-center text-body-secondary"
          type="url"
          v-model.trim="url"
          placeholder="链接1（视频/动态）"
          @keyup.enter="on_click_search" />
      </div>

      <!-- 链接2（仅在合并时显示） -->
      <div v-if="merge" class="input-group input-group-lg mb-2">
        <input
          class="form-control text-center text-body-secondary"
          type="url"
          v-model.trim="url2"
          placeholder="链接2（与链接1类型相同）"
          @keyup.enter="on_click_search" />
      </div>

      <!-- 搜索按钮 -->
      <div class="input-group input-group-lg">
        <button class="btn btn-miku w-100" @click="on_click_search">搜索</button>
      </div>
    </div>

    <div class="col-12 text-center">
      <div class="my-2">
        本工具可以从B站 (视频/动态) 中提取出 (评论/转发/点赞) 用户列表, 然后随机选出中奖者
      </div>
      <div class="my-2">
        <span class="badge text-bg-miku">2024-11</span> 新增检测用户是否完成评论+点赞+转发全部要求的功能: 允许过滤未完成3项的用户
      </div>
      <div class="my-2">
        <span class="badge text-bg-miku">2024-11</span> 新增B站账号登陆功能: 登陆后再查询, 能增加提取数据的成功率, 还能查询目前用户是否为自己的粉丝
      </div>
    </div>

    <div class="col"></div>
  </div>
</template>

<style scoped></style>
