<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, reactive, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import type ManageSubscriptionPlanResp from "../../../../src/models/response/admin/manageSubscriptionPlanResp";
import ApiAdmin from "../../../../src/api/ApiAdmin";
import { message, Modal } from "ant-design-vue";
import type CreateSubscription from "../../../../src/models/request/admin/createSubscription";
import type UpdateSubscription from "../../../models/request/admin/updateSubscription";
import type PlatformOverViewResp from "../../../models/response/admin/platformOverViewResp";
import { formatPlanDuration } from "@/services/PlanDurationService";
import { useAuthStore } from "@/stores/AuthStore";

const emit = defineEmits(["updateSidebar"]);

const { t } = useI18n();

const modal_create_subscription_open = ref(false);
const modal_update_subscription_open = ref(false);

onMounted(() => {
    const sidebarActiveItem = "subscription";
    emit("updateSidebar", sidebarActiveItem);
    getPlatformOverviewData();
    getAllPlanData();
});

const platform_ov = ref<PlatformOverViewResp>();
const plans = ref<ManageSubscriptionPlanResp[]>([]);

// chỉ Administrator được tạo/sửa/xoá/bật tắt gói (Moderator chỉ xem; backend cũng chặn)
const canManagePlan = !!useAuthStore().getUserInfo()?.roles?.includes("Administrator");

const createPlanFormRef = ref();
const updatePlanFormRef = ref();

const createPlanForm = reactive<CreateSubscription>({
    name: "",
    price: 0,
    duration: 0,
    unit: "",
    canLearn: false,
    canOpenTest: false,
    canCopyOrImportQuestionSet: false,
    canUploadImage: false,
    canUploadVideo: false,
    isActive: false,
});

const updatePlanForm = reactive<UpdateSubscription>({
    planId: "",
    name: "",
    price: 0,
    duration: 0,
    unit: "",
    canLearn: false,
    canOpenTest: false,
    canCopyOrImportQuestionSet: false,
    canUploadImage: false,
    canUploadVideo: false,
    isActive: true,
});

// modal rộng 50% trên desktop, gần full màn hình trên điện thoại
const windowWidth = ref(window.innerWidth);
const modalWidth = computed(() => (windowWidth.value <= 768 ? "94%" : "50%"));
const onResize = () => (windowWidth.value = window.innerWidth);
onMounted(() => window.addEventListener("resize", onResize));
onBeforeUnmount(() => window.removeEventListener("resize", onResize));

const isCreateLoading = ref(false);
const isUpdateLoading = ref(false);

// create new plan
const onCreatePlan = async () => {
    isCreateLoading.value = true;
    try {
        await createPlanFormRef.value.validate();
        const UpdateCreateForm = { ...createPlanForm };

        let result = await ApiAdmin.CreatePlan(UpdateCreateForm);
        if (result.data.success) {
            message.success(t("admin.manage_subscription.msg.create_success"));
            modal_create_subscription_open.value = false;
        }
        getAllPlanData();
    } catch (error: any) {
        // lỗi validate form (không có response) đã hiển thị inline: không báo thất bại
        if (error?.response) message.error(t("admin.manage_subscription.msg.create_fail"));
        console.log("error", error?.response?.data ?? error);
    } finally {
        isCreateLoading.value = false;
    }
};

// update plan
const onUpdatePlan = async () => {
    isUpdateLoading.value = true;
    try {
        await updatePlanFormRef.value.validate();
        const UpdatePlanForm = { ...updatePlanForm };
        let result = await ApiAdmin.UpdatePlan(UpdatePlanForm);

        if (result.data.success) {
            modal_update_subscription_open.value = false;
            message.success(t("admin.manage_subscription.msg.update_success"));
        }
        getAllPlanData();
    } catch (error: any) {
        if (error?.response) message.error(t("admin.manage_subscription.msg.update_fail"));
        console.log("error", error?.response?.data ?? error);
    } finally {
        isUpdateLoading.value = false;
    }
};

