<script setup lang="ts">
import ApiAdmin from "@/api/ApiAdmin";
import type SystemSettingsResp from "@/models/response/admin/systemSettingResp";
import { message } from "ant-design-vue";
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/AuthStore";

const emit = defineEmits(["updateSidebar"]);
const { t } = useI18n();

const isUpdateLoading = ref(false);
// chỉ Administrator được sửa cài đặt hệ thống (Moderator chỉ xem)
const canEdit = !!useAuthStore().getUserInfo()?.roles?.includes("Administrator");
const updateSystemSettingFormRef = ref();

onMounted(() => {
    const sidebarActiveItem = "system_settings";
    emit("updateSidebar", sidebarActiveItem);
    getSystemSettingsData();
});

const system_settings = reactive<SystemSettingsResp>({
    id: "",
    inputCostPerMillionTokens: 0,
    outputCostPerMillionTokens: 0,
    fixedSystemFee: 0,
    maxInputToken: 0,
    maxOutputToken: 0,
});

// số nguyên trong khoảng [min, max]; trigger "change" nên "-5", "0", "1.5"... báo lỗi ngay và không cho lưu
const integerRules = (min: number, max: number) => [
    {
        required: true,
        type: "number",
        message: t("admin.system_settings.err.required"),
        trigger: "change",
    },
    {
        type: "integer",
        message: t("admin.system_settings.err.integer"),
        trigger: "change",
    },
    {
        type: "integer",
        min,
        message: t("admin.system_settings.err.min", { min: min.toLocaleString("en-US") }),
        trigger: "change",
    },
    {
        type: "integer",
        max,
        message: t("admin.system_settings.err.max", { max: max.toLocaleString("en-US") }),
        trigger: "change",
    },
];

const rules = {
    inputCostPerMillionTokens: integerRules(1, 1000000000),
    outputCostPerMillionTokens: integerRules(1, 1000000000),
    fixedSystemFee: integerRules(0, 1000000000),
    maxInputToken: integerRules(1, 1048575),
    maxOutputToken: integerRules(1, 65535),
};

const onUpdate = async () => {
    try {
        await updateSystemSettingFormRef.value.validate();
    } catch (error) {
        return; // lỗi validate đã hiển thị inline trên form, không gọi API
    }

    try {
        isUpdateLoading.value = true;
        const plainData = { ...system_settings };
        const { id, ...dataWithoutId } = plainData;

        let result = await ApiAdmin.SystemSettingsUpdate(dataWithoutId);
        if (result.data.success) {
            message.success(t("admin.system_settings.update_success"));
        }
        getSystemSettingsData();
    } catch (error: any) {
        // chỉ báo thất bại khi API trả lỗi (interceptor đã hiển thị chi tiết)
        if (error?.response) message.error(t("admin.system_settings.update_fail"));
        console.log("error", error?.response?.data);
    } finally {
        isUpdateLoading.value = false;
    }
};

const getSystemSettingsData = async () => {
    try {
        let result = await ApiAdmin.SystemSettings();
        const data = result.data.data as SystemSettingsResp;
        if (result.data.success) {
            Object.assign(system_settings, {
                id: data.id,
                inputCostPerMillionTokens: data.inputCostPerMillionTokens,
                outputCostPerMillionTokens: data.outputCostPerMillionTokens,
                fixedSystemFee: data.fixedSystemFee,
                maxInputToken: data.maxInputToken,
                maxOutputToken: data.maxOutputToken,
            });
        }
    } catch (err) {
        console.log(err);
    }
};
</script>

<template>
    <div class="page-container">
        <!-- header title -->
        <div class="title-container">
            <div class="main-title">
                <span>{{ t("admin.system_settings.title") }}</span>
            </div>
        </div>

        <div class="content">
            <div class="content-item">
                <a-form
                    layout="vertical"
                    ref="updateSystemSettingFormRef"
                    :model="system_settings"
                    :rules="rules"
                >
                    <a-row class="w-100 d-flex justify-content-between">
                        <a-col :span="11">
                            <a-form-item
                                :label="t('admin.system_settings.input_cost')"
                                name="inputCostPerMillionTokens"
                            >
                                <a-input-number
                                    v-model:value="system_settings.inputCostPerMillionTokens"
                                    class="update_input_name"
                                    :disabled="!canEdit"
                                />
                            </a-form-item>
                        </a-col>
                        <a-col :span="11">
                            <a-form-item
                                :label="t('admin.system_settings.output_cost')"
                                name="outputCostPerMillionTokens"
                            >
                                <a-input-number
                                    v-model:value="system_settings.outputCostPerMillionTokens"
                                    class="update_input_name"
                                    :disabled="!canEdit"
                                />
                            </a-form-item>
                        </a-col>
                    </a-row>
                    <a-row class="w-100 d-flex justify-content-between">
                        <a-col :span="11">
                            <a-form-item
                                :label="t('admin.system_settings.max_input_token')"
                                name="maxInputToken"
                            >
                                <a-input-number
                                    v-model:value="system_settings.maxInputToken"
                                    class="update_input_name"
                                    :disabled="!canEdit"
                                />
                            </a-form-item>
                        </a-col>
                        <a-col :span="11">
                            <a-form-item
                                :label="t('admin.system_settings.max_output_token')"
                                name="maxOutputToken"
                            >
                                <a-input-number
                                    v-model:value="system_settings.maxOutputToken"
                                    class="update_input_name"
                                    :disabled="!canEdit"
                                />
                            </a-form-item>
                        </a-col>
                    </a-row>
                    <a-row class="w-100 d-flex justify-content-between">
                        <a-col :span="11">
                            <a-form-item
                                :label="t('admin.system_settings.fixed_fee')"
                                name="fixedSystemFee"
                            >
                                <a-input-number
                                    v-model:value="system_settings.fixedSystemFee"
                                    class="update_input_name"
                                    :disabled="!canEdit"
                                />
                            </a-form-item>
                        </a-col>
                    </a-row>
                    <div v-if="!canEdit" class="read-only-note mb-2">
                        {{ t("admin.system_settings.read_only") }}
                    </div>
                    <div class="w-100 d-flex justify-content-end">
                        <a-button
                            :loading="isUpdateLoading"
                            :disabled="!canEdit"
                            class="main-color-btn"
                            key="submit"
                            type="primary"
                            @click="onUpdate"
                        >
                            {{ t("admin.manage_subscription.btn.save") }}
                        </a-button>
                    </div>
                </a-form>
            </div>
        </div>
    </div>
</template>

<style scoped>
.content-item {
    padding: 20px;
}

.update_input_name {
    width: 100%;
    align-items: center;
}

.read-only-note {
    color: var(--c-text-muted);
    font-size: 14px;
}
</style>
