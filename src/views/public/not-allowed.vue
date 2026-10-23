<script setup lang="ts">
</script>

<template>
    <div class="error-page d-flex align-items-center justify-content-center">
        <div class="error-container text-center">
            <h1 class="error-status mb-0">{{ $t("now_allowed.main_msg") }}</h1>
            <h2 class="error-title">
                {{ $t("now_allowed.errorMessage") }}
            </h2>
            <p class="error-description">{{ $t("now_allowed.errorDescription") }}</p>
            <a href="/user/library" class="error-button main-color-btn">
                {{ $t("now_allowed.libraryNavigator") }}
            </a>
        </div>
    </div>
</template>
<style scoped>
.error-page {
    min-height: 100vh;
    padding: 24px 16px;
    background-color: var(--background-color);
}

.error-container {
    width: 100%;
    max-width: 560px;
    padding: 48px 32px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}

.error-status {
    font-size: 36px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--c-primary-text);
}

.error-title {
    margin: 16px 0 8px;
    font-size: 20px;
    font-weight: 700;
    color: var(--c-text);
}

.error-description {
    margin-bottom: 28px;
    font-size: 15px;
    color: var(--c-text-muted);
}

.error-button {
    display: inline-flex;
    height: 44px;
    padding: 0 24px;
    border-radius: var(--ui-r-md);
    font-size: 14px;
    font-weight: 600;
}
</style>
