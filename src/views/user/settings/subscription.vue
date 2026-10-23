<script setup lang="ts">
import ApiPlan from "@/api/ApiPlan";
import type Plan from "@/models/response/plan/plan";
import type CurrentPlan from "@/models/response/plan/currentPlan";
import { formatPlanDuration } from "@/services/PlanDurationService";
import { message, Modal } from "ant-design-vue";
import dayjs from "dayjs";

import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

const planData = ref<Plan[]>([]);
const currentPlan = ref<CurrentPlan | null>(null);

const loading = ref(false);
const getData = async () => {
    try {
        loading.value = true;

        const result = await ApiPlan.GetAll();
        if (result.data.success) {
            planData.value = result.data.data;
        }
    } catch (error) {
        console.log(error);
    } finally {
        loading.value = false;
    }
};

// gói đang dùng: đăng ký còn hạn gần nhất (backend trả danh sách, đã sắp xếp theo ngày hết hạn giảm dần)
const getCurrentPlan = async () => {
    try {
        const result = await ApiPlan.CurrentPlan();
        if (result.data.success) {
            const list: CurrentPlan[] = result.data.data ?? [];
            currentPlan.value = list.length > 0 ? list[0] : null;
        }
    } catch (error) {
        console.log(error);
    }
};

// Chỉ coi là "gói hiện tại" khi người dùng có gói còn hạn (kể cả gói giá 0 đã đăng ký).
// Chưa có gói nào thì KHÔNG gán gói miễn phí: quyền upload/copy... chỉ có khi đã đăng ký gói.
const currentPlanId = computed(() => currentPlan.value?.planId ?? "");

// gói "Popular": gói có giá cao nhất trong các gói trả phí (chỉ hiển thị khi có từ 2 gói trả phí trở lên)
const popularPlanId = computed(() => {
    const paid = planData.value.filter((x) => x.isActive && x.price > 0);
    if (paid.length < 2) return "";
    return paid.reduce((max, x) => (x.price > max.price ? x : max)).id;
});

// danh sách tính năng của gói (hiển thị dấu tick / dấu x)
const featuresOf = (plan: Plan) => [
    { key: "learn", enabled: plan.canLearn },
    { key: "test", enabled: plan.canOpenTest },
    { key: "copy_import", enabled: plan.canCopyOrImportQuestionSet },
    { key: "upload_image", enabled: plan.canUploadImage },
    { key: "upload_video", enabled: plan.canUploadVideo },
];

const formatCurrency = (num?: number) => {
    return Number(num).toLocaleString("en-US");
};

// Gói hiển thị ở thẻ đầu trang: gói còn hạn, hoặc "chưa có gói"
const currentPlanName = computed(() => {
    const found = planData.value.find((x) => x.id === currentPlanId.value);
    return found?.name ?? t("settings.subscription.current.free_plan");
});
const currentPlanDuration = computed(() =>
    currentPlan.value && currentPlan.value.duration > 0 && currentPlan.value.unit
        ? formatPlanDuration(currentPlan.value.duration, currentPlan.value.unit)
        : "",
);

const formatDate = (value?: string) => (value ? dayjs(value).format("DD/MM/YYYY") : "");

const onBuyPlan = (plan: Plan) => {
    Modal.confirm({
        title: t("settings.subscription.confirm.title"),
        content: t("settings.subscription.confirm.content", { price: formatCurrency(plan.price) }),
        okText: t("sidebar.buttons.ok"),
        cancelText: t("sidebar.buttons.cancel"),
        centered: true,
        onOk: async () => {
            try {
                const result = await ApiPlan.BuyPlan(plan.id);
                if (result.data.success) {
                    message.success(t("message.purchased_successfully"));
                    await getCurrentPlan();
                }
            } catch (error) {
                // lỗi API (vd: không đủ số dư) đã được interceptor hiển thị; đóng modal xác nhận
                console.log(error);
            }
        },
    });
};

onMounted(async () => {
    await Promise.all([getData(), getCurrentPlan()]);
});
</script>