// validate fields
const rules = {
    name: [
        {
            required: true,
            message: t("admin.manage_subscription.msg.required"),
            trigger: "change",
        },
    ],
    // số nguyên: price >= 0, duration >= 1 (báo lỗi inline, không tự làm tròn)
    price: [
        {
            required: true,
            type: "number",
            message: t("admin.manage_subscription.msg.required"),
            trigger: "change",
        },
        {
            type: "integer",
            message: t("admin.manage_subscription.msg.price_integer"),
            trigger: "change",
        },
        {
            type: "number",
            min: 0,
            message: t("admin.manage_subscription.msg.price_min"),
            trigger: "change",
        },
    ],
    duration: [
        {
            required: true,
            type: "number",
            message: t("admin.manage_subscription.msg.required"),
            trigger: "change",
        },
        {
            type: "integer",
            message: t("admin.manage_subscription.msg.duration_integer"),
            trigger: "change",
        },
        {
            type: "number",
            min: 1,
            message: t("admin.manage_subscription.msg.duration_min"),
            trigger: "change",
        },
    ],
};

// reset form create
const resetCreatePlanForm = () => {
    createPlanForm.name = "";
    createPlanForm.price = 0;
    createPlanForm.duration = 0;
    createPlanForm.unit = unit_plan_credit_options.value[0].value;
    createPlanForm.canLearn = false;
    createPlanForm.canOpenTest = false;
    createPlanForm.canCopyOrImportQuestionSet = false;
    createPlanForm.canUploadImage = false;
    createPlanForm.canUploadVideo = false;
};
watch(modal_create_subscription_open, (val) => {
    if (val) {
        resetCreatePlanForm();
    }
});

const optionKeysUnitPlan = ["Day", "Month", "Year"];
const unit_plan_credit_options = computed(() =>
    optionKeysUnitPlan.map((key) => ({
        label: t(`admin.manage_subscription.plan_unit.${key}`),
        value: key,
    })),
);

function mapPlanToFeatures(plan: ManageSubscriptionPlanResp) {
    return [
        plan.canLearn && t(`admin.manage_subscription.plan_feature.canLearn`),
        plan.canOpenTest && t(`admin.manage_subscription.plan_feature.canOpenTest`),
        plan.canCopyOrImportQuestionSet &&
            t(`admin.manage_subscription.plan_feature.canCopyOrImportQuestionSet`),
        plan.canUploadImage && t(`admin.manage_subscription.plan_feature.canUploadImage`),
        plan.canUploadVideo && t(`admin.manage_subscription.plan_feature.canUploadVideo`),
    ].filter(Boolean) as string[];
}

// get plan data by id
const getPlanData = async (planId: string) => {
    try {
        let result = await ApiAdmin.GetPlan(planId);
        const data = result.data.data;
        if (result.data.success) {
            Object.assign(updatePlanForm, {
                planId: data.id,
                name: data.name,
                price: data.price,
                duration: data.duration,
                unit: data.unit,
                canLearn: data.canLearn,
                canOpenTest: data.canOpenTest,
                canCopyOrImportQuestionSet: data.canCopyOrImportQuestionSet,
                canUploadImage: data.canUploadImage ?? false,
                canUploadVideo: data.canUploadVideo ?? false,
                isActive: data.isActive,
            });
        }
    } catch (err) {
        console.log(err);
    }
};
const formatCurrency = (num?: number) => {
    return Number(num).toLocaleString("en-US");
};

//platform overview
const getPlatformOverviewData = async () => {
    try {
        let result = await ApiAdmin.PlatformOverview();
        platform_ov.value = result.data.data;
    } catch (err) {
        console.log(err);
    }
};

// get all plan data
const getAllPlanData = async () => {
    try {
        let result = await ApiAdmin.GetAllPlan();
        plans.value = result.data.data;
        // console.log("All plan: ", plans.value);
    } catch (err) {
        console.log(err);
    }
};

