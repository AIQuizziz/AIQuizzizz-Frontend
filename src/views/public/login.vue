<script setup lang="ts">
import google_logo from "@/assets/google_logo.png";
import { GOOGLE_LOGIN_ENABLED } from "@/constants/features";

import { onMounted, reactive, ref } from "vue";
import { useAuthStore } from "@/stores/AuthStore";
import ApiAuthentication from "@/api/ApiAuthentication";
import { message } from "ant-design-vue";
import { LockOutlined, MailOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import {
    getBannedInfo,
    notifyLoginError,
    popBannedReason,
    formatBanReason,
    type BannedInfo,
} from "@/services/LoginErrorService";

const google_client_id = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const { t } = useI18n();

const authStore = useAuthStore();

const formRef = ref();
const labelCol = { span: 24 };
const wrapperCol = { span: 24 };

const formState = reactive({
    email: "",
    password: "",
});

const button_loading = ref(false);

const rules = {
    email: [
        {
            required: true,
            message: t("auth.validation.required"),
            trigger: "change",
        },
        {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: t("auth.validation.email"),
            trigger: "change",
        },
    ],
    // chỉ yêu cầu không để trống (không kiểm tra độ dài để không chặn mật khẩu cũ)
    password: [
        {
            required: true,
            message: t("auth.validation.required"),
            trigger: "change",
        },
    ],
};

// tài khoản bị cấm: hiển thị lý do (do admin nhập) ngay trên form
const bannedInfo = ref<BannedInfo | null>(null);

const onFinish = () => {
    formRef.value
        .validate()
        .then(async () => {
            try {
                button_loading.value = true;
                bannedInfo.value = null;
                let login_result = await ApiAuthentication.Login(formState);

                if (login_result?.data?.success) {
                    message.success("Login successfully. Redirecting...");
                    authStore.LoginSuccessful();
                }
            } catch (error) {
                const banned = getBannedInfo(error);
                if (banned) {
                    bannedInfo.value = banned;
                } else {
                    notifyLoginError(error);
                }
            } finally {
                button_loading.value = false;
            }
        })
        .catch(() => {}); // lỗi validate đã hiển thị inline trên form
};
const onGoogleLogin = async () => {
    sessionStorage.setItem("returnURL", authStore.returnURL); //set before leave
    const origin = window.location.origin;
    window.location
        .assign(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${google_client_id}&redirect_uri=${origin}/google-authentication-callback&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent
`);
};

onMounted(() => {
    // bị cấm khi đăng nhập Google -> trang callback chuyển lý do sang đây
    bannedInfo.value = popBannedReason();
});
</script>
<template>
    <div class="authentication-item">
        <div class="authentication-item-title">
            <span> {{ $t("auth.greetings.signIn") }}</span> <br />
            <span>{{ $t("auth.instructions.signIn") }}</span>
        </div>

        <a-alert
            v-if="bannedInfo"
            class="banned-alert"
            type="error"
            show-icon
            closable
            :message="$t('ERROR_CODE.ACCOUNT_BANNED')"
            @close="bannedInfo = null"
        >
            <template #description>
                <div class="banned-alert-reason">
                    <b>{{ $t("auth.banned.reason") }}:</b>
                    {{ formatBanReason(bannedInfo.reason) }}
                </div>
                <div class="banned-alert-contact">{{ $t("auth.banned.contact") }}</div>
            </template>
        </a-alert>

        <!-- đăng nhập Google đang tắt tạm (bật bằng VITE_ENABLE_GOOGLE_LOGIN=true, xem constants/features.ts) -->
        <template v-if="GOOGLE_LOGIN_ENABLED">
            <div class="authentication-item-external-login">
                <button type="button" class="external-login external-login-google" @click="onGoogleLogin">
                    <span class="external-login-icon" :style="{ backgroundImage: `url(${google_logo})` }" aria-hidden="true"></span>
                    <span>{{ $t("auth.buttons.continueWithGoogle") }}</span>
                </button>
            </div>
            <a-divider style="height: 1px; background-color: var(--c-border)">
                <span style="background-color: var(--content-item-background-color); color: var(--c-text-muted); padding: 0px 10px">{{
                    $t("auth.others.or")
                }}</span>
            </a-divider>
        </template>
        <a-form
            class="authentication-item-form"
            ref="formRef"
            :model="formState"
            :labelCol="labelCol"
            :wrapperCol="wrapperCol"
            :rules="rules"
        >
            <a-form-item label="" name="email">
                <label>{{ $t("auth.inputs.email") }}</label>
                <a-input
                    size="large"
                    v-model:value="formState.email"
                    :placeholder="$t('auth.inputs.emailPlaceholder')"
                >
                    <template #prefix>
                        <MailOutlined />
                    </template>
                </a-input>
            </a-form-item>
            <a-form-item label="" name="password">
                <label>{{ $t("auth.inputs.password") }}</label>
                <a-input-password
                    size="large"
                    v-model:value="formState.password"
                    :placeholder="$t('auth.inputs.password')"
                >
                    <template #prefix>
                        <LockOutlined />
                    </template>
                </a-input-password>
            </a-form-item>
            <a-form-item>
                <a-button
                    class="main-color-btn"
                    :loading="button_loading"
                    @click="onFinish"
                    size="large"
                    type="primary"
                    style="width: 100%"
                >
                    {{ $t("auth.buttons.signIn") }}
                </a-button>
            </a-form-item>
        </a-form>
        <div class="authentication-item-navigator">
            {{ $t("auth.navigators.signIn_signUp_ins") }}
            <RouterLink :to="{ name: 'register' }">
                {{ $t("auth.navigators.signUp_link") }}
            </RouterLink>
        </div>
        <div class="authentication-item-navigator">
            <RouterLink :to="{ name: 'forgot-password' }">
                {{ $t("auth.navigators.signIn_forgot_link") }}
            </RouterLink>
        </div>
    </div>
</template>
<style scoped>
.banned-alert {
    margin-bottom: 16px;
    text-align: left;
}

.banned-alert-reason {
    white-space: pre-line;
    word-break: break-word;
}

.banned-alert-contact {
    margin-top: 4px;
    font-size: 12px;
    opacity: 0.8;
}
</style>
