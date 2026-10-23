<script setup lang="ts">
import { computed } from "vue";
import dayjs from "dayjs";
import type { Flashcard } from "@/models/flashcard";
import { safeHttpsUrl } from "@/services/FlashcardService";

/**
 * Thông tin chỉ-đọc do extension ghi: nguồn (tiêu đề + link https, câu chứa từ), ngôn ngữ, trạng thái tra từ điển.
 * Mọi chuỗi render bằng interpolation; link chỉ hiện khi bắt đầu bằng https://.
 */
const props = defineProps<{ card?: Flashcard | null }>();

const source = computed(() => props.card?.source ?? null);
const sourceUrl = computed(() => safeHttpsUrl(source.value?.url));
const sourceTitle = computed(() => (source.value?.title ?? "").trim() || sourceUrl.value || "");
const context = computed(() => (source.value?.context ?? "").trim());
const capturedAt = computed(() => {
    const value = source.value?.capturedAt;
    if (!value) return "";
    const date = dayjs(value);
    return date.isValid() ? date.format("DD/MM/YYYY HH:mm") : "";
});

const lang = computed(() => {
    const from = (props.card?.lang?.from ?? "").trim();
    const to = (props.card?.lang?.to ?? "").trim();
    if (!from && !to) return "";
    return `${from || "?"} → ${to || "?"}`;
});

const STATUSES = ["found", "not_found", "error", "skipped"];
const lookupStatus = computed(() => {
    const status = (props.card?.lookup?.status ?? "").toString().trim();
    return STATUSES.includes(status) ? status : "";
});
const lookupProvider = computed(() => (props.card?.lookup?.provider ?? "").trim());

const hasInfo = computed(
    () => !!(sourceTitle.value || context.value || lang.value || lookupStatus.value),
);
</script>
<template>
    <div v-if="hasInfo" class="flashcard-source-info">
        <div v-if="sourceTitle" class="flashcard-source-row">
            <span class="flashcard-source-label">{{ $t("flashcard.source") }}:</span>
            <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener noreferrer">
                {{ sourceTitle }}
            </a>
            <span v-else>{{ sourceTitle }}</span>
            <span v-if="capturedAt" class="flashcard-source-muted"> · {{ capturedAt }}</span>
        </div>
        <div v-if="context" class="flashcard-source-row">
            <span class="flashcard-source-label">{{ $t("flashcard.context") }}:</span>
            <span class="flashcard-source-context">{{ context }}</span>
        </div>
        <div v-if="lang || lookupStatus" class="flashcard-source-row">
            <span v-if="lang" class="flashcard-source-chip">{{ lang }}</span>
            <span
                v-if="lookupStatus"
                :class="['flashcard-source-chip', `lookup-${lookupStatus}`]"
                :title="lookupProvider"
            >
                {{ $t("flashcard.lookup") }}: {{ $t(`flashcard.lookup_status.${lookupStatus}`) }}
            </span>
        </div>
    </div>
</template>
<style scoped>
.flashcard-source-info {
    margin-top: 12px;
    padding: 10px 12px;
    background-color: var(--c-surface-raised);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
    font-size: 13px;
    color: var(--text-color);
}

.flashcard-source-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
}

.flashcard-source-row + .flashcard-source-row {
    margin-top: 6px;
}

.flashcard-source-label {
    color: var(--text-color-grey);
}

.flashcard-source-row a {
    color: var(--c-primary-text);
    overflow-wrap: anywhere;
}

.flashcard-source-context {
    font-style: italic;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

.flashcard-source-muted {
    color: var(--text-color-grey);
}

.flashcard-source-chip {
    padding: 1px 10px;
    border: 1px solid var(--content-item-border-color);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-color);
}

/* chỉ đổi màu viền (chữ giữ màu theme để đủ tương phản ở cả sáng / tối) */
.flashcard-source-chip.lookup-found {
    border-color: var(--c-success);
}

.flashcard-source-chip.lookup-not_found,
.flashcard-source-chip.lookup-skipped {
    border-color: var(--c-warning);
}

.flashcard-source-chip.lookup-error {
    border-color: var(--c-danger);
}
</style>
