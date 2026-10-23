<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";

import ApiMedia from "@/api/ApiMedia";
import { useMediaStore } from "@/stores/MediaStore";
import type {
    QuestionMedia,
    QuestionMediaType,
    UploadMediaResult,
} from "@/models/response/media/questionMedia";
import {
    IMAGE_ACCEPT,
    VIDEO_ACCEPT,
    getUploadState,
    markUploadFinished,
    markUploadStarted,
    prepareUploadFile,
    readVideoDuration,
    resolveMediaFile,
} from "@/services/QuestionMediaService";

import QuestionMediaView from "./QuestionMediaView.vue";

/*
 * Chọn 1 ảnh HOẶC 1 video cho câu hỏi (theo quyền của gói).
 * Ghi trực tiếp vào question.mediaId / question.media (giống cách các editor câu hỏi đang làm với props.question)
 * để kết quả upload vẫn được gắn đúng câu hỏi kể cả khi component đã bị unmount (DynamicScroller).
 */
interface Props {
    question: { mediaId?: string | null; media?: QuestionMedia | null };
}

const props = defineProps<Props>();
const { t } = useI18n();

const mediaStore = useMediaStore();
const permission = computed(() => mediaStore.permission);
const canUploadImage = computed(() => !!permission.value?.canUploadImage);
const canUploadVideo = computed(() => !!permission.value?.canUploadVideo);
const canUploadAny = computed(() => canUploadImage.value || canUploadVideo.value);

const uploadState = computed(() => getUploadState(props.question));
const isBusy = computed(() => uploadState.value.status !== "idle");

const fileInputRef = ref<HTMLInputElement | null>(null);
const expectedKind = ref<QuestionMediaType | null>(null);
const isDragging = ref(false);

const accept = computed(() => {
    if (expectedKind.value === "Image") return IMAGE_ACCEPT;
    if (expectedKind.value === "Video") return VIDEO_ACCEPT;
    return [canUploadImage.value ? IMAGE_ACCEPT : "", canUploadVideo.value ? VIDEO_ACCEPT : ""]
        .filter(Boolean)
        .join(",");
});

const openFileDialog = (kind: QuestionMediaType | null) => {
    if (isBusy.value) return;
    expectedKind.value = kind;
    const input = fileInputRef.value;
    if (!input) return;
    // gán accept trực tiếp rồi click đồng bộ (trình duyệt chỉ cho mở hộp thoại trong user gesture)
    input.accept = accept.value;
    input.click();
};

const onFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // cho phép chọn lại cùng 1 file
    if (file) startUpload(file);
};

const onDrop = (event: DragEvent) => {
    isDragging.value = false;
    if (isBusy.value || !canUploadAny.value) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
        expectedKind.value = null;
        startUpload(file);
    }
};

const validateFile = async (file: File) => {
    const resolved = resolveMediaFile(file);
    if (!resolved || (expectedKind.value && resolved.kind !== expectedKind.value)) {
        message.error(t("ERROR_CODE.MEDIA_UNSUPPORTED_TYPE"));
        return null;
    }

    const perm = permission.value;
    if (!perm) return null;

    if (resolved.kind === "Image" && !perm.canUploadImage) {
        message.error(t("ERROR_CODE.PLAN_NOT_ALLOW_UPLOAD_IMAGE"));
        return null;
    }
    if (resolved.kind === "Video" && !perm.canUploadVideo) {
        message.error(t("ERROR_CODE.PLAN_NOT_ALLOW_UPLOAD_VIDEO"));
        return null;
    }
    if (file.size <= 0) {
        message.error(t("ERROR_CODE.MEDIA_INVALID_FILE"));
        return null;
    }

    const maxMb = resolved.kind === "Image" ? perm.maxImageSizeMb : perm.maxVideoSizeMb;
    if (maxMb > 0 && file.size > maxMb * 1024 * 1024) {
        message.error(t("question_media.error.too_large", { max: maxMb }));
        return null;
    }

    if (resolved.kind === "Video" && perm.maxVideoSeconds > 0) {
        // chỉ đọc metadata; định dạng trình duyệt không đọc được thì để server kiểm tra
        const duration = await readVideoDuration(file);
        if (duration !== null && duration > perm.maxVideoSeconds + 0.5) {
            message.error(t("question_media.error.too_long", { max: perm.maxVideoSeconds }));
            return null;
        }
    }

    return resolved;
};