<template>
    <div class="content">
        <div class="content-item">
            <div class="content-item-title">
                <div>
                    <span>{{ $t("settings.subscription.title") }}</span>
                    <span>{{ $t("settings.subscription.sub_title") }}</span>
                </div>
            </div>
            <div v-if="!loading" class="current-plan-summary" data-testid="current-plan-summary">
                <span class="current-plan-label">{{ $t("settings.subscription.current.label") }}:</span>
                <b class="current-plan-name">{{ currentPlanName }}</b>
                <template v-if="currentPlan">
                    <span v-if="currentPlanDuration" class="current-plan-meta">
                        ({{ currentPlanDuration }})
                    </span>
                    <span class="current-plan-meta">
                        {{
                            $t("settings.subscription.plan.valid_until", {
                                date: formatDate(currentPlan.endDate),
                            })
                        }}
                    </span>
                </template>
                <span v-else-if="currentPlan" class="current-plan-meta">
                    {{ $t("settings.subscription.current.no_expiry") }}
                </span>
            </div>
        </div>
        <div class="content-item">
            <div class="content-item-title">
                <div>
                    <span> {{ $t("settings.subscription.plan.title") }} </span>
                    <span> {{ $t("settings.subscription.plan.sub_title") }} </span>
                </div>
            </div>
            <template v-if="loading">
                <a-skeleton :loading="loading"></a-skeleton>
                <a-skeleton :loading="loading"></a-skeleton>
            </template>
            <div v-else class="plan-container">
                <div
                    v-for="plan in planData"
                    :key="plan.id"
                    :class="[
                        'plan-item',
                        plan.id === popularPlanId ? 'popular-item' : '',
                        plan.id === currentPlanId ? 'current-item' : '',
                    ]"
                >
                    <div v-if="plan.id === popularPlanId" class="popular-badge">
                        {{ $t("settings.subscription.plan.popular") }} 🔥
                    </div>
                    <div class="plan-name">{{ plan.name }}</div>
                    <div class="plan-price">
                        {{ formatCurrency(plan.price) }}đ
                        <div v-if="plan.duration > 0 && plan.unit" class="plan-duration">
                            {{ formatPlanDuration(plan.duration, plan.unit) }}
                        </div>
                        <div
                            v-if="plan.id === currentPlanId && currentPlan"
                            class="plan-duration plan-valid-until"
                        >
                            {{
                                $t("settings.subscription.plan.valid_until", {
                                    date: formatDate(currentPlan.endDate),
                                })
                            }}
                        </div>
                    </div>
                    <div class="plan-advance-container">
                        <div
                            v-for="feature in featuresOf(plan)"
                            :key="feature.key"
                            class="plan-advance"
                        >
                            <i
                                :class="[
                                    'bx',
                                    feature.enabled ? 'bx-check feature-on' : 'bx-x feature-off',
                                ]"
                            ></i>
                            {{ $t(`settings.subscription.plan.${feature.key}`) }}
                        </div>
                    </div>
                    <a-button
                        type="primary"
                        size="large"
                        class="main-color-btn"
                        :disabled="plan.id === currentPlanId"
                        @click="onBuyPlan(plan)"
                    >
                        {{
                            plan.id === currentPlanId
                                ? $t("settings.subscription.buttons.current_plan")
                                : $t("settings.subscription.buttons.Change_plan")
                        }}
                    </a-button>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
.current-plan-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    margin-top: 12px;
    padding: 10px 14px;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-md);
    background-color: var(--c-surface-subtle);
    min-width: 0;
}
.current-plan-name {
    color: var(--c-primary-text);
    font-size: 18px;
}
.current-plan-meta {
    color: var(--c-text-muted);
}

.plan-container {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    padding: 12px 0 0;
    box-sizing: border-box;
}

.plan-item {
    min-width: 0;
    min-height: 340px;
    display: flex;
    flex-direction: column;
    padding: 16px;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-xl);
    background-color: var(--c-surface);
    cursor: pointer;
    transition: border-color 0.15s ease;
}
.plan-item:hover {
    border-color: var(--main-color);
}

.popular-item {
    position: relative;
}

/* gói đang dùng: viền nhấn + nền nhấn nhạt */
.current-item {
    border-color: var(--main-color);
    box-shadow: 0 0 0 1px var(--main-color);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
}

.popular-badge {
    position: absolute;
    top: -12px;
    right: 16px;

    background-color: var(--main-color);
    color: var(--c-on-primary);
    font-size: 12px;
    font-weight: 500;
    padding: 2px 12px;
    border-radius: 999px;
}

.plan-name {
    color: var(--text-color);
    font-size: 18px;
    font-weight: 600;
}
.plan-price {
    font-size: 24px;
    font-weight: 700;
    margin: 0px 10px 20px 0px;
    display: flex;
    flex-direction: column;
}
.plan-duration {
    font-size: 14px;
    font-weight: 400;
    color: var(--c-text-muted);
}
.plan-valid-until {
    color: var(--c-success-text);
}

.plan-advance-container {
    flex: 1;
    margin-bottom: 10px;
}
.plan-advance i.feature-on {
    color: var(--c-success-text);
}
.plan-advance i.feature-off {
    color: var(--c-danger-text);
}
.main-color-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    height: auto;
    min-height: 40px;
    white-space: normal;
    text-align: center;
    width: 100%;
}
</style>
