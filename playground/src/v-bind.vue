<script setup lang="ts">
import { computed, ref } from '@vue/vapor'

// 怎么合并？分为 compiler 部分和 runtime 部分
//
// core 里面的逻辑
// - v-bind="obj"：纯 obj，不存在重复 arg，即使存在动态 key 与静态 key 重复，在运行时 js 会自动合并重复 key
//   - v-bind="obj" + v-bind:arg=""：静态 arg 在编译时去重(class, style, vOn)后，分别加入 mergeArgs 数组，交给运行时 mergeProps(key去重+class, style, vOn去重)，生成代码时v-bind:arg=""拼接成实际对象(objectExpression)
// - v-bind="{}"：字面量对象，在生成运行时代码阶段，拼接成实际对象(compound expression)；不存在重复 key，同v-bind="obj"
//   - v-bind="{}" + v-bind:arg=""：同上
//
// todo 实现设计
// - v-bind="obj"：注册 genObjProp 操作，在运行时取出 Obj 的每个键值对执行 setDynamicProp
//   - v-bind="obj" + v-bind:arg=""：参考旧逻辑保存到 mergeArgs 中，在运行时通过 key 合并。todo 静态 arg 合并(class, style, vOn)
// todo 实现初版，与 core 运行结果对比

const count = ref(1)
const obj = computed(() => ({ id: String(count.value), subObj: { a: 'xxx' } }))
const key = ref('id')

const handleClick = () => {
  count.value++
}
</script>

<template>
  <button @click="handleClick">{{ count }}</button>

  <!-- 静态 arg 被动态 arg 覆盖，响应式更新 -->
  <button :id="'before'" :[key]="'dynamic key before' + count">
    {{ count }}
  </button>
  <!-- 动态 arg 被静态 arg 覆盖，丢失响应式更新 -->
  <button :[key]="'dynamic key before' + count" :id="'before'">
    {{ count }}
  </button>
  <!-- 响应式更新 -->
  <button v-bind="obj">{{ count }}</button>
  <button v-bind="{ id: `${count}`, subObj: { a: 'xxx' } }">
    {{ count }}
  </button>
  <!-- 前面的 v-bind:arg 值应该被后面的 v-bind="obj" 值覆盖，并响应式更新 -->
  <button :id="'before'" v-bind="obj">{{ count }}</button>
  <button :[key]="'dynamic key before'" v-bind="obj">
    {{ count }}
  </button>
  <!-- 前面的 v-bind="obj" 值应该被后面的 v-bind:arg 值覆盖，并丢失响应式更新 -->
  <button v-bind="obj" :id="'after'">{{ count }}</button>
  <button v-bind="obj" :[key]="'dynamic key after'">{{ count }}</button>
</template>