// activate/unactivate plan
const updateActivePlan = async (plan: ManageSubscriptionPlanResp) => {
    try {
        Object.assign(updatePlanForm, {
            planId: plan.id,
            name: plan.name,
            price: plan.price,
            duration: plan.duration,
            unit: plan.unit,
            canLearn: plan.canLearn,
            canOpenTest: plan.canOpenTest,
            canCopyOrImportQuestionSet: plan.canCopyOrImportQuestionSet,
            canUploadImage: plan.canUploadImage ?? false,
            canUploadVideo: plan.canUploadVideo ?? false,
            isActive: plan.isActive,
        });
        let result = await ApiAdmin.UpdatePlan({ ...updatePlanForm });

        if (result.data.success) {
            modal_update_subscription_open.value = false;
            message.success("Update plan activity status successfully");
        }
        getAllPlanData();
    } catch (error: any) {
        if (error?.response) message.error(t("admin.manage_subscription.msg.update_fail"));
        console.log("error", error?.response?.data ?? error);
    } finally {
        isUpdateLoading.value = false;
    }
};

async function onTogglePlan(plan: ManageSubscriptionPlanResp) {
    Modal.confirm({
        title: "Confirm Active Subscription",
        content: "Are you sure you want to update this subscription activation status?",
        centered: true,
        onOk: async () => {
            await updateActivePlan(plan);
        },
        onCancel: () => {
            getAllPlanData();
        },
    });
}

// edit subscription
function onEditPlan(plan: ManageSubscriptionPlanResp) {
    modal_update_subscription_open.value = true;
    // console.log("PlanId edit: ", plan.id);
    getPlanData(plan.id);
}

