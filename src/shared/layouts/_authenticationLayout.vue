<script setup lang="ts">
import home_vector from "@/assets/home_vector.png";
</script>

<template>
    <div class="authentication-container">
        <div class="authentication-item">
            <div>
                <div
                    class="pattern pattern-top"
                    :style="{ backgroundImage: `url(${home_vector})` }"
                ></div>
                <div
                    class="pattern pattern-bottom"
                    :style="{ backgroundImage: `url(${home_vector})` }"
                ></div>
            </div>
            <div class="authentication-item-text">
                <RouterLink :to="{ name: 'home' }">AIQuizizz</RouterLink>
            </div>
        </div>
        <RouterView />
    </div>
</template>
<style>
.authentication-item:nth-child(1) {
    background-color: #000;
    height: 100vh;
    width: 50vw;
    position: sticky;
    top: 0;
    align-self: flex-start;
    flex: none;
}

.pattern {
    position: absolute;
    width: 100%;
    height: 300px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    left: 0;
    pointer-events: none;
}

.pattern-top {
    top: 0;
    transform: rotate(180deg);
}

.pattern-bottom {
    bottom: 0;
}

.authentication-container {
    display: flex;
    min-height: 100vh;
}

.authentication-item-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    font-size: 60px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
    letter-spacing: -0.293px;
    background: linear-gradient(95deg, #5813c1 48.05%, #c45037 96.24%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* Thẻ form: cột phải là một thẻ trắng bo 16, viền 1px, đặt giữa nửa màn hình còn lại.
   Selector dài hơn để thắng các !important của responsive.css (width 100vw, padding 24px 48px). */
.authentication-container > .authentication-item:nth-child(2) {
    flex: none;
    align-self: center;
    width: min(480px, calc(50vw - 48px));
    margin: 24px auto;
    padding: 32px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}

.authentication-item-title {
    margin-bottom: 20px;
}

.authentication-item-title br {
    display: none;
}

.authentication-item-title span {
    display: block;
    font-style: normal;
    line-height: 1.4;
}
.authentication-item-title span:first-child {
    margin-bottom: 6px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.24px;
    color: var(--c-text);
}

.authentication-item-title span:last-child {
    font-size: 14px;
    font-weight: 400;
    color: var(--c-text-muted);
}
.authentication-item-external-login {
    display: flex;
    justify-content: space-between;
}
/* Nút đăng nhập Google: là <button> thật, dạng nút viền, hover/focus theo màu nhấn.
   Dùng chung token --c-* của theme sáng/tối. */
.external-login {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 20px;
    margin: 0 0 16px;
    border-radius: var(--ui-r-md);
    border: 1px solid var(--c-border-strong);
    background-color: var(--c-surface);
    color: var(--c-text);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
        background-color 0.2s,
        border-color 0.2s,
        box-shadow 0.2s;
}
.external-login:hover {
    border-color: var(--main-color);
    background-color: var(--c-surface-subtle);
}
.external-login:focus-visible {
    outline: none;
    border-color: var(--main-color);
    box-shadow: 0 0 0 2px var(--c-focus-ring);
}
.external-login-icon {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    background-size: cover;
    background-repeat: no-repeat;
}

.authentication-item-form button {
    margin: 4px 0px 0px;
}

/* Khoảng cách giữa các ô: thông báo lỗi không dính vào nhãn của ô kế tiếp */
.authentication-item-form .ant-form-item {
    margin-bottom: 16px;
}
.authentication-item-form .ant-form-item-with-help {
    margin-bottom: 12px;
}
.authentication-item-form .ant-form-item:last-child {
    margin-bottom: 0;
}
.authentication-item-form .ant-form-item-explain {
    min-height: 22px;
    padding-top: 4px;
}

/* Icon đặt trong ô nhập (slot prefix) thay vì addon: email và mật khẩu cùng cấu trúc nên luôn cùng màu nền / viền */
.authentication-item-form .ant-input-affix-wrapper {
    border-radius: var(--ui-r-sm);
    padding-inline: 12px;
}
.authentication-item-form .ant-input-prefix {
    margin-inline-end: 10px;
}
.authentication-item-form .ant-input-prefix .anticon {
    font-size: 16px;
    color: var(--c-text-muted);
}
.authentication-item-form .ant-input-affix-wrapper-focused .ant-input-prefix .anticon {
    color: var(--c-primary-text);
}

.authentication-item-form label {
    color: var(--text-color);
    font-size: 13px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    margin-bottom: 6px;
}

.authentication-item-navigator {
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--c-text-muted);
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    margin-top: 16px;
}
.authentication-item-navigator + .authentication-item-navigator {
    margin-top: 10px;
}

.authentication-item-navigator a {
    color: var(--c-primary-text);
    padding: 0px 8px;
    font-weight: 600;
}

@media screen and (max-width: 991.98px) {
    .authentication-container > .authentication-item:nth-child(2) {
        width: min(480px, calc(100vw - 32px)) !important;
        min-height: 0;
        margin: 16px auto !important;
        padding: 24px 20px !important;
    }
}

@media screen and (max-width: 600px) {
    .authentication-item:nth-child(1) {
        display: none;
    }
    .authentication-item-external-login {
        flex-direction: column;
    }
}
</style>