const startUpload = async (file: File) => {
    if (isBusy.value) return;

    // giữ tham chiếu tới đúng câu hỏi lúc bắt đầu upload
    const question = props.question;
    const state = getUploadState(question);

    const resolved = await validateFile(file);
    if (!resolved || state.status !== "idle") return;

    state.status = "uploading";
    state.percent = 0;
    state.kind = resolved.kind;
    state.fileName = file.name;
    markUploadStarted();

    try {
        const result = await ApiMedia.Upload(prepareUploadFile(file, resolved.mime), (event) => {
            if (!event.total) return;
            state.percent = Math.min(100, Math.round((event.loaded * 100) / event.total));
            // đã gửi xong file, server đang xử lý (transcode video / chuẩn hoá ảnh)
            if (event.loaded >= event.total) state.status = "processing";
        });

        if (result?.data?.success) {
            const data = result.data.data as UploadMediaResult;
            question.mediaId = data.id;
            question.media = {
                id: data.id,
                type: data.type,
                url: data.url,
                thumbnailUrl: data.thumbnailUrl,
                expiresAt: data.expiresAt,
            };
            message.success(t("question_media.upload_success"));
        }
        // lỗi có mã (MEDIA_*, PLAN_NOT_ALLOW_*) / lỗi mạng đã được interceptor của Api hiển thị
    } catch (error) {
        console.log("ERROR: upload media", error);
    } finally {
        state.status = "idle";
        state.percent = 0;
        state.kind = null;
        state.fileName = "";
        markUploadFinished();
    }
};

const onRemove = () => {
    props.question.mediaId = null;
    props.question.media = null;
};

const progressText = computed(() =>
    uploadState.value.status === "processing"
        ? uploadState.value.kind === "Video"
            ? t("question_media.processing_video")
            : t("question_media.processing")
        : t("question_media.uploading", { percent: uploadState.value.percent }),
);