// delete subscription
const deletePlan = async (planId: string) => {
    try {
        let result = await ApiAdmin.DeletePlan(planId);
        message.success("Delete successfully.");
        getAllPlanData();
    } catch (err) {
        message.error("Delete fail.");
        console.log(err);
    }
};
const onDeletePlan = (plan: ManageSubscriptionPlanResp) => {
    Modal.confirm({
        title: "Confirm Delete Subscription",
        content: "Are you sure you want to delete this subscription?",
        centered: true,
        onOk: () => {
            // console.log("PlanId to delete:", plan.id);
            deletePlan(plan.id);
        },
        onCancel: () => {},
    });
};
</script>
<template>
    <div class="page-container">
        <!-- header title -->
        <div class="title-container">
            <div class="main-title">
                <span>{{ t(`admin.manage_subscription.title`) }}</span>
            </div>

            <div v-if="canManagePlan" class="title-button-container">
                <a-button
                    type="primary"
                    class="main-color-btn"
                    style="gap: 5px"
                    size="large"
                    @click="modal_create_subscription_open = true"
                >
                    <i class="bx bx-plus"></i>
                    {{ $t("admin.manage_subscription.create_new_sub") }}
                </a-button>
            </div>
        </div>

        <div class="content">
            <!-- statistic -->
            <div class="stat-content">
                <div class="stat-card">
                    <div class="stat-title">
                        <span> {{ t(`admin.manage_subscription.stat_card.total_subs`) }} </span>
                        <span> {{ platform_ov?.users }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">
                        <span> {{ t(`admin.manage_subscription.stat_card.monthly_rev`) }} </span>
                        <span> {{ formatCurrency(platform_ov?.revenue) }} VND</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">
                        <span> {{ t(`admin.manage_subscription.stat_card.new_subs`) }} </span>
                        <span> {{ platform_ov?.usersHavePlan }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">
                        <span> {{ t(`admin.manage_subscription.stat_card.class`) }} </span>
                        <span> {{ platform_ov?.classes }}</span>
                    </div>
                </div>
            </div>

            <!-- plan comparison -->
            <div class="plan-comparison">
                <div class="content-item">
                    <!-- title plan comparison -->
                    <div class="title-container">
                        <a-row class="w-100 d-block">
                            <a-col class="main-title" :span="20">
                                <span>{{ t(`admin.manage_subscription.plan_comparison`) }}</span>
                            </a-col>
                            <span>{{
                                t(`admin.manage_subscription.plan_comparison_content`)
                            }}</span>
                        </a-row>
                    </div>

                    <!-- list plan -->
                    <div class="plan-comparison-row">
                        <div v-for="plan in plans" :key="plan.id" class="plan-compa-content-item">
                            <div
                                :class="{ invisible: !canManagePlan }"
                                class="plan-comparison-card-action"
                            >
                                <a-tooltip>
                                    <template #title> Edit Plan </template>
                                    <i class="bx bx-edit plan-action" @click="onEditPlan(plan)"></i>
                                </a-tooltip>
                                <!-- gói miễn phí (giá 0) cho phép sửa (vd. quyền upload ảnh/video) nhưng không cho xoá -->
                                <a-tooltip v-if="plan.price !== 0">
                                    <template #title> Delete Plan </template>
                                    <i
                                        class="bx bx-trash plan-action plan-action-delete"
                                        @click="onDeletePlan(plan)"
                                    ></i>
                                </a-tooltip>
                            </div>
                            <h5 class="mb-2">{{ plan.name }}</h5>
                            <div class="plan-price-line fw-bold mb-3">
                                <span class="plan-price-amount"
                                    >{{ formatCurrency(plan.price)
                                    }}<span class="vnd-icon">VND</span></span
                                >
                                <span class="fs-6 fw-normal plan-duration-label">
                                    /
                                    {{ formatPlanDuration(Number(plan.duration), plan.unit) }}</span
                                >
                            </div>
                            <ul class="mb-0">
                                <li v-for="f in mapPlanToFeatures(plan)" :key="f">{{ f }}</li>
                            </ul>
                            <div
                                :class="{ invisible: plan.price === 0 || !canManagePlan }"
                                class="d-flex justify-content-end mt-auto pt-1"
                            >
                                <a-tooltip>
                                    <template #title> Active/Inactive </template>
                                    <a-switch
                                        v-model:checked="plan.isActive"
                                        :checked-children="''"
                                        :un-checked-children="''"
                                        @change="onTogglePlan(plan)"
                                    />
                                </a-tooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- popup create subscription -->
    <a-modal
        centered
        :width="modalWidth"
        wrap-class-name="large-modal"
        :closable="false"
        :open="modal_create_subscription_open"
        @cancel="modal_create_subscription_open = false"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="4">
                        <RouterLink
                            @click="modal_create_subscription_open = false"
                            :to="{ name: '' }"
                        >
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="20">
                        <span>{{ t("admin.manage_subscription.modal.title_create") }}</span>
                    </a-col>
                </a-row>
            </div>
            <div class="content">
                <div class="modal-content-subs-item">
                    <a-form
                        layout="vertical"
                        ref="createPlanFormRef"
                        :model="createPlanForm"
                        :rules="rules"
                    >
                        <a-form-item
                            :label="t('admin.manage_subscription.create_plan.name')"
                            name="name"
                        >
                            <a-input
                                v-model:value="createPlanForm.name"
                                :placeholder="t('admin.manage_subscription.create_plan.name')"
                                class="update_input_name"
                                :maxlength="200"
                            />
                        </a-form-item>

                        <a-row class="row-3-input">
                            <a-col :span="8">
                                <a-form-item
                                    :label="t('admin.manage_subscription.create_plan.price')"
                                    name="price"
                                    class="form-item-third"
                                >
                                    <a-input-number
                                        v-model:value="createPlanForm.price"
                                        :placeholder="
                                            t('admin.manage_subscription.create_plan.price')
                                        "
                                        style="width: 100%"
                                        class="my-price-input"
                                    />
                                </a-form-item>
                            </a-col>

                            <a-col :span="8">
                                <a-form-item
                                    :label="t('admin.manage_subscription.create_plan.duration')"
                                    class="form-item-third"
                                    name="duration"
                                >
                                    <a-input-number
                                        v-model:value="createPlanForm.duration"
                                        :placeholder="
                                            t('admin.manage_subscription.create_plan.duration')
                                        "
                                        style="width: 100%"
                                        class="my-price-input"
                                    />
                                </a-form-item>
                            </a-col>

                            <a-col :span="6">
                                <a-form-item
                                    :label="t('admin.manage_subscription.create_plan.unit')"
                                    class="form-item-third"
                                >
                                    <a-select v-model:value="createPlanForm.unit">
                                        <a-select-option
                                            v-for="option in unit_plan_credit_options"
                                            :key="option.value"
                                            :value="option.value"
                                        >
                                            {{ option.label }}
                                        </a-select-option>
                                    </a-select>
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-form-item
                            :label="t('admin.manage_subscription.create_plan.feature')"
                            style="margin-top: 28px"
                        >
                            <div class="feature-switch-row">
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canLearn")
                                    }}</span>
                                    <a-switch v-model:checked="createPlanForm.canLearn" />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canOpenTest")
                                    }}</span>
                                    <a-switch v-model:checked="createPlanForm.canOpenTest" />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t(
                                            "admin.manage_subscription.plan_feature.canCopyOrImportQuestionSet",
                                        )
                                    }}</span>
                                    <a-switch
                                        v-model:checked="createPlanForm.canCopyOrImportQuestionSet"
                                    />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canUploadImage")
                                    }}</span>
                                    <a-switch v-model:checked="createPlanForm.canUploadImage" />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canUploadVideo")
                                    }}</span>
                                    <a-switch v-model:checked="createPlanForm.canUploadVideo" />
                                </div>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>
            </div>
        </div>

        <template #footer>
            <a-button
                :loading="isCreateLoading"
                class="main-color-btn"
                key="submit"
                type="primary"
                @click="onCreatePlan"
            >
                {{ t("admin.manage_subscription.btn.create") }}
            </a-button>
        </template>
    </a-modal>

    <!-- popup update subscription -->
    <a-modal
        centered
        :width="modalWidth"
        wrap-class-name="large-modal"
        :closable="false"
        :open="modal_update_subscription_open"
        @cancel="modal_update_subscription_open = false"
    >
        <div class="modal-container">
            <div class="modal-title-container">
                <a-row class="w-100 d-flex align-items-center">
                    <a-col :span="4">
                        <RouterLink
                            @click="modal_create_subscription_open = false"
                            :to="{ name: '' }"
                        >
                            <i class="bx bx-chevron-left navigator-back-button"></i>
                        </RouterLink>
                    </a-col>
                    <a-col class="main-title" :span="20">
                        <span>{{ t("admin.manage_subscription.modal.title_update") }}</span>
                    </a-col>
                </a-row>
            </div>
            <div class="content">
                <div class="modal-content-subs-item">
                    <a-form
                        layout="vertical"
                        ref="updatePlanFormRef"
                        :model="updatePlanForm"
                        :rules="rules"
                    >
                        <a-form-item
                            :label="t('admin.manage_subscription.create_plan.name')"
                            name="name"
                        >
                            <a-input
                                v-model:value="updatePlanForm.name"
                                class="update_input_name"
                                :maxlength="200"
                            />
                        </a-form-item>

                        <a-row class="row-3-input">
                            <a-col :span="7">
                                <a-form-item
                                    :label="t('admin.manage_subscription.create_plan.price')"
                                    name="price"
                                    class="form-item-third"
                                >
                                    <a-input-number
                                        v-model:value="updatePlanForm.price"
                                        :placeholder="
                                            t('admin.manage_subscription.create_plan.price')
                                        "
                                        style="width: 100%"
                                        class="my-price-input"
                                    />
                                </a-form-item>
                            </a-col>

                            <a-col :span="7">
                                <a-form-item
                                    :label="t('admin.manage_subscription.create_plan.duration')"
                                    class="form-item-third"
                                    name="duration"
                                >
                                    <a-input-number
                                        v-model:value="updatePlanForm.duration"
                                        :placeholder="
                                            t('admin.manage_subscription.create_plan.duration')
                                        "
                                        style="width: 100%"
                                        class="my-price-input"
                                    />
                                </a-form-item>
                            </a-col>

                            <a-col :span="7">
                                <a-form-item
                                    :label="t('admin.manage_subscription.create_plan.unit')"
                                    class="form-item-third"
                                >
                                    <a-select v-model:value="updatePlanForm.unit">
                                        <a-select-option
                                            v-for="option in unit_plan_credit_options"
                                            :key="option.value"
                                            :value="option.value"
                                        >
                                            {{ option.label }}
                                        </a-select-option>
                                    </a-select>
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-form-item
                            :label="t('admin.manage_subscription.create_plan.feature')"
                            style="margin-top: 28px"
                        >
                            <div class="feature-switch-row">
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canLearn")
                                    }}</span>
                                    <a-switch v-model:checked="updatePlanForm.canLearn" />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canOpenTest")
                                    }}</span>
                                    <a-switch v-model:checked="updatePlanForm.canOpenTest" />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t(
                                            "admin.manage_subscription.plan_feature.canCopyOrImportQuestionSet",
                                        )
                                    }}</span>
                                    <a-switch
                                        v-model:checked="updatePlanForm.canCopyOrImportQuestionSet"
                                    />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canUploadImage")
                                    }}</span>
                                    <a-switch v-model:checked="updatePlanForm.canUploadImage" />
                                </div>
                                <div class="feature-switch-item">
                                    <span>{{
                                        t("admin.manage_subscription.plan_feature.canUploadVideo")
                                    }}</span>
                                    <a-switch v-model:checked="updatePlanForm.canUploadVideo" />
                                </div>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>
            </div>
        </div>

        <template #footer>
            <a-button
                :loading="isUpdateLoading"
                class="main-color-btn"
                key="submit"
                type="primary"
                @click="onUpdatePlan"
            >
                {{ t("admin.manage_subscription.btn.save") }}
            </a-button>
        </template>
    </a-modal>
