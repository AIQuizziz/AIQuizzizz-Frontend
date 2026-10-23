<script setup lang="ts">
import { ref, watch } from "vue";
import { GUIDE, isSinglePageGroup } from "@/guide/manifest";

/**
 * Cây mục lục của trang Hướng dẫn. Nhóm chứa trang đang xem luôn được mở;
 * nhóm chỉ có một trang hiển thị như mục lá. Dùng cho cả cột trái (desktop) và drawer (mobile).
 */
const props = defineProps<{ activeGroup?: string; activePage?: string }>();
const emit = defineEmits<{ (e: "navigate"): void }>();

const expanded = ref(new Set<string>(props.activeGroup ? [props.activeGroup] : []));

watch(
    () => props.activeGroup,
    (group) => {
        if (group && !expanded.value.has(group)) expanded.value = new Set([...expanded.value, group]);
    },
);

const toggle = (slug: string) => {
    const next = new Set(expanded.value);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    expanded.value = next;
};

const isActive = (group: string, page: string) => props.activeGroup === group && props.activePage === page;
</script>

<template>
    <ul class="guide-toc">
        <li v-for="group in GUIDE" :key="group.slug" class="guide-toc-group">
            <RouterLink
                v-if="isSinglePageGroup(group)"
                :to="{ name: 'guide', params: { group: group.slug, page: group.pages[0].slug } }"
                :class="['guide-toc-leaf', { active: isActive(group.slug, group.pages[0].slug) }]"
                :aria-current="isActive(group.slug, group.pages[0].slug) ? 'page' : undefined"
                @click="emit('navigate')"
            >
                <i class="bx bx-file-blank" aria-hidden="true"></i>
                <span>{{ group.title }}</span>
            </RouterLink>
            <template v-else>
                <button
                    type="button"
                    class="guide-toc-group-btn"
                    :aria-expanded="expanded.has(group.slug)"
                    :aria-controls="`guide-toc-${group.slug}`"
                    @click="toggle(group.slug)"
                >
                    <i
                        :class="['bx', expanded.has(group.slug) ? 'bx-chevron-down' : 'bx-chevron-right']"
                        aria-hidden="true"
                    ></i>
                    <span>{{ group.title }}</span>
                </button>
                <ul v-show="expanded.has(group.slug)" :id="`guide-toc-${group.slug}`" class="guide-toc-items">
                    <li v-for="page in group.pages" :key="page.slug">
                        <RouterLink
                            :to="{ name: 'guide', params: { group: group.slug, page: page.slug } }"
                            :class="['guide-toc-item', { active: isActive(group.slug, page.slug) }]"
                            :aria-current="isActive(group.slug, page.slug) ? 'page' : undefined"
                            @click="emit('navigate')"
                        >
                            {{ page.title }}
                        </RouterLink>
                    </li>
                </ul>
            </template>
        </li>
    </ul>
</template>

<style scoped>
.guide-toc,
.guide-toc-items {
    list-style: none;
    margin: 0;
    padding: 0;
}
.guide-toc-group + .guide-toc-group {
    margin-top: 2px;
}
.guide-toc-items {
    margin: 2px 0 8px;
}
.guide-toc-group-btn,
.guide-toc-leaf,
.guide-toc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    padding: 6px 10px;
    border: 0;
    border-radius: var(--ui-r-md);
    background: transparent;
    color: var(--c-text);
    font-size: 14px;
    line-height: 1.45;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
}
.guide-toc-group-btn,
.guide-toc-leaf {
    font-weight: 600;
}
.guide-toc-group-btn i,
.guide-toc-leaf i {
    flex-shrink: 0;
    font-size: 18px;
    color: var(--c-text-muted);
}
.guide-toc-item {
    padding-left: 36px;
    color: var(--c-text-muted);
    font-weight: 400;
}
.guide-toc-group-btn:hover,
.guide-toc-leaf:hover,
.guide-toc-item:hover {
    background-color: var(--c-surface-subtle);
    color: var(--c-text);
}
.guide-toc-leaf.active,
.guide-toc-item.active {
    background-color: color-mix(in srgb, var(--c-primary) 14%, var(--c-surface));
    color: var(--c-primary-text);
    font-weight: 500;
}
.guide-toc-leaf.active i {
    color: var(--c-primary-text);
}
.guide-toc-group-btn:focus-visible,
.guide-toc-leaf:focus-visible,
.guide-toc-item:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 1px;
}
</style>
