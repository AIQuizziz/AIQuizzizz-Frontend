<script setup lang="ts">
import ApiUser from "@/api/ApiUser";
import { computed, onMounted, reactive, ref } from "vue";
import { useAuthStore } from "@/stores/AuthStore";
import { prepareAvatarFile } from "@/services/AvatarService";

import Input from "@/shared/components/Common/Input.vue";
import UserAvatar from "@/shared/components/Common/UserAvatar.vue";
import { useI18n } from "vue-i18n";
import { message, Modal } from "ant-design-vue";
const { t } = useI18n();

const authStore = useAuthStore();

const user = ref(authStore.getUserInfo());

const formState = reactive({
    fullName: "",
    email: "",
});

const formRef = ref();

const rules = {
    fullName: [
        {
            required: true,
            whitespace: true,
            message: t("message.required"),
            trigger: "change",
        },
        {
            max: 250,
            message: t("message.out_of_range", { max_length: 250 }),
            trigger: "change",
        },
    ],
};

const onFinish = () => {
    formRef.value
        .validate()
        .then(async () => {
            const result = await ApiUser.UpdateProfile({
                fullName: formState.fullName,
            });

            if (result.data.success) {
                message.success(t("message.updated_successfully"));
                user.value = await authStore.refreshUserInfo();
                formState.fullName = user.value?.fullName ?? formState.fullName;
            }
        })
        .catch((error: any) => {
            console.log(error);
        });
};

//#region ảnh đại diện
const avatarId = computed(() => user.value?.avatarId ?? null);
const avatarInputRef = ref<HTMLInputElement>();
const avatarUploading = ref(false);
const avatarDeleting = ref(false);
const avatarDragging = ref(false);
const avatarBusy = computed(() => avatarUploading.value || avatarDeleting.value);

const onPickAvatar = () => {
    if (!avatarBusy.value) avatarInputRef.value?.click();
};

const onAvatarSelected = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // chọn lại cùng file vẫn kích hoạt change
    if (file) uploadAvatar(file);
};

// kéo thả ảnh vào khung ảnh đại diện
const onAvatarDrop = (event: DragEvent) => {
    avatarDragging.value = false;
    const file = event.dataTransfer?.files?.[0];
    if (file && !avatarBusy.value) uploadAvatar(file);
};

const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
        message.error(t("settings.profile.avatar.not_image"));
        return;
    }

    avatarUploading.value = true;
    try {
        // cắt vuông + thu nhỏ ở trình duyệt; server chuẩn hoá và kiểm duyệt ngay trong request
        const prepared = await prepareAvatarFile(file);
        const result = await ApiUser.UploadAvatar(prepared);
        if (result.data.success) {
            user.value = await authStore.refreshUserInfo();
            message.success(t("settings.profile.avatar.updated"));
        }
    } catch (error) {
        // lỗi (vi phạm, quá dung lượng, ...) đã được interceptor hiển thị
        console.log(error);
    } finally {
        avatarUploading.value = false;
    }
};

const onDeleteAvatar = () => {
    Modal.confirm({
        title: t("settings.profile.avatar.delete_confirm"),
        okText: t("settings.profile.avatar.delete"),
        cancelText: t("settings.profile.avatar.cancel"),
        okButtonProps: { danger: true },
        onOk: async () => {
            avatarDeleting.value = true;
            try {
                const result = await ApiUser.DeleteAvatar();
                if (result.data.success) {
                    user.value = await authStore.refreshUserInfo();
                    message.success(t("settings.profile.avatar.deleted"));
                }
            } finally {
                avatarDeleting.value = false;
            }
        },
    });
};
//#endregion