</template>

<style scoped>
.modal-content-subs-item {
    width: 100%;
    padding: 20px;
    margin-bottom: 0px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    color: var(--text-color);
    border-radius: var(--ui-r-xl);
    overflow-y: hidden;
    z-index: 2;
}
.row-3-input {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
}

.form-item-third {
    flex: 1 1 0;
    margin-bottom: 0 !important;
}

::v-deep(.my-price-input .ant-input-number-input::placeholder) {
    color: var(--text-color-grey) !important;
}
.stat-content {
    width: calc(100% - 40px);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    padding: 10px;
}

.stat-card {
    min-width: 0;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}
.stat-title {
    padding: 20px;
}

.stat-title > span:nth-child(1) {
    color: var(--c-text-muted);
    font-size: 14px;
    font-weight: 500;
}
.stat-title > span:nth-child(2) {
    margin-top: 4px;
    color: var(--text-color);
    font-size: 24px;
    font-weight: 700;
}
.stat-title span {
    display: block;
}

.plan-comparison-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
    padding: 8px;
}

.plan-compa-content-item {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
    padding: 20px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    color: var(--text-color);
    border-radius: var(--ui-r-xl);
    overflow-y: hidden;
    z-index: 2;
    transition: border-color 0.15s ease;
}
.plan-compa-content-item:hover {
    border-color: var(--main-color);
}