onMounted(() => {
    mediaStore.loadPermission();
});
</script>
<template>
    <div class="question-media-picker">
        <div class="picker-label">
            {{ $t("question_media.label") }}
            <span class="picker-label-hint">- {{ $t("question_media.one_media_hint") }}</span>
        </div>

        <!-- đang upload / xử lý -->
        <div v-if="isBusy" class="picker-progress">
            <div class="picker-progress-file">
                <i
                    :class="[
                        'bx',
                        uploadState.kind === 'Video' ? 'bx-video' : 'bx-image',
                        'picker-progress-icon',
                    ]"
                ></i>
                <span class="picker-progress-name">{{ uploadState.fileName }}</span>
            </div>
            <a-progress
                :percent="uploadState.percent"
                :status="'active'"
                :show-info="uploadState.status === 'uploading'"
                size="small"
            />
            <div class="picker-progress-text">
                <a-spin v-if="uploadState.status === 'processing'" size="small" class="me-2" />
                {{ progressText }}
            </div>
        </div>

        <!-- đã có media -->
        <div v-else-if="props.question.mediaId" class="picker-current">
            <QuestionMediaView
                v-if="props.question.media"
                :media="props.question.media"
                :expired-hint="$t('question_media.preview_expired_editor')"
                compact
            />
            <div v-else class="picker-attached">
                <i class="bx bx-paperclip"></i>
                {{ $t("question_media.attached") }}
            </div>
            <div class="picker-actions">
                <a-button v-if="canUploadAny" size="small" @click="openFileDialog(null)">
                    <i class="bx bx-transfer me-1"></i>
                    {{ $t("question_media.replace") }}
                </a-button>
                <a-popconfirm :title="$t('question_media.remove_confirm')" @confirm="onRemove">
                    <a-button size="small" danger>
                        <i class="bx bx-trash me-1"></i>
                        {{ $t("question_media.remove") }}
                    </a-button>
                </a-popconfirm>
            </div>
        </div>

        <!-- chưa có media -->
        <template v-else>
            <div v-if="mediaStore.loading && !permission" class="picker-hint">
                <a-spin size="small" class="me-2" />
                {{ $t("question_media.loading_permission") }}
            </div>
            <div v-else-if="!permission && mediaStore.failed" class="picker-hint">
                {{ $t("question_media.permission_failed") }}
                <a-button type="link" size="small" @click="mediaStore.loadPermission(true)">
                    {{ $t("question_media.retry") }}
                </a-button>
            </div>
            <div v-else-if="!canUploadAny" class="picker-hint picker-disabled">
                <i class="bx bx-lock-alt"></i>
                {{ $t("question_media.plan_not_allowed") }}
            </div>
            <div
                v-else
                :class="['picker-dropzone', { dragging: isDragging }]"
                @dragenter.prevent="isDragging = true"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="onDrop"
            >
                <div class="picker-buttons">
                    <a-button v-if="canUploadImage" size="small" @click="openFileDialog('Image')">
                        <i class="bx bx-image-add me-1"></i>
                        {{ $t("question_media.upload_image") }}
                    </a-button>
                    <a-button v-if="canUploadVideo" size="small" @click="openFileDialog('Video')">
                        <i class="bx bx-video-plus me-1"></i>
                        {{ $t("question_media.upload_video") }}
                    </a-button>
                    <span class="picker-drop-hint">{{ $t("question_media.drop_hint") }}</span>
                </div>
                <div class="picker-limits">
                    <span v-if="canUploadImage">
                        {{ $t("question_media.image_limit", { max: permission?.maxImageSizeMb }) }}
                    </span>
                    <span v-if="canUploadVideo">
                        {{
                            $t("question_media.video_limit", {
                                max: permission?.maxVideoSizeMb,
                                seconds: permission?.maxVideoSeconds,
                            })
                        }}
                    </span>
                </div>
            </div>
        </template>

        <input
            ref="fileInputRef"
            type="file"
            class="d-none"
            :accept="accept"
            @change="onFileChange"
        />
    </div>
</template>
<style scoped>
.question-media-picker {
    margin: 5px 0px 15px;
}

.picker-label {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
}

.picker-label-hint {
    font-weight: 400;
    color: var(--c-text-muted);
}

.picker-dropzone,
.picker-progress,
.picker-current {
    padding: 12px 16px;
    border-radius: var(--ui-r-lg);
    border: 1px solid var(--content-item-border-color);
    background-color: var(--c-surface-subtle);
}

.picker-dropzone {
    border-style: dashed;
    border-color: var(--c-border-strong);
    transition:
        background-color 0.15s,
        border-color 0.15s;
}

.picker-dropzone:hover,
.picker-dropzone.dragging {
    border-color: var(--main-color);
    background-color: color-mix(in srgb, var(--main-color) 10%, var(--c-surface));
}

.picker-buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.picker-drop-hint,
.picker-limits,
.picker-progress-text,
.picker-hint {
    font-size: 12px;
    color: var(--c-text-muted);
}

.picker-limits {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.picker-progress-file {
    display: flex;
    align-items: center;
    gap: 6px;
}

.picker-progress-icon {
    font-size: 18px;
}

.picker-progress-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.picker-progress-text {
    display: flex;
    align-items: center;
}

.picker-actions {
    display: flex;
    gap: 8px;
}

.picker-attached {
    margin-bottom: 8px;
}

.picker-disabled {
    display: flex;
    align-items: center;
    gap: 6px;
}
</style>
