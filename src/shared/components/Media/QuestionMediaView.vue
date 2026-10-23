<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import type { QuestionMedia } from "@/models/response/media/questionMedia";

/*
 * Hiển thị media của câu hỏi.
 * - Ảnh: <img loading="lazy">, click để phóng to.
 * - Video: <video preload="none"> -> trình duyệt không tải gì cho tới khi bấm play, sau đó chỉ tải
 *   theo HTTP Range. Không bao giờ fetch video bằng JS/blob.
 * URL là presigned URL ngắn hạn: khi lỗi (thường do hết hạn) hiển thị fallback + nút tải lại,
 * nút này gọi hàm `@reload` của trang (lấy lại dữ liệu mới từ API).
 */
interface Props {
    media?: QuestionMedia | null;
    // hàm tải lại dữ liệu của trang (truyền qua @reload), có thể trả về Promise
    onReload?: () => unknown;
    // thông báo thay thế khi trang không hỗ trợ tải lại
    expiredHint?: string;
    compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    media: null,
    onReload: undefined,
    expiredHint: "",
    compact: false,
});

const { t } = useI18n();

const hasError = ref(false);
const reloading = ref(false);
const previewOpen = ref(false);

const onMediaError = () => {
    hasError.value = true;
};

// video dùng preload="none" nên poster hết hạn sẽ không phát sinh lỗi trên <video> -> kiểm tra riêng
let posterProbe: HTMLImageElement | null = null;
const probePoster = (url?: string | null) => {
    if (posterProbe) {
        posterProbe.onerror = null;
        posterProbe = null;
    }
    if (!url) return;
    posterProbe = new Image();
    posterProbe.onerror = onMediaError;
    posterProbe.src = url;
};

watch(
    () => [props.media?.url, props.media?.thumbnailUrl],
    () => {
        hasError.value = false;
        if (props.media?.type === "Video") probePoster(props.media.thumbnailUrl);
        if (props.media && !props.media.url) hasError.value = true;
    },
    { immediate: true },
);

onBeforeUnmount(() => probePoster(null));

const onReloadClick = async () => {
    if (!props.onReload || reloading.value) return;
    try {
        reloading.value = true;
        await props.onReload();
    } finally {
        reloading.value = false;
        // thử hiển thị lại với URL mới nhất
        hasError.value = !props.media?.url;
        if (props.media?.type === "Video") probePoster(props.media.thumbnailUrl);
    }
};
</script>
<template>
    <div v-if="props.media" :class="['question-media', { compact: props.compact }]" @click.stop>
        <div v-if="hasError" class="question-media-fallback">
            <i class="bx bx-error-circle"></i>
            <div class="question-media-fallback-text">
                <div>{{ $t("question_media.expired") }}</div>
                <div v-if="!props.onReload" class="question-media-fallback-hint">
                    {{ props.expiredHint || $t("question_media.refresh_page") }}
                </div>
            </div>
            <a-button
                v-if="props.onReload"
                size="small"
                :loading="reloading"
                @click="onReloadClick"
            >
                <i class="bx bx-refresh me-1"></i>
                {{ $t("question_media.reload") }}
            </a-button>
        </div>
        <template v-else-if="props.media.type === 'Image'">
            <img
                class="question-media-image"
                :src="props.media.url ?? undefined"
                :alt="t('question_media.image_alt')"
                loading="lazy"
                decoding="async"
                @error="onMediaError"
                @click="previewOpen = true"
            />
            <a-modal
                v-model:open="previewOpen"
                :footer="null"
                centered
                width="min(92vw, 1200px)"
                wrap-class-name="question-media-preview-modal"
            >
                <img
                    class="question-media-preview"
                    :src="props.media.url ?? undefined"
                    :alt="t('question_media.image_alt')"
                    decoding="async"
                    @error="onMediaError"
                />
            </a-modal>
        </template>
        <video
            v-else
            class="question-media-video"
            controls
            preload="none"
            playsinline
            controlslist="nodownload"
            :poster="props.media.thumbnailUrl ?? undefined"
            :src="props.media.url ?? undefined"
            @error="onMediaError"
        ></video>
    </div>
</template>
<style scoped>
.question-media {
    margin: 10px 0px;
    max-width: 100%;
}

.question-media-image {
    display: block;
    max-width: 100%;
    max-height: 360px;
    object-fit: contain;
    border-radius: var(--ui-r-md);
    cursor: zoom-in;
    background-color: var(--form-item-background-color);
}

.question-media-video {
    display: block;
    width: 640px;
    max-width: 100%;
    max-height: 360px;
    border-radius: var(--ui-r-md);
    background-color: #000;
}

.compact .question-media-image,
.compact .question-media-video {
    max-height: 220px;
}

.question-media-preview {
    display: block;
    max-width: 100%;
    max-height: 85vh;
    margin: 0 auto;
    object-fit: contain;
}

.question-media-fallback {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: var(--ui-r-lg);
    border: 1px dashed var(--c-border-strong);
    background-color: var(--c-surface-subtle);
}

.question-media-fallback i.bx-error-circle {
    font-size: 22px;
    color: var(--c-warning-text);
}

.question-media-fallback-hint {
    font-size: 12px;
    color: var(--c-text-muted);
}
</style>