.plan-comparison-card-action {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
}

/* nút icon vuông 32px, không viền; hover nền nhạt */
.plan-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    font-size: 20px;
    color: var(--c-text-muted);
    border-radius: var(--ui-r-sm);
    cursor: pointer;
    transition:
        background-color 0.15s ease,
        color 0.15s ease;
}
.plan-action:hover {
    background-color: var(--c-surface-subtle);
    color: var(--c-primary-text);
}
.plan-action-delete {
    color: var(--c-danger-text);
}
.plan-action-delete:hover {
    background-color: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
    color: var(--c-danger-text);
}

.plan-price-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    min-width: 0;
}
.plan-price-amount {
    font-size: clamp(1.5rem, 2.4vw, 2rem);
    line-height: 1.2;
    overflow-wrap: anywhere;
}
.plan-duration-label {
    color: var(--c-text-muted);
    overflow-wrap: anywhere;
}

.vnd-icon {
    font-weight: bold;
    color: var(--c-primary-text);
    margin-left: 2px;
}

.feature-switch-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.feature-switch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background-color: var(--c-surface-subtle);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-md);
}

.feature-switch-item span {
    color: var(--c-text);
    font-size: 15px;
    font-weight: 500;
}

.update_input_name {
    height: 40px;
    padding: 4px 11px;
    width: 100%;
    background-color: var(--c-surface-raised);
    border: 1px solid var(--c-border-strong);
    color: var(--c-text);
}

@media (max-width: 768px) {
    .stat-content {
        width: 100%;
        padding: 10px 0;
    }
    .stat-content {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100% !important;
    }
    .stat-card {
        width: 100% !important;
    }
    .row-3-input {
        flex-direction: column;
        gap: 12px;
    }
    .row-3-input :deep(.ant-col) {
        max-width: 100%;
        flex: 0 0 100%;
    }
    .modal-content-subs-item {
        padding: 12px;
    }
}
</style>
