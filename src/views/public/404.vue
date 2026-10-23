<template>
    <div class="error-page d-flex align-items-center justify-content-center">
        <div class="error-container text-center">
            <h1 class="error-status mb-0">404</h1>
            <h2 class="error-title">{{ $t("404.errorMessage") }}</h2>
            <p class="error-description">
                {{ $t("404.errorDescription") }}
            </p>
            <a href="/" class="error-button main-color-btn">{{ $t("404.homePageNavigator") }}</a>
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
    max-width: 520px;
    padding: 48px 32px;
    background-color: var(--content-item-background-color);
    border: 1px solid var(--content-item-border-color);
    border-radius: var(--ui-r-xl);
}

.error-status {
    font-size: 96px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--c-primary-text);
}

.error-title {
    margin: 16px 0 8px;
    font-size: 24px;
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
