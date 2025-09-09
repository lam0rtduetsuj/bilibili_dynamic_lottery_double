import { provide, reactive } from 'vue'
import { INJECTION_KEY } from '@/constants/injection-key'

export function useProvideMergeOptions() {
  const merge_ctx = reactive({
    enabled: false,     // 是否启用合并
    type: '',           // 'video' | 'dynamic'
    id1: '',            // 第一个链接抽出的ID
    id2: ''             // 第二个链接抽出的ID
  })
  provide(INJECTION_KEY.MERGE_CTX, merge_ctx)
  return merge_ctx
}