onMounted(() => {
    if (user.value) {
        formState.fullName = user.value.fullName || "";
        formState.email = user.value.email || "";
    }
});
</script>
<template>
    <div class="content">
        <div class="content-item">
            <div class="content-item-title">
                <div>
                    <span>{{ $t("settings.profile.title") }}</span>
                    <span>{{ $t("settings.profile.sub_title") }}</span>
                </div>
            </div>
            <a-form ref="formRef" :model="formState" :rules="rules" class="mt-5" layout="vertical">
                <a-row>
                    <a-col :span="4" class="user-image-container">
                        <div
                            :class="['avatar-editor', avatarDragging ? 'is-dragging' : '']"
                            @dragover.prevent="avatarDragging = true"
                            @dragleave="avatarDragging = false"
                            @drop.prevent="onAvatarDrop"
                        >
                            <!-- bấm thẳng vào ảnh để chọn ảnh mới; huy hiệu máy ảnh ở góc -->
                            <button
                                type="button"
                                class="avatar-trigger"
                                :disabled="avatarBusy"
                                :aria-label="$t('settings.profile.avatar.change')"
                                @click="onPickAvatar"
                            >
                                <UserAvatar :avatar-id="avatarId" :size="112" :alt="formState.fullName" />
                                <span v-if="avatarUploading" class="avatar-overlay is-busy" aria-live="polite">
                                    <a-spin size="small" />
                                    <span>{{ $t("settings.profile.avatar.checking") }}</span>
                                </span>
                                <span v-else class="avatar-overlay">
                                    <i class="bx bx-camera"></i>
                                    <span>{{
                                        avatarDragging
                                            ? $t("settings.profile.avatar.drop")
                                            : $t("settings.profile.avatar.change")
                                    }}</span>
                                </span>
                                <span class="avatar-badge" aria-hidden="true">
                                    <i class="bx bxs-camera"></i>
                                </span>
                            </button>
                        </div>
                        <input
                            ref="avatarInputRef"
                            type="file"
                            accept="image/*"
                            class="d-none"
                            @change="onAvatarSelected"
                        />
                        <div class="avatar-actions">
                            <button
                                type="button"
                                class="avatar-btn avatar-btn-primary"
                                :disabled="avatarBusy"
                                @click="onPickAvatar"
                            >
                                <i class="bx bx-upload"></i>
                                {{
                                    avatarId
                                        ? $t("settings.profile.avatar.change")
                                        : $t("settings.profile.avatar.upload")
                                }}
                            </button>
                            <button
                                v-if="avatarId"
                                type="button"
                                class="avatar-btn avatar-btn-danger"
                                :disabled="avatarBusy"
                                @click="onDeleteAvatar"
                            >
                                <i class="bx bx-trash"></i>
                                {{ $t("settings.profile.avatar.delete_short") }}
                            </button>
                        </div>
                    </a-col>
                    <a-col :span="20" class="user-info-container">
                        <a-row>
                            <a-col :span="10">
                                <Input
                                    :label="t('settings.profile.fullname_label')"
                                    :placeholder="t('settings.profile.fullname_placeholder')"
                                    name="fullName"
                                    :max-length="250"
                                    v-model="formState.fullName"
                                />
                            </a-col>
                            <a-col :span="10" :offset="4">
                                <Input
                                    :disable="true"
                                    :readonly="true"
                                    :label="t('settings.profile.email_label')"
                                    :placeholder="t('settings.profile.email_placeholder')"
                                    v-model="formState.email"
                                />
                            </a-col>
                        </a-row>
                        <a-row>
                            <a-col class="mt-4 mb-2 d-flex justify-content-end" :span="24">
                                <a-button
                                    @click="onFinish"
                                    class="main-color-btn"
                                    type="primary"
                                    size="large"
                                >
                                    {{ $t("settings.profile.save_change") }}
                                </a-button>
                            </a-col>
                        </a-row>
                    </a-col>
                </a-row>
            </a-form>
        </div>
    </div>
</template>
<style scoped>
.user-image-container {
    display: flex;
    align-items: center;
    flex-direction: column;
}

/* ---- ảnh đại diện ---- */
.avatar-editor {
    position: relative;
    margin: 4px 0 14px;
    padding: 4px;
    border-radius: 50%;
    border: 2px dashed transparent;
    transition: border-color 0.15s ease;
}

.avatar-editor.is-dragging {
    border-color: var(--main-color);
}

.avatar-trigger {
    position: relative;
    display: block;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    cursor: pointer;
}

.avatar-trigger:disabled {
    cursor: progress;
}

.avatar-trigger:focus-visible {
    outline: 3px solid var(--c-focus-ring);
    outline-offset: 3px;
}

/* viền màu chủ đạo quanh ảnh */
.avatar-trigger :deep(.user-avatar) {
    box-shadow:
        0 0 0 3px var(--c-surface),
        0 0 0 5px var(--main-color);
}

.avatar-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.avatar-overlay i {
    font-size: 22px;
}

.avatar-trigger:hover .avatar-overlay,
.avatar-trigger:focus-visible .avatar-overlay,
.avatar-editor.is-dragging .avatar-overlay,
.avatar-overlay.is-busy {
    opacity: 1;
}

.avatar-overlay.is-busy :deep(.ant-spin-dot-item) {
    background-color: #fff;
}

.avatar-badge {
    position: absolute;
    right: 2px;
    bottom: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--main-color);
    color: var(--c-on-primary);
    border: 3px solid var(--c-surface);
    font-size: 16px;
    transition: transform 0.15s ease;
}

.avatar-trigger:hover .avatar-badge {
    transform: scale(1.08);
}

.avatar-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
}

/* nút phụ: chữ + icon, không viền */
.avatar-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-radius: var(--ui-r-sm);
    border: none;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition:
        background-color 0.15s ease,
        color 0.15s ease;
}

.avatar-btn i {
    font-size: 16px;
}

.avatar-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.avatar-btn:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
}

.avatar-btn-primary {
    color: var(--c-primary-text);
}

.avatar-btn-primary:not(:disabled):hover {
    background: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
}

.avatar-btn-danger {
    color: var(--c-danger-text);
}

.avatar-btn-danger:not(:disabled):hover {
    background: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
}
</style>
