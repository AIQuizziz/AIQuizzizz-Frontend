<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { GUIDE_LOCALE, searchGuide, type GuideSearchResult } from "@/services/GuideService";

/** Ô tìm kiếm của trang Hướng dẫn: tìm theo tiêu đề + nội dung, chọn bằng chuột hoặc phím mũi tên / Enter */
const props = defineProps<{ shortcut?: boolean }>();
const emit = defineEmits<{ (e: "navigate"): void }>();

const router = useRouter();
const { t } = useI18n();
const gt = (key: string) => t(key, {}, { locale: GUIDE_LOCALE });
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const results = ref<GuideSearchResult[]>([]);
const loading = ref(false);
const open = ref(false);
const highlighted = ref(0);
const listId = `guide-search-${Math.random().toString(36).slice(2, 8)}`;

let timer: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;

watch(query, (value) => {
    if (timer) clearTimeout(timer);
    if (!value.trim()) {
        results.value = [];
        loading.value = false;
        return;
    }
    loading.value = true;
    timer = setTimeout(async () => {
        const current = ++requestId;
        const found = await searchGuide(value);
        if (current !== requestId) return;
        results.value = found;
        highlighted.value = 0;
        loading.value = false;
    }, 150);
});

const showPanel = computed(() => open.value && query.value.trim().length > 0);

const go = (result?: GuideSearchResult) => {
    if (!result) return;
    router.push({ name: "guide", params: { group: result.entry.group.slug, page: result.entry.page.slug } });
    query.value = "";
    open.value = false;
    inputRef.value?.blur();
    emit("navigate");
};

const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        highlighted.value = Math.min(highlighted.value + 1, results.value.length - 1);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        highlighted.value = Math.max(highlighted.value - 1, 0);
    } else if (event.key === "Enter") {
        event.preventDefault();
        go(results.value[highlighted.value]);
    } else if (event.key === "Escape") {
        open.value = false;
        inputRef.value?.blur();
    }
};

// mousedown trên kết quả chạy trước blur của ô nhập, nên đóng panel trễ một chút
const onBlur = () => setTimeout(() => (open.value = false), 120);

const onGlobalKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.value?.focus();
    }
};

onMounted(() => {
    if (props.shortcut) window.addEventListener("keydown", onGlobalKeydown);
});
onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
    window.removeEventListener("keydown", onGlobalKeydown);
});
</script>

<template>
    <div class="guide-search">
        <i class="bx bx-search guide-search-icon" aria-hidden="true"></i>
        <input
            ref="inputRef"
            v-model="query"
            type="search"
            class="guide-search-input"
            role="combobox"
            :aria-expanded="showPanel"
            :aria-controls="listId"
            :aria-activedescendant="showPanel && results.length ? `${listId}-${highlighted}` : undefined"
            :aria-label="gt('guide.search_placeholder')"
            :placeholder="gt('guide.search_placeholder')"
            autocomplete="off"
            @focus="open = true"
            @blur="onBlur"
            @keydown="onKeydown"
        />
        <kbd v-if="props.shortcut" class="guide-search-kbd" aria-hidden="true">Ctrl K</kbd>

        <div v-if="showPanel" class="guide-search-panel">
            <div v-if="loading && !results.length" class="guide-search-empty">{{ gt("guide.searching") }}</div>
            <div v-else-if="!results.length" class="guide-search-empty">{{ gt("guide.no_results") }}</div>
            <ul v-else :id="listId" role="listbox" class="guide-search-list">
                <li
                    v-for="(result, index) in results"
                    :id="`${listId}-${index}`"
                    :key="result.entry.path"
                    role="option"
                    :aria-selected="index === highlighted"
                    :class="['guide-search-result', { highlighted: index === highlighted }]"
                    @mousedown.prevent="go(result)"
                    @mousemove="highlighted = index"
                >
                    <span class="guide-search-path">{{ result.entry.group.title }}</span>
                    <span class="guide-search-title">{{ result.entry.page.title }}</span>
                    <span class="guide-search-snippet">{{ result.snippet }}</span>
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.guide-search {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
}
.guide-search-icon {
    position: absolute;
    left: 12px;
    font-size: 18px;
    color: var(--c-text-muted);
    pointer-events: none;
}
.guide-search-input {
    width: 100%;
    height: 40px;
    padding: 0 64px 0 38px;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--ui-r-sm);
    background-color: var(--c-surface);
    color: var(--c-text);
    font-size: 14px;
}
.guide-search-input::placeholder {
    color: var(--c-placeholder);
}
.guide-search-input:focus {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 0;
    border-color: var(--c-primary);
}
.guide-search-input::-webkit-search-cancel-button {
    display: none;
}
.guide-search-kbd {
    position: absolute;
    right: 8px;
    padding: 2px 6px;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-xs);
    background: var(--c-surface-raised);
    color: var(--c-text-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    pointer-events: none;
}
.guide-search-panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 30;
    max-height: min(420px, 70vh);
    overflow-y: auto;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-lg);
    background-color: var(--c-surface-raised);
    box-shadow: var(--ui-shadow-pop);
}
.guide-search-list {
    list-style: none;
    margin: 0;
    padding: 6px;
}
.guide-search-result {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: var(--ui-r-sm);
    cursor: pointer;
}
.guide-search-result.highlighted {
    background-color: color-mix(in srgb, var(--c-primary) 14%, var(--c-surface-raised));
}
.guide-search-path {
    color: var(--c-text-muted);
    font-size: 12px;
}
.guide-search-title {
    color: var(--c-text);
    font-size: 14px;
    font-weight: 600;
}
.guide-search-result.highlighted .guide-search-title {
    color: var(--c-primary-text);
}
.guide-search-snippet {
    color: var(--c-text-muted);
    font-size: 13px;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.guide-search-empty {
    padding: 14px;
    color: var(--c-text-muted);
    font-size: 14px;
}
</style>
